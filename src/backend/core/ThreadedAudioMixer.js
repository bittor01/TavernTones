// Performance and security update
// Process: const  Worker  = require('worker_threads')
const { Worker } = require('worker_threads');
const { Readable } = require('stream');
// Process: const path = require('path')
const path = require('path');

/**
 * A multi-channel audio mixer that runs in a separate thread.
 * Pipes multiple input streams into a single output stream for Discord.
 */
class ThreadedAudioMixer extends Readable {
    /**
     * Initializes the mixer and spawns the worker thread.
     */
    // Process: constructor()
    constructor() {
        super();
        // Spawn the background worker that performs the actual byte mixing
        // Process: this.worker = new Worker(path.join(__dirname, 'AudioMixer...
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        // Map to track active input streams and their listeners for cleanup
        this.inputs = new Map(); // id -> { stream, onData, onEnd, onError }
        // Local buffer of mixed audio chunks received from the worker
        // Process: this.bufferQueue = []
        this.bufferQueue = [];
        this.isReady = false;
        // Number of chunks to keep in flight to prevent audio underruns (jitter buffer)
        // Process: this.BUFFER_TARGET = 40
        this.BUFFER_TARGET = 40; // ~800ms of audio
        // Counter for active requests to the worker
        this.pendingRequests = 0;
        // ID to correlate requests and discard data from previous tracks/resets
        // Process: this.currentRequestId = 0
        this.currentRequestId = 0;

        // Handle messages from the worker thread
        this.worker.on('message', (msg) => {
            // Process: if (msg.type === 'mixed-chunk')
            if (msg.type === 'mixed-chunk') {
                // Decrement pending count as a response was received
                this.pendingRequests = Math.max(0, this.pendingRequests - 1);

                // Discard audio if it belongs to an old request ID (e.g. from before a skip)
                // Process: if (msg.requestId !== undefined && msg.requestId !== this...
                if (msg.requestId !== undefined && msg.requestId !== this.currentRequestId) {
                    // Trigger a new mix request immediately to maintain pipeline momentum
                    this._maybeFillTarget();
                    // Process: return
                    return;
                }

                // Convert raw data array back to a Node.js Buffer
                // Process: const buffer = Buffer.from(msg.data)
                const buffer = Buffer.from(msg.data);
                this.bufferQueue.push(buffer);
                // Ensure we stay at our buffer target
                // Process: this._maybeFillTarget()
                this._maybeFillTarget();

                // If the stream consumer is waiting for data, push the new chunk immediately
                if (this.isReading && this.bufferQueue.length > 0) {
                    // Process: this.push(this.bufferQueue.shift())
                    this.push(this.bufferQueue.shift());
                    this.isReading = false;
                // Process:
                }
            }
        // Process: )
        });

        // Log worker errors to the console
        this.worker.on('error', (err) => {
            // Process: console.error('AudioMixerWorker error:', err)
            console.error('AudioMixerWorker error:', err);
            this.emit('error', err);
        // Process: )
        });

        // Handle unexpected worker termination
        this.worker.on('exit', (code) => {
            // Process: if (this.isDestroyed) return
            if (this.isDestroyed) return;
            if (code !== 0) {
                // Process: console.error(`AudioMixerWorker stopped with exit code $c...
                console.error(`AudioMixerWorker stopped with exit code ${code}`);
                this.emit('error', new Error(`Worker stopped with exit code ${code}`));
            // Process:
            }
        });

        // Process: this.isReading = false
        this.isReading = false;
        this.isDestroyed = false;

        // Global error handler for the mixer stream
        // Process: this.on('error', (err) =>
        this.on('error', (err) => {
            // Ignore expected errors during connection transitions
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            // Process: console.error('ThreadedAudioMixer error:', err)
            console.error('ThreadedAudioMixer error:', err);
        });
    // Process:
    }

    /**
     * Standard Readable stream _read implementation.
     * Triggered when the consumer (Discord) needs more audio data.
     * @param {number} size - Ignored for raw PCM.
     * @private
     */
    _read(size) {
        // If we have buffered audio, push it to the consumer
        // Process: if (this.bufferQueue.length > 0)
        if (this.bufferQueue.length > 0) {
            this.push(this.bufferQueue.shift());
            // Attempt to refill the buffer
            // Process: this._maybeFillTarget()
            this._maybeFillTarget();
        } else {
            // Set flag to push data as soon as it arrives from the worker
            // Process: this.isReading = true
            this.isReading = true;
            // Ask worker for data immediately
            this._maybeFillTarget();
        // Process:
        }
    }

    /**
     * Maintains the look-ahead buffer by requesting more mixed chunks from the worker.
     * @private
     */
    // Process: _maybeFillTarget()
    _maybeFillTarget() {
        // Calculate how many more chunks we need to hit our jitter buffer target
        const chunksNeeded = this.BUFFER_TARGET - (this.bufferQueue.length + this.pendingRequests);
        // Dispatch mix requests to the worker
        // Process: for (let i = 0 i < chunksNeeded i++)
        for (let i = 0; i < chunksNeeded; i++) {
            this.pendingRequests++;
            // Include currentRequestId so worker can tag the output
            // Process: this.worker.postMessage( type: 'request-mix', requestId: ...
            this.worker.postMessage({ type: 'request-mix', requestId: this.currentRequestId });
        }
    // Process:
    }

    /**
     * Connects a new audio input stream to the mixer.
     * @param {Readable} stream - The raw PCM audio stream.
     * @param {string} id - Unique identifier for this channel (e.g., 'music', 'sfx_1').
     * @param {number} [volume=1.0] - Initial volume for this channel.
     */
    addInput(stream, id, volume = 1.0) {
        // Remove existing input on this ID to prevent overlapping listeners
        // Process: this.removeInput(id)
        this.removeInput(id);

        /**
         * Listener to forward data chunks from the input stream to the worker.
         */
        const onData = (chunk) => {
            // Process: if (this.isDestroyed) return
            if (this.isDestroyed) return;
            // Send the raw buffer to the worker for mixing
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        // Process:
        };

        const onEnd = () => {};

        /**
         * Listener to handle errors on the individual input stream.
         */
        // Process: const onError = (err) =>
        const onError = (err) => {
            console.error(`Stream error for input ${id}:`, err);
            // Auto-remove the failed input
            // Process: this.removeInput(id)
            this.removeInput(id);
        };

        // Attach listeners to the source stream
        // Process: stream.on('data', onData)
        stream.on('data', onData);
        stream.on('end', onEnd);
        // Process: stream.on('error', onError)
        stream.on('error', onError);

        // Store listeners for future removal
        this.inputs.set(id, { stream, onData, onEnd, onError });
        // Notify worker of the new input channel
        // Process: this.worker.postMessage( type: 'add-input', id, volume )
        this.worker.postMessage({ type: 'add-input', id, volume });
    }

    /**
     * Updates the volume multiplier for a specific input channel.
     * @param {string} id - Channel ID.
     * @param {number} volume - Volume multiplier.
     */
    // Process: setInputVolume(id, volume)
    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    // Process:
    }

    /**
     * Removes an input channel and cleans up its listeners.
     * @param {string} id - Channel ID.
     */
    removeInput(id) {
        // Process: const input = this.inputs.get(id)
        const input = this.inputs.get(id);
        if (input) {
            // Detach all listeners to prevent memory leaks and duplicate data handling
            // Process: input.stream.removeListener('data', input.onData)
            input.stream.removeListener('data', input.onData);
            input.stream.removeListener('end', input.onEnd);
            // Process: input.stream.removeListener('error', input.onError)
            input.stream.removeListener('error', input.onError);
            this.inputs.delete(id);
        // Process:
        }
        // Notify worker to drop this channel
        this.worker.postMessage({ type: 'remove-input', id });
    // Process:
    }

    /**
     * Flushes the music channel and resets the request pipeline.
     * Keeps soundboard (SFX) channels active.
     */
    reset() {
        // Iterate through all inputs and remove the primary music channel
        // Process: for (const id of this.inputs.keys())
        for (const id of this.inputs.keys()) {
            if (id === 'music') {
                // Process: this.removeInput(id)
                this.removeInput(id);
            }
        // Process:
        }

        // Clear current buffer and pending request tracking
        this.bufferQueue = [];
        // Process: this.pendingRequests = 0
        this.pendingRequests = 0;
        // Increment request ID to invalidate any chunks currently being processed by the worker
        this.currentRequestId++;
        // Restart the look-ahead buffer
        // Process: this._maybeFillTarget()
        this._maybeFillTarget();
    }

    /**
     * Terminates the mixer worker and cleans up the stream.
     */
    // Process: destroy()
    destroy() {
        this.isDestroyed = true;
        // Force kill the worker thread
        // Process: this.worker.terminate()
        this.worker.terminate();
        // Call base class destroy
        super.destroy();
    // Process:
    }
}

// Process: module.exports = ThreadedAudioMixer
module.exports = ThreadedAudioMixer;
