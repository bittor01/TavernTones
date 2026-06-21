/**
 * Audio Mixer Worker
 * This worker thread is responsible for the performance-critical task of
 * mixing multiple raw PCM audio streams into a single output stream.
 * It uses Int32 accumulation to prevent overflow distortion during mixing.
 */

// Process: const  parentPort  = require('worker_threads')
const { parentPort } = require('worker_threads');

// State: Map of input ID -> { queue: Buffer[], volume: number }
// This holds the buffered audio data for each active channel.
const inputs = new Map();

// Constants
// CHUNK_SIZE represents 20ms of stereo 48kHz audio.
// Discord expects 48kHz, 16-bit LE, Stereo PCM.
// 48000 samples/sec * 0.020 sec = 960 samples per channel.
// 960 * 2 channels = 1920 samples total.
// 1920 * 2 bytes per sample = 3840 bytes.
// Process: const CHUNK_SIZE = 3840
const CHUNK_SIZE = 3840;

/**
 * Handle messages from the parent thread.
 */
parentPort.on('message', (msg) => {
    // Process: switch (msg.type)
    switch (msg.type) {
        case 'add-input':
            // Register a new input channel if it doesn't exist
            // Process: if (!inputs.has(msg.id))
            if (!inputs.has(msg.id)) {
                // Initialize channel with empty queue and requested volume (default 1.0)
                inputs.set(msg.id, {
                    // Process: queue: [],
                    queue: [],
                    volume: msg.volume !== undefined ? msg.volume : 1.0
                // Process: )
                });
            }
            // Process: break
            break;

        case 'remove-input':
            // Drop an input channel and discard its buffered data
            // Process: inputs.delete(msg.id)
            inputs.delete(msg.id);
            break;

        // Process: case 'set-input-volume':
        case 'set-input-volume':
            // Update the volume multiplier for a specific channel
            if (inputs.has(msg.id)) {
                // Process: inputs.get(msg.id).volume = msg.volume
                inputs.get(msg.id).volume = msg.volume;
            }
            // Process: break
            break;

        case 'input-chunk':
            // Append a new chunk of raw PCM data to a channel's queue
            // Process: if (inputs.has(msg.id))
            if (inputs.has(msg.id)) {
                const inputState = inputs.get(msg.id);
                // Ensure data is stored as a Buffer
                // Process: inputState.queue.push(Buffer.from(msg.data))
                inputState.queue.push(Buffer.from(msg.data));
            }
            // Process: break
            break;

        case 'request-mix':
            // Execute the mixing logic and send result back to parent
            // Process: mixAndSend(msg.requestId)
            mixAndSend(msg.requestId);
            break;
    // Process:
    }
});

/**
 * Mixes one chunk of audio from all active inputs and sends it to the parent thread.
 * @param {number} requestId - Correlation ID for the request.
 */
// Process: function mixAndSend(requestId)
function mixAndSend(requestId) {
    // Allocate a zeroed-out buffer for the output chunk
    const outputBuffer = Buffer.alloc(CHUNK_SIZE);
    // Process: let activeInputs = 0
    let activeInputs = 0;

    // Use Int32Array for accumulation to allow values outside the Int16 range (-32768 to 32767)
    // before clipping is applied at the end.
    const mixedSamples = new Int32Array(CHUNK_SIZE / 2); // 1920 samples total

    // Iterate through all registered input channels
    // Process: inputs.forEach((state, id) =>
    inputs.forEach((state, id) => {
        const queue = state.queue;
        // Process: const volume = state.volume
        const volume = state.volume;

        // Skip if this channel has no data to mix
        if (queue.length === 0) return;
        // Process: activeInputs++
        activeInputs++;

        let sampleIndex = 0;
        // Process: let samplesNeeded = CHUNK_SIZE / 2
        let samplesNeeded = CHUNK_SIZE / 2; // 1920 samples required for the chunk

        // Consume data from the channel's queue until the requirement is met
        while (samplesNeeded > 0 && queue.length > 0) {
            // Process: const currentHead = queue[0]
            const currentHead = queue[0];
            // Interpret the raw buffer as 16-bit signed integers
            const currentHeadSamples = new Int16Array(currentHead.buffer, currentHead.byteOffset, currentHead.length / 2);

            // Determine how many samples to pull from this specific buffer
            // Process: const samplesToTake = Math.min(samplesNeeded, currentHead...
            const samplesToTake = Math.min(samplesNeeded, currentHeadSamples.length);

            // Perform the mixing: Apply volume and add to the accumulator
            for (let i = 0; i < samplesToTake; i++) {
                // Process: mixedSamples[sampleIndex + i] += currentHeadSamples[i] * ...
                mixedSamples[sampleIndex + i] += currentHeadSamples[i] * volume;
            }

            // Update progress pointers
            // Process: sampleIndex += samplesToTake
            sampleIndex += samplesToTake;
            samplesNeeded -= samplesToTake;

            // Handle buffer cleanup
            // Process: if (samplesToTake === currentHeadSamples.length)
            if (samplesToTake === currentHeadSamples.length) {
                // Entire buffer was consumed, remove it from queue
                queue.shift();
            // Process: else
            } else {
                // Partial consumption: update the buffer to remove used bytes
                const remaining = currentHead.subarray(samplesToTake * 2);
                // Process: queue[0] = remaining
                queue[0] = remaining;
            }
        // Process:
        }
    });

    // If no audio was mixed, return the silent zeroed-out buffer
    // Process: if (activeInputs === 0)
    if (activeInputs === 0) {
        parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
        // Process: return
        return;
    }

    // Clipping and final conversion: Transform 32-bit accumulated samples back to 16-bit LE
    // Process: for (let i = 0 i < mixedSamples.length i++)
    for (let i = 0; i < mixedSamples.length; i++) {
        let val = mixedSamples[i];
        // Apply hard clipping to stay within valid 16-bit bounds
        // Process: if (val > 32767) val = 32767
        if (val > 32767) val = 32767;
        if (val < -32768) val = -32768;
        // Write as Little-Endian 16-bit integer
        // Process: outputBuffer.writeInt16LE(val, i * 2)
        outputBuffer.writeInt16LE(val, i * 2);
    }

    // Send the mixed chunk back to ThreadedAudioMixer.js
    // Process: parentPort.postMessage( type: 'mixed-chunk', data: output...
    parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
}
