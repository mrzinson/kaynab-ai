const mysql = require('mysql2/promise');
require('dotenv').config();

async function columnExists(connection, table, column) {
    const [rows] = await connection.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return rows.length > 0;
}

async function uniqueIndexOnColumnExists(connection, table, column) {
    const [rows] = await connection.query(
        `SELECT INDEX_NAME
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
           AND NON_UNIQUE = 0`,
        [table, column]
    );
    return rows.length > 0;
}

async function ensureColumn(connection, table, column, definition) {
    if (await columnExists(connection, table, column)) {
        console.log(`Column exists: ${table}.${column}`);
        return;
    }

    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Added column: ${table}.${column}`);
}

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        await connection.query('ALTER TABLE users MODIFY email VARCHAR(255) NULL');
        console.log('Made users.email optional');

        await ensureColumn(connection, 'users', 'username', 'VARCHAR(50) NULL');
        await connection.query("UPDATE users SET username = CONCAT('user', id) WHERE username IS NULL OR username = ''");
        await connection.query('ALTER TABLE users MODIFY username VARCHAR(50) NOT NULL');
        if (!(await uniqueIndexOnColumnExists(connection, 'users', 'username'))) {
            await connection.query('CREATE UNIQUE INDEX idx_users_username_unique ON users(username)');
            console.log('Added unique index on users.username');
        }

        await ensureColumn(connection, 'users', 'whatsapp_number', 'VARCHAR(32) NULL');
        await connection.query('ALTER TABLE users MODIFY whatsapp_number VARCHAR(32) NULL');
        if (!(await uniqueIndexOnColumnExists(connection, 'users', 'whatsapp_number'))) {
            await connection.query('CREATE UNIQUE INDEX idx_users_whatsapp_unique ON users(whatsapp_number)');
            console.log('Added unique index on users.whatsapp_number');
        }

        await ensureColumn(connection, 'users', 'terms_accepted_at', 'TIMESTAMP NULL');
        await ensureColumn(connection, 'users', 'verification_code', 'VARCHAR(10) NULL');
        await ensureColumn(connection, 'users', 'reset_code', 'VARCHAR(10) NULL');
        await ensureColumn(connection, 'users', 'reset_code_expires_at', 'TIMESTAMP NULL');
        await connection.query('ALTER TABLE users MODIFY is_verified BOOLEAN DEFAULT TRUE');
        await connection.query('UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE OR is_verified IS NULL');

        console.log('Phone auth migration completed.');
    } finally {
        await connection.end();
    }
}

run().catch((error) => {
    console.error('Phone auth migration failed:', error.message);
    process.exit(1);
});
