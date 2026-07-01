-- Add XP column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0;

-- Index users by XP for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_xp ON users (xp DESC);

-- Create table to log quiz attempts
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    score INT NOT NULL,
    xp_earned INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
