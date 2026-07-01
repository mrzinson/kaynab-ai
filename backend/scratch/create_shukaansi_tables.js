const db = require('../config/db');

async function createTables() {
    try {
        console.log("Creating Shukaansi tables...");
        
        // 1. Shukaansi Wallet
        await db.execute(`
            CREATE TABLE IF NOT EXISTS shukaansi_wallet (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                balance INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 2. Shukaansi Subscriptions
        await db.execute(`
            CREATE TABLE IF NOT EXISTS shukaansi_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                type ENUM('credits', 'monthly_3', 'monthly_11') DEFAULT 'credits',
                expiry_date DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Shukaansi Messages
        await db.execute(`
            CREATE TABLE IF NOT EXISTS shukaansi_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                sender ENUM('user', 'ai') NOT NULL,
                message TEXT,
                image_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 4. Update payments table to include service_type if not exists
        // Note: MySQL might throw error if column exists, so we check first or use a try-catch
        try {
            await db.execute('ALTER TABLE payments ADD COLUMN service_type VARCHAR(50) DEFAULT "general"');
            console.log("Added service_type to payments table.");
        } catch (e) {
            console.log("service_type column already exists or failed to add.");
        }

        console.log("Tables created successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error creating tables:", error);
        process.exit(1);
    }
}

createTables();
