/**
 * @file The main entry point for the entire application.
 * This script initializes the server, loads all necessary data into memory,
 * and starts the Discord bot in a separate worker thread to ensure the API
 * and the bot run concurrently without blocking each other.
 * @author jules
 */

const { app, setServerReady } = require('./app');
const { loadData } = require('./utils/dataLoader');
const { Worker } = require('worker_threads');
const path = require('path');

/**
 * The port the Express server will listen on.
 * Defaults to 3000 if not specified in the environment variables.
 * @type {number}
 */
const PORT = process.env.PORT || 3000;

/**
 * Initializes and starts the application.
 * This function first loads all the 5etools data into memory. Once the data is
 * loaded, it marks the server as "ready" to accept API requests and starts the
 * Express server. It then spawns the Discord bot in a new worker thread.
 */
async function startServer() {
    // Load all 5etools data into memory before starting the server.
    await loadData();
    // Signal that the data is loaded and the API can start accepting requests.
    setServerReady(true);

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log('Server is now ready to accept requests.');
    });

    // Start the Discord bot in a separate worker thread to prevent it from
    // blocking the main thread used by the Express API server.
    console.log('Starting Discord bot worker...');
    const botWorker = new Worker(path.join(__dirname, 'bot', 'bot.js'));

    botWorker.on('online', () => {
        console.log('Discord bot worker is online.');
    });

    botWorker.on('error', (error) => {
        console.error('Discord bot worker error:', error);
    });

    botWorker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Discord bot worker stopped with exit code ${code}`);
        }
    });
}

// Start the application.
startServer();