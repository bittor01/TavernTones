/**
 * A class to manage a prioritized, deduplicated queue of asynchronous tasks,
 * designed to handle Discord embed updates gracefully. This helps prevent rate-limiting
 * by ensuring a delay between tasks and prioritizing important updates.
 */
class TDAUpdateQueue {
    /**
     * Creates an instance of TDAUpdateQueue.
     * @param {object} [options={}] - Configuration options for the queue.
     * @param {number} [options.delay=25] - The delay in ms between processing tasks.
     */
    constructor(options = {}) {
        /**
         * The array of jobs to be processed.
         * @private
         * @type {Array<object>}
         */
        this.queue = [];
        /**
         * Flag indicating if the queue is currently being processed.
         * @private
         * @type {boolean}
         */
        this.isProcessing = false;
        /**
         * The delay in milliseconds between processing each task.
         * @private
         * @type {number}
         */
        this.delay = options.delay || 25; // Delay between tasks. 25ms = 40 calls/sec.
    }

    /**
     * Adds a job to the queue and handles deduplication.
     * If a job with the same ID already exists, it's replaced with the new job,
     * and the promise for the old job is resolved to prevent hanging.
     * Returns a promise that resolves when the job is completed or rejected if it fails.
     * @param {object} job - The job object to add to the queue.
     * @param {string} job.id - A unique identifier for the job (e.g., `player-embed-${playerId}`). Used for deduplication.
     * @param {number} job.priority - The job's priority. Lower numbers are processed first.
     * @param {function(): Promise<void>} job.task - The asynchronous function to execute for this job.
     * @returns {Promise<void>} A promise that resolves when this specific job is done, or rejects on error.
     */
    add(job) {
        return new Promise((resolve, reject) => {
            const jobWithMeta = {
                ...job,
                timestamp: Date.now(),
                resolve: resolve,
                reject: reject
            };

            const existingJobIndex = this.queue.findIndex(j => j.id === jobWithMeta.id);

            if (existingJobIndex !== -1) {
                // If replacing a job, resolve the old promise immediately
                // so that any code awaiting it doesn't hang forever.
                this.queue[existingJobIndex].resolve();
                this.queue[existingJobIndex] = jobWithMeta;
            } else {
                this.queue.push(jobWithMeta);
            }

            this.start();
        });
    }

    /**
     * Starts the queue processing loop if it's not already active.
     * This method is called automatically when a new job is added.
     */
    start() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        this._processQueue();
    }

    /**
     * The core worker loop that processes jobs from the queue.
     * It sorts the queue by priority and timestamp, then executes tasks one by one
     * with a configured delay between them. It handles errors gracefully, especially
     * for common Discord API errors like "Unknown Message".
     * @private
     */
    async _processQueue() {
        while (this.queue.length > 0) {
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.timestamp - b.timestamp; // FIFO for same priority
            });

            const job = this.queue.shift();

            try {
                await job.task();
                job.resolve();
            } catch (error) {
                // "Unknown Message" error from Discord API, often happens if the user deletes the message
                // the bot is trying to edit. We can safely ignore this and move on.
                if (error.code === 10008) {
                    console.warn(`[TDAUpdateQueue] Job ${job.id} failed because message was likely deleted. Skipping.`);
                    job.resolve(); // Resolve even on this error so the caller doesn't hang.
                } else {
                    console.error(`[TDAUpdateQueue] Error processing job ${job.id}:`, error);
                    job.reject(error);
                }
            }

            // Wait for the specified delay before processing the next item.
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }

        this.isProcessing = false;
    }
}

module.exports = TDAUpdateQueue;