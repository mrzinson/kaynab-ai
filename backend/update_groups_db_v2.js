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
        // Add last_read_at to group_members
        await connection.query('ALTER TABLE group_members ADD COLUMN last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        console.log('✅ Added last_read_at to group_members');
    } catch(e) { console.log(e.message); }

    try {
        // Add last_read_id to group_members (more precise than time)
        await connection.query('ALTER TABLE group_members ADD COLUMN last_read_id INT DEFAULT 0');
        console.log('✅ Added last_read_id to group_members');
    } catch(e) { console.log(e.message); }

    await connection.end();
}

run().catch(console.error);
