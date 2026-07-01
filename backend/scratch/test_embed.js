require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testEmbedding() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
        // The method is embedContent, wait, actually let's try text-embedding-004 first? No, list_models showed gemini-embedding-2
        const result = await model.embedContent("Waa maxay RAG?");
        console.log("Embedding length:", result.embedding.values.length);
        console.log("First 3 values:", result.embedding.values.slice(0, 3));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testEmbedding();
