require('dotenv').config({ path: '../.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "undefined");

const genAI = new GoogleGenerativeAI(apiKey);

async function testStream() {
    try {
        console.log("Calling getGenerativeModel for gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: "You are a helpful assistant."
        });
        
        console.log("Calling generateContentStream...");
        const result = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text: "Hello" }] }]
        });
        
        console.log("Reading stream...");
        for await (const chunk of result.stream) {
            console.log("Chunk:", chunk.text());
        }
        console.log("Stream finished successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Error encountered:", e);
        process.exit(1);
    }
}
testStream();
