/**
 * TaskQueue — Per-user serial message queue
 *
 * WHY PER-USER SERIAL?
 *   If the same user sends 2 messages rapidly, both would race to:
 *     - Read the last 5 messages from DB  (same snapshot → stale history)
 *     - Insert user + AI messages          (out-of-order IDs / timestamps)
 *   Running them one-at-a-time prevents all these race conditions.
 *
 * WHY NO GLOBAL CAP?
 *   We use a paid Gemini API with high rate limits.
 *   Artificially capping concurrent requests means some users wait
 *   unnecessarily while the API is idle. Every user gets answered
 *   immediately as long as different users message at the same time.
 *   (If the same user sends multiple messages, they still run one-at-a-time.)
 */
class TaskQueue {
    constructor() {
        // userId/phone → Promise (tail of that user's serial chain)
        this.userQueues = new Map();
    }

    /**
     * Enqueue a task for a specific user.
     * Tasks for the SAME user run serially (one at a time, in order).
     * Tasks for DIFFERENT users run fully in parallel — no global cap.
     *
     * @param {string|number} userId  - unique key (phone JID, chat ID, etc.)
     * @param {() => Promise<any>} taskFn - async function to execute
     * @returns {Promise<any>}
     */
    push(userId, taskFn) {
        const key = String(userId);

        // Tail of the existing chain, or a resolved promise if the user is idle
        const previous = this.userQueues.get(key) || Promise.resolve();

        // Chain this task after the previous one, with a safety timeout
        const next = previous.then(() => this._runWithTimeout(taskFn, key));

        // Save the new tail; auto-clean when the user's chain goes idle
        const cleanup = next.finally(() => {
            if (this.userQueues.get(key) === cleanup) {
                this.userQueues.delete(key);
            }
        });

        this.userQueues.set(key, cleanup);

        // Caller can await this to know when their task completed/failed,
        // but most callers use .catch() and fire-and-forget
        return next;
    }

    /**
     * Run taskFn with a 90s safety timeout so a crashed/hung Gemini call
     * never permanently blocks a user's queue.
     */
    _runWithTimeout(taskFn, key) {
        return new Promise((resolve, reject) => {
            let done = false;

            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    console.warn(`[TASK QUEUE] Task for user "${key}" timed out after 90s — releasing user queue slot.`);
                    reject(new Error('Task timed out after 90s'));
                }
            }, 90000);

            taskFn()
                .then((res) => {
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        resolve(res);
                    }
                })
                .catch((err) => {
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        reject(err);
                    }
                });
        });
    }

    /**
     * Diagnostic: how many users currently have a pending/active task.
     */
    getStats() {
        return {
            activeUserQueues: this.userQueues.size,
        };
    }
}

module.exports = TaskQueue;
