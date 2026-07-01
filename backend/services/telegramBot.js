const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { askGemini, transcribeAudio } = require('./aiService');
const { normalizePhoneNumber, validatePassword, validateUsername, normalizeUsername } = require('./verificationService');
const bcrypt = require('bcrypt');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const { logAIUsage } = require('../utils/aiLogger');

let bot = null;
let botStatus = 'initializing';

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// States map: chatId -> { step, data }
// Steps: 'awaiting_password' | 'reg_name' | 'reg_username' | 'reg_password'
const telegramUserStates = new TimestampedMap();
const pendingPosts = new Map();
const groupLimits = new Map();
let botInfo = { username: '', id: null };

// Rate limiting map for Telegram
const telegramMsgTimestamps = new Map();
const groupWarningsSent = new Set();

// Periodically clean up memory leaks in in-memory state & rate limit maps
setInterval(() => {
    try {
        const now = Date.now();
        const thirtyMinutesAgo = now - 30 * 60000;

        // Clean telegramUserStates
        for (const [key, timestamp] of telegramUserStates.timestamps.entries()) {
            if (timestamp < thirtyMinutesAgo) {
                telegramUserStates.delete(key);
            }
        }

        // Clean telegramMsgTimestamps
        for (const [userId, times] of telegramMsgTimestamps.entries()) {
            const activeTimes = times.filter(t => t > now - 60000);
            if (activeTimes.length === 0) {
                telegramMsgTimestamps.delete(userId);
            } else {
                telegramMsgTimestamps.set(userId, activeTimes);
            }
        }

        // Clean groupLimits
        for (const [chatId, times] of groupLimits.entries()) {
            const activeTimes = times.filter(ts => now - ts < 60000);
            if (activeTimes.length === 0) {
                groupLimits.delete(chatId);
            } else {
                groupLimits.set(chatId, activeTimes);
            }
        }
    } catch (err) {
        console.error('[TELEGRAM BOT MEMORY CLEANUP ERROR]:', err.message);
    }
}, 5 * 60000).unref();

// Helper to check rate limit for Telegram (10 msgs in 1 min -> 10 min block)
async function checkTelegramRateLimit(userId, chatId) {
    try {
        const now = Date.now();
        if (!telegramMsgTimestamps.has(userId)) {
            telegramMsgTimestamps.set(userId, []);
        }
        const times = telegramMsgTimestamps.get(userId).filter(t => t > now - 60000);
        times.push(now);
        telegramMsgTimestamps.set(userId, times);

        if (times.length >= 10) {
            const blockedUntilDate = new Date(now + 10 * 60000);
            await db.execute(
                'UPDATE users SET rate_limit_blocked_until = ? WHERE id = ?',
                [blockedUntilDate, userId]
            );
            const unblockTime = blockedUntilDate.toLocaleTimeString('en-US', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu'
            });
            await bot.sendMessage(
                chatId,
                `⚠️ Waxaad ka gaadhay xad — Xeerka 1\-Daqiiqo \(10 farriimood\)\!\n\nNidaamku si otomaatig ah ayuu kuu xidhay muddo 10 daqiiqo ah\.\n⏰ Kusoo noqo marka ay tahay: *${unblockTime}*`,
                { parse_mode: 'Markdown' }
            );
            return true;
        }
    } catch (err) {
        console.error('[TELEGRAM RATE LIMIT ERROR]:', err.message);
    }
    return false;
}

// Helper to check manager request
function checkManagerRequest(text) {
    const clean = String(text || '').toLowerCase().trim();
    const isPaymentManager = clean.includes('managerka payments') ||
                             clean.includes('managerka payment') ||
                             clean.includes('payment manager') ||
                             clean.includes('payments manager') ||
                             clean.includes('managerka lacagta') ||
                             clean.includes('managerka lacagaha') ||
                             clean.includes('maamulaha lacagta') ||
                             clean.includes('maamulaha lacagaha') ||
                             clean.includes('maamulaha paymentska');
                             
    const isGeneralManager = clean.includes('manager') ||
                             clean.includes('managerka') ||
                             clean.includes('maamule') ||
                             clean.includes('maamulaha') ||
                             clean.includes('admin') ||
                             clean.includes('adminka') ||
                             clean.includes('owner') ||
                             clean.includes('ownerka');
                             
    if (isPaymentManager) return 'payment';
    if (isGeneralManager) return 'general';
    return null;
}

// Helper to check wrong answer feedback
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

exports.getBotStatus = () => botStatus;


// ─── Telegram raw API helper (for reactions & other new features) ─────────────
async function telegramRawAPI(method, body = {}) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    } catch (err) {
        // Silent - reactions are cosmetic only
    }
}

// ─── React with emoji to a message (👀 seen indicator) ───────────────────────
async function reactToMessage(chatId, messageId, emoji = '👀') {
    await telegramRawAPI('setMessageReaction', {
        chat_id: chatId,
        message_id: messageId,
        reaction: [{ type: 'emoji', emoji }],
        is_big: false
    });
}

// ─── Send animated loading message → returns {chatId, messageId} ─────────────
async function sendLoadingMessage(chatId, text = '⏳ Xaqiijinaya...') {
    try {
        const sent = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        return { chatId, messageId: sent.message_id };
    } catch (err) {
        return null;
    }
}

// ─── Update a loading message with new text ───────────────────────────────────
async function editLoadingMessage(handle, newText) {
    if (!handle) return;
    try {
        await bot.editMessageText(newText, {
            chat_id: handle.chatId,
            message_id: handle.messageId,
            parse_mode: 'Markdown'
        });
    } catch (err) { /* ignore */ }
}

// ─── Delete a message ─────────────────────────────────────────────────────────
async function deleteMsg(chatId, messageId) {
    try { await bot.deleteMessage(chatId, messageId); } catch (err) { /* ignore */ }
}

// ─── Initialize function ───────────────────────────────────────────────────────
exports.initialize = async () => {
    try {
        console.log('[TELEGRAM BOT] Initializing...');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS telegram_users (
                telegram_chat_id VARCHAR(50) PRIMARY KEY,
                user_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[TELEGRAM BOT] Table telegram_users checked/created.');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS telegram_cooldowns (
                user_id INT PRIMARY KEY,
                message_count INT DEFAULT 1,
                cooldown_until TIMESTAMP NULL,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                notified_expiry BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[TELEGRAM BOT] Table telegram_cooldowns checked/created.');

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            botStatus = 'disabled';
            console.log('[TELEGRAM BOT] TELEGRAM_BOT_TOKEN is missing. Telegram Bot disabled.');
            return;
        }

        const TelegramBot = require('node-telegram-bot-api');
        bot = new TelegramBot(token, { polling: true });
        botStatus = 'connected';
        console.log('[TELEGRAM BOT] Bot client connected and listening (Polling mode)!');

        // Fetch and cache Bot Details (username & ID)
        const bInfo = await bot.getMe();
        botInfo.username = bInfo.username;
        botInfo.id = bInfo.id;
        console.log(`[TELEGRAM BOT] Bot Details cached. Username: @${botInfo.username}, ID: ${botInfo.id}`);

        bot.on('message', async (msg) => {
            try {
                await handleIncomingMessage(msg);
            } catch (err) {
                console.error('[TELEGRAM BOT] Error handling message:', err);
            }
        });

        // Register callback_query event listener for owner's approve/reject buttons
        bot.on('callback_query', async (query) => {
            try {
                await handleCallbackQuery(query);
            } catch (err) {
                console.error('[TELEGRAM BOT] Callback query handling failed:', err);
            }
        });

        startProactiveChecker();
        // startSchedulerChecker(); // DISABLED: Auto post generation turned off to save API costs

    } catch (err) {
        botStatus = 'error';
        console.error('[TELEGRAM BOT] Initialization failed:', err);
    }
};

// ─── Proactive Cooldown Notifier ──────────────────────────────────────────────
function startProactiveChecker() {
    setInterval(async () => {
        try {
            if (!bot) return;
            const [expired] = await db.execute(
                `SELECT tc.user_id, tu.telegram_chat_id
                 FROM telegram_cooldowns tc
                 JOIN telegram_users tu ON tc.user_id = tu.user_id
                 WHERE tc.cooldown_until <= NOW() AND tc.notified_expiry = FALSE`
            );
            for (const row of expired) {
                try {
                    await bot.sendMessage(row.telegram_chat_id,
                        "✅ Saacadihii sugitaanka waa dhammaadeen\\! Hadda waad ila hadli kartaa\\. Maxaan kaa caawin karaa?");
                    await db.execute(
                        'UPDATE telegram_cooldowns SET notified_expiry = TRUE WHERE user_id = ?',
                        [row.user_id]
                    );
                } catch (e) {
                    console.error('[TELEGRAM BOT] Proactive send failed:', e.message);
                }
            }
        } catch (err) {
            console.error('[TELEGRAM BOT] Proactive checker error:', err.message);
        }
    }, 60000);
}

// ─── Main message handler ─────────────────────────────────────────────────────
async function handleIncomingMessage(msg) {
    if (!bot) return;
    const chatId = msg.chat.id;
    const msgId  = msg.message_id;
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const isOwner = chatId.toString() === (process.env.TELEGRAM_OWNER_CHAT_ID || '');

    // Ignore all group chats and channel comment groups to save API costs
    if (isGroup) {
        await handleGroupMessage(msg);
        return;
    }

    // Welcome message if bot is added to a group (disabled)
    if (msg.new_chat_members) {
        return;
    }

    // /start command
    if (msg.text && msg.text.startsWith('/start')) {
        await handleStartCommand(msg);
        return;
    }

    // ── 1. Check for pending registration state (unlinked user in reg flow) ──
    const pendingState = telegramUserStates.get(`unreg_${chatId}`);
    if (pendingState) {
        await handleRegistrationFlow(msg, pendingState);
        return;
    }

    // ── 2. Look up linked account ──────────────────────────────────────────────
    const [linked] = await db.execute(
        'SELECT user_id FROM telegram_users WHERE telegram_chat_id = ? LIMIT 1',
        [chatId.toString()]
    );

    if (linked.length === 0) {
        if (msg.contact) {
            await handleContactSharing(msg);
            return;
        }
        if (!isGroup) await sendContactPrompt(chatId);
        return;
    }

    const userId = linked[0].user_id;

    // ── 3. Retrieve user record ────────────────────────────────────────────────
    const [users] = await db.execute(
        'SELECT id, name, is_suspended, rate_limit_blocked_until FROM users WHERE id = ? LIMIT 1',
        [userId]
    );

    if (users.length === 0) {
        await db.execute('DELETE FROM telegram_users WHERE telegram_chat_id = ?', [chatId.toString()]);
        if (!isGroup) await sendContactPrompt(chatId);
        return;
    }

    const user = users[0];
    
    // Check rate limit block (persistent)
    if (user.rate_limit_blocked_until && new Date(user.rate_limit_blocked_until) > new Date()) {
        console.log(`[TELEGRAM BOT] User ${user.name} is rate limited until ${user.rate_limit_blocked_until}. Ignoring.`);
        return;
    }

    if (user.is_suspended) return;

    // If user shares contact again when already linked
    if (msg.contact) {
        await bot.sendMessage(chatId, `✅ Koontadaada mar hore ayaa la xaqiijiyay! (${user.name})`);
        return;
    }

    // ── 4. 👀 Seen reaction (cosmetic animation) ───────────────────────────────
    await reactToMessage(chatId, msgId, '👀');

    // ── 4b. Rate Limiting check (1-Minute rule) ──────────────────────────────
    if (await checkTelegramRateLimit(userId, chatId)) {
        return;
    }

    // Intercept Manager Routing
    const managerType = checkManagerRequest(msg.text);
    if (managerType) {
        if (managerType === 'payment') {
            await bot.sendMessage(chatId, "Halkan kala xidhiidh Manager-ka Payments-ka (Lacag-bixinta):");
            await bot.sendContact(chatId, '+252654810865', 'Manager Payments');
        } else {
            await bot.sendMessage(chatId, "Halkan kala xidhiidh Maamulaha (Manager-ka):");
            await bot.sendContact(chatId, '+252637930329', 'Manager General');
        }
        return;
    }

    // Intercept AI correction feedback
    if (isWrongAnswerFeedback(msg.text)) {
        await bot.sendMessage(
            chatId,
            "Waan ka xunnahay! Waxaan isku dayey 100% inaan saxo, laakiin hadda waxaan ku jiraa xaalad aan ku baranayo buugaagta manhajka dugsiyada.\n\n" +
            "Haddii aad aragtay wax weyn oo khaldan, fadlan la hadal maamulaha (manager-ka):"
        );
        await bot.sendContact(chatId, '+252637930329', 'Manager General');
        return;
    }

    // ── 5. Password Reset State ───────────────────────────────────────────────
    const pwState = telegramUserStates.get(`pw_${userId}`);
    if (pwState && pwState.step === 'awaiting_password') {
        const msgText = msg.text || '';
        const pwErr = validatePassword(msgText);
        if (pwErr) {
            await bot.sendMessage(chatId, '❌ Password-ku waa inuu ahaadaa *ugu yaraan 8 xaraf*\\. Mar kale isku day:', { parse_mode: 'Markdown' });
            return;
        }
        try {
            const hashed = await bcrypt.hash(msgText.trim(), 12);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
            telegramUserStates.delete(`pw_${userId}`);
            await bot.sendMessage(chatId,
                '✅ *Password-kaaga waa la bedelay si guul leh\\!*\n\nHadda waad u isticmaali kartaa app\\-ka password\\-kaaga cusub\\.',
                { parse_mode: 'Markdown' });
        } catch (err) {
            await bot.sendMessage(chatId, '❌ Cilad ayaa ku timid. Fadlan mar kale isku day.');
        }
        return;
    }

    // ── 6. Rate Limiting ──────────────────────────────────────────────────────
    const now = new Date();
    const [coolRow] = await db.execute(
        'SELECT message_count, cooldown_until, last_message_at FROM telegram_cooldowns WHERE user_id = ?',
        [userId]
    );

    if (coolRow.length > 0) {
        const { message_count, cooldown_until, last_message_at } = coolRow[0];
        if (cooldown_until && new Date(cooldown_until) > now) return;

        const diffMin = (now - new Date(last_message_at)) / 60000;
        if (diffMin > 3) {
            await db.execute('UPDATE telegram_cooldowns SET message_count=1, cooldown_until=NULL, notified_expiry=FALSE WHERE user_id=?', [userId]);
        } else {
            const newCount = message_count + 1;
            if (newCount > 20) {
                const coolUntil = new Date(now.getTime() + 30 * 60000);
                await db.execute('UPDATE telegram_cooldowns SET message_count=?, cooldown_until=?, notified_expiry=FALSE WHERE user_id=?', [newCount, coolUntil, userId]);
                const t = coolUntil.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Mogadishu' });
                await bot.sendMessage(chatId, `⏳ Fariimo badan ayaad soo dirtay\\. Fadlan sug ilaa *${t}*\\.`, { parse_mode: 'Markdown' });
                return;
            }
            await db.execute('UPDATE telegram_cooldowns SET message_count=?, notified_expiry=FALSE WHERE user_id=?', [newCount, userId]);
        }
    } else {
        await db.execute('INSERT INTO telegram_cooldowns (user_id, message_count, cooldown_until, notified_expiry) VALUES (?,1,NULL,FALSE)', [userId]);
    }

    // ── 7. Keyword Detection (password reset / report) ────────────────────────
    const msgText  = msg.text || msg.caption || '';
    const cleanBody = msgText.toLowerCase().trim();
    const normBody  = cleanBody
        .replace(/resset|ressett/g, 'reset')
        .replace(/passward|pasword|passwrod|pssword|paswword/g, 'password')
        .replace(/ilaawey|ilaawaye|illaaway/g, 'ilaaway')
        .replace(/baddal|badaal/g, 'badal');

    // Password reset request
    if (_checkPwReset(cleanBody) || _checkPwReset(normBody)) {
        const [uRows] = await db.execute('SELECT whatsapp_number FROM users WHERE id=? LIMIT 1', [userId]);
        const registered = uRows.length > 0 ? uRows[0].whatsapp_number : '';
        const phoneRegex = /\+?\d{7,15}/g;
        let hasMismatch = false;
        let m;
        while ((m = phoneRegex.exec(msgText)) !== null) {
            const n = normalizePhoneNumber(m[0]);
            if (n && n !== registered) { hasMismatch = true; break; }
        }
        if (hasMismatch) {
            await bot.sendMessage(chatId, '❌ Numberka aad qortay iyo kan akoonkaaga ku jira isku mid maaha\\.');
            return;
        }
        telegramUserStates.set(`pw_${userId}`, { step: 'awaiting_password' });
        await bot.sendMessage(chatId,
            '🔐 *Password Beddelid*\n\nFadlan qor password\\-ka cusub ee aad rabto \\(*ugu yaraan 8 xaraf*\\):',
            { parse_mode: 'Markdown' });
        return;
    }

    // Report request
    const isReport = cleanBody === 'report' ||
        cleanBody.includes('xogteyda') || cleanBody.includes('xogtayda') ||
        cleanBody.includes('my report') || cleanBody.includes('my info') ||
        cleanBody.includes('warbixinteyda') || cleanBody.includes('warbixintayda');

    if (isReport) {
        await sendUserReport(chatId, userId);
        return;
    }

    // ── 8. Media (Voice / Photo) ──────────────────────────────────────────────
    const isVoice = !!(msg.voice || msg.audio);
    const isPhoto  = !!(msg.photo && msg.photo.length > 0);

    let processedText = msgText;
    let voiceCostApplied = false;
    let attachmentData  = null;

    if (isVoice) {
        if (isGroup) return;
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id=?', [userId]);
        if (!wallet.length || wallet[0].balance < 20) {
            await bot.sendMessage(chatId, '❌ Dhibcahaagu kuma filna dhegeysiga codka *(20 Credits)*\\.', { parse_mode: 'Markdown' });
            return;
        }
        const fileId = msg.voice ? msg.voice.file_id : msg.audio.file_id;
        const loadHandle = await sendLoadingMessage(chatId, '🎙️ _Dhegeysanaya codka\\.\\.\\._');
        try {
            const localPath = await bot.downloadFile(fileId, uploadsDir);
            processedText = await transcribeAudio(localPath, 'audio/ogg');
            voiceCostApplied = true;
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
            await deleteMsg(chatId, loadHandle?.messageId);
        } catch (e) {
            await editLoadingMessage(loadHandle, '❌ Waan ka xunnahay\\, codka lama fahmin\\.');
            return;
        }
    }

    if (isPhoto) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        try {
            const localPath = await bot.downloadFile(fileId, uploadsDir);
            const buf = fs.readFileSync(localPath);
            attachmentData = { base64: buf.toString('base64'), mimeType: 'image/jpeg' };
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        } catch (e) {
            await bot.sendMessage(chatId, '❌ Sawirka laguma guulaysan in la soo dejiyo\\.');
            return;
        }
    }

    // ── 9. Credit Check ───────────────────────────────────────────────────────
    let cost = voiceCostApplied ? 20 : isPhoto ? 10 :
        (processedText.length < 150 ? 1 : processedText.length < 500 ? 3 :
         processedText.length < 1500 ? 7 : 12);

    const [sub] = await db.execute(
        'SELECT * FROM user_subscriptions WHERE user_id=? AND expiry_date>NOW()',
        [userId]
    );
    const hasActiveSub = sub.length > 0;

    let usedFreeAI = false;
    if (!hasActiveSub && !voiceCostApplied) {
        usedFreeAI = await tryUseFreeAI(userId, isPhoto ? 'image' : 'text');
    }

    if (!hasActiveSub && !usedFreeAI) {
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id=?', [userId]);
        const balance = wallet.length ? wallet[0].balance : 0;
        if (balance < cost) {
            await bot.sendMessage(chatId, '💳 *Credit-kaagu kuma filna\\!*\n\nKu shubo credit si aad u sii wadato isticmaalka\\.', { parse_mode: 'Markdown' });
            return;
        }
        await db.execute('UPDATE user_wallet SET balance=GREATEST(0,balance-?) WHERE user_id=?', [cost, userId]);
    }

    // ── 10. Chat history ──────────────────────────────────────────────────────
    const [histRows] = await db.execute(
        'SELECT sender, message FROM messages_private WHERE user_id=? AND session_id="telegram" ORDER BY id DESC LIMIT 5',
        [userId]
    );
    const history = histRows.reverse().map(r => ({
        role: r.sender === 'user' ? 'user' : 'model',
        parts: [{ text: r.message }]
    }));

    // ── 11. Typing indicator + AI call ───────────────────────────────────────
    await bot.sendChatAction(chatId, 'typing');
    await new Promise(r => setTimeout(r, 100));
    const hasCaption = processedText && processedText.trim().length > 0;
    let finalPrompt = attachmentData && !hasCaption
        ? 'Fiiri sawirkan. Haddii sawirku ka kooban yahay suaalo MCQ/saxan/qaldaan: KALIYA soo qor jawaabaha kooban. Haddii ay yihiin suaalo furan ama xisaab: si kooban u xali.'
        : (processedText || 'Hello');

    const systemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).
Rules:
1. IDENTITY: NEVER prepend any self-introduction banner. Only mention your name or creator if the user explicitly asks "Who are you?", "Who made you?", "Cidaa ku samaysay?".
2. LANGUAGE: Respond in the EXACT same language the user used (Somali → Somali, English → English).
3. EXAMS: MCQ/True-False images → only output question numbers and correct options. No explanation unless asked.
4. Keep responses concise, direct, and helpful.
5. Bold key terms using *Keyword*.
6. Tables: use <table_data>Header1|Header2\\nVal1|Val2</table_data> format.
7. Pricing: Pay as you go $0.5 (100 credits), Basic $3/month, Premium $11/month. EVC Plus: *771*637930329*amount# | ZAAD: *220*637930329*amount# | eDahab: *700*659119779*amount#. After sending, user types sender number. Contact: WhatsApp +252637930329.
8. Be helpful, warm, accommodating. Never redirect the user away frustratingly.`;

    try {
        const aiResp = await askGemini(finalPrompt, 'gemini-3.1-flash-lite', attachmentData, history, systemInstruction);
        const formatted = formatResponseForTelegram(aiResp);
        await sendMessageWithFallback(chatId, formatted);

        // Replace 👀 with ❤️ after responding
        await reactToMessage(chatId, msgId, '❤️');

        // Sequential DB saves to prevent out-of-order IDs and identical timestamps
        try {
            await db.execute('INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, "telegram", "user", ?)', [userId, finalPrompt]);
            await db.execute('INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, "telegram", "ai", ?)', [userId, aiResp]);
        } catch (dbErr) {
            console.error('[TELEGRAM BOT] DB save messages error:', dbErr.message);
        }
        logAIUsage(userId, 'gemini-1.5-flash', finalPrompt, aiResp,
            voiceCostApplied ? 'voice' : isPhoto ? 'image' : 'education', 'telegram')
            .catch(e => console.error('[TELEGRAM BOT] Logging:', e.message));

    } catch (err) {
        console.error('[TELEGRAM BOT] Gemini error:', err);
        await bot.sendMessage(chatId, '⚠️ Waan ka xunnahay\\, Darkpen waxaa ku yimid cilad farsamo oo ku meel gaadh ah\\. Si aan hawshaadu u xanibmin\\, fadlan la xidhiidh Maamulaha: +252637930329\\.', { parse_mode: 'Markdown' });
    }
}

// ─── /start command ───────────────────────────────────────────────────────────
async function handleStartCommand(msg) {
    const chatId = msg.chat.id;
    const [linked] = await db.execute(
        'SELECT user_id FROM telegram_users WHERE telegram_chat_id=? LIMIT 1',
        [chatId.toString()]
    );

    if (linked.length > 0) {
        const [usr] = await db.execute('SELECT name FROM users WHERE id=? LIMIT 1', [linked[0].user_id]);
        const name = usr.length ? usr[0].name : 'Adeer';
        await bot.sendMessage(chatId,
            `🤖 *Ku soo dhawaada Darkpen Bot\\!*\n\n` +
            `Haye *${escapeMd(name)}*\\, koontadaada waa xaqiijisantahay ✅\n\n` +
            `Maxaan kuu qabtaa maanta?`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await sendContactPrompt(chatId);
    }
}

// ─── Beautiful contact prompt with styled button ───────────────────────────────
async function sendContactPrompt(chatId) {
    await bot.sendMessage(chatId,
        `👋 *Ku soo dhawaada Darkpen Bot\\!* 🤖📚\n\n` +
        `Darkpen waa AI assistant\\.ka ugu fiican Soomaalida\\!\n\n` +
        `🔐 *Si aad u bilowdo*, fadlan xaqiiji koontadaada Darkpen\n` +
        `adoo gujinaya badhanka hoose\\:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [[{
                    text: '📱 Xaqiiji Koontadaada  ✨',
                    request_contact: true
                }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        }
    );
}

// ─── Handle shared contact ─────────────────────────────────────────────────────
async function handleContactSharing(msg) {
    const chatId  = msg.chat.id;
    const contact = msg.contact;

    if (!contact || contact.user_id !== msg.from.id) {
        await bot.sendMessage(chatId, '❌ Fadlan la wadaag *lambarkaaga saxda ah* adigoo gujinaaya badhanka\.', { parse_mode: 'Markdown' });
        return;
    }

    // Show loading animation
    const loader = await sendLoadingMessage(chatId,
        '🔍 _Xaqiijinaya koontadaada\.\.\._'
    );

    const rawPhone    = contact.phone_number;
    const normalized  = normalizePhoneNumber(rawPhone);

    if (!normalized) {
        await editLoadingMessage(loader, '❌ Lambarkaagu ma saxna\. Fadlan isku day mar kale\.');
        return;
    }

    try {
        // Query DB directly first to check if already registered
        const [users] = await db.execute(
            'SELECT id, name, is_suspended FROM users WHERE whatsapp_number=? LIMIT 1',
            [normalized]
        );

        if (users.length > 0) {
            const user = users[0];
            if (user.is_suspended) {
                await deleteMsg(chatId, loader?.messageId);
                await bot.sendMessage(chatId,
                    '🚫 *Koontadaada waa la xanibay\.* Fadlan la xidhiidh taageerada\.',
                    { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } }
                );
                return;
            }

            // Link to telegram
            await db.execute(
                'INSERT INTO telegram_users (telegram_chat_id, user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',
                [chatId.toString(), user.id]
            );

            // Fast animation
            await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\.\.\._\n`[██████████] 100%`');
            await new Promise(r => setTimeout(r, 200));
            await deleteMsg(chatId, loader?.messageId);

            await bot.sendMessage(chatId,
                `✅ *Xaqiijin guul leh!* 🎉\n\n` +
                `Ku soo dhawaada *\${user.name}*!\n\n` +
                `🤖 Darkpen Bot waa diyaar. Su'aashaada iigu soo dir!`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                }
            );
            return;
        }

        // If not registered, run a fast registration flow start animation
        await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\.\.\._\n`[████░░░░░░] 40%`');
        await new Promise(r => setTimeout(r, 200));
        await editLoadingMessage(loader, '📋 _Diyaarinaya diiwaan-gelinta\.\.\._\n`[████████░░] 80%`');
        await new Promise(r => setTimeout(r, 200));
        await deleteMsg(chatId, loader?.messageId);

        // Store phone + start registration flow
        telegramUserStates.set(`unreg_${chatId}`, {
            step: 'reg_name',
            phone: normalized
        });

        await bot.sendMessage(chatId,
            `👋 *Soo dhowow Darkpen!* 🤖📚\n\n` +
            `Lambarkan *\${escapeMd(normalized)}* lama helin diiwaanka.\n\n` +
            `📝 *Waxaan kaa caawinayaa inaad diwaangasho hadda!*\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 1 / 3*\n` +
            `👤 *Magacaaga full-name-kaaga* maxaa?\n` +
            `_\\(Tusaale: Axmed Cali\\)_`,
            {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            }
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Link/Registration initiation error:', err);
        await editLoadingMessage(loader, '❌ Cilad ayaa ku timid xaqiijinta koontadaada.');
    }
}

// ─── Registration Agent Flow ───────────────────────────────────────────────────
async function handleRegistrationFlow(msg, state) {
    const chatId = msg.chat.id;
    const input  = (msg.text || '').trim();

    if (!input) return;

    if (state.step === 'reg_name') {
        if (input.length < 2 || input.length > 60) {
            await bot.sendMessage(chatId,
                '❌ Fadlan magac sax ah geli \\(*2\\-60 xaraf*\\):',
                { parse_mode: 'Markdown' }
            );
            return;
        }
        state.step = 'reg_username';
        state.name = input;
        telegramUserStates.set(`unreg_${chatId}`, state);

        await bot.sendMessage(chatId,
            `✅ *${escapeMd(input)}* — waa qurux badnaan\\!\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 2 / 3*\n` +
            `🆔 *Username* dooro:\n` +
            `_\\(3\\-30 xaraf: a\\-z, 0\\-9, \\_\\)_\n` +
            `_Tusaale: axmed\\_cali_`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (state.step === 'reg_username') {
        const username = normalizeUsername(input);
        const usernameErr = validateUsername(username);
        if (usernameErr) {
            await bot.sendMessage(chatId,
                `❌ *${escapeMd(usernameErr)}*\n\nMar kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Check if username already taken
        const [existing] = await db.execute('SELECT id FROM users WHERE username=? LIMIT 1', [username]);
        if (existing.length > 0) {
            await bot.sendMessage(chatId,
                `❌ Username *${escapeMd(username)}* hore ayaa loo qaatay\\. Username kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        state.step     = 'reg_password';
        state.username = username;
        telegramUserStates.set(`unreg_${chatId}`, state);

        await bot.sendMessage(chatId,
            `✅ *@${escapeMd(username)}* — waa xor\\!\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*Tallaabada 3 / 3*\n` +
            `🔐 *Password* dooro:\n` +
            `_\\(ugu yaraan 8 xaraf — lama muuqdo diiwaangelinta ka dib\\)_`,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (state.step === 'reg_password') {
        const pwErr = validatePassword(input);
        if (pwErr) {
            await bot.sendMessage(chatId,
                `❌ *${escapeMd(pwErr)}*\n\nMar kale isku day:`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        // Show loading animation for registration
        const loader = await sendLoadingMessage(chatId, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[██░░░░░░░░] 20%`');
        await new Promise(r => setTimeout(r, 150));
        await editLoadingMessage(loader, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[█████░░░░░] 50%`');

        try {
            const hashedPw = await bcrypt.hash(input, 12);

            // Insert user
            const [result] = await db.execute(
                `INSERT INTO users (name, username, password, whatsapp_number, role, is_verified, is_suspended)
                 VALUES (?, ?, ?, ?, 'user', 1, 0)`,
                [state.name, state.username, hashedPw, state.phone]
            );
            const newUserId = result.insertId;

            await editLoadingMessage(loader, '⚙️ _Koontada la sameynayaa\\.\\.\\._\n`[████████░░] 80%`');
            await new Promise(r => setTimeout(r, 150));

            // Create wallet
            await db.execute(
                'INSERT INTO user_wallet (user_id, balance) VALUES (?, 0) ON DUPLICATE KEY UPDATE balance=balance',
                [newUserId]
            ).catch(() => {});

            // Create free AI usage record
            await db.execute(
                'INSERT INTO user_free_ai_usage (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id=user_id',
                [newUserId]
            ).catch(() => {});

            // Link to telegram
            await db.execute(
                'INSERT INTO telegram_users (telegram_chat_id, user_id) VALUES (?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id)',
                [chatId.toString(), newUserId]
            );

            await editLoadingMessage(loader, '✅ _La diyaariyay\\!_\n`[██████████] 100%`');
            await new Promise(r => setTimeout(r, 400));
            await deleteMsg(chatId, loader?.messageId);

            // Clear state
            telegramUserStates.delete(`unreg_${chatId}`);

            await bot.sendMessage(chatId,
                `🎉 *Diwaangelintaada waa guul!* 🎉\n\n` +
                `👤 *Magaca:* ${escapeMd(state.name)}\n` +
                `🆔 *Username:* @${escapeMd(state.username)}\n` +
                `📱 *Lambarka:* ${escapeMd(state.phone)}\n\n` +
                `🎁 Waxaad hadiyad ahaan u heysataa *40 Credits oo Free ah* oo aad hadda ku bilaabi karto!\n` +
                `• *10 Credits* oo fariimaha qoraalka ah (10 Free Text Messages)\n` +
                `• *30 Credits* oo sawirada ah (3 Free Images)\n\n` +
                `━━━━━━━━━━━━━━━\n` +
                `⚠️ *Ogeysiis iyo Shuruudo (Terms & Conditions):*\n` +
                `• Haddii aad isticmaasho Telegram-kan, waxay ka dhigan tahay inaad ogolaatay shuruudaha iyo xeerarka (terms and conditions) ee app-ka Darkpen AI.\n` +
                `• Fadlan ogoow in bot-kan aan loogu talagalin waxyaabaha sharciga ka hor imanaya ee qishka imtixaannada iyo wixii la mid ah. Isticmaalaha (user-ka) ayaa si buuxda mas'uul uga ah wixii uu u isticmaalo.\n` +
                `• Haddii jawaabta bot-ku dib u dhacdo ama uu soo jawaabi waayo, taasi micnaheedu maaha inuu khaldan yahay, balse waa mashquul aad u badan (jam) oo ka jira qaybta Bilaashka ah (Free tier).\n` +
                `• Fadlan save gareyso nambarkayaga oo ah *+252637930329* si aad u aragto wararkii ugu dambeeyay iyo warbixinaha status-keena.\n` +
                `━━━━━━━━━━━━━━━\n\n` +
                `📚 *Darkpen AI wuxuu kaa caawinayaa waxbarashada, sawirada, xallinta su'aalaha, iyo wax kasta oo aad u baahan tahay!*\n` +
                `💳 Marka ay kaa dhamaadaan free-gu, waxaad ku shuban kartaa *$0.50* (100 credits):\n` +
                `EVC Plus: *\\*771\\*637930329\\*lacagta\\#*\n` +
                `ZAAD: *\\*220\\*637930329\\*lacagta\\#*\n` +
                `eDahab: *\\*700\\*659119779\\*lacagta\\#*\n` +
                `Ka dib screenshot WhatsApp-ka u dir: *\\+252637930329*\n\n` +
                `🤖 Su'aashaada iigu soo dir qoraal, sawir ama cod!`,
                { parse_mode: 'Markdown' }
            );
        } catch (err) {
            console.error('[TELEGRAM BOT] Registration error:', err);
            await editLoadingMessage(loader, '❌ Cilad farsamo ayaa ku timid\\. Mar kale /start isku day\\.');
            telegramUserStates.delete(`unreg_${chatId}`);
        }
    }
}

// ─── User Report ──────────────────────────────────────────────────────────────
async function sendUserReport(chatId, userId) {
    try {
        const [rows] = await db.execute(`
            SELECT u.*,
                   (SELECT COUNT(*) FROM messages_private WHERE user_id=u.id AND session_id IS NOT NULL AND session_id!='telegram') AS app_count,
                   (SELECT COUNT(*) FROM messages_private WHERE user_id=u.id AND session_id='telegram') AS tg_count,
                   (SELECT balance FROM user_wallet WHERE user_id=u.id) AS credits,
                   (SELECT type FROM user_subscriptions WHERE user_id=u.id AND expiry_date>NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_type,
                   (SELECT expiry_date FROM user_subscriptions WHERE user_id=u.id AND expiry_date>NOW() ORDER BY expiry_date DESC LIMIT 1) AS sub_expiry
            FROM users u WHERE u.id=?`, [userId]);

        if (!rows.length) {
            await bot.sendMessage(chatId, '❌ Xogtaada lama heli karo\\.', { parse_mode: 'Markdown' });
            return;
        }
        const d = rows[0];
        let plan = 'Bilaash \\(Free\\)';
        if (d.sub_type) {
            const name = d.sub_type === 'monthly_11' ? 'Premium' : 'Basic';
            const days = Math.ceil((new Date(d.sub_expiry) - new Date()) / 86400000);
            plan = `${name} \\(${days} casho\\)`;
        }
        const status = d.is_suspended ? '🚫 Xaniban' : '✅ Firfircoon';

        await sendMessageWithFallback(chatId,
            `📊 *DARKPEN REPORT*\n` +
            `━━━━━━━━━━━━━━━\n` +
            `👤 *Magaca:* ${escapeMd(d.name)}\n` +
            `🆔 *Username:* @${escapeMd(d.username || 'ma jiro')}\n` +
            `📅 *Ku biiray:* ${new Date(d.created_at).toLocaleDateString('so-SO')}\n` +
            `💎 *Credits:* ${d.credits || 0}\n` +
            `💬 *App chats:* ${d.app_count || 0}\n` +
            `📱 *Telegram chats:* ${d.tg_count || 0}\n` +
            `🏆 *XP:* ${d.xp || 0}\n` +
            `💳 *Plan:* ${plan}\n` +
            `🔒 *Status:* ${status}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `Mahadsanid, sii wad isticmaalka Darkpen\\! 🚀`
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Report error:', err.message);
        await bot.sendMessage(chatId, '❌ Cilad ayaa ku timid helida xogtaada\\.', { parse_mode: 'Markdown' });
    }
}

// ─── sendMessageWithFallback ──────────────────────────────────────────────────
async function sendMessageWithFallback(chatId, text, opts = {}) {
    try {
        return await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
    } catch (err) {
        console.warn('[TELEGRAM BOT] Markdown failed, falling back to plain text.');
        const clean = text
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/_([^_]+)_/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\\/g, '');
        return await bot.sendMessage(chatId, clean, { ...opts, parse_mode: undefined });
    }
}

// ─── Format AI response for Telegram Markdown ─────────────────────────────────
function formatResponseForTelegram(text) {
    if (!text) return '';
    let f = text;
    f = f.replace(/<green>([\s\S]*?)<\/green>/gi, '*$1*');
    f = f.replace(/<red>([\s\S]*?)<\/red>/gi, '*$1*');
    f = f.replace(/<callout>([\s\S]*?)<\/callout>/gi, '*$1*');
    f = f.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (_, content) => {
        const lines = content.trim().split('\n');
        if (!lines.length) return '';
        const headers = lines[0].split('|').map(h => h.trim());
        const rows    = lines.slice(1).map(l => l.split('|').map(c => c.trim()));
        let out = '\n*Xogta Shaxda:*\n';
        rows.forEach(row => {
            out += '------------------\n';
            row.forEach((col, i) => { out += `• *${headers[i] || ''}:* ${col}\n`; });
        });
        out += '------------------\n';
        return out;
    });
    f = f.replace(/^(#{1,6})\s+(.+)$/gm, '*$2*');
    f = f.replace(/\*\*([\s\S]*?)\*\*/g, '*$1*');
    f = f.replace(/__([\s\S]*?)__/g, '_$1_');
    f = f.replace(/^\s*[*\-]\s+/gm, '• ');
    f = f.replace(/```[a-zA-Z0-9-]+\n/g, '```\n');
    return f;
}

// ─── Escape Markdown V2 special chars ─────────────────────────────────────────
function escapeMd(text = '') {
    return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ─── Password Reset Keyword Checker ───────────────────────────────────────────
function _checkPwReset(body) {
    return body.includes('password reset') || body.includes('reset password') ||
        body.includes('forgot password') || body.includes('forget password') ||
        body.includes('change password') || body.includes('lost password') ||
        body.includes("can't login") || body.includes("can't log in") ||
        body.includes('reset my password') || body.includes('update password') ||
        (body.includes('password') && (body.includes('badal') || body.includes('ilaaway') ||
            body.includes('ma galin') || body.includes('ma geli') || body.includes('cusub'))) ||
        (body.includes('furaha') && (body.includes('badal') || body.includes('ilaaway') ||
            body.includes('ma galin') || body.includes('cusub'))) ||
        body.includes('password waan ilaaway') || body.includes('furaha waan ilaaway') ||
        body.includes('passwordka iga badal') || body.includes('furaha iga badal') ||
        body.includes('bedel password') || body.includes('bedel furaha') ||
        body.includes('password ilaaway') || body.includes('furaheygii ilaaway');
}

// ─── Group Message Handler ───────────────────────────────────────────────────
async function handleGroupMessage(msg) {
    const chatId = msg.chat.id;
    const msgId = msg.message_id;
    const text = msg.text || msg.caption || '';
    
    if (!text) return;

    // Check if the sender has an active private flow state
    const fromId = msg.from && msg.from.id;
    if (fromId) {
        let hasActivePrivateState = false;
        let warningKey = '';

        if (telegramUserStates.has(`unreg_${fromId}`)) {
            hasActivePrivateState = true;
            warningKey = `unreg_${fromId}`;
        } else {
            // Check if linked
            const [linked] = await db.execute(
                'SELECT user_id FROM telegram_users WHERE telegram_chat_id = ? LIMIT 1',
                [fromId.toString()]
            );
            if (linked.length > 0) {
                const userId = linked[0].user_id;
                if (telegramUserStates.has(`pw_${userId}`)) {
                    hasActivePrivateState = true;
                    warningKey = `pw_${userId}`;
                }
            }
        }

        if (hasActivePrivateState) {
            const warnedKey = `${warningKey}_group_warned`;
            if (!groupWarningsSent.has(warnedKey)) {
                groupWarningsSent.add(warnedKey);
                setTimeout(() => groupWarningsSent.delete(warnedKey), 5 * 60000);
                await bot.sendMessage(chatId, "Fadlan ku noqo Telegram-ka Darkpen (luuqa/DM-ka) si aad u sii waddo shaqadii noo socotey.", { reply_to_message_id: msgId });
            } else {
                await reactToMessage(chatId, msgId, '🚫');
            }
            return; // Intercept and ignore group message processing
        }
    }
    
    // Check if bot was mentioned OR if it is a reply to the bot's message
    const botMention = `@${botInfo.username}`;
    const isMentioned = text.includes(botMention);
    const isReplyToBot = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id === botInfo.id;
    
    if (!isMentioned && !isReplyToBot) {
        // 3% chance of commenting randomly on any text that talks about AI/technology/Darkpen to make it interactive!
        const words = text.toLowerCase();
        const keywords = ['darkpen', 'ai', 'gemini', 'chatgpt', 'bot', 'fariin', 'credits', 'waxbarasho', 'baro', 'programming'];
        const hasKeyword = keywords.some(k => words.includes(k));
        
        if (hasKeyword && Math.random() < 0.03) {
            // Proceed to reply
        } else {
            return;
        }
    }
    
    // Enforce Group Rate Limiting
    const now = Date.now();
    if (!groupLimits.has(chatId)) {
        groupLimits.set(chatId, []);
    }
    const timestamps = groupLimits.get(chatId);
    // filter timestamps in last 2 minutes (120,000 ms)
    const validTimestamps = timestamps.filter(t => now - t < 120000);
    if (validTimestamps.length >= 5) {
        return; // Exceeded rate limit for group
    }
    validTimestamps.push(now);
    groupLimits.set(chatId, validTimestamps);
    
    // Send seen reaction 👀
    await reactToMessage(chatId, msgId, '👀');
    await bot.sendChatAction(chatId, 'typing');
    
    // System Instruction for Group
    const groupInstruction = `You are Darkpen, a witty, humorous, and tech-savvy AI assistant and active team member of the Darkpen app, developed by ZinsonAI.
Rules:
1. TALK ONLY about the Darkpen app, AI models (like Gemini, ChatGPT, Claude), technology, learning, or productivity. If someone asks something completely unrelated, playfully redirect them back to technology or Darkpen.
2. TONE: Be highly humorous, entertaining, and witty. Use natural Somali slang (e.g. "sxb", "bahalka", "xaaladu waa kacsantahay", "asaageena", "heer sare") or English depending on the user's language.
3. Keep replies very short and punchy (1-3 sentences maximum).
4. Act as a proud team member of Darkpen. If someone mentions a competitor (like ChatGPT), playfully claim Darkpen is better or faster for Somalis.
5. Do NOT use markdown headers or heavy formatting. Keep it clean.`;

    let finalPrompt = text.replace(botMention, '').trim();
    if (msg.reply_to_message && msg.reply_to_message.text) {
        finalPrompt = `[User replied to: "${msg.reply_to_message.text}"]\nReply comment: ${finalPrompt}`;
    }
    
    try {
        const aiResp = await askGemini(finalPrompt, 'gemini-3.1-flash-lite', null, [], groupInstruction);
        const formatted = formatResponseForTelegram(aiResp);
        
        await bot.sendMessage(chatId, formatted, {
            reply_to_message_id: msgId,
            parse_mode: 'Markdown'
        });
        
        // React with ❤️
        await reactToMessage(chatId, msgId, '❤️');
    } catch (err) {
        console.error('[TELEGRAM BOT] Group reply error:', err);
    }
}

// ─── Trigger Daily Tip Generation ────────────────────────────────────────────

// ─── Handle Callback Query (Moderation Buttons) ──────────────────────────────
async function handleCallbackQuery(callbackQuery) {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    const ownerChatId = message.chat.id.toString();
    const ownerConfigId = (process.env.TELEGRAM_OWNER_CHAT_ID || '').trim();
    
    if (ownerChatId !== ownerConfigId) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Adigu awood uma lihid!', show_alert: true });
        return;
    }

    if (!data.startsWith('approve_') && !data.startsWith('reject_')) return;
    
    // Always answer the callback immediately to stop the loading spinner
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const action = data.split('_')[0];
    const postId = data.substring(action.length + 1);
    const post = pendingPosts.get(postId);

    if (!post) {
        await bot.sendMessage(ownerChatId, '⚠️ Fariintan lama helin ama mar hore ayaa la goostay.');
        // Remove the inline keyboard from old message
        try {
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                chat_id: ownerChatId,
                message_id: message.message_id
            });
        } catch(e) {}
        return;
    }

    pendingPosts.delete(postId);
    
    // Remove the inline keyboard buttons immediately
    try {
        await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: ownerChatId,
            message_id: message.message_id
        });
    } catch(e) {}

    if (action === 'approve') {
        let postedTo = [];
        let errors = [];
        
        if (post.type === 'tip') {
            if (process.env.TELEGRAM_CHANNEL_ID) {
                try {
                    await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, post.content, { parse_mode: 'Markdown' });
                    postedTo.push('Channel (@darkpenapp)');
                } catch(e) {
                    // Try without markdown if formatting fails
                    try {
                        const plain = post.content.replace(/[*_`]/g, '').replace(/\\/g, '');
                        await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, plain);
                        postedTo.push('Channel (plain text)');
                    } catch(e2) {
                        errors.push('Channel: ' + e2.message);
                    }
                }
            } else {
                errors.push('TELEGRAM_CHANNEL_ID lama helin .env-ga');
            }
        } else if (post.type === 'poll') {
            if (process.env.TELEGRAM_GROUP_ID) {
                try {
                    await bot.sendPoll(process.env.TELEGRAM_GROUP_ID, post.question, post.options, { is_anonymous: false });
                    postedTo.push('Group');
                } catch(e) { errors.push('Group: ' + e.message); }
            }
            if (process.env.TELEGRAM_CHANNEL_ID) {
                try {
                    await bot.sendPoll(process.env.TELEGRAM_CHANNEL_ID, post.question, post.options, { is_anonymous: false });
                    postedTo.push('Channel');
                } catch(e) { errors.push('Channel: ' + e.message); }
            }
        }
        
        if (postedTo.length > 0) {
            await bot.sendMessage(ownerChatId, `✅ Waa la daabacay!\n\n📍 Halka loo dhigay: ${postedTo.join(', ')}`);
        }
        if (errors.length > 0) {
            await bot.sendMessage(ownerChatId, `⚠️ Qaarkood way fashilantay:\n${errors.join('\n')}`);
        }
    } else {
        await bot.sendMessage(ownerChatId, '❌ Waa la diiday. Fariintu lama daabacin.');
    }
}

// ─── Daily & Saturday Scheduler Checker ──────────────────────────────────────
function startSchedulerChecker() {
    const schedulerFile = path.join(__dirname, '../uploads/telegram_scheduler.json');
    
    if (!fs.existsSync(schedulerFile)) {
        fs.writeFileSync(schedulerFile, JSON.stringify({ lastDailyTipDate: '', lastSaturdayPollDate: '' }));
    }
    
    setInterval(async () => {
        try {
            const ownerId = process.env.TELEGRAM_OWNER_CHAT_ID;
            if (!ownerId || !bot) return;
            
            const state = JSON.parse(fs.readFileSync(schedulerFile, 'utf8'));
            const now = new Date();
            
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Africa/Mogadishu',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false
            });
            const parts = formatter.formatToParts(now);
            const dateParts = {};
            parts.forEach(p => { dateParts[p.type] = p.value; });
            
            const todayStr = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
            const currentHour = parseInt(dateParts.hour, 10);
            
            // 1. Daily Tip at 9:00 AM or later
            if (todayStr !== state.lastDailyTipDate && currentHour >= 9) {
                console.log(`[TELEGRAM SCHEDULER] Triggering daily tip for date: ${todayStr}`);
                state.lastDailyTipDate = todayStr;
                fs.writeFileSync(schedulerFile, JSON.stringify(state));
                await triggerDailyTipGeneration(ownerId);
            }
            
            // 2. Saturday Poll at 10:00 AM or later
            const dayOfWeek = now.getDay(); 
            if (dayOfWeek === 6 && todayStr !== state.lastSaturdayPollDate && currentHour >= 10) {
                console.log(`[TELEGRAM SCHEDULER] Triggering Saturday poll for date: ${todayStr}`);
                state.lastSaturdayPollDate = todayStr;
                fs.writeFileSync(schedulerFile, JSON.stringify(state));
                await triggerSaturdayPollGeneration(ownerId);
            }
        } catch (err) {
            console.error('[TELEGRAM SCHEDULER] Error:', err.message);
        }
    }, 300000); // Check every 5 minutes
}

