const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function init() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });
    
    console.log('Reading database.sql...');
    let sql = fs.readFileSync('database.sql', 'utf8');
    
    // Remote hostinger databases usually don't allow creating a database named 'ai_chat_app' when you're already in a user DB.
    // So we remove CREATE DATABASE and USE statements to just create the tables in the existing DB.
    sql = sql.replace(/CREATE DATABASE IF NOT EXISTS ai_chat_app;/g, '');
    sql = sql.replace(/USE ai_chat_app;/g, '');
    
    console.log('Executing SQL statements...');
    await connection.query(sql);
    console.log('Database tables created successfully!');
    
    await connection.end();
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

init();
