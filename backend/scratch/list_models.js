require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log("Models:", data.models.filter(m => m.name.includes('embed')).map(m => m.name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
listModels();
