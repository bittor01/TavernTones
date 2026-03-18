// Performance and security update
const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable, PassThrough } = require('stream');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

class BackendAudioPlayer extends EventEmitter {
    constructor(logCallback, shell, musicFolder, ffmpegPath) {
        super();
        // Dependencies
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;
        this.ffmpegPath = ffmpegPath;

        // State
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;

        // Music Stack System
        this.stack = [];
        this.currentIndex = -1;
        this.loopMode = 1; // 0: None, 1: Loop All, 2: Loop 1
        this.shuffleMode = false;
        this.playedIndices = []; // For shuffle history

        this.currentTime = 0; // Current playback time in seconds
        this.duration = 0; // Total duration of current track in seconds
        this.timer = null;

        // Caching
        this.cachedAudio = new Map(); // filePath -> Buffer
        this.isCaching = false;
        this.MAX_CACHE_SIZE = 126720000; // ~11 minutes of 48kHz 16-bit stereo PCM

        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        this.activeSfxCount = 0;

        // Audio Pipelines
        this.mixer = new ThreadedAudioMixer();
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            this.log(`Mixer Error: ${err.message}`);
        });

        this.mixedResource = createAudioResource(this.mixer, {
            inputType: StreamType.Raw,
            inlineVolume: false
        });

        this.player = createAudioPlayer();
        this.connection = null;

        this.player.play(this.mixedResource);
        this.setupPlayerEvents();
        this._emitStatusUpdate();

        this.activeStreams = new Map(); // id -> { process, stream }
    }

    _emitStatusUpdate() {
        const getRelativePath = (filePath) => {
            if (!filePath || !this.musicFolder) return filePath;
            try {
                return path.relative(this.musicFolder, filePath);
            } catch (e) {
                return filePath;
            }
        };

        const status = {
            isPlaying: this.isPlaying,
            isCaching: this.isCaching,
            stack: this.stack.map(p => ({
                path: p,
                name: path.basename(p),
                relativePath: getRelativePath(p)
            })),
            currentIndex: this.currentIndex,
            loopMode: this.loopMode,
            shuffleMode: this.shuffleMode,
            playerStatus: this.playerStatus,
            currentTime: this.currentTime,
            duration: this.duration
        };
        this.emit('status-change', status);
    }

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, () => {
            this.log('Mixer player went IDLE.');
        });

        this.player.on('error', error => {
            this.log(`Error in audio player (Mixer): ${error.message}`);
        });
    }

    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        this.connection.subscribe(this.player);
    }

    setVolume(volume) {
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            if (this.activeStreams.has('music')) {
                const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
                this.mixer.setInputVolume('music', currentVolume);
            }
        }
    }

    setLoopMode(mode) {
        this.loopMode = mode; // 0, 1, 2
        this.log(`Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    }

    setShuffle(enabled) {
        this.shuffleMode = enabled;
        this.playedIndices = [];
        this.log(`Shuffle mode: ${enabled}`);
        this._emitStatusUpdate();
    }

    async addToStack(filePaths) {
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        for (let filePath of paths) {
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        filePath = shortcut.target;
                    }
                } catch (e) {
                    this.log(`Failed to resolve shortcut: ${filePath}`);
                }
            }
            if (!this.stack.includes(filePath)) {
                this.stack.push(filePath);
            }
        }
        this._emitStatusUpdate();
    }

    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            const removedPath = this.stack.splice(index, 1)[0];
            this.cachedAudio.delete(removedPath);
            if (this.currentIndex === index) {
                this._stopMusicStream();
                this.currentIndex = -1;
                this.isPlaying = false;
            } else if (this.currentIndex > index) {
                this.currentIndex--;
            }
            this._emitStatusUpdate();
        }
    }

    clearStack() {
        this._stopMusicStream();
        this.stack = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.cachedAudio.clear();
        this._emitStatusUpdate();
    }

    async _play(startTime = 0) {
        if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this.currentTime = 0;
            this.duration = 0;
            this._stopTimer();
            this._emitStatusUpdate();
            return;
        }

        const filePath = this.stack[this.currentIndex];
        this.log(`Playing: ${filePath} from ${startTime}s`);
        this.lastPlayStartTime = Date.now() - (startTime * 1000);
        this.currentTime = startTime;

        this._stopMusicStream();
        this._stopTimer();

        try {
            // Get duration if not already known
            if (startTime === 0) {
                this.duration = await this._getDuration(filePath);
            }

            const cachedBuffer = this.cachedAudio.get(filePath);

            if (cachedBuffer && startTime === 0) {
                this.log(`Using cached buffer for: ${filePath}`);
                const stream = Readable.from(cachedBuffer);

                stream.once('end', () => {
                    const currentMusic = this.activeStreams.get('music');
                    if (currentMusic && currentMusic.stream === stream) {
                        this.activeStreams.delete('music');
                        this.mixer.removeInput('music');
                        this._handleMusicFinish();
                    }
                });

                this.mixer.addInput(stream, 'music');
                this.activeStreams.set('music', { stream });
                this._startTimer();
            } else {
                // Stream using FFmpeg and cache in parallel if possible
                this.log(`Starting FFmpeg stream for: ${filePath} at offset ${startTime}`);
                const ffmpegProcess = this._createFfmpegStream(filePath, startTime);
                const ffmpegOutput = ffmpegProcess.stdout;

                const mixerStream = new PassThrough();
                ffmpegOutput.pipe(mixerStream);

                // Caching logic
                let pcmBuffer = Buffer.alloc(0);
                let tooBig = false;
                this.isCaching = true;
                this._emitStatusUpdate();

                ffmpegOutput.on('data', (chunk) => {
                    if (!tooBig) {
                        if (pcmBuffer.length + chunk.length <= this.MAX_CACHE_SIZE) {
                            pcmBuffer = Buffer.concat([pcmBuffer, chunk]);
                        } else {
                            tooBig = true;
                            this.log(`File too large for cache: ${filePath}`);
                            this.isCaching = false;
                            this._emitStatusUpdate();
                        }
                    }
                });

                mixerStream.once('end', () => {
                    const currentMusic = this.activeStreams.get('music');
                    if (currentMusic && currentMusic.stream === mixerStream) {
                        this.activeStreams.delete('music');
                        this.mixer.removeInput('music');

                        if (!tooBig && pcmBuffer.length > 0 && startTime === 0) {
                            this.cachedAudio.set(filePath, pcmBuffer);
                            this.log(`Cached ${filePath} (${(pcmBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
                        }
                        this.isCaching = false;
                        this._stopTimer();
                        this._emitStatusUpdate();
                        this._handleMusicFinish();
                    }
                });

                this.mixer.addInput(mixerStream, 'music');
                this.activeStreams.set('music', { process: ffmpegProcess, stream: mixerStream });
                this._startTimer();
            }

            this.isPlaying = true;
            this.playerStatus = AudioPlayerStatus.Playing;

            // Set volume immediately
            const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
            this.mixer.setInputVolume('music', currentVolume);

            this._emitStatusUpdate();

        } catch (error) {
            this.log(`Error starting playback for ${filePath}: ${error.message}`);
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this.isCaching = false;
            this._emitStatusUpdate();
        }
    }

    _createFfmpegStream(filePath, startTime = 0) {
        if (!this.ffmpegPath) throw new Error("FFmpeg path not configured.");
        const args = [];
        if (startTime > 0) {
            args.push('-ss', startTime.toString());
        }
        args.push('-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
        return spawn(this.ffmpegPath, args);
    }

    _getDuration(filePath) {
        return new Promise((resolve) => {
            if (!this.ffmpegPath) {
                this.log("[Duration] FFmpeg path not set.");
                return resolve(0);
            }

            // Resolve shortcut if needed
            let targetPath = filePath;
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        targetPath = shortcut.target;
                    }
                } catch (e) {
                    this.log(`[Duration] Failed to resolve shortcut: ${filePath}`);
                }
            }

            // Construct ffprobe path reliably
            const ffprobeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
            const ffprobePath = path.join(path.dirname(this.ffmpegPath), ffprobeName);

            if (!fs.existsSync(ffprobePath)) {
                this.log(`[Duration] ffprobe not found at: ${ffprobePath}`);
                return resolve(0);
            }

            const { exec } = require('child_process');
            // Use double quotes for path to handle spaces
            const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetPath}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    this.log(`[Duration] Error executing ffprobe: ${error.message}`);
                    resolve(0);
                    return;
                }
                const duration = parseFloat(stdout.trim());
                if (isNaN(duration)) {
                    this.log(`[Duration] Invalid output for ${targetPath}: "${stdout.trim()}"`);
                    resolve(0);
                } else {
                    resolve(duration);
                }
            });
        });
    }

    _startTimer() {
        this._stopTimer();
        this.timer = setInterval(() => {
            if (this.isPlaying) {
                this.currentTime = (Date.now() - (this.lastPlayStartTime || 0)) / 1000;
                if (this.duration > 0 && this.currentTime > this.duration) {
                    this.currentTime = this.duration;
                }
                this._emitStatusUpdate();
            }
        }, 1000);
    }

    _stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const entry = this.activeStreams.get('music');
            this.mixer.removeInput('music');
            if (entry.process) entry.process.kill();
            this.activeStreams.delete('music');
        }
    }

    _handleMusicFinish() {
        const duration = Date.now() - (this.lastPlayStartTime || 0);
        if (duration < 1000) {
            this.log("Track finished too quickly, stopping to prevent loop thrashing.");
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
            return;
        }

        if (this.loopMode === 2) { // Loop 1
            this.log("Looping single track.");
            if (!this.isDestroyed) {
                setTimeout(() => this._play(), 100);
            }
        } else {
            this.next();
        }
    }

    next() {
        if (this.stack.length === 0) return;

        if (this.shuffleMode) {
            this.playedIndices.push(this.currentIndex);
            if (this.playedIndices.length >= this.stack.length) {
                this.playedIndices = [];
            }
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * this.stack.length);
            } while (this.playedIndices.includes(nextIndex) && this.stack.length > 1);
            this.currentIndex = nextIndex;
        } else {
            this.currentIndex++;
            if (this.currentIndex >= this.stack.length) {
                if (this.loopMode === 1) { // Loop All
                    this.currentIndex = 0;
                } else {
                    this.currentIndex = this.stack.length - 1;
                    this.isPlaying = false;
                    this.playerStatus = AudioPlayerStatus.Idle;
                    this._stopMusicStream();
                    this._emitStatusUpdate();
                    return;
                }
            }
        }
        this._play();
    }

    jumpTo(index) {
        if (index >= 0 && index < this.stack.length) {
            this.currentIndex = index;
            this._play();
        }
    }

    prev() {
        if (this.stack.length === 0) return;
        this.currentIndex--;
        if (this.currentIndex < 0) {
            this.currentIndex = this.loopMode === 1 ? this.stack.length - 1 : 0;
        }
        this._play();
    }

    play() {
        if (this.playerStatus === AudioPlayerStatus.Paused && this.currentIndex >= 0) {
            this._play(this.currentTime);
            return;
        }
        if (this.currentIndex < 0 && this.stack.length > 0) {
            this.currentIndex = 0;
        }
        if (this.currentIndex >= 0) {
            this._play();
        }
    }

    pause() {
        this._stopMusicStream();
        this._stopTimer();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    }

    stop() {
        this._stopMusicStream();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        this._emitStatusUpdate();
    }

    // --- Soundboard API ---
    playSound(filePath, slotId) {
        this.log(`Soundboard: Playing ${filePath} on slot ${slotId}`);
        const id = `sfx_${slotId}`;
        this.stopSound(slotId);

        try {
            const ffmpegProcess = this._createFfmpegStream(filePath);
            const stream = ffmpegProcess.stdout;

            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.mixer.setInputVolume('music', this.playbackVolume * this.duckingVolume);
            }
            this.activeSfxCount++;

            stream.once('close', () => {
                if (this.activeStreams.has(id)) {
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    this.emit('sound-finished', slotId);
                    this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                    if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                        this.mixer.setInputVolume('music', this.playbackVolume);
                    }
                }
            });

            this.mixer.addInput(stream, id, this.soundboardVolume);
            this.activeStreams.set(id, { process: ffmpegProcess, stream });
        } catch (error) {
            this.log(`Error playing SFX ${filePath}: ${error.message}`);
        }
    }

    stopSound(slotId) {
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            const { process } = this.activeStreams.get(id);
            this.mixer.removeInput(id);
            if (process) process.kill();
            this.activeStreams.delete(id);
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.mixer.setInputVolume('music', this.playbackVolume);
            }
        }
    }

    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        this.activeStreams.forEach((value, id) => {
            if (id.startsWith('sfx_')) this.mixer.setInputVolume(id, volume);
        });
    }

    getMusicFiles() {
        if (!this.musicFolder || !fs.existsSync(this.musicFolder)) return [];

        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    getAllFiles(fullPath, results);
                } else {
                    const ext = path.extname(fullPath).toLowerCase();
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) {
                        results.push(fullPath);
                    }
                }
            });
            return results;
        };

        return getAllFiles(this.musicFolder);
    }

    getPreviewFilePath() {
        if (this.currentIndex >= 0 && this.currentIndex < this.stack.length) {
            return this.stack[this.currentIndex];
        } else if (this.stack.length > 0) {
            return this.stack[0];
        }
        return null;
    }

    destroy() {
        this.isDestroyed = true;
        if (this.player) this.player.stop();
        this.activeStreams.forEach(({ process }) => {
            try { if (process) process.kill(); } catch (e) {}
        });
        this.activeStreams.clear();
        if (this.mixer) this.mixer.destroy();
    }
}

module.exports = BackendAudioPlayer;
