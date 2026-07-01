const db = require('./config/db');

async function test() {
    try {
        console.log("Testing users query...");
        const [users] = await db.execute('SELECT COUNT(*) as total FROM users');
        console.log("Users:", users[0].total);

        console.log("Testing recent users query...");
        const [recentUsers] = await db.execute('SELECT id, name, email, created_at, role FROM users ORDER BY created_at DESC LIMIT 5');
        console.log("Recent users count:", recentUsers.length);

        console.log("Testing pending payments query...");
        const [pendingPayments] = await db.execute('SELECT COUNT(*) as total FROM payments WHERE status = "pending"');
        console.log("Pending payments:", pendingPayments[0].total);

        console.log("Testing total revenue query...");
        const [revenueRes] = await db.execute('SELECT SUM(amount) as total FROM payments WHERE status = "approved"');
        console.log("Total revenue:", revenueRes[0].total);

        console.log("Testing active chats query...");
        const [chatsRes] = await db.execute('SELECT COUNT(*) as total FROM chat_sessions');
        console.log("Active chats:", chatsRes[0].total);

        console.log("Testing chart data query...");
        const [chartData] = await db.execute(`
            SELECT DATE(created_at) as date, SUM(amount) as revenue 
            FROM payments 
            WHERE status = 'approved' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        console.log("Chart data count:", chartData.length);

        console.log("Formatting chart data...");
        const formattedChartData = chartData.map(item => ({
            name: new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
            revenue: parseFloat(item.revenue) || 0
        }));
        console.log("Formatted chart data:", formattedChartData);

        console.log("ALL QUERIES PASSED!");
        process.exit(0);
    } catch (err) {
        console.error("QUERY FAILED:", err);
        process.exit(1);
    }
}

test();
