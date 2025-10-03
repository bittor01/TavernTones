/**
 * @file Implements a simple queue-based rate limiter for all outgoing Discord API requests.
 * This ensures that the bot does not exceed Discord's global rate limits, preventing 429 errors.
 * All bot replies and follow-ups should be wrapped in the `addToQueue` function.
 * @author jules
 */

const { DISCORD_API_MAX_REQUESTS_PER_SECOND } = require('./constants');

/**
 * The queue of pending API requests. Each element is an object containing the request function
 * and its corresponding promise resolve/reject functions.
 * @type {Array<{request: function, resolve: function, reject: function}>}
 */
const requestQueue = [];

/**
 * A flag to indicate whether the queue is currently being processed.
 * This prevents multiple `processQueue` loops from running simultaneously.
 * @type {boolean}
 */
let isProcessing = false;

/**
 * Processes the request queue one item at a time.
 * It takes the first item from the queue, executes it, and then sets a timeout
 * to process the next item. The timeout duration is calculated based on the
 * configured max requests per second.
 * @private
 */
const processQueue = async () => {
    if (requestQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { request, resolve, reject } = requestQueue.shift();

    try {
        const result = await request();
        resolve(result);
    } catch (error) {
        reject(error);
    }

    // Set a timeout to process the next item in the queue, effectively throttling the requests.
    setTimeout(processQueue, 1000 / DISCORD_API_MAX_REQUESTS_PER_SECOND);
};

/**
 * Adds a request function to the queue to be processed.
 * It returns a promise that will be resolved or rejected when the request is eventually executed.
 * @param {function(): Promise<any>} request A function that, when called, performs the Discord API request and returns a promise.
 * @returns {Promise<any>} A promise that resolves with the result of the request function.
 */
const addToQueue = (request) => {
    return new Promise((resolve, reject) => {
        requestQueue.push({ request, resolve, reject });
        // If the queue is not currently being processed, start the processing loop.
        if (!isProcessing) {
            processQueue();
        }
    });
};

module.exports = {
    addToQueue,
};