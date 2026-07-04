const db = require('../config/db');
const aiService = require('../services/aiService');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require("docx");
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateExamPdf = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            topic, grade, subject, questionCount = 10, logo, instructions, 
            language = 'Somali', duration = '1 saac', totalMarks = '100 dhibcood',
            fontStyle = 'Times New Roman', pageCount = 'Auto', paragraphStyle = 'Standard',
            difficulty = 'Medium', includeAnswerKey = true, examIllustration, imagePrompt
        } = req.body;

        if (!topic || !grade || !subject) {
            return res.status(400).json({ message: 'Fadlan buuxi dhammaan xogta (topic, grade, subject)' });
        }

        console.log(`Generating exam for User: ${userId} - ${subject} - ${topic} (${grade})`);

        // --- DYNAMIC COST CALCULATION ---
        const baseCost = 5;
        const perQuestionCost = 1.5;
        const pageCost = 2;
        const answerKeyCost = 4;
        const formattingCost = 3;
        const aiImageCost = 20;

        let cost = baseCost;
        cost += (parseInt(questionCount) || 10) * perQuestionCost;

        const targetPages = parseInt(pageCount) || 0;
        cost += targetPages * pageCost;

        if (includeAnswerKey !== false) {
            cost += answerKeyCost;
        }

        if (fontStyle !== 'Times New Roman' || paragraphStyle !== 'Standard') {
            cost += formattingCost;
        }

        if (imagePrompt && imagePrompt.trim()) {
            cost += aiImageCost;
        }

        cost = Math.ceil(cost);

        // --- CREDIT CHECK & DEDUCTION ---
        // 1. Check if user has active subscription
        const [sub] = await db.execute(
            'SELECT * FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = user_subscriptions.user_id) > 0',
            [userId]
        );
        const hasActiveSub = sub.length > 0;

        // 2. Check wallet balance
        const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
        const balance = wallet.length > 0 ? wallet[0].balance : 0;

        if (!hasActiveSub && balance < cost) {
            return res.status(402).json({ 
                message: `Dhibcahaagu kuma filna imtixaan-sameeyaha. Imtixaankan wuxuu u baahan yahay ${cost} Credits, laakiin waxaad haysataa ${balance} Credits.`, 
                needsPayment: true 
            });
        }

        // --- OPTIONAL EXAM ILLUSTRATION OR AI IMAGE GENERATION ---
        let illustrationBuffer = null;
        let finalIllustrationBase64 = examIllustration;

        if (!finalIllustrationBase64 && imagePrompt && imagePrompt.trim()) {
            try {
                console.log(`Generating AI illustration using prompt: "${imagePrompt}"`);
                const base64Image = await aiService.generateAIImage(imagePrompt.trim());
                if (base64Image) {
                    finalIllustrationBase64 = `data:image/png;base64,${base64Image}`;
                }
            } catch (imgErr) {
                console.warn("AI Illustration generation failed:", imgErr.message);
            }
        }

        if (finalIllustrationBase64) {
            try {
                const cleanBase64 = finalIllustrationBase64.replace(/^data:image\/\w+;base64,/, "");
                illustrationBuffer = Buffer.from(cleanBase64, 'base64');
            } catch (illErr) {
                console.warn("Illustration base64 parsing failed:", illErr.message);
            }
        }

        // --- GENERATE QUESTIONS VIA GEMINI ---
        // 1. Gather context from book embeddings related to the subject/topic
        const queryText = `${subject} ${topic} ${grade}`;
        let context = await aiService.findRelevantChunks(queryText);

        if (!context) {
            // Fallback: search database by simple text match if vector search yielded nothing
            const [rows] = await db.execute(
                'SELECT chunk_text FROM book_embeddings WHERE chunk_text LIKE ? OR title LIKE ? LIMIT 5',
                [`%${topic}%`, `%${subject}%`]
            );
            if (rows.length > 0) {
                context = "XOGTA LAGA REEBAY BUUGAAGTA:\n" + rows.map(r => r.chunk_text).join("\n\n---\n\n");
            }
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Based on the following curriculum context (if provided), generate a high-quality academic exam paper for Somali secondary schools.
        
        Details:
        - Subject: ${subject}
        - Topic: ${topic}
        - Grade: ${grade}
        - Total Questions: ${questionCount}
        - Language: ${language}
        - Duration: ${duration}
        - Total Marks: ${totalMarks}
        - Difficulty Level: ${difficulty} (Adjust question difficulty strictly according to this: Easy, Medium, or Hard)
        - Format / Layout requested: ${paragraphStyle} (e.g. Single spaced, Double spaced, bulleted spacing)
        - Target pages in output document: ${pageCount}
        ${illustrationBuffer ? `- NOTE: An illustration/diagram is included at the top of the exam paper. Structure some of the questions (especially structured or multiple-choice questions) to refer directly to this diagram/illustration (e.g. "Sida ka muuqata sawirka ku lifaaqan, waa maxay qaybta A?").` : ""}
        
        Curriculum Context:
        ${context || "No context provided. Use standard high-quality Somalian secondary school curriculum knowledge."}
        
        ${instructions ? `User Custom Instructions (Follow these strictly):\n${instructions}` : ""}
        
        The exam must be written completely in ${language} language.
        Please structure your output exactly as a structured JSON object with two fields so we can format it nicely:
        {
          "title": "A high-quality educational title for the exam",
          "instructions": "Exam instructions for the student (e.g. Ka jawaab dhammaan su'aalaha, waqtiga waa 1 saac)",
          "questions": [
            {
              "type": "multiple-choice",
              "question": "The question text...",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "answer": "Correct Option text or index"
            },
            {
              "type": "structured",
              "question": "The structured/short-answer question text...",
              "answer": "The sample correct answer for the teacher"
            }
          ]
        }
        
        Make sure the response is strict JSON. Do not include markdown code block formatting (like \`\`\`json).`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text().trim();

        // Strip out any markdown code block wrappers
        responseText = responseText.replace(/^```json\s*/i, '');
        responseText = responseText.replace(/^```\s*/, '');
        responseText = responseText.replace(/\s*```$/, '');
        responseText = responseText.trim();

        let examData;
        try {
            examData = JSON.parse(responseText);
        } catch (jsonErr) {
            console.error("JSON Parsing failed for exam response:", responseText);
            throw new Error("AI failed to generate a valid exam format. Try again.");
        }

        // --- PREPARE FILES PATHS ---
        const timestamp = Date.now();
        const baseFilename = `exam-${timestamp}`;
        const examsDir = path.join(__dirname, '..', 'uploads', 'exams');

        // Ensure directory exists
        if (!fs.existsSync(examsDir)) {
            fs.mkdirSync(examsDir, { recursive: true });
        }

        // --- 1. GENERATE PDF ---
        const pdfFilename = `${baseFilename}.pdf`;
        const pdfPath = path.join(examsDir, pdfFilename);
        const doc = new PDFDocument({ margin: 50 });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        // Styling helper
        const colors = {
            primary: '#1E3A8A', // Deep Blue
            secondary: '#3B82F6', // Blue Accent
            text: '#1F2937', // Dark Gray
            lightGray: '#9CA3AF',
            border: '#E5E7EB'
        };

        // Set fonts based on chosenFontStyle
        let fontRegular = 'Helvetica';
        let fontBold = 'Helvetica-Bold';
        let fontItalic = 'Helvetica-Oblique';

        const chosenFont = fontStyle || 'Times New Roman';
        if (chosenFont.includes('Times') || chosenFont.includes('Georgia')) {
            fontRegular = 'Times-Roman';
            fontBold = 'Times-Bold';
            fontItalic = 'Times-Italic';
        } else if (chosenFont.includes('Courier')) {
            fontRegular = 'Courier';
            fontBold = 'Courier-Bold';
            fontItalic = 'Courier-Oblique';
        }

        // Spacing layout helper
        const spaceMultiplier = paragraphStyle.includes('Double') ? 1.8 : 1.0;

        // Parse optional logo base64 if provided
        let logoBuffer = null;
        if (logo) {
            try {
                const cleanBase64 = logo.replace(/^data:image\/\w+;base64,/, "");
                logoBuffer = Buffer.from(cleanBase64, 'base64');
            } catch (logoErr) {
                console.warn("Logo base64 parsing failed:", logoErr.message);
            }
        }

        // --- PAGE 1: EXAM PAPER ---
        // Overlay Logo in top right corner of PDF if uploaded
        if (logoBuffer) {
            try {
                doc.image(logoBuffer, 460, 40, { width: 55, height: 55 });
            } catch (pdfLogoErr) {
                console.warn("PDFKit logo render failed:", pdfLogoErr.message);
            }
        }

        doc.fillColor(colors.primary)
           .font(fontBold)
           .fontSize(20)
           .text('MADASHA WAXBARASHADA DARKPEN', { align: 'center' })
           .moveDown(0.2);

        doc.fillColor(colors.secondary)
           .font(fontBold)
           .fontSize(13)
           .text(`IMTIXAANKA: ${examData.title || subject.toUpperCase()}`, { align: 'center' })
           .moveDown(0.4);

        doc.fillColor(colors.text)
           .font(fontRegular)
           .fontSize(10)
           .text(`Maaddada: ${subject}  |  Grade: ${grade}  |  Duration: ${duration}  |  Marks: ${totalMarks}`, { align: 'center' })
           .moveDown(0.6);

        // Draw horizontal line
        doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor(colors.primary).lineWidth(1.5).stroke().moveDown(1);

        // Instructions
        doc.fillColor('#B91C1C')
           .font(fontItalic)
           .fontSize(10)
           .text(`Hanuunin: ${examData.instructions || "Ka jawaab dhammaan su'aalaha si taxadir leh."}`)
           .moveDown(1.5);

        // Add exam illustration if generated/uploaded
        if (illustrationBuffer) {
            try {
                doc.image(illustrationBuffer, { fit: [250, 180], align: 'center' }).moveDown(1.5);
            } catch (pdfLogoErr) {
                console.warn("PDFKit illustration render failed:", pdfLogoErr.message);
            }
        }

        // Render Questions
        doc.fillColor(colors.text).font(fontRegular).fontSize(11);
        
        examData.questions.forEach((q, idx) => {
            doc.fillColor(colors.primary).font(fontBold).fontSize(11).text(`Su'aasha ${idx + 1}: `, { continued: true });
            doc.fillColor(colors.text).font(fontRegular).fontSize(10.5).text(q.question);
            doc.moveDown(0.4 * spaceMultiplier);

            if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
                q.options.forEach((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                    doc.fontSize(9.5).text(`      ${letter}) ${opt}`).moveDown(0.25 * spaceMultiplier);
                });
            } else {
                // Draw space for structured answer
                doc.fontSize(9.5).fillColor(colors.lightGray).text('      Jawaab: __________________________________________________________________').moveDown(0.35 * spaceMultiplier);
                doc.text('      __________________________________________________________________________').moveDown(0.35 * spaceMultiplier);
            }
            doc.moveDown(0.8 * spaceMultiplier);

            // Add new page if current page height exceeds safe limit
            if (doc.y > 660) {
                doc.addPage();
            }
        });

        // --- PAGE 2: ANSWER KEY ---
        if (includeAnswerKey !== false) {
            doc.addPage();
            doc.fillColor(colors.primary)
               .font(fontBold)
               .fontSize(16)
               .text('FURAHA JAWAABAHA (ANSWER KEY)', { align: 'center' })
               .moveDown(0.4);

            doc.fillColor(colors.secondary)
               .font(fontBold)
               .fontSize(11)
               .text(`Macalimiinta & Waalidiinta Kaliya`, { align: 'center' })
               .moveDown(0.4);

            doc.moveTo(50, doc.y).lineTo(562, doc.y).strokeColor(colors.secondary).lineWidth(1).stroke().moveDown(1.2);

            doc.fillColor(colors.text).font(fontRegular).fontSize(10);

            examData.questions.forEach((q, idx) => {
                doc.fillColor(colors.primary).font(fontBold).fontSize(10.5).text(`Jawaabta S${idx + 1}: `, { continued: true });
                doc.fillColor('#047857').font(fontBold).fontSize(10.5).text(q.answer);
                doc.moveDown(0.7 * spaceMultiplier);
            });
        }

        doc.end();

        // --- 2. GENERATE WORD (.docx) ---
        const docxFilename = `${baseFilename}.docx`;
        const docxPath = path.join(examsDir, docxFilename);
        
        // Build Word Document Children
        const docxChildren = [];
        
        docxChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
                children: [
                    new TextRun({
                        text: "MADASHA WAXBARASHADA DARKPEN",
                        bold: true,
                        size: 28,
                        color: "1E3A8A"
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: `IMTIXAANKA: ${examData.title ? examData.title.toUpperCase() : subject.toUpperCase()}`,
                        bold: true,
                        size: 22,
                        color: "3B82F6"
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: `Maaddada: ${subject}  |  Grade: ${grade}  |  Duration: ${duration}  |  Marks: ${totalMarks}`,
                        size: 18,
                        color: "1F2937"
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 150 },
                children: [
                    new TextRun({
                        text: "_________________________________________________________________________________",
                        color: "1E3A8A"
                    })
                ]
            }),
            new Paragraph({
                spacing: { after: 250 },
                children: [
                    new TextRun({
                        text: `Hanuunin: ${examData.instructions || "Ka jawaab dhammaan su'aalaha si taxadir leh."}`,
                        italics: true,
                        size: 20,
                        color: "B91C1C"
                    })
                ]
            })
        );

        // Word Questions
        examData.questions.forEach((q, idx) => {
            docxChildren.push(
                new Paragraph({
                    spacing: { before: 120, after: 80 },
                    children: [
                        new TextRun({
                            text: `Su'aasha ${idx + 1}: `,
                            bold: true,
                            size: 20,
                            color: "1E3A8A"
                        }),
                        new TextRun({
                            text: q.question,
                            size: 20,
                            color: "1F2937"
                        })
                    ]
                })
            );

            if (q.type === 'multiple-choice' && Array.isArray(q.options)) {
                q.options.forEach((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    docxChildren.push(
                        new Paragraph({
                            spacing: { before: 40, after: 40 },
                            indent: { left: 540 },
                            children: [
                                new TextRun({
                                    text: `${letter}) ${opt}`,
                                    size: 19,
                                    color: "1F2937"
                                })
                            ]
                        })
                    );
                });
            } else {
                docxChildren.push(
                    new Paragraph({
                        spacing: { before: 80, after: 40 },
                        indent: { left: 540 },
                        children: [
                            new TextRun({
                                text: "Jawaab: __________________________________________________________________",
                                color: "9CA3AF",
                                size: 19
                            })
                        ]
                    }),
                    new Paragraph({
                        spacing: { before: 40, after: 80 },
                        indent: { left: 540 },
                        children: [
                            new TextRun({
                                text: "__________________________________________________________________________",
                                color: "9CA3AF",
                                size: 19
                            })
                        ]
                    })
                );
            }
        });

        // Word Answer Key Page
        if (includeAnswerKey !== false) {
            docxChildren.push(
                new Paragraph({
                    spacing: { before: 400, after: 150 },
                    pageBreakBefore: true,
                    children: [
                        new TextRun({
                            text: "FURAHA JAWAABAHA (ANSWER KEY)",
                            bold: true,
                            size: 24,
                            color: "1E3A8A"
                        })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 150 },
                    children: [
                        new TextRun({
                            text: "Macalimiinta & Waalidiinta Kaliya",
                            bold: true,
                            size: 18,
                            color: "3B82F6"
                        })
                    ]
                })
            );

            examData.questions.forEach((q, idx) => {
                docxChildren.push(
                    new Paragraph({
                        spacing: { before: 80, after: 80 },
                        children: [
                            new TextRun({
                                text: `Jawaabta S${idx + 1}: `,
                                bold: true,
                                size: 20,
                                color: "1E3A8A"
                            }),
                            new TextRun({
                                text: q.answer,
                                bold: true,
                                size: 20,
                                color: "047857"
                            })
                        ]
                    })
                );
            });
        }

        const docxObj = new Document({
            sections: [{
                properties: {},
                children: docxChildren
            }]
        });

        const docxBuffer = await Packer.toBuffer(docxObj);
        fs.writeFileSync(docxPath, docxBuffer);

        // --- DEDUCT CREDITS IN WALLET ---
        await db.execute('UPDATE user_wallet SET balance = GREATEST(0, balance - ?) WHERE user_id = ?', [cost, userId]);

        // Log exam generation to ai_usage_logs
        try {
            await db.execute(
                'INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) VALUES (?, "exam-generator", 0, 0, ?, "exam")',
                [userId, cost / 200]
            );
        } catch (logErr) {
            console.error('[AI Logger Error] Exam generation log failed:', logErr.message);
        }

        // --- SAVE TO DATABASE ---
        const pdfUrl = `/uploads/exams/${pdfFilename}`;
        const wordUrl = `/uploads/exams/${docxFilename}`;

        await db.execute(
            `INSERT INTO user_generated_exams (user_id, title, subject, grade, topic, pdf_url, word_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, examData.title || `${subject} - ${topic}`, subject, grade, topic, pdfUrl, wordUrl]
        );

        // Wait for PDF writing to finish and return
        writeStream.on('finish', () => {
            res.json({
                status: 'success',
                title: examData.title || `${subject} - ${topic}`,
                pdfUrl: pdfUrl,
                wordUrl: wordUrl,
                message: 'Imtixaankaaga si guul leh ayaa loo diyaariyey!'
            });
        });

    } catch (error) {
        console.error("Exam Generator Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo saarista imtixaanka' });
    }
};

// GET My generated exams
exports.getMyExams = async (req, res) => {
    try {
        const userId = req.user.id;
        const [rows] = await db.execute(
            'SELECT * FROM user_generated_exams WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Fetch My Exams Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo akhrinta imtixaanadii aad diyaarisay.' });
    }
};
