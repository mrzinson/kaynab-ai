-- Update Exams table with category and year
ALTER TABLE exams ADD COLUMN IF NOT EXISTS category VARCHAR(100) AFTER description;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS year VARCHAR(20) AFTER category;

-- Optional: Update existing records to 'General' and '2025'
UPDATE exams SET category = 'General' WHERE category IS NULL;
UPDATE exams SET year = '2025' WHERE year IS NULL;
