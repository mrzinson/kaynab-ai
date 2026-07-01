-- ============================================================
-- DB Update v11: Quiz Security & Performance Enhancements
-- ============================================================

-- 1. Add quiz_answers table to store submitted answers server-side for scoring
--    (Fixes the critical JSON security bug where answers were sent to client)
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    questions_json LONGTEXT NOT NULL,  -- Full questions WITH answers (stored server-side only)
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,     -- Sessions expire after 15 minutes (quiz duration)
    is_completed TINYINT(1) DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Add index on quiz_sessions for fast token lookups
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_token ON quiz_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user ON quiz_sessions (user_id, is_completed);

-- 3. Add index on quiz_attempts for fast per-user lookup (used in 24h lockout check)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created ON quiz_attempts (user_id, created_at DESC);

-- 4. Ensure xp index exists and is optimized for leaderboard ORDER BY xp DESC
-- (already created in v8 but using IF NOT EXISTS to be safe)
CREATE INDEX IF NOT EXISTS idx_users_xp_tournament ON users (xp DESC, tournament_opt_in, is_suspended_from_tournament);

-- 5. Compound index for leaderboard query performance
CREATE INDEX IF NOT EXISTS idx_users_tournament_leaderboard ON users (tournament_opt_in, is_suspended_from_tournament, xp DESC);
