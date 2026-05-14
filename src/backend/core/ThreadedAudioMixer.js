// Performance and security update
const { Worker } = require('worker_threads');
const { Readable } = require('stream');
const path = require('path');

class ThreadedAudioMixer extends Readable {
    constructor() {
        super();
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        this.inputs = new Map(); // id -> { stream, onData }
        this.bufferQueue = [];
        this.isReady = false;
        this.BUFFER_TARGET = 20; // Maintain 20 chunks (~400ms) in buffer to smooth jitter
        this.pendingRequests = 0; // Track outstanding mix requests to prevent explosion

        this.worker.on('message', (msg) => {
            if (msg.type === 'mixed-chunk') {
                this.pendingRequests = Math.max(0, this.pendingRequests - 1);
                const buffer = Buffer.from(msg.data);
                this.bufferQueue.push(buffer);
                this._maybeFillTarget();

                if (this.isReading && this.bufferQueue.length > 0) {
                    this.push(this.bufferQueue.shift());
                    this.isReading = false;
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('AudioMixerWorker error:', err);
            this.emit('error', err);
        });

        this.worker.on('exit', (code) => {
            if (this.isDestroyed) return;
            if (code !== 0) {
                console.error(`AudioMixerWorker stopped with exit code ${code}`);
                this.emit('error', new Error(`Worker stopped with exit code ${code}`));
            }
        });

        this.isReading = false;
        this.isDestroyed = false;

        this.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                // Ignore premature close errors, as they are expected during shutdown or track changes
                return;
            }
            // Ensure we don't crash the main process if this is the only listener
            console.error('ThreadedAudioMixer error:', err);
        });
    }

    _read(size) {
        // The consumer (Discord) wants data.
        if (this.bufferQueue.length > 0) {
            this.push(this.bufferQueue.shift());
            this._maybeFillTarget();
        } else {
            // We are empty. Ask worker for data immediately.
            this.isReading = true;
            this._maybeFillTarget();
        }
    }

    _maybeFillTarget() {
        // Ensure we always have BUFFER_TARGET chunks requested/available
        // This is a simple look-ahead to keep the pipeline full
        // We subtract pendingRequests to avoid overwhelming the worker with duplicate requests
        const chunksNeeded = this.BUFFER_TARGET - (this.bufferQueue.length + this.pendingRequests);
        for (let i = 0; i < chunksNeeded; i++) {
            this.pendingRequests++;
            this.worker.postMessage({ type: 'request-mix' });
        }
    }

    addInput(stream, id, volume = 1.0) {
        this.removeInput(id);

        const onData = (chunk) => {
            if (this.isDestroyed) return;
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        };

        const onEnd = () => {
            // Optional: handle end
        };

        const onError = (err) => {
            console.error(`Stream error for input ${id}:`, err);
            this.removeInput(id);
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);

        this.inputs.set(id, { stream, onData, onEnd, onError });
        this.worker.postMessage({ type: 'add-input', id, volume });
    }

    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    }

    removeInput(id) {
        const input = this.inputs.get(id);
        if (input) {
            input.stream.removeListener('data', input.onData);
            input.stream.removeListener('end', input.onEnd);
            input.stream.removeListener('error', input.onError);
            this.inputs.delete(id);
        }
        this.worker.postMessage({ type: 'remove-input', id });
    }

    reset() {
        // Clear all inputs
        for (const id of this.inputs.keys()) {
            this.removeInput(id);
        }
        this.bufferQueue = [];
        this.pendingRequests = 0;
        // The worker queues are cleared by remove-input messages
        this._maybeFillTarget();
    }

    destroy() {
        this.isDestroyed = true;
        this.worker.terminate();
        super.destroy();
    }
}

module.exports = ThreadedAudioMixer;
