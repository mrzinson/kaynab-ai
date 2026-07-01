const db = require('../config/db');

async function testInsert() {
    try {
        console.log("Testing AI insert...");
        const [result] = await db.execute(
            'INSERT INTO shukaansi_messages (user_id, sender, message) VALUES (?, ?, ?)',
            [12, 'ai', 'Ka tijaabi backend-ka']
        );
        console.log("Insert result:", result);
        process.exit(0);
    } catch (e) {
        console.error("Insert failed:", e);
        process.exit(1);
    }
}
testInsert();
