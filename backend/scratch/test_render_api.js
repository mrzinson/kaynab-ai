const jwt = require('jsonwebtoken');
const https = require('https');

const JWT_SECRET = 'Darkpen@2026#SirvdwCulus!$Muraad';

// Let's generate a token for user ID 11
const token = jwt.sign({ id: 11 }, JWT_SECRET, { expiresIn: '1d' });
console.log("Generated Token:", token);

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'darkpen-backend.onrender.com',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function test() {
    try {
        console.log("Testing Render /api/user/books...");
        const resBooks = await makeRequest('/api/user/books');
        console.log("Books Status Code:", resBooks.statusCode);
        console.log("Books Body preview:", resBooks.body.slice(0, 500));

        console.log("Testing Render /api/user/exams...");
        const resExams = await makeRequest('/api/user/exams');
        console.log("Exams Status Code:", resExams.statusCode);
        console.log("Exams Body preview:", resExams.body.slice(0, 500));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
