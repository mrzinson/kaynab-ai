const db = require('../config/db');

async function test() {
  try {
    const [users] = await db.execute('SELECT id, name, username, country, region_state, gender FROM users ORDER BY id DESC LIMIT 5');
    console.log("LAST 5 USERS:");
    console.log(JSON.stringify(users, null, 2));

    const [books] = await db.execute('SELECT id, title, country, region_state FROM books LIMIT 10');
    console.log("BOOKS SAMPLES:");
    console.log(JSON.stringify(books, null, 2));

    const [exams] = await db.execute('SELECT id, title, country, region_state FROM exams LIMIT 10');
    console.log("EXAMS SAMPLES:");
    console.log(JSON.stringify(exams, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
