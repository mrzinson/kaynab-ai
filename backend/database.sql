CREATE DATABASE IF NOT EXISTS ai_chat_app;
USE ai_chat_app;

-- 1. Miiska Dugsiyada (Schools)
CREATE TABLE IF NOT EXISTS schools (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Miiska Fasalada (Classes)
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

-- 3. Miiska Dadka (Users)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NULL,
    password VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(32) UNIQUE NULL,
    role ENUM('student', 'user', 'admin') DEFAULT 'user',
    school_id INT NULL,
    class_id INT NULL,
    reason_for_joining TEXT NULL,
    payment_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL,
    payment_reference VARCHAR(50) NULL,
    is_verified BOOLEAN DEFAULT TRUE,
    verification_code VARCHAR(10) NULL,
    reset_code VARCHAR(10) NULL,
    reset_code_expires_at TIMESTAMP NULL,
    terms_accepted_at TIMESTAMP NULL,
    profile_picture LONGTEXT NULL,
    gender ENUM('male', 'female') NULL,
    country VARCHAR(100) NULL,
    region_state VARCHAR(100) NULL,
    last_username_change TIMESTAMP NULL,
    is_suspended TINYINT(1) DEFAULT 0,
    push_token TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
);

-- 4. Miiska Wada-sheekaysiga AI-da (Private Messages)
CREATE TABLE IF NOT EXISTS messages_private (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sender ENUM('user', 'ai') NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Miiska Wada-sheekaysiga Group-ka (Group Messages)
CREATE TABLE IF NOT EXISTS messages_group (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    class_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Miiska Lacag-bixinta (Payments)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reference_number VARCHAR(50) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_free_ai_usage (
    user_id INT PRIMARY KEY,
    free_text_used INT NOT NULL DEFAULT 0,
    free_image_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
