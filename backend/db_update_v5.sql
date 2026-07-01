-- Play Store Readiness Audit - Database Scalability Updates
-- Adds indexes to heavily queried columns to prevent full table scans when the app scales.

-- 1. Index for fast chat history retrieval based on session and time
CREATE INDEX IF NOT EXISTS idx_messages_private_user_session ON messages_private (user_id, session_id, created_at);

-- 2. Index for group messages timeline
CREATE INDEX IF NOT EXISTS idx_messages_group_school_class ON messages_group (school_id, class_id, created_at);

-- 3. Index for user wallet balance queries (used on every chat request)
-- (user_id is already PRIMARY KEY in user_wallet, so we don't need a separate index, but if shukaansi_wallet exists, we should ensure it's indexed)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
