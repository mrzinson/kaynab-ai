const db = require('../config/db');

/**
 * Free Trial Limits:
 * - 2 free image analyses per user (lifetime)
 * - 10 free text messages per user (lifetime)
 * 
 * Returns true if the usage was allowed (within free trial),
 * returns false if the free trial is exhausted.
 */
const FREE_TEXT_LIMIT = 10;
const FREE_IMAGE_LIMIT = 2;

async function tryUseFreeAI(userId, type = 'text', cost = 1) {
    try {
        // Ensure the user record exists
        await db.execute(
            'INSERT INTO user_free_ai_usage (user_id, free_text_used, free_image_used) VALUES (?, 0, 0) ON DUPLICATE KEY UPDATE user_id = user_id',
            [userId]
        );

        // Get current usage
        const [rows] = await db.execute(
            'SELECT free_text_used, free_image_used FROM user_free_ai_usage WHERE user_id = ?',
            [userId]
        );

        if (!rows || rows.length === 0) {
            return false;
        }

        const { free_text_used, free_image_used } = rows[0];

        if (type === 'image') {
            // Check if the user still has free image uses left
            if (free_image_used >= FREE_IMAGE_LIMIT) {
                console.log(`[FREE TRIAL] User ${userId} has exhausted free image limit (${free_image_used}/${FREE_IMAGE_LIMIT})`);
                return false;
            }

            // Deduct one free image use
            await db.execute(
                'UPDATE user_free_ai_usage SET free_image_used = free_image_used + 1, updated_at = NOW() WHERE user_id = ?',
                [userId]
            );
            console.log(`[FREE TRIAL] User ${userId} used free image ${free_image_used + 1}/${FREE_IMAGE_LIMIT}`);
            return true;

        } else {
            // type === 'text'
            // Check if the user still has free text messages left
            if (free_text_used >= FREE_TEXT_LIMIT) {
                console.log(`[FREE TRIAL] User ${userId} has exhausted free text limit (${free_text_used}/${FREE_TEXT_LIMIT})`);
                return false;
            }

            // Deduct one free text use
            await db.execute(
                'UPDATE user_free_ai_usage SET free_text_used = free_text_used + 1, updated_at = NOW() WHERE user_id = ?',
                [userId]
            );
            console.log(`[FREE TRIAL] User ${userId} used free text ${free_text_used + 1}/${FREE_TEXT_LIMIT}`);
            return true;
        }

    } catch (err) {
        console.error('[FREE TRIAL] Error in tryUseFreeAI:', err.message);
        // On DB error, do NOT grant free usage to prevent abuse
        return false;
    }
}

/**
 * Get current free usage stats for a user.
 * Returns { textUsed, textLimit, imageUsed, imageLimit, textRemaining, imageRemaining }
 */
async function getFreeUsageStats(userId) {
    try {
        await db.execute(
            'INSERT INTO user_free_ai_usage (user_id, free_text_used, free_image_used) VALUES (?, 0, 0) ON DUPLICATE KEY UPDATE user_id = user_id',
            [userId]
        );

        const [rows] = await db.execute(
            'SELECT free_text_used, free_image_used FROM user_free_ai_usage WHERE user_id = ?',
            [userId]
        );

        if (!rows || rows.length === 0) {
            return {
                textUsed: 0,
                textLimit: FREE_TEXT_LIMIT,
                imageUsed: 0,
                imageLimit: FREE_IMAGE_LIMIT,
                textRemaining: FREE_TEXT_LIMIT,
                imageRemaining: FREE_IMAGE_LIMIT,
            };
        }

        const { free_text_used, free_image_used } = rows[0];
        return {
            textUsed: free_text_used,
            textLimit: FREE_TEXT_LIMIT,
            imageUsed: free_image_used,
            imageLimit: FREE_IMAGE_LIMIT,
            textRemaining: Math.max(0, FREE_TEXT_LIMIT - free_text_used),
            imageRemaining: Math.max(0, FREE_IMAGE_LIMIT - free_image_used),
        };
    } catch (err) {
        console.error('[FREE TRIAL] Error in getFreeUsageStats:', err.message);
        return null;
    }
}

module.exports = { tryUseFreeAI, getFreeUsageStats, FREE_TEXT_LIMIT, FREE_IMAGE_LIMIT };
