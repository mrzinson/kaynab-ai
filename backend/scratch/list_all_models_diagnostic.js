require('dotenv').config({ path: '../.env' });

async function listAll() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        const names = data.models.map(m => m.name);
        console.log("Model Names:", names.filter(n => n.includes('gemini') || n.includes('flash') || n.includes('pro')));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
listAll();
