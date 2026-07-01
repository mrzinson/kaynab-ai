const db = require('../config/db');
const bcrypt = require('bcrypt');
const { saveBase64Image } = require('../utils/fileHelper');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 1. Helida Xogta Profile-ka (Get Profile)
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const [users] = await db.execute(
            'SELECT id, name, email, whatsapp_number, username, profile_picture, gender, country, region_state, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'Isticmaalaha lama helin' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 2. Cusboonaysiinta Profile-ka (Update Profile)
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, username, email, gender, country, region_state, password, profile_picture } = req.body;

        // Fetch current user data
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ message: 'Lama helin' });
        const user = users[0];

        // Username validation
        if (username && username !== user.username) {
            // Check uniqueness
            const [existing] = await db.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
            if (existing.length > 0) {
                return res.status(400).json({ message: 'Username-kan qof kale ayaa haysta, mid kale dooro.' });
            }

            // Check 20 days rule
            if (user.last_username_change) {
                const lastChange = new Date(user.last_username_change);
                const now = new Date();
                const diffTime = Math.abs(now - lastChange);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 20) {
                    return res.status(400).json({ message: `Kuma dari kartid magac cusub, fadlan sug ${20 - diffDays} maalmood.` });
                }
            }

            await db.execute('UPDATE users SET username = ?, last_username_change = CURRENT_TIMESTAMP WHERE id = ?', [username, userId]);
        }

        // Update Name, Gender, Country & region_state
        if (name) await db.execute('UPDATE users SET name = ? WHERE id = ?', [name, userId]);
        if (gender !== undefined) await db.execute('UPDATE users SET gender = ? WHERE id = ?', [gender || null, userId]);
        if (country !== undefined) await db.execute('UPDATE users SET country = ? WHERE id = ?', [country || null, userId]);
        if (region_state !== undefined) await db.execute('UPDATE users SET region_state = ? WHERE id = ?', [region_state || null, userId]);

        if (email !== undefined) {
            const cleanEmail = String(email || '').trim().toLowerCase();
            if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
                return res.status(400).json({ message: 'Email sax ah geli ama ka tag.' });
            }

            if (cleanEmail && cleanEmail !== user.email) {
                const [existingEmail] = await db.execute('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, userId]);
                if (existingEmail.length > 0) {
                    return res.status(400).json({ message: 'Email-kan qof kale ayaa isticmaalaya.' });
                }
            }

            await db.execute('UPDATE users SET email = ? WHERE id = ?', [cleanEmail || null, userId]);
        }
        
        // Update Profile Picture
        if (profile_picture) {
            let finalPic = profile_picture;
            if (profile_picture.startsWith('data:image')) {
                finalPic = await saveBase64Image(profile_picture, 'profiles') || profile_picture;
            }
            await db.execute('UPDATE users SET profile_picture = ? WHERE id = ?', [finalPic, userId]);
        }

        // Update Password
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
        }

        // Fetch updated user to return
        const [updated] = await db.execute(
            'SELECT id, name, email, whatsapp_number, username, profile_picture, gender, country, region_state FROM users WHERE id = ?',
            [userId]
        );

        res.json({ message: 'Profile-kaagu si guul leh ayuu u cusboonaysmay!', user: updated[0] });

    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};

// 3. Raadinta Isticmaalayaasha (Search Users)
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 3) {
            return res.status(400).json({ message: 'Fadlan qor ugu yaraan 3 xaraf.' });
        }

        const [users] = await db.execute(
            `SELECT id, name, username, email, whatsapp_number FROM users 
             WHERE name LIKE ? OR email LIKE ? OR username LIKE ? OR whatsapp_number LIKE ?
             LIMIT 10`,
            [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        );

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Cilad ayaa dhacday', error: error.message });
    }
};
