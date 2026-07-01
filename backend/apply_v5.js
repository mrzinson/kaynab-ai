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
        const sqlPath = path.join(__dirname, 'db_update_v5.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Run garaynaya Indexes...');
        
        // Isku day index kasta goonidiisa si uusan mid u xannibin kan kale
        const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0 && !q.startsWith('--'));
        
        for (let query of queries) {
            try {
                await connection.query(query);
                console.log('✅ Si guul leh ayuu u fulay index-kani:', query.substring(0, 50) + '...');
            } catch (err) {
                if (err.code === 'ER_DUP_KEYNAME') {
                    console.log('⚠️ Index-kani horay ayuu u jiray:', query.substring(0, 50) + '...');
                } else {
                    console.error('❌ Cilad ayaa ka dhacday:', err.message);
                }
            }
        }
        
        console.log('🎉 Dhammaan Indexes-ka si guul leh ayaa loo mariyay!');
    } catch(e) { 
        console.log('Cilad guud:', e.message); 
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
