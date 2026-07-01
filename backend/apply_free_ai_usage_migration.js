const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_free_ai_usage (
                user_id INT PRIMARY KEY,
                free_text_used INT NOT NULL DEFAULT 0,
                free_image_used INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('Ensured user_free_ai_usage table exists');
        console.log('Free AI usage migration completed.');
    } finally {
        await connection.end();
    }
}

run().catch((error) => {
    console.error('Free AI usage migration failed:', error.message);
    process.exit(1);
});
