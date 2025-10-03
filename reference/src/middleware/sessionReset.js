/**
 * @file Contains Express middleware for explicitly resetting a user's session.
 * @author jules
 */

const { deleteSession } = require('../utils/sessionManager');

/**
 * An Express middleware that checks for a `resetSession: true` header in the request.
 * If the header is present and a `sessionId` is provided in the request body,
 * it deletes the corresponding session from the session manager. This allows a client
 * to forcefully start a new conversational flow from the beginning, even if a
 * previous session was still active.
 *
 * @param {import('express').Request} req The Express request object.
 * @param {import('express').Response} res The Express response object.
 * @param {import('express').NextFunction} next The next middleware function.
 */
function sessionReset(req, res, next) {
    const resetHeader = req.get('resetSession');

    if (resetHeader === 'true') {
        const { sessionId } = req.body;
        if (sessionId) {
            console.log(`[SessionReset] Received reset header for session: ${sessionId}. Deleting old session.`);
            deleteSession(sessionId);
        }
    }

    next();
}

module.exports = sessionReset;
