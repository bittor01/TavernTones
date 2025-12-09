const { Readable } = require('stream');

/**
 * A custom Readable stream that mixes multiple 16-bit PCM stereo streams (48kHz).
 * It reads from all active input streams, sums the samples, clips them to the 16-bit range,
 * and pushes the mixed buffer.
 */
class AudioMixer extends Readable {
    constructor(options = {}) {
        super(options);
        this.inputs = new Map(); // Map<id, { stream: Readable, buffer: Buffer }>
        this.sampleRate = 48000;
        this.channels = 2;
        this.bitDepth = 16;
        this.bytesPerSample = this.bitDepth / 8;
        this.blockAlign = this.channels * this.bytesPerSample;
    }

    /**
     * Adds an input stream to the mixer.
     * @param {Readable} stream - The input PCM stream.
     * @param {string} id - A unique identifier for the input.
     */
    addInput(stream, id) {
        if (this.inputs.has(id)) {
            this.removeInput(id);
        }

        const input = {
            stream,
            buffer: Buffer.alloc(0),
            ended: false
        };

        stream.on('data', (chunk) => {
            input.buffer = Buffer.concat([input.buffer, chunk]);
            // If we have data and were waiting for it, trigger a read
            this.push(Buffer.alloc(0));
        });

        stream.on('end', () => {
            input.ended = true;
            // If the stream ends, we might need to clean it up, 
            // but we'll let the _read loop handle the final data.
            // We don't automatically remove it here to avoid race conditions during the final read,
            // but effectively it will stop contributing.
        });

        stream.on('error', (err) => {
            console.error(`Error on input stream ${id}:`, err);
            this.removeInput(id);
        });

        this.inputs.set(id, input);
    }

    /**
     * Removes an input stream from the mixer.
     * @param {string} id - The unique identifier of the input to remove.
     */
    removeInput(id) {
        const input = this.inputs.get(id);
        if (input) {
            input.stream.removeAllListeners('data');
            input.stream.removeAllListeners('end');
            input.stream.removeAllListeners('error');
            // Optionally destroy the stream if it's not needed elsewhere
            // input.stream.destroy(); 
            this.inputs.delete(id);
        }
    }

    _read(size) {
        // We want to read a specific amount of data, say 20ms worth, or whatever is requested.
        // For Discord/Opus, 20ms at 48kHz stereo 16-bit is:
        // 48000 samples/sec * 0.02 sec * 2 channels * 2 bytes/sample = 3840 bytes.

        const CHUNK_SIZE = 3840;
        const numSamples = CHUNK_SIZE / 2; // 16-bit samples (includes both channels interleaved)

        let mixedBuffer = Buffer.alloc(CHUNK_SIZE);
        mixedBuffer.fill(0);

        let activeInputs = 0;
        let samplesMixed = new Int32Array(numSamples); // Use Int32 to prevent overflow during summing

        for (const [id, input] of this.inputs) {
            if (input.buffer.length >= CHUNK_SIZE) {
                // We have enough data
                const chunk = input.buffer.subarray(0, CHUNK_SIZE);
                input.buffer = input.buffer.subarray(CHUNK_SIZE);

                // Mix this chunk
                for (let i = 0; i < numSamples; i++) {
                    const sample = chunk.readInt16LE(i * 2);
                    samplesMixed[i] += sample;
                }
                activeInputs++;
            } else if (input.ended && input.buffer.length === 0) {
                // Stream ended and no data left
                this.removeInput(id);
            } else {
                // Not enough data yet, but stream is active. 
                // We treat this as silence for this tick but keep the input.
                // Or we could wait? For real-time mixing, waiting is bad. 
                // We just output what we have (silence for this track).
                activeInputs++;
            }
        }

        // If no inputs are active, we can just push silence.
        // However, to keep the connection alive, sending silence is often good.
        // If we want to support pausing/stopping when empty, we could return null,
        // but for a mixer that feeds a voice connection, continuous stream is usually better.

        // Convert back to Int16 with clipping
        for (let i = 0; i < numSamples; i++) {
            let val = samplesMixed[i];
            if (val > 32767) val = 32767;
            if (val < -32768) val = -32768;
            mixedBuffer.writeInt16LE(val, i * 2);
        }

        this.push(mixedBuffer);
    }
}

module.exports = AudioMixer;
