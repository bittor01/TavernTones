const { parentPort } = require('worker_threads');

// State: Map of input ID -> { queue: Buffer[], volume: number, paused: boolean }
const inputs = new Map();

// Constants
const CHUNK_SIZE = 3840; // 20ms of stereo 48kHz audio

function log(message) {
    parentPort.postMessage({ type: 'log', message });
}

parentPort.on('message', (msg) => {
    switch (msg.type) {
        case 'add-input':
            log(`Adding input: ${msg.id}`);
            if (!inputs.has(msg.id)) {
                inputs.set(msg.id, {
                    queue: [],
                    volume: msg.volume !== undefined ? msg.volume : 1.0,
                    paused: false
                });
            }
            break;

        case 'remove-input':
            log(`Removing input: ${msg.id}`);
            inputs.delete(msg.id);
            break;

        case 'set-input-volume':
            if (inputs.has(msg.id)) {
                log(`Setting volume for ${msg.id} to ${msg.volume}`);
                inputs.get(msg.id).volume = msg.volume;
            }
            break;

        case 'pause-input':
            if (inputs.has(msg.id)) {
                log(`Pausing input: ${msg.id}`);
                inputs.get(msg.id).paused = true;
            }
            break;

        case 'resume-input':
            if (inputs.has(msg.id)) {
                log(`Resuming input: ${msg.id}`);
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
    const mixedSamples = new Int32Array(CHUNK_SIZE / 2);
    let somethingWasMixed = false;

    inputs.forEach((state, id) => {
        const { queue, volume, paused } = state;

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
        log('Mixed audio data.');
        for (let i = 0; i < mixedSamples.length; i++) {
            let sample = mixedSamples[i];
            if (sample > 32767) sample = 32767;
            if (sample < -32768) sample = -32768;
            outputBuffer.writeInt16LE(sample, i * 2);
        }
    }

    parentPort.postMessage({ type: 'mixed-chunk', data: outputBuffer });
}