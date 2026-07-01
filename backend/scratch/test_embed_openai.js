require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function testEmbedding() {
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: "Waa maxay RAG?"
        });
        console.log("Embedding length:", response.data[0].embedding.length);
        console.log("First 3 values:", response.data[0].embedding.slice(0, 3));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testEmbedding();
