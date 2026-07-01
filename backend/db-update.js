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
        await connection.query('ALTER TABLE users ADD COLUMN username VARCHAR(50) UNIQUE NULL');
        console.log('Added username');
    } catch(e) { console.log(e.message); }

    try {
        await connection.query('ALTER TABLE users ADD COLUMN profile_picture LONGTEXT NULL');
        console.log('Added profile_picture');
    } catch(e) { console.log(e.message); }

    try {
        await connection.query("ALTER TABLE users ADD COLUMN gender ENUM('male', 'female') NULL");
        console.log('Added gender');
    } catch(e) { console.log(e.message); }

    try {
        await connection.query('ALTER TABLE users ADD COLUMN last_username_change TIMESTAMP NULL');
        console.log('Added last_username_change');
    } catch(e) { console.log(e.message); }

    await connection.end();
}

run().catch(console.error);
