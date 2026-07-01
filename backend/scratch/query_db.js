const db = require('../config/db');

async function checkDb() {
    try {
        console.log("Checking DB Connection and querying tables...");
        const [books] = await db.execute('SELECT * FROM books');
        console.log(`Books in DB: ${books.length}`);
        console.log(JSON.stringify(books.slice(0, 5), null, 2));

        const [exams] = await db.execute('SELECT * FROM exams');
        console.log(`Exams in DB: ${exams.length}`);
        console.log(JSON.stringify(exams.slice(0, 5), null, 2));

        process.exit(0);
    } catch (error) {
        console.error("Error querying DB:", error);
        process.exit(1);
    }
}

checkDb();
