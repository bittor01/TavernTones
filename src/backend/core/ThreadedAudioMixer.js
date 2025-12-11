const { Worker } = require('worker_threads');
const { Readable } = require('stream');
const path = require('path');

class ThreadedAudioMixer extends Readable {
    constructor(logCallback) {
        super();
        this.log = logCallback || console.log;
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        this.bufferQueue = [];
        this.isReady = false;

        this.worker.on('message', (msg) => {
            if (msg.type === 'log') {
                this.log(`[Worker] ${msg.message}`);
                return;
            }
            if (msg.type === 'mixed-chunk') {
                this.log('[TAM] Received mixed chunk from worker.');
                const buffer = Buffer.from(msg.data);
                if (this.isReading) {
                    this.log('[TAM] Pushing mixed chunk to consumer.');
                    this.push(buffer);
                    this.isReading = false;
                } else {
                    this.log('[TAM] Queuing mixed chunk.');
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
    }

    _read(size) {
        if (this.bufferQueue.length > 0) {
            const chunk = this.bufferQueue.shift();
            this.push(chunk);
        } else {
            this.isReading = true;
            this.worker.postMessage({ type: 'request-mix' });
        }
    }

    addInput(stream, id, volume = 1.0) {
        this.log(`[TAM] Adding input ${id}`);
        this.worker.postMessage({ type: 'add-input', id, volume });

        stream.on('data', (chunk) => {
            this.log(`[TAM] Received data chunk for ${id}, sending to worker.`);
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        });

        stream.on('error', (err) => {
            console.error(`Stream error for input ${id}:`, err);
            this.removeInput(id);
        });
    }

    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    }

    pauseInput(id) {
        this.worker.postMessage({ type: 'pause-input', id });
    }

    resumeInput(id) {
        this.worker.postMessage({ type: 'resume-input', id });
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