const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const adminAuth = require('../middleware/adminAuth');
const { clearEmbeddingsCache } = require('../services/aiService');

const whatsappCloudBot = require('../services/whatsappCloudBot');
const storageService = require('../services/storageService');

// Robustly resolve and create uploads directory inside the backend folder
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Admin Activity Logging Helper
async function logAdminAction(adminId, actionType, details) {
    try {
        if (!adminId) return;
        await db.execute(
            'INSERT INTO admin_logs (admin_id, action_type, details) VALUES (?, ?, ?)',
            [adminId, actionType, details]
        );
    } catch (e) {
        console.error('[Admin Log Error]:', e.message);
    }
}

// ==========================================
// PUBLIC ROUTE: Admin Login
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Fadlan geli email-ka iyo password-ka' });
        }

        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Email ama Password waa khalad' });
        }

        const user = users[0];
        if (user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Ma lihid ogolaansho aad ku gasho dashboard-ka' });
        }

        if (user.is_suspended) {
            return res.status(403).json({ message: 'Koontadaada waa la laalay (Suspended).' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Email ama Password waa khalad' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        // Log login action
        await logAdminAction(user.id, 'LOGIN', `Logged in successfully`);

        res.json({
            status: 'success',
            token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday login-ka' });
    }
});

// ==========================================
// SECURE MIDDLEWARE: Protect all subsequent routes
// ==========================================
router.use(adminAuth);

// 1. Stats Overview
router.get('/stats', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT COUNT(*) as total FROM users');
        const [recentUsers] = await db.execute('SELECT id, name, email, created_at, role FROM users ORDER BY created_at DESC LIMIT 5');
        const [pendingPayments] = await db.execute('SELECT COUNT(*) as total FROM payments WHERE status = "pending"');
        
        // Calculate Total Revenue from approved payments
        const [revenueRes] = await db.execute('SELECT SUM(amount) as total FROM payments WHERE status = "approved"');
        const totalRevenue = revenueRes[0].total || 0;

        // Active Chats (number of chat sessions)
        const [chatsRes] = await db.execute('SELECT COUNT(*) as total FROM chat_sessions');
        const activeChats = chatsRes[0].total || 0;

        // Chart Data: Last 7 days revenue
        const [chartData] = await db.execute(`
            SELECT DATE(created_at) as date, SUM(amount) as revenue 
            FROM payments 
            WHERE status = 'approved' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Format chart data for Recharts
        const formattedChartData = chartData.map(item => ({
            name: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: parseFloat(item.revenue) || 0
        }));

        res.json({
            totalUsers: users[0].total,
            pendingPayments: pendingPayments[0].total,
            totalRevenue, 
            activeChats,
            recentUsers,
            chartData: formattedChartData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday stats-ka' });
    }
});

// 2. Users Management
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.email, 
                u.password, 
                u.whatsapp_number, 
                u.role, 
                u.is_suspended, 
                u.created_at,
                COALESCE(uw.balance, 0) AS credits,
                COALESCE(sw.balance, 0) AS shukaansi_credits,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND sender = 'user') AS private_messages_count,
                (SELECT COUNT(*) FROM group_messages_v2 WHERE user_id = u.id) AS group_messages_count
            FROM users u
            LEFT JOIN user_wallet uw ON u.id = uw.user_id
            LEFT JOIN shukaansi_wallet sw ON u.id = sw.user_id
            ORDER BY u.created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ message: 'Lama helin users-ka' });
    }
});

// 2a. Suspend/Unsuspend User
router.post('/users/:id/suspend', async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await db.execute('SELECT is_suspended FROM users WHERE id = ?', [id]);
        if (users.length === 0) return res.status(404).json({ message: 'User-ka lama helin' });
        
        const newStatus = users[0].is_suspended ? 0 : 1;
        await db.execute('UPDATE users SET is_suspended = ? WHERE id = ?', [newStatus, id]);
        
        res.json({ 
            status: 'success', 
            message: newStatus ? 'User-ka waa la laalay (Suspended)' : 'User-ka waa laga qaaday laaliddii (Active)', 
            is_suspended: newStatus 
        });
    } catch (error) {
        console.error('Error suspending user:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday laalida user-ka' });
    }
});

// 2a-2. Send WhatsApp Report to User
router.post('/users/:id/whatsapp-report', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch user data with credits, messages count (split by app and whatsapp), and tournament points (XP)
        const [users] = await db.execute(`
            SELECT u.*, 
                   (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NOT NULL) AS app_messages_count,
                   (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NULL) AS whatsapp_messages_count,
                   (SELECT balance FROM user_wallet WHERE user_id = u.id) AS credits,
                    (SELECT type FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = u.id) > 0 ORDER BY expiry_date DESC LIMIT 1) AS sub_type,
                    (SELECT expiry_date FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = u.id) > 0 ORDER BY expiry_date DESC LIMIT 1) AS sub_expiry
            FROM users u WHERE u.id = ?
        `, [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'User-ka lama helin' });
        }
        
        const user = users[0];
        if (!user.whatsapp_number) {
            return res.status(400).json({ message: 'User-ka ma laha lambar WhatsApp ah!' });
        }
        
        const dateJoined = new Date(user.created_at).toLocaleDateString('so-SO');
        const statusText = user.is_suspended ? 'Xaniban (Suspended)' : 'Firfircoon (Active)';
        
        let planText = 'None';
        if (user.sub_type) {
            const planName = user.sub_type === 'monthly_11' ? 'Premium' : 'Basic';
            const daysLeft = Math.ceil((new Date(user.sub_expiry) - new Date()) / (1000 * 60 * 60 * 24));
            planText = `${planName} (${daysLeft} casho ayaa u hadhay)`;
        }
        
        const reportMessage = `*DARKPEN REPORT* 📝📚\n` +
          `----------------------------------\n` +
          `👤 *Magaca:* ${user.name}\n` +
          `🆔 *Username:* @${user.username || 'ma jiro'}\n` +
          `📅 *Ku biiray:* ${dateJoined}\n` +
          `💎 *Credits-ka Wallet:* ${user.credits || 0}\n` +
          `💬 *Wada-sheekaysiga AI:* ${user.app_messages_count || 0}\n` +
          `💬 *Wada-sheekaysiga WhatsApp:* ${user.whatsapp_messages_count || 0}\n` +
          `🏆 *Dhibcaha Tartanka (XP):* ${user.xp || 0} XP\n` +
          `💳 *Qorshaha (Plan):* ${planText}\n` +
          `🔒 *Status-ka:* ${statusText}\n\n` +
          `Mahadsanid, sii wad isticmaalka Darkpen! 🚀`;
          
        // Send via Cloud Bot
        let sent = false;
        let sendError = null;
        try {
            const cleanPhone = user.whatsapp_number.replace(/\+/g, '').trim();
            await whatsappCloudBot.sendCloudMessage(cleanPhone, reportMessage);
            sent = true;
        } catch (err) {
            console.error('[ADMIN REPORT] whatsappCloudBot send failed:', err.message);
            sendError = err;
        }

        if (!sent) {
            throw sendError || new Error('No active WhatsApp bot connection found.');
        }
        
        // Log admin action
        await logAdminAction(req.user.id, 'send_whatsapp_report', `Sent report to user ${user.name} (${user.whatsapp_number})`);
        
        res.json({ status: 'success', message: 'Report-ka waa loo diray user-ka WhatsApp-kiisa!' });
    } catch (error) {
        console.error('Error sending WhatsApp report:', error);
        res.status(500).json({ 
            message: 'WhatsApp bot-ku ma xirna ama cilad ayaa ku timid dirista report-ka.' 
        });
    }
});

// 2b. Delete User
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ status: 'success', message: 'User-ka si guul leh ayaa loo tirtiray' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista user-ka' });
    }
});

// 3. Payments Management
router.get('/payments', async (req, res) => {
    try {
        const [payments] = await db.execute(`
            SELECT p.*, u.name as user_name 
            FROM payments p 
            JOIN users u ON p.user_id = u.id 
            ORDER BY p.created_at DESC
        `);
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin payments-ka' });
    }
});

router.get('/payments/test-whatsapp-notify/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const approveMsg = `✅ Hambalyo waad isticmaali kartaa. (Test Notification)`;
        console.log(`[TEST WHATSAPP] Sending test message to: ${phone}`);
        
        let localSent = false;
        let localError = 'Local QR bot removed — Cloud API only';

        let cloudSent = false;
        let cloudResult = null;
        let cloudError = null;
        try {
            cloudResult = await whatsappCloudBot.sendCloudMessage(phone.replace(/^\+/, ''), approveMsg);
            if (cloudResult) {
                cloudSent = true;
            } else {
                cloudError = 'Meta API returned null (check credentials or format)';
            }
        } catch (e) {
            cloudError = e.message;
        }

        res.json({
            phone,
            localBot: {
                status: 'disabled',
                sent: localSent,
                error: localError
            },
            cloudBot: {
                sent: cloudSent,
                result: cloudResult,
                error: cloudError,
                credentials: {
                    hasToken: !!process.env.META_WA_ACCESS_TOKEN,
                    hasPhoneId: !!process.env.META_WA_PHONE_NUMBER_ID
                }
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/payments/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const [payment] = await db.execute('SELECT * FROM payments WHERE id = ?', [id]);
        
        if (payment.length === 0) return res.status(404).json({ message: 'Lama helin lacag-bixintan' });

        const p = payment[0];
        if (p.status !== 'pending') {
            return res.status(400).json({ message: 'Lacag-bixintan mar hore ayaa la go\'aamiyey (mar hore ayaa la ansixiyey ama la diiday).' });
        }
        console.log(`[PAYMENT] Approving ID: ${id}, User: ${p.user_id}, Amount: ${p.amount}`);
        await db.execute('UPDATE payments SET status = "approved" WHERE id = ?', [id]);
        
        // 1. Hubi inta ay lacagtu tahay
        // Qiimaha caadiga ah:
        //   $0.50 = 100 Credits
        //   $3.00 = 1 Month Basic (1000 credits)
        //   $11.00 = 1 Month Premium (5000 credits)
        //
        // PROMO (20/06/2026 – 20/07/2026):
        //   $2.00 = 1 Month Basic PROMO (600 credits)

        const walletTable = p.service_type === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        const subTable = p.service_type === 'shukaansi' ? 'shukaansi_subscriptions' : 'user_subscriptions';

        // ── Promo period detection ────────────────────────────────────────────
        const now = new Date();
        const promoStart = new Date('2026-06-20T00:00:00+03:00');
        const promoEnd   = new Date('2027-07-20T23:59:59+03:00');
        const isPromoPeriod = now >= promoStart && now <= promoEnd;
        // ─────────────────────────────────────────────────────────────────────

        if (p.amount >= 11.0) {
            // Premium Subscription ($11.00)
            await db.execute(`INSERT INTO ${subTable} (user_id, type, expiry_date) VALUES (?, "monthly_11", DATE_ADD(NOW(), INTERVAL 30 DAY))`, [p.user_id]);
            // Set balance to Premium limit (5000 credits)
            await db.execute(
                `INSERT INTO ${walletTable} (user_id, balance) VALUES (?, 5000) ON DUPLICATE KEY UPDATE balance = 5000, last_updated = NOW()`,
                [p.user_id]
            );
        } else if (isPromoPeriod && p.amount >= 2.0 && p.amount < 3.0) {
            // ── PROMO Basic Subscription ($2.00 during promo period) ──────────
            console.log(`[PAYMENT] PROMO BASIC: User ${p.user_id} paid $${p.amount} during promo period → 800 credits`);
            await db.execute(`INSERT INTO ${subTable} (user_id, type, expiry_date) VALUES (?, "monthly_3", DATE_ADD(NOW(), INTERVAL 30 DAY))`, [p.user_id]);
            // Set balance to Promo Basic limit (800 credits)
            await db.execute(
                `INSERT INTO ${walletTable} (user_id, balance) VALUES (?, 800) ON DUPLICATE KEY UPDATE balance = 800, last_updated = NOW()`,
                [p.user_id]
            );
        } else if (p.amount >= 3.0) {
            // Basic Subscription ($3.00) — normal pricing
            await db.execute(`INSERT INTO ${subTable} (user_id, type, expiry_date) VALUES (?, "monthly_3", DATE_ADD(NOW(), INTERVAL 30 DAY))`, [p.user_id]);
            // Set balance to Basic limit (1000 credits)
            await db.execute(
                `INSERT INTO ${walletTable} (user_id, balance) VALUES (?, 1000) ON DUPLICATE KEY UPDATE balance = 1000, last_updated = NOW()`,
                [p.user_id]
            );
        } else if (p.amount >= 0.5) {
            // Add Credits ($0.50)
            await db.execute(
                `INSERT INTO ${walletTable} (user_id, balance) VALUES (?, 100) ON DUPLICATE KEY UPDATE balance = balance + 100, last_updated = NOW()`,
                [p.user_id]
            );
        }

        // 2. Cusboonaysii user-ka guud ahaan (Users table)
        await db.execute('UPDATE users SET payment_status = "approved" WHERE id = ?', [p.user_id]);

        // 3. Haddii ay ahayd Group Join, u oggolaaw gelitaanka
        const [groupReg] = await db.execute('SELECT * FROM group_registrations WHERE payment_ref = ?', [p.reference_number]);
        if (groupReg.length > 0) {
            await db.execute('UPDATE group_registrations SET status = "approved" WHERE id = ?', [groupReg[0].id]);
        }

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            p.user_id,
            'Dalabka Lacag-bixinta',
            `Dalabkaaga lacag-bixinta ee $${p.amount} waa la ansixiyey! Adeegyadaadu hadda waa firfircoon yihiin.`
        );

        // Send WhatsApp notification if the user has a whatsapp_number
        const [userRows] = await db.execute('SELECT name, whatsapp_number, whatsapp_jid FROM users WHERE id = ? LIMIT 1', [p.user_id]);
        if (userRows.length > 0 && userRows[0].whatsapp_number) {
            const userPhone = userRows[0].whatsapp_number;
            const userJid = userRows[0].whatsapp_jid || userPhone;
            let planName = '';
            if (p.amount >= 11.0) {
                planName = 'Monthly Premium';
            } else if (isPromoPeriod && p.amount >= 2.0 && p.amount < 3.0) {
                planName = 'Monthly Basic 🎉 (Qiimaha Promo - $2)';
            } else if (p.amount >= 3.0) {
                planName = 'Monthly Basic';
            } else {
                planName = 'Pay as you go (100 Credits)';
            }
                    const approveMsg = `✅ Hambalyo waad isticmaali kartaa.`;
            let waSent = false;
            // Send via Cloud Bot
            try {
                const result = await whatsappCloudBot.sendCloudMessage(userPhone.replace(/^\+/, ''), approveMsg);
                if (result) {
                    waSent = true;
                }
            } catch (cErr) {
                console.error('[ADMIN APPROVE] Cloud bot failed:', cErr.message);
            }
        }

        let notice = '';
        if (userRows && userRows.length > 0 && userRows[0].whatsapp_number && !waSent) {
            notice = ' (Laakiin farriinta ogeysiiska WhatsApp-ku waa uu fashilmay)';
        }

        res.json({ message: `Lacag-bixinta waa la oggolaaday, xogta user-ka waa la cusboonaysiiyay!${notice}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday approval-ka' });
    }
});

router.post('/payments/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const [payment] = await db.execute('SELECT * FROM payments WHERE id = ?', [id]);
        if (payment.length === 0) return res.status(404).json({ message: 'Lama helin lacag-bixintan' });
        const p = payment[0];
        if (p.status !== 'pending') {
            return res.status(400).json({ message: 'Lacag-bixintan mar hore ayaa la go\'aamiyey (mar hore ayaa la ansixiyey ama la diiday).' });
        }

        await db.execute('UPDATE payments SET status = "rejected" WHERE id = ?', [id]);
        await db.execute('UPDATE users SET payment_status = "rejected" WHERE id = ?', [p.user_id]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            p.user_id,
            'Dalabka Lacag-bixinta',
            `Dalabkaaga lacag-bixinta ee $${p.amount} waa la diiday. Fadlan la xiriir caawiyaha.`
        );

        // Send WhatsApp notification if the user has a whatsapp_number
        const [userRows] = await db.execute('SELECT name, whatsapp_number, whatsapp_jid FROM users WHERE id = ? LIMIT 1', [p.user_id]);
        if (userRows.length > 0 && userRows[0].whatsapp_number) {
            const userPhone = userRows[0].whatsapp_number;
            const userJid = userRows[0].whatsapp_jid || userPhone;
            const rejectMsg = `❌ Lama aqbalin lacagta.`;
            let waRejSent = false;
            // Send via Cloud Bot
            try {
                const result = await whatsappCloudBot.sendCloudMessage(userPhone.replace(/^\+/, ''), rejectMsg);
                if (result) {
                    waRejSent = true;
                }
            } catch (cErr) {
                console.error('[ADMIN REJECT] Cloud bot failed:', cErr.message);
            }
        }

        let notice = '';
        if (userRows && userRows.length > 0 && userRows[0].whatsapp_number && !waRejSent) {
            notice = ' (Laakiin farriinta ogeysiiska WhatsApp-ku waa uu fashilmay)';
        }

        res.json({ message: `Lacag-bixinta waa la diiday!${notice}` });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

// 4. Exams Management
router.get('/exams', async (req, res) => {
    try {
        const [exams] = await db.execute('SELECT * FROM exams ORDER BY created_at DESC');
        res.json(exams);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin imtixaanaadka' });
    }
});

const ingestionService = require('../services/ingestionService');

router.post('/exams', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, description, category, grade, year, country } = req.body;
        let imageUrl = null;
        let pdfUrl = null;
        let pdfPath = null;
        let deletePDFLocallyAfterIngestion = false;

        if (req.files) {
            if (req.files['image']) {
                const localImagePath = path.join(__dirname, '..', 'uploads', req.files['image'][0].filename);
                imageUrl = await storageService.uploadFile(localImagePath, 'exams_images', true);
            } else {
                imageUrl = null;
            }
            if (req.files['pdf']) {
                pdfPath = path.join(__dirname, '..', 'uploads', req.files['pdf'][0].filename);
                pdfUrl = await storageService.uploadFile(pdfPath, 'exams_pdfs', false);
                if (pdfUrl && pdfUrl.startsWith('http')) {
                    deletePDFLocallyAfterIngestion = true;
                }
            } else {
                pdfUrl = null;
            }
        }

        const [result] = await db.execute(
            'INSERT INTO exams (title, description, category, grade, year, image_url, pdf_url, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, category || 'General', grade || 'Form 4', year || '2025', imageUrl, pdfUrl, country || null]
        );

        // Ingest into RAG in background
        if (pdfPath) {
            ingestionService.ingestPDF(result.insertId, 'exam', title, category, pdfPath, deletePDFLocallyAfterIngestion);
        }

        res.json({ message: 'Imtixaanka si guul leh ayaa loo soo geliyay! AI-duna hadda ayay bilaabaysaa barashada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta imtixaanka' });
    }
});

router.delete('/exams/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM exams WHERE id = ?', [req.params.id]);
        await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "exam"', [req.params.id]);
        clearEmbeddingsCache();
        res.json({ message: 'Imtixaanka waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

router.patch('/exams/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, category, grade, year, country } = req.body;
        
        const [exams] = await db.execute('SELECT * FROM exams WHERE id = ?', [id]);
        if (!exams.length) return res.status(404).json({ message: 'Imtixaanka lama helin' });
        
        let imageUrl = exams[0].image_url;
        let pdfUrl = exams[0].pdf_url;
        let pdfPath = null;
        let pdfChanged = false;
        let deletePDFLocallyAfterIngestion = false;

        if (req.files) {
            if (req.files['image']) {
                const localImagePath = path.join(__dirname, '..', 'uploads', req.files['image'][0].filename);
                imageUrl = await storageService.uploadFile(localImagePath, 'exams_images', true);
            }
            if (req.files['pdf']) {
                pdfPath = path.join(__dirname, '..', 'uploads', req.files['pdf'][0].filename);
                pdfUrl = await storageService.uploadFile(pdfPath, 'exams_pdfs', false);
                pdfChanged = true;
                if (pdfUrl && pdfUrl.startsWith('http')) {
                    deletePDFLocallyAfterIngestion = true;
                }
            }
        }

        await db.execute(
            'UPDATE exams SET title = ?, description = ?, category = ?, grade = ?, year = ?, image_url = ?, pdf_url = ?, country = ? WHERE id = ?',
            [
                title !== undefined ? title : exams[0].title,
                description !== undefined ? description : exams[0].description,
                category !== undefined ? category : exams[0].category,
                grade !== undefined ? grade : exams[0].grade,
                year !== undefined ? year : exams[0].year,
                imageUrl,
                pdfUrl,
                country !== undefined ? country : exams[0].country,
                id
            ]
        );

        if (pdfChanged && pdfPath) {
            await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "exam"', [id]);
            clearEmbeddingsCache();
            ingestionService.ingestPDF(id, 'exam', title || exams[0].title, category || exams[0].category, pdfPath, deletePDFLocallyAfterIngestion);
        }

        res.json({ message: 'Imtixaanka si guul leh ayaa loo cusboonaysiayey!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta imtixaanka' });
    }
});

// 5. Books Management
router.get('/books', async (req, res) => {
    try {
        const [books] = await db.execute('SELECT * FROM books ORDER BY created_at DESC');
        res.json(books);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin buugaagta' });
    }
});

router.post('/books', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, author, category, grade, country } = req.body;
        let imageUrl = null;
        let pdfUrl = null;
        let pdfPath = null;

        if (req.files) {
            if (req.files['image']) {
                const localImagePath = path.join(__dirname, '..', 'uploads', req.files['image'][0].filename);
                imageUrl = await storageService.uploadFile(localImagePath, 'books_images', true);
            }
            if (req.files['pdf']) {
                pdfPath = path.join(__dirname, '..', 'uploads', req.files['pdf'][0].filename);
                pdfUrl = await storageService.uploadFile(pdfPath, 'books_pdfs', true);
            }
        }

        const [result] = await db.execute(
            'INSERT INTO books (title, author, category, grade, image_url, pdf_url, country) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [title, author, category || 'General', grade || 'Form 4', imageUrl, pdfUrl, country || null]
        );

        res.json({ message: 'Buugga si guul leh ayaa loo soo geliyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta buugga' });
    }
});

router.delete('/books/:id', async (req, res) => {
    try {
        await db.execute('DELETE FROM books WHERE id = ?', [req.params.id]);
        await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "book"', [req.params.id]);
        clearEmbeddingsCache();
        res.json({ message: 'Buugga waa la tirtiray' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

router.patch('/books/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, author, category, grade, country } = req.body;
        
        const [books] = await db.execute('SELECT * FROM books WHERE id = ?', [id]);
        if (!books.length) return res.status(404).json({ message: 'Buugga lama helin' });
        
        let imageUrl = books[0].image_url;
        let pdfUrl = books[0].pdf_url;
        let pdfPath = null;
        let pdfChanged = false;

        if (req.files) {
            if (req.files['image']) {
                const localImagePath = path.join(__dirname, '..', 'uploads', req.files['image'][0].filename);
                imageUrl = await storageService.uploadFile(localImagePath, 'books_images', true);
            }
            if (req.files['pdf']) {
                pdfPath = path.join(__dirname, '..', 'uploads', req.files['pdf'][0].filename);
                pdfUrl = await storageService.uploadFile(pdfPath, 'books_pdfs', true);
                pdfChanged = true;
            }
        }

        await db.execute(
            'UPDATE books SET title = ?, author = ?, category = ?, grade = ?, image_url = ?, pdf_url = ?, country = ? WHERE id = ?',
            [
                title !== undefined ? title : books[0].title,
                author !== undefined ? author : books[0].author,
                category !== undefined ? category : books[0].category,
                grade !== undefined ? grade : books[0].grade,
                imageUrl,
                pdfUrl,
                country !== undefined ? country : books[0].country,
                id
            ]
        );

        if (pdfChanged && pdfPath) {
            await db.execute('DELETE FROM book_embeddings WHERE source_id = ? AND source_type = "book"', [id]);
            clearEmbeddingsCache();
        }

        res.json({ message: 'Buugga si guul leh ayaa loo cusboonaysiayey!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta buugga' });
    }
});

// 6. Group Management
router.get('/groups', async (req, res) => {
    try {
        const [groups] = await db.execute(`
            SELECT g.*, u.name as admin_name, u.username as admin_handle,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            (SELECT COUNT(*) FROM group_messages_v2 WHERE group_id = g.id) as message_count
            FROM groups_list g
            JOIN users u ON g.created_by = u.id
            ORDER BY g.created_at DESC
        `);
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin groups-ka' });
    }
});

router.post('/groups/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE groups_list SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ message: 'Status waa la bedelay!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.delete('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM groups_list WHERE id = ?', [id]);
        res.json({ message: 'Group-ka waa la tirtiray!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// ==========================================
// 7. Dynamic Promotional Cards CRUD Endpoints
// ==========================================

router.get('/promo-cards', async (req, res) => {
    try {
        const [cards] = await db.execute('SELECT * FROM promo_cards ORDER BY created_at DESC');
        res.json(cards);
    } catch (error) {
        res.status(500).json({ message: 'Lama helin promotional cards' });
    }
});

router.post('/promo-cards', upload.single('image'), async (req, res) => {
    try {
        const { title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type } = req.body;
        let imageUrl = null;

        if (req.file) {
            const localImagePath = path.join(__dirname, '..', 'uploads', req.file.filename);
            imageUrl = await storageService.uploadFile(localImagePath, 'promo_images', true);
        }

        if (!imageUrl) {
            return res.status(400).json({ message: 'Fadlan soo geli sawirka xayaysiiska.' });
        }

        await db.execute(
            `INSERT INTO promo_cards (title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, image_url, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title_en, title_so, desc_en, desc_so, 
                button_text_en, button_text_so, imageUrl, route, 
                overlay_color_light || 'rgba(29, 78, 216, 0.65)', 
                overlay_color_dark || 'rgba(30, 41, 59, 0.75)',
                parseInt(reward_credits) || 0,
                reward_type || null,
                promo_type || 'normal'
            ]
        );

        res.json({ message: 'Xayaysiiska si guul leh ayaa loo soo geliyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo gelinta xayaysiiska' });
    }
});

router.put('/promo-cards/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, reward_credits, reward_type, promo_type } = req.body;
        
        let query = `UPDATE promo_cards SET title_en = ?, title_so = ?, desc_en = ?, desc_so = ?, button_text_en = ?, button_text_so = ?, route = ?, overlay_color_light = ?, overlay_color_dark = ?, reward_credits = ?, reward_type = ?, promo_type = ?`;
        let params = [title_en, title_so, desc_en, desc_so, button_text_en, button_text_so, route, overlay_color_light, overlay_color_dark, parseInt(reward_credits) || 0, reward_type || null, promo_type || 'normal'];

        if (req.file) {
            const localImagePath = path.join(__dirname, '..', 'uploads', req.file.filename);
            const imageUrl = await storageService.uploadFile(localImagePath, 'promo_images', true);
            query += `, image_url = ?`;
            params.push(imageUrl);
        }

        query += ` WHERE id = ?`;
        params.push(id);

        await db.execute(query, params);
        res.json({ message: 'Xayaysiiska waa la cusboonaysiiyay!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta' });
    }
});

router.put('/promo-cards/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE promo_cards SET is_active = NOT is_active WHERE id = ?', [id]);
        res.json({ message: 'Status-ka xayaysiiska waa la bedelay!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.delete('/promo-cards/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM promo_cards WHERE id = ?', [id]);
        res.json({ message: 'Xayaysiiska waa la tirtiray!' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista' });
    }
});

// ==========================================
// 8. Dynamic Promotional Card Claims & Rewards
// ==========================================

router.get('/promo-claims', async (req, res) => {
    try {
        const [claims] = await db.execute(`
            SELECT c.id, c.user_id, c.promo_card_id, c.screenshot_url, c.status, c.claimed_at,
                   u.name as user_name, u.email as user_email, u.whatsapp_number as user_whatsapp,
                   p.title_en as promo_title_en, p.title_so as promo_title_so, p.reward_credits, p.reward_type
            FROM user_claimed_promos c
            JOIN users u ON c.user_id = u.id
            JOIN promo_cards p ON c.promo_card_id = p.id
            ORDER BY c.claimed_at DESC
        `);
        res.json(claims);
    } catch (error) {
        console.error('Error fetching promo claims:', error);
        res.status(500).json({ message: 'Lama helin dalabyada abaalmarinta' });
    }
});

router.post('/promo-claims/:id/approve', async (req, res) => {
    try {
        const claimId = req.params.id;

        // Fetch claim details
        const [claimRows] = await db.execute('SELECT * FROM user_claimed_promos WHERE id = ?', [claimId]);
        if (claimRows.length === 0) {
            return res.status(404).json({ message: 'Dalabkan lama helin' });
        }

        const claim = claimRows[0];
        if (claim.status === 'approved') {
            return res.status(400).json({ message: 'Dalabkan mar hore ayaa la ansixiyey' });
        }

        // Fetch promo details
        const [promoRows] = await db.execute('SELECT reward_credits, reward_type FROM promo_cards WHERE id = ?', [claim.promo_card_id]);
        if (promoRows.length === 0) {
            return res.status(404).json({ message: 'Xayaysiiskan asalka u ahaa lama helin' });
        }

        const promo = promoRows[0];

        // Award credits to user
        if (promo.reward_credits > 0) {
            if (promo.reward_type === 'standard') {
                const [walletRows] = await db.execute('SELECT * FROM user_wallet WHERE user_id = ?', [claim.user_id]);
                if (walletRows.length === 0) {
                    await db.execute('INSERT INTO user_wallet (user_id, balance) VALUES (?, ?)', [claim.user_id, promo.reward_credits]);
                } else {
                    await db.execute('UPDATE user_wallet SET balance = balance + ? WHERE user_id = ?', [promo.reward_credits, claim.user_id]);
                }
            } else if (promo.reward_type === 'shukaansi') {
                const [walletRows] = await db.execute('SELECT * FROM shukaansi_wallet WHERE user_id = ?', [claim.user_id]);
                if (walletRows.length === 0) {
                    await db.execute('INSERT INTO shukaansi_wallet (user_id, balance) VALUES (?, ?)', [claim.user_id, promo.reward_credits]);
                } else {
                    await db.execute('UPDATE shukaansi_wallet SET balance = balance + ? WHERE user_id = ?', [promo.reward_credits, claim.user_id]);
                }
            }
        }

        // Mark claim as approved
        await db.execute('UPDATE user_claimed_promos SET status = "approved" WHERE id = ?', [claimId]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            claim.user_id,
            `Abaalmarinta ${claim.promo_title_so || 'Xayaysiiska'}`,
            `Dalabkaaga abaalmarinta waa la ansixiyey! Waxaa lagugu shubay +${promo.reward_credits} Credits.`
        );

        res.json({ message: 'Dalabka si guul leh ayaa loo ansixiyey, abaalmarintiina waa la siiyey!' });

    } catch (error) {
        console.error('Error approving claim:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray ansixinta' });
    }
});

router.post('/promo-claims/:id/reject', async (req, res) => {
    try {
        const claimId = req.params.id;

        const [claimRows] = await db.execute(`
            SELECT c.*, p.title_so as promo_title_so 
            FROM user_claimed_promos c
            JOIN promo_cards p ON c.promo_card_id = p.id
            WHERE c.id = ?
        `, [claimId]);
        if (claimRows.length === 0) {
            return res.status(404).json({ message: 'Dalabkan lama helin' });
        }
        const claim = claimRows[0];

        // Delete from database to clear the state and allow retry
        await db.execute('DELETE FROM user_claimed_promos WHERE id = ?', [claimId]);

        // Send push notification
        const pushService = require('../services/pushNotificationService');
        await pushService.sendPushNotification(
            claim.user_id,
            'Dalabka Abaalmarinta',
            `Dalabkaaga abaalmarinta ee ${claim.promo_title_so || 'xayaysiiska'} waa la diiday. Fadlan dib u soo dir sawir ka duwan oo sax ah.`
        );

        res.json({ message: 'Dalabkii waa la diiday, waana la tirtiray si uu qofku dib ugu soo upload-gareeyo.' });
    } catch (error) {
        console.error('Error rejecting claim:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray diidmada' });
    }
});

// --- TOURNAMENT MANAGEMENT ENDPOINTS ---

// 1. Get Tournament Settings
router.get('/tournament/settings', async (req, res) => {
    try {
        const [settings] = await db.execute('SELECT * FROM tournament_settings WHERE id = 1');
        if (settings.length === 0) {
            return res.status(404).json({ message: 'Settings lama helin' });
        }
        res.json(settings[0]);
    } catch (error) {
        console.error('Error fetching tournament settings:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta settings-ka' });
    }
});

// 2. Update Tournament Settings
router.post('/tournament/settings', async (req, res) => {
    try {
        const { 
            is_active, 
            reveal_leaderboard,
            reward_description,
            gen_ad_title,
            gen_ad_desc,
            gen_ad_btn_text,
            gen_ad_btn_route,
            result_ad_title,
            result_ad_desc,
            result_ad_btn_text,
            result_ad_btn_route
        } = req.body;
        
        await db.execute(
            `UPDATE tournament_settings SET 
                is_active = ?, 
                reveal_leaderboard = ?,
                reward_description = ?,
                gen_ad_title = ?,
                gen_ad_desc = ?,
                gen_ad_btn_text = ?,
                gen_ad_btn_route = ?,
                result_ad_title = ?,
                result_ad_desc = ?,
                result_ad_btn_text = ?,
                result_ad_btn_route = ?
             WHERE id = 1`,
            [
                is_active !== undefined ? is_active : 1, 
                reveal_leaderboard !== undefined ? reveal_leaderboard : 0,
                reward_description || '',
                gen_ad_title || '',
                gen_ad_desc || '',
                gen_ad_btn_text || '',
                gen_ad_btn_route || '',
                result_ad_title || '',
                result_ad_desc || '',
                result_ad_btn_text || '',
                result_ad_btn_route || ''
            ]
        );
        res.json({ message: 'Settings-ka tartanka si guul leh ayaa loo cusboonaysiiyey!' });
    } catch (error) {
        console.error('Error updating tournament settings:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta settings-ka' });
    }
});

// 3. Get Contestants List
router.get('/tournament/contestants', async (req, res) => {
    try {
        const [contestants] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.email, 
                u.whatsapp_number, 
                u.xp, 
                u.is_suspended_from_tournament, 
                u.tournament_opt_in, 
                u.created_at,
                (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = u.id) AS total_attempts,
                (SELECT MAX(created_at) FROM quiz_attempts WHERE user_id = u.id) AS last_attempt_at
            FROM users u
            WHERE u.tournament_opt_in = 1
            ORDER BY u.xp DESC, u.id ASC
        `);
        res.json(contestants);
    } catch (error) {
        console.error('Error fetching contestants:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta tartamayaasha' });
    }
});

// 4. Adjust Contestant XP
router.post('/tournament/contestants/:id/adjust-xp', async (req, res) => {
    try {
        const contestantId = req.params.id;
        const { amount } = req.body;

        if (amount === undefined || isNaN(Number(amount))) {
            return res.status(400).json({ message: 'Fadlan qor dhibco (XP) sax ah' });
        }

        await db.execute('UPDATE users SET xp = xp + ? WHERE id = ?', [Number(amount), contestantId]);
        res.json({ message: `Dhibcaha (XP) tartamaha si guul leh ayaa loogu beddelay ${amount > 0 ? '+' : ''}${amount}!` });
    } catch (error) {
        console.error('Error adjusting XP:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray beddelista XP' });
    }
});

// 5. Toggle Contestant Suspension from Tournament
router.post('/tournament/contestants/:id/toggle-suspend', async (req, res) => {
    try {
        const contestantId = req.params.id;
        const [user] = await db.execute('SELECT is_suspended_from_tournament FROM users WHERE id = ?', [contestantId]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'Contestant lama helin' });
        }

        const newStatus = user[0].is_suspended_from_tournament ? 0 : 1;
        await db.execute('UPDATE users SET is_suspended_from_tournament = ? WHERE id = ?', [newStatus, contestantId]);

        res.json({ 
            message: newStatus 
                ? 'Si guul leh ayaa tartamaya looga joojiyey tartanka!' 
                : 'Si guul leh ayaa loogu fasaxay inuu tartanka dib ugu soo laabto!' 
        });
    } catch (error) {
        console.error('Error toggling tournament suspension:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday badalida suspension-ka' });
    }
});

// ==========================================
// OVERHAUL ROUTING: New dashboard endpoints
// ==========================================

// Update user email
router.put('/users/:id/email', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;
        
        const [currentUser] = await db.execute('SELECT name, email FROM users WHERE id = ?', [id]);
        if (currentUser.length === 0) {
            return res.status(404).json({ message: 'User-ka lama helin' });
        }
        
        await db.execute('UPDATE users SET email = ? WHERE id = ?', [email ? email.trim().toLowerCase() : null, id]);
        
        await logAdminAction(
            req.user.id,
            'UPDATE_USER_EMAIL',
            `Changed email for user "${currentUser[0].name}" (ID: ${id}) from "${currentUser[0].email}" to "${email}"`
        );
        
        res.json({ status: 'success', message: 'Email-ka user-ka waa la cusboonaysiiyay!' });
    } catch (error) {
        console.error('Error updating user email:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday cusboonaysiinta email-ka' });
    }
});

// AI usage stats
router.get('/ai-stats', async (req, res) => {
    try {
        const [totalStats] = await db.execute(`
            SELECT 
                COUNT(*) as totalRequests,
                SUM(prompt_tokens) as totalPromptTokens,
                SUM(completion_tokens) as totalCompletionTokens,
                SUM(cost) as totalCost
            FROM ai_usage_logs
        `);

        const [modelStats] = await db.execute(`
            SELECT 
                model_name as modelName,
                COUNT(*) as requests,
                SUM(prompt_tokens) as promptTokens,
                SUM(completion_tokens) as completionTokens,
                SUM(cost) as cost
            FROM ai_usage_logs
            GROUP BY model_name
        `);

        const [chatTypeStats] = await db.execute(`
            SELECT 
                chat_type as chatType,
                COUNT(*) as requests,
                SUM(cost) as cost
            FROM ai_usage_logs
            GROUP BY chat_type
        `);

        const [topUsers] = await db.execute(`
            SELECT 
                u.id,
                u.name,
                u.username,
                COUNT(l.id) as requests,
                SUM(l.prompt_tokens) as promptTokens,
                SUM(l.completion_tokens) as completionTokens,
                SUM(l.cost) as cost
            FROM ai_usage_logs l
            JOIN users u ON l.user_id = u.id
            GROUP BY u.id
            ORDER BY cost DESC
            LIMIT 10
        `);

        const [chartData] = await db.execute(`
            SELECT 
                DATE(created_at) as date,
                SUM(prompt_tokens + completion_tokens) as tokens,
                SUM(cost) as cost,
                COUNT(*) as requests
            FROM ai_usage_logs
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        res.json({
            summary: totalStats[0] || { totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0 },
            models: modelStats,
            chatTypes: chatTypeStats,
            topUsers,
            chartData: chartData.map(item => ({
                name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                tokens: parseInt(item.tokens) || 0,
                cost: parseFloat(item.cost) || 0,
                requests: parseInt(item.requests) || 0
            }))
        });
    } catch (error) {
        console.error('Error fetching AI stats:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday AI stats-ka' });
    }
});

// Custom reports (dynamic real data)
router.get('/reports', async (req, res) => {
    try {
        const { range } = req.query; // '7', '30', '60', '90', 'all'
        let intervalSql = '';
        if (range === '7') {
            intervalSql = "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (range === '30') {
            intervalSql = "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        } else if (range === '60') {
            intervalSql = "AND created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)";
        } else if (range === '90') {
            intervalSql = "AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";
        }

        const revenueQuery = `SELECT SUM(amount) as total FROM payments WHERE status = "approved" ${intervalSql}`;
        const [revRes] = await db.execute(revenueQuery);
        const totalRevenue = parseFloat(revRes[0].total) || 0;

        const aiCostQuery = `SELECT SUM(cost) as total FROM ai_usage_logs WHERE 1=1 ${intervalSql}`;
        const [aiCostRes] = await db.execute(aiCostQuery);
        const totalAICost = parseFloat(aiCostRes[0].total) || 0;

        const netProfit = totalRevenue - totalAICost;

        const usersQuery = `SELECT COUNT(*) as count FROM users WHERE 1=1 ${intervalSql}`;
        const [usersRes] = await db.execute(usersQuery);
        const newUsers = usersRes[0].count;

        const approvedPaymentsQuery = `SELECT COUNT(*) as count FROM payments WHERE status = "approved" ${intervalSql}`;
        const [payRes] = await db.execute(approvedPaymentsQuery);
        const approvedPaymentsCount = payRes[0].count;

        const activeAIChatsQuery = `SELECT COUNT(DISTINCT user_id) as count FROM messages_private WHERE 1=1 ${intervalSql}`;
        const [chatsRes] = await db.execute(activeAIChatsQuery);
        const activeAIChats = chatsRes[0].count;

        const recentTxQuery = `
            SELECT p.*, u.name as user_name, u.email as user_email
            FROM payments p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT 10
        `;
        const [recentTx] = await db.execute(recentTxQuery);

        let chartDataQuery = '';
        if (range === '7') {
            chartDataQuery = `
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM users 
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                GROUP BY DATE(created_at) ORDER BY date ASC
            `;
        } else {
            chartDataQuery = `
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM users 
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at) ORDER BY date ASC
            `;
        }
        const [chartRes] = await db.execute(chartDataQuery);
        const signupChartData = chartRes.map(item => ({
            name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            users: item.count
        }));

        res.json({
            summary: {
                totalRevenue,
                totalAICost,
                netProfit,
                newUsers,
                approvedPaymentsCount,
                activeAIChats
            },
            recentTransactions: recentTx,
            signupChartData
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo saarista reports-ka' });
    }
});

// App Settings CRUD
router.get('/settings', async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM app_settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ message: 'Error fetching settings' });
    }
});

router.put('/settings', async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await db.execute(
                `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE setting_value = ?`,
                [key, String(value), String(value)]
            );
        }
        await logAdminAction(req.user.id, 'UPDATE_SETTINGS', `Updated system configuration settings.`);
        res.json({ status: 'success', message: 'Settings-ka si guul leh ayaa loo cusboonaysiiyey!' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
});

// Safe reset/cleanup of database (preserving books/exams/users)
router.post('/reset-data', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa tirtiri kara xogta tijaabada!' });
        }

        console.log(`[CLEANUP] Starting database cleanup, initiated by SuperAdmin ID: ${req.user.id}`);

        // Truncate/delete testing tables
        await db.execute('DELETE FROM payments');
        await db.execute('DELETE FROM messages_private');
        await db.execute('DELETE FROM messages_group');
        await db.execute('DELETE FROM group_messages_v2');
        await db.execute('DELETE FROM shukaansi_messages');
        await db.execute('DELETE FROM chat_sessions');
        await db.execute('DELETE FROM user_claimed_promos');
        await db.execute('DELETE FROM quiz_attempts');
        await db.execute('DELETE FROM ai_usage_logs');
        
        // Reset wallets & free usage limits to 0
        await db.execute('UPDATE user_wallet SET balance = 0');
        await db.execute('UPDATE shukaansi_wallet SET balance = 0');
        await db.execute('UPDATE user_free_ai_usage SET free_text_used = 0, free_image_used = 0');

        await logAdminAction(req.user.id, 'DATABASE_RESET', 'Cleared test data (payments, chats, sessions, claims, quiz attempts). Preserved users, schools, classes, books, and exams.');

        res.json({ 
            status: 'success', 
            message: 'Si guul leh ayaa loo tirtiray xogta tijaabada (lacag-bixinta, fariimaha, sessions-ka) iyadoo la badbaadiyey users, books iyo exams!' 
        });
    } catch (error) {
        console.error('Error in database cleanup:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray tirtirista xogta' });
    }
});

// Admin management: List admins (superadmin only)
router.get('/admins', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa geli kara qaybtan' });
        }

        const [admins] = await db.execute(`
            SELECT id, name, username, email, role, is_suspended, created_at
            FROM users
            WHERE role IN ('admin', 'superadmin')
            ORDER BY created_at DESC
        `);
        res.json(admins);
    } catch (error) {
        console.error('Error fetching admins:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista admins-ka' });
    }
});

// Create new admin (superadmin only)
router.post('/admins', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa abuuri kara admins cusub' });
        }

        const { name, username, email, whatsapp_number, password, role } = req.body;
        if (!name || !username || !email || !password) {
            return res.status(400).json({ message: 'Fadlan buuxi dhamaan xogta lagama maarmaanka ah' });
        }

        const [existing] = await db.execute('SELECT id FROM users WHERE email = ? OR username = ?', [email.trim().toLowerCase(), username.trim().toLowerCase()]);
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email ama Username kan mar hore ayaa la isticmaalay' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const adminRole = role === 'superadmin' ? 'superadmin' : 'admin';

        const [result] = await db.execute(
            `INSERT INTO users (name, username, email, whatsapp_number, password, role, is_verified)
             VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
            [name, username.trim().toLowerCase(), email.trim().toLowerCase(), whatsapp_number || null, hashedPassword, adminRole]
        );

        await logAdminAction(
            req.user.id,
            'CREATE_ADMIN',
            `Created new admin "${name}" (Email: ${email}, Role: ${adminRole})`
        );

        res.json({ status: 'success', message: 'Admin-ka si guul leh ayaa loo abuuray!', adminId: result.insertId });
    } catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday abuurista admin-ka' });
    }
});

// Suspend/unsuspend admin (superadmin only)
router.post('/admins/:id/suspend', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa xadidi kara admins' });
        }

        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ message: 'Iskama joojin kartid koontadaada!' });
        }

        const [admins] = await db.execute('SELECT name, role, is_suspended FROM users WHERE id = ? AND role IN ("admin", "superadmin")', [id]);
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin-ka lama helin' });
        }

        const admin = admins[0];
        const newStatus = admin.is_suspended ? 0 : 1;
        await db.execute('UPDATE users SET is_suspended = ? WHERE id = ?', [newStatus, id]);

        await logAdminAction(
            req.user.id,
            newStatus ? 'SUSPEND_ADMIN' : 'UNSUSPEND_ADMIN',
            `${newStatus ? 'Suspended' : 'Unsuspended'} admin user "${admin.name}" (ID: ${id})`
        );

        res.json({
            status: 'success',
            message: newStatus ? 'Admin-ka waa la laalay (Suspended)' : 'Admin-ka waa laga qaaday laaliddii (Active)',
            is_suspended: newStatus
        });
    } catch (error) {
        console.error('Error suspending admin:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

// Delete admin (superadmin only)
router.delete('/admins/:id', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa tirtiri kara admins' });
        }

        const { id } = req.params;
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ message: 'Ma tirtiri kartid koontadaada!' });
        }

        const [admins] = await db.execute('SELECT name FROM users WHERE id = ? AND role IN ("admin", "superadmin")', [id]);
        if (admins.length === 0) {
            return res.status(404).json({ message: 'Admin-ka lama helin' });
        }

        await db.execute('DELETE FROM users WHERE id = ?', [id]);

        await logAdminAction(
            req.user.id,
            'DELETE_ADMIN',
            `Deleted admin user "${admins[0].name}" (ID: ${id})`
        );

        res.json({ status: 'success', message: 'Admin-kii waa la tirtiray!' });
    } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday tirtirista admin-ka' });
    }
});

// Get admin logs (superadmin only)
router.get('/admin-logs', async (req, res) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Super Admin ayaa arki kara logs-ka' });
        }

        const [logs] = await db.execute(`
            SELECT l.*, u.name as admin_name, u.email as admin_email, u.role as admin_role
            FROM admin_logs l
            JOIN users u ON l.admin_id = u.id
            ORDER BY l.created_at DESC
            LIMIT 100
        `);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching admin logs:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista logs-ka' });
    }
});

// ─── WhatsApp Bot Admin Dashboard Endpoints ────────────────────────────────────

// 1. WhatsApp Bot Overview Stats
router.get('/whatsapp/stats', async (req, res) => {
    try {
        const cloudActive = !!(process.env.META_WA_PHONE_NUMBER_ID && process.env.META_WA_ACCESS_TOKEN);

        // Inta qof ee maanta lasoo hadlay (unique user_ids today)
        const [todayUsersRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id IS NULL AND sender = 'user' AND created_at >= CURDATE()
        `);
        const todayUsers = todayUsersRow[0]?.count || 0;

        // Fariimaha (24h, 2d/48h, 7d, 30d) - users/ai split
        const [messagesRow] = await db.execute(`
            SELECT 
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as user_24h,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as ai_24h,
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR) THEN 1 ELSE 0 END) as user_48h,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR) THEN 1 ELSE 0 END) as ai_48h,
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as user_7d,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as ai_7d,
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as user_30d,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as ai_30d
            FROM messages_private
            WHERE session_id IS NULL
        `);

        // Gemini cost
        const [geminiCostRow] = await db.execute(`
            SELECT SUM(cost) as total_cost 
            FROM ai_usage_logs 
            WHERE platform = 'whatsapp'
        `);
        const geminiCost = parseFloat(geminiCostRow[0]?.total_cost || 0);

        // DAU, MAU, YAU (WhatsApp specific)
        const [dauRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id IS NULL AND sender = 'user' AND created_at >= CURDATE()
        `);
        const [mauRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id IS NULL AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
        const [yauRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id IS NULL AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)
        `);

        // Groups counts
        const [groupsCountRow] = await db.execute(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
            FROM whatsapp_group_stats
        `);

        res.json({
            status: {
                localBot: 'disabled',
                cloudBot: cloudActive ? 'active' : 'inactive'
            },
            todayUsersCount: todayUsers,
            messages: messagesRow[0] || {
                user_24h: 0, ai_24h: 0,
                user_48h: 0, ai_48h: 0,
                user_7d: 0, ai_7d: 0,
                user_30d: 0, ai_30d: 0
            },
            geminiCost,
            activeUsers: {
                daily: dauRow[0]?.count || 0,
                monthly: mauRow[0]?.count || 0,
                yearly: yauRow[0]?.count || 0
            },
            groups: {
                total: groupsCountRow[0]?.total || 0,
                active: groupsCountRow[0]?.active_count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching WhatsApp admin stats:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday stats-ka bot-ka' });
    }
});

// 2. WhatsApp Bot Users list with detailed counts
router.get('/whatsapp/users', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.whatsapp_number, 
                u.role, 
                u.is_suspended,
                COALESCE(uw.balance, 0) as balance,
                us.type as plan_type,
                us.expiry_date,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NULL AND sender = 'user') as msg_to_bot,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id IS NULL AND sender = 'ai') as msg_from_bot,
                (SELECT COUNT(*) FROM ai_usage_logs WHERE user_id = u.id AND chat_type = 'image' AND platform = 'whatsapp') as img_count,
                (SELECT COUNT(*) FROM ai_usage_logs WHERE user_id = u.id AND chat_type = 'voice' AND platform = 'whatsapp') as voice_count
            FROM users u
            LEFT JOIN user_wallet uw ON u.id = uw.user_id
            LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.expiry_date > NOW() AND COALESCE(uw.balance, 0) > 0
            WHERE u.whatsapp_number IS NOT NULL 
               OR u.id IN (SELECT DISTINCT user_id FROM messages_private WHERE session_id IS NULL)
            ORDER BY u.id DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching WhatsApp users:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista users-ka' });
    }
});

// 3. WhatsApp Groups list
router.get('/whatsapp/groups', async (req, res) => {
    try {
        const [groups] = await db.execute('SELECT * FROM whatsapp_group_stats ORDER BY last_activity DESC');
        res.json(groups);
    } catch (error) {
        console.error('Error fetching WhatsApp groups:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista groups' });
    }
});

// 4. Telegram Bot Stats
router.get('/telegram/stats', async (req, res) => {
    try {
        const [active24hRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id = 'telegram' AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `);
        const active24h = active24hRow[0]?.count || 0;

        const [active7dRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id = 'telegram' AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
        const active7d = active7dRow[0]?.count || 0;

        const [active30dRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id = 'telegram' AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
        const active30d = active30dRow[0]?.count || 0;

        const [active90dRow] = await db.execute(`
            SELECT COUNT(DISTINCT user_id) as count 
            FROM messages_private 
            WHERE session_id = 'telegram' AND sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        `);
        const active90d = active90dRow[0]?.count || 0;

        const [totalUsersRow] = await db.execute(`
            SELECT COUNT(*) as count FROM telegram_users
        `);
        const totalUsers = totalUsersRow[0]?.count || 0;

        const [messagesRow] = await db.execute(`
            SELECT 
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as user_24h,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as ai_24h,
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as user_7d,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as ai_7d,
                SUM(CASE WHEN sender = 'user' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as user_30d,
                SUM(CASE WHEN sender = 'ai' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as ai_30d
            FROM messages_private
            WHERE session_id = 'telegram'
        `);

        const [geminiCostRow] = await db.execute(`
            SELECT SUM(cost) as total_cost 
            FROM ai_usage_logs 
            WHERE platform = 'telegram'
        `);
        const geminiCost = parseFloat(geminiCostRow[0]?.total_cost || 0);

        res.json({
            totalUsers,
            activeUsers: {
                daily: active24h,
                weekly: active7d,
                monthly: active30d,
                quarterly: active90d
            },
            messages: messagesRow[0] || {
                user_24h: 0, ai_24h: 0,
                user_7d: 0, ai_7d: 0,
                user_30d: 0, ai_30d: 0
            },
            geminiCost
        });
    } catch (error) {
        console.error('Error fetching Telegram admin stats:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday stats-ka bot-ka' });
    }
});

// 5. Telegram Users List
router.get('/telegram/users', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.whatsapp_number, 
                u.role, 
                u.is_suspended,
                tu.telegram_chat_id,
                tu.created_at as linked_at,
                COALESCE(uw.balance, 0) as balance,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id = 'telegram' AND sender = 'user') as msg_to_bot,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND session_id = 'telegram' AND sender = 'ai') as msg_from_bot,
                (SELECT COUNT(*) FROM ai_usage_logs WHERE user_id = u.id AND chat_type = 'image' AND platform = 'telegram') as img_count,
                (SELECT COUNT(*) FROM ai_usage_logs WHERE user_id = u.id AND chat_type = 'voice' AND platform = 'telegram') as voice_count,
                (SELECT MAX(created_at) FROM messages_private WHERE user_id = u.id AND session_id = 'telegram') as last_activity
            FROM telegram_users tu
            JOIN users u ON tu.user_id = u.id
            LEFT JOIN user_wallet uw ON u.id = uw.user_id
            ORDER BY last_activity DESC, tu.created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching Telegram users:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista users-ka' });
    }
});

// 6. Credits and Subscriptions List
router.get('/users/credits-subscriptions', async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, 
                u.name, 
                u.username, 
                u.email,
                u.whatsapp_number, 
                u.role, 
                u.is_suspended, 
                u.created_at,
                COALESCE(uw.balance, 0) AS credits,
                COALESCE(sw.balance, 0) AS shukaansi_credits,
                us.type as plan_type,
                us.expiry_date,
                (SELECT COUNT(*) FROM messages_private WHERE user_id = u.id AND sender = 'user') AS private_messages_count
            FROM users u
            LEFT JOIN user_wallet uw ON u.id = uw.user_id
            LEFT JOIN shukaansi_wallet sw ON u.id = sw.user_id
            LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.expiry_date > NOW()
            WHERE COALESCE(uw.balance, 0) > 0 
               OR COALESCE(sw.balance, 0) > 0
               OR us.id IS NOT NULL
            ORDER BY COALESCE(uw.balance, 0) DESC, u.created_at DESC
        `);
        res.json(users);
    } catch (error) {
        console.error('Error fetching credits and subscriptions:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo qaadista isticmaalayaasha' });
    }
});

// 7. Adjust User Credits
router.post('/users/:id/adjust-credits', async (req, res) => {
    try {
        const userId = req.params.id;
        const { amount, walletType } = req.body; // walletType: 'general' or 'shukaansi'
        const table = walletType === 'shukaansi' ? 'shukaansi_wallet' : 'user_wallet';
        
        if (typeof amount !== 'number') {
            return res.status(400).json({ message: 'Amount-ku waa inuu tiro noqdaa' });
        }

        const [userCheck] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (userCheck.length === 0) {
            return res.status(404).json({ message: 'Isticmaalaha lama helin' });
        }

        // Check if wallet entry exists
        const [walletCheck] = await db.execute(`SELECT user_id FROM ${table} WHERE user_id = ?`, [userId]);
        if (walletCheck.length === 0) {
            const startBalance = Math.max(0, amount);
            await db.execute(`INSERT INTO ${table} (user_id, balance) VALUES (?, ?)`, [userId, startBalance]);
        } else {
            await db.execute(`UPDATE ${table} SET balance = GREATEST(0, balance + ?) WHERE user_id = ?`, [amount, userId]);
        }

        const [newBalanceRow] = await db.execute(`SELECT balance FROM ${table} WHERE user_id = ?`, [userId]);
        const newBalance = newBalanceRow[0]?.balance || 0;

        res.json({ status: 'success', message: 'Dheelitirka credit-ka waa la cusboonaysiiyay!', newBalance });
    } catch (error) {
        console.error('Error adjusting user credits:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday beddelista credit-ka' });
    }
});

module.exports = router;

