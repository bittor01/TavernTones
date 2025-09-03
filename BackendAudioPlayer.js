const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

class BackendAudioPlayer {
    constructor(logCallback, shell) {
        // Dependencies
        this.log = logCallback || console.log;
        this.shell = shell;

        // State merged from AudioState
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;

        // File management
        this.activeFile = null;
        this.pendingFile = null;
        this.activeFilePath = null;
        this.pendingFilePath = null;

        // Playback settings
        this.loopToggle = true;
        this.playbackVolume = 1.0;

        // Discord.js Voice components
        this.player = createAudioPlayer();
        this.connection = null;

        this.setupPlayerEvents();
    }

    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, async () => {
            this.log(`Player entered Idle state. Current track: ${this.activeFilePath}. Pending: ${this.pendingFilePath}`);
            this.playerStatus = AudioPlayerStatus.Idle;
            this.isPlaying = false;

            if (this.pendingFile) {
                this.log('Idle: Pending file found, playing it.');
                this._movePendingToActive();
                this._play();
            } else if (this.loopToggle && this.activeFile) {
                this.log(`Idle: Looping active file: ${this.activeFilePath}`);
                this._play();
            } else {
                this.log('Idle: No pending file and looping is off. Player remains idle.');
                this.activeFile = null;
                this.activeFilePath = null;
            }
        });

        this.player.on('error', error => {
            this.log(`Error in audio player for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
            this.activeFile = null;
            this.activeFilePath = null;
            this.playerStatus = AudioPlayerStatus.Idle;
        });

        this.player.on(AudioPlayerStatus.Playing, () => {
            this.playerStatus = AudioPlayerStatus.Playing;
            this.isPlaying = true;
        });

        this.player.on(AudioPlayerStatus.Paused, () => {
            this.playerStatus = AudioPlayerStatus.Paused;
            this.isPlaying = false;
        });
    }

    setConnection(connection) {
        this.connection = connection;
        this.connection.subscribe(this.player);
    }

    setVolume(volume) {
        if (volume >= 0 && volume <= 2) { // Allow up to 200% volume
            this.playbackVolume = volume;
            this.log(`Playback volume set to ${volume * 100}%`);
        }
    }

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    _movePendingToActive() {
        if (!this.pendingFile) {
            this.log('Attempted to move pending to active, but no pending file exists. Aborting.');
            return;
        }
        this.activeFile = this.pendingFile;
        this.activeFilePath = this.pendingFilePath;
        this.pendingFile = null;
        this.pendingFilePath = null;
        this.log(`Moved pending file to active: ${this.activeFilePath}`);
    }

    async cacheFile(filePath) {
        try {
            // const stats = fs.statSync(filePath);
            // const fileSizeInMB = stats.size / (1024 * 1024);
            // if (fileSizeInMB > 100) {
            //     this.log(`Error: File size exceeds 100MB limit: ${filePath}`);
            //     return false;
            // }

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
            return false;
        }
    }

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
            this.playerStatus = AudioPlayerStatus.Playing;
            this.isPlaying = true;
            this.log(`Playback started for: ${this.activeFilePath}`);
        } catch (error) {
            this.playerStatus = AudioPlayerStatus.Idle;
            this.isPlaying = false;
            this.log(`Error starting playback for ${this.activeFilePath}: ${error.message}`);
        }
    }

    async playFile(filePath = null) {
        if (filePath) {
            const cacheSuccess = await this.cacheFile(filePath);
            if (cacheSuccess) {
                this._movePendingToActive();
                this._play();
            } else {
                this.log(`Failed to cache ${filePath}, playing existing track if available.`);
                if (this.playerStatus === AudioPlayerStatus.Idle && this.activeFile) {
                    this._play();
                } else if (this.playerStatus === AudioPlayerStatus.Paused) {
                    this.player.unpause();
                }
            }
        } else { // No file path provided, treat as "play/resume"
            if (this.playerStatus === AudioPlayerStatus.Paused) {
                this.player.unpause();
                this.playerStatus = AudioPlayerStatus.Playing;
                this.isPlaying = true;
                this.log('Playback resumed.');
            } else if (this.playerStatus === AudioPlayerStatus.Idle && this.activeFile) {
                this.log('Playback starting from idle state.');
                this._play();
            } else {
                this.log('Play command received, but nothing to play or already playing.');
            }
        }
    }

    pause() {
        if (this.playerStatus === AudioPlayerStatus.Playing) {
            this.player.pause(true);
            this.playerStatus = AudioPlayerStatus.Paused;
            this.isPlaying = false;
            this.log(`Playback paused for: ${this.activeFilePath}`);

            if (this.pendingFile) {
                this.log('Pending file exists, swapping to active on pause.');
                this._movePendingToActive();
            }
        } else {
            this.log('Pause command received, but not currently playing.');
        }
    }
}

module.exports = BackendAudioPlayer;
