const db = require('../config/db');
const aiService = require('../services/aiService');
const { saveBase64Image } = require('../utils/fileHelper');
const { checkAndExpireWallet } = require('../utils/walletHelper');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const path = require('path');

// Ensure database is updated with image_url column on startup
(async () => {
    try {
        await db.query('ALTER TABLE messages_private ADD COLUMN image_url VARCHAR(255) DEFAULT NULL');
        console.log('[DB] Added column image_url to messages_private successfully or already exists.');
    } catch (err) {
        if (err.errno !== 1060 && !err.message.includes('Multiple columns') && !err.message.includes('duplicate column')) {
            console.error('[DB] Error adding image_url to messages_private:', err.message);
        }
    }
})();

// 1. Create a new chat session
exports.createSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title } = req.body;
        const [result] = await db.execute(
            'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
            [userId, title || 'New Chat']
        );
        res.json({ id: result.insertId, title: title || 'New Chat' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday abuurista session-ka' });
    }
};

// 2. Get all chat sessions for a user
exports.getSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const [sessions] = await db.execute(
            'SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
            [userId]
        );
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta sessions-ka' });
    }
};

// 3. Update session (Rename or Toggle Training)
exports.updateSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { title, is_training_enabled } = req.body;

        const [session] = await db.execute('SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId]);
        if (!session.length) return res.status(404).json({ message: 'Session-ka lama helin' });

        const finalTitle = title !== undefined ? title : session[0].title;
        const finalTraining = is_training_enabled !== undefined ? is_training_enabled : session[0].is_training_enabled;

        await db.execute(
            'UPDATE chat_sessions SET title = ?, is_training_enabled = ? WHERE id = ?',
            [finalTitle, finalTraining, id]
        );

        res.json({ message: 'Session-ka waa la cusboonaysiiyey' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta' });
    }
};

// 4. Delete session
exports.deleteSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        await db.execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [id, userId]);
        await db.execute('DELETE FROM messages_private WHERE session_id = ?', [id]);
        res.json({ message: 'Session-ka iyo fariimihiisii waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
};

const kaynabSystemInstruction = `You are Kaynab AI, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson).

Core Guidelines:
1. LANGUAGE CONSISTENCY:
- You MUST respond in the EXACT same language the user spoke to you (e.g., if the user asks a question in English, respond ONLY in English; if in Somali, respond in Somali; if in Arabic, respond in Arabic). Do not get stuck on Somali or prepend Somali disclaimers when responding in other languages.
- If an image attachment is provided, analyze the image and respond in the language used in the image text or requested by the user.
2. IDENTITY & DISCLAIMERS:
- Never prepend or include any disclaimer, note, warning, banner, or anything starting with "Fiiro gaar ah" or "Note:" under any circumstances. Keep responses clean and free of disclaimers. Only mention your identity/ZinsonAI/Hamze Mohamuud Ali Zinson if the user specifically asks "Who are you?", "Who developed you?", or "Who is your creator?".
3. CONCISENESS & EXAM/QUESTION HANDLING:
- DO NOT send long explanations or detailed step-by-step answers for exam sheets, questions, or images unless explicitly requested by the user. Long responses are a mistake.
- For Multiple Choice Questions (MCQ / goobo geli), return ONLY the question number and correct option letter in a very compact, professional, and beautiful format, e.g.:
1 = A
2 = B
3 = B
- For Fill-in-the-blank questions (su'aalaha buuxbuuxinta ah), rewrite the full sentence/question, but replace the blank space (the dashes/lines) with the correct answer wrapped in <green>...</green> tags (e.g. 'Soomaaliya waxay xorriyaddeeda qaadatay <green>1960</green>'). Do NOT use a table for these — just rewrite each sentence with the answer in green.
- For matching/relating questions (Column A / Column B type), ALWAYS use a table in EXACTLY this format:
<table_data>
#|Column A|Column B
1|[item from col A]|[matching item from col B]
2|[item from col A]|[matching item from col B]
</table_data>
- For direct questions, return only the direct answer (like a Telegram bot).
- For general comparisons, use a clean and beautiful table/shaxan with the <table_data> format.
- Keep all responses extremely concise, short, and to the point.
- For casual or friendly chats, keep replies concise and friendly.
4. FORMATTING RULES:
- Use markdown headers (# H1, ## H2, ### H3) for structure.
- Highlight key terms using <green>Keyword</green>.
- Use the following custom table format for tabular data:
<table_data>
Header1|Header2
Row1_Val1|Row1_Val2
</table_data>
- If MCQ (multiple choice) or True/False questions are asked, clearly indicate the correct option (e.g., wrap in <green>Option A</green> or use <green>Sax</green> / <red>Qald</red>).
5. APP PRICING & INFO:
- Pay as you go: $0.5 (or 5,000 SL Shilling) for 100 Credits.
- Monthly Basic: $3 (or 30,000 SL Shilling) for 30 days of unlimited chat (standard model).
- Monthly Premium: $11 (or 110,000 SL Shilling) for 30 days of unlimited chat + premium AI model (handles math/science, exam sheets, and images).
- Payment numbers: EVC Plus/eDahab numbers 637930329 or 659119779. Send screenshot to WhatsApp +252637930329 or support@kaynab.ai`;

const shukaansiSystemInstruction = `Adigu waxaad tahay AI ah oo u hadla sida gacaliye/gacaliso Soomaali ah oo aad u dhow — kaftan badan, xaraabad badan, aad u shactiro badan, oo jecel kaftanka iyo sheekooyinka dhaqanka Soomaalida.

Shakhsiyadaada iyo Dhaqankaaga (Personality & Culture):
- Waxaad si qotodheer u taqaanaa dhaqanka iyo kaftanka Soomaalida ee ku saabsan shukaansiga, guurka, haasaawaha, "afmiinshaarnimada", "xariifnimada", iyo "baadhista".
- Waxaad taqaanaa oo adeegsataa odhaahyada iyo kaftanka Soomaalida ee caanka ah sida: "Naa aniga kuuma ahan", "Adaa iga dhaanta", "Sawdigii shalay lahaa...", "Horta ma maantaad i soo xasuusatay?", "Mise waa shukaansi run ah oo guur baa ku xiga? 😂", "Inaadeer shukaansigu waa farshaxan ee maaha boob!", "Ma dan baa ku haysa mise waa iska sheeko? 😉", "Horta ma reer baadiyahaad ka timid mise magaalada? 😂", "Wallee afmiinshaar baad tahay!", "Quruxey/Gacaliye maanta maxaa cusub?", "Heer sare", "Tii barwaaqo".
- Isticmaal heeso jacayl Soomaali ah oo caan ah (tusaale: "Qaraami", "Heeso kiciya dareenka", ama weedho heeso ah marka uu wada-hadalku ku habboon yahay).
- Noo sheeg kaftan iyo shactiro kasta oo la xiriira dhaqanka guurka Soomaalida, masayrka, meherka badan, shukaansiga dhuumashada ah, iyo haasaawaha dhalinyarada.
- Haddii uu isticmaalaha wax nacayb ama xanaaq ah ku muujiyo, adigu si kaftan iyo debecsanaan ah ugu jawaab oo ku dheh: "Muxuu ahaa cadhadan qaaliga ahow? 😂" ama "Naa/Adeer xanaaqa iska yaree, ma maantaad cadho la soo toostay? 😉".
- Waligaa ha ahaanin robot ama saaxiib rasmi ah. Ha qorin casharro, talooyin caqliyeed, ama qoraallo dhaadheer oo caajis ah.

KAFTAN IYO QOSOL (Comedy Layer — This is CRITICAL):
- Waxaad tahay bini'aadamka ugu qosliyo badan ee Soomaalida — si dabiici ah uga qosli, adigoo isticmaalaya kaftan ku salaysan xaaladda, kuma filanaanta, iyo xariifnimada.
- Mararka qaar jawaab si aan la filanayn u bilow — tusaale haddii uu yidhi "waan ku jeclahay" adiga ku dheh: "Adna waan ku jeclahay... laakiin meherkaada meeqaad tahay? 😂 Waxaan iraahdaa waa guurso marka hore."
- Isticmaal kaftan ku salaysan waxyaabaha caadiga ah ee nolosha Soomaalida: baabuurta hargeysa, internet-ka go'a, korontada la qabto, ayeeyo ku tukanka, aabaha su'aasha weydiya.
- Haddii uu wax serious ah kuu sheego, ku bilow si qoto dher — ka dibna si kaftanle ah u dhammee, tusaale: "Aad ayaad u xasaasisan tahay... mise waxaad rabtaa in aan kuu sameeyo buundo? 🙈"
- Marna ha noqon caadi ama la filaan karo — ku daafo isticmaalaha, ku yaabiso, ama si aan la filanayn ugu jawaab.
- Adigoo kaftanaya, marna ha dhaafin xuduudda — kaftan dabiici ah oo bini'aadamku isticmaalo, maaha wax dhibaato geliya.
- Isticmaal emoji-yo ku haboon ee kaftan ka muujiya: 😂🤣😅🙈😭💀🫠😏🔥

Xeerarkaaga:
1. Ku hadal af-Soomaali dabiici ah, dhalinyaro ah, oo aad u macaan — isticmaal emoji-yada ku habboon (💕😂❤️😏🙈🔥😉).
2. Jawaabahaagu ha ahaadaan kuwo aad u GAABAN — ugu badnaan 1-3 weedhood oo kaliya. Toos u dhiib kaftanka ama sheekada adigoon hadal dheer gelin.
3. Mararka qaar adiguna weydii su'aalo xaraabad leh oo ka qosliya sida: "Horta meherkaaga meeqaad rabtaa? 😂" ama "Muxuu ahaa sawirkan aad soo dirtay, ma dadkaad ku baadhaysaa? 😉".
4. Marka hore is-barta (weydii magaca) oo xusuuso wixii uu kuu sheego, kuna dhex xus wada-hadalka dambe si aad ugu dareento jacayl iyo diirimaad.
5. Haddii uu sawir soo diro, ku jawaab si kalgacal iyo shactiro leh — tusaale: "Aad baad ugu qurux badantahay sawirkan, laakiin horta yaad u egtahay? 😂".
6. MARNA HA ISTICMAALIN laba luuqadood — Soomaali dabiici ah oo kaliya oo ah ta ugu habboon haasaawaha Soomaalida.
7. WALIGAA ha isticmaalin wax digniino ah, disclaimers, ama qoraal ka bilaabmaya "Fiiro gaar ah" ama "Note:". Gebi ahaanba ka saar wax kasta oo disclaimers ah.`;

function isSubstantiveQuery(text) {
    if (!text) return false;
    const clean = text.trim().toLowerCase().replace(/[?,.!]/g, '');
    if (clean.length < 3) return false;
    
    const greetings = [
        'hi', 'hello', 'hey', 'yo', 'hola', 'dear', 'darpen', 'darkpen',
        'soo dhawoow', 'soo dhawaada', 'soo dhawoow darkpen', 'soo dhawaada darkpen',
        'asc', 'ascs', 'assalamu alaykum', 'assalamualaikum', 'assalaamu alaykum',
        'see tahay', 'see tihiin', 'setahay', 'ka waran', 'karan', 'ka waran darkpen',
        'mahadsanid', 'mahadsantahay', 'waad mahadsantahay', 'thanks', 'thank you',
        'ok', 'okay', 'yes', 'no', 'haye', 'haa', 'maya', 'good morning', 'good evening', 'good afternoon',
        'subax wanaagsan', 'galab wanaagsan', 'habeen wanaagsan', 'hi there', 'hello there'
    ];
    
    if (greetings.includes(clean)) {
        return false;
    }
    
    // If it's 2 words or less and matches some common casual words, skip RAG
    const words = clean.split(/\s+/);
    if (words.length <= 2) {
        const casualWords = ['hi', 'hello', 'hey', 'asc', 'haye', 'ok', 'okay', 'thanks', 'great', 'wow', 'good', 'wlc', 'welcome'];
        if (words.every(w => casualWords.includes(w))) {
            return false;
        }
    }
    
    return true;
}

function isImageGenerationRequest(text) {
    return false;
}

// La sheekaysiga AI-da (Private Chat)
exports.askAI = async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, chatType, attachment, sessionId, stream, aiName, replyToId } = req.body; 

        if (!message && !attachment) {
            return res.status(400).json({ message: 'Fariintu waa madhan tahay' });
        }

        // Check Monetization and handle wallet expiration in a single parallel step!
        const startMonetization = Date.now();
        const walletTable = chatType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        const subTable = chatType === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';

        const walletQuery = chatType === 'shukaansi' 
            ? `SELECT balance FROM ${walletTable} WHERE user_id = ?` 
            : `SELECT balance, last_updated FROM ${walletTable} WHERE user_id = ?`;

        const subQuery = chatType === 'shukaansi'
            ? `SELECT * FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`
            : `SELECT * FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`;

        const [walletRes, subRes] = await Promise.all([
            db.execute(walletQuery, [userId]),
            db.execute(subQuery, [userId])
        ]);

        let wallet = walletRes[0];
        const sub = subRes[0];
        console.log(`[LATENCY] Monetization & wallet check query took ${Date.now() - startMonetization} ms`);

        // Check Wallet Expiration asynchronously in the background (no blocking)
        if (chatType !== 'shukaansi' && wallet.length > 0) {
            const { balance, last_updated } = wallet[0];
            if (balance > 0 && last_updated) {
                const lastUpdatedDate = new Date(last_updated);
                const now = new Date();
                const diffMs = now.getTime() - lastUpdatedDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (diffDays >= 10) {
                    console.log(`[WALLET EXPIRATION] Expiring wallet for user ${userId}. Old balance: ${balance}`);
                    // Trigger DB updates asynchronously
                    db.execute(
                        'UPDATE user_wallet SET balance = 0, last_updated = NOW() WHERE user_id = ?',
                        [userId]
                    ).catch(err => console.error('[WALLET EXPIRATION] DB error:', err));
                    
                    db.execute(
                        'INSERT INTO wallet_expirations (user_id, expired_balance) VALUES (?, ?)',
                        [userId, balance]
                    ).catch(err => console.error('[WALLET EXPIRATION] Insert error:', err));

                    // Send push notification asynchronously
                    const pushService = require('../services/pushNotificationService');
                    pushService.sendPushNotification(
                        userId,
                        'Credits-kaagii waa uu dhacay',
                        `Credits-kaagii (Pay as you go) oo ahaa ${balance} ayaa dhacay sababtoo ah ma aadan isticmaalin muddo 10 casho ah. Fadlan ku shubo credits cusub.`
                    ).catch(err => console.error('[WALLET EXPIRATION] Push notification error:', err.message));

                    // Locally update the balance to 0 for current monetization logic
                    wallet[0].balance = 0;
                }
            }
        }

        const hasBalance = wallet.length > 0 && wallet[0].balance > 0;
        const hasActiveSub = sub.length > 0;
        const userPlan = sub.length > 0 ? sub[0].type : 'credits';

        // Check if user is requesting an AI image generation
        const isImageReq = chatType !== 'shukaansi' && isImageGenerationRequest(message);

        if (isImageReq) {
            // Restriction: Block pay-as-you-go / credits-only users
            if (userPlan === 'credits') {
                const warnMsg = "Qorshahan sawir laguma generate gareyn karo ee isticmaal ama iibso qorshayaasha kale.";
                if (stream === true && !res.headersSent) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.write(`data: ${JSON.stringify({ error: "pay_as_you_go_unsupported", text: warnMsg, showBillingButton: true })}\n\n`);
                    res.end();
                } else if (!res.headersSent) {
                    res.status(403).json({ 
                        message: warnMsg, 
                        showBillingButton: true,
                        error: "pay_as_you_go_unsupported" 
                    });
                }
                return;
            }

            const imageCost = 40;
            if (!hasBalance || wallet[0].balance < imageCost) {
                const errorMsg = `Waxaad gaadhay xadkii isticmaalka qorshahaaga (Subscription limit reached). Sawir sameyntu waxay u baahan yahay ${imageCost} Credits. Fadlan iibso qorshe cusub ama ku shub credits.`;
                if (stream === true && !res.headersSent) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.write(`data: ${JSON.stringify({ error: "subscription_limit_reached", text: errorMsg, showBillingButton: true })}\n\n`);
                    res.end();
                } else if (!res.headersSent) {
                    res.status(402).json({ 
                        message: errorMsg, 
                        showBillingButton: true,
                        error: "subscription_limit_reached" 
                    });
                }
                return;
            }

            // Deduct the credits
            await db.execute(`UPDATE ${walletTable} SET balance = balance - ? WHERE user_id = ?`, [imageCost, userId]);

            // Save user message to messages_private asynchronously in background
            db.execute(
                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                [userId, sessionId || null, message]
            ).catch(err => console.error("[IMAGE GEN] Error inserting user message:", err));

            if (stream === true) {
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                if (typeof res.flushHeaders === 'function') {
                    res.flushHeaders();
                }
                res.write(`data: ${JSON.stringify({ status: 'generating_image' })}\n\n`);
                if (typeof res.flush === 'function') {
                    res.flush();
                }
            }

            let isClientConnected = true;
            req.on('close', () => {
                isClientConnected = false;
            });

            // Start generation in background
            (async () => {
                try {
                    console.log(`[IMAGE GEN] Starting Gemini Imagen generation for user ${userId}...`);
                    const base64Image = await aiService.generateAIImage(message.trim());
                    
                    const savedImageUrl = await saveBase64Image(`data:image/jpeg;base64,${base64Image}`, 'chats');
                    const relativeUrl = (savedImageUrl && (savedImageUrl.startsWith('http://') || savedImageUrl.startsWith('https://')))
                        ? savedImageUrl
                        : `/uploads/chats/${path.basename(savedImageUrl)}`;
                    
                    const responseText = "Waa kan sawirkaagii qaaliga ahaa!";
                    
                    // Save to database
                    await db.execute(
                        'INSERT INTO messages_private (user_id, session_id, sender, message, image_url) VALUES (?, ?, "ai", ?, ?)',
                        [userId, sessionId || null, responseText, relativeUrl]
                    );

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, 'imagen-3.0-generate-002', message, responseText, 'image');

                    if (isClientConnected && stream === true) {
                        res.write(`data: ${JSON.stringify({ text: responseText, image: relativeUrl, status: 'complete' })}\n\n`);
                        res.write('data: [DONE]\n\n');
                        if (typeof res.flush === 'function') {
                            res.flush();
                        }
                        res.end();
                    } else if (isClientConnected) {
                        res.json({ sender: 'ai', message: responseText, image: relativeUrl });
                    }

                    if (!isClientConnected) {
                        const pushService = require('../services/pushNotificationService');
                        await pushService.sendPushNotification(
                            userId, 
                            "Sawirkaaga waa diyaar! 🎨", 
                            "Ku soo laabo app-ka si aad u daawato sawirkaaga qaaliga ah."
                        );
                    }
                } catch (err) {
                    console.error("[IMAGE GEN ERROR]:", err);
                    const errMsg = "Waan ka xunnahay, sawir sameynta darkpen cilad ayaa ku timid. Fadlan mar kale isku day.";
                    if (isClientConnected && stream === true) {
                        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
                        res.end();
                    } else if (isClientConnected) {
                        res.status(500).json({ message: errMsg, error: errMsg });
                    }
                }
            })();

            return;
        }

        let cost = 1;
        const hasImage = attachment && (
            Array.isArray(attachment) 
                ? attachment.some(a => a.mimeType && a.mimeType.startsWith('image/'))
                : (attachment.mimeType && attachment.mimeType.startsWith('image/'))
        );
        if (hasImage) {
            cost = 10;
        } else if (message) {
            const len = message.length;
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

        // Try free trial if they do NOT have subscription
        let usedFreeAI = false;
        if (!hasActiveSub) {
            usedFreeAI = await tryUseFreeAI(userId, hasImage ? 'image' : 'text');
        }

        if (!hasActiveSub && !usedFreeAI) {
            if (!hasBalance || wallet[0].balance < cost) {
                // Free trial exhausted AND no credits — block the user and require payment
                const isImageReqBlocked = hasImage;
                const errorMsg = isImageReqBlocked
                    ? `✋ Sawirrada bilaashka ah ee free trial-kaagu (2) wey dhammaaday. Sawir falanqayn waxay u baahan tahay credits. Fadlan ku shubo credits ama iibso qorshe si aad u sii wadato.`
                    : `✋ Fariimaha bilaashka ah ee free trial-kaagu (10) wey dhammaaday. Fadlan ku shubo credits ama iibso qorshe si aad u sii wadato.`;
                
                if (stream === true && !res.headersSent) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.write(`data: ${JSON.stringify({ 
                        error: 'free_trial_exhausted', 
                        text: errorMsg, 
                        needsPayment: true,
                        freeTrialExhausted: true,
                        showBillingButton: true
                    })}\n\n`);
                    res.end();
                    return;
                }
                return res.status(402).json({ 
                    message: errorMsg, 
                    needsPayment: true,
                    freeTrialExhausted: true,
                    showBillingButton: true,
                    error: 'free_trial_exhausted'
                });
            }

            await db.execute(`UPDATE ${walletTable} SET balance = balance - ? WHERE user_id = ?`, [cost, userId]);
        }

        // Handle Image saving if any
        let savedImageUrl = null;
        if (attachment) {
            const firstAttachment = Array.isArray(attachment) ? attachment[0] : attachment;
            if (firstAttachment && firstAttachment.base64) {
                const base64Str = firstAttachment.base64.startsWith('data:') ? firstAttachment.base64 : `data:${firstAttachment.mimeType};base64,${firstAttachment.base64}`;
                savedImageUrl = await saveBase64Image(base64Str, 'chats');
            }
        }

        // Prepare History
        const startHistory = Date.now();
        let history = [];
        let finalPrompt = message;
        if (hasImage) {
            finalPrompt = `[IMAGE ANALYSIS REQUEST: Analyze the attached image very carefully. First, perform OCR to extract all questions, math formulas, text, and tasks.
Solve them accurately and format the output strictly as follows:
- If the image contains Multiple Choice Questions (MCQs/Goobo geli), solve them and format the output strictly as a highly concise list, e.g.:
1 = A
2 = B
3 = B
- If the image contains Fill-in-the-blank questions (su'aalaha buuxbuuxinta ah / the ones with blank spaces/dashes), rewrite EACH full sentence but replace the blank space (the dashes/underscores/lines) with the correct answer wrapped in <green>...</green> tags. Example: 'Soomaaliya waxay xorriyaddeeda qaadatay <green>1 July 1960</green>'. Do NOT use a table for fill-in-the-blank, just rewrite each sentence.
- If it is a matching/relating task (Column A matches Column B using numbers), format the answer as a table using EXACTLY this format:
<table_data>
#|Column A|Column B
1|[term from col A]|[matching description from col B]
2|[term from col A]|[matching description from col B]
</table_data>
- If the image contains direct questions, provide only the direct and concise answers (like a Telegram bot), without long explanations.
- If it is a general comparison or side-by-side task, use a clean table:
<table_data>
Header1|Header2
Value1|Value2
</table_data>
- Under no circumstances should you provide a long explanation or step-by-step details unless explicitly asked by the user. Keep it extremely brief, direct, and professional.
Answer in the same language as the user query or the text in the image.]\n\nUser Question/Instruction: ${message || "Please analyze this image and explain/solve it."}`;
        }

        const historyPromise = chatType === 'shukaansi'
            ? db.execute(
                'SELECT sender, message FROM shukaansi_messages WHERE user_id = ? ORDER BY id DESC LIMIT 6',
                [userId]
              )
            : db.execute(
                sessionId 
                    ? 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id = ? ORDER BY id DESC LIMIT 5'
                    : 'SELECT sender, message FROM messages_private WHERE user_id = ? AND session_id IS NULL ORDER BY id DESC LIMIT 5',
                sessionId ? [userId, sessionId] : [userId]
              );

        const [historyRes] = await historyPromise;
        history = historyRes.reverse().map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }]
        }));
        console.log(`[LATENCY] History retrieval query took ${Date.now() - startHistory} ms (Found ${history.length} items)`);

        let systemInstruction = chatType === 'shukaansi' ? shukaansiSystemInstruction : kaynabSystemInstruction;
        if (chatType === 'shukaansi' && aiName) {
            systemInstruction = `Magacaaga waa "${aiName}". Isticmaaluhu wuxuu kuu bixiyay magacan, fadlan u dhaqan sidii magacaaga rasmiga ah markaad la hadlayso.\n\n${shukaansiSystemInstruction}`;
        }
        const modelName = "gemini-3.1-flash-lite";

        // Handle streaming response if requested
        if (stream === true) {
            let insertedUserMsgId = null;
            
            // Save User message
            try {
                if (chatType === 'shukaansi') {
                    const [insertResult] = await db.execute(
                        'INSERT INTO shukaansi_messages (user_id, sender, message, image_url, reply_to_id) VALUES (?, "user", ?, ?, ?)',
                        [userId, message || "[Attachment]", savedImageUrl, replyToId || null]
                    );
                    insertedUserMsgId = insertResult.insertId;
                } else {
                    await db.execute(
                        'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                        [userId, sessionId || null, message || "[Attachment]"]
                    );
                }
            } catch (err) {
                console.error("[STREAM] User message save error:", err);
            }

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }

            // Step 2: Notify client we are now generating the response
            res.write(`data: ${JSON.stringify({ status: 'thinking' })}\n\n`);
            if (typeof res.flush === 'function') {
                res.flush();
            }

            try {
                const startGeminiStream = Date.now();
                const responseStream = await aiService.askGeminiStream(finalPrompt, modelName, attachment, history, systemInstruction);
                console.log(`[LATENCY] Gemini askGeminiStream call startup took ${Date.now() - startGeminiStream} ms`);
                
                let aiResponseText = "";
                const streamIterStart = Date.now();
                for await (const chunk of responseStream) {
                    const chunkText = chunk.text();
                    aiResponseText += chunkText;
                    res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                    if (typeof res.flush === 'function') {
                        res.flush();
                    }
                }
                console.log(`[LATENCY] Gemini stream iteration completed in ${Date.now() - streamIterStart} ms`);
                res.write('data: [DONE]\n\n');
                if (typeof res.flush === 'function') {
                    res.flush();
                }
                res.end();

                // Save AI response asynchronously in background
                (async () => {
                    try {
                        const finalSavedText = aiService.ensureTableTags(aiResponseText);
                        if (chatType === 'shukaansi') {
                            await db.execute(
                                'INSERT INTO shukaansi_messages (user_id, sender, message, reply_to_id) VALUES (?, "ai", ?, ?)',
                                [userId, finalSavedText, insertedUserMsgId || null]
                            );

                            // AI reacts to user message sometimes (e.g. 40% of the time)
                            if (insertedUserMsgId && Math.random() < 0.4) {
                                const reactions = ['❤️', '😂', '👍', '😮', '😢'];
                                let chosenReaction = reactions[0];
                                const lowerMsg = (message || "").toLowerCase();
                                if (lowerMsg.includes('dhib') || lowerMsg.includes('xun') || lowerMsg.includes('buux') || lowerMsg.includes('tiiraanyo')) {
                                    chosenReaction = '😢';
                                } else if (lowerMsg.includes('ha') || lowerMsg.includes('qosol') || lowerMsg.includes('kaftan') || lowerMsg.includes('he')) {
                                    chosenReaction = '😂';
                                } else if (lowerMsg.includes('nax') || lowerMsg.includes('yaab') || lowerMsg.includes('mise')) {
                                    chosenReaction = '😮';
                                } else if (lowerMsg.includes('fiican') || lowerMsg.includes('haa') || lowerMsg.includes('haye')) {
                                    chosenReaction = '👍';
                                } else {
                                    chosenReaction = reactions[Math.floor(Math.random() * reactions.length)];
                                }
                                
                                await db.execute(
                                    'UPDATE shukaansi_messages SET ai_reaction = ? WHERE id = ?',
                                    [chosenReaction, insertedUserMsgId]
                                );
                            }
                        } else {
                            await db.execute(
                                'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                                [userId, sessionId || null, finalSavedText]
                            );
                        }
                        
                        // Log AI usage!
                        const aiLogger = require('../utils/aiLogger');
                        aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", finalSavedText, chatType || 'education');
                    } catch (dbErr) {
                        console.error("[STREAM] Async AI response save/log error:", dbErr);
                    }
                })();
            } catch (err) {
                console.error("Gemini stream generation error:", err);
                res.write(`data: ${JSON.stringify({ error: "Waan ka xunnahay, Kaynab AI cilad farsamo ayaa ku timid. Fadlan isku day mar kale waxyar ka dib." })}\n\n`);
                if (typeof res.flush === 'function') {
                    res.flush();
                }
                res.end();
            }
            return;
        }

        // Non-streaming response
        const startGemini = Date.now();
        const aiResponseText = await aiService.askGemini(finalPrompt, modelName, attachment, history, systemInstruction);
        console.log(`[LATENCY] Gemini askGemini call completed in ${Date.now() - startGemini} ms`);

        // Send response immediately to user, let DB updates and logging run asynchronously in background!
        res.json({ sender: 'ai', message: aiResponseText });

        (async () => {
            try {
                if (chatType === 'shukaansi') {
                    const [insertResult] = await db.execute(
                        'INSERT INTO shukaansi_messages (user_id, sender, message, image_url, reply_to_id) VALUES (?, "user", ?, ?, ?)',
                        [userId, message || "[Attachment]", savedImageUrl, replyToId || null]
                    );
                    const insertedUserMsgId = insertResult.insertId;

                    await db.execute(
                        'INSERT INTO shukaansi_messages (user_id, sender, message, reply_to_id) VALUES (?, "ai", ?, ?)',
                        [userId, aiResponseText, insertedUserMsgId || null]
                    );

                    // AI reacts to user message sometimes (e.g. 40% of the time)
                    if (insertedUserMsgId && Math.random() < 0.4) {
                        const reactions = ['❤️', '😂', '👍', '😮', '😢'];
                        let chosenReaction = reactions[0];
                        const lowerMsg = (message || "").toLowerCase();
                        if (lowerMsg.includes('dhib') || lowerMsg.includes('xun') || lowerMsg.includes('buux') || lowerMsg.includes('tiiraanyo')) {
                            chosenReaction = '😢';
                        } else if (lowerMsg.includes('ha') || lowerMsg.includes('qosol') || lowerMsg.includes('kaftan') || lowerMsg.includes('he')) {
                            chosenReaction = '😂';
                        } else if (lowerMsg.includes('nax') || lowerMsg.includes('yaab') || lowerMsg.includes('mise')) {
                            chosenReaction = '😮';
                        } else if (lowerMsg.includes('fiican') || lowerMsg.includes('haa') || lowerMsg.includes('haye')) {
                            chosenReaction = '👍';
                        } else {
                            chosenReaction = reactions[Math.floor(Math.random() * reactions.length)];
                        }
                        
                        await db.execute(
                            'UPDATE shukaansi_messages SET ai_reaction = ? WHERE id = ?',
                            [chosenReaction, insertedUserMsgId]
                        );
                    }

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, 'shukaansi');
                } else {
                    // Save User and AI messages for private chat sequentially to prevent out-of-order IDs and identical timestamps
                    await db.execute(
                        'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "user", ?)',
                        [userId, sessionId || null, message || "[Attachment]"]
                    );
                    await db.execute(
                        'INSERT INTO messages_private (user_id, session_id, sender, message) VALUES (?, ?, "ai", ?)',
                        [userId, sessionId || null, aiResponseText]
                    );

                    // Log AI usage!
                    const aiLogger = require('../utils/aiLogger');
                    aiLogger.logAIUsage(userId, modelName, message || "[Attachment]", aiResponseText, 'education');
                }
            } catch (dbErr) {
                console.error("[ASK_AI] Async DB save/log error in non-stream:", dbErr);
            }
        })();

    } catch (error) {
        console.error("AskAI Error:", error);
        const friendlyMsg = "Waan ka xunnahay, Kaynab AI cilad farsamo ayaa ku timid. Fadlan isku day mar kale waxyar ka dib.";
        if (req.body.stream === true && req.body.chatType !== 'shukaansi' && !res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
            res.end();
        } else if (!res.headersSent) {
            res.status(500).json({ message: friendlyMsg, error: friendlyMsg });
        }
    }
};

// Soo akhrinta Taariikhda fariimaha Session gaar ah (With Pagination)
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { sessionId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const [messages] = await db.execute(
            `SELECT * FROM (
                SELECT id, user_id, sender, message, created_at, session_id, image_url AS image FROM messages_private 
                WHERE user_id = ? AND session_id = ? 
                ORDER BY id DESC 
                LIMIT ? OFFSET ?
            ) sub ORDER BY id ASC`,
            [userId, sessionId, limit.toString(), offset.toString()]
        );
        res.json({ messages, page, limit });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta farriimaha' });
    }
};

// Clear all private chat history for a user
exports.clearChatHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        // Delete all private messages for this user
        await db.execute('DELETE FROM messages_private WHERE user_id = ?', [userId]);
        // Also delete any custom chat sessions if they exist
        await db.execute('DELETE FROM chat_sessions WHERE user_id = ?', [userId]);
        res.json({ status: 'success', message: 'Dhamaan chat history-gii waa la tirtiray.' });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista taariikhda farriimaha.' });
    }
};

const fs = require('fs');

// Process Voice Note
exports.processVoice = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Cod lama soo dirin' });
        
        const filePath = req.file.path;
        const chatType = req.body.chatType || 'general';
        
        // Use Gemini 1.5 Flash to transcribe
        const transcribedText = await aiService.transcribeAudio(filePath, req.file.mimetype);
        
        // Remove file after transcription to save space
        fs.unlinkSync(filePath);

        // Credit Deduction for Voice (20 Credits)
        const userId = req.user.id;
        const subTable = chatType === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';
        const [sub] = await db.execute(`SELECT * FROM ${subTable} WHERE user_id = ? AND expiry_date > NOW()`, [userId]);
        const hasActiveSub = sub.length > 0;

        const walletTable = chatType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';

        if (!hasActiveSub) {
            const [wallet] = await db.execute(`SELECT balance FROM ${walletTable} WHERE user_id = ?`, [userId]);
            const hasBalance = wallet.length > 0 && wallet[0].balance >= 20;

            if (!hasBalance) {
                return res.status(402).json({ message: 'Dhibcahaagu kuma filna duubista codka (20 Credits).', needsPayment: true });
            }

            await db.execute(`UPDATE ${walletTable} SET balance = balance - 20 WHERE user_id = ?`, [userId]);
        }
        
        // Log voice note transcription to ai_usage_logs
        try {
            await db.execute(
                'INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) VALUES (?, "gemini-1.5-flash", 0, 0, ?, "voice")',
                [userId, 20 / 200]
            );
        } catch (logErr) {
            console.error('[AI Logger Error] Voice note log failed:', logErr.message);
        }
        res.json({ text: transcribedText });
    } catch (error) {
        console.error("Voice Error:", error);
        res.status(500).json({ message: 'Lama fahmin codka', error: error.message });
    }
};

// New: Get Shukaansi Credits & Sub
exports.getShukaansiProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [wallet] = await db.execute('SELECT balance FROM shukaansi_wallet WHERE user_id = ?', [userId]);
        const [sub] = await db.execute('SELECT type, expiry_date FROM shukaansi_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
        
        res.json({
            balance: wallet.length > 0 ? wallet[0].balance : 0,
            subscription: sub.length > 0 ? sub[0] : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shukaansi profile' });
    }
};

// New: Get Shukaansi Message History
exports.getShukaansiHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const [history] = await db.execute(
            `SELECT m.id, m.sender, m.message, m.image_url as image, m.reaction, m.ai_reaction, m.reply_to_id, m.created_at,
                    p.message AS reply_to_message, p.sender AS reply_to_sender
             FROM shukaansi_messages m
             LEFT JOIN shukaansi_messages p ON m.reply_to_id = p.id
             WHERE m.user_id = ?
             ORDER BY m.created_at ASC`,
            [userId]
        );
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching shukaansi history' });
    }
};

// POST Reaction to message
exports.reactToShukaansiMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId, reaction } = req.body;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }
        
        await db.execute(
            'UPDATE shukaansi_messages SET reaction = ? WHERE id = ? AND user_id = ?',
            [reaction || null, messageId, userId]
        );
        
        res.json({ success: true, messageId, reaction });
    } catch (error) {
        console.error("Reaction Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday samaynta reaction-ka' });
    }
};

// POST Deduct Shukaansi Call Credit (5 credits per minute)
exports.deductShukaansiCallCredit = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 2. Fetch current wallet balance
        const [wallet] = await db.execute('SELECT balance FROM shukaansi_wallet WHERE user_id = ?', [userId]);
        const currentBalance = wallet.length > 0 ? wallet[0].balance : 0;
        
        const cost = 5; // 5 credits per minute
        if (currentBalance < cost) {
            return res.json({ status: 'insufficient', balance: currentBalance });
        }
        
        // 3. Deduct balance
        const newBalance = currentBalance - cost;
        await db.execute('UPDATE shukaansi_wallet SET balance = ? WHERE user_id = ?', [newBalance, userId]);
        
        // Log voice call to ai_usage_logs
        try {
            await db.execute(
                'INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) VALUES (?, "voice-call", 0, 0, ?, "voice-call")',
                [userId, 5 / 200]
            );
        } catch (logErr) {
            console.error('[AI Logger Error] Voice call log failed:', logErr.message);
        }
        
        res.json({ status: 'success', balance: newBalance });
    } catch (error) {
        console.error("Deduct Call Credit Error:", error);
        res.status(500).json({ message: 'Error checking/deducting call credit' });
    }
};

// POST Ask AI in Exams / Books
exports.askExamAI = async (req, res) => {
    try {
        const userId = req.user.id;
        const { question, contextText, docTitle, docType, attachment, history } = req.body;

        if (!question && !attachment) {
            return res.status(400).json({ message: 'Fariintu waa madhan tahay' });
        }

        // Determine cost based on whether attachment exists or message length
        let cost = 1;
        const hasImage = attachment && attachment.base64;
        
        if (hasImage) {
            cost = 10; // Image cost is 10 credits (same as normal chat)
        } else if (question) {
            const len = question.length;
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

        // Check wallet balance
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (balance < cost) {
            return res.status(402).json({
                message: `Qalabka AI ee Imtixaanada wuxuu u baahan yahay ${cost} Credits. Fadlan ku shubo credits si aad u sii wadato!`,
                needsPayment: true
            });
        }

        // Deduct credits
        const newBalance = balance - cost;
        await db.execute('UPDATE user_wallet SET balance = ? WHERE user_id = ?', [newBalance, userId]);

        // Generate response using Gemini
        const systemInstruction = `Waxaa laguu bixiyey magaca Darkpen AI Exam Assistant. Waxaa ku horumarisay shirkada ZinsonAI oo uu leeyahay Hamze Mohamuud Ali Zinson. Hadafkaagu waa inaad ardayda Soomaaliyeed ka caawiso fahamka iyo xalinta su'aalaha imtixaanada ama casharada buugaagta.
Ku jawaab luuqada Af-Soomaaliga. Waligaa ha dhihin waxaan ahay Google ama OpenAI, waxaad tahay Darkpen oo ay leedahay ZinsonAI.

Rules for response formatting:
1. Su'aalaha MCQ (Doorashada/Goobo gali): Soo saar jawaabta oo kooban oo keliya (lambarka iyo xarafka saxda ah). Ha ku darin sharaxaad dheer ilaa uu ardaygu ku weydiiyo "ii sharax" ama "explain".
2. Run iyo Been (True/False): Qor erayga RUN ama TRUE, iyo BEEN ama FALSE si aad u muujiso jawaabta saxda ah.
3. Shaxan (Tables) ama Isku-beeg-beeg (Matching): U qaabayn qaab shaxan (table) adoo isticmaalaya xariijimaha markdown (tusaale: Column A | Column B \n --- | --- \n Qodobka A | Qodobka B).
4. Dhammaan jawaabahaaga ha ahaadaan kuwo gaaban, abaabulan, oo leh cinwaano toos ah.`;

        let promptText = `Document: ${docTitle || 'imtixaan/buug'} (${docType || 'educational'})`;
        if (contextText) {
            promptText += `\nContext: ${contextText}`;
        }
        if (question) {
            promptText += `\nSu'aal: ${question}`;
        } else {
            promptText += `\nFadlan ii sharax ama ii xal qaybta aan ku wareejiyay sawirka.`;
        }

        let geminiAttachment = null;
        if (hasImage) {
            // Strip data:image/... prefix if it exists in base64
            const cleanBase64 = attachment.base64.replace(/^data:image\/\w+;base64,/, "");
            geminiAttachment = {
                base64: cleanBase64,
                mimeType: attachment.mimeType || 'image/png'
            };
        }

        const modelName = "gemini-2.5-flash";
        const responseText = await aiService.askGemini(promptText, modelName, geminiAttachment, history || [], systemInstruction);

        // Log AI usage to database
        const aiLogger = require('../utils/aiLogger');
        await aiLogger.logAIUsage(userId, modelName, question || "[Image/Drawing]", responseText, 'exam-assist');

        res.json({
            success: true,
            message: responseText,
            deducted: cost,
            remainingBalance: newBalance
        });
    } catch (error) {
        console.error("Ask Exam AI Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday adeega AI-da ee imtixaanada. Fadlan mar kale isku day.' });
    }
};

