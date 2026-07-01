require('dotenv').config();
const db = require('../config/db');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const { clearEmbeddingsCache } = require('./aiService');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function chunkText(text) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = i + CHUNK_SIZE;
        if (end > text.length) end = text.length;
        if (end < text.length) {
            let spaceIdx = text.lastIndexOf(' ', end);
            if (spaceIdx > i + CHUNK_SIZE / 2) end = spaceIdx;
        }
        chunks.push(text.slice(i, end).trim());
        i = end - CHUNK_OVERLAP;
        if (i < 0) break;
        if (end >= text.length) break;
    }
    return chunks;
}

/**
 * OCR extraction using Gemini 1.5 Flash
 */
async function extractTextWithGemini(filePath, fileName) {
    console.log(`[OCR] Bilaabaya akhrinta masawirada PDF-ka: ${fileName}`);
    try {
        // 1. Upload to Gemini File API
        const uploadResponse = await fileManager.uploadFile(filePath, {
            mimeType: "application/pdf",
            displayName: fileName,
        });

        console.log(`[OCR] Faylka waa la upload gareeyay: ${uploadResponse.file.name}`);

        // 2. Wait for processing (important for large files)
        let file = await fileManager.getFile(uploadResponse.file.name);
        while (file.state === "PROCESSING") {
            process.stdout.write(".");
            await new Promise((resolve) => setTimeout(resolve, 5000));
            file = await fileManager.getFile(uploadResponse.file.name);
        }

        if (file.state === "FAILED") {
            throw new Error("Gemini file processing failed.");
        }

        // 3. Extract text
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const prompt = "Please extract all text from this PDF. This is an educational book. Extract every lesson, title, and detailed content. Maintain the structure and language (Somali/Arabic/English). Return ONLY the extracted text.";
        
        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: file.mimeType,
                    fileUri: file.uri,
                },
            },
            { text: prompt },
        ]);

        const response = await result.response;
        const text = response.text();

        // 4. Cleanup (Delete file from Gemini servers)
        await fileManager.deleteFile(file.name);

        return text;
    } catch (error) {
        console.error(`[OCR Error] ${fileName}:`, error.message);
        return null;
    }
}

/**
 * Main Ingestion Function
 */
exports.ingestPDF = async (sourceId, sourceType, title, category, pdfPath, deleteAfterIngestion = false) => {
    const cleanUp = () => {
        if (deleteAfterIngestion && fs.existsSync(pdfPath)) {
            fs.unlink(pdfPath, (err) => {
                if (err) console.error(`[Ingestion Cleanup Error] Failed to delete temp file: ${pdfPath}`, err.message);
                else console.log(`[Ingestion Cleanup] Deleted local temp file: ${pdfPath}`);
            });
        }
    };

    try {
        if (!fs.existsSync(pdfPath)) {
            console.error(`Faylka lama helin: ${pdfPath}`);
            cleanUp();
            return;
        }

        const fileName = path.basename(pdfPath);
        console.log(`[Ingestion] Bilaabaya: ${title} (${fileName})`);

        // 1. Isku day extraction-ka caadiga ah (Fast)
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        let text = data.text.replace(/\s+/g, ' ').trim();

        // 2. Haddii qoraal la waayo (Scanned PDF), isticmaal OCR
        if (text.length < 100) {
            console.log(`[Ingestion] Qoraal yar ayaa la helay (${text.length} chars). Waxaan u wareegaynaa OCR mode...`);
            text = await extractTextWithGemini(pdfPath, fileName);
        }

        if (!text || text.length < 50) {
            console.error(`[Ingestion Failed] Qoraal lagama soo saari karo: ${title}`);
            cleanUp();
            return;
        }

        // 3. Chunking
        const chunks = chunkText(text);
        console.log(`[Ingestion] ${chunks.length} cutub ayaa la diyaariyay.`);

        // 4. Embedding & Database Save
        const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        
        // Tirtir xogtii hore ee file-kan haddii ay jirtay
        await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = ?', [sourceId, sourceType]);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`[Ingestion] Embedding chunk ${i+1}/${chunks.length}...`);
            const result = await embedModel.embedContent(chunk);
            const embedding = result.embedding.values;

            await db.execute(
                `INSERT INTO book_embeddings (source_id, source_type, title, category, chunk_index, chunk_text, embedding) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [sourceId, sourceType, title, category || 'General', i, chunk, JSON.stringify(embedding)]
            );
            
            // Sug 5 ilbiriqsi si looga fogaado 429 (Too Many Requests)
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log(`[Ingestion Success] ${title} waa la tababaray! 🎉`);
        clearEmbeddingsCache();
        cleanUp();
    } catch (error) {
        console.error(`[Ingestion Error] ${title}:`, error);
        cleanUp();
    }
};
