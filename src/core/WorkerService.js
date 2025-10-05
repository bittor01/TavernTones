const { Worker } = require('worker_threads');
const crypto = require('crypto');

class WorkerService {
    constructor(workerPath) {
        this.worker = new Worker(workerPath);
        this.promises = new Map();

        this.worker.on('message', (message) => {
            const { correlationId, error, result } = message;
            if (this.promises.has(correlationId)) {
                const { resolve, reject } = this.promises.get(correlationId);
                if (error) {
                    reject(new Error(error));
                } else {
                    // If the result is a plain object representing a Buffer, convert it back
                    if (result && result.type === 'Buffer' && Array.isArray(result.data)) {
                        resolve(Buffer.from(result.data));
                    } else {
                        resolve(result);
                    }
                }
                this.promises.delete(correlationId);
            }
        });

        this.worker.on('error', (error) => {
            console.error('Worker error:', error);
            // Reject all pending promises
            for (const [correlationId, { reject }] of this.promises.entries()) {
                reject(error);
                this.promises.delete(correlationId);
            }
        });

        this.worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker stopped with exit code ${code}`);
                const error = new Error(`Worker stopped with exit code ${code}`);
                for (const [correlationId, { reject }] of this.promises.entries()) {
                    reject(error);
                    this.promises.delete(correlationId);
                }
            }
        });
    }

    run(task, ...args) {
        return new Promise((resolve, reject) => {
            const correlationId = crypto.randomBytes(16).toString('hex');
            this.promises.set(correlationId, { resolve, reject });
            this.worker.postMessage({ task, args, correlationId });
        });
    }

    terminate() {
        return this.worker.terminate();
    }
}

module.exports = WorkerService;
