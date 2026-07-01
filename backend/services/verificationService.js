function normalizePhoneNumber(value) {
    let raw = String(value || '').trim();
    if (!raw) return '';

    // Strip WhatsApp JID domain and companion device suffixes (e.g. 252637930329:2@c.us -> 252637930329)
    raw = raw.split('@')[0].split(':')[0];

    let compact = raw.replace(/[()\s.-]/g, '');
    if (compact.startsWith('00')) {
        compact = `+${compact.slice(2)}`;
    }

    const digits = compact.replace(/\D/g, '');
    if (compact.startsWith('+')) {
        compact = `+${digits}`;
    } else if (digits.startsWith('252')) {
        compact = `+${digits}`;
    } else if (digits.startsWith('0')) {
        compact = `+252${digits.slice(1)}`;
    } else if (/^[67]\d{7,8}$/.test(digits)) {
        compact = `+252${digits}`;
    } else {
        compact = `+${digits}`;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
        return '';
    }

    return compact;
}

function normalizeUsername(value) {
    return String(value || '')
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();
}

function validateUsername(username) {
    if (!username) return 'Username waa waajib.';
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        return 'Username-ku waa inuu ahaadaa 3-30 xaraf: a-z, 0-9 ama _.';
    }
    if (/^_+$/.test(username)) {
        return 'Username sax ah dooro.';
    }
    return null;
}

function validatePassword(password) {
    if (!password || String(password).length < 8) {
        return 'Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.';
    }
    return null;
}

module.exports = {
    normalizePhoneNumber,
    normalizeUsername,
    validateUsername,
    validatePassword,
};
