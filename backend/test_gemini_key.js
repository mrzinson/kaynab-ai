// Test script - run this on Render shell or locally to test API key
// Usage: node test_gemini_key.js YOUR_API_KEY_HERE
const apiKey = process.argv[2] || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('❌ No API key provided!');
    console.error('Usage: node test_gemini_key.js YOUR_API_KEY_HERE');
    process.exit(1);
}

console.log(`🔑 Testing API key: ${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`);
console.log('🌐 Sending request to Gemini API...\n');

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Say hello in one word' }] }]
    })
})
.then(async res => {
    const body = await res.text();
    if (res.ok) {
        const data = JSON.parse(body);
        console.log('✅ API KEY IS WORKING!');
        console.log('Response:', data.candidates?.[0]?.content?.parts?.[0]?.text);
    } else {
        console.error(`❌ API FAILED with status ${res.status} ${res.statusText}`);
        console.error('Error body:', body);
        
        if (res.status === 403) {
            console.error('\n📋 POSSIBLE CAUSES:');
            console.error('1. API key is invalid or expired');
            console.error('2. Generative Language API is not enabled in your Google Cloud project');
            console.error('   → Fix: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/overview');
            console.error('3. API key has IP/referrer restrictions');
            console.error('   → Fix: https://console.cloud.google.com/apis/credentials');
        }
    }
})
.catch(err => {
    console.error('❌ Network error:', err.message);
});
