const db = require('../config/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Helper: Calculate quiz cost in credits based on user's plan ─────────────
// Goal: Make every user pay approximately $0.10 per quiz attempt regardless of plan
// - Pay as you go (credits): $0.005/credit → 20 credits = $0.10
// - Basic (monthly_3):       $0.003/credit → 33 credits = $0.099 ≈ $0.10
// - Premium (monthly_11):    $0.0022/credit → 45 credits = $0.099 ≈ $0.10
function getQuizCostForPlan(planType) {
    switch (planType) {
        case 'monthly_11': return 45;  // Premium users: 45 credits ≈ $0.10
        case 'monthly_3':  return 33;  // Basic users: 33 credits ≈ $0.10
        default:           return 20;  // Pay as you go / credits: 20 credits ≈ $0.10
    }
}

exports.generateQuiz = async (req, res) => {
    try {
        const userId = req.user.id;

        // 0. Check if tournament is active
        const [settingsRow] = await db.execute('SELECT is_active FROM tournament_settings WHERE id = 1');
        const settings = settingsRow.length > 0 ? settingsRow[0] : { is_active: 0 };
        if (!settings.is_active) {
            return res.status(400).json({
                status: 'not_started',
                message: 'Wali tartanku muu bilaabman. Fadlan isa sii diwaangeli si aad ula tartanto kumanaan arday.'
            });
        }

        // 1. Check if user is suspended from the tournament
        const [userRow] = await db.execute('SELECT is_suspended_from_tournament, tournament_opt_in FROM users WHERE id = ?', [userId]);
        if (userRow.length === 0) {
            return res.status(404).json({ message: 'User-ka lama helin' });
        }
        if (userRow[0].is_suspended_from_tournament) {
            return res.status(403).json({ message: 'Waan ka xunnahay, koontadaada waxaa laga joojiyey ka qayb galka tartanka. Fadlan la xiriir maamulka.' });
        }

        // 2. Check 24-hour limit on quiz attempts
        const [attempts] = await db.execute(
            'SELECT created_at FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (attempts.length > 0) {
            const lastAttemptTime = new Date(attempts[0].created_at).getTime();
            const now = Date.now();
            const diffMs = now - lastAttemptTime;
            const limitMs = 24 * 60 * 60 * 1000; // 24 hours

            if (diffMs < limitMs) {
                const secondsRemaining = Math.ceil((limitMs - diffMs) / 1000);
                return res.status(400).json({
                    status: 'locked',
                    seconds_remaining: secondsRemaining,
                    message: 'Hore ayaad u gashay tartanka maanta. Waxaad geli kartaa 24 saac kadib isku-daygaagii hore.'
                });
            }
        }

        // 3. Check Monetization: 5 Days Free, then plan-based credits
        const [attemptsCount] = await db.execute('SELECT COUNT(*) as total FROM quiz_attempts WHERE user_id = ?', [userId]);
        const totalAttempts = attemptsCount[0].total;

        if (totalAttempts >= 5) {
            // Get user's active plan to determine cost
            const [subRes] = await db.execute(
                'SELECT type FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = user_subscriptions.user_id) > 0 ORDER BY expiry_date DESC LIMIT 1',
                [userId]
            );
            const planType = subRes.length > 0 ? subRes[0].type : 'credits';
            const quizCost = getQuizCostForPlan(planType);

            // Check wallet balance
            const [wallet] = await db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]);
            const balance = wallet.length > 0 ? wallet[0].balance : 0;

            if (balance < quizCost) {
                return res.status(402).json({
                    status: 'insufficient_credits',
                    message: `Waan ka xunnahay, 5-tii maalmood ee lacag la'aanta (free) ahayd way kuu dhammaadeen. Tartanka maanta wuxuu u baahan yahay ${quizCost} Credits (qorshahaaagu ahaanshaha ${planType === 'credits' ? 'Pay as you go' : planType === 'monthly_3' ? 'Basic' : 'Premium'}). Fadlan ku shubo credits si aad u sii wadato!`
                });
            }

            // Deduct plan-appropriate credits
            await db.execute('UPDATE user_wallet SET balance = balance - ? WHERE user_id = ?', [quizCost, userId]);

            // Log quiz attempt to ai_usage_logs
            try {
                await db.execute(
                    'INSERT INTO ai_usage_logs (user_id, model_name, prompt_tokens, completion_tokens, cost, chat_type) VALUES (?, "quiz-generator", 0, 0, ?, "quiz")',
                    [userId, quizCost / 200]
                );
            } catch (logErr) {
                console.error('[AI Logger Error] Quiz log failed:', logErr.message);
            }
        }

        // 4. Generate 10-subject multilingual questions via Gemini
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        // Pull some educational chunks for context
        const [rows] = await db.execute('SELECT chunk_text FROM book_embeddings ORDER BY RAND() LIMIT 5');
        const contextText = rows.map(r => r.chunk_text).join("\n\n");

        const prompt = `Based on Somalian and Somaliland secondary school curriculum topics, generate a high-quality educational quiz containing exactly 10 questions.
        Each question must belong to a specific subject and be written in its corresponding academic instruction language as defined below:

        1. Tarbiyada (Islamic Studies) -> Written in ARABIC. Format: multiple-choice.
        2. Arabic Language -> Written in ARABIC. Format: multiple-choice.
        3. Somali Language -> Written in SOMALI. Format: multiple-choice.
        4. Physics -> Written in ENGLISH. Format: multiple-choice.
        5. Chemistry -> Written in ENGLISH. Format: multiple-choice.
        6. Biology -> Written in ENGLISH. Format: multiple-choice.
        7. History -> Written in ENGLISH. Format: multiple-choice.
        8. Geography -> Written in ENGLISH. Format: multiple-choice.
        9. English Language -> Written in ENGLISH. Format: multiple-choice.
        10. Mathematics -> Written in ENGLISH. Format: structured/short-answer (an analytical/critical-thinking math problem, NOT multiple choice).

        Textbook context to inspire the questions:
        ${contextText}

        All multiple-choice questions must have exactly 4 options and 1 correct answer (index 0-3).
        The Mathematics question must be a structured question with NO options, where the correct "answer" is a short text or number.

        Return a strict JSON object with this format:
        {
          "questions": [
            {
              "subject": "Tarbiyada",
              "type": "multiple-choice",
              "question": "...",
              "options": ["...", "...", "...", "..."],
              "answer": 0
            },
            ...
            {
              "subject": "Mathematics",
              "type": "structured",
              "question": "An analytical math word problem...",
              "answer": "15"
            }
          ]
        }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text().trim();
        const quizData = JSON.parse(responseText);

        if (!quizData.questions || quizData.questions.length === 0) {
            throw new Error('Gemini returned empty questions');
        }

        // ─── SECURITY FIX: Store full quiz (with answers) server-side ───────────
        // Generate a unique session token for this quiz attempt
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

        // Store the FULL quiz (including answers) server-side ONLY
        await db.execute(
            'INSERT INTO quiz_sessions (user_id, session_token, questions_json, expires_at) VALUES (?, ?, ?, ?)',
            [userId, sessionToken, JSON.stringify(quizData.questions), expiresAt]
        );

        // Strip answers from questions before sending to client
        const questionsForClient = quizData.questions.map(q => {
            const { answer, ...questionWithoutAnswer } = q;
            return questionWithoutAnswer;
        });

        res.json({
            status: 'success',
            opted_in: userRow[0].tournament_opt_in,
            free_attempts_used: totalAttempts,
            session_token: sessionToken,       // Client uses this token when submitting
            questions: questionsForClient      // NO answers included
        });

    } catch (error) {
        console.error("Quiz Generation Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday soo saarista quiska' });
    }
};

exports.optIn = async (req, res) => {
    try {
        const userId = req.user.id;
        await db.execute('UPDATE users SET tournament_opt_in = 1 WHERE id = ?', [userId]);
        res.json({
            status: 'success',
            message: 'Hambalyo! Waxaad si guul leh ugu biirtay Tartanka Qaran ee Billaha ah.'
        });
    } catch (error) {
        console.error("Opt-in Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday inta lagu guda jiray ka biirista tartanka' });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const { session_token, answers } = req.body;

        // ─── SECURITY: Validate session token and score server-side ─────────────
        if (!session_token || !answers || !Array.isArray(answers)) {
            return res.status(400).json({ message: 'Session token ama jawaabuhu waa maqan yihiin' });
        }

        // Fetch the quiz session from server (contains full questions WITH answers)
        const [sessionRows] = await db.execute(
            'SELECT * FROM quiz_sessions WHERE session_token = ? AND user_id = ? AND is_completed = 0 AND expires_at > NOW()',
            [session_token, userId]
        );

        if (sessionRows.length === 0) {
            return res.status(400).json({ 
                message: 'Session-ka quiz-ka lama helin, wuu dhacay, ama horeba waa la gudbiyey.'
            });
        }

        const session = sessionRows[0];
        const fullQuestions = JSON.parse(session.questions_json);

        // Score the quiz server-side by comparing submitted answers against stored answers
        let score = 0;
        fullQuestions.forEach((q, idx) => {
            const userAnswer = answers[idx];
            if (userAnswer === undefined || userAnswer === null) return;

            if (q.type === 'multiple-choice' && q.options) {
                const correctAnswer = q.options[Number(q.answer)];
                if (String(userAnswer).trim() === String(correctAnswer).trim()) {
                    score++;
                }
            } else {
                // Structured question - case-insensitive match
                if (String(userAnswer).trim().toLowerCase() === String(q.answer).trim().toLowerCase()) {
                    score++;
                }
            }
        });

        // Validate score is within bounds
        if (score < 0 || score > fullQuestions.length) {
            return res.status(400).json({ message: 'Score-ku waa khalad' });
        }

        // Mark session as completed (prevent resubmission)
        await db.execute('UPDATE quiz_sessions SET is_completed = 1 WHERE id = ?', [session.id]);

        // 1 correct answer = 10 XP
        const xpEarned = score * 10;

        // Check if opted in to save XP
        const [userRow] = await db.execute('SELECT tournament_opt_in FROM users WHERE id = ?', [userId]);
        const optedIn = userRow.length > 0 ? userRow[0].tournament_opt_in : 0;

        // Save attempt
        await db.execute(
            'INSERT INTO quiz_attempts (user_id, score, xp_earned) VALUES (?, ?, ?)',
            [userId, score, optedIn ? xpEarned : 0]
        );

        if (optedIn) {
            // Update user total XP
            await db.execute(
                'UPDATE users SET xp = xp + ? WHERE id = ?',
                [xpEarned, userId]
            );
        }

        // Fetch new total XP
        const [updatedUserRow] = await db.execute('SELECT xp FROM users WHERE id = ?', [userId]);
        const newTotalXp = updatedUserRow.length > 0 ? updatedUserRow[0].xp : 0;

        res.json({
            status: 'success',
            score: score,
            total_questions: fullQuestions.length,
            xp_earned: optedIn ? xpEarned : 0,
            new_total_xp: newTotalXp,
            opted_in: optedIn,
            message: optedIn ? `Hambalyo! Waxaad heshay +${xpEarned} XP!` : 'Natiijadaada waa la keydiyey! Ku biir tartanka si aad u kasbato dhibco (XP).'
        });
    } catch (error) {
        console.error("Submit Quiz Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday kaydinta natiijada quiska' });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // Fetch tournament settings
        const [settingsRow] = await db.execute('SELECT reveal_leaderboard FROM tournament_settings WHERE id = 1');
        const revealLeaderboard = settingsRow.length > 0 ? settingsRow[0].reveal_leaderboard : 0;

        // Fetch all top 20 contestants (uses compound index: tournament_opt_in, is_suspended_from_tournament, xp DESC)
        const [contestants] = await db.execute(`
            SELECT id, name, username, profile_picture, xp 
            FROM users 
            WHERE tournament_opt_in = 1 AND is_suspended_from_tournament = 0
            ORDER BY xp DESC, id ASC 
            LIMIT 20
        `);

        // Map contestants based on reveal settings and owner
        const leaderboard = contestants.map((u, idx) => {
            const isSelf = u.id === userId;
            
            if (revealLeaderboard || isSelf) {
                return {
                    id: u.id,
                    name: u.name,
                    username: u.username,
                    profile_picture: u.profile_picture,
                    xp: u.xp,
                    is_blurred: false
                };
            } else {
                return {
                    id: u.id,
                    name: `Contestant ${idx + 1}`,
                    username: 'hidden',
                    profile_picture: null,
                    xp: u.xp,
                    is_blurred: true
                };
            }
        });

        // Get calling user's rank (uses idx_users_xp_tournament index)
        const [userRankRow] = await db.execute(`
            SELECT COUNT(*) + 1 AS user_rank 
            FROM users 
            WHERE tournament_opt_in = 1 AND xp > (SELECT xp FROM users WHERE id = ?)
        `, [userId]);

        const [userInfoRow] = await db.execute(`
            SELECT xp, tournament_opt_in FROM users WHERE id = ?
        `, [userId]);

        const userRank = userRankRow.length > 0 ? userRankRow[0].user_rank : 0;
        const userXp = userInfoRow.length > 0 ? userInfoRow[0].xp : 0;
        const optedIn = userInfoRow.length > 0 ? userInfoRow[0].tournament_opt_in : 0;

        res.json({
            status: 'success',
            reveal_leaderboard: !!revealLeaderboard,
            leaderboard: leaderboard,
            user: {
                id: userId,
                xp: userXp,
                rank: optedIn ? userRank : '--',
                opted_in: optedIn
            }
        });
    } catch (error) {
        console.error("Get Leaderboard Error:", error);
        res.status(500).json({ message: 'Cilad ayaa ku dhacday soo saarista Leaderboard-ka' });
    }
};

exports.getQuizStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get user details and active plan in parallel
        const [[userRow], [subRes]] = await Promise.all([
            db.execute('SELECT is_suspended_from_tournament, tournament_opt_in FROM users WHERE id = ?', [userId]),
            db.execute('SELECT type FROM user_subscriptions WHERE user_id = ? AND expiry_date > NOW() AND (SELECT balance FROM user_wallet WHERE user_id = user_subscriptions.user_id) > 0 ORDER BY expiry_date DESC LIMIT 1', [userId])
        ]);

        if (userRow.length === 0) {
            return res.status(404).json({ message: 'User-ka lama helin' });
        }

        const user = userRow[0];
        const planType = subRes.length > 0 ? subRes[0].type : 'credits';
        const quizCost = getQuizCostForPlan(planType);

        // 2. Get wallet balance, attempts count, and last attempt in parallel
        const [[wallet], [attemptsCount], [attempts], [settingsRow]] = await Promise.all([
            db.execute('SELECT balance FROM user_wallet WHERE user_id = ?', [userId]),
            db.execute('SELECT COUNT(*) as total FROM quiz_attempts WHERE user_id = ?', [userId]),
            db.execute('SELECT created_at FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]),
            db.execute('SELECT * FROM tournament_settings WHERE id = 1')
        ]);

        const balance = wallet.length > 0 ? wallet[0].balance : 0;
        const totalAttempts = attemptsCount[0].total;

        // 3. Calculate lockout
        let lockoutSeconds = 0;
        if (attempts.length > 0) {
            const lastAttemptTime = new Date(attempts[0].created_at).getTime();
            const now = Date.now();
            const diffMs = now - lastAttemptTime;
            const limitMs = 24 * 60 * 60 * 1000;
            if (diffMs < limitMs) {
                lockoutSeconds = Math.ceil((limitMs - diffMs) / 1000);
            }
        }

        const settings = settingsRow.length > 0 ? settingsRow[0] : {};

        res.json({
            status: 'success',
            opted_in: !!user.tournament_opt_in,
            free_attempts_used: totalAttempts,
            user_credits: balance,
            lockout_seconds: lockoutSeconds,
            is_suspended: !!user.is_suspended_from_tournament,
            tournament_active: !!settings.is_active,
            reveal_leaderboard: !!settings.reveal_leaderboard,
            tournament_start_date: settings.start_date,
            reward_description: settings.reward_description || '',
            quiz_cost: quizCost,           // Tell frontend how many credits this quiz costs
            user_plan: planType,           // Tell frontend the plan type
            gen_ad_title: settings.gen_ad_title || '',
            gen_ad_desc: settings.gen_ad_desc || '',
            gen_ad_btn_text: settings.gen_ad_btn_text || '',
            gen_ad_btn_route: settings.gen_ad_btn_route || '',
            result_ad_title: settings.result_ad_title || '',
            result_ad_desc: settings.result_ad_desc || '',
            result_ad_btn_text: settings.result_ad_btn_text || '',
            result_ad_btn_route: settings.result_ad_btn_route || ''
        });
    } catch (error) {
        console.error("Get Quiz Status Error:", error);
        res.status(500).json({ message: 'Cilad ayaa dhacday haynta statuska quiska' });
    }
};
