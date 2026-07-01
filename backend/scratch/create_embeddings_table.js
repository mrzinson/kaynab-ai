const db = require('../config/db');

async function createEmbeddingsTable() {
    try {
        console.log("Creating book_embeddings table...");
        
        // Dropping the table if it exists (for safety during development)
        // await db.execute('DROP TABLE IF EXISTS book_embeddings');

        const query = `
            CREATE TABLE IF NOT EXISTS book_embeddings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                source_id INT NOT NULL,
                source_type ENUM('book', 'exam') NOT NULL,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                chunk_index INT NOT NULL,
                chunk_text TEXT NOT NULL,
                embedding JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await db.execute(query);
        console.log("book_embeddings table created successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error creating table:", e);
        process.exit(1);
    }
}

createEmbeddingsTable();
