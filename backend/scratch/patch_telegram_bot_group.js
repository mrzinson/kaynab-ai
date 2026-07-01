const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../services/telegramBot.js');
let content = fs.readFileSync(file, 'utf8');

const marker = "const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';";
const markerIndex = content.indexOf(marker);
if (markerIndex === -1) {
    console.error('Marker not found!');
    process.exit(1);
}

const targetStart = 'if (isGroup) {';
const startIndex = content.indexOf(targetStart, markerIndex);
if (startIndex === -1) {
    console.error('if (isGroup) not found!');
    process.exit(1);
}

const endIndex = content.indexOf('}', startIndex);
if (endIndex === -1) {
    console.error('Closing bracket not found!');
    process.exit(1);
}

const targetContent = content.substring(startIndex, endIndex + 1);
console.log('--- FOUND TARGET ---');
console.log(targetContent);
console.log('--------------------');

const replacement = `if (isGroup) {
        await handleGroupMessage(msg);
        return;
    }`;

const patched = content.replace(targetContent, replacement);
fs.writeFileSync(file, patched, 'utf8');
console.log('SUCCESS: Patched isGroup early return to call handleGroupMessage instead.');
