const db = require('./config/db');
const fs = require('fs');
const path = require('path');

async function applyUpdate() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'db_update_v4.sql'), 'utf8');
        const commands = sql.split(';').filter(cmd => cmd.trim() !== '');
        
        for (let cmd of commands) {
            console.log(`Executing: ${cmd.trim()}...`);
            await db.execute(cmd);
        }
        
        console.log('Database update v4 applied successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error applying database update:', err);
        process.exit(1);
    }
}

applyUpdate();
