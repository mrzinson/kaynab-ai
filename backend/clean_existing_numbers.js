const db = require('./config/db');

async function main() {
    try {
        console.log('[CLEANUP] Starting phone number cleanup...');

        // 1. Explicit updates for the known affected users
        const manualUpdates = [
            { id: 115, number: '+20595723784' },
            { id: 114, number: '+19966071513' },
            { id: 113, number: '+98046218113' },
            { id: 112, number: '+11418621864' },
            { id: 111, number: '+233212932563' },
            // ID 110 (Zhaafici) — skip because +252657437220 already exists on another user
            // ID 109 (Hamze mahmuud calu) — virtual USA number, leave as-is
            // ID 108 (Axmed cali faarax) — virtual USA number, leave as-is
        ];

        for (const update of manualUpdates) {
            // Check if target number is already taken
            const [existing] = await db.execute(
                'SELECT id FROM users WHERE whatsapp_number = ? AND id != ?',
                [update.number, update.id]
            );
            if (existing.length > 0) {
                console.warn(`[CLEANUP] Skipping user ID ${update.id}: number ${update.number} already taken by user ID ${existing[0].id}`);
                continue;
            }
            const [res] = await db.execute('UPDATE users SET whatsapp_number = ? WHERE id = ?', [update.number, update.id]);
            if (res.affectedRows > 0) {
                console.log(`[CLEANUP] Updated user ID ${update.id} to number: ${update.number}`);
            }
        }

        console.log('[CLEANUP] Phone number cleanup completed successfully.');
        
        // 2. Print final state of recently affected users
        const [users] = await db.execute(
            'SELECT id, name, whatsapp_number FROM users WHERE id IN (108, 109, 110, 111, 112, 113, 114, 115) ORDER BY id DESC'
        );
        console.log('\n[CLEANUP] Final state of affected users:');
        for (const u of users) {
            console.log(`  ID ${u.id}: ${u.name} -> ${u.whatsapp_number}`);
        }
    } catch (err) {
        console.error('[CLEANUP] Error during cleanup:', err.message);
    } finally {
        await db.end();
    }
}

main();
