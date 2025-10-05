/**
 * @file Contains Express middleware for API key authentication.
 * @author jules
 */

// Read the required API key from environment variables.
const API_KEY = process.env.API_KEY;

/**
 * An Express middleware function that validates an API key sent in the `X-API-KEY` header.
 * If no `API_KEY` is configured in the server's environment variables, this middleware
 * will be skipped, allowing access without authentication. This is useful for local
 * development environments.
 *
 * @param {import('express').Request} req The Express request object.
 * @param {import('express').Response} res The Express response object.
 * @param {import('express').NextFunction} next The next middleware function.
 */
function apiKeyAuth(req, res, next) {
    // If no API_KEY is configured on the server, skip authentication.
    if (!API_KEY) {
        return next();
    }

    const suppliedApiKey = req.get('X-API-KEY');

    if (!suppliedApiKey) {
        return res.status(401).json({ error: 'Unauthorized: API key is required.' });
    }

    if (suppliedApiKey !== API_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid API key.' });
    }

    // If the key is valid, proceed to the next middleware or route handler.
    next();
}

module.exports = apiKeyAuth;
