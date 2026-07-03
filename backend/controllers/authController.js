const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const https = require('https');

const whatsappCloudBot = require('../services/whatsappCloudBot');
const {
    normalizePhoneNumber,
    normalizeUsername,
    validateUsername,
    validatePassword,
} = require('../services/verificationService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeOptionalEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    return email || null;
}

function buildPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email || null,
        whatsapp_number: user.whatsapp_number,
        role: user.role,
        payment_status: user.payment_status,
        is_verified: Boolean(user.is_verified),
        terms_accepted_at: user.terms_accepted_at || null,
        gender: user.gender || null,
        country: user.country || null,
        region_state: user.region_state || null,
    };
}

function authErrorMessage() {
    return 'Number ama Password waa khalad';
}

function statusFromError(error) {
    return error.statusCode || error.status || 500;
}

async function sendPasswordResetEmail({ email, name, code }) {
    if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) {
        const err = new Error('Koontadan email recovery way leedahay, laakiin email service-ka lama configure-gareyn. Fadlan la xiriir support.');
        err.statusCode = 503;
        throw err;
    }

    const emailData = {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_RESET_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: {
            to_email: email,
            to_name: name,
            app_name: 'Darkpen App',
            otp_code: code,
            time: new Date().toLocaleString('en-US', { timeZone: 'Africa/Mogadishu' })
        }
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
    });

    if (!response.ok) {
        const err = new Error('Email reset code lama dirin. Fadlan isku day mar kale ama la xiriir support whatsappka:637930329');
        err.statusCode = 502;
        throw err;
    }
}

// 0. Fetch Schools & Classes
exports.getSchools = async (req, res) => {
    try {
        const [schools] = await db.execute('SELECT * FROM schools ORDER BY name ASC');
        res.json(schools);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const [classes] = await db.execute('SELECT * FROM classes WHERE school_id = ? ORDER BY name ASC', [schoolId]);
        res.json(classes);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday' });
    }
};

// Helper: auto-generate unique username from full name
async function generateUniqueUsername(connection, name) {
    const base = name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20) || 'user';

    for (let i = 0; i < 10; i++) {
        const suffix = Math.floor(1000 + Math.random() * 9000);
        const candidate = `${base}_${suffix}`;
        const [rows] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [candidate]
        );
        if (rows.length === 0) return candidate;
    }
    // Fallback: timestamp-based
    return `${base}_${Date.now().toString().slice(-6)}`;
}

// 1. Diiwaangalinta (Sign Up)
exports.signup = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const username = normalizeUsername(req.body.username);
        const email = String(req.body.email || '').trim().toLowerCase();
        const { password } = req.body;
        
        let whatsappNumber = null;
        if (req.body.whatsapp_number || req.body.phone) {
            whatsappNumber = normalizePhoneNumber(req.body.whatsapp_number || req.body.phone);
        }

        if (!name) {
            return res.status(400).json({ message: 'Magaca waa waajib.' });
        }

        const usernameError = validateUsername(username);
        if (usernameError) {
            return res.status(400).json({ message: usernameError });
        }

        if (!email || !EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: 'Fadlan geli email sax ah.' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        const connection = await db.getConnection();
        let insertedUser;

        try {
            await connection.beginTransaction();

            // Check if username already exists
            const [existingByUsername] = await connection.execute(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );
            if (existingByUsername.length > 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Username-kan horey ayaa loo qaatay. Fadlan dooro mid kale.' });
            }

            // Check if email already exists
            const [existingByEmail] = await connection.execute(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            if (existingByEmail.length > 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Email-kan horey ayaa loo diiwaangeliyay.' });
            }

            // Check if WhatsApp number already exists (if provided)
            if (whatsappNumber) {
                const [existingByPhone] = await connection.execute(
                    'SELECT id FROM users WHERE whatsapp_number = ?',
                    [whatsappNumber]
                );
                if (existingByPhone.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: 'WhatsApp number-kan horey ayaa loo diiwaangeliyay.' });
                }
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            const [result] = await connection.execute(
                `INSERT INTO users (name, username, email, whatsapp_number, password, payment_status, payment_reference, is_verified)
                 VALUES (?, ?, ?, ?, ?, NULL, NULL, TRUE)`,
                [name, username, email, whatsappNumber, hashedPassword]
            );

            const newUserId = result.insertId;

            await connection.execute('INSERT IGNORE INTO user_wallet (user_id, balance) VALUES (?, 0)', [newUserId]);

            const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [newUserId]);
            insertedUser = users[0];

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        const token = jwt.sign({ id: insertedUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ 
            message: 'Koontada si guul leh ayaa loo abuuray.',
            token, 
            requires_verification: false,
            user: buildPublicUser(insertedUser)
        });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

// 2. Gelitaanka (Login)
exports.login = async (req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.whatsapp_number || req.body.phone || req.body.email || '').trim();
        const { password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: 'Fadlan geli (Email/Username/WhatsApp) iyo Password-ka.' });
        }

        const normalizedPhone = normalizePhoneNumber(identifier);

        // Flexible search matching email, username, or whatsapp number
        const [users] = await db.execute(
            `SELECT * FROM users 
             WHERE email = ? 
                OR username = ? 
                OR whatsapp_number = ? 
                OR (whatsapp_number IS NOT NULL AND whatsapp_number = ?)` ,
            [identifier.toLowerCase(), identifier.toLowerCase(), identifier, normalizedPhone || '']
        );

        if (users.length === 0) {
            return res.status(400).json({ message: 'Email/Username/Number ama Password-ka ayaa qaldan.' });
        }

        const user = users[0];
        if (user.is_suspended) {
            return res.status(403).json({ message: 'Koontadaada waa la laalay (Suspended). Fadlan la xiriir maamulka.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(400).json({ message: 'Email/Username/Number ama Password-ka ayaa qaldan.' });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ 
            message: 'Kusoo dhawaaw',
            token, 
            requires_verification: false,
            user: buildPublicUser(user)
        });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

// 3. Xaqiijinta Shuruudaha iyo WhatsApp (Terms & WhatsApp)
exports.acceptTerms = async (req, res) => {
    try {
        const userId = req.user.id; // Laga helayo middleware-ka
        await db.execute(
            'UPDATE users SET terms_accepted_at = COALESCE(terms_accepted_at, CURRENT_TIMESTAMP) WHERE id = ?',
            [userId]
        );

        res.json({ message: 'Shuruudaha waa la aqbalay' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 4. Diiwaangalinta Ardayga (Student Registration)
exports.registerStudent = async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, school_id, class_id, reason_for_joining } = req.body;

        await db.execute(
            'UPDATE users SET name = ?, role = "student", school_id = ?, class_id = ?, reason_for_joining = ? WHERE id = ?',
            [full_name, school_id, class_id, reason_for_joining, userId]
        );

        res.json({ message: 'Xogta ardayga waa la keydiyay, fadlan samee lacag bixinta' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// Helper to notify admins on new payment
async function notifyAdminsNewPayment(user, reference_number, amount) {
    try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
        
        if (!token || !chatId) {
            console.warn('[PAYMENT NOTIFICATION] Telegram Bot token or Owner Chat ID missing in environment variables.');
            return;
        }

        const tgMessage = `🔔 <b>DALAB LACAGEED OO CUSUB (Web App)!</b>\n\n` +
            `👤 <b>Macaamilka:</b> ${user.name} (@${user.username})\n` +
            `💰 <b>Lacagta:</b> $${amount}\n` +
            `📋 <b>Reference:</b> ${reference_number}\n` +
            `📅 <b>Taariikhda:</b> ${new Date().toLocaleString('en-US')}\n\n` +
            `<i>Fadlan gal Admin Dashboard si aad u xaqiijiso ama u diido.</i>`;

        const data = JSON.stringify({
            chat_id: chatId,
            text: tgMessage,
            parse_mode: 'HTML'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                console.log(`[PAYMENT NOTIFICATION] Sent Telegram message to admin ${chatId}`);
            });
        });

        req.on('error', (err) => {
            console.error('[PAYMENT NOTIFICATION] Telegram notification request error:', err.message);
        });

        req.write(data);
        req.end();
    } catch (e) {
        console.error('Failed to notify admins via Telegram:', e.message);
    }
}

// 5. Lacag Bixinta (Payment Submission)
exports.submitPayment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { reference_number, amount, planId, groupData, service_type } = req.body;

        // Fetch user info for notification
        const [users] = await db.execute('SELECT name, username FROM users WHERE id = ?', [userId]);
        const user = users[0] || { name: 'Unknown User', username: 'unknown' };

        // 1. Samee Payment record
        await db.execute(
            'INSERT INTO payments (user_id, amount, reference_number, service_type) VALUES (?, ?, ?, ?)',
            [userId, amount || 10000, reference_number, service_type || 'general']
        );

        // 2. Haddii ay tahay Group Registration, kaydi xogta
        if (planId === 'group_join' && groupData) {
            const { school_id, class_id, sub_class } = groupData;
            await db.execute(
                'INSERT INTO group_registrations (user_id, school_id, class_id, sub_class, payment_ref) VALUES (?, ?, ?, ?, ?)',
                [userId, school_id, class_id, sub_class, reference_number]
            );
        }

        // 3. Cusboonaysii user-ka (Guud ahaan status-ka)
        await db.execute(
            'UPDATE users SET payment_reference = ?, payment_status = "pending" WHERE id = ?',
            [reference_number, userId]
        );

        // Trigger background notification to admins
        notifyAdminsNewPayment(user, reference_number, amount || 10000).catch(err => {
            console.error('Background notifyAdminsNewPayment failed:', err);
        });

        res.json({ message: 'Dalabkaaga waa la diray, fadlan sug inta Admin-ku ka xaqiijinayo' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 6. Xaqiijinta Number-ka (Verify Phone)
exports.verifyPhone = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Lama helin ardayga' });

        await db.execute('UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = ?', [userId]);

        res.json({ message: 'Koontadaadu waa verified.', user: buildPublicUser({ ...users[0], is_verified: true }) });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

exports.verifyEmail = exports.verifyPhone;

// 7. Dib-u-dirida Koodhka (Resend Code)
exports.resendCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute('SELECT id FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Lama helin ardayga' });

        res.json({ message: 'Koontadaadu waa verified; code looma baahna.' });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

// 8. Ilaaway Password-ka (Forgot Password)
exports.forgotPassword = async (req, res) => {
    try {
        const whatsappNumber = normalizePhoneNumber(req.body.whatsapp_number || req.body.phone || req.body.email);
        if (!whatsappNumber) {
            return res.status(400).json({ message: 'Fadlan geli number sax ah.' });
        }

        const [users] = await db.execute('SELECT id, name, email FROM users WHERE whatsapp_number = ?', [whatsappNumber]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: 'Number-kan laguma diiwaangelin app-ka. Fadlan is-diiwaangeli marka hore.' });
        }

        const user = users[0];
        if (!user.email) {
            return res.status(400).json({
                error_type: 'no_email',
                message: 'Koontadan email recovery kuma xirna. Fadlan kala xiriir WhatsApp Bot si lagugu caawiyo.'
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await db.execute(
            'UPDATE users SET reset_code = ?, reset_code_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
            [code, user.id]
        );
        await sendPasswordResetEmail({ email: user.email, name: user.name, code });

        res.json({ message: 'Koodh reset ah ayaa laguugu diray email-ka ku jira profile-kaaga.', whatsapp_number: whatsappNumber });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

// 9. Bedelida Password-ka (Reset Password)
exports.resetPassword = async (req, res) => {
    try {
        const whatsappNumber = normalizePhoneNumber(req.body.whatsapp_number || req.body.phone || req.body.email);
        const code = req.body.code?.trim();
        const newPassword = req.body.newPassword;

        if (!whatsappNumber) {
            return res.status(400).json({ message: 'Fadlan geli number sax ah.' });
        }

        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            return res.status(400).json({ message: passwordError });
        }

        const [users] = await db.execute('SELECT id, reset_code, reset_code_expires_at FROM users WHERE whatsapp_number = ?', [whatsappNumber]);
        if (users.length === 0) return res.status(400).json({ message: 'Number ama koodhku waa khalad' });

        if (!code || users[0].reset_code !== code) {
            return res.status(400).json({ message: 'Koodhku waa khalad ama wuu dhacay' });
        }

        if (!users[0].reset_code_expires_at || new Date(users[0].reset_code_expires_at).getTime() < Date.now()) {
            return res.status(400).json({ message: 'Koodhku wuu dhacay. Fadlan mid cusub dalbo.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.execute('UPDATE users SET password = ?, reset_code = NULL, reset_code_expires_at = NULL WHERE id = ?', [hashedPassword, users[0].id]);

        res.json({ message: 'Password-ka si guul leh ayaa loo bedelay!' });
    } catch (error) {
        res.status(statusFromError(error)).json({ message: error.message || 'Cilad ayaa dhacday' });
    }
};

// 10. Kaydinta Push Token (Notifications)
exports.savePushToken = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token lama soo diray' });
        }

        await db.execute('UPDATE users SET push_token = ? WHERE id = ?', [token, userId]);
        
        res.json({ message: 'Push token si guul leh ayaa loo kaydiyay' });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday kaydinta token-ka', error: error.message });
    }
};
