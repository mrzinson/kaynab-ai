const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Test the fastest ones from list
const modelsToTest = [
    'gemini-2.0-flash-lite-001',
    'gemini-2.0-flash-001',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite',
];

async function testAll() {
    for (const modelName of modelsToTest) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const start = Date.now();
            const result = await model.generateContent('Say hi in one word.');
            const text = (await result.response).text().trim();
            const ms = Date.now() - start;
            console.log(`✅ ${modelName}: ${ms}ms → "${text.substring(0,50)}"`);
        } catch (err) {
            console.log(`❌ ${modelName}: ${err.message.substring(0, 80)}`);
        }
    }
}

testAll();
