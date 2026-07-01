const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
    // Ka raadi token-ka header-ka
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (No Token)' });
    }

    // Header format waa "Bearer <token>"
    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (Invalid Token)' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Dynamic DB suspension check
        const [users] = await db.execute('SELECT is_suspended FROM users WHERE id = ?', [decoded.id]);
        if (users.length === 0 || users[0].is_suspended) {
            return res.status(403).json({ message: 'Koontadaada waa la laalay (Suspended). Tafasiil dheeri ah la xiriir maamulka.' });
        }

        req.user = decoded; // { id: ... }
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token-ku dhacay ama waa khalad' });
    }
};
