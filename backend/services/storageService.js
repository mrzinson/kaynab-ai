const s3Service = require('./s3Service');
const cloudinaryService = require('./cloudinaryService');
const path = require('path');

const isS3Configured = s3Service.isConfigured;
const isCloudinaryConfigured = cloudinaryService.isConfigured;

/**
 * Uploads a local file to the best available cloud storage or falls back to local storage.
 * @param {string} localPath - Absolute path to local file on disk
 * @param {string} folder - Target folder/category (e.g. 'exams_pdfs', 'exams_images')
 * @param {boolean} deleteLocal - Whether to delete local temp file on success
 * @returns {Promise<string>} - Public cloud URL or relative local path
 */
async function uploadFile(localPath, folder = 'general', deleteLocal = true) {
    const filename = path.basename(localPath);
    const relativeUrl = localPath.includes('uploads') 
        ? localPath.substring(localPath.indexOf('/uploads')).replace(/\\/g, '/')
        : `/uploads/${filename}`;

    // 1. Try S3 first if configured (best for large PDFs and files of any size)
    if (isS3Configured) {
        try {
            return await s3Service.uploadLocalFile(localPath, folder, deleteLocal);
        } catch (error) {
            console.error('[Storage Service S3 Upload Failed, falling back]:', error.message);
        }
    }

    // 2. Try Cloudinary if S3 is not configured
    if (isCloudinaryConfigured) {
        try {
            // NOTE: Cloudinary has a 10MB limit for raw/PDF uploads in free tier
            return await cloudinaryService.uploadLocalFile(localPath, folder, deleteLocal);
        } catch (error) {
            console.error('[Storage Service Cloudinary Upload Failed, falling back]:', error.message);
        }
    }

    // 3. Fallback to local storage (file remains on disk, return relative url)
    return relativeUrl;
}

/**
 * Uploads a base64 image to the best available cloud storage.
 * @param {string} base64String - Base64 image data
 * @param {string} folder - Target folder/category (e.g. 'profiles', 'chats')
 * @returns {Promise<string|null>} - Public cloud URL or null (forces local fallback)
 */
async function uploadBase64(base64String, folder = 'general') {
    // 1. Try S3 first
    if (isS3Configured) {
        try {
            const url = await s3Service.uploadBase64(base64String, folder);
            if (url) return url;
        } catch (error) {
            console.error('[Storage Service S3 Base64 Upload Failed]:', error.message);
        }
    }

    // 2. Try Cloudinary
    if (isCloudinaryConfigured) {
        try {
            const url = await cloudinaryService.uploadBase64(base64String, folder);
            if (url) return url;
        } catch (error) {
            console.error('[Storage Service Cloudinary Base64 Upload Failed]:', error.message);
        }
    }

    return null;
}

module.exports = {
    isConfigured: isS3Configured || isCloudinaryConfigured,
    uploadFile,
    uploadBase64
};
