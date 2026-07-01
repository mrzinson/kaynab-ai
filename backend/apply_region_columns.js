const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  console.log('Starting migration to add country and region_state columns...');

  try {
    // 1. Add country and region_state to users
    try {
      await connection.query('ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL AFTER gender');
      console.log('Added country column to users table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('country column already exists in users table');
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE users ADD COLUMN region_state VARCHAR(100) NULL AFTER country');
      console.log('Added region_state column to users table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('region_state column already exists in users table');
      } else {
        throw e;
      }
    }

    // 2. Add country and region_state to exams
    try {
      await connection.query('ALTER TABLE exams ADD COLUMN country VARCHAR(100) NULL');
      console.log('Added country column to exams table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('country column already exists in exams table');
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE exams ADD COLUMN region_state VARCHAR(100) NULL');
      console.log('Added region_state column to exams table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('region_state column already exists in exams table');
      } else {
        throw e;
      }
    }

    // 3. Add country and region_state to books
    try {
      await connection.query('ALTER TABLE books ADD COLUMN country VARCHAR(100) NULL');
      console.log('Added country column to books table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('country column already exists in books table');
      } else {
        throw e;
      }
    }

    try {
      await connection.query('ALTER TABLE books ADD COLUMN region_state VARCHAR(100) NULL');
      console.log('Added region_state column to books table');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('region_state column already exists in books table');
      } else {
        throw e;
      }
    }

    // 4. Default existing exams and books to Somaliland
    await connection.query("UPDATE exams SET country = 'Somaliland' WHERE country IS NULL");
    await connection.query("UPDATE books SET country = 'Somaliland' WHERE country IS NULL");
    console.log("Updated existing books and exams to default country = 'Somaliland'");

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await connection.end();
  }
}

run();
