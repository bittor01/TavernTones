const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
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
        this.promoteAndPause = false; // Flag to promote a track without playing it
        this.loopToggle = true;
        this.playbackVolume = 1.0;

        // No longer need to manage file buffers here
        // Internal file management
        //this.activeFile = null; // Buffer for the active track
        //this.pendingFile = null; // Buffer for the pending track

        // Discord.js Voice components
        this.player = createAudioPlayer();
        this.connection = null;

        this.setupPlayerEvents();
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

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, async () => {
            this.log(`Player entered Idle state. Was playing: ${this.activeFilePath}`);
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;

            const finishedFilePath = this.activeFilePath;
            this.activeFilePath = null;

            if (this.pendingFilePath) {
                this.log('Idle: Pending file found, promoting it to active.');
                this._movePendingToActive();
                if (this.promoteAndPause) {
                    // This logic might need adjustment, as we don't 'play' in the same way.
                    // For now, we just set the main audio in the mixer and don't start the player.
                    this.log('Idle: Promote and pause flag is set. Setting mixer but not playing.');
                    this.promoteAndPause = false;
                    this.audioMixer.setMainAudio(this.activeFilePath, this.loopToggle);
                    this.player.pause(true); // Ensure player is paused
                } else {
                    this._play(); // Autoplay as normal
                }
            } else if (this.loopToggle && finishedFilePath) {
                this.log(`Idle: Looping active file: ${finishedFilePath}`);
                this.activeFilePath = finishedFilePath;
                this._play();
            } else {
                this.log('Idle: No pending file and looping is off. Player remains idle.');
                this.audioMixer.setMainAudio(null); // Explicitly clear the mixer's main track
            }
            this._emitStatusUpdate();
        });

        this.player.on('error', error => {
            this.log(`Error in audio player for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
            this.activeFilePath = null;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        });

        this.player.on(AudioPlayerStatus.Playing, () => {
            this.playerStatus = AudioPlayerStatus.Playing;
            this.isPlaying = true;
            this._emitStatusUpdate();
        });

        this.player.on(AudioPlayerStatus.Paused, () => {
            this.playerStatus = AudioPlayerStatus.Paused;
            this.isPlaying = false;
            this._emitStatusUpdate();
        });
    }

    // --- Configuration ---

    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        const mixedStream = this.audioMixer.getOutputStream();
        // The mixer outputs a raw PCM stream. We must specify this to the AudioResource.
        const resource = createAudioResource(mixedStream, { inputType: 'raw' });
        this.player.play(resource);
        this.connection.subscribe(this.player);
    }

    setVolume(volume) {
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            this.log(`Playback volume set to ${volume * 100}%`);
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
        // Caching is no longer needed as we stream from the file path directly.
        // This function now just validates the path and sets it as pending.
        this.log(`Setting pending file path to: ${filePath}`);
        this.pendingFilePath = filePath;
        this._emitStatusUpdate();
        return true; // Assume path is valid for now.
    }

    // --- Internal Playback ---

    async _play() {
        if (!this.activeFilePath) {
            this.log("Play called but no active file to play.");
            return;
        }
        if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
            this.log("Cannot play, voice connection is not available.");
            return;
        }

        try {
            this.audioMixer.setMainAudio(this.activeFilePath, this.loopToggle);
            // We no longer directly control the player; the mixer's stream is continuous.
            // We just need to unpause the main Discord player if it's paused.
            if(this.playerStatus === AudioPlayerStatus.Paused){
                this.player.unpause();
            }
            this.playerStatus = AudioPlayerStatus.Playing;
            this.isPlaying = true;
            this._emitStatusUpdate();
            this.log(`Playback started for: ${this.activeFilePath}`);
        } catch (error) {
            this.log(`Error starting playback for ${this.activeFilePath}: ${error.message}`);
            this.playerStatus = AudioPlayerStatus.Idle;
            this.isPlaying = false;
            this._emitStatusUpdate();
        }
    }

    // --- Public API ---

    async loadFile(filePath) {
        await this._cacheFileToPending(filePath);
        this._emitStatusUpdate(); // Ensure UI is updated with new pending file
    }

    play() {
        // If the player is paused, unpause it. The mixer stream is continuous.
        if (this.playerStatus === AudioPlayerStatus.Paused) {
            this.player.unpause();
            this.log('Playback resumed.');
            return;
        }

        // If the player is idle, it means no main track is set in the mixer.
        if (this.playerStatus === AudioPlayerStatus.Idle) {
            if (this.pendingFilePath) {
                this.log('No active file, promoting pending file.');
                this._movePendingToActive();
            }
            if (this.activeFilePath) {
                this.log('Playback starting from idle state.');
                this._play();
            } else {
                this.log('Play command received, but no active or pending file to play.');
            }
        }
    }

    pause() {
        if (this.playerStatus !== AudioPlayerStatus.Playing) {
            this.log('Pause command received, but not currently playing.');
            return;
        }

        // We just pause the main player. The mixer process continues running underneath.
        this.log(`Playback paused for: ${this.activeFilePath}`);
        this.player.pause(true);
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }
}

module.exports = BackendAudioPlayer;
