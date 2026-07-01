const path = require('path');
const fs = require('fs');
const storageService = require('../services/storageService');

/**
 * Save a base64 image string to disk or cloud storage.
 * @param {string} base64Str - The full data URL or raw base64 string
 * @param {string} folder - Subfolder to save into (e.g. 'chats', 'groups', 'screenshots')
 * @returns {string} The saved URL or file path
 */
async function saveBase64Image(base64Str, folder = 'uploads') {
    try {
        if (!base64Str) return null;

        // Strip the data URL prefix if present
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let base64Data = base64Str;

        if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
        }

        // Determine extension from mime type
        const ext = mimeType.split('/')[1] || 'jpg';

        // Create a temp file path in the uploads directory
        const uploadDir = path.join(__dirname, '..', 'uploads', folder);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const localFilePath = path.join(uploadDir, fileName);

        // Write base64 to disk
        fs.writeFileSync(localFilePath, Buffer.from(base64Data, 'base64'));

        // Upload to cloud storage (S3/Cloudinary/etc.) and return URL
        try {
            const uploadedUrl = await storageService.uploadFile(localFilePath, folder, true);
            return uploadedUrl;
        } catch (uploadErr) {
            console.error('[fileHelper] Cloud upload failed, using local path:', uploadErr.message);
            // Fallback: return local relative path
            return `/uploads/${folder}/${fileName}`;
        }
    } catch (err) {
        console.error('[fileHelper] saveBase64Image error:', err.message);
        return null;
    }
}

module.exports = { saveBase64Image };
