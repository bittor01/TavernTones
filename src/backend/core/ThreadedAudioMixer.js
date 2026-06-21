// Performance and security update
const { Worker } = require('worker_threads');
const { Readable } = require('stream');
const path = require('path');

/**
 * A multi-channel audio mixer that runs in a separate thread.
 * Pipes multiple input streams into a single output stream for Discord.
 */
class ThreadedAudioMixer extends Readable {
    /**
     * Initializes the mixer and spawns the worker thread.
     */
    constructor() {
        super();
        // Spawn the background worker that performs the actual byte mixing
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        // Map to track active input streams and their listeners for cleanup
        this.inputs = new Map(); // id -> { stream, onData, onEnd, onError }
        // Local buffer of mixed audio chunks received from the worker
        this.bufferQueue = [];
        this.isReady = false;
        // Number of chunks to keep in flight to prevent audio underruns (jitter buffer)
        this.BUFFER_TARGET = 40; // ~800ms of audio
        // Counter for active requests to the worker
        this.pendingRequests = 0;
        // ID to correlate requests and discard data from previous tracks/resets
        this.currentRequestId = 0;

        // Listen for mixed audio data returning from the worker thread.
        this.worker.on('message', (msg) => {
            if (msg.type === 'mixed-chunk') {
                this.pendingRequests = Math.max(0, this.pendingRequests - 1);

                // Check correlation ID. If a track was skipped or reset while the worker
                // was processing, we discard this chunk to prevent audio "ghosts".
                if (msg.requestId !== undefined && msg.requestId !== this.currentRequestId) {
                    // We immediately request a replacement chunk with the NEW ID
                    // to keep the audio buffer from emptying.
                    this._maybeFillTarget();
                    return;
                }

                // Convert raw data array back to a Node.js Buffer
                const buffer = Buffer.from(msg.data);
                this.bufferQueue.push(buffer);
                // Ensure we stay at our buffer target
                this._maybeFillTarget();

                // If the stream consumer is waiting for data, push the new chunk immediately
                if (this.isReading && this.bufferQueue.length > 0) {
                    this.push(this.bufferQueue.shift());
                    this.isReading = false;
                }
            }
        });

        // Log worker errors to the console
        this.worker.on('error', (err) => {
            console.error('AudioMixerWorker error:', err);
            this.emit('error', err);
        });

        // Handle unexpected worker termination
        this.worker.on('exit', (code) => {
            if (this.isDestroyed) return;
            if (code !== 0) {
                console.error(`AudioMixerWorker stopped with exit code ${code}`);
                this.emit('error', new Error(`Worker stopped with exit code ${code}`));
            }
        });
        this.isReading = false;
        this.isDestroyed = false;

        // Global error handler for the mixer stream
        this.on('error', (err) => {
            // Ignore expected errors during connection transitions
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            console.error('ThreadedAudioMixer error:', err);
        });
    }

    /**
     * Standard Readable stream interface.
     * This is called by Discord's AudioResource when it's ready for the next 20ms of audio.
     */
    _read(size) {
        // If our look-ahead buffer has data, provide it immediately.
        if (this.bufferQueue.length > 0) {
            this.push(this.bufferQueue.shift());
            // Signal the worker to start preparing a new chunk to replace the one we just used.
            this._maybeFillTarget();
        } else {
            // If the buffer is empty (underrun), we set a flag to push the next
            // chunk the moment it arrives from the worker.
            this.isReading = true;
            this._maybeFillTarget();
        }
    }

    /**
     * Maintains the jitter buffer (look-ahead) to ensure smooth playback
     * even if IPC messages are delayed.
     */
    _maybeFillTarget() {
        // We calculate how many chunks are needed to reach our BUFFER_TARGET (800ms).
        const chunksNeeded = this.BUFFER_TARGET - (this.bufferQueue.length + this.pendingRequests);

        // Request each missing chunk from the worker.
        for (let i = 0; i < chunksNeeded; i++) {
            this.pendingRequests++;
            // Tag each request with the currentRequestId so we can validate it on return.
            this.worker.postMessage({ type: 'request-mix', requestId: this.currentRequestId });
        }
    }

    /**
     * Connects a new audio input stream to the mixer.
     * @param {Readable} stream - The raw PCM audio stream.
     * @param {string} id - Unique identifier for this channel (e.g., 'music', 'sfx_1').
     * @param {number} [volume=1.0] - Initial volume for this channel.
     */
    addInput(stream, id, volume = 1.0) {
        // Remove existing input on this ID to prevent overlapping listeners
        this.removeInput(id);

        /**
         * Listener to forward data chunks from the input stream to the worker.
         */
        const onData = (chunk) => {
            if (this.isDestroyed) return;
            // Send the raw buffer to the worker for mixing
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        };
        const onEnd = () => {};

        /**
         * Listener to handle errors on the individual input stream.
         */
        const onError = (err) => {
            console.error(`Stream error for input ${id}:`, err);
            // Auto-remove the failed input
            this.removeInput(id);
        };

        // Attach listeners to the source stream
        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);

        // Store listeners for future removal
        this.inputs.set(id, { stream, onData, onEnd, onError });
        // Notify worker of the new input channel
        this.worker.postMessage({ type: 'add-input', id, volume });
    }

    /**
     * Updates the volume multiplier for a specific input channel.
     * @param {string} id - Channel ID.
     * @param {number} volume - Volume multiplier.
     */
    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    }

    /**
     * Removes an input channel and cleans up its listeners.
     * @param {string} id - Channel ID.
     */
    removeInput(id) {
        const input = this.inputs.get(id);
        if (input) {
            // Detach all listeners to prevent memory leaks and duplicate data handling
            input.stream.removeListener('data', input.onData);
            input.stream.removeListener('end', input.onEnd);
            input.stream.removeListener('error', input.onError);
            this.inputs.delete(id);
        }
        // Notify worker to drop this channel
        this.worker.postMessage({ type: 'remove-input', id });
    }

    /**
     * Flushes the music channel and resets the request pipeline.
     * Keeps soundboard (SFX) channels active.
     */
    reset() {
        // Iterate through all inputs and remove the primary music channel
        for (const id of this.inputs.keys()) {
            if (id === 'music') {
                this.removeInput(id);
            }
        }

        // Clear current buffer and pending request tracking
        this.bufferQueue = [];
        this.pendingRequests = 0;
        // Increment request ID to invalidate any chunks currently being processed by the worker
        this.currentRequestId++;
        // Restart the look-ahead buffer
        this._maybeFillTarget();
    }

    /**
     * Terminates the mixer worker and cleans up the stream.
     */
    destroy() {
        this.isDestroyed = true;
        // Force kill the worker thread
        this.worker.terminate();
        // Call base class destroy
        super.destroy();
    }
}
module.exports = ThreadedAudioMixer;
