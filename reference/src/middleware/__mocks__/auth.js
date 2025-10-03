// Mock API Key Authentication Middleware
const apiKeyAuth = (req, res, next) => {
    // In a test environment, we bypass the actual authentication
    // and just proceed to the next middleware or route handler.
    next();
};

module.exports = apiKeyAuth;