const db = require('./config/db');

async function testExams() {
    try {
        const [rows] = await db.query("SELECT id, title, grade, category, country FROM exams");
        console.log('[DB EXAMS]:', JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('[DB EXAMS ERROR]:', err);
        process.exit(1);
    }
}

testExams();
