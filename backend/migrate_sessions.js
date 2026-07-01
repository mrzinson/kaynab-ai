const db = require('./config/db');

async function migrate() {
    try {
        console.log("Starting migration...");

        // 1. Create chat_sessions table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) DEFAULT 'New Chat',
                is_training_enabled BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'chat_sessions' created.");

        // 2. Add session_id to messages_private if not exists
        try {
            await db.execute(`ALTER TABLE messages_private ADD COLUMN session_id INT`);
            console.log("Column 'session_id' added to 'messages_private'.");
        } catch (e) {
            console.log("Column 'session_id' might already exist.");
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
