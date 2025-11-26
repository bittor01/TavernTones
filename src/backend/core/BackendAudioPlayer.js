const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const AudioMixer = require('./AudioMixer'); // Import the new mixer

class BackendAudioPlayer extends EventEmitter {
    constructor(logCallback, errorCallback, shell, musicFolder) {
        super();
        // Dependencies
        this.log = logCallback || console.log;
        this.error = errorCallback || console.error;
        this.shell = shell;
        this.musicFolder = musicFolder;

        // Mixer
        this.audioMixer = new AudioMixer(this.log, this.error);

        // State
        this.isPlaying = false;
        this.isPaused = false; // New state for pause
        this.isCaching = false;
        this.activeFilePath = null;
        this.pendingFilePath = null;
        this.loopToggle = true;
        this.playbackVolume = 1.0;

        // Pause/Resume State
        this.playbackStartTime = 0; // Timestamp when the current track started playing
        this.pausedTimestamp = 0;   // How far into the track we were when paused

        // Internal file management
        this.activeFile = null;
        this.pendingFile = null;

        // Discord.js Voice components
        this.discordPlayer = createAudioPlayer();
        this.connection = null;

        // No initial status emit here, to prevent race condition
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

    // --- Main Track Lifecycle Events ---
    _onMainTrackFinished() {
        this.log(`Main track finished: ${this.activeFilePath}`);
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedTimestamp = 0;
        this.playbackStartTime = 0;

        const finishedFile = this.activeFile;
        const finishedFilePath = this.activeFilePath;

        this.activeFile = null;
        this.activeFilePath = null;

        if (this.pendingFile) {
            this.log('Track finished: Pending file found, promoting and playing.');
            this._movePendingToActive();
            this._play();
        } else if (this.loopToggle && finishedFile) {
            this.log(`Track finished: Looping active file: ${finishedFilePath}`);
            this.activeFile = finishedFile;
            this.activeFilePath = finishedFilePath;
            this._play();
        } else {
            this.log('Track finished: No pending file and looping is off.');
            this.audioMixer.setMainStream(null);
        }
        this._emitStatusUpdate();
    }

    // --- Configuration ---

    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        this.connection.subscribe(this.discordPlayer);

        const mixedStream = this.audioMixer.getMixedStream();
        const resource = createAudioResource(mixedStream);
        this.discordPlayer.play(resource);
        this.log('Discord player is now subscribed to the audio mixer stream.');
    }

    setVolume(volume) {
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            this.audioMixer.setMainVolume(this.playbackVolume);
            this.log(`Playback volume set to ${volume * 100}%.`);
        }
    }

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    // --- Internal File Handling ---

    _movePendingToActive() {
        if (!this.pendingFile) return;
        this.activeFile = this.pendingFile;
        this.activeFilePath = this.pendingFilePath;
        this.pendingFile = null;
        this.pendingFilePath = null;
        this.log(`Moved pending file to active: ${this.activeFilePath}`);
    }

    async _cacheFileToPending(filePath) {
        this.isCaching = true;
        this.pendingFilePath = filePath;
        this._emitStatusUpdate();
        try {
            let resolvedPath = filePath;
            if (this.shell && path.extname(resolvedPath).toLowerCase() === '.lnk') {
                 resolvedPath = (this.shell.readShortcutLink(resolvedPath)).target;
            }
            this.pendingFile = await fsp.readFile(resolvedPath);
            this.pendingFilePath = resolvedPath;
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

    _play(startTime = 0) {
        if (!this.activeFile) {
            this.log("Play called but no active file to play.");
            return;
        }
        if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
            this.log("Cannot play, voice connection is not available.");
            return;
        }

        try {
            const mainTrackStream = Readable.from(this.activeFile);
            mainTrackStream.on('end', () => this._onMainTrackFinished());
            mainTrackStream.on('error', (err) => this.error(`Main track stream error: ${err.message}`));

            this.audioMixer.setMainStream(mainTrackStream, startTime);
            this.isPlaying = true;
            this.isPaused = false;
            this.playbackStartTime = Date.now() - (startTime * 1000); // Adjust start time for accurate tracking
            this.log(`Playback started for: ${this.activeFilePath} at ${startTime}s`);
        } catch (error) {
            this.log(`Error starting playback for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
        }
        this._emitStatusUpdate();
    }

    // --- Public API ---

    async loadFile(filePath) {
        await this._cacheFileToPending(filePath);
    }

    play() {
        // Case 1: Resuming from pause
        if (this.isPaused && this.activeFile) {
            this.log(`Resuming playback from ${this.pausedTimestamp}s.`);
            this._play(this.pausedTimestamp);
            return;
        }

        // Case 2: Already playing, do nothing
        if (this.isPlaying) {
            this.log('Play command received, but already playing.');
            return;
        }

        // Case 3: Starting a new track (or the same one from the beginning)
        if (this.pendingFile) {
            this.log('No active file, promoting pending file.');
            this._movePendingToActive();
        }

        if (this.activeFile) {
            this.pausedTimestamp = 0; // Ensure we start from the beginning
            this._play();
        } else {
            this.log('Play command received, but no active or pending file to play.');
        }
    }

    pause() {
        if (!this.isPlaying) {
            this.log('Pause command received, but not currently playing.');
            return;
        }
        // Calculate how far into the track we are
        const elapsedSeconds = (Date.now() - this.playbackStartTime) / 1000;
        this.pausedTimestamp = elapsedSeconds;

        this.audioMixer.setMainStream(null); // Stop sending the main track to the mixer
        this.isPlaying = false;
        this.isPaused = true;
        this.log(`Playback paused for: ${this.activeFilePath} at ${this.pausedTimestamp.toFixed(2)}s`);
        this._emitStatusUpdate();
    }

    stop() {
        this.log('Stopping all playback.');
        this.audioMixer.stop();
        this.activeFile = null;
        this.activeFilePath = null;
        this.pendingFile = null;
        this.pendingFilePath = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedTimestamp = 0;
        this.playbackStartTime = 0;
        this._emitStatusUpdate();

        if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            const mixedStream = this.audioMixer.getMixedStream();
            const resource = createAudioResource(mixedStream);
            this.discordPlayer.play(resource);
        }
    }

    async playSound(filePath) {
        this.log(`Attempting to play sound effect: ${filePath}`);
        try {
            const soundBuffer = await fsp.readFile(filePath);
            const soundStream = Readable.from(soundBuffer);
            const streamId = this.audioMixer.addSound(soundStream);

            soundStream.on('end', () => {
                this.log(`Sound effect finished, removing from mixer: ${filePath}`);
                this.audioMixer.removeSound(streamId);
            });
            soundStream.on('error', (err) => {
                this.error(`Sound effect stream error for ${filePath}: ${err.message}`);
                this.audioMixer.removeSound(streamId);
            });

        } catch (error) {
            this.error(`Failed to play sound effect ${filePath}: ${error.message}`);
        }
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }

    sendInitialStatus() {
        this._emitStatusUpdate();
    }
}

module.exports = BackendAudioPlayer;
