const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, 'db_groups.sql'), 'utf8');
        await connection.query(sql);
        console.log('✅ Groups tables created successfully!');
    } catch(e) {
        console.error('❌ Error creating groups tables:', e.message);
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
