const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testSpeed() {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });
    
    console.log('Testing response speed with gemini-3.1-flash-lite...\n');
    
    for (let i = 1; i <= 3; i++) {
        try {
            const start = Date.now();
            const result = await model.generateContent('Su\'aal: Maxaa caawin kara ardayda Soomaalida?');
            const response = await result.response;
            const duration = Date.now() - start;
            console.log(`Test ${i}: ${duration}ms`);
            console.log(`Response: "${response.text().trim().substring(0, 100)}..."`);
            console.log();
        } catch (err) {
            console.log(`Test ${i} FAILED: ${err.message}`);
        }
    }
}

testSpeed();
