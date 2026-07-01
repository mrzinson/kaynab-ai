const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');
const { checkAndExpireWallet } = require('../utils/walletHelper');
const multer = require('multer');
const path = require('path');
const storageService = require('../services/storageService');

const fs = require('fs');

// Robustly resolve and create uploads directory inside the backend folder
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Setup for Screenshot Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Soo akhrinta Imtixaanaadka (Filtered by Region)
router.get('/exams', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute('SELECT country, region_state FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = users[0];

        let exams;
        if (user.country === 'Somaliland') {
            [exams] = await db.execute(
                `SELECT * FROM exams 
                 WHERE country = 'Somaliland'
                 ORDER BY created_at DESC`
            );
        } else if (user.country === 'Puntland') {
            [exams] = await db.execute(
                `SELECT * FROM exams 
                 WHERE country = 'Puntland'
                 ORDER BY created_at DESC`
            );
        } else if (user.country === 'Somalia') {
            [exams] = await db.execute(
                `SELECT * FROM exams 
                 WHERE country = 'Somalia'
                 ORDER BY created_at DESC`
            );
        } else {
            // Other countries or not set
            [exams] = await db.execute(
                `SELECT * FROM exams 
                 WHERE country IS NULL OR country = 'General' OR country = 'All' OR country = 'Guud'
                 ORDER BY created_at DESC`
            );
        }
        res.json(exams);
    } catch (error) {
        console.error('Error fetching exams:', error);
        res.status(500).json({ message: 'Lama helin imtixaanaadka' });
    }
});

// Soo akhrinta Buugta Manhajka (Filtered by Region)
router.get('/books', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute('SELECT country, region_state FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'User not found' });
        const user = users[0];

        let books;
        if (user.country === 'Somaliland') {
            [books] = await db.execute(
                `SELECT * FROM books 
                 WHERE country = 'Somaliland'
                 ORDER BY created_at DESC`
            );
        } else if (user.country === 'Puntland') {
            [books] = await db.execute(
                `SELECT * FROM books 
                 WHERE country = 'Puntland'
                 ORDER BY created_at DESC`
            );
        } else if (user.country === 'Somalia') {
            [books] = await db.execute(
                `SELECT * FROM books 
                 WHERE country = 'Somalia'
                 ORDER BY created_at DESC`
            );
        } else {
            // Other countries or not set
            [books] = await db.execute(
                `SELECT * FROM books 
                 WHERE country IS NULL OR country = 'General' OR country = 'All' OR country = 'Guud'
                 ORDER BY created_at DESC`
            );
        }
        res.json(books);
    } catch (error) {
        console.error('Error fetching books:', error);
        res.status(500).json({ message: 'Lama helin buugta' });
    }
});

// Soo akhrinta User Profile (with Wallet balance)
router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        // Expire pay-as-you-go balance if inactive for 1 month
        await checkAndExpireWallet(userId);

        const [user] = await db.execute(`
            SELECT u.id, u.name, u.email, u.whatsapp_number, u.username, u.profile_picture, u.role,
                   u.payment_status, u.payment_reference, u.is_verified, u.terms_accepted_at,
                   u.gender, u.country, u.region_state,
                   (SELECT balance FROM user_wallet WHERE user_id = u.id) as balance,
                   (SELECT type FROM user_subscriptions WHERE user_id = u.id AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = u.id) > 0 LIMIT 1) as subscription_type
            FROM users u WHERE u.id = ?
        `, [userId]);

        if (user.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json({ user: user[0] });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

router.get('/search', auth, userController.searchUsers);

// Cusboonaysiinta Profile-ka
router.put('/profile', auth, userController.updateProfile);

// Tirtirida Akoonka User-ka (Account Deletion for Play Store Compliance)
router.delete('/account', auth, async (req, res) => {
    try {
        const userId = req.user.id;

        // Tirtir xogta la xiriirta user-ka (ignore errors for tables that may not exist)
        const tables = [
            'chat_history_v2',
            'shukaansi_messages',
            'user_wallet',
            'user_subscriptions',
            'group_members',
            'user_claimed_promos',
            'payments'
        ];

        for (const table of tables) {
            try {
                await db.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
            } catch (e) {
                // Ignore if table doesn't exist or column name differs
                console.warn(`[DeleteAccount] Skipped table ${table}:`, e.message);
            }
        }

        // Tirtir user-ka laftiisa
        await db.execute('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Akoonkaaga si guul leh ayaa loo tirtiray.' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday, fadlan dib isku day.' });
    }
});

// Soo akhrinta Promotional Cards with Claim Status
router.get('/promo-cards', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [cards] = await db.execute('SELECT * FROM promo_cards WHERE is_active = 1 ORDER BY created_at DESC');
        
        // Fetch all claims for this user
        const [claims] = await db.execute('SELECT promo_card_id, status FROM user_claimed_promos WHERE user_id = ?', [userId]);
        const claimMap = {};
        claims.forEach(c => {
            claimMap[c.promo_card_id] = c.status;
        });

        // Map claim info to cards
        const cardsWithClaim = cards.map(card => ({
            ...card,
            claim_status: claimMap[card.id] || null,
            is_claimed: claimMap[card.id] === 'approved'
        }));

        res.json(cardsWithClaim);
    } catch (error) {
        console.error('Error fetching promo cards:', error);
        res.status(500).json({ message: 'Lama helin promotional cards' });
    }
});

// Claim promo rewards (Submitting screenshot for verification)
router.post('/promo-cards/:id/claim', auth, upload.single('screenshot'), async (req, res) => {
    try {
        const userId = req.user.id;
        const promoCardId = req.params.id;

        // Verify that the promo card exists and has active rewards
        const [card] = await db.execute('SELECT * FROM promo_cards WHERE id = ? AND is_active = 1', [promoCardId]);
        if (card.length === 0) {
            return res.status(404).json({ message: 'Xayaysiiskan lama helin ama ma shaqaynayo' });
        }

        const promo = card[0];
        if (!promo.reward_credits || promo.reward_credits <= 0) {
            return res.status(400).json({ message: 'Xayaysiiskan ma lahan wax abaalmarin ah' });
        }

        // Verify if user already submitted a claim
        const [existing] = await db.execute(
            'SELECT * FROM user_claimed_promos WHERE user_id = ? AND promo_card_id = ?',
            [userId, promoCardId]
        );

        if (existing.length > 0) {
            const claim = existing[0];
            if (claim.status === 'approved') {
                return res.status(400).json({ message: 'Hore ayaad u sheegatay abaalmarintan!' });
            } else if (claim.status === 'pending') {
                return res.status(400).json({ message: 'Dalabkaaga wuxuu ku jiraa sugitaan (Pending)!' });
            } else {
                // If rejected, we delete the old record and let them resubmit a new screenshot
                await db.execute('DELETE FROM user_claimed_promos WHERE id = ?', [claim.id]);
            }
        }

        // Must upload a screenshot
        if (!req.file) {
            return res.status(400).json({ message: 'Fadlan soo gali sawirka screenshot-ka si loo xaqiijiyo!' });
        }

        const localImagePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        const screenshotUrl = await storageService.uploadFile(localImagePath, 'screenshots', true);

        // Insert new claim request with 'pending' status
        await db.execute(
            'INSERT INTO user_claimed_promos (user_id, promo_card_id, screenshot_url, status) VALUES (?, ?, ?, "pending")',
            [userId, promoCardId, screenshotUrl]
        );

        res.json({ 
            status: 'success', 
            message: 'Dalabkaaga si guul leh ayaa loo gudbiyey! Admin-ka ayaa ku ansixin doona waxyar gudaheed.' 
        });

    } catch (error) {
        console.error('Error claiming promo rewards:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu gudajiray sheegashada' });
    }
});

// Get dynamic live notifications for the user
router.get('/notifications', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        // Expire pay-as-you-go balance if inactive for 1 month
        await checkAndExpireWallet(userId);

        const notifications = [];

        // 1. Fetch user creation date
        const [user] = await db.execute('SELECT created_at FROM users WHERE id = ?', [userId]);
        if (user.length > 0) {
            notifications.push({
                id: 'welcome',
                title: 'Ku soo dhawaaw Darkpen',
                message: 'Is-diiwaangelintaadu si guul leh ayay u dhacday. Ku raaxayso adeegyada premium-ka ah!',
                time: user[0].created_at,
                type: 'welcome'
            });
        }

        // 2. Fetch payments
        const [payments] = await db.execute(
            'SELECT amount, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        payments.forEach((p, idx) => {
            let statusText = '';
            if (p.status === 'approved') statusText = 'waa la ansixiyey! Adeegyadaadu hadda waa firfircoon yihiin.';
            else if (p.status === 'pending') statusText = 'wuxuu ku jiraa sugitaan (Pending).';
            else statusText = 'waa la diiday. Fadlan la xiriir caawiyaha.';

            notifications.push({
                id: `payment-${idx}`,
                title: 'Dalabka Lacag-bixinta',
                message: `Dalabkaaga lacag-bixinta ee $${p.amount} ${statusText}`,
                time: p.created_at,
                type: 'payment'
            });
        });

        // 3. Fetch claimed promos
        const [claims] = await db.execute(`
            SELECT ucp.status, ucp.claimed_at, pc.title_so, pc.reward_credits, pc.reward_type 
            FROM user_claimed_promos ucp
            JOIN promo_cards pc ON ucp.promo_card_id = pc.id
            WHERE ucp.user_id = ?
            ORDER BY ucp.claimed_at DESC
        `, [userId]);
        claims.forEach((c, idx) => {
            let statusText = '';
            if (c.status === 'approved') {
                statusText = `waa la ansixiyey! Waxaa lagugu shubay +${c.reward_credits} ${c.reward_type === 'shukaansi' ? 'Shukaansi' : 'Standard'} Credits.`;
            } else if (c.status === 'pending') {
                statusText = 'wuxuu ku jiraa sugitaan (Pending) si loo xaqiijiyo sawirka.';
            } else {
                statusText = 'waa la diiday. Fadlan dib u soo dir sawir ka duwan oo sax ah.';
            }

            notifications.push({
                id: `claim-${idx}`,
                title: `Abaalmarinta ${c.title_so}`,
                message: `Dalabkaaga abaalmarinta ee ${c.title_so} ${statusText}`,
                time: c.claimed_at,
                type: 'claim'
            });
        });

        // 4. Fetch wallet expirations (Pay as you go inactivity)
        const [expirations] = await db.execute(
            'SELECT expired_balance, expired_at FROM wallet_expirations WHERE user_id = ? ORDER BY expired_at DESC',
            [userId]
        );
        expirations.forEach((e, idx) => {
            notifications.push({
                id: `expiration-${idx}`,
                title: 'Credits-kii oo dhacay (Expired)',
                message: `Credits-kaagii (Pay as you go) oo ahaa ${e.expired_balance} waa uu dhacay sababtoo ah ma aadan isticmaalin muddo 1 bil ah. Fadlan ku shubo credits cusub si aad u sii wadato adeegga.`,
                time: e.expired_at,
                type: 'expiration'
            });
        });

        // Sort notifications by time descending
        notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        // Format dates into user-friendly time ago strings
        const formattedNotifications = notifications.map(n => {
            let date = new Date(n.time);
            const now = new Date();
            
            // Fix for MySQL UTC to Local Timezone shift (e.g. +3 hours for Somalia)
            const tzOffsetMs = date.getTimezoneOffset() * 60000; 
            date = new Date(date.getTime() - tzOffsetMs);

            let diffMs = now.getTime() - date.getTime();
            if (diffMs < 0) diffMs = 0; // Fallback for slight clock desync

            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            let timeAgo = '';
            if (diffMins < 1) timeAgo = 'Hada';
            else if (diffMins < 60) timeAgo = `${diffMins} daqiiqo ka hor`;
            else if (diffHours < 24) timeAgo = `${diffHours} saac ka hor`;
            else if (diffDays === 1) timeAgo = 'Shalay';
            else timeAgo = `${diffDays} casho ka hor`;

            return {
                ...n,
                time: timeAgo
            };
        });

        res.json(formattedNotifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Lama helin ogeysiisyada' });
    }
});

// GET Usage Statistics (Dynamic Progress & Breakdown)
router.get('/usage', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Ensure wallet checks run
        await checkAndExpireWallet(userId);

        // Fetch User and Wallets
        const [walletRows] = await db.execute('SELECT balance, last_updated FROM user_wallet WHERE user_id = ?', [userId]);
        const [shukaansiWalletRows] = await db.execute('SELECT balance FROM shukaansi_wallet WHERE user_id = ?', [userId]);
        
        const standardBalance = walletRows.length > 0 ? walletRows[0].balance : 0;
        const standardLastUpdated = walletRows.length > 0 ? walletRows[0].last_updated : new Date();
        const shukaansiBalance = shukaansiWalletRows.length > 0 ? shukaansiWalletRows[0].balance : 0;

        // Fetch Active Subscriptions
        const [subRows] = await db.execute(
            'SELECT type, expiry_date FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1',
            [userId]
        );
        const [shukaansiSubRows] = await db.execute(
            'SELECT type, expiry_date FROM shukaansi_subscriptions WHERE user_id = ? AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1',
            [userId]
        );
        const [allSubRows] = await db.execute(
            'SELECT type, expiry_date FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1',
            [userId]
        );
        const [allShukaansiSubRows] = await db.execute(
            'SELECT type, expiry_date FROM shukaansi_subscriptions WHERE user_id = ? AND expiry_date > NOW() ORDER BY expiry_date DESC LIMIT 1',
            [userId]
        );

        const standardSub = subRows.length > 0 ? subRows[0] : null;
        const shukaansiSub = shukaansiSubRows.length > 0 ? shukaansiSubRows[0] : null;
        const hasChronologicalSub = allSubRows.length > 0 ? allSubRows[0] : null;
        const hasChronologicalShukaansiSub = allShukaansiSubRows.length > 0 ? allShukaansiSubRows[0] : null;

        // Calculate Standard Plan Details
        let standardPlanName = 'Pay as you go';
        let standardLimit = 100;
        let standardExpiry = null;

        if (standardSub) {
            standardPlanName = standardSub.type === 'monthly_11' ? 'Bille (Premium)' : 'Bille (Basic)';
            standardLimit = standardSub.type === 'monthly_11' ? 5000 : 1000;
            standardExpiry = standardSub.expiry_date;
        } else if (hasChronologicalSub && standardBalance <= 0) {
            standardPlanName = hasChronologicalSub.type === 'monthly_11' ? 'Premium (Wuu dhammaaday)' : 'Basic (Wuu dhammaaday)';
            standardLimit = hasChronologicalSub.type === 'monthly_11' ? 5000 : 1000;
            standardExpiry = null; // No expiry date shown
        } else {
            // Pay as you go limit is 100, or the current balance if it exceeds 100 (e.g. user bought multiple packages)
            standardLimit = Math.max(100, Math.ceil(standardBalance / 100) * 100);
            
            // Expiry is 10 days after last_updated
            const expiryDate = new Date(standardLastUpdated);
            expiryDate.setDate(expiryDate.getDate() + 10);
            standardExpiry = expiryDate;
        }

        const standardUsed = Math.max(0, standardLimit - standardBalance);
        const standardPercentage = Math.min(100, Math.max(0, Math.round((standardUsed / standardLimit) * 100)));

        // Calculate Shukaansi Plan Details
        let shukaansiPlanName = 'Pay as you go (Shukaansi)';
        let shukaansiLimit = 100;
        let shukaansiExpiry = null;

        if (shukaansiSub) {
            shukaansiPlanName = shukaansiSub.type === 'monthly_11' ? 'Bille Premium (Shukaansi)' : 'Bille Basic (Shukaansi)';
            shukaansiLimit = shukaansiSub.type === 'monthly_11' ? 5000 : 1000;
            shukaansiExpiry = shukaansiSub.expiry_date;
        } else if (hasChronologicalShukaansiSub && shukaansiBalance <= 0) {
            shukaansiPlanName = hasChronologicalShukaansiSub.type === 'monthly_11' ? 'Premium (Wuu dhammaaday) (Shukaansi)' : 'Basic (Wuu dhammaaday) (Shukaansi)';
            shukaansiLimit = hasChronologicalShukaansiSub.type === 'monthly_11' ? 5000 : 1000;
            shukaansiExpiry = null;
        } else {
            shukaansiLimit = Math.max(100, Math.ceil(shukaansiBalance / 100) * 100);
            // Shukaansi wallet does not expire, so shukaansiExpiry remains null!
        }

        const shukaansiUsed = Math.max(0, shukaansiLimit - shukaansiBalance);
        const shukaansiPercentage = Math.min(100, Math.max(0, Math.round((shukaansiUsed / shukaansiLimit) * 100)));

        // Fetch Usage Logs for Breakdown
        const [logs] = await db.execute(
            `SELECT chat_type, COUNT(*) as count, SUM(cost) as total_cost 
             FROM ai_usage_logs 
             WHERE user_id = ? 
             GROUP BY chat_type`,
            [userId]
        );

        // Map categories to user-friendly names
        const categoryMapping = {
            'education': { label: 'Chat-ka Caadiga ah', icon: 'chatbubble-ellipses-outline', color: '#3B82F6' },
            'general': { label: 'Chat-ka Caadiga ah', icon: 'chatbubble-ellipses-outline', color: '#3B82F6' },
            'shukaansi': { label: 'Chat-ka Shukaansiga', icon: 'heart-outline', color: '#EC4899' },
            'image': { label: 'Sawir Sameyn (Image)', icon: 'image-outline', color: '#10B981' },
            'exam': { label: 'Samaynta Imtixaanada', icon: 'document-text-outline', color: '#8B5CF6' },
            'quiz': { label: 'Ka Qaybgalka Quiska', icon: 'trophy-outline', color: '#F59E0B' },
            'voice': { label: 'Duubista Codadka', icon: 'mic-outline', color: '#EF4444' },
            'voice-call': { label: 'Wicitaanka Shukaansiga', icon: 'call-outline', color: '#EC4899' }
        };

        const breakdown = Object.keys(categoryMapping).map(key => {
            const log = logs.find(l => l.chat_type === key);
            const usdCost = log ? parseFloat(log.total_cost) : 0;
            // Convert back to credits: 1 credit = $0.005, so credits = usdCost * 200
            const creditsCost = Math.round(usdCost * 200);

            return {
                type: key,
                label: categoryMapping[key].label,
                icon: categoryMapping[key].icon,
                color: categoryMapping[key].color,
                count: log ? log.count : 0,
                credits: creditsCost
            };
        }).filter(item => item.count > 0); // Only return categories with actual usage

        res.json({
            status: 'success',
            standard: {
                planName: standardPlanName,
                balance: standardBalance,
                limit: standardLimit,
                used: standardUsed,
                percentage: standardPercentage,
                expiryDate: standardExpiry
            },
            shukaansi: {
                planName: shukaansiPlanName,
                balance: shukaansiBalance,
                limit: shukaansiLimit,
                used: shukaansiUsed,
                percentage: shukaansiPercentage,
                expiryDate: shukaansiExpiry
            },
            breakdown
        });

    } catch (error) {
        console.error('Error fetching usage:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo akhrinta isticmaalka (Usage).' });
    }
});

// GET Free Trial Stats for the logged-in user
router.get('/free-trial-stats', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { getFreeUsageStats } = require('../utils/freeUsageHelper');
        const stats = await getFreeUsageStats(userId);
        if (!stats) return res.status(500).json({ message: 'Cilad ayaa dhacday' });
        res.json(stats);
    } catch (error) {
        console.error('Error fetching free trial stats:', error);
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
});

module.exports = router;
