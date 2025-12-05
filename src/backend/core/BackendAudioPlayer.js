const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');

class BackendAudioPlayer extends EventEmitter {
    constructor(logCallback, shell, musicFolder) {
        super();
        // Dependencies
        this.log = logCallback || console.log;
        this.shell = shell;
        this.musicFolder = musicFolder;

        // State
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;
        this.isCaching = false;
        this.activeFilePath = null;
        this.pendingFilePath = null; // New state for the pending file path
        this.promoteAndPause = false; // Flag to promote a track without playing it
        this.isStoppingIntentionally = false; // Flag to help the Idle handler know why it was called
        this.loopToggle = true;
        this.playbackVolume = 1.0;

        // Internal file management
        this.activeFile = null; // Buffer for the active track
        this.pendingFile = null; // Buffer for the pending track

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
            this.log(`Player entered Idle state. Was playing: ${this.activeFilePath}. Intentional stop: ${this.isStoppingIntentionally}`);
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;

            const finishedFile = this.activeFile;
            const finishedFilePath = this.activeFilePath;

            // --- Reset active file info ---
            this.activeFile = null;
            this.activeFilePath = null;

            // --- Main Logic ---
            // Case 1: The player was stopped intentionally to swap tracks.
            if (this.isStoppingIntentionally) {
                this.isStoppingIntentionally = false; // Reset the flag immediately

                if (this.pendingFile) {
                    this.log('Idle (Intentional): Pending file found, promoting it.');
                    this._movePendingToActive();

                    if (this.promoteAndPause) {
                        this.log('Idle (Intentional): Promote and pause flag is set. Loading track to pause.');
                        this.promoteAndPause = false; // Reset the flag
                        try {
                            const stream = Readable.from(this.activeFile);
                            const resource = createAudioResource(stream, { inlineVolume: true });
                            resource.volume.setVolume(this.playbackVolume);
                            this.player.play(resource);
                            await entersState(this.player, AudioPlayerStatus.Playing, 5000);
                            this.player.pause(true);
                            this.log(`Idle (Intentional): Promoted track is now loaded and paused: ${this.activeFilePath}`);
                        } catch (error) {
                            this.log(`Error during promote and pause for ${this.activeFilePath}: ${error.message}`);
                            this.playerStatus = AudioPlayerStatus.Idle;
                            this.isPlaying = false;
                        }
                    } else {
                        this.log('Idle (Intentional): Autoplaying promoted track.');
                        this._play(); // Autoplay as normal
                    }
                } else {
                    this.log('Idle (Intentional): Player stopped but no pending file. Remaining idle.');
                }
            }
            // Case 2: The track finished playing naturally.
            else {
                if (this.loopToggle && finishedFile) {
                    this.log(`Idle (Natural): Looping active file: ${finishedFilePath}`);
                    this.activeFile = finishedFile;
                    this.activeFilePath = finishedFilePath;
                    this._play();
                } else {
                    this.log('Idle (Natural): No loop. Player remains idle.');
                    // If there's a pending file here, we explicitly DO NOT play it,
                    // because the user expects the current song to loop or stop.
                }
            }
            this._emitStatusUpdate();
        });

        this.player.on('error', error => {
            this.log(`Error in audio player for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
            this.activeFile = null;
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

            const buffer = await fsp.readFile(resolvedPath);
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

    async _play() {
        if (!this.activeFile) {
            this.log("Play called but no active file to play.");
            return;
        }
        if (!this.connection || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
            this.log("Cannot play, voice connection is not available.");
            return;
        }

        try {
            const stream = Readable.from(this.activeFile);
            const resource = createAudioResource(stream, { inlineVolume: true });
            resource.volume.setVolume(this.playbackVolume);

            this.player.play(resource);
            await entersState(this.player, AudioPlayerStatus.Playing, 5000);
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

        // If a file is loaded while paused, we want to promote it immediately but not play it.
        if (this.playerStatus === AudioPlayerStatus.Paused && this.pendingFile) {
            this.log('File loaded while paused. Promoting to active and remaining paused.');
            this.promoteAndPause = true;
            this.isStoppingIntentionally = true;
            this.player.stop(); // Trigger idle handler to perform the swap.
        }

        this._emitStatusUpdate(); // Ensure UI is updated with new pending file
    }

    play() {
        // Scenario 1: A new track is pending and the current one is paused.
        // The desired behavior is to replace the paused track and play the new one.
        if (this.playerStatus === AudioPlayerStatus.Paused && this.pendingFile) {
            this.log('Play command received while paused with a pending track. Swapping and playing.');
            this.isStoppingIntentionally = true;
            this.player.stop(); // This triggers the 'idle' state.
                               // The 'idle' handler will automatically promote the pending file and play it.
            // We return here because the idle handler will take over.
            return;
        }

        // Scenario 2: The player is paused, but there's no new track.
        // The desired behavior is to simply resume playback.
        if (this.playerStatus === AudioPlayerStatus.Paused) {
            this.player.unpause();
            this.log('Playback resumed.');
            return;
        }

        // Scenario 3: The player is idle.
        if (this.playerStatus === AudioPlayerStatus.Idle) {
            // If there's a pending file, it should become the active one.
            if (this.pendingFile) {
                this.log('No active file, promoting pending file.');
                this._movePendingToActive();
            }
            // If there's now an active file, play it.
            if (this.activeFile) {
                this.log('Playback starting from idle state.');
                this._play();
            } else {
                this.log('Play command received, but no active or pending file to play.');
            }
            return;
        }

        // Fallback for any other state (e.g., already playing)
        this.log('Play command received, but already playing or in a non-idle state.');
    }

    pause() {
        if (this.playerStatus !== AudioPlayerStatus.Playing) {
            this.log('Pause command received, but not currently playing.');
            return;
        }

        if (this.pendingFile) {
            this.log('Pending file exists, setting flag to promote and pause.');
            this.promoteAndPause = true;
            this.isStoppingIntentionally = true;
            this.player.stop(); // This will trigger the 'idle' event.
        } else {
            this.log(`Playback paused for: ${this.activeFilePath}`);
            this.player.pause(true);
        }
    }

    getPreviewFilePath() {
        return this.pendingFilePath || this.activeFilePath;
    }
}

module.exports = BackendAudioPlayer;
