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
    await connection.query("ALTER TABLE exams ADD COLUMN grade VARCHAR(100) NULL");
    console.log("Added grade column to exams table");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log("grade column already exists");
    else throw e;
  } finally {
    await connection.end();
  }
}
run();
