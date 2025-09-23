/**
 * A class to manage a prioritized, deduplicated queue of asynchronous tasks,
 * designed to handle Discord embed updates gracefully.
 */
class TDAUpdateQueue {
    /**
     * @param {object} options
     * @param {number} [options.delay=25] - The delay in ms between processing tasks.
     */
    constructor(options = {}) {
        this.queue = [];
        this.isProcessing = false;
        this.delay = options.delay || 25; // Delay between tasks. 25ms = 40 calls/sec.
    }

    /**
     * Adds a job to the queue and handles deduplication.
     * If a job with the same ID already exists, it's replaced.
     * Returns a promise that resolves when the job is completed.
     * @param {object} job - The job object to add to the queue.
     * @param {string} job.id - A unique identifier for the job (e.g., `player-embed-${playerId}`).
     * @param {number} job.priority - The job's priority (lower number is higher priority).
     * @param {function(): Promise<void>} job.task - The async function to execute.
     * @returns {Promise<void>} A promise that resolves when this specific job is done.
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
     * @private
     */
    async _processQueue() {
        while (this.queue.length > 0) {
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.timestamp - b.timestamp;
            });

            const job = this.queue.shift();

            try {
                await job.task();
                job.resolve();
            } catch (error) {
                if (error.code === 10008) { // "Unknown Message"
                    console.warn(`[TDAUpdateQueue] Job ${job.id} failed because message was likely deleted. Skipping.`);
                    job.resolve(); // Resolve even on this error so we don't hang.
                } else {
                    console.error(`[TDAUpdateQueue] Error processing job ${job.id}:`, error);
                    job.reject(error);
                }
            }

            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }

        this.isProcessing = false;
    }
}

module.exports = TDAUpdateQueue;
