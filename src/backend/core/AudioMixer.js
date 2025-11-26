const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PassThrough } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

class AudioMixer {
    constructor(log, error) {
        this.log = log;
        this.error = error;
        this.mainStream = null;
        this.mainStreamStartTime = 0; // For seeking
        this.mainVolume = 1.0;
        this.soundStreams = new Map();
        this.mixedStream = new PassThrough();
        this.ffmpegCommand = null;
        this.isPlaying = false;
        this.streamIdCounter = 0;
    }

    setMainStream(stream, startTime = 0) {
        this.log(`Setting main audio stream, starting at ${startTime}s.`);
        this.mainStream = stream;
        this.mainStreamStartTime = startTime;
        this.rebuildMixer();
    }

    setMainVolume(volume) {
        if (this.mainVolume !== volume) {
            this.log(`Setting main volume to ${volume}`);
            this.mainVolume = volume;
            if (this.mainStream) {
                this.rebuildMixer();
            }
        }
    }

    addSound(soundStream) {
        const streamId = this.streamIdCounter++;
        this.log(`Adding sound stream ${streamId}...`);
        this.soundStreams.set(streamId, soundStream);
        this.rebuildMixer();
        return streamId;
    }

    removeSound(streamId) {
        if (this.soundStreams.has(streamId)) {
            this.log(`Removing sound stream ${streamId}...`);
            this.soundStreams.get(streamId).destroy();
            this.soundStreams.delete(streamId);
            this.rebuildMixer();
            return true;
        }
        return false;
    }

    rebuildMixer() {
        this.log('Rebuilding audio mixer...');
        if (this.ffmpegCommand) {
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }

        if (!this.mainStream && this.soundStreams.size === 0) {
            this.log('No streams to mix.');
            this.mixedStream = new PassThrough();
            this.isPlaying = false;
            return;
        }

        this.mixedStream = new PassThrough();
        this.ffmpegCommand = ffmpeg();

        let complexFilter = [];
        let mixInputs = [];

        if (this.mainStream) {
            this.ffmpegCommand
                .input(this.mainStream)
                .seekInput(this.mainStreamStartTime); // Apply seek time here

            complexFilter.push(`[0:a]volume=${this.mainVolume}[mainvol]`);
            mixInputs.push('[mainvol]');
        }

        let soundIndex = 1;
        this.soundStreams.forEach(stream => {
            this.ffmpegCommand.input(stream);
            mixInputs.push(`[${soundIndex++}:a]`);
        });

        const amixFilter = `amix=inputs=${mixInputs.length}:duration=longest`;
        complexFilter.push(`${mixInputs.join('')}${amixFilter}`);


        this.ffmpegCommand
            .complexFilter(complexFilter)
            .toFormat('s16le')
            .audioChannels(2)
            .audioFrequency(48000)
            .on('error', (err) => {
                this.error(`FFmpeg error: ${err.message}`);
            })
            .pipe(this.mixedStream, { end: false });

        this.isPlaying = true;
        this.log(`Mixer rebuilt with ${mixInputs.length} input(s) and main volume ${this.mainVolume}.`);
    }

    getMixedStream() {
        return this.mixedStream;
    }

    stop() {
        this.log('Stopping mixer...');
        if (this.ffmpegCommand) {
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }
        this.mainStream = null;
        this.mainStreamStartTime = 0;
        this.soundStreams.forEach(stream => stream.destroy());
        this.soundStreams.clear();
        this.mixedStream.end();
        this.mixedStream = new PassThrough();
        this.isPlaying = false;
    }
}

module.exports = AudioMixer;
