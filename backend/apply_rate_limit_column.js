const db = require('./config/db');

async function main() {
    try {
        console.log('[MIGRATION] Starting rate limit column migration...');
        
        // 1. Check if column exists, if not add it
        const [columns] = await db.query("SHOW COLUMNS FROM users LIKE 'rate_limit_blocked_until'");
        if (columns.length === 0) {
            console.log('[MIGRATION] Adding rate_limit_blocked_until column...');
            await db.query("ALTER TABLE users ADD COLUMN rate_limit_blocked_until TIMESTAMP NULL AFTER is_suspended");
            console.log('[MIGRATION] Column rate_limit_blocked_until added successfully.');
        } else {
            console.log('[MIGRATION] Column rate_limit_blocked_until already exists.');
        }
        
        console.log('[MIGRATION] Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[MIGRATION] Error:', err.message);
        process.exit(1);
    }
}

main();
