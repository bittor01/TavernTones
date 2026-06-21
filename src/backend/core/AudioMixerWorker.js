// Import the parentPort from worker_threads to communicate with the main process (ThreadedAudioMixer)
const { parentPort } = require('worker_threads');

// Internal State: A Map storing the audio queue and configuration for each active audio channel.
// Structure: Map<string, { queue: Buffer[], volume: number }>
const inputs = new Map();

// Constants for audio processing
// CHUNK_SIZE: The size of each mixed audio packet in bytes.
// 3840 bytes corresponds to 20ms of audio at a 48kHz sampling rate:
// (1920 samples per channel * 2 channels (stereo) * 2 bytes per sample (16-bit PCM))
const CHUNK_SIZE = 3840;

/**
 * Listener for messages from the main thread.
 * Handles adding/removing inputs, updating volume, and processing incoming audio data.
 */
parentPort.on('message', (msg) => {
    switch (msg.type) {
        // Registers a new audio source ID (e.g. 'music' or a sound effect slot index)
        case 'add-input':
            if (!inputs.has(msg.id)) {
                // Initialize the channel with an empty buffer queue and a default volume (1.0 = 100%)
                inputs.set(msg.id, { queue: [], volume: msg.volume !== undefined ? msg.volume : 1.0 });
            }
            break;

        // Removes an audio source and clears its remaining data
        case 'remove-input':
            inputs.delete(msg.id);
            break;

        // Updates the volume multiplier for a specific input ID
        case 'set-input-volume':
            if (inputs.has(msg.id)) {
                inputs.get(msg.id).volume = msg.volume;
            }
            break;

        // Receives a new raw PCM audio chunk for a specific input and adds it to its queue
        case 'input-chunk':
            if (inputs.has(msg.id)) {
                const inputState = inputs.get(msg.id);
                // Convert the incoming data (TypedArray) into a Buffer for reliable processing
                inputState.queue.push(Buffer.from(msg.data));
            }
            break;

        // Triggers the mixing process for the next 20ms chunk of audio
        case 'request-mix':
            mixAndSend(msg.requestId);
            break;
    }
});

/**
 * Performs the actual mixing of all queued audio inputs into a single output buffer.
 * Implements weighted addition and clipping to prevent audio distortion.
 * @param {number} requestId - Correlation ID from the main thread to track this specific request.
 */
function mixAndSend(requestId) {
    // Allocate a clean output buffer filled with zeros (silence)
    const outputBuffer = Buffer.alloc(CHUNK_SIZE);
    let activeInputs = 0;

    // Use an Int32Array to store the intermediate mixed samples.
    // We use 32-bit integers to prevent overflow when adding multiple 16-bit signals together.
    const mixedSamples = new Int32Array(CHUNK_SIZE / 2); // 1920 samples (interleaved L/R)

    // Iterate through all registered inputs to accumulate their audio data
    inputs.forEach((state, id) => {
        const queue = state.queue;
        const volume = state.volume;

        // If this channel has no data, skip it
        if (queue.length === 0) return;
        activeInputs++;

        let sampleIndex = 0;
        let samplesNeeded = CHUNK_SIZE / 2; // Target 1920 samples for the 20ms window

        // Consume audio chunks from this input's queue until we have enough for the 20ms window
        while (samplesNeeded > 0 && queue.length > 0) {
            const currentHead = queue[0];
            // View the buffer as 16-bit Little Endian signed integers (standard PCM)
            const currentHeadSamples = new Int16Array(currentHead.buffer, currentHead.byteOffset, currentHead.length / 2);

            // Determine how many samples to take from this specific buffer
            const samplesToTake = Math.min(samplesNeeded, currentHeadSamples.length);

            // Apply the volume multiplier and add the samples to the master mix
            for (let i = 0; i < samplesToTake; i++) {
                mixedSamples[sampleIndex + i] += currentHeadSamples[i] * volume;
            }

            sampleIndex += samplesToTake;
            samplesNeeded -= samplesToTake;

            // Handle the consumption logic for the head buffer in the queue
            if (samplesToTake === currentHeadSamples.length) {
                // If the whole buffer was used, remove it from the queue
                queue.shift();
            } else {
                // If only part of the buffer was used, update the head to start after the consumed portion
                const remaining = currentHead.subarray(samplesToTake * 2);
                queue[0] = remaining;
            }
        }
    });

    // Optimization: If no audio sources were active, return the zeroed (silent) buffer immediately
    if (activeInputs === 0) {
        parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
        return;
    }

    // Clipping Phase: Convert the 32-bit accumulated samples back to 16-bit PCM.
    // Any signal exceeding the 16-bit range is hard-clamped to the min/max limits.
    for (let i = 0; i < mixedSamples.length; i++) {
        let val = mixedSamples[i];
        // Clip to the maximum possible value for a signed 16-bit integer
        if (val > 32767) val = 32767;
        // Clip to the minimum possible value for a signed 16-bit integer
        if (val < -32768) val = -32768;
        // Write the clipped sample into the final output buffer as a 16-bit Little Endian value
        outputBuffer.writeInt16LE(val, i * 2);
    }

    // Send the final mixed 20ms chunk back to the main thread
    parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
}
