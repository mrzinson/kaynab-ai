const db = require('../config/db');

async function checkData() {
    try {
        const [exams] = await db.execute('SELECT * FROM exams LIMIT 5');
        console.log("Exams:", JSON.stringify(exams, null, 2));
        const [books] = await db.execute('SELECT * FROM books LIMIT 5');
        console.log("Books:", JSON.stringify(books, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkData();
