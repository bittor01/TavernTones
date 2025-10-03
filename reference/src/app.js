/**
 * @file This file configures and exports the main Express application instance.
 * It sets up all the necessary middleware, mounts the API routers, and includes
 * a maintenance mode feature to prevent requests from being processed before
 * the server has finished its initial data loading.
 * @author jules
 */

const express = require('express');
const sessionManager = require('./utils/sessionManager');

const app = express();
let isServerReady = false;

// Middleware to parse JSON request bodies.
app.use(express.json());

// --- Custom Middleware ---

// Middleware for API key authentication.
const apiKeyAuth = require('./middleware/auth');
app.use(apiKeyAuth);

// Middleware to handle session resets via a request header.
const sessionReset = require('./middleware/sessionReset');
app.use(sessionReset);


// --- Routers ---
const searchRouter = require('./routes/search');
const generatorRouter = require('./routes/generators');

/**
 * A simple root endpoint to confirm that the server is running.
 * @route GET /
 */
app.get('/', (req, res) => {
    res.send('The Oracle is listening...');
});

/**
 * Maintenance mode middleware.
 * If the server is not yet ready (i.e., data is still loading), this middleware
 * intercepts all API requests and returns a 503 Service Unavailable status.
 * This is skipped in a 'test' environment.
 */
app.use('/api/oracle', (req, res, next) => {
    if (!isServerReady && process.env.NODE_ENV !== 'test') {
        return res.status(503).json({ error: 'Server is initializing, please try again later.' });
    }
    next();
});

// Mount the API routers under the /api/oracle path.
app.use('/api/oracle', searchRouter);
app.use('/api/oracle', generatorRouter);

/**
 * Sets the readiness state of the server.
 * This function is called by the main `index.js` file after all initial
 * data has been loaded into memory.
 * @param {boolean} ready - True if the server is ready to accept requests, false otherwise.
 */
function setServerReady(ready) {
    isServerReady = ready;
}

module.exports = { app, setServerReady };