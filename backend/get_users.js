const db = require('./config/db');

async function main() {
    try {
        const [users] = await db.execute(`
            SELECT id, name, whatsapp_number, created_at 
            FROM users 
            WHERE whatsapp_number IS NOT NULL AND whatsapp_number != ''
        `);
        console.log('Total WhatsApp Users found:', users.length);
        console.log('Sample of users:', users.slice(0, 10));
    } catch (err) {
        console.error('Error fetching users:', err);
    } finally {
        await db.end();
    }
}

main();
