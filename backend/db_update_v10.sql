-- Add advertising configuration columns to tournament_settings table
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS gen_ad_title VARCHAR(255) DEFAULT 'Dugsiga Caalamiga ah ee ZinsonAI';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS gen_ad_desc TEXT;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS gen_ad_btn_text VARCHAR(100) DEFAULT 'Baro Dheeraad';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS gen_ad_btn_route VARCHAR(255) DEFAULT '/manhajka';

ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_ad_title VARCHAR(255) DEFAULT 'Darkpen Premium Wallet';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_ad_desc TEXT;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_ad_btn_text VARCHAR(100) DEFAULT 'Hada Iibso';
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS result_ad_btn_route VARCHAR(255) DEFAULT '/billing';

-- Seed default settings record if they are empty
UPDATE tournament_settings 
SET 
    gen_ad_title = IFNULL(gen_ad_title, 'Dugsiga Caalamiga ah ee ZinsonAI'),
    gen_ad_desc = IFNULL(gen_ad_desc, 'Hada is-diiwaangeli oo hel waxbarasho digital ah oo bilaash ah!'),
    gen_ad_btn_text = IFNULL(gen_ad_btn_text, 'Baro Dheeraad'),
    gen_ad_btn_route = IFNULL(gen_ad_btn_route, '/manhajka'),
    result_ad_title = IFNULL(result_ad_title, 'Darkpen Premium Wallet'),
    result_ad_desc = IFNULL(result_ad_desc, 'Ku shubo 100 Credits oo dheeraad ah kaliya $1 si aad u kordhiso isku-dayadaada!'),
    result_ad_btn_text = IFNULL(result_ad_btn_text, 'Hada Iibso'),
    result_ad_btn_route = IFNULL(result_ad_btn_route, '/billing')
WHERE id = 1;
