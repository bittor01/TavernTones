
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');

class AudioMixer {
    constructor(logCallback) {
        this.log = logCallback || console.log;

        this.mainAudioPath = null;
        this.soundEffectPaths = new Map(); // Store paths and their start times
        this.outputStream = new PassThrough();
        this.ffmpegCommand = null;
        this.isStoppedIntentionally = false;
        this.mainAudioLoop = false;
    }

    setMainAudio(filePath, loop = false) {
        this.log(`Setting main audio to: ${filePath}`);
        this.mainAudioPath = filePath;
        this.mainAudioLoop = loop;
        this._startOrRestartMixer();
    }

    playSound(soundId, filePath) {
        this.log(`Adding sound effect with ID ${soundId}: ${filePath}`);
        this.soundEffectPaths.set(soundId, filePath);
        this._startOrRestartMixer();
    }

    _startOrRestartMixer() {
        if (this.ffmpegCommand) {
            this.log('Restarting ffmpeg process for new mix.');
            this.isStoppedIntentionally = true;
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }

        if (!this.mainAudioPath && this.soundEffectPaths.size === 0) {
            this.log('No audio sources, mixer remains idle.');
            return;
        }

        this.isStoppedIntentionally = false;
        this.log('Starting ffmpeg mixing process...');
        this.ffmpegCommand = ffmpeg();

        let complexFilter = [];
        const inputs = [];

        // --- Main Audio Input ---
        if (this.mainAudioPath) {
            this.ffmpegCommand.input(this.mainAudioPath);
            if(this.mainAudioLoop){
                this.ffmpegCommand.inputOptions('-stream_loop', '-1');
            }
            inputs.push({ type: 'main', index: inputs.length, volume: 1.0 });
        }

        // --- Sound Effect Inputs ---
        this.soundEffectPaths.forEach((filePath, soundId) => {
            this.ffmpegCommand.input(filePath);
            inputs.push({ type: 'sfx', index: inputs.length, volume: 0.8, id: soundId });
        });

        // --- Build Complex Filter ---
        const inputLabels = inputs.map(i => `[${i.index}:a]`);
        const volumeFilters = inputs.map(i => `[${i.index}:a]volume=${i.volume}[vol${i.index}]`);
        complexFilter.push(...volumeFilters);

        const amixInputs = inputs.map(i => `[vol${i.index}]`).join('');
        // 'longest' duration ensures the music continues if a short sound effect is added.
        // 'shortest' is not what we want. The main track dictates the length.
        const duration = this.mainAudioPath ? 'longest' : 'shortest';
        complexFilter.push(`${amixInputs}amix=inputs=${inputs.length}:duration=${duration}[aout]`);

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
                // If it's not an intentional stop, we need to figure out which sound effect failed.
                // For now, we'll log a generic error. A more robust solution might try to identify the failing input.
                if (!this.isStoppedIntentionally) {
                    this.log('An error occurred with ffmpeg: ' + err.message);
                } else {
                    this.log('ffmpeg process was intentionally killed.');
                }
            })
            .on('end', () => {
                this.log('ffmpeg process finished. This may indicate the end of all non-looping tracks.');
                // Clear any sound effects that have finished
                this.soundEffectPaths.clear();
                // If the main audio wasn't looping, it's also done.
                if (!this.mainAudioLoop) {
                    this.mainAudioPath = null;
                }
                // Don't automatically restart. The player will decide when to start a new track.
            })
            .pipe(this.outputStream, { end: false });
    }

    stop() {
        this.log('Stopping ffmpeg process completely.');
        if (this.ffmpegCommand) {
            this.isStoppedIntentionally = true;
            this.ffmpegCommand.kill('SIGKILL');
            this.ffmpegCommand = null;
        }
        this.mainAudioPath = null;
        this.soundEffectPaths.clear();
    }

    getOutputStream() {
        return this.outputStream;
    }
}

module.exports = AudioMixer;
