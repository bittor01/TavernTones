// Performance and security update
// Use Worker from worker_threads to run the mixing logic in a separate background thread
const { Worker } = require('worker_threads');
// Use Readable from stream to allow this mixer to act as a source for Discord's audio player
const { Readable } = require('stream');
// Import path module to locate the worker script file
const path = require('path');

/**
 * ThreadedAudioMixer is a custom Readable stream that aggregates multiple audio inputs
 * (music, soundboard effects) and mixes them into a single stereo PCM stream.
 * The actual mixing is offloaded to a background Worker thread to prevent UI lag.
 */
class ThreadedAudioMixer extends Readable {
    /**
     * Initializes the mixer, starts the background worker, and sets up state tracking.
     */
    constructor() {
        // Initialize the parent Readable stream class
        super();
        // Spawn the background worker thread for mixing
        this.worker = new Worker(path.join(__dirname, 'AudioMixerWorker.js'));
        // Map to keep track of active input streams and their event listeners
        this.inputs = new Map(); // id -> { stream, onData, onEnd, onError }
        // Local queue of mixed audio chunks waiting to be pushed to the stream consumer
        this.bufferQueue = [];
        this.isReady = false;
        // BUFFER_TARGET: The mixer aims to keep about 800ms (40 chunks) of audio pre-mixed.
        // This acts as a jitter buffer to handle small delays in CPU or I/O.
        this.BUFFER_TARGET = 40;
        // Track how many mix requests are currently being processed by the worker
        this.pendingRequests = 0;
        // A correlation ID that increments on every track change to ensure stale audio
        // from a previous track isn't mixed into the new one.
        this.currentRequestId = 0;

        /**
         * Listen for messages from the background worker.
         * The worker sends 'mixed-chunk' messages containing the mixed PCM data.
         */
        this.worker.on('message', (msg) => {
            if (msg.type === 'mixed-chunk') {
                // One request has been fulfilled by the worker
                this.pendingRequests = Math.max(0, this.pendingRequests - 1);

                // Discard the received chunk if it belongs to an old request ID (e.g. from a skipped track)
                if (msg.requestId !== undefined && msg.requestId !== this.currentRequestId) {
                    // CRITICAL: We must request a new chunk immediately if we discard one,
                    // otherwise the look-ahead buffer will shrink and potentially stall the pipeline.
                    this._maybeFillTarget();
                    return;
                }

                // Convert the raw message data back into a Buffer and add to the queue
                const buffer = Buffer.from(msg.data);
                this.bufferQueue.push(buffer);

                // Check if we need to request more chunks from the worker
                this._maybeFillTarget();

                // If the stream consumer is waiting for data, provide the next chunk immediately
                if (this.isReading && this.bufferQueue.length > 0) {
                    this.push(this.bufferQueue.shift());
                    // Reset the reading flag until the next _read call
                    this.isReading = false;
                }
            }
        });

        // Handle unexpected errors in the worker thread
        this.worker.on('error', (err) => {
            console.error('AudioMixerWorker error:', err);
            this.emit('error', err);
        });

        // Handle worker termination
        this.worker.on('exit', (code) => {
            if (this.isDestroyed) return;
            if (code !== 0) {
                console.error(`AudioMixerWorker stopped with exit code ${code}`);
                this.emit('error', new Error(`Worker stopped with exit code ${code}`));
            }
        });

        // Internal flags for stream state management
        this.isReading = false;
        this.isDestroyed = false;

        // Catch and handle stream-specific errors to prevent process crashes
        this.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                // Ignore premature close errors, as they are expected during shutdown or track transitions
                return;
            }
            console.error('ThreadedAudioMixer error:', err);
        });
    }

    /**
     * Standard Readable stream _read implementation.
     * Called by the stream consumer when it needs more audio data.
     */
    _read(size) {
        // If we already have pre-mixed data in our buffer, push it to the consumer
        if (this.bufferQueue.length > 0) {
            this.push(this.bufferQueue.shift());
            // Proactively request more data to maintain the look-ahead buffer
            this._maybeFillTarget();
        } else {
            // If the buffer is empty, mark as waiting for data and request an immediate mix
            this.isReading = true;
            this._maybeFillTarget();
        }
    }

    /**
     * Internal helper to keep the worker busy until the look-ahead buffer is full.
     */
    _maybeFillTarget() {
        // Calculate how many more chunks we need to request to hit our BUFFER_TARGET
        // (Target - (Already In Queue + Already Requested))
        const chunksNeeded = this.BUFFER_TARGET - (this.bufferQueue.length + this.pendingRequests);
        for (let i = 0; i < chunksNeeded; i++) {
            this.pendingRequests++;
            // Send a mix request to the worker with the current correlation ID
            this.worker.postMessage({ type: 'request-mix', requestId: this.currentRequestId });
        }
    }

    /**
     * Adds a new audio source stream to the mixer.
     * @param {Readable} stream - The input audio stream (PCM format).
     * @param {string} id - Unique identifier for the input (e.g., 'music').
     * @param {number} [volume=1.0] - Initial volume multiplier for this input.
     */
    addInput(stream, id, volume = 1.0) {
        // Remove existing input with the same ID to prevent duplicates or resource leaks
        this.removeInput(id);

        // Define the data listener that forwards audio chunks to the worker thread
        const onData = (chunk) => {
            if (this.isDestroyed) return;
            this.worker.postMessage({ type: 'input-chunk', id, data: chunk });
        };

        // Placeholder for stream end handling
        const onEnd = () => {};

        // Error handler to cleanup when an input stream fails
        const onError = (err) => {
            console.error(`Stream error for input ${id}:`, err);
            this.removeInput(id);
        };

        // Attach listeners to the input stream
        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);

        // Store references so we can remove listeners later
        this.inputs.set(id, { stream, onData, onEnd, onError });
        // Notify the worker to create a new mixing channel for this ID
        this.worker.postMessage({ type: 'add-input', id, volume });
    }

    /**
     * Updates the volume multiplier for an active input.
     * @param {string} id - The identifier for the input.
     * @param {number} volume - The new volume multiplier (0.0 to 1.0+).
     */
    setInputVolume(id, volume) {
        this.worker.postMessage({ type: 'set-input-volume', id, volume });
    }

    /**
     * Stops an input and cleans up its listeners and resources.
     * @param {string} id - The identifier for the input to remove.
     */
    removeInput(id) {
        const input = this.inputs.get(id);
        if (input) {
            // Remove all event listeners to prevent memory leaks and duplicate processing
            input.stream.removeListener('data', input.onData);
            input.stream.removeListener('end', input.onEnd);
            input.stream.removeListener('error', input.onError);
            this.inputs.delete(id);
        }
        // Notify the worker to destroy the mixing channel for this ID
        this.worker.postMessage({ type: 'remove-input', id });
    }

    /**
     * Clears the main music channel and flushes the look-ahead buffers.
     * Called during track changes to ensure a clean transition.
     */
    reset() {
        // Iterate and remove the 'music' input specifically
        // Sound effects (SFX) are preserved so they can finish playing naturally
        for (const id of this.inputs.keys()) {
            if (id === 'music') {
                this.removeInput(id);
            }
        }

        // Flush the pre-mixed buffer queue
        this.bufferQueue = [];
        // Reset the pending request counter as we're invalidating all previous requests
        this.pendingRequests = 0;
        // Increment the request ID to invalidate any 'mixed-chunk' messages still in the worker IPC pipeline
        this.currentRequestId++;
        // Immediately start filling the look-ahead buffer again
        this._maybeFillTarget();
    }

    /**
     * Completely shuts down the mixer and terminates the background worker thread.
     */
    destroy() {
        this.isDestroyed = true;
        this.worker.terminate();
        // Call the parent Stream destroy method
        super.destroy();
    }
}

// Export the class for use in BackendAudioPlayer.js
module.exports = ThreadedAudioMixer;
