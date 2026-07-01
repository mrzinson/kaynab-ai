-- Update Books table with category and grade
ALTER TABLE books ADD COLUMN IF NOT EXISTS category VARCHAR(100) AFTER author;
ALTER TABLE books ADD COLUMN IF NOT EXISTS grade VARCHAR(50) AFTER category;

-- Optional: Update existing records
UPDATE books SET category = 'General' WHERE category IS NULL;
UPDATE books SET grade = 'Form 4' WHERE grade IS NULL;
