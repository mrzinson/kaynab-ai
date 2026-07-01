const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
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
        const sqlPath = path.join(__dirname, 'db_update_v9.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Run garaynaya updates-ka v9 (Tournament Opt-In, Settings & Suspension)...');
        
        const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
        
        for (let query of queries) {
            try {
                await connection.query(query);
                console.log('✅ Si guul leh ayuu u fulay query-gani:', query.substring(0, 80) + '...');
            } catch (err) {
                console.error('❌ Cilad ayaa ka dhacday query-gan:', query.substring(0, 80) + '...', err.message);
            }
        }
        
        console.log('🎉 Dhammaan isbeddelada si guul leh ayaa loo mariyay!');
    } catch(e) { 
        console.log('Cilad guud:', e.message); 
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
