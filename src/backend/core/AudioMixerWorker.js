const { parentPort } = require('worker_threads');

// State: Map of input ID -> { queue: Buffer[], volume: number }
const inputs = new Map();

// Constants
const CHUNK_SIZE = 3840; // 20ms of stereo 48kHz audio (1920 samples * 2 channels * 2 bytes)

parentPort.on('message', (msg) => {
    switch (msg.type) {
        case 'add-input':
            if (!inputs.has(msg.id)) {
                // msg.volume is optional, default 1.0
                inputs.set(msg.id, { queue: [], volume: msg.volume !== undefined ? msg.volume : 1.0 });
            }
            break;

        case 'remove-input':
            inputs.delete(msg.id);
            break;

        case 'set-input-volume':
            if (inputs.has(msg.id)) {
                inputs.get(msg.id).volume = msg.volume;
            }
            break;

        case 'input-chunk':
            if (inputs.has(msg.id)) {
                const inputState = inputs.get(msg.id);
                inputState.queue.push(Buffer.from(msg.data));
            }
            break;

        case 'request-mix':
            mixAndSend(msg.requestId);
            break;
    }
});

function mixAndSend(requestId) {
    // We need to produce ONE CHUNK_SIZE buffer.
    const outputBuffer = Buffer.alloc(CHUNK_SIZE);
    let activeInputs = 0;

    // Use Int32Array for accumulation to avoid overflow before clipping
    const mixedSamples = new Int32Array(CHUNK_SIZE / 2); // 1920 samples (stereo interleaved)

    inputs.forEach((state, id) => {
        const queue = state.queue;
        const volume = state.volume;

        if (queue.length === 0) return;
        activeInputs++;

        let sampleIndex = 0;
        let samplesNeeded = CHUNK_SIZE / 2; // 1920

        // Consume buffers from the queue until we fill the mixing requirement or run out
        while (samplesNeeded > 0 && queue.length > 0) {
            const currentHead = queue[0];
            const currentHeadSamples = new Int16Array(currentHead.buffer, currentHead.byteOffset, currentHead.length / 2);

            const samplesToTake = Math.min(samplesNeeded, currentHeadSamples.length);

            // Add to mix with VOLUME scaling
            for (let i = 0; i < samplesToTake; i++) {
                mixedSamples[sampleIndex + i] += currentHeadSamples[i] * volume;
            }

            sampleIndex += samplesToTake;
            samplesNeeded -= samplesToTake;

            // Handle buffer consumption
            if (samplesToTake === currentHeadSamples.length) {
                // Fully consumed head
                queue.shift();
            } else {
                // Partially consumed head - slice and replace
                const remaining = currentHead.subarray(samplesToTake * 2);
                queue[0] = remaining; // Update head
            }
        }
    });

    if (activeInputs === 0) {
        // Silence
        parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
        return;
    }

    // Clipping and writing to output
    for (let i = 0; i < mixedSamples.length; i++) {
        let val = mixedSamples[i];
        if (val > 32767) val = 32767;
        if (val < -32768) val = -32768;
        outputBuffer.writeInt16LE(val, i * 2);
    }

    parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer, requestId });
}
