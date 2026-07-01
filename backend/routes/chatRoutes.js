const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const auth = require('../middleware/auth');

// Waddooyinkan waxay u baahan yihiin in qofku Login sameeyay
router.post('/ask', auth, chatController.askAI);
router.get('/history/:sessionId', auth, chatController.getChatHistory);
router.delete('/history/clear', auth, chatController.clearChatHistory);

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/chats/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Session Management
router.get('/sessions', auth, chatController.getSessions);
router.post('/sessions', auth, chatController.createSession);
router.put('/sessions/:id', auth, chatController.updateSession);
router.delete('/sessions/:id', auth, chatController.deleteSession);

// Voice Notes
router.post('/voice', auth, upload.single('audio'), chatController.processVoice);

// Shukaansi Profile
router.get('/shukaansi-profile', auth, chatController.getShukaansiProfile);
router.get('/shukaansi-history', auth, chatController.getShukaansiHistory);
router.post('/shukaansi-react', auth, chatController.reactToShukaansiMessage);

const quizController = require('../controllers/quizController');
const examGeneratorController = require('../controllers/examGeneratorController');

// Quizzes
router.get('/quiz/status', auth, quizController.getQuizStatus);
router.get('/quiz/generate', auth, quizController.generateQuiz);
router.post('/quiz/submit', auth, quizController.submitQuiz);
router.get('/quiz/leaderboard', auth, quizController.getLeaderboard);
router.post('/quiz/opt-in', auth, quizController.optIn);

router.post('/quiz/generate-exam-pdf', auth, examGeneratorController.generateExamPdf);
router.get('/quiz/my-exams', auth, examGeneratorController.getMyExams);

// Shukaansi Call
router.post('/shukaansi-call/deduct', auth, chatController.deductShukaansiCallCredit);

// Exams & Books Assistant
router.post('/exam-assist', auth, chatController.askExamAI);

module.exports = router;


