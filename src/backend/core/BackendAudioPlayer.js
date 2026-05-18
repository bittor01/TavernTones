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
    constructor(logCallback, shell, musicFolder, ffmpegBinFolder) {
        super();
        // Dependencies
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;
        this.ffmpegBinFolder = ffmpegBinFolder;

        // State
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;
        this.playLock = false;

        // Music Stack System
        this.stack = [];
        this.currentIndex = -1;
        this.loopMode = 1; // 0: None, 1: Loop All, 2: Loop 1
        this.shuffleMode = false;
        this.playedIndices = []; // For shuffle history

        this.currentTime = 0; // Current playback time in seconds
        this.duration = 0; // Total duration of current track in seconds
        this.playCount = 0; // To prevent stale duration updates
        this.timer = null;
        this.cacheInterval = null;
        this.consecutiveErrors = 0;
        this.recoveryAttempts = [];

        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        this.activeSfxCount = 0;

        // Audio Pipelines
        this.mixer = new ThreadedAudioMixer();
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            this.log(`[AudioPlayer] Mixer Error: ${err.message}`);
        });

        this.mixerProxy = null;
        this.mixedResource = null;
        this.player = null;
        this.connection = null;

        this._ensureDiscordPipeline();
        this._emitStatusUpdate();

        this.activeStreams = new Map(); // id -> { process, stream }
    }

    _ensureDiscordPipeline() {
        try {
            if (!this.player) {
                this.log('[AudioPlayer] Creating Discord AudioPlayer.');
                this.player = createAudioPlayer();
                this.setupPlayerEvents();
            }

            if (this.connection) {
                this.connection.subscribe(this.player);
            }

            if (!this.mixerProxy || this.mixerProxy.destroyed) {
                this.log('[AudioPlayer] Establishing mixer proxy.');
                if (this.mixerProxy) {
                    try { this.mixer.unpipe(this.mixerProxy); } catch (e) {}
                    try { this.mixerProxy.destroy(); } catch (e) {}
                }
                this.mixerProxy = new PassThrough();
                this.mixer.pipe(this.mixerProxy);
                this.mixedResource = null;
            }

            if (!this.mixedResource || this.mixedResource.ended || this.player.state.status === AudioPlayerStatus.Idle) {
                const now = Date.now();
                this.recoveryAttempts = this.recoveryAttempts.filter(t => now - t < 10000);
                this.recoveryAttempts.push(now);

                if (this.recoveryAttempts.length > 8) {
                    this.log('[AudioPlayer] CRITICAL: Rapid recovery loop detected. Stopping playback.');
                    this.stop();
                    return;
                }

                this.log('[AudioPlayer] Establishing audio pipeline resource.');
                this.mixedResource = createAudioResource(this.mixerProxy, {
                    inputType: StreamType.Raw,
                    inlineVolume: false
                });
                this.player.play(this.mixedResource);
            }
        } catch (e) {
            this.log(`[AudioPlayer] Error ensuring pipeline: ${e.message}`);
        }
    }

    _emitStatusUpdate(isTimeUpdate = false) {
        const status = {
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            playerStatus: this.playerStatus,
            currentTime: this.currentTime,
            duration: this.duration,
            isTimeUpdate: isTimeUpdate
        };

        // Only include heavy data if it's not a frequent time update
        if (!isTimeUpdate) {
            const getRelativePath = (filePath) => {
                if (!filePath || !this.musicFolder) return filePath;
                try {
                    return path.relative(this.musicFolder, filePath);
                } catch (e) {
                    return filePath;
                }
            };

            status.stack = this.stack.map(p => ({
                path: p,
                name: path.basename(p),
                relativePath: getRelativePath(p)
            }));
            status.loopMode = this.loopMode;
            status.shuffleMode = this.shuffleMode;
        }

        this.emit('status-change', status);
    }

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, (oldState) => {
            this.log('[AudioPlayer] Mixer player went IDLE.');
            if (this.isPlaying) {
                if (oldState.resource && oldState.resource !== this.mixedResource) {
                    this.log('[AudioPlayer] Idle event was for a stale resource. Ignoring.');
                    return;
                }
                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    this.log('[AudioPlayer] Mixer unexpectedly idle, ensuring pipeline.');
                    this._ensureDiscordPipeline();
                }
            }
        });

        this.player.on('error', error => {
            this.log(`[AudioPlayer] Error in audio player (Mixer): ${error.message}`);
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
        this.log(`[AudioPlayer] Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    }

    setShuffle(enabled) {
        this.shuffleMode = enabled;
        this.playedIndices = [];
        this.log(`[AudioPlayer] Shuffle mode: ${enabled}`);
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
                    this.log(`[AudioPlayer] Failed to resolve shortcut: ${filePath}`);
                }
            }
            if (!this.stack.includes(filePath)) {
                this.stack.push(filePath);
            }
        }
        if (this.currentIndex === -1 && this.stack.length > 0) {
            this.currentIndex = 0;
        }
        this._emitStatusUpdate();
    }

    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            const removedPath = this.stack.splice(index, 1)[0];
            if (this.currentIndex === index) {
                this._stopMusicStream();
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                    if (this.isPlaying) this._play();
                } else {
                    this.stop();
                }
            } else if (this.currentIndex > index) {
                this.currentIndex--;
            }
            this._emitStatusUpdate();
        }
    }

    clearStack() {
        if (this.mixer) this.mixer.reset();
        this._stopMusicStream();
        this._stopTimer();
        this.stack = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.consecutiveErrors = 0;
        this._emitStatusUpdate();
    }

    async _play(startTime = 0) {
        if (this.isDestroyed) return;
        if (this.playLock) return;
        this.playLock = true;
        this.playCount++;
        const currentPlayId = this.playCount;

        try {
            if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                } else {
                    this.stop();
                    return;
                }
            }

            const filePath = this.stack[this.currentIndex];
            this.log(`[AudioPlayer] Playing: ${path.basename(filePath)} from ${startTime}s`);

            this._stopMusicStream();
            this._stopTimer();

            // Immediate feedback for UI
            this.currentTime = startTime;
            this.isPlaying = true; // Set playing early so recovery logic can catch stalls during startup

            if (startTime === 0) {
                this.duration = 0;
                this._ensureDiscordPipeline();
                if (this.mixer) this.mixer.reset();
            }
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

            // Start duration fetch in background
            if (startTime === 0) {
                this._getDuration(filePath).then(duration => {
                    if (this.isPlaying && this.playCount === currentPlayId) {
                        this.duration = duration;
                        this._emitStatusUpdate();
                    }
                }).catch(err => this.log(`[AudioPlayer] Error fetching duration: ${err.message}`));
            }

            this.lastPlayStartTime = Date.now() - (startTime * 1000);

            this.log(`[AudioPlayer] Starting FFmpeg stream for: ${path.basename(filePath)} at offset ${startTime}`);
            const ffmpegProcess = this._createFfmpegStream(filePath, startTime);

            ffmpegProcess.on('error', (err) => {
                this.log(`[AudioPlayer] FFmpeg spawn error: ${err.message}`);
                this._handlePlaybackError(filePath);
            });

            ffmpegProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
                    this.log(`[AudioPlayer] FFmpeg Error: ${msg.trim()}`);
                }
            });

            const ffmpegOutput = ffmpegProcess.stdout;
            const mixerStream = new PassThrough();
            ffmpegOutput.pipe(mixerStream);

            mixerStream.once('end', () => {
                const currentMusic = this.activeStreams.get('music');
                if (currentMusic && currentMusic.stream === mixerStream) {
                    this.activeStreams.delete('music');
                    this.mixer.removeInput('music');

                    this._stopTimer();
                    this._emitStatusUpdate();
                    this._handleMusicFinish();
                }
            });

            this.mixer.addInput(mixerStream, 'music');
            this.activeStreams.set('music', { process: ffmpegProcess, stream: mixerStream });
            this._startTimer();
            this.consecutiveErrors = 0;
            this.recoveryAttempts = [];

            const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
            this.mixer.setInputVolume('music', currentVolume);

        } catch (error) {
            this.log(`[AudioPlayer] Error in _play: ${error.message}`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
        } finally {
            this.playLock = false;
        }
    }

    _handlePlaybackError(filePath) {
        this.consecutiveErrors++;
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        this._stopTimer();
        this._emitStatusUpdate();

        // Retry limit reached
        if (this.consecutiveErrors > 10) {
            this.log("[AudioPlayer] CRITICAL: Too many consecutive errors, stopping.");
            this.stop();
            return;
        }

        // If we've tried this track multiple times, move on even if looping single
        if (this.consecutiveErrors % 3 === 0) {
            this.log("[AudioPlayer] Persistent error on current track, skipping.");
            setTimeout(() => this.next(false), 1000); // skip like a manual skip
        } else {
            this.log("[AudioPlayer] Playback error, retrying/skipping...");
            setTimeout(() => this.next(true), 1000);
        }
    }

    _getFfmpegPath() {
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                return this.ffmpegBinFolder;
            }
            const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
            const fullPath = path.join(this.ffmpegBinFolder, exeName);
            if (fs.existsSync(fullPath)) return fullPath;
        } catch (e) {}
        return 'ffmpeg';
    }

    _getFfprobePath() {
        if (!this.ffmpegBinFolder) return 'ffprobe';
        try {
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                const dir = path.dirname(this.ffmpegBinFolder);
                const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
                const siblingPath = path.join(dir, exeName);
                if (fs.existsSync(siblingPath)) return siblingPath;
            } else {
                const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
                const fullPath = path.join(this.ffmpegBinFolder, exeName);
                if (fs.existsSync(fullPath)) return fullPath;
            }
        } catch (e) {}
        return 'ffprobe';
    }

    _createFfmpegStream(filePath, startTime = 0) {
        const ffmpegPath = this._getFfmpegPath();
        const args = [];
        if (startTime > 0) {
            args.push('-ss', startTime.toString());
        }
        // Keep -re to prevent FFmpeg from overwhelming the main thread/IPC with too much data too fast
        args.push('-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
        return spawn(ffmpegPath, args);
    }

    _getDuration(filePath) {
        return new Promise((resolve, reject) => {
            let targetPath = filePath;
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) targetPath = shortcut.target;
                } catch (e) {}
            }

            const ffprobePath = this._getFfprobePath();
            const { exec } = require('child_process');
            const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetPath}"`;

            exec(cmd, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const duration = parseFloat(stdout.trim());
                resolve(isNaN(duration) ? 0 : duration);
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
                this._emitStatusUpdate(true);
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
            if (this.mixer) this.mixer.removeInput('music');
            if (entry.process) {
                try {
                    entry.process.stdout.unpipe();
                    entry.process.kill('SIGKILL');
                } catch (e) {}
            }
            if (entry.stream && entry.stream.end) {
                entry.stream.end();
            }
            this.activeStreams.delete('music');
        }
    }

    _handleMusicFinish() {
        const elapsed = Date.now() - (this.lastPlayStartTime || 0);
        this.log(`[AudioPlayer] _handleMusicFinish: elapsed=${elapsed}ms, duration=${this.duration}s, loopMode=${this.loopMode}`);

        // Avoid stopping on very short tracks unless it's a thrash scenario
        // Increased threshold slightly and restored check for duration === 0 (unknown duration)
        if (elapsed < 1000 && (this.duration === 0 || this.duration > 2)) {
            this.log(`[AudioPlayer] Track finished too quickly (${elapsed}ms), considering it an error.`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
            return;
        }

        const playWithDelay = () => {
            // Add a small delay for rapid loops to prevent crashing the mixer/discord client
            if (elapsed < 500) {
                this.log("[AudioPlayer] Rapid loop detected, delaying restart by 200ms.");
                setTimeout(() => this._play(0), 200);
            } else {
                this._play(0);
            }
        };

        if (this.loopMode === 2) { // Loop 1
            this.log("[AudioPlayer] Loop 1: Restarting current track.");
            // In Loop 1, we don't move the track, just replay it.
            playWithDelay();
        } else if (this.loopMode === 1) { // Loop All
            this.log("[AudioPlayer] Loop All: Rolling current track to bottom.");
            const finished = this.stack.shift();
            if (finished) this.stack.push(finished);
            this.currentIndex = 0;
            playWithDelay();
        } else { // None
            this.log("[AudioPlayer] Loop None: Rolling current track off.");
            this.stack.shift();
            if (this.stack.length > 0) {
                this.currentIndex = 0;
                this._play(0);
            } else {
                this.log("[AudioPlayer] Playlist finished and loop is OFF.");
                this.stop();
            }
        }
    }

    next(isError = false, forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] next(isError=${isError}, forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}, shuffle=${this.shuffleMode}`);
        if (this.stack.length === 0) return;

        if (this.shuffleMode) {
            this.playedIndices.push(this.currentIndex);
            if (this.playedIndices.length >= this.stack.length) this.playedIndices = [];
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * this.stack.length);
            } while (this.playedIndices.includes(nextIndex) && this.stack.length > 1);
            this.currentIndex = nextIndex;
            this.log(`[AudioPlayer] Shuffle chose index ${this.currentIndex}`);
        } else {
            // In Loop Single mode, automatic transition (from error) should probably stay on track
            // but manual skip should still go to next.
            if (this.loopMode === 2 && isError) {
                this.log("[AudioPlayer] next(): Loop Single + Error, restarting same track.");
                this.currentIndex = 0;
            } else if (this.loopMode === 1 || this.loopMode === 2) {
                this.log("[AudioPlayer] next(): Moving current track to bottom.");
                const current = this.stack.shift();
                if (current) this.stack.push(current);
                this.currentIndex = 0;
            } else {
                this.log("[AudioPlayer] next(): Rolling current track off.");
                this.stack.shift();
                if (this.stack.length === 0) {
                    this.stop();
                    return;
                }
                this.currentIndex = 0;
            }
        }
        if (wasPlaying || isError) {
            this._play();
        } else {
            this.currentTime = 0;
            this._emitStatusUpdate();
        }
    }

    jumpTo(index, forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] jumpTo(${index}, forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}`);
        if (index >= 0 && index < this.stack.length) {
            // In the roll-off system, jumping to index X means bumping everything BEFORE X to the bottom
            const preceding = this.stack.splice(0, index);
            if (this.loopMode === 1 || this.loopMode === 2) {
                this.log(`[AudioPlayer] jumpTo: Moving ${preceding.length} preceding tracks to bottom.`);
                this.stack.push(...preceding);
            } else {
                this.log(`[AudioPlayer] jumpTo: Discarding ${preceding.length} preceding tracks.`);
            }
            this.currentIndex = 0;
            this.playLock = false; // Prevent stuck states

            if (wasPlaying) {
                this._play();
            } else {
                this.currentTime = 0;
                this._emitStatusUpdate();
            }
        }
    }

    prev(forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] prev(forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}`);
        if (this.stack.length === 0) return;
        // In roll-off system, prev means taking the LAST track and putting it at the TOP
        if (this.loopMode === 1 || this.loopMode === 2) {
            this.log("[AudioPlayer] prev(): Moving last track to top.");
            const last = this.stack.pop();
            if (last) this.stack.unshift(last);
            this.currentIndex = 0;
        } else {
            this.log("[AudioPlayer] prev(): Restarting current track (no loop).");
            this.currentIndex = 0; // Restart if no loop
        }

        if (wasPlaying) {
            this._play();
        } else {
            this.currentTime = 0;
            this._emitStatusUpdate();
        }
    }

    play() {
        if (this.isPlaying) return;
        this.playLock = false; // ensure play works even if previously locked
        if (this.playerStatus === AudioPlayerStatus.Paused && this.currentIndex >= 0) {
            this._play(this.currentTime);
            return;
        }
        if (this.currentIndex < 0 && this.stack.length > 0) this.currentIndex = 0;
        if (this.currentIndex >= 0) this._play();
    }

    seek(time) {
        if (this.currentIndex >= 0 && this.stack.length > 0) {
            this.log(`[AudioPlayer] Seeking to ${time}s`);
            this._play(time);
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
        this._stopTimer();
        this.isPlaying = false;
        this.currentIndex = -1;
        this.currentTime = 0;
        this.duration = 0;
        this.consecutiveErrors = 0;
        this.recoveryAttempts = [];
        this.playerStatus = AudioPlayerStatus.Idle;
        this._emitStatusUpdate();
    }

    // --- Soundboard API ---
    playSound(filePath, slotId) {
        this.log(`[AudioPlayer] Soundboard: Playing slot ${slotId}`);
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
            this.log(`[AudioPlayer] SFX Error: ${error.message}`);
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
