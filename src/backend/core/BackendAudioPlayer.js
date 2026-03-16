// Performance and security update
const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

/**
 * @typedef {Object} MusicTrack
 * @property {string} path - Absolute path to the audio file.
 * @property {string} name - Display name of the track.
 */

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

        // Stack management
        this.stack = [];
        this.currentTrackIndex = 0;
        this.loopMode = 'none'; // 'none', 'all', 'one'
        this.shuffle = false;

        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        this.activeSfxCount = 0;

        // Caching
        this.audioCache = new Map(); // path -> Buffer
        this.MAX_CACHE_SIZE = 126720000; // ~120MB, approx 11 minutes of 48kHz/16bit/stereo PCM

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
            // Handle if the path is not under musicFolder
            try {
                const relative = path.relative(this.musicFolder, filePath);
                return relative.startsWith('..') ? path.basename(filePath) : relative;
            } catch (e) {
                return path.basename(filePath);
            }
        };

        const status = {
            isPlaying: this.isPlaying,
            playerStatus: this.playerStatus,
            stack: this.stack.map(t => ({ ...t, displayPath: getRelativePath(t.path) })),
            currentTrackIndex: this.currentTrackIndex,
            loopMode: this.loopMode,
            shuffle: this.shuffle,
            activeTrack: this.stack[this.currentTrackIndex] ? {
                ...this.stack[this.currentTrackIndex],
                displayPath: getRelativePath(this.stack[this.currentTrackIndex].path)
            } : null
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
        this.loopMode = mode; // 'none', 'all', 'one'
        this.log(`Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    }

    setShuffle(enabled) {
        this.shuffle = enabled;
        this.log(`Shuffle is now ${enabled ? 'ON' : 'OFF'}`);
        this._emitStatusUpdate();
    }

    // --- Stack Management ---

    addToStack(filePath) {
        const name = path.basename(filePath, path.extname(filePath));
        this.stack.push({ path: filePath, name });
        this.log(`Added to stack: ${name}`);
        this._emitStatusUpdate();
    }

    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            const removed = this.stack.splice(index, 1);
            this.log(`Removed from stack: ${removed[0].name}`);
            if (this.currentTrackIndex >= this.stack.length) {
                this.currentTrackIndex = Math.max(0, this.stack.length - 1);
            }
            this._emitStatusUpdate();
        }
    }

    clearStack() {
        this.stack = [];
        this.currentTrackIndex = 0;
        this._stopMusicStream();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        this.log(`Stack cleared.`);
        this._emitStatusUpdate();
    }

    // --- Playback Logic ---

    async _play() {
        if (this.stack.length === 0) {
            this.log("Play called but stack is empty.");
            return;
        }

        const track = this.stack[this.currentTrackIndex];
        if (!track) return;

        this.log(`Starting playback: ${track.name}`);
        this.lastPlayStartTime = Date.now();

        this._stopMusicStream();

        try {
            let stream;
            let ffmpegProcess = null;

            if (this.audioCache.has(track.path)) {
                this.log(`Playing from cache: ${track.name}`);
                const buffer = this.audioCache.get(track.path);
                stream = new Readable({
                    read() {
                        this.push(buffer);
                        this.push(null);
                    }
                });
            } else {
                let resolvedPath = track.path;
                if (this.shell && path.extname(resolvedPath).toLowerCase() === '.lnk') {
                    const shortcut = this.shell.readShortcutLink(resolvedPath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        resolvedPath = shortcut.target;
                    }
                }

                ffmpegProcess = this._createFfmpegStream(resolvedPath);
                stream = ffmpegProcess.stdout;

                // Caching logic
                const chunks = [];
                let totalSize = 0;
                let cachingFailed = false;

                stream.on('data', (chunk) => {
                    if (!cachingFailed) {
                        totalSize += chunk.length;
                        if (totalSize <= this.MAX_CACHE_SIZE) {
                            chunks.push(chunk);
                        } else {
                            cachingFailed = true;
                            this.log(`File too large to cache: ${track.name}`);
                        }
                    }
                });

                stream.once('end', () => {
                    if (!cachingFailed && chunks.length > 0) {
                        this.audioCache.set(track.path, Buffer.concat(chunks));
                        this.log(`Cached track: ${track.name} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
                    }
                });
            }

            stream.once('close', () => {
                const currentMusic = this.activeStreams.get('music');
                if (currentMusic && currentMusic.stream === stream) {
                    this.activeStreams.delete('music');
                    this.mixer.removeInput('music');
                    this._handleMusicFinish();
                }
            });

            this.mixer.addInput(stream, 'music', this.playbackVolume);
            this.activeStreams.set('music', { process: ffmpegProcess, stream });

            this.isPlaying = true;
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

        } catch (error) {
            this.log(`Error playing ${track.name}: ${error.message}`);
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        }
    }

    _createFfmpegStream(filePath) {
        if (!this.ffmpegPath) {
            throw new Error("FFmpeg path not configured.");
        }

        const args = [
            '-re',
            '-i', filePath,
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ];

        const ffmpeg = spawn(this.ffmpegPath, args);
        ffmpeg.stderr.on('data', () => {}); // Consume stderr
        return ffmpeg;
    }

    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const { process } = this.activeStreams.get('music');
            this.mixer.removeInput('music');
            if (process) process.kill();
            this.activeStreams.delete('music');
        }
    }

    _handleMusicFinish() {
        const duration = Date.now() - (this.lastPlayStartTime || 0);

        if (this.loopMode === 'one') {
            this.log(`Looping current track.`);
            setTimeout(() => this._play(), 100);
            return;
        }

        if (this.shuffle) {
            this.currentTrackIndex = Math.floor(Math.random() * this.stack.length);
            this.log(`Shuffle: Next track index ${this.currentTrackIndex}`);
            setTimeout(() => this._play(), 100);
            return;
        }

        const nextIndex = this.currentTrackIndex + 1;

        if (nextIndex < this.stack.length) {
            this.currentTrackIndex = nextIndex;
            this.log(`Next track in stack.`);
            setTimeout(() => this._play(), 100);
        } else if (this.loopMode === 'all') {
            this.currentTrackIndex = 0;
            this.log(`Loop All: Restarting stack.`);
            setTimeout(() => this._play(), 100);
        } else {
            this.log('End of stack reached.');
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        }
    }

    // --- Public API ---

    async loadFile(filePath) {
        this.addToStack(filePath);
    }

    getPreviewFilePath() {
        if (this.stack.length > 0) {
            return this.stack[this.currentTrackIndex].path;
        }
        return null;
    }

    setPlayNext(enabled) {
        // Shim for old API
        this.log(`setPlayNext(${enabled}) called but feature is replaced by stack.`);
    }

    play() {
        if (this.playerStatus === AudioPlayerStatus.Paused || this.playerStatus === AudioPlayerStatus.Idle) {
            this._play();
        }
    }

    pause() {
        this._stopMusicStream();
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

    next() {
        if (this.stack.length === 0) return;
        this._stopMusicStream();
        if (this.shuffle) {
            this.currentTrackIndex = Math.floor(Math.random() * this.stack.length);
        } else {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.stack.length;
        }
        this._play();
    }

    previous() {
        if (this.stack.length === 0) return;
        this._stopMusicStream();
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.stack.length) % this.stack.length;
        this._play();
    }

    // --- Soundboard API ---

    playSound(filePath, slotId) {
        const id = `sfx_${slotId}`;
        this.stopSound(slotId);

        try {
            let stream;
            let ffmpegProcess = null;

            if (this.audioCache.has(filePath)) {
                const buffer = this.audioCache.get(filePath);
                stream = new Readable({
                    read() {
                        this.push(buffer);
                        this.push(null);
                    }
                });
            } else {
                ffmpegProcess = this._createFfmpegStream(filePath);
                stream = ffmpegProcess.stdout;
                // We could also cache SFX here if desired, but focus on music first.
            }

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
            if (id.startsWith('sfx_')) {
                this.mixer.setInputVolume(id, volume);
            }
        });
    }

    destroy() {
        if (this.player) this.player.stop();
        this.activeStreams.forEach(({ process }) => {
            if (process) process.kill();
        });
        this.activeStreams.clear();
        if (this.mixer) this.mixer.destroy();
        this.audioCache.clear();
    }
}

module.exports = BackendAudioPlayer;
