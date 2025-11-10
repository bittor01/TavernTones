const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');

class BackendAudioPlayer extends EventEmitter {
    constructor(logCallback, shell, musicFolder, audioMixer) {
        super();
        // Dependencies
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;
        this.audioMixer = audioMixer;

        // State
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;
        this.isCaching = false;
        this.activeFilePath = null;
        this.pendingFilePath = null; // New state for the pending file path
        this.loopToggle = true;
        this.playbackVolume = 1.0;

        // Internal file management
        this.activeFile = null; // Buffer for the active track
        this.pendingFile = null; // Buffer for the pending track

        // No internal player. This class is now a state manager for the main track.
        this._emitStatusUpdate(); // Emit initial state
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

    // --- Configuration ---

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    // --- Internal File Handling ---

    _movePendingToActive() {
        if (!this.pendingFile) {
            this.log('Attempted to move pending to active, but no pending file exists.');
            return;
        }
        this.activeFile = this.pendingFile;
        this.activeFilePath = this.pendingFilePath;
        this.pendingFile = null;
        this.pendingFilePath = null;
        this.log(`Moved pending file to active: ${this.activeFilePath}`);
    }

    async _cacheFileToPending(filePath) {
        this.isCaching = true;
        this.pendingFilePath = filePath; // Show pending path while caching
        this._emitStatusUpdate();
        this.log(`Caching started for: ${filePath}`);

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
                    this.pendingFile = null;
                    this.pendingFilePath = null;
                    this.isCaching = false;
                    this._emitStatusUpdate();
                    return false;
                }
            }

            const buffer = fs.readFileSync(resolvedPath);
            this.pendingFile = buffer;
            this.pendingFilePath = resolvedPath;
            this.log(`Successfully cached file: ${filePath}`);
            return true;
        } catch (error) {
            this.log(`Error caching file ${filePath}: ${error.message}`);
            this.pendingFile = null;
            this.pendingFilePath = null;
            return false;
        } finally {
            this.isCaching = false;
            this._emitStatusUpdate();
        }
    }

    // --- Internal Playback ---

    _play() {
        if (!this.activeFile) {
            this.log("Play called but no active file to play.");
            return;
        }
        if (!this.audioMixer) {
            this.log("Cannot play, audio mixer is not available.");
            return;
        }

        try {
            const stream = Readable.from(this.activeFile);
            this.audioMixer.setMainTrack(stream);
            this.isPlaying = true;
            this.log(`Playback started for: ${this.activeFilePath}`);
        } catch (error) {
            this.log(`Error starting playback for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
        }
        this._emitStatusUpdate();
    }

    // --- Public API ---

    async loadFile(filePath) {
        await this._cacheFileToPending(filePath);
        this._emitStatusUpdate(); // Ensure UI is updated with new pending file
    }

    play() {
        // If there's a pending file, it always takes precedence.
        if (this.pendingFile) {
            this._movePendingToActive();
        }

        if (this.activeFile) {
            this._play();
        } else {
            this.log('Play command received, but no active or pending file to play.');
        }
    }

    pause() {
        if (this.isPlaying) {
            // To "pause", we send a silent stream to the mixer's main track input.
            // This keeps the ffmpeg process running but effectively silences the music.
            const silentStream = new Readable();
            silentStream.push(null); // End the stream immediately
            this.audioMixer.setMainTrack(silentStream);
            this.isPlaying = false;
            this.log(`Playback paused for: ${this.activeFilePath}`);
            this._emitStatusUpdate();
        } else {
            this.log('Pause command received, but not currently playing.');
        }
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }
}

module.exports = BackendAudioPlayer;
