const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

class AudioMixer {
    constructor(logCallback) {
        const ffmpegPath = require('ffmpeg-static');
        ffmpeg.setFfmpegPath(ffmpegPath);
        this.log = logCallback || console.log;
        this.mainAudioStream = null;
        this.soundEffectStreams = new Map();
        this.outputStream = new PassThrough();
        this.ffmpegCommand = null;
        this.mainAudioEnded = false;
    }

    setMainAudio(audioStream) {
        this.log('Setting main audio stream.');
        this.mainAudioStream = audioStream;
        this.mainAudioEnded = false;
        this.mainAudioStream.on('end', () => {
            this.log('Main audio stream ended.');
            this.mainAudioEnded = true;
            // If there are no more sound effects, we can stop the command.
            if (this.soundEffectStreams.size === 0) {
                this.stop();
            }
        });
        this.start();
    }

    playSound(soundId, soundStream) {
        this.log(`Adding sound effect with ID: ${soundId}`);
        this.soundEffectStreams.set(soundId, soundStream);
        soundStream.on('end', () => {
            this.log(`Sound effect ${soundId} finished.`);
            this.soundEffectStreams.delete(soundId);
            // If the main audio has also ended and there are no more effects, stop.
            if (this.mainAudioEnded && this.soundEffectStreams.size === 0) {
                this.stop();
            } else {
                // Otherwise, just restart the ffmpeg process without this sound effect.
                this.start();
            }
        });
        this.start();
    }

    start() {
        if (this.ffmpegCommand) {
            this.log('Restarting ffmpeg process for new mix.');
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }

        if (!this.mainAudioStream && this.soundEffectStreams.size === 0) {
            this.log('No audio sources, not starting ffmpeg.');
            return;
        }

        this.log('Starting ffmpeg mixing process...');
        this.ffmpegCommand = ffmpeg();

        let complexFilter = [];
        let inputCount = 0;

        // Add main audio stream if it exists
        if (this.mainAudioStream && !this.mainAudioEnded) {
            this.ffmpegCommand.input(this.mainAudioStream).inputFormat('s16le').audioCodec('pcm_s16le').audioChannels(2).audioFrequency(48000);
            complexFilter.push(`[${inputCount}:a]volume=1.0[a${inputCount}]`);
            inputCount++;
        }

        // Add all active sound effect streams
        this.soundEffectStreams.forEach((stream, id) => {
            this.ffmpegCommand.input(stream).inputFormat('s16le').audioCodec('pcm_s16le').audioChannels(2).audioFrequency(48000);
            complexFilter.push(`[${inputCount}:a]volume=0.8[a${inputCount}]`); // Example: play effects at 80% volume
            inputCount++;
        });

        // If there are inputs, create the amix filter
        if (inputCount > 0) {
            let filterString = '';
            for (let i = 0; i < inputCount; i++) {
                filterString += `[a${i}]`;
            }
            filterString += `amix=inputs=${inputCount}:duration=longest[aout]`;
            complexFilter.push(filterString);

            this.ffmpegCommand
                .complexFilter(complexFilter, 'aout')
                .toFormat('s16le')
                .audioCodec('pcm_s16le')
                .audioChannels(2)
                .audioFrequency(48000)
                .on('start', (commandLine) => {
                    this.log('ffmpeg process started: ' + commandLine);
                })
                .on('error', (err) => {
                    this.log('An error occurred with ffmpeg: ' + err.message);
                })
                .on('end', () => {
                    this.log('ffmpeg process finished.');
                })
                .pipe(this.outputStream, { end: false }); // Don't end the output stream automatically
        }
    }

    stop() {
        this.log('Stopping ffmpeg process.');
        if (this.ffmpegCommand) {
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }
        this.mainAudioStream = null;
        this.soundEffectStreams.clear();
        this.mainAudioEnded = false;
        // Do not end the output stream, it can be reused.
    }

    getOutputStream() {
        return this.outputStream;
    }
}

module.exports = AudioMixer;
