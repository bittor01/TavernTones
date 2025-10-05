/**
 * @file Manages in-memory sessions for conversational API endpoints.
 * This module provides a simple way to create, retrieve, and delete temporary sessions
 * for multi-step interactions, with automatic cleanup of stale sessions.
 * @author jules
 */

/**
 * A Map to store active user sessions, with the session ID as the key.
 * @type {Map<string, object>}
 */
const sessions = new Map();

/**
 * The duration in milliseconds before a session is considered stale and removed.
 * Currently set to 15 minutes.
 * @type {number}
 */
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Retrieves a session by its ID. If the session doesn't exist, it creates a new one.
 * Accessing a session resets its timeout timer.
 * @param {string} sessionId The client-provided session ID.
 * @param {object} [initialData={}] The initial data to store if creating a new session.
 * @returns {object} The existing or newly created session object, which contains `data` and a `timestamp`.
 */
function getOrCreateSession(sessionId, initialData = {}) {
    if (sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        // Update timestamp on access to keep it alive
        session.timestamp = Date.now();
        sessions.set(sessionId, session);
        return session;
    } else {
        const session = {
            data: initialData,
            timestamp: Date.now()
        };
        sessions.set(sessionId, session);
        console.log(`[SessionManager] Created new session with client-provided ID: ${sessionId}`);
        return session;
    }
}

/**
 * Deletes a session by its ID.
 * This is useful for explicitly ending a conversation, such as when a generator completes.
 * @param {string} sessionId The ID of the session to delete.
 */
function deleteSession(sessionId) {
    if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
        console.log(`[SessionManager] Deleted session: ${sessionId}`);
    }
}

/**
 * Iterates through all active sessions and removes any that have expired.
 * This function is run periodically by `setInterval`.
 * @private
 */
function cleanupStaleSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
        if (now - session.timestamp > SESSION_TIMEOUT_MS) {
            deleteSession(sessionId);
            console.log(`[SessionManager] Purged stale session: ${sessionId}`);
        }
    }
}

// Run the cleanup function every minute, but not in the test environment.
if (process.env.NODE_ENV !== 'test') {
    setInterval(cleanupStaleSessions, 60 * 1000);
}

console.log('[SessionManager] Initialized.');

module.exports = {
    getOrCreateSession,
    deleteSession
};
