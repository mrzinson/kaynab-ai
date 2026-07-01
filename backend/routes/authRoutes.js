const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Xogta Dugsiyada & Fasalada (Public)
router.get('/schools', authController.getSchools);
router.get('/classes/:schoolId', authController.getClasses);

// Diiwaangalinta & Gelitaanka (Public)
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Kuwan waxay u baahan yihiin in qofku Login sameeyay (Protected)
router.post('/terms', auth, authController.acceptTerms);
router.post('/register-student', auth, authController.registerStudent);
router.post('/submit-payment', auth, authController.submitPayment);
router.post('/verify-phone', auth, authController.verifyPhone);
router.post('/verify-email', auth, authController.verifyEmail);
router.post('/resend-code', auth, authController.resendCode);
router.post('/push-token', auth, authController.savePushToken);

// Password Management (Public)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Payment configuration (Public)
router.get('/payment-config', (req, res) => {
  res.json({
    numbers: ['637930329', '659119779']
  });
});

// Temporary Gemini Diagnostic Endpoint (Public)
router.get('/test-gemini', async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing or empty." });
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Hello" }] }]
    });
    const response = await result.response;
    res.json({
      success: true,
      apiKeyMasked: apiKey.length > 12 ? apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4) : "invalid-length",
      response: response.text()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
      status: err.status,
      statusText: err.statusText,
      stack: err.stack,
      errorDetails: err.errorDetails
    });
  }
});

// Temporary List Models Diagnostic Endpoint (Public)
router.get('/list-models', (req, res) => {
  const https = require('https');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing." });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', (chunk) => { data += chunk; });
    apiRes.on('end', () => {
      try {
        res.json(JSON.parse(data));
      } catch (err) {
        res.status(500).send(data);
      }
    });
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

module.exports = router;
