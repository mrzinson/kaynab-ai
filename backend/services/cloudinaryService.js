const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

const isConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('[Cloudinary] Configured successfully.');
} else {
    console.log('[Cloudinary] Cloudinary is NOT configured. Using local storage fallback.');
}

/**
 * Uploads a local file to Cloudinary and deletes it locally (optional).
 * @param {string} localPath - Absolute path to local file on disk
 * @param {string} folder - Folder name in Cloudinary (e.g. 'exams', 'books', 'chats')
 * @param {boolean} deleteLocal - Whether to delete the local file after uploading
 * @returns {Promise<string>} - Cloudinary URL or local path relative to root
 */
async function uploadLocalFile(localPath, folder = 'darkpen', deleteLocal = true) {
    const filename = path.basename(localPath);
    // Determine local relative URL fallback
    const relativeUrl = localPath.includes('uploads') 
        ? localPath.substring(localPath.indexOf('/uploads')).replace(/\\/g, '/')
        : `/uploads/${filename}`;

    if (!isConfigured) {
        return relativeUrl;
    }

    try {
        console.log(`[Cloudinary] Uploading file: ${filename} to folder: ${folder}...`);
        const result = await cloudinary.uploader.upload(localPath, {
            folder: `darkpen/${folder}`,
            resource_type: 'auto'
        });
        
        console.log(`[Cloudinary] Upload success: ${result.secure_url}`);
        
        if (deleteLocal) {
            fs.unlink(localPath, (err) => {
                if (err) console.error(`[Cloudinary Cleanup Error] Failed to delete local temp file: ${localPath}`, err.message);
                else console.log(`[Cloudinary Cleanup] Deleted local temp file: ${localPath}`);
            });
        }
        
        return result.secure_url;
    } catch (error) {
        console.error('[Cloudinary Upload Error] Failed to upload, falling back to local path:', error);
        return relativeUrl;
    }
}

/**
 * Uploads a base64 image string directly to Cloudinary.
 * @param {string} base64String - Base64 image data
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<string|null>} - Cloudinary URL or null
 */
async function uploadBase64(base64String, folder = 'darkpen') {
    if (!isConfigured) {
        return null;
    }

    try {
        const result = await cloudinary.uploader.upload(base64String, {
            folder: `darkpen/${folder}`,
            resource_type: 'image'
        });
        return result.secure_url;
    } catch (error) {
        console.error('[Cloudinary Base64 Upload Error]:', error);
        return null;
    }
}

module.exports = {
    isConfigured,
    uploadLocalFile,
    uploadBase64
};
