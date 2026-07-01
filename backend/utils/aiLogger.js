const db = require('../config/db');

/**
 * Log AI usage to ai_usage_logs table.
 * @param {number} userId - The user ID
 * @param {string} modelName - The AI model name used
 * @param {string} prompt - The user's prompt/message
 * @param {string} completion - The AI's response
 * @param {string} chatType - The chat type ('education', 'shukaansi', 'image', etc.)
 */
async function logAIUsage(userId, modelName, prompt, completion, chatType = 'education') {
    try {
        // Estimate token counts (rough estimation: 1 token ≈ 4 characters)
        const promptTokens = Math.ceil((prompt || '').length / 4);
        const completionTokens = Math.ceil((completion || '').length / 4);

        // Cost estimation (in USD):
        // gemini-2.5-flash: ~$0.00001875 per 1k prompt tokens, ~$0.000075 per 1k completion tokens
        // For simplicity, use a flat cost per credit deduction
        const cost = (promptTokens + completionTokens) / 1000 * 0.005;

        await db.execute(
            `INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, modelName, promptTokens, completionTokens, cost, chatType]
        );
    } catch (err) {
        // Non-critical: log error but don't crash the app
        console.error('[AI Logger Error]', err.message);
    }
}

module.exports = { logAIUsage };
