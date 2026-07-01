const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('Isku xiraya Database-ka...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Waxaa la mariyay isbeddelada shukaansi_messages table...');
        
        // 1. Add reaction column if not exists
        try {
            await connection.query('ALTER TABLE shukaansi_messages ADD COLUMN reaction VARCHAR(50) DEFAULT NULL');
            console.log('✅ Si guul leh loo daray reaction column');
        } catch (e) {
            console.log('ℹ️ reaction column wuu jiraa ama failed:', e.message);
        }

        // 2. Add ai_reaction column if not exists
        try {
            await connection.query('ALTER TABLE shukaansi_messages ADD COLUMN ai_reaction VARCHAR(50) DEFAULT NULL');
            console.log('✅ Si guul leh loo daray ai_reaction column');
        } catch (e) {
            console.log('ℹ️ ai_reaction column wuu jiraa ama failed:', e.message);
        }

        // 3. Add reply_to_id column if not exists
        try {
            await connection.query('ALTER TABLE shukaansi_messages ADD COLUMN reply_to_id INT DEFAULT NULL');
            console.log('✅ Si guul leh loo daray reply_to_id column');
        } catch (e) {
            console.log('ℹ️ reply_to_id column wuu jiraa ama failed:', e.message);
        }

        console.log('🎉 Dhammaan isbeddelada database-ka shukaansi si guul leh ayaa loo mariyay!');
    } catch(e) { 
        console.log('❌ Cilad guud:', e.message); 
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
