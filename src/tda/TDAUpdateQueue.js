/**
 * A class to manage a prioritized, deduplicated queue of asynchronous tasks,
 * designed to handle Discord embed updates gracefully.
 */
class TDAUpdateQueue {
    /**
     * @param {object} options
     * @param {number} [options.delay=250] - The delay in ms between processing tasks.
     */
    constructor(options = {}) {
        this.queue = [];
        this.isProcessing = false;
        this.delay = options.delay || 250; // Delay between tasks to avoid secondary rate limits
    }

    /**
     * Adds a job to the queue and handles deduplication.
     * If a job with the same ID already exists, it's replaced.
     * @param {object} job - The job object to add to the queue.
     * @param {string} job.id - A unique identifier for the job (e.g., `player-embed-${playerId}`).
     * @param {number} job.priority - The job's priority (lower number is higher priority).
     * @param {function(): Promise<void>} job.task - The async function to execute.
     */
    add(job) {
        // Add a timestamp for FIFO ordering within the same priority
        const jobWithTimestamp = { ...job, timestamp: Date.now() };

        const existingJobIndex = this.queue.findIndex(j => j.id === jobWithTimestamp.id);

        if (existingJobIndex !== -1) {
            // Replace existing job to ensure only the latest update is performed
            this.queue[existingJobIndex] = jobWithTimestamp;
        } else {
            this.queue.push(jobWithTimestamp);
        }

        // Start the processing loop if it's not already running
        this.start();
    }

    /**
     * Starts the queue processing loop if it's not already active.
     */
    start() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        // Do not await this call; let it run in the background.
        this._processQueue();
    }

    /**
     * The core worker loop that processes jobs from the queue.
     * @private
     */
    async _processQueue() {
        while (this.queue.length > 0) {
            // Sort the queue by priority, then by timestamp (for FIFO)
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority; // Lower number = higher priority
                }
                return a.timestamp - b.timestamp; // Older timestamp first
            });

            // Get the highest-priority job from the front of the queue
            const job = this.queue.shift();

            try {
                // Execute the job's task
                await job.task();
            } catch (error) {
                // Log errors but continue processing the rest of the queue.
                // discord.js handles standard 429 rate limit errors internally.
                // We only need to catch other errors, like trying to edit a deleted message.
                if (error.code === 10008) { // "Unknown Message"
                    console.warn(`[TDAUpdateQueue] Job ${job.id} failed because the message was likely deleted. Skipping.`);
                } else {
                    console.error(`[TDAUpdateQueue] Error processing job ${job.id}:`, error);
                }
            }

            // Wait for a short period before processing the next item
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }

        this.isProcessing = false;
    }
}

module.exports = TDAUpdateQueue;
