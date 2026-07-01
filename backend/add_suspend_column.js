const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        await connection.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended TINYINT(1) DEFAULT 0');
        console.log('Added is_suspended column successfully!');
    } catch(e) { 
        console.error('Error adding is_suspended column:', e.message); 
    }

    await connection.end();
}

run().catch(console.error);
