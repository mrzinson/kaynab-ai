const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function run() {
    console.log('Connecting to database...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('1. Modifying role enum in users table...');
        // We alter the role column to support 'superadmin'
        try {
            await connection.query(`
                ALTER TABLE users MODIFY COLUMN role ENUM('student', 'user', 'admin', 'superadmin') DEFAULT 'user'
            `);
            console.log('✅ Modified role column successfully');
        } catch (e) {
            console.log('⚠️ Could not modify role enum (might already be modified):', e.message);
        }

        console.log('2. Creating ai_usage_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ai_usage_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                model_name VARCHAR(100) NOT NULL,
                prompt_tokens INT NOT NULL,
                completion_tokens INT NOT NULL,
                cost DECIMAL(10, 6) NOT NULL,
                chat_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created ai_usage_logs table');

        console.log('3. Creating admin_logs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id INT NOT NULL,
                action_type VARCHAR(100) NOT NULL,
                details TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Created admin_logs table');

        console.log('4. Creating app_settings table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT NOT NULL
            )
        `);
        console.log('✅ Created app_settings table');

        console.log('5. Seeding default app settings...');
        const defaultSettings = [
            ['evc_number', '637930329'],
            ['edahab_number', '659119779'],
            ['payment_contact_whatsapp', '+252637930329'],
            ['payment_contact_email', 'team.darkpen@gmail.com'],
            ['monthly_plan_price', '3.00'],
            ['yearly_plan_price', '11.00'],
            ['credit_per_dollar', '200'],
            ['text_message_credit_cost', '1'],
            ['voice_message_credit_cost', '20'],
            ['image_generation_credit_cost', '10'],
            ['system_status', 'active']
        ];
        
        for (const [key, val] of defaultSettings) {
            await connection.query(
                `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE setting_value = setting_value`,
                [key, val]
            );
        }
        console.log('✅ App settings seeded');

        console.log('6. Seeding/updating Super Admin account...');
        const superAdminEmail = 'zinsonhamze@gmail.com';
        const superAdminPass = 'h.zinson.11';
        
        const [existingAdmins] = await connection.query(
            'SELECT id, password FROM users WHERE email = ?',
            [superAdminEmail]
        );

        if (existingAdmins.length === 0) {
            // Check by username as well
            const [existingByUname] = await connection.query(
                'SELECT id FROM users WHERE username = ?',
                ['zinson']
            );
            
            const username = existingByUname.length > 0 ? `zinson_${Date.now().toString().slice(-4)}` : 'zinson';
            const hashedPassword = await bcrypt.hash(superAdminPass, 12);
            
            await connection.query(
                `INSERT INTO users (name, username, email, password, role, is_verified) 
                 VALUES (?, ?, ?, ?, 'superadmin', TRUE)`,
                ['Hamze Mohamuud Ali Zinson', username, superAdminEmail, hashedPassword]
            );
            console.log('✅ Seeded new Super Admin account successfully');
        } else {
            const admin = existingAdmins[0];
            const hashedPassword = await bcrypt.hash(superAdminPass, 12);
            
            await connection.query(
                `UPDATE users SET role = 'superadmin', password = ?, is_suspended = 0 WHERE id = ?`,
                [hashedPassword, admin.id]
            );
            console.log('✅ Updated existing account to Super Admin with new password successfully');
        }

        console.log('7. Generating estimated historical AI usage logs for stats page...');
        // Let's check if there's any usage logs already to avoid duplication
        const [logCount] = await connection.query('SELECT COUNT(*) as count FROM ai_usage_logs');
        
        if (logCount[0].count === 0) {
            // Gather private messages counts to create estimated logs
            const [privMsgs] = await connection.query(`
                SELECT user_id, sender, LENGTH(message) as len, created_at 
                FROM messages_private 
                ORDER BY created_at ASC 
                LIMIT 500
            `);
            
            if (privMsgs.length > 0) {
                console.log(`Processing ${privMsgs.length} private messages...`);
                // Let's group them or just insert a log for each user or each request
                // To keep it simple, let's insert estimated logs in batches
                const logEntries = [];
                
                // Let's pair up user and ai messages
                let lastUserMsg = null;
                for (const msg of privMsgs) {
                    if (msg.sender === 'user') {
                        lastUserMsg = msg;
                    } else if (msg.sender === 'ai' && lastUserMsg && lastUserMsg.user_id === msg.user_id) {
                        const promptTokens = Math.max(5, Math.ceil(lastUserMsg.len / 4));
                        const completionTokens = Math.max(10, Math.ceil(msg.len / 4));
                        // Gemini Flash pricing: $0.000000075 / prompt token, $0.0000003 / completion token
                        const cost = (promptTokens * 0.000000075) + (completionTokens * 0.0000003);
                        
                        logEntries.push([
                            msg.user_id,
                            'gemini-flash-latest',
                            promptTokens,
                            completionTokens,
                            cost,
                            'education',
                            msg.created_at
                        ]);
                        lastUserMsg = null;
                    }
                }
                
                // Insert logs in chunks
                if (logEntries.length > 0) {
                    for (const entry of logEntries) {
                        await connection.query(
                            `INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type, created_at) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            entry
                        );
                    }
                    console.log(`✅ Seeded ${logEntries.length} historical AI usage log entries`);
                }
            } else {
                console.log('No private messages found to estimate historical logs.');
            }
        } else {
            console.log('AI usage logs already populated.');
        }

        console.log('🎉 All updates completed successfully!');

    } catch (e) {
        console.log('❌ Error applying migration:', e);
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
