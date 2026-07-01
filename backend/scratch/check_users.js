const db = require('../config/db');

async function test() {
    try {
        const [users] = await db.execute('SELECT id, name, username, email, role, is_suspended FROM users');
        console.log("Users in DB:");
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
