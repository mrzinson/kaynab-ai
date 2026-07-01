const db = require('./config/db');

async function main() {
    try {
        console.log('[MIGRATION] Starting migration...');
        
        // 1. Check if column exists, if not add it
        const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'whatsapp_jid'");
        if (columns.length === 0) {
            console.log('[MIGRATION] Adding whatsapp_jid column...');
            await db.query("ALTER TABLE users ADD COLUMN whatsapp_jid VARCHAR(64) NULL AFTER whatsapp_number");
            console.log('[MIGRATION] Column whatsapp_jid added successfully.');
        } else {
            console.log('[MIGRATION] Column whatsapp_jid already exists.');
        }
        
        // 2. Add an index to whatsapp_jid column for fast lookups
        const [indexes] = await db.query("SHOW INDEX FROM users WHERE Key_name = 'idx_users_whatsapp_jid'");
        if (indexes.length === 0) {
            console.log('[MIGRATION] Adding index idx_users_whatsapp_jid...');
            await db.query("CREATE INDEX idx_users_whatsapp_jid ON users(whatsapp_jid)");
            console.log('[MIGRATION] Index idx_users_whatsapp_jid created successfully.');
        } else {
            console.log('[MIGRATION] Index idx_users_whatsapp_jid already exists.');
        }
        
        // 3. For any existing users where whatsapp_jid is null and whatsapp_number is not null,
        // populate whatsapp_jid with whatsapp_number
        console.log('[MIGRATION] Populating whatsapp_jid for existing users...');
        const [result] = await db.query("UPDATE users SET whatsapp_jid = whatsapp_number WHERE whatsapp_jid IS NULL AND whatsapp_number IS NOT NULL");
        console.log(`[MIGRATION] Populated ${result.affectedRows} users.`);
        
        console.log('[MIGRATION] Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[MIGRATION] Error:', err.message);
        process.exit(1);
    }
}

main();
