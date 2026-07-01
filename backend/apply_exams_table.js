const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    console.log('Isku xiraya Database-ka...');
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Abuuraya user_generated_exams table...');
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_generated_exams (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                subject VARCHAR(255) NOT NULL,
                grade VARCHAR(255) NOT NULL,
                topic VARCHAR(255) NOT NULL,
                pdf_url VARCHAR(255) NOT NULL,
                word_url VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Si guul leh loo abuuray user_generated_exams table');

    } catch(e) { 
        console.log('❌ Cilad guud:', e.message); 
    } finally {
        await connection.end();
    }
}

run().catch(console.error);
