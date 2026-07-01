const db = require('../config/db');

exports.sendPushNotification = async (userId, title, body) => {
    try {
        const [rows] = await db.execute('SELECT push_token FROM users WHERE id = ?', [userId]);
        if (rows.length === 0 || !rows[0].push_token) {
            console.log(`[PUSH] No push token found for user ${userId}`);
            return;
        }

        const pushToken = rows[0].push_token;
        if (!pushToken.startsWith('ExponentPushToken') && !pushToken.startsWith('ExpoPushToken')) {
            console.log(`[PUSH] Invalid or non-expo push token for user ${userId}: ${pushToken}`);
            return;
        }

        const message = {
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            channelId: 'default',
            data: { 
                userId: userId,
                timestamp: new Date().toISOString()
            },
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const resData = await response.json();
        console.log(`[PUSH] Response from Expo for user ${userId}:`, JSON.stringify(resData));
    } catch (error) {
        console.error(`[PUSH] Error sending to user ${userId}:`, error);
    }
};
