const fs = require('fs');
const path = require('path');
const https = require('https');

function sendTelegramAdminNotification(text) {
    return new Promise((resolve) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
        if (!token || !chatId) {
            console.warn('[TELEGRAM NOTIFY] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_CHAT_ID in environment.');
            return resolve(false);
        }

        const data = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                resolve(true);
            });
        });

        req.on('error', (err) => {
            console.error('[TELEGRAM NOTIFY] Request error:', err.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber, validatePassword } = require('./verificationService');
const bcrypt = require('bcrypt');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');
const TaskQueue = require('../utils/TaskQueue');

class TimestampedMap extends Map {
    constructor() {
        super();
        this.timestamps = new Map();
    }
    set(key, value) {
        super.set(key, value);
        this.timestamps.set(key, Date.now());
        return this;
    }
    delete(key) {
        this.timestamps.delete(key);
        return super.delete(key);
    }
    clear() {
        this.timestamps.clear();
        super.clear();
    }
}

// Password reset states map (userId -> { step })
const userStates = new TimestampedMap();
// Cache of recently processed message IDs to prevent duplicates
const processedMessageIds = new Set();

// Per-user serial queue — serializes messages from the same user to prevent
// DB race conditions. Different users are handled fully in parallel.
const messageQueue = new TaskQueue();
// Legacy map kept for backwards-compat (unused)
const whatsappCloudMessageQueues = new Map();

// Rate limiting maps
const userMsgTimestamps = new Map();

// Periodically clean up memory leaks in in-memory state & rate limit maps
setInterval(() => {
    try {
        const now = Date.now();
        const thirtyMinutesAgo = now - 30 * 60000;

        // Clean userStates
        for (const [key, timestamp] of userStates.timestamps.entries()) {
            if (timestamp < thirtyMinutesAgo) {
                userStates.delete(key);
            }
        }

        // Clean userMsgTimestamps
        for (const [userId, times] of userMsgTimestamps.entries()) {
            const activeTimes = times.filter(t => t > now - 60000);
            if (activeTimes.length === 0) {
                userMsgTimestamps.delete(userId);
            } else {
                userMsgTimestamps.set(userId, activeTimes);
            }
        }
    } catch (err) {
        console.error('[WHATSAPP CLOUD BOT MEMORY CLEANUP ERROR]:', err.message);
    }
}, 5 * 60000).unref();

// Helper to check rate limit for registered users (10 msgs in 1 min -> 10 min block)
async function checkRateLimit(userId, from) {
    try {
        const now = Date.now();
        if (!userMsgTimestamps.has(userId)) {
            userMsgTimestamps.set(userId, []);
        }
        const times = userMsgTimestamps.get(userId).filter(t => t > now - 60000);
        times.push(now);
        userMsgTimestamps.set(userId, times);

        if (times.length >= 10) {
            const blockedUntilDate = new Date(now + 10 * 60000);
            await db.execute(
                'UPDATE users SET rate_limit_blocked_until = ? WHERE id = ?',
                [blockedUntilDate, userId]
            );
            await sendCloudMessage(
                from,
                "⚠️ Waxaad gaadhay xadka farriimaha (Xeerka 1-Minute). Fadlan dib ugu soo laabo marka uu dhammaado waqtiga xannibaadda (10 daqiiqo)."
            );
            return true;
        }
    } catch (err) {
        console.error('[RATE LIMIT ERROR]:', err.message);
    }
    return false;
}

// Helper to check if user requests manager contact routing
function checkManagerRequest(text) {
    const clean = String(text || '').toLowerCase().trim();
    // Only intercept if the query is specifically asking for contact info, number, or is a single keyword
    const asksForContact = clean.includes('number') || 
                           clean.includes('nambar') || 
                           clean.includes('contact') || 
                           clean.includes('xidhiidh') || 
                           clean.includes('watsap') || 
                           clean.includes('whatsapp') ||
                           clean === 'manager' ||
                           clean === 'managerka' ||
                           clean === 'maamule' ||
                           clean === 'maamulaha' ||
                           clean === 'admin' ||
                           clean === 'adminka' ||
                           clean === 'owner' ||
                           clean === 'ownerka';

    if (!asksForContact) return null;

    const isPaymentManager = clean.includes('payment') ||
                             clean.includes('lacagta') ||
                             clean.includes('lacagaha');

    if (isPaymentManager) return 'payment';
    return 'general';
}

// Helper to check if user is giving correction feedback to the AI
function isWrongAnswerFeedback(text) {
    const clean = String(text || '').toLowerCase().trim();
    return clean.includes('waad khaladay') ||
           clean.includes('waad qaldantahay') ||
           clean.includes('waad khaldantahay') ||
           clean.includes('waad qaldan tahay') ||
           clean.includes('waad khaldan tahay') ||
           clean.includes('waad qaldantay') ||
           clean.includes('waad khaldantay') ||
           clean.includes('waad khaladday') ||
           clean.includes('waad qaldday') ||
           clean.includes('you are wrong') ||
           clean.includes('wrong answer');
}


// Create temp directory for voice notes if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Helper: Send HTTP request to Meta Graph API
async function callMetaAPI(endpoint, data = {}, method = 'POST') {
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    
    if (!accessToken || !phoneId) {
        console.error('[WHATSAPP CLOUD] Missing Meta API credentials (META_WA_ACCESS_TOKEN / META_WA_PHONE_NUMBER_ID)');
        return null;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneId}/${endpoint}`;
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: method === 'GET' ? undefined : JSON.stringify(data)
        });
        
        const resData = await response.json();
        if (!response.ok) {
            console.error('[WHATSAPP CLOUD] Meta API error:', resData);
            return null;
        }
        return resData;
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Meta API network error:', err.message);
        return null;
    }
}

// Download media (image/audio) from Meta using Media ID
async function downloadMetaMedia(mediaId, outputFilename) {
    const accessToken = process.env.META_WA_ACCESS_TOKEN;
    if (!accessToken) return null;

    try {
        // Step 1: Get media URL
        const metadataUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
        const metaRes = await fetch(metadataUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!metaRes.ok) {
            console.error('[WHATSAPP CLOUD] Failed to fetch media metadata for ID:', mediaId);
            return null;
        }
        const metadata = await metaRes.json();
        const mediaUrl = metadata.url;
        
        if (!mediaUrl) return null;

        // Step 2: Download binary data
        const mediaRes = await fetch(mediaUrl, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!mediaRes.ok) {
            console.error('[WHATSAPP CLOUD] Failed to download media from URL');
            return null;
        }

        const arrayBuffer = await mediaRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const filePath = path.join(uploadsDir, outputFilename);
        fs.writeFileSync(filePath, buffer);
        return { filePath, mimeType: metadata.mime_type };
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Media download error:', err.message);
        return null;
    }
}

// Send Text Message
async function sendCloudMessage(to, text) {
    console.log(`[WHATSAPP CLOUD] Sending message to ${to}...`);
    return await callMetaAPI('messages', {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
            preview_url: false,
            body: text
        }
    });
}

// Send Contact Card
async function sendCloudContactCard(to, phone, name) {
    console.log(`[WHATSAPP CLOUD] Sending contact card for ${name} (${phone}) to ${to}...`);
    const cleanPhone = phone.replace('+', '');
    return await callMetaAPI('messages', {
        messaging_product: "whatsapp",
        to: to,
        type: "contacts",
        contacts: [
            {
                name: {
                    formatted_name: name,
                    first_name: name,
                    last_name: ""
                },
                phones: [
                    {
                        phone: `+${cleanPhone}`,
                        type: "WORK",
                        wa_id: cleanPhone
                    }
                ]
            }
        ]
    });
}

// Send Reaction emoji
async function sendCloudReaction(to, messageId, emoji) {
    return await callMetaAPI('messages', {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "reaction",
        reaction: {
            message_id: messageId,
            emoji: emoji
        }
    });
}

// GET Webhook Verify (Meta portal verification)
exports.handleWebhookVerify = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const verifyToken = process.env.META_WA_VERIFY_TOKEN;

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('[WHATSAPP CLOUD] Webhook verified successfully!');
            return res.status(200).send(challenge);
        }
        console.warn('[WHATSAPP CLOUD] Webhook verification failed. Token mismatch.');
        return res.sendStatus(403);
    }
    return res.sendStatus(400);
};

// POST Webhook Receive (Incoming message from WhatsApp)
exports.handleWebhookPost = (req, res) => {
    // 1. Reply 200 OK immediately as required by Meta to avoid retries
    res.status(200).send('EVENT_RECEIVED');

    try {
        const body = req.body;
        if (body.object !== 'whatsapp_business_account') return;
        
        const entry = body.entry;
        if (!entry || !entry[0] || !entry[0].changes || !entry[0].changes[0]) return;
        
        const value = entry[0].changes[0].value;
        if (!value || !value.messages || !value.messages[0]) return;
        
        const message = value.messages[0];
        const from = message.from; // Sender number
        const messageId = message.id; // WhatsApp Message ID
        const type = message.type; // text, image, audio, etc.

        // Deduplicate incoming messages using messageId
        if (messageId) {
            if (processedMessageIds.has(messageId)) {
                console.log(`[WHATSAPP CLOUD] Duplicate message ignored: ${messageId}`);
                return;
            }
            processedMessageIds.add(messageId);
            // ✅ Instantly send 👀 reaction so user knows message was received
            sendCloudReaction(from, messageId, '👀').catch(err => {
                console.warn('[WHATSAPP CLOUD] Could not send seen reaction:', err.message);
            });
            if (processedMessageIds.size > 200) {
                const oldestId = processedMessageIds.values().next().value;
                processedMessageIds.delete(oldestId);
            }
        }

        let messageText = '';
        let mediaId = null;
        let mediaMime = null;

        if (type === 'text') {
            messageText = message.text.body;
        } else if (type === 'image') {
            mediaId = message.image.id;
            mediaMime = message.image.mime_type;
            messageText = message.image.caption || '';
        } else if (type === 'audio') {
            mediaId = message.audio.id;
            mediaMime = message.audio.mime_type;
        }

        // Enqueue message through per-user serial queue (same user = serialized,
        // global cap prevents overloading Gemini under heavy traffic)
        messageQueue.push(from, () => processIncomingMessage(from, messageId, type, messageText, mediaId, mediaMime)).catch(err => {
            console.error('[WHATSAPP CLOUD] Processing error:', err.message);
        });
    } catch (err) {
        console.error('[WHATSAPP CLOUD] Webhook parse error:', err.message);
    }
};



function isYesResponse(text) {
    const clean = text.toLowerCase().trim().replace(/[?!.]/g, '');
    return /^ha+$/i.test(clean) || 
           /^ye+y$/i.test(clean) || 
           /^haye$/i.test(clean) || 
           /^ok(ay)?$/i.test(clean) || 
           /^yes+$/i.test(clean) || 
           /^yep$/i.test(clean) || 
           clean === 'y' || 
           clean === 'sax' || 
           clean === 'sawn' || 
           clean === 'waa sax';
}

function isNoResponse(text) {
    const clean = text.toLowerCase().trim().replace(/[?!.]/g, '');
    return /^may?a*$/i.test(clean) || 
           /^no+p?e?$/i.test(clean) || 
           clean === 'n' || 
           clean === 'laa' || 
           clean.includes('ma rabo') || 
           clean.includes('ha rabin');
}

// Main processing logic
async function processIncomingMessage(from, messageId, type, messageText, mediaId, mediaMime, isDebounced = false) {
    console.log(`[WHATSAPP CLOUD] Received message: from=${from}, type=${type}, body="${messageText}"`);

    if (from.includes('@g.us') || from.includes('-') || from.includes('group')) {
        console.log(`[WHATSAPP CLOUD] Group message detected (${from}). Ignoring.`);
        return;
    }

    const normalizedPhone = normalizePhoneNumber(from);
    if (!normalizedPhone) return;

    // 1. Look up user in database
    const [users] = await db.execute(
        'SELECT id, name, is_suspended, rate_limit_blocked_until FROM users WHERE whatsapp_number = ? LIMIT 1',
        [normalizedPhone]
    );

    // If user not registered — start registration flow
    if (users.length === 0) {
        const regState = userStates.get(`reg_${from}`);

        // Step 0: New visitor — ask if they want to register
        if (!regState) {
            userStates.set(`reg_${from}`, { step: 'ask_register' });
            await sendCloudMessage(
                from,
                `👋 *Ahlan, ku soo dhawow Darkpen AI!*\n\n` +
                `Waxaan ahay caawiyahaaga waxbarashada ee ku shaqeeya sirdoonka macmalka ah. Diiwaangelintan waxay kaa caawin doontaa oo keliya inaad hadhow ku gasho abka Darkpen (Darkpen App) ee moobilka.\n\n` +
                `Ma rabtaa inaan hadda ku diiwaangeliyo? (Haa / Maya)`
            );
            return;
        }

        // Step 1: User said yes — ask for name
        if (regState.step === 'ask_register') {
            if (isYesResponse(messageText)) {
                userStates.set(`reg_${from}`, { step: 'awaiting_name' });
                await sendCloudMessage(from, `✅ Wanaagsan! Waxaan kaa codsanayaa macluumaad yar.\n\n👤 Fadlan ii qor *magacaaga buuxa* (tusaale: Axmed Xasan):`);
            } else if (isNoResponse(messageText)) {
                userStates.delete(`reg_${from}`);
                await sendCloudMessage(from, `Awright! Markasta oo aad rabto inaad isdiiwaangeliso, igu soo qor.\n\nAllaha kaa gargaaro! 🙏`);
            } else {
                await sendCloudMessage(from, `Fadlan ku jawaab *Haa* si aan kuu diiwaangeliyo, ama *Maya*.\n\nXogtan waxay kaa caawinaysaa oo keliya inaad hadhow ku gasho App-ka Darkpen. Ma ku diiwaangeliyaa?`);
            }
            return;
        }

        // Step 2: Collect name → auto-generate username → go straight to password
        if (regState.step === 'awaiting_name') {
            const name = messageText.trim();
            if (!name || name.length < 2 || name.length > 100) {
                await sendCloudMessage(from, `Magacaagu waa inuu ahaado 2 xaraf ama ka badan. Fadlan mar kale qor magacaaga:`);
                return;
            }

            // Auto-generate a unique username: first word of name (a-z only) + 4 random digits
            const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
            let username = baseUsername + Math.floor(1000 + Math.random() * 9000);
            // Ensure uniqueness — retry up to 5 times if taken
            for (let i = 0; i < 5; i++) {
                const [taken] = await db.execute('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
                if (taken.length === 0) break;
                username = baseUsername + Math.floor(1000 + Math.random() * 9000);
            }

            userStates.set(`reg_${from}`, { step: 'awaiting_reg_password', name, username });
            await sendCloudMessage(from, `👌 Wanaagsan, *${name}*!\n\n🔒 Hadda samee *password* adag:\n_(Ugu yaraan 8 xaraf, ugu badnaan 100 xaraf)_`);
            return;
        }

        // Step 3: Collect password & create account (username was auto-generated above)
        if (regState.step === 'awaiting_reg_password') {
            const passwordError = validatePassword(messageText);
            if (passwordError) {
                await sendCloudMessage(from, `⚠️ ${passwordError}\n\nFadlan mar kale qor password:`);
                return;
            }
            try {
                const hashedPassword = await bcrypt.hash(messageText.trim(), 12);
                await db.execute(
                    `INSERT INTO users (name, username, password, whatsapp_number, role, is_verified, is_suspended)
                     VALUES (?, ?, ?, ?, 'user', 1, 0)`,
                    [regState.name, regState.username, hashedPassword, normalizedPhone]
                );
                userStates.delete(`reg_${from}`);
                await sendCloudMessage(
                    from,
                    `🎉 *Waad ku guulaysatay diiwaangelinta!*\n\n` +
                    `📋 *Xogta akoonkaaga:*\n` +
                    `• *Magac:* ${regState.name}\n` +
                    `• *Username:* @${regState.username}\n` +
                    `• *Lambarka:* ${normalizedPhone}\n\n` +
                    `Xogtaan waxay kaa caawin doontaa inaad hadhow ku gasho abka Darkpen (Darkpen App) ee moobilka. Hadda waxaad ila hadli kartaa anigoo ah AI-gaaga gaarka ah. Maxaan kuu qabtaa? 🚀`
                );
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Registration DB error:', err.message);
                userStates.delete(`reg_${from}`);
                await sendCloudMessage(from, `❌ Waan ka xunnahay, cilad ayaa ku timid. Fadlan dib isku day.\n\nHaddii ay sii wadato, la xiriir maamulaha: +252637930329`);
            }
            return;
        }

        return;
    }


    const user = users[0];

    // Check rate limit block (persistent)
    if (user.rate_limit_blocked_until && new Date(user.rate_limit_blocked_until) > new Date()) {
        console.log(`[WHATSAPP CLOUD] User ${user.name} is rate limited until ${user.rate_limit_blocked_until}. Ignoring.`);
        return;
    }

    // If user is suspended, ignore
    if (user.is_suspended) {
        console.log(`[WHATSAPP CLOUD] User ${user.name} (${normalizedPhone}) is suspended. Ignoring.`);
        return;
    }

        const userId = user.id;

    // Check if the user is in the payment topup flow
    const regState = userStates.get(`reg_${from}`);
    if (regState && ['awaiting_topup_consent', 'awaiting_plan_choice', 'awaiting_payment_sender_number'].includes(regState.step)) {
        const cleanBody = messageText.toLowerCase().trim().replace(/[?!.]/g, '');
        
        // Check pending payments before proceeding
        const [pendingRows] = await db.execute(
            'SELECT id FROM payments WHERE user_id = ? AND status = "pending" LIMIT 1',
            [userId]
        );
        if (pendingRows.length > 0) {
            await sendCloudMessage(from, "Codsigaaga ku shubashada waa uu socdaa, fadlan sug inta laga soo hubinayo.");
            userStates.delete(`reg_${from}`);
            return;
        }

        if (regState.step === 'awaiting_topup_consent') {
            if (isYesResponse(messageText)) {
                userStates.set(`reg_${from}`, { step: 'awaiting_plan_choice' });
                
                const now = new Date();
                const promoStart = new Date('2026-06-20T00:00:00+03:00');
                const promoEnd   = new Date('2027-07-20T23:59:59+03:00');
                const isPromoPeriod = now >= promoStart && now <= promoEnd;
                const basicLabel = isPromoPeriod
                    ? `2. *Monthly Basic (Qiimo Dhimis):* $2 (Unlimited standard chat - 30 Days)`
                    : `2. *Monthly Basic:* $3 (Unlimited standard chat - 30 Days)`;

                await sendCloudMessage(
                    from,
                    `Fadlan dooro qorshaha aad rabto (Qor lambarka qorshaha tusaale: 1, 2 ama 3):\n\n` +
                    `1. *Pay as you go:* $0.5 (100 Credits)\n` +
                    `${basicLabel}\n` +
                    `3. *Monthly Premium:* $11 (Unlimited chat + premium support - 30 Days)`
                );
            } else if (isNoResponse(messageText)) {
                await sendCloudMessage(from, "Haye, waa la baajiyey (Cancel). Maxaan kale oo aan kuu qabtaa?");
                userStates.delete(`reg_${from}`);
            } else {
                await sendCloudMessage(
                    from,
                    `Fadlan ku jawaab *Haa* si aad u sii wadato ku shubashada, ama *Maya* si aad u baajiso.`
                );
            }
            return;
        }

        if (regState.step === 'awaiting_plan_choice') {
            if (['1', '2', '3'].includes(cleanBody)) {
                userStates.set(`reg_${from}`, { step: 'awaiting_payment_sender_number', plan: cleanBody });
                
                const now = new Date();
                const promoStart = new Date('2026-06-20T00:00:00+03:00');
                const promoEnd   = new Date('2027-07-20T23:59:59+03:00');
                const isPromoPeriod = now >= promoStart && now <= promoEnd;

                let planDesc = '';
                let amount = '0.5';
                if (cleanBody === '1') {
                    planDesc = 'Pay as you go ($0.5)';
                    amount = '0.5';
                } else if (cleanBody === '2') {
                    planDesc = isPromoPeriod ? 'Monthly Basic (Qiimo Dhimis - $2)' : 'Monthly Basic ($3)';
                    amount = isPromoPeriod ? '2' : '3';
                } else if (cleanBody === '3') {
                    planDesc = 'Monthly Premium ($11)';
                    amount = '11';
                }

                await sendCloudMessage(
                    from,
                    `Waxaad dooratay: *${planDesc}*\n\n` +
                    `Fadlan lacagta ku soo dir:\n` +
                    `• *EVC Plus:* Garaac *771*637930329*${amount}#\n` +
                    `• *ZAAD:* Garaac *220*637930329*${amount}#\n` +
                    `• *eDahab:* Garaac *700*659119779*${amount}#\n\n` +
                    `ℹ️ EVC Plus iyo ZAAD waxay wadaagaan isku number: *637930329*\n` +
                    `ℹ️ eDahab number: *659119779*\n\n` +
                    `Markaad lacagta soo dirtid, fadlan halkan ku soo qor *lambarka aad lacagta KA soo dirtay* (tusaale: 63#######) si aan u hubinno:`
                );
            } else {
                await sendCloudMessage(from, `Fadlan dooro lambarka qorshaha saxda ah (1, 2 ama 3):`);
            }
            return;
        }

        if (regState.step === 'awaiting_payment_sender_number') {
            const senderNum = messageText.trim();
            const isNumeric = /^\+?[\d\s.-]{6,15}$/.test(senderNum);
            
            if (!isNumeric) {
                regState.invalidCount = (regState.invalidCount || 0) + 1;
                if (regState.invalidCount > 2) {
                    await sendCloudMessage(from, "Markaad lacagta soo dirto, fadlan ila soo hadal oo lambarka saxda ah soo qor. Diiwaangelintii waa la joojiyay.");
                    userStates.delete(`reg_${from}`);
                } else {
                    await sendCloudMessage(from, "Fadlan qor lambarka aad lacagta ka soo dirtay (tusaale: 63#######):");
                }
                return;
            }

            const planChoice = regState.plan;
            let planName = '';
            let amount = 0.50;
            if (planChoice === '1') {
                planName = 'Pay as you go ($0.5)';
                amount = 0.50;
            } else if (planChoice === '2') {
                const now = new Date();
                const promoStart = new Date('2026-06-20T00:00:00+03:00');
                const promoEnd   = new Date('2027-07-20T23:59:59+03:00');
                const isPromoPeriod = now >= promoStart && now <= promoEnd;
                planName = isPromoPeriod ? 'Monthly Basic ($2 PROMO)' : 'Monthly Basic ($3)';
                amount = isPromoPeriod ? 2.00 : 3.00;
            } else if (planChoice === '3') {
                planName = 'Monthly Premium ($11)';
                amount = 11.00;
            }

            try {
                // Save to database
                await db.execute(
                    'INSERT INTO payments (user_id, amount, reference_number, service_type, status) VALUES (?, ?, ?, "general", "pending")',
                    [userId, amount, senderNum]
                );

                // Notify admin via Telegram!
                const tgMessage = `🔔 <b>DALAB LACAGEED OO CUSUB (WhatsApp Bot)!</b>\n\n` +
                    `👤 <b>Macaamilka:</b> ${user.name || 'Unknown'}\n` +
                    `💰 <b>Lacagta:</b> $${amount}\n` +
                    `📋 <b>Qorshaha:</b> ${planName}\n` +
                    `📞 <b>Lambarka u soo diray:</b> ${senderNum}\n` +
                    `📅 <b>Taariikhda:</b> ${new Date().toLocaleString('en-US')}\n\n` +
                    `<i>Fadlan gal Admin Dashboard si aad u xaqiijiso ama u diido.</i>`;
                
                await sendTelegramAdminNotification(tgMessage);

                await sendCloudMessage(from, "Codsigaaga ku shubashada lacagta waa la diray oo waa la hubinayaa. Fadlan sug inta laga soo tasdiqinayo. Waad mahadsan tahay! 🙏");
                userStates.delete(`reg_${from}`);
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Payment submission error:', err.message);
                await sendCloudMessage(from, "Waan ka xunnahay, codsigaaga lama gudbin karo hadda. Fadlan mar kale isku day waxyar ka dib.");
            }
            return;
        }
    }

    // Check rate limit (10 msgs in 1 min -> 10 min block)
    if (await checkRateLimit(userId, from)) {
        return;
    }

    // Intercept manager contact request
    const managerType = checkManagerRequest(messageText);
    if (managerType) {
        if (managerType === 'payment') {
            await sendCloudMessage(from, "Halkan kala xidhiidh Manager-ka Payments-ka (Lacag-bixinta): +252654810865");
        } else {
            await sendCloudMessage(from, "Halkan kala xidhiidh Maamulaha (Manager-ka): +252637930329");
        }
        return;
    }

    // Intercept AI correction feedback
    if (isWrongAnswerFeedback(messageText)) {
        await sendCloudMessage(
            from,
            "Waan ka xunnahay! Waxaan isku dayey 100% inaan saxo, laakiin hadda waxaan ku jiraa xaalad aan ku baranayo buugaagta manhajka dugsiyada.\n\n" +
            "Haddii aad aragtay wax weyn oo khaldan, fadlan la hadal maamulaha (manager-ka): +252637930329"
        );
        return;
    }

    // ─── Password Reset Flow ──────────────────────────────────────────────────────
    const cleanBody = (messageText || '').toLowerCase().trim();
    // Normalize common typos before keyword matching
    const normalizedBody = cleanBody
        .replace(/resset/g, 'reset')     // password resset → password reset
        .replace(/ressett/g, 'reset')
        .replace(/passward/g, 'password') // passward → password
        .replace(/pasword/g, 'password')  // pasword → password
        .replace(/passwrod/g, 'password') // passwrod → password
        .replace(/pssword/g, 'password')  // pssword → password
        .replace(/paswword/g, 'password') // paswword → password
        .replace(/ilaawey/g, 'ilaaway')   // Somali typos
        .replace(/ilaawaye/g, 'ilaaway')
        .replace(/illaaway/g, 'ilaaway')
        .replace(/baddal/g, 'badal')
        .replace(/badaal/g, 'badal');
    const state = userStates.get(userId);

    if (state && state.step === 'awaiting_password') {
        const passwordError = validatePassword(messageText);
        if (passwordError) {
            await sendCloudMessage(from, "Fadlan furaha sirta ah (password) ha ahaado ugu yaraan 8 xaraf. Fadlan mar kale qor furahaaga cusub:");
            return;
        }

        try {
            const hashedPassword = await bcrypt.hash(messageText.trim(), 12);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
            userStates.delete(userId);
            await sendCloudMessage(from, "Amniga: Furahaaga sirta ah (password) waa la bedelay si guul leh! Fadlan ilaasho furahaaga cusub. Hadda waad u isticmaali kartaa inaad ku gasho app-ka.");
        } catch (err) {
            console.error('[WHATSAPP CLOUD] Password reset db update failed:', err.message);
            await sendCloudMessage(from, "Waan ka xunnahay, cilad ayaa ku timid kaydinta furahaaga cusub. Fadlan mar kale isku day waxyar ka dib.");
        }
        return;
    }

    // ─── Help Guide Consent Flow ───
    if (state && state.step === 'awaiting_whatsapp_help_consent') {
        if (isYesResponse(cleanBody)) {
            userStates.delete(userId);
            await sendCloudMessage(from,
                `*SIDA UU U SHAQEYNYO WHATSAPP BOT-KU* 📱🚀\n` +
                `----------------------------------\n` +
                `1. *Qoraalka & AI:* Si caadi ah iila hadal, wax ii weydii, iigana sheekeyso wax kasta. Waxaan kuugu jawaabayaa isla luuqadda aad igu qortay.\n` +
                `2. *Sawirro (Images):* Iisoo dir sawir kasta (MCQ, xisaab, ama sharaxaad). Waxaan kuu soo saarayaa jawaabaha saxda ah si degdeg ah.\n` +
                `3. *Codadka (Voice Notes):* Iisoo dir fariin cod ah, waan ku dhageysanayaa, waanan kuu sharxayaa.\n` +
                `4. *Report:* Qor *report* mar kasta oo aad rabto inaad ogaato dhibcahaaga (credits) iyo qorshahaaga.\n` +
                `5. *Password Reset:* Qor *password reset* haddii aad rabto inaad bedesho furahaaga sirta ah.\n\n` +
                `Maxaan hadda kaa caawiyaa? 😊`
            );
            return;
        } else if (isNoResponse(cleanBody)) {
            userStates.delete(userId);
            await sendCloudMessage(from, "Haye, diyaar ayaan kuu ahay. Maxaan hadda kuu qabtaa? 🚀");
            return;
        } else {
            // Do not force yes/no response, clear state and fall through to process query
            userStates.delete(userId);
        }
    }

    // Broad & natural language password reset detection (Somali + English + typo-tolerant)
    const _checkPwReset = (body) =>
        // English phrases
        body.includes('password reset') ||
        body.includes('reset password') ||
        body.includes('forgot password') ||
        body.includes('forget password') ||
        body.includes('change password') ||
        body.includes('change my password') ||
        body.includes('lost password') ||
        body.includes('cant login') ||
        body.includes("can't login") ||
        body.includes("can't log in") ||
        body.includes('reset my password') ||
        body.includes('update password') ||
        // Somali phrases – natural speech
        (body.includes('password') && (
            body.includes('badal') ||
            body.includes('ilaaways') ||
            body.includes('ilaaway') ||
            body.includes('ma galin') ||
            body.includes('ma geli') ||
            body.includes('iga') ||
            body.includes('ii') ||
            body.includes('cusub') ||
            body.includes('waan') ||
            body.includes('waxaan')
        )) ||
        (body.includes('furaha') && (
            body.includes('badal') ||
            body.includes('ilaaways') ||
            body.includes('ilaaway') ||
            body.includes('ma galin') ||
            body.includes('cusub') ||
            body.includes('iga') ||
            body.includes('ii')
        )) ||
        // Common full phrases
        body.includes('passwordka waan ilaaway') ||
        body.includes('password waan ilaaway') ||
        body.includes('furaha waan ilaaway') ||
        body.includes('passwordka iga badal') ||
        body.includes('password iga badal') ||
        body.includes('furaha iga badal') ||
        body.includes('bedel password') ||
        body.includes('bedel furaha') ||
        body.includes('furaha badal') ||
        body.includes('password badal') ||
        body.includes('ma geli karo password') ||
        body.includes('ma galin karo') ||
        body.includes('app lagama geli karo') ||
        body.includes('kuma geli karo') ||
        body.includes('password ilaaway') ||
        body.includes('furaheygii waan ilaaway') ||
        body.includes('furaheygii ilaaway');

    const isPasswordResetRequest = _checkPwReset(cleanBody) || _checkPwReset(normalizedBody);

    if (isPasswordResetRequest) {
        // Security check: if they specified a phone number in their message text,
        // it must match their WhatsApp account number (normalizedPhone).
        const phoneRegex = /\+?\d{7,15}/g;
        const foundNumbers = [];
        let match;
        
        // Search in the original messageText and normalizedBody
        const rawBody = messageText || '';
        while ((match = phoneRegex.exec(rawBody)) !== null) {
            const norm = normalizePhoneNumber(match[0]);
            if (norm && !foundNumbers.includes(norm)) {
                foundNumbers.push(norm);
            }
        }
        
        while ((match = phoneRegex.exec(normalizedBody)) !== null) {
            const norm = normalizePhoneNumber(match[0]);
            if (norm && !foundNumbers.includes(norm)) {
                foundNumbers.push(norm);
            }
        }

        let hasMismatch = false;
        for (const num of foundNumbers) {
            if (num !== normalizedPhone) {
                hasMismatch = true;
                break;
            }
        }

        if (hasMismatch) {
            await sendCloudMessage(from, "numberkan aad soo qortey iyo kan whatsappka isku mid maaha ee waa ka xunahay ma badali karo kaas whatsappkiisa igala soo hadal");
            return;
        }

        userStates.set(userId, { step: 'awaiting_password' });
        await sendCloudMessage(from, "Haye! Si aan kuugu badalo password-kaaga, fadlan ii soo qor password-ka cusub ee aad rabto (ugu yaraan 8 xaraf):");
        return;
    }

    // ─── WhatsApp Report Request Flow ─────────────────────────────────────────────
    const isReportRequest = 
        cleanBody === 'report' ||
        cleanBody.includes('xogteyda') ||
        cleanBody.includes('xogtayda') ||
        cleanBody.includes('my report') ||
        cleanBody.includes('my info') ||
        cleanBody.includes('soo dir xog') ||
        cleanBody.includes('iisoo dir xog') ||
        cleanBody.includes('warbixinteyda') ||
        cleanBody.includes('warbixintayda');

    if (isReportRequest) {
        try {
            const [userDataRows] = await db.execute(`
                SELECT u.*, 
                       (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NOT NULL) AS app_messages_count,
                       (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NULL) AS whatsapp_messages_count,
                       (SELECT balance FROM user_wallet WHERE user_id = u.id) AS credits,
                       (SELECT type FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_type,
                       (SELECT expiry_date FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_expiry
                FROM users u WHERE u.id = ?
            `, [userId]);

            if (userDataRows.length > 0) {
                const userData = userDataRows[0];
                const dateJoined = new Date(userData.created_at).toLocaleDateString('so-SO');
                const statusText = userData.is_suspended ? 'Xaniban (Suspended)' : 'Firfircoon (Active)';
                
                let planText = 'None';
                if (userData.sub_type) {
                    const planName = userData.sub_type === 'monthly_11' ? 'Premium' : 'Basic';
                    const daysLeft = Math.ceil((new Date(userData.sub_expiry) - new Date()) / (1000 * 60 * 60 * 24));
                    planText = `${planName} (${daysLeft} casho ayaa u hadhay)`;
                }

                const reportMessage = `*DARKPEN REPORT* 📝📚\n` +
                  `----------------------------------\n` +
                  `👤 *Magaca:* ${userData.name}\n` +
                  `🆔 *Username:* @${userData.username || 'ma jiro'}\n` +
                  `📅 *Ku biiray:* ${dateJoined}\n` +
                  `💎 *Credits-ka Wallet:* ${userData.credits || 0}\n` +
                  `💬 *Wada-sheekaysiga AI:* ${userData.app_messages_count || 0}\n` +
                  `💬 *Wada-sheekaysiga WhatsApp:* ${userData.whatsapp_messages_count || 0}\n` +
                  `🏆 *Dhibcaha Tartanka (XP):* ${userData.xp || 0} XP\n` +
                  `💳 *Qorshaha (Plan):* ${planText}\n` +
                  `🔒 *Status-ka:* ${statusText}\n\n` +
                  `Mahadsanid, sii wad isticmaalka Darkpen! 🚀`;

                await sendCloudMessage(from, reportMessage);
            } else {
                await sendCloudMessage(from, "Waan ka xunnahay, xogtaada lama heli karo hadda.");
            }
        } catch (err) {
            console.error('[WHATSAPP CLOUD] Failed to send user report:', err.message);
            await sendCloudMessage(from, "Cilad ayaa ku timid helida xogtaada. Fadlan mar kale isku day.");
        }
        return;
    }

    // ─── WhatsApp Payment Request Flow ─────────────────────────────────────────────
    const isPaymentRequest = 
        cleanBody === 'shubo' ||
        cleanBody.includes('ku shubo') ||
        cleanBody.includes('kushubo') ||
        cleanBody.includes('shubo lacag') ||
        cleanBody.includes('ku shubo lacag') ||
        cleanBody.includes('lacag shubo') ||
        cleanBody.includes('top up') ||
        cleanBody.includes('topup') ||
        cleanBody.includes('payment') ||
        cleanBody.includes('pricing') ||
        cleanBody.includes('qiimaha') ||
        cleanBody.includes('qorshaha');

    if (isPaymentRequest) {
        // Start the topup consent flow
        userStates.set(`reg_${from}`, { step: 'awaiting_topup_consent' });
        await sendCloudMessage(
            from,
            `💳 *Ku shubo lacag si aad u sii wadato hadalka.*\n\n` +
            `Ma rabtaa inaan kuu bilaabo habka ku shubashada lacagta? (Ku jawaab: *Haa* ama *Maya*)`
        );
        return;
    }





    // 2. Enforce Rate Limiting
    const now = new Date();
    const [cooldownRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM whatsapp_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (cooldownRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = cooldownRow[0];

        // Check if currently locked
        if (cooldown_until && new Date(cooldown_until) > now) {
            console.log(`[WHATSAPP CLOUD] User ${user.name} is on cooldown. Ignoring.`);
            return;
        }

        // Check if the 3-minute window has passed since their last message
        const lastMsgDate = new Date(last_message_at);
        const diffMinutes = (now.getTime() - lastMsgDate.getTime()) / (1000 * 60);

        if (diffMinutes > 3) {
            // Reset window count
            await db.execute(
                'UPDATE whatsapp_cooldowns SET message_count = 1, cooldown_until = NULL, notified_expiry = FALSE WHERE user_id = ?',
                [userId]
            );
        } else {
            const newCount = message_count + 1;
            // Rate limit: 20 messages per 3-minute window → 30-min cooldown
            if (newCount > 20) {
                // Lock for 30 minutes
                const cooldownUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, cooldown_until = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, cooldownUntil, userId]
                );

                const formatTime = cooldownUntil.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false, 
                    timeZone: 'Africa/Mogadishu' 
                });

                await sendCloudMessage(
                    from, 
                    `⏳ Waxaad u diraysaa fariimo badan oo dhakhso ah. Fadlan yara sug ilaa ${formatTime}. Haddii aad degdegeyso, isticmaal app-ka si toos ah.`
                );
                return;
            } else {
                await db.execute(
                    'UPDATE whatsapp_cooldowns SET message_count = ?, notified_expiry = FALSE WHERE user_id = ?',
                    [newCount, userId]
                );
            }
        }
    } else {
        // Create first tracking record
        await db.execute(
            'INSERT INTO whatsapp_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?, 1, NULL, FALSE)',
            [userId]
        );
    }

    // 3. Handle Voice Notes / Audio
    const isVoice = type === 'audio';
    let voiceCostApplied = false;

    if (isVoice && mediaId) {
        console.log(`[WHATSAPP CLOUD] Processing voice note for ${user.name}`);
        
        // Check balance (must have >= 20 credits)
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

        if (!hasBalance) {
            await sendCloudMessage(
                from,
                `💳 *Dhibcahaagu way dhammaadeen (Dhegeysiga codku wuxuu rabaa 20 Credits).*\n\nFadlan ku shubo lacag si aan kuula sii hadlo oo aan kuugu caawiyo waxbarashadaada.\n\n*Ma kuugu shubaa lacagta?* (Ku jawaab: *Haa* ama *Maya*)`
            );
            userStates.set(`reg_${from}`, { step: 'awaiting_topup_consent' });
            return;
        }

        const ext = mediaMime ? (mediaMime.split(';')[0].split('/')[1] || 'ogg') : 'ogg';
        const tempFilename = `wa_cloud_voice_${userId}_${Date.now()}.${ext}`;
        
        // Download voice file
        const downloadRes = await downloadMetaMedia(mediaId, tempFilename);
        if (!downloadRes) {
            await sendCloudMessage(from, 'Waan ka xunnahay, codka laguma guulaysan in la soo dejiyo.');
            return;
        }

        // Transcribe voice note
        try {
            await sendCloudMessage(from, '_Dhegeysanaya codka..._');
            messageText = await transcribeAudio(downloadRes.filePath);
            voiceCostApplied = true;
            console.log(`[WHATSAPP CLOUD] Voice transcription: "${messageText}"`);
        } catch (transErr) {
            console.error('[WHATSAPP CLOUD] Transcription error:', transErr);
            await sendCloudMessage(from, 'Waan ka xunnahay, codka lama fahmin.');
            return;
        } finally {
            // Clean up temp file
            if (fs.existsSync(downloadRes.filePath)) {
                fs.unlinkSync(downloadRes.filePath);
            }
        }
    }

    // 4. Calculate and verify Credit Cost (For Text or Image)
    let cost = 1;
    const hasImage = type === 'image';
    
    if (voiceCostApplied) {
        cost = 20;
    } else if (hasImage) {
        cost = 10;
    } else {
        const len = messageText.length;
        if (len < 150) {
            cost = 1;
        } else if (len < 500) {
            cost = 3;
        } else if (len < 1500) {
            cost = 7;
        } else {
            cost = 12;
        }
    }

    // Check subscription
    const [sub] = await db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text', cost);
    }

    // If free trial not used, check and deduct wallet balance
    if (!hasActiveSub && !usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (balance < cost) {
            await sendCloudMessage(
                from,
                `💳 *Dhibcahaagu way dhammaadeen.*\n\nFadlan ku shubo lacag si aan kuula sii hadlo oo aan kuugu caawiyo waxbarashadaada.\n\n*Ma kuugu shubaa lacagta?* (Ku jawaab: *Haa* ama *Maya*)`
            );
            userStates.set(`reg_${from}`, { step: 'awaiting_topup_consent' });
            return;
        }

        // Deduct cost
        await db.execute('UPDATE user_wallet SET balance = GREATEST(0, balance - ?) WHERE user_id = ?', [cost, userId]);
    }

    // 5. Handle Image Attachment
    let attachmentData = null;
    if (hasImage && mediaId) {
        const tempFilename = `wa_cloud_img_${userId}_${Date.now()}.jpg`;
        const downloadRes = await downloadMetaMedia(mediaId, tempFilename);
        if (downloadRes) {
            try {
                const imgBuffer = fs.readFileSync(downloadRes.filePath);
                attachmentData = {
                    base64: imgBuffer.toString('base64'),
                    mimeType: downloadRes.mimeType || 'image/jpeg'
                };
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Image conversion error:', err.message);
            } finally {
                if (fs.existsSync(downloadRes.filePath)) {
                    fs.unlinkSync(downloadRes.filePath);
                }
            }
        }
    }

    // 6. Get History
    let history = [];
    const [historyRes] = await db.execute(
        'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY id DESC LIMIT 5',
        [userId]
    );

    history = historyRes.reverse().map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
    }));

    // System Instructions
    const darkpenSystemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).
    
    Rules:
    1. IDENTITY & CAPABILITIES: 
       - NEVER prepend any self-introduction banner (e.g. "Hello! Waxaan ahay Darkpen...") to your replies. Only mention your name or creator if the user explicitly asks "Who are you?", "Who made you?", "Cidaa ku samaysay?" or similar direct identity questions.
       - If the user asks what you do, how you can help, your capabilities, or similar questions (e.g., "maxaad qabataa", "maxad iga caawin kartaa", "what can you do"): Explain your capabilities in a beautiful, structured Somali message with rich emojis. Highlight that you are excellent at education (waxbarashada), having studied over 10,000 curriculum books and resolved 50,000+ exams. At the end of the message, you MUST append: "Hadaad ubaahan tahay macluumaad dheeraad ah la xidhiidh managerkayga (+252637930329)" so that the manager's contact card can be sent to them.
    2. LANGUAGE CONSISTENCY:
       - You MUST respond in the EXACT same language that the user spoke to you (Somali when asked in Somali, English when asked in English, etc.).
       - If an image is provided, analyze it and reply in the same language.
    3. EXAMS, IMAGES & QUESTIONS:
       - When analyzing an image, you MUST carefully verify the details, double-check all calculations or question options, and perform a self-validation check to ensure your answer is completely correct. Do not rush or make assumptions.
       - If the image contains exam questions, identify the question TYPE first, then format as follows:

        A) MCQ (Multiple Choice / doorasho): Use ULTRA-COMPACT summary only — do NOT write the question text. Just list: *1 = A, 2 = C, 3 = B, 4 = D* (one line or stacked, number = correct letter). Example:
           *Jawaabaha:*
           1 = A
           2 = C
           3 = B
           4 = D

        B) TRUE/FALSE (Run/Been / Saxan-Qaldaan): Use ULTRA-COMPACT summary only — do NOT write the question text. Just list: *1 = Run, 2 = Been, 3 = Run* (number = Run ama Been). Example:
           *Jawaabaha:*
           1 = Run
           2 = Been
           3 = Run
           4 = Run

        C) Open-ended / Descriptive / Math: For these ONLY, write each question in bold, then place the answer directly below it prefixed with "Jawaab: " (or "الجواب: " for Arabic, "Answer: " for English). Show brief step-by-step if math.

        - NEVER mix the formats. MCQ stays compact. True/False stays compact. Only open-ended gets full bold question + answer.
        - Always double-check every single answer before responding.
    4. CONCISENESS BY DEFAULT: Keep your responses short, concise, and easy to understand. Avoid long explanations unless:
       - The user explicitly asks for an explanation (e.g., "sharax", "explain", "faahfaahi").
       - The topic is complex and cannot be answered briefly without losing essential meaning.
    5. ENGAGING QUESTIONS: ALWAYS end your response with an engaging, thought-provoking, and exciting question related to the topic of discussion to keep the conversation active and interesting.
    6. SLANG & TYPOS: You must be highly intelligent and understanding of Somalised slang, abbreviations, typos, and casual text message shorthand. Even if the user's question is brief, fragmented, or difficult to understand, use context and intelligent prediction to understand their true intent and provide a helpful response.
    7. EDUCATIONAL & SCIENTIFIC ACCURACY: If the topic is educational, scientific, or mathematical, you must double-check your facts, formulas, and reasoning to ensure 100% accuracy and reliability. Do not provide incorrect information.
    8. Formatting: Highlight key terms using *Keyword* (bold) instead of markdown. Do not add spaces inside formatting symbols (e.g., use *bold* not * bold *).
    9. Shaxan (Table): Marka aad xog shax ah soo bandhigayso (tusaale: liiska xanuunada oo kasta leh magac, sababta, qaabka iwm), isticmaal qaabkan cad oo WhatsApp-ku si fiican u soo bandhiyo — kaga fogaan markdown shaxanka (| col |). Tusaale:
    *1. Tuberculosis (TB)*
    ━━━━━━━━━━━━━━━━━━━━━━
    🔹 *Sababta:* Mycobacterium tuberculosis
    🔹 *Qaabka:* Hawada (respiratory)
    🔹 *Daaweynta:* Antibiotics 6 bilood
    ━━━━━━━━━━━━━━━━━━━━━━
    *2. Malaria*
    ━━━━━━━━━━━━━━━━━━━━━━
    🔹 *Sababta:* Plasmodium parasite
    🔹 *Qaabka:* Kaneecada
    🔹 *Daaweynta:* Antimalarial drugs
    ━━━━━━━━━━━━━━━━━━━━━━
    Isticmaal emoji ku habboon qolofta sida 🦠 caabuqa, 🧪 daawada, iwm si ay u muuqato fiican.
    10. Pricing info: Pay as you go $0.5 (100 credits), Monthly Basic $3 (unlimited standard chat, 1000 credits), Monthly Premium $11 (unlimited chat + premium math/science/image support, 5000 credits). 🎉 QIIMO DHIMIS (ilaa 20/07/2027): Monthly Basic (Bille Basic) waxaa laga heli karaa $2 kaliya! (Fadlan marnaba ha sheegin inta credit ama xog kale ee qorshahan $2 ah ku jirta, kaliya sheeg inuu yahay Bille Basic / Monthly Basic oo qiimo dhimis ah oo lagu heli karo $2 kaliya). Payment: EVC Plus dial *771*637930329*amount# | ZAAD dial *220*637930329*amount# (same number 637930329) | eDahab dial *700*659119779*amount#. After sending, user types sender number here. Contact: WhatsApp +252637930329.
    11. USER SATISFACTION: Your primary goal is to satisfy and persuade the user. Be helpful, warm, and accommodating. NEVER try to redirect the user away or respond in a way that frustrates them.
    12. PERSONALITY & HUMOR (KAFTAN): Be friendly, warm, and humorous. You can joke, tease, and play along with the user. If a user writes something rude, inappropriate, or sexual ("edeb darro"), reject it politely but with a lighthearted, playful, and teasing tone (kaftan diido ah), never being harsh or overly formal.`;

    // 7. Call Gemini API
    // Build final prompt - smart image detection
    const hasCaption = messageText && messageText.trim().length > 0;
    let finalPrompt;
    if (attachmentData && !hasCaption) {
        // Image with no caption: detect quiz vs normal image
        finalPrompt = `Fiiri sawirkan. Kahor intaadan jawaabin, si fiican u akhri oo u falanqee su'aalaha ku jira, kuna samee xaqiijin labaad (double check) si aad u hubiso in jawaabtu tahay 100% sax ah oo aysan ku jirin wax qalad ah.

Haddii su'aaluhu yihiin MCQ (doorasho): si kooban u soo koobi kaliya lambarada iyo xarfaha jawaabta: "1 = A, 2 = C, 3 = B" iwm. Su'aasha ha qorin.

Haddii su'aaluhu yihiin Run/Been (True/False): si kooban u soo koobi kaliya: "1 = Run, 2 = Been, 3 = Run" iwm. Su'aasha ha qorin.

Haddii su'aaluhu yihiin buuxbuuxin (fill-in-the-blank / meelaha banaan ee lagu buuxin lahaa): dib u qor jumladda oo dhan laakiin meeshii bannaanka ahayd ku qor jawaabta saxda ah oo aad uga dhigtay *jawaabta* (bold). Tusaale: "Soomaaliya waxay xorriyaddeeda qaadatay *1 July 1960*". Ha isticmaalin jadwal.

Haddii su'aaluhu yihiin isku-beegbeeg (matching / Column A matches Column B): u soo bandhig si kooban oo qurxoon sidan:
1. [term] → [matching answer]
2. [term] → [matching answer]
(isticmaal → symbol si uu u muuqdo fiican WhatsApp-ka)

Haddii su'aaluhu yihiin furan (open-ended) ama xisaab: su'aal kasta ku soo qaado adigoo bold ka dhigaya, jawaabtana hoos dhig adigoo ka horreysiinaya "Jawaab: " (ama "الجواب: " haddii ay Carabi tahay).

Ku jawaab luuqadda qoraalka sawirka ku dhex jira.`;
    } else if (attachmentData && hasCaption) {
        // Image with caption: append verification instruction
        finalPrompt = `${messageText}\n\n[Fadlan si fiican u hubi sawirka iyo xogta si aad u keento jawaab 100% sax ah oo aad uga fogaato khaladaadka.]`;
    } else {
        finalPrompt = messageText || 'Hello';
    }

    try {
        const aiResponse = await askGemini(finalPrompt, "gemini-3.1-flash-lite", attachmentData, history, darkpenSystemInstruction);

        let isRunningOut = false;
        const [walletRows] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const finalBalance = walletRows.length > 0 ? walletRows[0].balance : 0;
        if (hasActiveSub && sub.length > 0) {
            const expiryDate = new Date(sub[0].expiry_date);
            const now = new Date();
            const msRemaining = expiryDate.getTime() - now.getTime();
            const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
            if (daysRemaining <= 2 || finalBalance < 50) {
                isRunningOut = true;
            }
        } else {
            if (finalBalance < 20) {
                isRunningOut = true;
            }
        }

        // Format response to replace HTML-style tags with WhatsApp-supported bold and emojis
        let formattedResponse = formatResponseForWhatsApp(aiResponse);
        if (isRunningOut) {
            formattedResponse += "\n\n⚠️ *Lacagtaadii wey kaa sii dhamaanaysaa ee ku shubo lacag.*";
        }

        // Send response via WhatsApp Cloud API
        await sendCloudMessage(from, formattedResponse);

        // Send contact card if the support/manager numbers are mentioned in the response
        if (formattedResponse.includes('+252637930329') || formattedResponse.includes('637930329')) {
            try {
                await sendCloudContactCard(from, '252637930329', 'Manager General');
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Failed to send manager contact card:', err.message);
            }
        }
        if (formattedResponse.includes('+252654810865') || formattedResponse.includes('654810865')) {
            try {
                await sendCloudContactCard(from, '252654810865', 'Manager Payments');
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Failed to send payment manager contact card:', err.message);
            }
        }
        if (formattedResponse.includes('+252659119779') || formattedResponse.includes('659119779')) {
            try {
                await sendCloudContactCard(from, '252659119779', 'Support Team');
            } catch (err) {
                console.error('[WHATSAPP CLOUD] Failed to send support contact card:', err.message);
            }
        }

        // Emoji reaction (40% chance)
        if (Math.random() < 0.4) {
            const reactions = ['👍', '❤️', '😂', '😮', '😢'];
            let chosenReaction = reactions[0]; // default '👍'
            const lowerPrompt = finalPrompt.toLowerCase();
            if (lowerPrompt.includes('dhib') || lowerPrompt.includes('xun') || lowerPrompt.includes('buux') || lowerPrompt.includes('tiiraanyo')) {
                chosenReaction = '😢';
            } else if (lowerPrompt.includes('ha') || lowerPrompt.includes('qosol') || lowerPrompt.includes('kaftan') || lowerPrompt.includes('he')) {
                chosenReaction = '😂';
            }
            await sendCloudReaction(from, messageId, chosenReaction).catch(() => {});
        }

        // Save messages to database sequentially using await to prevent out-of-order IDs and identical timestamps
        try {
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "user", ?)',
                [userId, finalPrompt]
            );
            await db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, NULL, "ai", ?)',
                [userId, aiResponse]
            );
        } catch (dbErr) {
            console.error('[WHATSAPP CLOUD] DB save messages error:', dbErr.message);
        }

        // Log usage
        logAIUsage(
            userId, 
            'gemini-3.1-flash-lite', 
            finalPrompt, 
            aiResponse, 
            voiceCostApplied ? 'voice' : (hasImage ? 'image' : 'education'),
            'whatsapp'
        ).catch(err => console.error('[WHATSAPP CLOUD] Logging error:', err.message));

    } catch (err) {
        console.error('[WHATSAPP CLOUD] Gemini generation error:', err);
        await sendCloudReaction(from, messageId, '').catch(() => {});
        await sendCloudMessage(from, 'Waan ka xunnahay, Darkpen waxaa ku yimid cilad farsamo oo ku meel gaadh ah. Si aan hawshaadu u xanibmin, fadlan nagala hadal Telegram-ka: t.me/darkpenBot ama toos ula xidhiidh Maamulaha: +252637930329.');
    }
}

// Helper: Format HTML tags into WhatsApp bolding
function formatResponseForWhatsApp(text) {
    if (!text) return '';
    
    let formatted = text;
    
    // Replace <green>content</green> with *content*
    formatted = formatted.replace(/<green>([\s\S]*?)<\/green>/gi, '*$1*');
    
    // Replace <red>content</red> with *content*
    formatted = formatted.replace(/<red>([\s\S]*?)<\/red>/gi, '*$1*');
    
    // Replace <callout>content</callout> with *$1*
    formatted = formatted.replace(/<callout>([\s\S]*?)<\/callout>/gi, '*$1*');
    
    // Remove any legacy <table_data> tags if AI still sends them (fallback to plain text)
    formatted = formatted.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (match, tableContent) => {
        const lines = tableContent.trim().split('\n');
        if (lines.length === 0) return '';
        const headers = lines[0].split('|').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split('|').map(c => c.trim()));
        const divider = '━━━━━━━━━━━━━━━━━━━━━━';
        let output = '';
        rows.forEach((row, rowIdx) => {
            output += `\n*${rowIdx + 1}.* `;
            const firstVal = row[0] || '';
            output += `*${firstVal}*\n${divider}\n`;
            row.slice(1).forEach((col, idx) => {
                const header = headers[idx + 1] || '';
                if (col) output += `🔹 *${header}:* ${col}\n`;
            });
            output += `${divider}\n`;
        });
        return output;
    });

    // 0. Convert raw markdown pipe tables into clean card-style WhatsApp format
    // Detects blocks of lines that look like | col | col | and separator rows like |---|---|
    formatted = formatted.replace(/((?:^\|.+\|[ \t]*\n?)+)/gm, (tableBlock) => {
        const allLines = tableBlock.trim().split('\n').map(l => l.trim());
        const dataLines = allLines.filter(l => l.startsWith('|') && !l.match(/^\|[\s\-:]+\|/));
        if (dataLines.length < 2) return tableBlock; // Not a real table, leave as-is
        const headers = dataLines[0].split('|').map(h => h.trim()).filter(Boolean);
        const rows = dataLines.slice(1).map(l => l.split('|').map(c => c.trim()).filter(Boolean));
        if (rows.length === 0) return tableBlock;
        const divider = '━━━━━━━━━━━━━━━━━━━━━━';
        let output = '\n';
        rows.forEach((row, rowIdx) => {
            const title = row[0] || `Item ${rowIdx + 1}`;
            output += `*${rowIdx + 1}. ${title}*\n${divider}\n`;
            row.slice(1).forEach((col, idx) => {
                const header = headers[idx + 1] || '';
                if (col) output += `🔹 *${header}:* ${col}\n`;
            });
            output += `${divider}\n\n`;
        });
        return output;
    });

    // 1. Convert markdown headers (# Title, ## Title, etc.) to WhatsApp bold titles
    formatted = formatted.replace(/^(#{1,6})\s+(.+)$/gm, '*$2*');

    // 2. Convert markdown list items (* item or - item) to bullet points (• item)
    // This must be done BEFORE resolving bold tags to avoid messing up lists.
    formatted = formatted.replace(/^\s*[\*\-]\s+/gm, '• ');

    // 3. Clean up triple stars (bold-italic in markdown) -> *_text_* (bold italic in WhatsApp)
    formatted = formatted.replace(/\*\*\*+\s*([^\*]+?)\s*\*\*\*+/g, '*_$1_*');

    // 4. Convert markdown bold (**bold**) to WhatsApp bold (*bold*) and strip spaces inside
    formatted = formatted.replace(/\*\*+\s*([^\*]+?)\s*\*\*+/g, '*$1*');

    // 5. Clean up any single asterisks that have spaces inside like * bold * -> *bold*
    formatted = formatted.replace(/(?<!\*)\*\s*([^\*]+?)\s*\*(?!\*)/g, '*$1*');

    // 6. Convert markdown underline/italic (__italic__) to WhatsApp italic (_italic_)
    formatted = formatted.replace(/__([\s\S]*?)__/g, '_$1_');
    formatted = formatted.replace(/_\s*([^_]+?)\s*_/g, '_$1_');

    // 7. Remove syntax highlighting language from code blocks (e.g. ```javascript -> ```)
    formatted = formatted.replace(/```[a-zA-Z0-9-]+\n/g, '```\n');
    
    return formatted;
}

exports.sendCloudMessage = sendCloudMessage;

exports.setUserState = (userId, state) => {
    userStates.set(userId, state);
};

exports.getUserState = (userId) => {
    return userStates.get(userId);
};

exports.deleteUserState = (userId) => {
    userStates.delete(userId);
};
