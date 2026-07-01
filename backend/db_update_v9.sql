-- Add opt-in column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tournament_opt_in TINYINT(1) DEFAULT 0;

-- Create tournament_settings table
CREATE TABLE IF NOT EXISTS tournament_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    is_active TINYINT(1) DEFAULT 1,
    reward_description TEXT,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default settings record if not exists
INSERT IGNORE INTO tournament_settings (id, is_active, reward_description) 
VALUES (1, 1, 'Mise rabtaa inaad ku biirto Tartanka Qaran ee Billaha ah si aad u guulaysato abaalmarino qaali ah? Qofkii 30days ugu sareeyaa 3da kaalmood ee sare wuxuu heli doonaa abaalmarin fiican.');

-- Add is_suspended_from_tournament column to users table to allow blocking contestants
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended_from_tournament TINYINT(1) DEFAULT 0;
