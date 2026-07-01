const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async (req, res, next) => {
    // Look for authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (Token is missing)' });
    }

    // Format should be "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ message: 'Ogolaansho la\'aan (Token format is invalid)' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch user status and role from DB
        const [users] = await db.execute('SELECT id, name, username, email, role, is_suspended FROM users WHERE id = ?', [decoded.id]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: 'User-ka lama helin' });
        }

        const user = users[0];
        if (user.is_suspended) {
            return res.status(403).json({ message: 'Koontadaada waa la laalay (Suspended). Tafasiil dheeri ah la xiriir maamulka.' });
        }

        // Verify that the user has admin or superadmin role
        if (user.role !== 'admin' && user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Kaliya Admin-ka ayaa geli kara qaybtan.' });
        }

        req.user = user; // Set req.user to the full user object
        next();
    } catch (error) {
        console.error('[Admin Auth Error]:', error.message);
        return res.status(401).json({ message: 'Token-ku wuu dhacay ama waa khalad' });
    }
};
