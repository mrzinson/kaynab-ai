require('dotenv').config({ path: '../.env' });
const db = require('../config/db');

async function benchmark() {
    try {
        console.log("Warming up connection pool...");
        // Run a warm up query
        await db.execute('SELECT 1');
        console.log("Warm up done.");

        const userId = 11; // test user

        // Run sequential benchmark 5 times
        console.log("\n--- RUNNING SEQUENTIAL (5 iterations) ---");
        let totalSeq = 0;
        for (let i = 0; i < 5; i++) {
            const startSeq = Date.now();
            const [wallet1] = await db.execute('SELECT balance, last_updated FROM user_wallet WHERE user_id = ?', [userId]);
            const [sub1] = await db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId]);
            const duration = Date.now() - startSeq;
            console.log(`Iteration ${i + 1}: ${duration} ms`);
            totalSeq += duration;
        }
        console.log(`Average Sequential: ${totalSeq / 5} ms`);

        // Run parallel benchmark 5 times
        console.log("\n--- RUNNING PARALLEL (5 iterations) ---");
        let totalPar = 0;
        for (let i = 0; i < 5; i++) {
            const startPar = Date.now();
            const [walletRes, subRes] = await Promise.all([
                db.execute('SELECT balance, last_updated FROM user_wallet WHERE user_id = ?', [userId]),
                db.execute('SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW()', [userId])
            ]);
            const duration = Date.now() - startPar;
            console.log(`Iteration ${i + 1}: ${duration} ms`);
            totalPar += duration;
        }
        console.log(`Average Parallel: ${totalPar / 5} ms`);

        process.exit(0);
    } catch (err) {
        console.error("Benchmark failed:", err);
        process.exit(1);
    }
}

benchmark();
