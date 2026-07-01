const db = require('./config/db');

async function migrate() {
    try {
        console.log("Starting WhatsApp Dashboard migrations...");

        // 1. Create whatsapp_group_stats table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_group_stats (
                group_id VARCHAR(100) PRIMARY KEY,
                group_name VARCHAR(255) NOT NULL,
                bot_message_count INT DEFAULT 0,
                bot_mention_count INT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'active',
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("Table 'whatsapp_group_stats' created.");

        // 2. Add platform column to ai_usage_logs if it doesn't exist
        try {
            await db.execute(`
                ALTER TABLE ai_usage_logs 
                ADD COLUMN platform VARCHAR(50) DEFAULT 'app'
            `);
            console.log("Column 'platform' added to 'ai_usage_logs'.");
        } catch (e) {
            console.log("Column 'platform' might already exist in 'ai_usage_logs'.");
        }

        // 3. Mark existing logs that are clearly WhatsApp-based
        // Usually, chat_type = 'voice' or 'image' logs from WhatsApp don't have session_id.
        // But we don't have session_id in ai_usage_logs. We can leave old logs as 'app' or keep them.

        console.log("WhatsApp Dashboard migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("WhatsApp Dashboard migration failed:", err);
        process.exit(1);
    }
}

migrate();
