const db = require('../config/db');

async function checkMessages() {
    try {
        const [rows] = await db.execute('SELECT * FROM shukaansi_messages WHERE user_id = 12 ORDER BY created_at ASC');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkMessages();
