const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        await connection.query("ALTER TABLE users MODIFY payment_status ENUM('pending', 'approved', 'rejected') NULL DEFAULT NULL");
        console.log('Made users.payment_status optional by default');

        const [result] = await connection.query(`
            UPDATE users u
            SET u.payment_status = NULL,
                u.payment_reference = NULL
            WHERE u.payment_status = 'pending'
              AND NOT EXISTS (
                  SELECT 1
                  FROM payments p
                  WHERE p.user_id = u.id
                    AND p.status = 'pending'
              )
        `);
        console.log(`Cleared false pending status from ${result.affectedRows} users`);

        console.log('Payment status migration completed.');
    } finally {
        await connection.end();
    }
}

run().catch((error) => {
    console.error('Payment status migration failed:', error.message);
    process.exit(1);
});
