const { parentPort } = require('worker_threads');

// State: Map of input ID -> { queue: Buffer[], volume: number, paused: boolean }
const inputs = new Map();

// Constants
const CHUNK_SIZE = 3840; // 20ms of stereo 48kHz audio

parentPort.on('message', (msg) => {
    switch (msg.type) {
        case 'add-input':
            if (!inputs.has(msg.id)) {
                inputs.set(msg.id, {
                    queue: [],
                    volume: msg.volume !== undefined ? msg.volume : 1.0,
                    paused: false // Initialize as not paused
                });
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

        case 'pause-input':
            if (inputs.has(msg.id)) {
                inputs.get(msg.id).paused = true;
            }
            break;

        case 'resume-input':
            if (inputs.has(msg.id)) {
                inputs.get(msg.id).paused = false;
            }
            break;

        case 'input-chunk':
            if (inputs.has(msg.id)) {
                inputs.get(msg.id).queue.push(Buffer.from(msg.data));
            }
            break;

        case 'request-mix':
            mixAndSend();
            break;
    }
});

function mixAndSend() {
    const outputBuffer = Buffer.alloc(CHUNK_SIZE);
    const mixedSamples = new Int32Array(CHUNK_SIZE / 2); // Accumulate in 32-bit to prevent clipping
    let somethingWasMixed = false;

    inputs.forEach((state) => {
        const { queue, volume, paused } = state;

        // Skip this input if it's paused or has no data
        if (paused || queue.length === 0) {
            return;
        }

        somethingWasMixed = true;
        let bytesNeeded = CHUNK_SIZE;
        let outputSampleIndex = 0;

        while (bytesNeeded > 0 && queue.length > 0) {
            const head = queue[0];
            const bytesToTake = Math.min(bytesNeeded, head.length);

            for (let i = 0; i < bytesToTake; i += 2) {
                if (outputSampleIndex < mixedSamples.length) {
                    const sample = head.readInt16LE(i);
                    mixedSamples[outputSampleIndex] += Math.floor(sample * volume);
                    outputSampleIndex++;
                }
            }

            bytesNeeded -= bytesToTake;

            if (bytesToTake === head.length) {
                queue.shift();
            } else {
                queue[0] = head.subarray(bytesToTake);
            }
        }
    });

    if (somethingWasMixed) {
        // Clip and write to output buffer only if we mixed something
        for (let i = 0; i < mixedSamples.length; i++) {
            let sample = mixedSamples[i];
            if (sample > 32767) sample = 32767;
            if (sample < -32768) sample = -32768;
            outputBuffer.writeInt16LE(sample, i * 2);
        }
    }

    // Always send a buffer (either mixed audio or silence)
    parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer });
}