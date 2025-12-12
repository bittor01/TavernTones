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
        this.playbackStartTime = 0;
        this.playbackSeekTime = 0; // Time in seconds to seek to
        this.mixer = new ThreadedAudioMixer(this.log);
        this.mixedResource = createAudioResource(this.mixer, { inputType: StreamType.Raw });
        this.player = createAudioPlayer();
        this.connection = null;
        this.player.play(this.mixedResource);
        this.setupPlayerEvents();
        this._emitStatusUpdate();
        this.activeStreams = new Map();
    }

    // --- Status and Event Setup ---

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
        // The player shouldn't really go idle unless the mixer itself ends (which it shouldn't) or errors.
        // Or if we pause the whole player.
        // But for our "Audio Player" logic (music track logic), we need to emulate the "Idle"
        // behavior when the *music* track finishes.

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.log('Mixer player went IDLE. This implies the mixer stream ended.');
            // Restart mixer if it died?
        });

        this.player.on('error', error => {
            this.log(`Error in audio player (Mixer): ${error.message}`);
        });

        // We need to listen to the *music stream* end event to handle looping/next track.
        // This logic is now moved to _playMusicStream
    }

    // --- Configuration ---

    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        this.connection.subscribe(this.player);
    }

    setVolume(volume) {
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            this.log(`Playback volume set to ${volume * 100}%`);
            // Set volume on the mixer line for music? Or global?
            // For now, let's say this volume only affects the music track, not SFX?
            // Or we can implement volume scaling in the mixer.
            // TODO: Pass volume to mixer input.
        }
    }

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    // --- Internal File Handling ---

    _movePendingToActive() {
        if (!this.pendingFilePath) {
            this.log('Attempted to move pending to active, but no pending file exists.');
            return;
        }
        this.activeFilePath = this.pendingFilePath;
        this.pendingFilePath = null;
        this.log(`Moved pending file to active: ${this.activeFilePath}`);
    }

    async _cacheFileToPending(filePath) {
        this.isCaching = true; // Still use this flag for UI feedback
        this.pendingFilePath = filePath;
        this._emitStatusUpdate();
        this.log(`"Caching" (Prepared) file: ${filePath}`);

        try {
            let resolvedPath = filePath;
            if (this.shell && path.extname(resolvedPath).toLowerCase() === '.lnk') {
                try {
                    const shortcutDetails = this.shell.readShortcutLink(resolvedPath);
                    if (shortcutDetails.target && fs.existsSync(shortcutDetails.target)) {
                        this.log(`Resolved .lnk shortcut from ${resolvedPath} to ${shortcutDetails.target}`);
                        resolvedPath = shortcutDetails.target;
                    } else {
                        throw new Error('Shortcut target does not exist or is invalid.');
                    }
                } catch (error) {
                    this.log(`Failed to resolve .lnk shortcut at ${resolvedPath}: ${error.message}`);
                    this.pendingFilePath = null;
                    this.isCaching = false;
                    this._emitStatusUpdate();
                    return false;
                }
            }

            // We no longer read the file into memory. We just verified it exists.
            this.pendingFilePath = resolvedPath;
            return true;

        } catch (error) {
            this.log(`Error checking file ${filePath}: ${error.message}`);
            this.pendingFilePath = null;
            return false;
        } finally {
            this.isCaching = false;
            this._emitStatusUpdate();
        }
    }

    // --- Internal Playback ---

    _createFfmpegStream(filePath, seekTime = 0) {
        this.log(`[BAP] Creating ffmpeg stream for: ${filePath} at ${seekTime}s`);
        const args = seekTime > 0
            ? ['-re', '-ss', seekTime.toString(), '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']
            : ['-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'];
        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.stderr.on('data', (data) => this.log(`[FFMPEG STDERR] ${data}`));
        return ffmpeg;
    }

    _play(seekTime = 0) {
        if (!this.activeFilePath) {
            this.log('[BAP] _play called but no active file path. Aborting.');
            return;
        }
        this.log(`[BAP] Starting _play for: ${this.activeFilePath} at ${seekTime}s`);
        this.playbackStartTime = Date.now() - (seekTime * 1000);
        this._stopMusicStream();

        const ffmpegProcess = this._createFfmpegStream(this.activeFilePath, seekTime);
        const stream = ffmpegProcess.stdout;

        ffmpegProcess.on('error', (err) => {
            this.log(`[FFMPEG PROC ERROR] Failed to start ffmpeg process: ${err.message}`);
            this._stopMusicStream();
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        });

        ffmpegProcess.on('exit', (code, signal) => {
            this.log(`[FFMPEG PROC EXIT] Process exited with code ${code}, signal ${signal}`);
            if (this.activeStreams.has('music') && this.activeStreams.get('music').process === ffmpegProcess) {
                if (code === 0) {
                    this._handleMusicFinish();
                } else {
                    this.log(`[FFMPEG PROC EXIT] FFMPEG process exited with an error code.`);
                    this._stopMusicStream();
                    this.isPlaying = false;
                    this.playerStatus = AudioPlayerStatus.Idle;
                    this._emitStatusUpdate();
                }
            }
        });

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
            process.removeAllListeners('exit');
            process.removeAllListeners('error');
            this.mixer.removeInput('music');
            process.kill();
            this.activeStreams.delete('music');
            this.log('[BAP] Music stream stopped and process killed.');
        }
    }

    _handleMusicFinish() {
        this.playbackSeekTime = 0;
        if (this.loopToggle && this.activeFilePath) {
            this.log(`Looping active file: ${this.activeFilePath}`);
            setTimeout(() => this._play(), 100);
        } else {
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        }
    }

    // --- Soundboard API ---

    playSound(filePath, slotId) {
        this.log(`Soundboard: Playing ${filePath} on slot ${slotId}`);
        const id = `sfx_${slotId}`;

        // Stop existing if any
        this.stopSound(slotId);

        try {
            const ffmpegProcess = this._createFfmpegStream(filePath);
            const stream = ffmpegProcess.stdout;

            stream.once('close', () => {
                // If the stream is still in activeStreams, it finished naturally (not stopped manually)
                if (this.activeStreams.has(id)) {
                    this.log(`Soundboard: Stream ${id} finished naturally.`);
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    this.emit('sound-finished', slotId);
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
            process.kill();
            this.activeStreams.delete(id);
            this.log(`Soundboard: Stopped slot ${slotId}`);
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


    // --- Public API ---

    async loadFile(filePath) {
        this.isCaching = true;
        this._emitStatusUpdate();
        try {
            const resolvedPath = await this._resolvePath(filePath);
            if (!resolvedPath) {
                this.pendingFilePath = null;
                return;
            }

            this.pendingFilePath = resolvedPath;
            this.playbackSeekTime = 0; // Reset seek time for new file

            if (this.playerStatus === AudioPlayerStatus.Idle) {
                this._movePendingToActive();
            }
        } finally {
            this.isCaching = false;
            this._emitStatusUpdate();
        }
    }

    play() {
        if (this.playerStatus === AudioPlayerStatus.Paused) {
            this.log(`[BAP] Resuming playback from ${this.playbackSeekTime}s.`);
            this._play(this.playbackSeekTime);
        } else if (this.playerStatus === AudioPlayerStatus.Idle) {
            if (this.pendingFilePath) {
                this._movePendingToActive();
            }
            if (this.activeFilePath) {
                this.log('[BAP] Starting playback from idle state.');
                this._play(); // Starts from beginning
            }
        }
        this._emitStatusUpdate();
    }

    pause() {
        if (this.playerStatus !== AudioPlayerStatus.Playing) return;
        this.playbackSeekTime = (Date.now() - this.playbackStartTime) / 1000;
        this.log(`[BAP] Pausing playback at ${this.playbackSeekTime}s.`);
        this._stopMusicStream();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }
}

module.exports = BackendAudioPlayer;
