const db = require('./config/db');

async function main() {
    try {
        const [messages] = await db.execute('SELECT id, sender, message, created_at FROM messages_private WHERE user_id = 139 ORDER BY created_at DESC LIMIT 5');
        console.log('--- USER 139 HISTORY AS RETRIEVED BY BOT ---');
        console.log(JSON.stringify(messages, null, 2));
        console.log('--- REVERSED ---');
        console.log(JSON.stringify([...messages].reverse(), null, 2));
    } catch (err) {
        console.error('Error listing users:', err);
    } finally {
        await db.end();
    }
}

main();
