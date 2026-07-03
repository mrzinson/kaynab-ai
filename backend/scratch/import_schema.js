const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const config = {
    host: '31.97.2.37',
    user: 'u909186836_kaynabAi',
    password: 'H.zinson.11',
    database: 'u909186836_kaynabAi',
    port: 3306,
    multipleStatements: true,
    connectTimeout: 30000,
};

async function importSchema() {
    let connection;
    try {
        console.log('🔌 Connecting to Hostinger MySQL...');
        connection = await mysql.createConnection(config);
        console.log('✅ Connected successfully!\n');

        const schemaPath = path.join(__dirname, '..', 'kaynab_full_schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📦 Importing schema...');
        await connection.query(sql);
        console.log('✅ Schema imported successfully!\n');

        // Verify tables created
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`📊 Tables created (${tables.length} total):`);
        tables.forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`   ✔ ${tableName}`);
        });

        console.log('\n🎉 Database setup complete! Kaynab AI is ready.');
    } catch (err) {
        console.error('❌ Error:', err.message);
        if (err.code) console.error('   Code:', err.code);
    } finally {
        if (connection) await connection.end();
    }
}

importSchema();
