const db = require('../config/db');

async function clearTestData() {
    try {
        console.log("De-activating tournament in tournament_settings...");
        await db.execute('UPDATE tournament_settings SET is_active = 0 WHERE id = 1');
        console.log("✅ Tournament deactivated (is_active = 0).");

        console.log("Clearing all test attempts from quiz_attempts...");
        await db.execute('DELETE FROM quiz_attempts');
        console.log("✅ Quiz attempts cleared.");

        console.log("Resetting all users XP to 0...");
        await db.execute('UPDATE users SET xp = 0');
        console.log("✅ All user XP reset to 0.");

        console.log("Cleanup complete!");
        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

clearTestData();
