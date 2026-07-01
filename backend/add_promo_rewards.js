const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Starting promotional rewards database migration...');

    try {
        // 1. Add reward_credits and reward_type to promo_cards
        await connection.query(`
            ALTER TABLE promo_cards 
            ADD COLUMN IF NOT EXISTS reward_credits INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS reward_type VARCHAR(50) DEFAULT NULL
        `);
        console.log('✅ Added reward_credits and reward_type columns to promo_cards successfully!');
    } catch (e) {
        console.error('❌ Error adding promo_cards columns:', e.message);
    }

    try {
        // 2. Create user_claimed_promos junction table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_claimed_promos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                promo_card_id INT NOT NULL,
                screenshot_url VARCHAR(512) DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (promo_card_id) REFERENCES promo_cards(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_promo (user_id, promo_card_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ Created user_claimed_promos table successfully!');
    } catch (e) {
        console.error('❌ Error creating user_claimed_promos table:', e.message);
    }

    await connection.end();
    console.log('Migration finished.');
}

run().catch(console.error);
