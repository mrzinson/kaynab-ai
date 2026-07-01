const db = require('../config/db');

/**
 * Check if a user's pay-as-you-go wallet has expired (inactive for 10+ days)
 * and set balance to 0 if so.
 */
async function checkAndExpireWallet(userId) {
    try {
        const [wallet] = await db.execute(
            'SELECT balance, last_updated FROM user_wallet WHERE user_id = ?',
            [userId]
        );

        if (!wallet || wallet.length === 0) return;

        const { balance, last_updated } = wallet[0];
        if (balance > 0 && last_updated) {
            const lastUpdatedDate = new Date(last_updated);
            const now = new Date();
            const diffMs = now.getTime() - lastUpdatedDate.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);

            if (diffDays >= 10) {
                console.log(`[WALLET EXPIRATION] Expiring wallet for user ${userId}. Old balance: ${balance}`);
                await db.execute(
                    'UPDATE user_wallet SET balance = 0, last_updated = NOW() WHERE user_id = ?',
                    [userId]
                );
                await db.execute(
                    'INSERT INTO wallet_expirations (user_id, expired_balance) VALUES (?, ?)',
                    [userId, balance]
                ).catch(err => console.error('[WALLET EXPIRATION] Insert error:', err));

                // Send push notification asynchronously
                try {
                    const pushService = require('../services/pushNotificationService');
                    pushService.sendPushNotification(
                        userId,
                        'Credits-kaagii waa uu dhacay',
                        `Credits-kaagii (Pay as you go) oo ahaa ${balance} ayaa dhacay sababtoo ah ma aadan isticmaalin muddo 10 casho ah. Fadlan ku shubo credits cusub.`
                    ).catch(err => console.error('[WALLET EXPIRATION] Push notification error:', err.message));
                } catch (pushErr) {
                    console.error('[WALLET EXPIRATION] Push notification module error:', pushErr.message);
                }
            }
        }
    } catch (err) {
        console.error('[WALLET EXPIRATION] checkAndExpireWallet error:', err.message);
    }
}

module.exports = { checkAndExpireWallet };
