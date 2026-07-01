-- 1. Create table wallet_expirations
CREATE TABLE IF NOT EXISTS wallet_expirations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    expired_balance INT NOT NULL,
    expired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
