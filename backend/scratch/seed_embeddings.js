require('dotenv').config();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });

// Qaybaha qoraalka (Chunk size) waa 1000 xaraf
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function chunkText(text) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = i + CHUNK_SIZE;
        if (end > text.length) end = text.length;
        // Try to break at a space or newline
        if (end < text.length) {
            let spaceIdx = text.lastIndexOf(' ', end);
            if (spaceIdx > i + CHUNK_SIZE / 2) {
                end = spaceIdx;
            }
        }
        chunks.push(text.slice(i, end).trim());
        i = end - CHUNK_OVERLAP; // is-dulsaar (overlap) si fahamku uusan u go'in
        if (i < 0) break; 
        if (end >= text.length) break;
    }
    return chunks;
}

async function processFile(filePath, sourceId, sourceType, title, category) {
    if (!fs.existsSync(filePath)) {
        console.log(`Faylka lama helin: ${filePath}`);
        return;
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        const text = data.text.replace(/\s+/g, ' ').trim();
        
        if (!text) {
            console.log(`Qoraal lagama helin: ${title}`);
            return;
        }

        const chunks = chunkText(text);
        console.log(`   --> U qaybiyay ${chunks.length} cutub.`);

        for (let j = 0; j < chunks.length; j++) {
            const chunk = chunks[j];
            if (chunk.length < 50) continue; // Skip chunks that are too small

            const result = await embedModel.embedContent(chunk);
            const embedding = result.embedding.values;

            await db.execute(
                `INSERT INTO book_embeddings (source_id, source_type, title, category, chunk_index, chunk_text, embedding) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sourceId, sourceType, title, category || 'General', j, chunk, JSON.stringify(embedding)]
            );
        }
        console.log(`   --> Waa la dhammeeyay kaydinta ${title}`);
    } catch (err) {
        console.error(`Cilad ayaa ka dhacday akhrinta ${title}:`, err.message);
    }
}

async function seedEmbeddings() {
    try {
        console.log("Waxaan tirtiraynaa xogtii hore ee Embeddings-ka si looga hortago laba-laab (Duplicates)...");
        await db.execute('TRUNCATE TABLE book_embeddings');

        console.log("Waxaan soo akhrinaynaa Imtixaanaadka (Exams)...");
        const [exams] = await db.execute('SELECT * FROM exams WHERE pdf_url IS NOT NULL');
        for (const exam of exams) {
            console.log(`Falanqaynta Imtixaanka: ${exam.title}`);
            // pdf_url waa tusaale ahaan '/uploads/123.pdf'
            const filename = path.basename(exam.pdf_url);
            const filePath = path.join(__dirname, '..', 'uploads', filename);
            await processFile(filePath, exam.id, 'exam', exam.title, exam.category);
        }

        console.log("Waxaan soo akhrinaynaa Buugaagta (Books)...");
        const [books] = await db.execute('SELECT * FROM books WHERE pdf_url IS NOT NULL');
        for (const book of books) {
            console.log(`Falanqaynta Buugga: ${book.title}`);
            const filename = path.basename(book.pdf_url);
            const filePath = path.join(__dirname, '..', 'uploads', filename);
            await processFile(filePath, book.id, 'book', book.title, book.category);
        }

        console.log("=========================================");
        console.log("Tababarkii waa la soo dhammeeyay si guul ah! 🎉");
        process.exit(0);
    } catch (error) {
        console.error("Cilad weyn:", error);
        process.exit(1);
    }
}

seedEmbeddings();
