const db = require('./config/db');

async function main() {
    try {
        const [messages] = await db.execute(`
            SELECT m.user_id, u.name, u.whatsapp_number, m.sender, m.message, m.created_at 
            FROM messages_private m
            JOIN users u ON m.user_id = u.id
            WHERE u.id >= 108
            ORDER BY m.user_id DESC, m.created_at ASC
        `);
        console.log('--- MESSAGES ---');
        console.log(JSON.stringify(messages, null, 2));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await db.end();
    }
}

main();
