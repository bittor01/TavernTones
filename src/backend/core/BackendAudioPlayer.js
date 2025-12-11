const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

class BackendAudioPlayer extends EventEmitter {
    constructor(logCallback, shell, musicFolder) {
        super();
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;
        this.isCaching = false;
        this.activeFilePath = null;
        this.pendingFilePath = null;
        this.loopToggle = true;
        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.mixer = new ThreadedAudioMixer(this.log);
        this.mixedResource = createAudioResource(this.mixer, { inputType: StreamType.Raw });
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
            return path.relative(this.musicFolder, filePath);
        };
        const status = {
            isPlaying: this.isPlaying,
            isCaching: this.isCaching,
            activeFilePath: getRelativePath(this.activeFilePath),
            pendingFilePath: getRelativePath(this.pendingFilePath),
        };
        this.emit('status-change', status);
    }

    setupPlayerEvents() {
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
            this.mixer.setInputVolume('music', this.playbackVolume);
            this.log(`Playback volume set to ${volume * 100}%`);
        }
    }

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    _movePendingToActive() {
        if (!this.pendingFilePath) return;
        this.activeFilePath = this.pendingFilePath;
        this.pendingFilePath = null;
    }

    async _resolvePath(filePath) {
        let resolvedPath = filePath;
        if (this.shell && path.extname(resolvedPath).toLowerCase() === '.lnk') {
            try {
                // Note: shell.readShortcutLink is synchronous, but it's a fast OS-level operation.
                // The slow part is the subsequent file existence check, which we make async.
                const shortcutDetails = this.shell.readShortcutLink(resolvedPath);
                if (shortcutDetails.target) {
                    await fsp.access(shortcutDetails.target, fs.constants.F_OK);
                    this.log(`Resolved .lnk shortcut from ${resolvedPath} to ${shortcutDetails.target}`);
                    resolvedPath = shortcutDetails.target;
                } else {
                    throw new Error('Shortcut target is invalid.');
                }
            } catch (error) {
                this.log(`Failed to resolve .lnk shortcut at ${resolvedPath}: ${error.message}`);
                return null; // Return null on failure
            }
        }
        return resolvedPath;
    }

    async loadFile(filePath) {
        this.isCaching = true;
        this._emitStatusUpdate();
        try {
            const resolvedPath = await this._resolvePath(filePath);
            if (!resolvedPath) {
                this.pendingFilePath = null;
                return; // Error already logged in _resolvePath
            }

            this.pendingFilePath = resolvedPath;

            if (this.playerStatus === AudioPlayerStatus.Idle || this.playerStatus === AudioPlayerStatus.Paused) {
                this._movePendingToActive();
                this._stopMusicStream();
                this._play();
                if (this.playerStatus === AudioPlayerStatus.Paused) {
                    this.pause();
                }
            }
        } finally {
            this.isCaching = false;
            this._emitStatusUpdate();
        }
    }

    _createFfmpegStream(filePath) {
        this.log(`[BAP] Creating ffmpeg stream for: ${filePath}`);
        const ffmpeg = spawn('ffmpeg', ['-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);
        ffmpeg.stderr.on('data', (data) => this.log(`[FFMPEG STDERR] ${data}`));
        return ffmpeg;
    }

    _play() {
        if (!this.activeFilePath) {
            this.log('[BAP] _play called but no active file path. Aborting.');
            return;
        }
        this.log(`[BAP] Starting _play for: ${this.activeFilePath}`);
        this.lastPlayStartTime = Date.now(); // Track start time
        this._stopMusicStream(); // Ensure no old stream is running
        const ffmpegProcess = this._createFfmpegStream(this.activeFilePath);
        const stream = ffmpegProcess.stdout;
        stream.on('data', () => this.log('[BAP] Music stream sent data chunk.'));
        stream.once('close', () => this._handleMusicFinish());
        this.log('[BAP] Adding music stream to mixer.');
        this.mixer.addInput(stream, 'music', this.playbackVolume);
        this.activeStreams.set('music', { process: ffmpegProcess, stream });
        this.isPlaying = true;
        this.playerStatus = AudioPlayerStatus.Playing;
        this._emitStatusUpdate();
    }

    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const { process } = this.activeStreams.get('music');
            this.mixer.removeInput('music');
            process.kill();
            this.activeStreams.delete('music');
        }
    }

    _handleMusicFinish() {
        const duration = Date.now() - (this.lastPlayStartTime || 0);

        if (this.loopToggle && this.activeFilePath) {
            if (duration < 2000) { // 2-second threshold
                this.log(`ERR: File ${this.activeFilePath} finished too quickly (${duration}ms). Disabling loop to prevent thrashing.`);
                this.isPlaying = false;
                this.playerStatus = AudioPlayerStatus.Idle;
                this._emitStatusUpdate();
                return;
            }
            this.log(`Looping active file: ${this.activeFilePath}`);
            setTimeout(() => this._play(), 100);
        } else {
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        }
    }

    async playSound(filePath, slotId) {
        this.log(`[BAP] playSound called for slot ${slotId} with path: ${filePath}`);
        const resolvedPath = await this._resolvePath(filePath);
        if (!resolvedPath) {
            this.log(`[BAP] Could not resolve path for slot ${slotId}, aborting playback.`);
            this.emit('sound-finished', slotId); // Emit finished to un-set the playing state in UI
            return;
        }

        const id = `sfx_${slotId}`;
        this.stopSound(slotId); // Stop any existing sound in the same slot

        const ffmpegProcess = this._createFfmpegStream(resolvedPath);
        const stream = ffmpegProcess.stdout;

        stream.on('data', () => this.log(`[BAP] SFX stream ${id} sent data chunk.`));
        stream.once('close', () => {
            if (this.activeStreams.has(id)) {
                this.log(`[BAP] SFX stream ${id} closed naturally.`);
                this.activeStreams.delete(id);
                this.emit('sound-finished', slotId);
            }
        });

        this.log(`[BAP] Adding SFX stream ${id} to mixer.`);
        this.mixer.addInput(stream, id, this.soundboardVolume);
        this.activeStreams.set(id, { process: ffmpegProcess, stream });
    }

    stopSound(slotId) {
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            const { process } = this.activeStreams.get(id);
            this.mixer.removeInput(id);
            process.kill();
            this.activeStreams.delete(id);
        }
    }

    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        this.activeStreams.forEach((_, id) => {
            if (id.startsWith('sfx_')) {
                this.mixer.setInputVolume(id, volume);
            }
        });
    }

    play() {
        if (this.playerStatus === AudioPlayerStatus.Paused) {
            this.mixer.resumeInput('music');
            this.isPlaying = true;
            this.playerStatus = AudioPlayerStatus.Playing;
        } else if (this.playerStatus === AudioPlayerStatus.Idle) {
            if (this.pendingFilePath) {
                this._movePendingToActive();
            }
            if (this.activeFilePath) {
                this._play();
            }
        }
        this._emitStatusUpdate();
    }

    pause() {
        if (this.playerStatus !== AudioPlayerStatus.Playing) return;
        this.mixer.pauseInput('music');
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }
}

module.exports = BackendAudioPlayer;