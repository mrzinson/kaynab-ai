const aiService = require('./services/aiService');
require('dotenv').config();

async function test() {
    try {
        console.log("Testing OpenAI...");
        const openAiRes = await aiService.askOpenAI("Hello, who are you?");
        console.log("OpenAI Response:", openAiRes);
    } catch (e) {
        console.error("OpenAI Test Failed:", e.message);
    }

    try {
        console.log("Testing Gemini...");
        const geminiRes = await aiService.askGemini("Hello, who are you?");
        console.log("Gemini Response:", geminiRes);
    } catch (e) {
        console.error("Gemini Test Failed:", e.message);
    }
}

test();
