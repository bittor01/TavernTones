// Performance and security update
const { Worker } = require('worker_threads');
const { Readable } = require('stream');
const path = require('path');

class ThreadedAudioMixer extends Readable {
    constructor() {
        super();
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        this.bufferQueue = [];
        this.isReady = false;
        this.BUFFER_TARGET = 20; // Maintain 20 chunks (~400ms) in buffer to smooth jitter

        this.worker.on('message', (msg) => {
            if (msg.type === 'mixed-chunk') {
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
        while (this.bufferQueue.length < this.BUFFER_TARGET) {
            this.worker.postMessage({ type: 'request-mix' });
            // We don't want to flood the worker too much,
            // but for 5 chunks it's perfectly fine and recommended for stability.
            break; // Just request one at a time for now to keep it steady
        }
    }

    addInput(stream, id, volume = 1.0) {
        this.worker.postMessage({ type: 'add-input', id, volume });

        // Pipe stream data to worker
        stream.on('data', (chunk) => {
            // We must copy or ensure the buffer is safe to pass? 
            // postMessage clones significantly unless transferred.
            // But we can just send it.
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        });

        stream.on('end', () => {
            // Do not automatically remove input? Or should we?
            // Usually BackendAudioPlayer manages stopped streams.
            // But for safety:
            // this.removeInput(id); // Let the player do explicit removal
        });

        stream.on('error', (err) => {
            console.error(`Stream error for input ${id}:`, err);
            this.removeInput(id);
        });
    }

    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    }

    removeInput(id) {
        this.worker.postMessage({ type: 'remove-input', id });
    }

    destroy() {
        this.isDestroyed = true;
        this.worker.terminate();
        super.destroy();
    }
}

module.exports = ThreadedAudioMixer;
