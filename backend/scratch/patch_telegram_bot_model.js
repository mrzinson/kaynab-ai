const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../services/telegramBot.js');
let content = fs.readFileSync(file, 'utf8');

// Replace all occurrences of 'gemini-2.5-flash' with 'gemini-3.1-flash-lite'
const target = "'gemini-2.5-flash'";
const replacement = "'gemini-3.1-flash-lite'";

if (!content.includes(target)) {
    console.error('Target not found in telegramBot.js!');
    process.exit(1);
}

const patched = content.split(target).join(replacement);
fs.writeFileSync(file, patched, 'utf8');
console.log('SUCCESS: Replaced gemini-2.5-flash with gemini-3.1-flash-lite in telegramBot.js');
