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
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;
        this.ffmpegBinFolder = ffmpegBinFolder;

        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;
        this.playLock = false;

        this.stack = [];
        this.currentIndex = -1;
        this.loopMode = 1; // 0: None, 1: Loop All, 2: Loop 1
        this.shuffleMode = false;
        this.playedIndices = [];

        this.currentTime = 0;
        this.duration = 0;
        this.timer = null;
        this.consecutiveErrors = 0;

        this.cachedAudio = new Map();
        this.isCaching = false;
        this.MAX_CACHE_SIZE = 126720000;

        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        this.activeSfxCount = 0;

        this.mixer = new ThreadedAudioMixer();
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            this.log(`[AudioPlayer] Mixer Error: ${err.message}`);
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

        this.activeStreams = new Map();
    }

    _emitStatusUpdate() {
        const getRelativePath = (filePath) => {
            if (!filePath || !this.musicFolder) return filePath;
            try { return path.relative(this.musicFolder, filePath); } catch (e) { return filePath; }
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
            this.log('[AudioPlayer] Mixer player went IDLE.');
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
        this.loopMode = mode;
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
                    if (shortcut.target && fs.existsSync(shortcut.target)) filePath = shortcut.target;
                } catch (e) {}
            }
            if (!this.stack.includes(filePath)) this.stack.push(filePath);
        }
        if (this.currentIndex === -1 && this.stack.length > 0) this.currentIndex = 0;
        this._emitStatusUpdate();
    }

    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            const removedPath = this.stack.splice(index, 1)[0];
            this.cachedAudio.delete(removedPath);
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
        this._stopMusicStream();
        this._stopTimer();
        this.stack = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.cachedAudio.clear();
        this.consecutiveErrors = 0;
        this._emitStatusUpdate();
    }

    async _play(startTime = 0) {
        if (this.isDestroyed) return;
        if (this.playLock) return;
        this.playLock = true;

        try {
            if (this.stack.length === 0) {
                this.stop();
                this.playLock = false;
                return;
            }

            // Roll-off system: we always play the track at index 0
            this.currentIndex = 0;
            const filePath = this.stack[0];

            this.log(`[AudioPlayer] Starting: ${path.basename(filePath)} from ${startTime}s`);

            this._stopMusicStream();
            this._stopTimer();

            this.currentTime = startTime;
            if (startTime === 0) this.duration = 0;

            this.isPlaying = true;
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

            // Background duration check
            if (startTime === 0) {
                this._getDuration(filePath).then(duration => {
                    if (this.isPlaying && this.stack[0] === filePath) {
                        this.duration = duration;
                        this._emitStatusUpdate();
                    }
                }).catch(err => this.log(`[AudioPlayer] Duration check failed: ${err.message}`));
            }

            this.lastPlayStartTime = Date.now() - (startTime * 1000);

            const cachedBuffer = this.cachedAudio.get(filePath);

            if (cachedBuffer && startTime === 0) {
                this.log(`[AudioPlayer] Using cache for: ${path.basename(filePath)}`);
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
                this.consecutiveErrors = 0;
            } else {
                const ffmpegPath = this._getFfmpegPath();
                const args = startTime > 0
                    ? ['-ss', startTime.toString(), '-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']
                    : ['-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'];

                const ffmpegProcess = spawn(ffmpegPath, args);

                ffmpegProcess.on('error', (err) => {
                    this.log(`[AudioPlayer] FFmpeg spawn error: ${err.message}`);
                    this._handlePlaybackError(filePath);
                });

                ffmpegProcess.stderr.on('data', (data) => {
                    const msg = data.toString();
                    if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
                        this.log(`[AudioPlayer] FFmpeg Stderr: ${msg.trim()}`);
                    }
                });

                const ffmpegOutput = ffmpegProcess.stdout;
                const mixerStream = new PassThrough();
                ffmpegOutput.pipe(mixerStream);

                let pcmBuffer = Buffer.alloc(0);
                let tooBig = false;
                this.isCaching = (startTime === 0);
                if (this.isCaching) this._emitStatusUpdate();

                ffmpegOutput.on('data', (chunk) => {
                    if (this.isCaching && !tooBig) {
                        if (pcmBuffer.length + chunk.length <= this.MAX_CACHE_SIZE) {
                            pcmBuffer = Buffer.concat([pcmBuffer, chunk]);
                        } else {
                            tooBig = true;
                            this.log(`[AudioPlayer] Cache limit reached for: ${path.basename(filePath)}`);
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

                        if (!tooBig && pcmBuffer.length > 1024 && startTime === 0) {
                            this.cachedAudio.set(filePath, pcmBuffer);
                            this.log(`[AudioPlayer] Cached: ${path.basename(filePath)} (${(pcmBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
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
                this.consecutiveErrors = 0;
            }

            const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
            this.mixer.setInputVolume('music', currentVolume);

        } catch (error) {
            this.log(`[AudioPlayer] _play Exception: ${error.message}`);
            this._handlePlaybackError(filePath);
        } finally {
            this.playLock = false;
        }
    }

    _handlePlaybackError(filePath) {
        this.consecutiveErrors++;
        this.log(`[AudioPlayer] Consecutive errors: ${this.consecutiveErrors}`);

        if (this.consecutiveErrors >= Math.max(3, this.stack.length)) {
            this.log("[AudioPlayer] Multiple playback failures, stopping.");
            this.stop();
        } else {
            this.log("[AudioPlayer] Skipping problematic track.");
            setTimeout(() => this.next(), 1000);
        }
    }

    _getFfmpegPath() {
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) return this.ffmpegBinFolder;
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
            exec(cmd, { timeout: 5000 }, (error, stdout) => {
                if (error) { reject(error); return; }
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
                if (this.duration > 0 && this.currentTime > this.duration) this.currentTime = this.duration;
                this._emitStatusUpdate();
            }
        }, 1000);
    }

    _stopTimer() {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
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
        if (this.isDestroyed) return;
        const elapsed = Date.now() - (this.lastPlayStartTime || 0);

        // Anti-thrash check
        if (elapsed < 800 && (this.duration === 0 || this.duration > 2)) {
            this.log(`[AudioPlayer] Track ended too fast (${elapsed}ms), considering it an error.`);
            this._handlePlaybackError(this.stack[0]);
            return;
        }

        this.consecutiveErrors = 0;

        setTimeout(() => {
            if (this.loopMode === 2) {
                this.log("[AudioPlayer] Looping single track.");
                this._play();
            } else if (this.loopMode === 1) {
                this.log("[AudioPlayer] Advancing (Loop All).");
                const finished = this.stack.shift();
                this.stack.push(finished);
                this._play();
            } else {
                this.log("[AudioPlayer] Rolling off (No Loop).");
                this.stack.shift();
                if (this.stack.length > 0) {
                    this._play();
                } else {
                    this.log("[AudioPlayer] Playlist finished.");
                    this.stop();
                }
            }
        }, 100);
    }

    next() {
        if (this.stack.length === 0) return;

        if (this.shuffleMode) {
            this.playedIndices.push(this.currentIndex);
            if (this.playedIndices.length >= this.stack.length) this.playedIndices = [];
            let nextIndex = Math.floor(Math.random() * this.stack.length);
            // In shuffle mode with roll-off, we just pick one and move it to top
            const track = this.stack.splice(nextIndex, 1)[0];
            this.stack.unshift(track);
        } else {
            if (this.loopMode === 1 || this.loopMode === 2) {
                const current = this.stack.shift();
                this.stack.push(current);
            } else {
                this.stack.shift();
                if (this.stack.length === 0) { this.stop(); return; }
            }
        }
        this._play();
    }

    jumpTo(index) {
        if (index >= 0 && index < this.stack.length) {
            const preceding = this.stack.splice(0, index);
            if (this.loopMode === 1 || this.loopMode === 2) {
                this.stack.push(...preceding);
            }
            this._play();
        }
    }

    prev() {
        if (this.stack.length === 0) return;
        if (this.loopMode === 1 || this.loopMode === 2) {
            const last = this.stack.pop();
            this.stack.unshift(last);
        }
        this._play();
    }

    play() {
        this.log(`[AudioPlayer] play() called. Status: ${this.playerStatus}, Tracks: ${this.stack.length}`);
        if (this.isPlaying && this.playerStatus === AudioPlayerStatus.Playing) return;

        if (this.playerStatus === AudioPlayerStatus.Paused && this.stack.length > 0) {
            this._play(this.currentTime);
            return;
        }

        if (this.stack.length > 0) {
            this._play();
        } else {
            this.log("[AudioPlayer] Cannot play: playlist is empty.");
        }
    }

    seek(time) {
        if (this.stack.length > 0) {
            this.log(`[AudioPlayer] Seeking to ${time}s`);
            this.isPlaying = true;
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
        this.playerStatus = AudioPlayerStatus.Idle;
        this._emitStatusUpdate();
    }

    playSound(filePath, slotId) {
        const id = `sfx_${slotId}`;
        this.stopSound(slotId);
        try {
            const ffmpegPath = this._getFfmpegPath();
            const ffmpegProcess = spawn(ffmpegPath, ['-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);
            const stream = ffmpegProcess.stdout;
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) this.mixer.setInputVolume('music', this.playbackVolume * this.duckingVolume);
            this.activeSfxCount++;
            stream.once('close', () => {
                if (this.activeStreams.has(id)) {
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    this.emit('sound-finished', slotId);
                    this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                    if (this.activeSfxCount === 0 && this.activeStreams.has('music')) this.mixer.setInputVolume('music', this.playbackVolume);
                }
            });
            this.mixer.addInput(stream, id, this.soundboardVolume);
            this.activeStreams.set(id, { process: ffmpegProcess, stream });
        } catch (error) { this.log(`[AudioPlayer] SFX Spawn Error: ${error.message}`); }
    }

    stopSound(slotId) {
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            const { process } = this.activeStreams.get(id);
            this.mixer.removeInput(id);
            if (process) process.kill();
            this.activeStreams.delete(id);
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) this.mixer.setInputVolume('music', this.playbackVolume);
        }
    }

    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        this.activeStreams.forEach((value, id) => { if (id.startsWith('sfx_')) this.mixer.setInputVolume(id, volume); });
    }

    getMusicFiles() {
        if (!this.musicFolder || !fs.existsSync(this.musicFolder)) return [];
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) getAllFiles(fullPath, results);
                else {
                    const ext = path.extname(fullPath).toLowerCase();
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(fullPath);
                }
            });
            return results;
        };
        return getAllFiles(this.musicFolder);
    }

    getPreviewFilePath() {
        if (this.stack.length > 0) return this.stack[0];
        return null;
    }

    destroy() {
        this.isDestroyed = true;
        if (this.player) this.player.stop();
        this.activeStreams.forEach(({ process }) => { try { if (process) process.kill(); } catch (e) {} });
        this.activeStreams.clear();
        if (this.mixer) this.mixer.destroy();
    }
}

module.exports = BackendAudioPlayer;
