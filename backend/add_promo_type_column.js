const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Adding promo_type column to promo_cards...');

    try {
        await connection.query(`
            ALTER TABLE promo_cards 
            ADD COLUMN IF NOT EXISTS promo_type VARCHAR(50) DEFAULT 'normal'
        `);
        console.log('✅ Added promo_type column to promo_cards successfully!');
    } catch (e) {
        console.error('❌ Error adding promo_type column:', e.message);
    }

    await connection.end();
}

run().catch(console.error);
