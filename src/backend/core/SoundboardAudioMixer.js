const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { app } = require('electron');
const path =require('path');
const fs = require('fs');
const { Readable } = require('stream');

const FFMPEG_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'ffmpeg', 'ffmpeg.exe')
    : 'ffmpeg';

const MAX_SFX_INPUTS = 5; // Allow up to 5 simultaneous sound effects

class SoundboardAudioMixer extends EventEmitter {
    constructor(logCallback) {
        super();
        this.log = logCallback || console.log;
        this.ffmpegProcess = null;
        this.mixedStream = null;
        this.activeSounds = new Map(); // Maps soundId to { stream, process }
        this.mainTrackStream = null;
    }

    start() {
        if (this.ffmpegProcess) {
            this.log('ffmpeg process is already running.');
            return;
        }

        const inputs = [];
        // Input 0: Main track (pipe:3, because of 0,1,2 for stdio)
        inputs.push('-i', 'pipe:3');
        // Inputs 1 to MAX_SFX_INPUTS+1: Sound effects
        for (let i = 0; i < MAX_SFX_INPUTS; i++) {
            inputs.push('-i', 'pipe:' + (i + 4));
        }

        const filterInputs = [];
        for (let i = 0; i < MAX_SFX_INPUTS + 1; i++) {
            filterInputs.push(`[${i}:a]`);
        }

        const filterComplex = `${filterInputs.join('')}amix=inputs=${MAX_SFX_INPUTS + 1}:duration=longest[a]`;

        const args = [
            '-hide_banner', '-loglevel', 'error',
            ...inputs,
            '-filter_complex', filterComplex,
            '-map', '[a]',
            '-f', 'opus', '-ar', '48000', '-ac', '2',
            'pipe:1' // Output to stdout
        ];

        this.log(`Spawning ffmpeg with args: ${args.join(' ')}`);
        // We need more pipes than the default 3
        const stdioPipes = ['pipe', 'pipe', 'pipe']; // stdin, stdout, stderr
        for(let i=0; i < MAX_SFX_INPUTS + 1; i++) {
            stdioPipes.push('pipe');
        }

        this.ffmpegProcess = spawn(FFMPEG_PATH, args, { stdio: stdioPipes });
        this.mixedStream = this.ffmpegProcess.stdout;

        this.ffmpegProcess.stderr.on('data', (data) => this.log(`ffmpeg stderr: ${data}`));
        this.ffmpegProcess.on('close', (code) => {
            this.log(`ffmpeg process exited with code ${code}`);
            this.ffmpegProcess = null;
            this.mixedStream = null;
            this.emit('stop');
        });

        this.emit('start', this.mixedStream);
    }

    stop() {
        if (this.ffmpegProcess) {
            this.log('Stopping ffmpeg process.');
            this.ffmpegProcess.kill('SIGTERM');
        }
    }

    playSound(filePath) {
        if (this.activeSounds.size >= MAX_SFX_INPUTS) {
            this.log('Maximum number of sound effects already playing.');
            return null;
        }

        const soundId = `sfx_${Date.now()}`;
        const inputPipeIndex = this.findAvailablePipe();
        if (inputPipeIndex === -1) {
            this.log('No available audio pipes to play sound.');
            return null;
        }

        const fileStream = fs.createReadStream(filePath);
        const targetPipe = this.ffmpegProcess.stdio[inputPipeIndex];

        fileStream.pipe(targetPipe, { end: false }); // Don't end the pipe

        fileStream.on('end', () => {
            this.log(`Sound stream finished for: ${filePath}`);
            this.stopSound(soundId);
            this.emit('sound-finished', { filePath });
        });

        this.activeSounds.set(soundId, { stream: fileStream, pipeIndex: inputPipeIndex });
        this.log(`Playing sound ${soundId} on pipe ${inputPipeIndex}`);
        return soundId;
    }

    stopSound(soundId) {
        if (this.activeSounds.has(soundId)) {
            const { stream, pipeIndex } = this.activeSounds.get(soundId);
            this.log(`Stopping sound ${soundId} on pipe ${pipeIndex}`);
            stream.unpipe();
            stream.destroy();
            this.activeSounds.delete(soundId);
        }
    }

    findAvailablePipe() {
        const usedPipes = new Set();
        this.activeSounds.forEach(sound => usedPipes.add(sound.pipeIndex));
        for (let i = 0; i < MAX_SFX_INPUTS; i++) {
            const pipeIndex = i + 4; // SFX pipes start at index 4
            if (!usedPipes.has(pipeIndex)) {
                return pipeIndex;
            }
        }
        return -1;
    }

    setMainTrack(stream) {
        if (this.mainTrackStream) {
            this.mainTrackStream.unpipe();
        }
        this.mainTrackStream = stream;
        if (this.ffmpegProcess) {
            this.mainTrackStream.pipe(this.ffmpegProcess.stdio[3], { end: false });
        }
    }
}

module.exports = SoundboardAudioMixer;
