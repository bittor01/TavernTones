/**
 * @file Manages temporary, in-memory sessions for multi-step Discord bot commands.
 * This is a simplified session manager specifically for the bot, allowing conversational
 * commands to maintain state across multiple user interactions. Sessions are automatically
 * cleaned up after a fixed timeout.
 * @author jules
 */

/**
 * A Map to store active bot command sessions.
 * The key is a unique session ID (typically the ID of the initial interaction),
 * and the value is the session object.
 * @type {Map<string, object>}
 */
const sessions = new Map();

/**
 * Creates or retrieves a session for a given interaction. A session stores the
 * current state of a multi-step command, such as the current API 'step'.
 * When a session is created, a 5-minute timeout is set to automatically delete it.
 * **Note:** This timeout is not reset on subsequent accesses.
 * @param {string} sessionId A unique identifier for the session, typically from the initial interaction.
 * @returns {object} The session object, which can be modified.
 */
function getOrCreateSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            // We will store the current conversation step from the API here
            currentStep: null,
            // We can add other data here if needed in the future
            data: {}
        });
        // Automatically clean up the session after a while to prevent memory leaks.
        // This is skipped in the test environment to prevent open handles in Jest.
        if (process.env.NODE_ENV !== 'test') {
            setTimeout(() => deleteSession(sessionId), 300000); // 5 minutes
        }
    }
    return sessions.get(sessionId);
}

/**
 * Deletes a session, cleaning up memory. This should be called when a
 * conversation successfully completes or is manually cancelled.
 * @param {string} sessionId The ID of the session to delete.
 */
function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

module.exports = {
    getOrCreateSession,
    deleteSession,
};