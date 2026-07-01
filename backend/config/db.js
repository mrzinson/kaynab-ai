const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    // 100 connections: handles thousands of simultaneous users.
    // Each request holds a connection only for the duration of a single query (milliseconds).
    // mysql2's pool reuses connections, so 100 is enough for 1000+ concurrent users.
    connectionLimit: 100,
    queueLimit: 500,           // Max 500 requests waiting for a free connection slot
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    // Automatically ping idle connections to avoid 'server gone away' errors
    idleTimeout: 60000
});

const promisePool = pool.promise();

// Keep pool connections warm to eliminate cold startup database latency
setInterval(async () => {
    try {
        await promisePool.query('SELECT 1');
    } catch (err) {
        // Ignore normal transient network/socket errors during keep-alive pinging
        const silencedCodes = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ENETUNREACH', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE']);
        if (!silencedCodes.has(err.code)) {
            console.error('[DB Keep-Alive Error]:', err.message);
        }
    }
}, 15000);

const RETRYABLE_ERRORS = new Set([
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'ENETUNREACH',
    'ENOTFOUND',
    'PROTOCOL_CONNECTION_LOST'
]);

function shouldRetry(error) {
    return RETRYABLE_ERRORS.has(error?.code) || (error?.fatal && error?.syscall === 'read');
}

async function withRetry(action, label) {
    try {
        return await action();
    } catch (error) {
        if (!shouldRetry(error)) {
            throw error;
        }

        console.warn(`[DB] ${label} failed with ${error.code || error.message}; retrying once.`);
        return action();
    }
}

module.exports = {
    execute: (...args) => withRetry(() => promisePool.execute(...args), 'execute'),
    query: (...args) => withRetry(() => promisePool.query(...args), 'query'),
    getConnection: () => withRetry(() => promisePool.getConnection(), 'getConnection'),
    end: (...args) => promisePool.end(...args),
};
