const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../services/telegramBot.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Replace handleContactSharing
const markerContact = '// ─── Handle shared contact ─────────────────────────────────────────────────────';
const startContact = content.indexOf(markerContact);
if (startContact === -1) {
    console.error('markerContact not found!');
    process.exit(1);
}

const funcStart = content.indexOf('async function handleContactSharing(msg) {', startContact);
if (funcStart === -1) {
    console.error('funcStart not found!');
    process.exit(1);
}

const funcEnd = content.indexOf('\n}', funcStart);
if (funcEnd === -1) {
    console.error('funcEnd not found!');
    process.exit(1);
}

const originalFunc = content.substring(funcStart, funcEnd + 2);

const replacementFunc = `async function handleContactSharing(msg) {
    const chatId  = msg.chat.id;
    const contact = msg.contact;

    if (!contact || contact.user_id !== msg.from.id) {
        await bot.sendMessage(chatId, '❌ Fadlan la wadaag *lambarkaaga saxda ah* adigoo gujinaaya badhanka\\.', { parse_mode: 'Markdown' });
        return;
    }

    // Show loading animation
    const loader = await sendLoadingMessage(chatId,
        '🔍 _Xaqiijinaya koontadaada\\.\\.\\._'
    );

    const rawPhone    = contact.phone_number;
    const normalized  = normalizePhoneNumber(rawPhone);

    if (!normalized) {
        await editLoadingMessage(loader, '❌ Lambarkaagu ma saxna\\. Fadlan isku day mar kale\\.');
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
                    '🚫 *Koontadaada waa la xanibay\\.* Fadlan la xidhiidh taageerada\\.',
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
            await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\\.\\.\\._\\n\`[██████████] 100%\`');
            await new Promise(r => setTimeout(r, 200));
            await deleteMsg(chatId, loader?.messageId);

            await bot.sendMessage(chatId,
                \`✅ *Xaqiijin guul leh!* 🎉\\n\\n\` +
                \`Ku soo dhawaada *\\\${user.name}*!\\n\\n\` +
                \`🤖 Darkpen Bot waa diyaar. Su'aashaada iigu soo dir!\`,
                {
                    parse_mode: 'Markdown',
                    reply_markup: { remove_keyboard: true }
                }
            );
            return;
        }

        // If not registered, run a fast registration flow start animation
        await editLoadingMessage(loader, '🔍 _Xaqiijinaya koontadaada\\.\\.\\._\\n\`[████░░░░░░] 40%\`');
        await new Promise(r => setTimeout(r, 200));
        await editLoadingMessage(loader, '📋 _Diyaarinaya diiwaan-gelinta\\.\\.\\._\\n\`[████████░░] 80%\`');
        await new Promise(r => setTimeout(r, 200));
        await deleteMsg(chatId, loader?.messageId);

        // Store phone + start registration flow
        telegramUserStates.set(\`unreg_\${chatId}\`, {
            step: 'reg_name',
            phone: normalized
        });

        await bot.sendMessage(chatId,
            \`👋 *Soo dhowow Darkpen!* 🤖📚\\n\\n\` +
            \`Lambarkan *\\\${escapeMd(normalized)}* lama helin diiwaanka.\\n\\n\` +
            \`📝 *Waxaan kaa caawinayaa inaad diwaangasho hadda!*\\n\\n\` +
            \`━━━━━━━━━━━━━━━\\n\` +
            \`*Tallaabada 1 / 3*\\n\` +
            \`👤 *Magacaaga full-name-kaaga* maxaa?\\n\` +
            \`_\\\\(Tusaale: Axmed Cali\\\\)_\`,
            {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true }
            }
        );
    } catch (err) {
        console.error('[TELEGRAM BOT] Link/Registration initiation error:', err);
        await editLoadingMessage(loader, '❌ Cilad ayaa ku timid xaqiijinta koontadaada.');
    }
}`;

// Normalize CRLF in search to be safe
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOriginalFunc = originalFunc.replace(/\r\n/g, '\n');

if (!normalizedContent.includes(normalizedOriginalFunc)) {
    console.error('originalFunc not found in file!');
    process.exit(1);
}

let patchedContent = normalizedContent.replace(normalizedOriginalFunc, replacementFunc);

// 2. Replace typing indicator delay
const typingMarker = '// ── 11. Typing indicator + AI call ───────────────────────────────────────';
const typingStart = patchedContent.indexOf(typingMarker);
if (typingStart !== -1) {
    const delayStart = patchedContent.indexOf('await new Promise(r => setTimeout(r, Math.floor(Math.random() * 500) + 300));', typingStart);
    if (delayStart !== -1) {
        const originalDelay = patchedContent.substring(delayStart, delayStart + 78);
        patchedContent = patchedContent.replace(originalDelay, 'await new Promise(r => setTimeout(r, 100));');
    } else {
        console.warn('Typing delay not found!');
    }
} else {
    console.warn('Typing marker not found!');
}

// 3. Replace registration progress delays
patchedContent = patchedContent.replace('await new Promise(r => setTimeout(r, 500));\n        await editLoadingMessage(loader, \'⚙️ _Koontada la sameynayaa', 'await new Promise(r => setTimeout(r, 150));\n        await editLoadingMessage(loader, \'⚙️ _Koontada la sameynayaa');
patchedContent = patchedContent.replace('await new Promise(r => setTimeout(r, 400));\n\n            // Create wallet', 'await new Promise(r => setTimeout(r, 150));\n\n            // Create wallet');

// Write back with original line endings
const finalContent = content.includes('\r\n') ? patchedContent.replace(/\n/g, '\r\n') : patchedContent;
fs.writeFileSync(file, finalContent, 'utf8');
console.log('SUCCESS: Patched speed optimizations in telegramBot.js!');
