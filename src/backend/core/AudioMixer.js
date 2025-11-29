
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

class AudioMixer {
    constructor(logCallback) {
        this.log = logCallback || console.log;

        // --- Correctly set ffmpeg/ffprobe paths ---
        // We must do this inside the constructor to ensure `app` is ready.
        const { app } = require('electron');
        const ffmpegStaticPath = require('ffmpeg-static');
        const ffprobeStaticPath = require('ffprobe-static').path;

        const ffmpegExecutableName = path.basename(ffmpegStaticPath);
        const ffprobeExecutableName = path.basename(ffprobeStaticPath);

        // In packaged apps, the executables are not in the asar archive, but in the resources path.
        // electron-builder by default unpacks ffmpeg-static and ffprobe-static.
        // The path needs to point to the executable inside the unpacked directory.
        const basePath = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../../../');

        const correctFfmpegPath = app.isPackaged
            ? path.join(basePath, 'node_modules', 'ffmpeg-static', ffmpegExecutableName).replace('app.asar', 'app.asar.unpacked')
            : ffmpegStaticPath;

        const correctFfprobePath = app.isPackaged
            ? path.join(basePath, 'node_modules', 'ffprobe-static', ffprobeExecutableName).replace('app.asar', 'app.asar.unpacked')
            : ffprobeStaticPath;

        ffmpeg.setFfmpegPath(correctFfmpegPath);
        ffmpeg.setFfprobePath(correctFfprobePath);

        this.log(`ffmpeg path set to: ${correctFfmpegPath}`);
        this.log(`ffprobe path set to: ${correctFfprobePath}`);

        this.mainAudioStream = null;
        this.soundEffectStreams = new Map();
        this.outputStream = new PassThrough();
        this.ffmpegCommand = null;
        this.mainAudioEnded = false;
    }

    setMainAudio(audioStream) {
        this.log('Setting main audio stream.');
        // If there's an existing command, stop it completely before starting a new one.
        if (this.ffmpegCommand) {
            this.stop();
        }
        this.mainAudioStream = audioStream;
        this.mainAudioEnded = false;
        this.mainAudioStream.on('end', () => {
            this.log('Main audio stream ended.');
            this.mainAudioEnded = true;
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
            if (this.mainAudioEnded && this.soundEffectStreams.size === 0) {
                this.stop();
            } else {
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

        if (this.mainAudioStream && !this.mainAudioEnded) {
            this.ffmpegCommand.input(this.mainAudioStream).inputFormat('s16le').audioCodec('pcm_s16le').audioChannels(2).audioFrequency(48000);
            complexFilter.push(`[${inputCount}:a]volume=1.0[a${inputCount}]`);
            inputCount++;
        }

        this.soundEffectStreams.forEach((stream, id) => {
            this.ffmpegCommand.input(stream).inputFormat('s16le').audioCodec('pcm_s16le').audioChannels(2).audioFrequency(48000);
            complexFilter.push(`[${inputCount}:a]volume=0.8[a${inputCount}]`);
            inputCount++;
        });

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
                .pipe(this.outputStream, { end: false });
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
    }

    getOutputStream() {
        return this.outputStream;
    }
}

module.exports = AudioMixer;
