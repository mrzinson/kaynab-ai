const db = require('./config/db');

async function updateWhisperLogs() {
    try {
        console.log('[DB UPDATE] Updating whisper-1 model names to gemini-1.5-flash...');
        const [result] = await db.query(
            "UPDATE ai_usage_logs SET model_name = 'gemini-1.5-flash' WHERE model_name = 'whisper-1'"
        );
        console.log(`[DB UPDATE] Success! Updated ${result.affectedRows} log records.`);
        process.exit(0);
    } catch (err) {
        console.error('[DB UPDATE ERROR]:', err);
        process.exit(1);
    }
}

updateWhisperLogs();
