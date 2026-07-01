const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isConfigured = !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_BUCKET_NAME
);

let s3Client = null;

if (isConfigured) {
    try {
        s3Client = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
            },
            region: process.env.S3_REGION || 'auto',
            forcePathStyle: true // Standard for custom S3 compatible endpoints like Tebi, Backblaze B2, R2
        });
        console.log('[S3 Service] Configured successfully.');
    } catch (err) {
        console.error('[S3 Service Configuration Error]:', err.message);
    }
} else {
    console.log('[S3 Service] NOT configured. S3 cloud storage is disabled.');
}

/**
 * Returns the MIME type based on file extension.
 * @param {string} filePath - Path to file
 * @returns {string} - MIME type
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.pdf': return 'application/pdf';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.mp3': return 'audio/mpeg';
        case '.wav': return 'audio/wav';
        case '.m4a': return 'audio/mp4';
        default: return 'application/octet-stream';
    }
}

/**
 * Uploads a local file to S3 using multipart upload for performance and low RAM usage.
 * @param {string} localPath - Absolute path to local file on disk
 * @param {string} folder - Folder name in S3 bucket (e.g. 'exams_pdfs', 'exams_images')
 * @param {boolean} deleteLocal - Whether to delete the local file after uploading
 * @returns {Promise<string>} - Public S3 URL or relative local path fallback
 */
async function uploadLocalFile(localPath, folder = 'general', deleteLocal = true) {
    const filename = path.basename(localPath);
    const relativeUrl = localPath.includes('uploads') 
        ? localPath.substring(localPath.indexOf('/uploads')).replace(/\\/g, '/')
        : `/uploads/${filename}`;

    if (!isConfigured || !s3Client) {
        return relativeUrl;
    }

    // Generate a unique key to prevent file name collisions
    const fileKey = `${folder}/${Date.now()}-${filename}`;

    try {
        console.log(`[S3 Service] Uploading file: ${filename} to ${folder}...`);
        const fileStream = fs.createReadStream(localPath);
        const mimeType = getMimeType(localPath);

        const uploader = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: fileKey,
                Body: fileStream,
                ContentType: mimeType
            },
            queueSize: 4, // Number of concurrent uploads
            partSize: 1024 * 1024 * 5 // 5MB part size
        });

        await uploader.done();
        console.log(`[S3 Service] Upload complete: ${fileKey}`);

        // Handle Cleanup
        if (deleteLocal) {
            fs.unlink(localPath, (err) => {
                if (err) console.error(`[S3 Cleanup Error] Failed to delete local temp file: ${localPath}`, err.message);
                else console.log(`[S3 Cleanup] Deleted local temp file: ${localPath}`);
            });
        }

        // Return public URL
        if (process.env.S3_PUBLIC_URL) {
            const publicBase = process.env.S3_PUBLIC_URL.replace(/\/$/, '');
            return `${publicBase}/${fileKey}`;
        }

        // For private buckets, return a relative backend proxy download path
        return `/download?key=${encodeURIComponent(fileKey)}`;
    } catch (error) {
        console.error('[S3 Service Upload Error] Failed to upload, falling back to local path:', error);
        return relativeUrl;
    }
}

/**
 * Uploads a base64 image string to S3.
 * @param {string} base64String - Base64 image data
 * @param {string} folder - Folder name in S3 bucket
 * @returns {Promise<string|null>} - Public S3 URL or null
 */
async function uploadBase64(base64String, folder = 'general') {
    if (!isConfigured || !s3Client) {
        return null;
    }

    try {
        const parts = base64String.split(';base64,');
        if (parts.length !== 2) return null;

        const mimeType = parts[0].split(':')[1] || 'image/jpeg';
        const base64Data = parts[1];
        const extension = mimeType.split('/')[1] || 'jpg';
        const buffer = Buffer.from(base64Data, 'base64');

        const fileKey = `${folder}/${crypto.randomBytes(16).toString('hex')}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            Body: buffer,
            ContentType: mimeType
        });

        await s3Client.send(command);
        console.log(`[S3 Service] Base64 image upload complete: ${fileKey}`);

        // Return public URL
        if (process.env.S3_PUBLIC_URL) {
            const publicBase = process.env.S3_PUBLIC_URL.replace(/\/$/, '');
            return `${publicBase}/${fileKey}`;
        }

        // For private buckets, return a relative backend proxy download path
        return `/download?key=${encodeURIComponent(fileKey)}`;
    } catch (error) {
        console.error('[S3 Service Base64 Upload Error]:', error);
        return null;
    }
}

/**
 * Generates a pre-signed GET URL for a private file key.
 * @param {string} fileKey - The key of the file in the bucket
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string|null>} - Pre-signed URL or null
 */
async function getDownloadUrl(fileKey, expiresIn = 3600) {
    if (!isConfigured || !s3Client) {
        return null;
    }
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('[S3 Service Get Download URL Error]:', error);
        return null;
    }
}

module.exports = {
    isConfigured,
    uploadLocalFile,
    uploadBase64,
    getDownloadUrl
};
