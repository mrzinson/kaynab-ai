const db = require('../config/db');
const { saveBase64Image } = require('../utils/fileHelper');
const aiService = require('../services/aiService');
const { checkAndExpireWallet } = require('../utils/walletHelper');
const { tryUseFreeAI } = require('../utils/freeUsageHelper');
const pushService = require('../services/pushNotificationService');

// Helper to get or create AI user
async function getOrCreateAIUser() {
    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', ['darkpen-ai@darkpen.app']);
    if (rows.length > 0) {
        return rows[0].id;
    }
    const [result] = await db.query(
        `INSERT INTO users (name, email, whatsapp_number, password, username, role, is_verified, profile_picture) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['Darkpen', 'darkpen-ai@darkpen.app', '+252000000000', 'dummy_darkpen_ai_password_hash', 'darkpen', 'admin', true, 'uploads/profiles/darkpen_logo.png']
    );
    const aiUserId = result.insertId;
    // Create wallet for the AI
    await db.query('INSERT IGNORE INTO user_wallet (user_id, balance) VALUES (?, 999999)', [aiUserId]);
    return aiUserId;
}

// Helper to send push notifications to all other group members
async function sendGroupPushNotifications(groupId, senderId, senderName, messageText, type = 'text') {
    try {
        const [groupRows] = await db.query('SELECT name FROM groups WHERE id = ?', [groupId]);
        const groupName = groupRows.length > 0 ? groupRows[0].name : 'Group Chat';

        const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?', [groupId, senderId]);
        
        let messageBody = '';
        if (type === 'image') {
            messageBody = `${senderName} wuxuu soo diray sawir.`;
        } else {
            // Trim message to fit push notification nicely
            const trimmedMessage = messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText;
            messageBody = `${senderName}: ${trimmedMessage}`;
        }

        for (const member of members) {
            pushService.sendPushNotification(member.user_id, groupName, messageBody).catch(err => {
                console.error(`Error sending push notification to user ${member.user_id}:`, err);
            });
        }
    } catch (err) {
        console.error("Error in sendGroupPushNotifications helper:", err);
    }
}

// Helper to check if AI should respond to message
function shouldAIRespond(message) {
    if (!message) return false;
    const cleanMsg = message.toLowerCase().trim();
    
    // Explicit mention
    if (cleanMsg.includes('@darkpen') || cleanMsg.includes('darkpen')) return true;
    
    // Question marks
    if (cleanMsg.includes('?')) return true;
    
    // Common questioning words at start
    const questionWords = [
        'maxaa', 'sidee', 'goormee', 'halkee', 'kuma', 'ma', 'miyaa',
        'what', 'how', 'why', 'when', 'where', 'who', 'which', 'is', 'can'
    ];
    const words = cleanMsg.split(/\s+/);
    if (words.length > 0 && questionWords.includes(words[0])) return true;
    
    return false;
}

// Helper for AI background responses in group chat
async function handleAIGroupResponse(req, groupId, userId, senderName, userMessage, aiUserId, type = 'text', attachment = null) {
    try {
        // 1. Fetch recent messages for context (limit 15 for better context)
        const startGroupDb = Date.now();
        const [recentMessages] = await db.query(
            `SELECT m.*, u.name as sender_name 
             FROM group_messages_v2 m
             JOIN users u ON m.user_id = u.id
             WHERE m.group_id = ?
             ORDER BY m.created_at DESC LIMIT 15`,
            [groupId]
        );
        console.log(`[LATENCY] [GROUP] Message history retrieval query took ${Date.now() - startGroupDb} ms`);

        // Map recent messages to Gemini chat history format
        const history = recentMessages.reverse().map(msg => {
            return {
                role: msg.user_id === aiUserId ? "model" : "user",
                parts: [{ text: `${msg.sender_name}: ${msg.message}` }]
            };
        });

        const groupSystemInstruction = `You are Darkpen, a highly intelligent and friendly AI assistant developed by ZinsonAI (owned by Hamze Mohamuud Ali Zinson). Always identify as Darkpen developed by ZinsonAI.
You are in a Group Chat.
Please address the user who asked the question by starting your response with: @${senderName}.
Core Rules:
1. Respond directly, accurately, and concisely.
2. Maintain language consistency: Speak in the EXACT same language that the user spoke to you (Somali when asked in Somali, English when asked in English, etc.).
3. If an image is provided, analyze it and reply in the same language.`;

        // 2. Call Gemini
        const promptText = type === 'image' 
            ? `${senderName} ayaa soo diray sawir. Fadlan sharax ama ka jawaab su'aasha ku jirta sawirkan.` 
            : `${senderName}: ${userMessage}`;

        const startGroupGemini = Date.now();
        const aiReply = await aiService.askGemini(
            promptText,
            "gemini-2.5-flash",
            attachment,
            history,
            groupSystemInstruction
        );
        console.log(`[LATENCY] [GROUP] Gemini askGemini call completed in ${Date.now() - startGroupGemini} ms`);

        if (!aiReply) return;

        // 3. Save AI message to database
        const [insertResult] = await db.query(
            'INSERT INTO group_messages_v2 (group_id, user_id, message, type) VALUES (?, ?, ?, "text")',
            [groupId, aiUserId, aiReply]
        );
        const aiMessageId = insertResult.insertId;

        // 4. Retrieve AI sender details
        const [aiUserRow] = await db.query(
            'SELECT name, username, profile_picture FROM users WHERE id = ?',
            [aiUserId]
        );

        const aiSocketMessage = {
            id: aiMessageId,
            group_id: groupId,
            user_id: aiUserId,
            message: aiReply,
            type: 'text',
            sender_name: aiUserRow[0].name || 'Darkpen',
            sender_username: aiUserRow[0].username || 'darkpen',
            sender_avatar: aiUserRow[0].profile_picture || null,
            created_at: new Date().toISOString()
        };

        // 5. Deduct 5 credits from all other active members in the group (excluding sender and AI itself)
        await db.query(
            `UPDATE user_wallet 
             SET balance = GREATEST(0, balance - 5) 
             WHERE user_id IN (
                 SELECT user_id FROM group_members 
                 WHERE group_id = ? AND user_id != ? AND user_id != ?
             )`,
            [groupId, userId, aiUserId]
        );

        // 6. Emit via Socket.io
        const io = req.app.get('socketio');
        if (io) {
            io.to(`group_${groupId}`).emit('receive_message', aiSocketMessage);
        }

        // 7. Send Push Notification to all group members
        sendGroupPushNotifications(groupId, aiUserId, aiUserRow[0].name || 'Darkpen', aiReply, 'text').catch(err => {
            console.error("Failed to send AI push notification to group members:", err);
        });
    } catch (err) {
        console.error("Error generating/sending AI group response:", err);
    }
}

// 1. Create Group
exports.createGroup = async (req, res) => {
    const { name, description, is_private, image_url } = req.body;
    const userId = req.user.id;

    let finalImageUrl = image_url;
    if (image_url && image_url.startsWith('data:image')) {
        finalImageUrl = await saveBase64Image(image_url, 'groups');
    }

    try {
        const [result] = await db.query(
            'INSERT INTO groups_list (name, description, created_by, is_private, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, description, userId, is_private || false, finalImageUrl]
        );
        const groupId = result.insertId;

        // Add creator as admin
        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, userId, 'admin']
        );

        // Add Darkpen AI as member
        try {
            const aiUserId = await getOrCreateAIUser();
            await db.query(
                'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
                [groupId, aiUserId, 'member']
            );
        } catch (aiErr) {
            console.error("Error adding AI to group:", aiErr);
        }

        res.status(201).json({ status: 'success', message: 'Group created successfully', groupId });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 2. Get My Groups (With unread count)
exports.getMyGroups = async (req, res) => {
    const userId = req.user.id;
    try {
        const [groups] = await db.query(
            `SELECT g.*, gm.role, gm.last_read_id,
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            (SELECT COUNT(*) FROM group_messages_v2 WHERE group_id = g.id AND id > gm.last_read_id) as unread_count,
            (SELECT message FROM group_messages_v2 WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
            (SELECT created_at FROM group_messages_v2 WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
            FROM groups_list g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = ? AND g.is_active = TRUE
            ORDER BY last_message_time DESC`,
            [userId]
        );
        res.json(groups);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 3. Get All Public Groups
exports.getAllPublicGroups = async (req, res) => {
    const userId = req.user.id;
    const { search } = req.query;
    try {
        let query = `SELECT g.*, 
            (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
            EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?) as is_member
            FROM groups_list g 
            WHERE g.is_private = FALSE AND g.is_active = TRUE`;
        
        const params = [userId];
        if (search) {
            query += ' AND (g.name LIKE ? OR g.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [groups] = await db.query(query, params);
        res.json(groups);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 4. Join Group
exports.joinGroup = async (req, res) => {
    const { groupId } = req.body;
    const userId = req.user.id;
    try {
        const [group] = await db.query('SELECT is_private FROM groups_list WHERE id = ?', [groupId]);
        if (!group.length) return res.status(404).json({ message: 'Group not found' });
        if (group[0].is_private) return res.status(403).json({ message: 'This is a private group' });

        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, userId, 'member']
        );
        res.json({ status: 'success', message: 'Joined successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 5. Add Member (Admin only)
exports.addMember = async (req, res) => {
    const { groupId, targetUserId } = req.body;
    const userId = req.user.id;

    try {
        const [adminCheck] = await db.query(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        if (!adminCheck.length || adminCheck[0].role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can add members' });
        }

        await db.query(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, targetUserId, 'member']
        );
        res.json({ status: 'success', message: 'Member added' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 6. Get Group Messages (Update last_read_id)
exports.getGroupMessages = async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id;

    try {
        const [memberCheck] = await db.query(
            'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        if (!memberCheck.length) return res.status(403).json({ message: 'Not a member' });

        const [messages] = await db.query(
            `SELECT m.*, u.name as sender_name, u.username as sender_username, u.profile_picture as sender_avatar
            FROM group_messages_v2 m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ?
            ORDER BY m.created_at ASC`,
            [groupId]
        );

        // Update last read to the latest message ID
        if (messages.length > 0) {
            const latestId = messages[messages.length - 1].id;
            await db.query(
                'UPDATE group_members SET last_read_id = ? WHERE group_id = ? AND user_id = ?',
                [latestId, groupId, userId]
            );
        }

        res.json(messages);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 7. Send Group Message
exports.sendGroupMessage = async (req, res) => {
    const { groupId, message, type } = req.body;
    const userId = req.user.id;

    try {
        // Combined Query: Check membership and get sender name in a single database roundtrip
        const [memberRows] = await db.query(
            `SELECT gm.role, u.name 
             FROM group_members gm 
             JOIN users u ON gm.user_id = u.id 
             WHERE gm.group_id = ? AND gm.user_id = ?`,
            [groupId, userId]
        );
        if (!memberRows.length) return res.status(403).json({ message: 'Not a member' });
        const senderName = memberRows[0].name || 'Student';

        // Retrieve wallet details and check expiration in a single query
        const [walletRows] = await db.query(
            'SELECT balance, last_updated FROM user_wallet WHERE user_id = ?',
            [userId]
        );
        
        let senderBalance = walletRows.length > 0 ? walletRows[0].balance : 0;
        
        // Handle wallet expiration asynchronously if older than 30 days
        if (walletRows.length > 0) {
            const { balance, last_updated } = walletRows[0];
            if (balance > 0 && last_updated) {
                const lastUpdatedDate = new Date(last_updated);
                const now = new Date();
                const diffMs = now.getTime() - lastUpdatedDate.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (diffDays >= 10) {
                    console.log(`[WALLET EXPIRATION] Expiring wallet for user ${userId} in group chat.`);
                    db.query(
                        'UPDATE user_wallet SET balance = 0, last_updated = NOW() WHERE user_id = ?',
                        [userId]
                    ).catch(err => console.error('[WALLET EXPIRATION] DB error:', err));
                    
                    db.query(
                        'INSERT INTO wallet_expirations (user_id, expired_balance) VALUES (?, ?)',
                        [userId, balance]
                    ).catch(err => console.error('[WALLET EXPIRATION] Insert error:', err));

                    // Send push notification asynchronously
                    pushService.sendPushNotification(
                        userId,
                        'Credits-kaagii waa uu dhacay',
                        `Credits-kaagii (Pay as you go) oo ahaa ${balance} ayaa dhacay sababtoo ah ma aadan isticmaalin muddo 10 casho ah. Fadlan ku shubo credits cusub.`
                    ).catch(err => console.error('[WALLET EXPIRATION] Push notification error:', err.message));

                    senderBalance = 0;
                }
            }
        }

        // Determine if it is a question and its cost
        const isTextQuestion = (type !== 'image' && shouldAIRespond(message));
        const isImageQuestion = (type === 'image');
        
        let cost = 0;
        if (isTextQuestion) cost = 10;
        else if (isImageQuestion) cost = 20;

        const usedFreeAI = cost > 0 ? await tryUseFreeAI(userId, isImageQuestion ? 'image' : 'text') : false;

        // Check if user has sufficient credits for this question
        if (cost > 0 && !usedFreeAI && senderBalance < cost) {
            return res.status(402).json({
                status: 'error',
                needsPayment: true,
                freeTrialExhausted: true,
                error: 'free_trial_exhausted',
                message: `✋ Free trial-kaagu wuu dhammaaday. Su'aalaha ${isTextQuestion ? 'qoraalka' : 'sawirada'} ah waxay u baahan yihiin ${cost} credits. Fadlan lacag ku shubo si aad u sii wadato.`
            });
        }

        // Prepare attachment for Gemini if it's an image
        let aiAttachment = null;
        if (isImageQuestion && message && message.startsWith('data:image')) {
            const mimeMatch = message.match(/^data:([^;]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64Data = message.replace(/^data:[^;]+;base64,/, '');
            aiAttachment = {
                base64: base64Data,
                mimeType: mimeType
            };
        }

        // Save base64 image if type is image
        let finalMessage = message;
        if (type === 'image' && message && message.startsWith('data:image')) {
            finalMessage = await saveBase64Image(message, 'chats');
        }

        // Deduct credit from sender's wallet
        if (cost > 0 && !usedFreeAI) {
            await db.query('UPDATE user_wallet SET balance = GREATEST(0, balance - ?) WHERE user_id = ?', [cost, userId]);
        }

        const [result] = await db.query(
            'INSERT INTO group_messages_v2 (group_id, user_id, message, type) VALUES (?, ?, ?, ?)',
            [groupId, userId, finalMessage, type || 'text']
        );
        const messageId = result.insertId;

        // Return status 201 immediately, run the rest in the background!
        res.status(201).json({ status: 'success', messageId, message: finalMessage });

        (async () => {
            try {
                // Update sender's last_read_id so they don't see their own message as unread
                await db.query(
                    'UPDATE group_members SET last_read_id = ? WHERE group_id = ? AND user_id = ?',
                    [messageId, groupId, userId]
                );

                // Send Push Notifications to other group members
                sendGroupPushNotifications(groupId, userId, senderName, finalMessage, type || 'text').catch(err => {
                    console.error("Failed to send user message push notification to group members:", err);
                });

                // Check if AI should respond
                const aiUserId = await getOrCreateAIUser();
                if (userId !== aiUserId && (isTextQuestion || isImageQuestion)) {
                    handleAIGroupResponse(req, groupId, userId, senderName, finalMessage, aiUserId, type || 'text', aiAttachment).catch(err => {
                        console.error("Error in AI group response task:", err);
                    });
                }
            } catch (bgErr) {
                console.error("[GROUP_MSG] Error running async background tasks:", bgErr);
            }
        })();
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 8. Get Group Members
exports.getGroupMembers = async (req, res) => {
    const { groupId } = req.params;
    try {
        const [members] = await db.query(
            `SELECT u.id, u.name, u.username, u.profile_picture, gm.role, gm.joined_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY gm.role DESC, u.name ASC`,
            [groupId]
        );
        res.json(members);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 9. Update Group Info (Admin only)
exports.updateGroup = async (req, res) => {
    const { groupId } = req.params;
    const { name, description, image_url } = req.body;
    const userId = req.user.id;

    console.log(`[UPDATE GROUP] ID: ${groupId}, User: ${userId}`);

    try {
        // 1. Check if user is admin
        const [adminCheck] = await db.query(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        if (!adminCheck.length || adminCheck[0].role !== 'admin') {
            console.log(`[UPDATE GROUP] Access Denied for user ${userId}`);
            return res.status(403).json({ message: 'Only admins can update group info' });
        }

        // 2. Fetch current data to avoid nulling out missing fields
        const [current] = await db.query('SELECT name, description, image_url FROM groups_list WHERE id = ?', [groupId]);
        if (!current.length) return res.status(404).json({ message: 'Group not found' });

        const finalName = name || current[0].name;
        const finalDesc = description !== undefined ? description : current[0].description;
        
        let finalImage = image_url || current[0].image_url;
        if (image_url && image_url.startsWith('data:image')) {
            finalImage = await saveBase64Image(image_url, 'groups');
        }

        // 3. Update with final values
        await db.query(
            'UPDATE groups_list SET name = ?, description = ?, image_url = ? WHERE id = ?',
            [finalName, finalDesc, finalImage, groupId]
        );

        console.log(`[UPDATE GROUP] Success for group ${groupId}`);
        res.json({ status: 'success', message: 'Group updated successfully' });
    } catch (err) {
        console.error(`[UPDATE GROUP] Error:`, err);
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 10. Ensure AI Presence In All Groups
exports.ensureAIPresenceInAllGroups = async () => {
    try {
        const aiUserId = await getOrCreateAIUser();
        
        // Fetch all active group IDs
        const [groups] = await db.query('SELECT id FROM groups_list WHERE is_active = TRUE');
        
        // Add AI to each group
        for (const group of groups) {
            await db.query(
                'INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, "member")',
                [group.id, aiUserId]
            );
        }
        console.log(`[AI PRESENCE] Successfully ensured Darkpen AI is in all ${groups.length} groups.`);
    } catch (err) {
        console.error('[AI PRESENCE] Error during initialization:', err);
    }
};
