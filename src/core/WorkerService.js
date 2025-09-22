const { Worker } = require('worker_threads');
const path = require('path');
const crypto = require('crypto');

class WorkerService {
    constructor(logCallback) {
        this.log = logCallback || console.log;
        this.worker = new Worker(path.join(__dirname, '..', 'worker.js'));
        this.pendingTasks = new Map();

        this.worker.on('message', (message) => {
            if (message.type === 'task-result') {
                const promise = this.pendingTasks.get(message.correlationId);
                if (promise) {
                    if (message.error) {
                        promise.reject(new Error(message.error));
                    } else {
                        promise.resolve(message.result);
                    }
                    this.pendingTasks.delete(message.correlationId);
                }
            } else if (message.type === 'log') {
                this.log(message.message);
            }
        });

        this.worker.on('error', (error) => {
            this.log(`[Worker Error] ${error.message}`);
            console.error('Worker error:', error);
        });

        this.worker.on('exit', (code) => {
            if (code !== 0) {
                const errorMsg = `Worker stopped with exit code ${code}`;
                this.log(`[Worker Error] ${errorMsg}`);
                console.error(errorMsg);
            }
        });
    }

    run(taskName, ...args) {
        return new Promise((resolve, reject) => {
            const correlationId = crypto.randomBytes(16).toString('hex');
            this.pendingTasks.set(correlationId, { resolve, reject });
            this.worker.postMessage({
                type: 'run-task',
                taskName,
                args,
                correlationId,
            });
        });
    }

    init() {
        this.worker.postMessage({ type: 'init' });
    }
}

module.exports = WorkerService;
