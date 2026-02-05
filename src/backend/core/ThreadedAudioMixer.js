const { Worker } = require('worker_threads');
const { Readable } = require('stream');
const path = require('path');

class ThreadedAudioMixer extends Readable {
    constructor() {
        super();
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        this.bufferQueue = [];
        this.isReady = false;

        this.worker.on('message', (msg) => {
            if (msg.type === 'mixed-chunk') {
                const buffer = Buffer.from(msg.data);
                if (this.isReading) {
                    this.push(buffer);
                    this.isReading = false;
                } else {
                    this.bufferQueue.push(buffer);
                }
            }
        });

        this.worker.on('error', (err) => {
            console.error('AudioMixerWorker error:', err);
            this.emit('error', err);
        });

        this.worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`AudioMixerWorker stopped with exit code ${code}`);
                this.emit('error', new Error(`Worker stopped with exit code ${code}`));
            }
        });

        this.isReading = false;

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
            const chunk = this.bufferQueue.shift();
            this.push(chunk);
        } else {
            // We need data. Ask worker for a mix.
            this.isReading = true;
            this.worker.postMessage({ type: 'request-mix' });
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
        this.worker.terminate();
        super.destroy();
    }
}

module.exports = ThreadedAudioMixer;
