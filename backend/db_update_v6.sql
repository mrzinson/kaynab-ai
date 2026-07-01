-- Schema update for dynamic promotional cards
CREATE TABLE IF NOT EXISTS promo_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title_en VARCHAR(255) NOT NULL,
    title_so VARCHAR(255) NOT NULL,
    desc_en TEXT NOT NULL,
    desc_so TEXT NOT NULL,
    button_text_en VARCHAR(100) NOT NULL,
    button_text_so VARCHAR(100) NOT NULL,
    image_url VARCHAR(512) NOT NULL,
    route VARCHAR(255) NOT NULL,
    overlay_color_light VARCHAR(100) DEFAULT 'rgba(29, 78, 216, 0.65)',
    overlay_color_dark VARCHAR(100) DEFAULT 'rgba(30, 41, 59, 0.75)',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed with initial premium service cards
INSERT INTO promo_cards (title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, image_url, route, overlay_color_light, overlay_color_dark)
SELECT 'Books', 'Books', 'Explore and read all educational and curriculum books.', 'Baro oo akhriso dhammaan buugaagta la heli karo ee waxtarka leh.', 'Get Started', 'Hada Bilow', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600', '/manhajka', 'rgba(29, 78, 216, 0.65)', 'rgba(30, 41, 59, 0.75)'
FROM dual WHERE NOT EXISTS (SELECT 1 FROM promo_cards WHERE route = '/manhajka');

INSERT INTO promo_cards (title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, image_url, route, overlay_color_light, overlay_color_dark)
SELECT 'Exams', 'Imtixaanada', 'Train yourself and prepare for official national exams.', 'Tababar naftaada oo ku diyaargarow imtixaanada shahaadiga ah.', 'Start Exam', 'Bilow Imtixaan', 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600', '/exams', 'rgba(109, 40, 217, 0.65)', 'rgba(46, 16, 101, 0.75)'
FROM dual WHERE NOT EXISTS (SELECT 1 FROM promo_cards WHERE route = '/exams');

INSERT INTO promo_cards (title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, image_url, route, overlay_color_light, overlay_color_dark)
SELECT 'AI Assistance', 'Caawimaada AI', 'Ask the smart AI assistant any question and get quick answers.', 'Weydii caawiyaha AI wixii su\'aal ah oo hel jawaab degdeg ah.', 'Chat Now', 'Hada Bilow', 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600', '/(tabs)/chat', 'rgba(4, 120, 87, 0.65)', 'rgba(6, 78, 59, 0.75)'
FROM dual WHERE NOT EXISTS (SELECT 1 FROM promo_cards WHERE route = '/(tabs)/chat');
