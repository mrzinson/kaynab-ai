require('dotenv').config();
const s3Service = require('./services/s3Service');
const fs = require('fs');
const path = require('path');

async function runTest() {
    console.log('--- S3/R2 Cloud Storage Verification ---');
    console.log('S3 Configured:', s3Service.isConfigured);
    
    if (!s3Service.isConfigured) {
        console.log('S3 is not configured in .env. Please add credentials.');
        console.log('Exiting test.');
        return;
    }

    const testDir = path.join(__dirname, 'uploads', 'test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

    const tempFilePath = path.join(testDir, 'test-file.txt');
    fs.writeFileSync(tempFilePath, 'This is a test file for S3-compatible cloud storage on Darkpen!');

    console.log('\n1. Testing local file upload...');
    try {
        const fileUrl = await s3Service.uploadLocalFile(tempFilePath, 'test_uploads', true);
        console.log('Success! Upload Result:', fileUrl);
        
        if (fileUrl && fileUrl.includes('key=')) {
            const urlParams = new URLSearchParams(fileUrl.split('?')[1]);
            const key = urlParams.get('key');
            console.log('Detected S3 Key:', key);
            const presignedUrl = await s3Service.getDownloadUrl(decodeURIComponent(key));
            console.log('Generated Presigned URL:', presignedUrl);
        } else {
            console.log('Direct URL (non-proxy):', fileUrl);
        }
    } catch (error) {
        console.error('File upload failed:', error);
    }

    console.log('\n2. Testing base64 image upload...');
    // Small 1x1 pixel base64 transparent GIF
    const dummyBase64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    try {
        const base64Url = await s3Service.uploadBase64(dummyBase64, 'test_base64');
        console.log('Success! Base64 Upload Result:', base64Url);
        
        if (base64Url && base64Url.includes('key=')) {
            const urlParams = new URLSearchParams(base64Url.split('?')[1]);
            const key = urlParams.get('key');
            console.log('Detected S3 Key for base64:', key);
            const presignedUrl = await s3Service.getDownloadUrl(decodeURIComponent(key));
            console.log('Generated Presigned URL for base64:', presignedUrl);
        }
    } catch (error) {
        console.error('Base64 upload failed:', error);
    }

    // Cleanup test folder if empty
    try {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        if (fs.existsSync(testDir)) {
            fs.rmdirSync(testDir);
        }
    } catch (e) {
        // ignore
    }
}

runTest();
