const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../services/telegramBot.js');
let content = fs.readFileSync(file, 'utf8');

const marker = 'telegramUserStates.delete(`unreg_${chatId}`);';
const markerIndex = content.indexOf(marker);
if (markerIndex === -1) {
    console.error('Marker not found!');
    process.exit(1);
}

const startSearchStr = 'await bot.sendMessage(chatId,';
const startIndex = content.indexOf(startSearchStr, markerIndex);
if (startIndex === -1) {
    console.error('Start search string not found!');
    process.exit(1);
}

const endIndex = content.indexOf(');', startIndex);
if (endIndex === -1) {
    console.error('End of sendMessage not found!');
    process.exit(1);
}

const targetContent = content.substring(startIndex, endIndex + 2);
console.log('--- FOUND TARGET ---');
console.log(targetContent);
console.log('--------------------');

const replacement = `await bot.sendMessage(chatId,
                \`🎉 *Diwaangelintaada waa guul!* 🎉\\n\\n\` +
                \`👤 *Magaca:* \${escapeMd(state.name)}\\n\` +
                \`🆔 *Username:* @\${escapeMd(state.username)}\\n\` +
                \`📱 *Lambarka:* \${escapeMd(state.phone)}\\n\\n\` +
                \`🎁 Waxaad hadiyad ahaan u heysataa *40 Credits oo Free ah* oo aad hadda ku bilaabi karto!\\n\` +
                \`• *10 Credits* oo fariimaha qoraalka ah (10 Free Text Messages)\\n\` +
                \`• *30 Credits* oo sawirada ah (3 Free Images)\\n\\n\` +
                \`━━━━━━━━━━━━━━━\\n\` +
                \`⚠️ *Ogeysiis iyo Shuruudo (Terms & Conditions):*\\n\` +
                \`• Haddii aad isticmaasho Telegram-kan, waxay ka dhigan tahay inaad ogolaatay shuruudaha iyo xeerarka (terms and conditions) ee app-ka Darkpen AI.\\n\` +
                \`• Fadlan ogoow in bot-kan aan loogu talagalin waxyaabaha sharciga ka hor imanaya ee qishka imtixaannada iyo wixii la mid ah. Isticmaalaha (user-ka) ayaa si buuxda mas'uul uga ah wixii uu u isticmaalo.\\n\` +
                \`• Haddii jawaabta bot-ku dib u dhacdo ama uu soo jawaabi waayo, taasi micnaheedu maaha inuu khaldan yahay, balse waa mashquul aad u badan (jam) oo ka jira qaybta Bilaashka ah (Free tier).\\n\` +
                \`• Fadlan save gareyso nambarkayaga oo ah *+252637930329* si aad u aragto wararkii ugu dambeeyay iyo warbixinaha status-keena.\\n\` +
                \`━━━━━━━━━━━━━━━\\n\\n\` +
                \`📚 *Darkpen AI wuxuu kaa caawinayaa waxbarashada, sawirada, xallinta su'aalaha, iyo wax kasta oo aad u baahan tahay!*\\n\` +
                \`💳 Marka ay kaa dhamaadaan free-gu, waxaad ku shuban kartaa *$0.50* (100 credits):\\n\` +
                \`EVC Plus: *\\\\*771\\\\*637930329\\\\*lacagta\\\\#*\\n\` +
                \`ZAAD: *\\\\*220\\\\*637930329\\\\*lacagta\\\\#*\\n\` +
                \`eDahab: *\\\\*700\\\\*659119779\\\\*lacagta\\\\#*\\n\` +
                \`Ka dib screenshot WhatsApp-ka u dir: *\\\\+252637930329*\\n\\n\` +
                \`🤖 Su'aashaada iigu soo dir qoraal, sawir ama cod!\`,
                { parse_mode: 'Markdown' }
            );`;

const patched = content.replace(targetContent, replacement);
fs.writeFileSync(file, patched, 'utf8');
console.log('SUCCESS: Patched registration welcome message in telegramBot.js');
