require('dotenv').config();
const db = require('../config/db');
const path = require('path');
const ingestionService = require('../services/ingestionService');

async function seedOCREmbeddings() {
    try {
        console.log("Waxaan soo akhrinaynaa Buugaagta (Books) ee u baahan OCR...");
        
        // Fetch all books (we will filter for Somali and Tarbiya)
        const [books] = await db.execute('SELECT * FROM books');

        for (const book of books) {
            const lowTitle = book.title.toLowerCase();
            if (lowTitle.includes('physics')) continue; // Skip Physics as it's already done
            if (lowTitle.includes('somali') || lowTitle.includes('tarbiya') || lowTitle.includes('arabic')) {
                console.log(`Processing: ${book.title}`);
                const pdfPath = path.join(__dirname, '..', 'uploads', path.basename(book.pdf_url));
                
                // We call ingestPDF which handles both text and OCR
                await ingestionService.ingestPDF(book.id, 'book', book.title, book.category, pdfPath);
            }
        }

        console.log("Waxaan soo akhrinaynaa Imtixaanaadka (Exams) ee u baahan OCR...");
        const [exams] = await db.execute('SELECT * FROM exams');
        for (const exam of exams) {
            console.log(`Processing Exam: ${exam.title}`);
            const pdfPath = path.join(__dirname, '..', 'uploads', path.basename(exam.pdf_url));
            await ingestionService.ingestPDF(exam.id, 'exam', exam.title, exam.category, pdfPath);
        }

        console.log("=========================================");
        console.log("Dhammaray! Dhammaan buugaagta hadda AI-da ayaa loo tababaray. 🎉");
        process.exit(0);
    } catch (error) {
        console.error("Cilad seeder-ka:", error);
        process.exit(1);
    }
}

seedOCREmbeddings();
