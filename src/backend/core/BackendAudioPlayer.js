const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

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
        this.isCaching = false;
        this.activeFilePath = null;
        this.pendingFilePath = null; // New state for the pending file path
        this.promoteAndPause = false; // Flag to promote a track without playing it
        this.loopToggle = true;
        this.playNextMode = false; // Flag to play pending track after current one finishes
        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3; // Volume multiplier for music when SFX is playing
        this.activeSfxCount = 0; // Number of SFX currently playing

        // Audio Pipelines
        this.mixer = new ThreadedAudioMixer();
        // We play the mixer stream continuously.
        this.mixedResource = createAudioResource(this.mixer, {
            inputType: StreamType.Raw,
            inlineVolume: false // Volume handled at mixer input level or globally? 
            // construct AudioMixer produces 48kHz 16bit Stereo Signed Little Endian PCM
        });

        // Discord.js Voice components
        this.player = createAudioPlayer();
        this.connection = null;

        // Start playing the mixer immediately (it outputs silence when empty)
        this.player.play(this.mixedResource);

        this.setupPlayerEvents();
        this._emitStatusUpdate(); // Emit initial state

        // Keep track of sound processes to kill them if needed
        this.activeStreams = new Map(); // id -> { process, stream }
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
            playNextMode: this.playNextMode
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
            // Apply volume immediately, respecting ducking state
            if (this.activeStreams.has('music')) {
                const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
                this.mixer.setInputVolume('music', currentVolume);
            }
        }
    }

    toggleLoop() {
        this.loopToggle = !this.loopToggle;
        this.log(`Looping is now ${this.loopToggle ? 'ON' : 'OFF'}`);
    }

    setPlayNext(enabled) {
        this.playNextMode = enabled;
        this.log(`Play Next mode is now ${enabled ? 'ON' : 'OFF'}`);
        this._emitStatusUpdate();
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

    _createFfmpegStream(filePath) {
        if (!this.ffmpegPath) {
            throw new Error("FFmpeg path not configured. Please set it in the settings.");
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

        ffmpeg.on('error', (err) => {
            this.log(`Failed to start FFmpeg process at ${this.ffmpegPath}: ${err.message}`);
        });

        ffmpeg.stderr.on('data', (data) => {
            console.error(`ffmpeg stderr: ${data}`);
        });

        return ffmpeg;
    }

    async _play() {
        if (!this.activeFilePath) {
            this.log("Play called but no active file path.");
            return;
        }

        this.log(`Starting playback pipeline for: ${this.activeFilePath}`);
        this.lastPlayStartTime = Date.now(); // Track start time

        // Stop existing music stream if any
        this._stopMusicStream();

        try {
            const ffmpegProcess = this._createFfmpegStream(this.activeFilePath);
            const stream = ffmpegProcess.stdout;

            // Handle stream events
            stream.once('close', () => {
                // Identity Check: Only handle finish if this stream is still the active 'music' stream
                const currentMusic = this.activeStreams.get('music');
                if (currentMusic && currentMusic.stream === stream) {
                    this.log(`Music stream for ${this.activeFilePath} closed naturally.`);
                    // We must remove it from activeStreams so we don't try to kill it later
                    this.activeStreams.delete('music');
                    this.mixer.removeInput('music'); // Ensure mixer clean up
                    this._handleMusicFinish();
                } else {
                    this.log(`Music stream for ${this.activeFilePath} closed (Cleanup/Replaced). Ignoring.`);
                }
            });

            // Add to mixer with ID 'music'
            this.mixer.addInput(stream, 'music');
            this.activeStreams.set('music', { process: ffmpegProcess, stream });

            this.isPlaying = true;
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

        } catch (error) {
            this.log(`Error starting FFmpeg playback for ${this.activeFilePath}: ${error.message}`);
            this.isPlaying = false;
            this.playerStatus = AudioPlayerStatus.Idle;
            this._emitStatusUpdate();
        }
    }

    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const { process, stream } = this.activeStreams.get('music');
            this.mixer.removeInput('music'); // Remove from mixer
            process.kill(); // Kill ffmpeg process
            this.activeStreams.delete('music');
        }
    }

    _handleMusicFinish() {
        const duration = Date.now() - (this.lastPlayStartTime || 0);

        if (this.playNextMode && this.pendingFilePath) {
            this.log(`Play Next: Finishing current track and starting: ${this.pendingFilePath}`);
            this.playNextMode = false;
            this._movePendingToActive();
            this._play();
            return;
        }

        if (this.loopToggle && this.activeFilePath) {
            if (duration < 2000) {
                this.log(`ERR: File ${this.activeFilePath} finished too quickly (${duration}ms). Disabling loop to prevent thrashing.`);
                this.isPlaying = false;
                this.playerStatus = AudioPlayerStatus.Idle;
                this._emitStatusUpdate();
                return;
            }

            this.log(`Looping active file: ${this.activeFilePath}`);
            // Small delay to prevent tight loops on errors
            setTimeout(() => this._play(), 100);
        } else {
            this.log('Music finished. Remaining idle.');
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

            // Handle Ducking Start
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.log('Soundboard: Ducking music volume.');
                this.mixer.setInputVolume('music', this.playbackVolume * this.duckingVolume);
            }
            this.activeSfxCount++;

            stream.once('close', () => {
                // If the stream is still in activeStreams, it finished naturally (not stopped manually)
                if (this.activeStreams.has(id)) {
                    this.log(`Soundboard: Stream ${id} finished naturally.`);
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    this.emit('sound-finished', slotId);

                    // Handle Ducking End
                    this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                    if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                        this.log('Soundboard: Restoring music volume.');
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
            process.kill();
            this.activeStreams.delete(id);
            this.log(`Soundboard: Stopped slot ${slotId}`);

            // Handle Ducking End (Manual Stop)
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.log('Soundboard: Restoring music volume (Manual Stop).');
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


    // --- Public API ---

    async loadFile(filePath) {
        await this._cacheFileToPending(filePath);

        // If a file is loaded while paused (or rather, playing but paused logic), 
        // we want to promote it immediately but not play it.
        if (this.playerStatus === AudioPlayerStatus.Paused && this.pendingFilePath) {
            this.log('File loaded while paused. Promoting to active and remaining paused.');
            this.promoteAndPause = true;
            this._stopMusicStream();
            // We need to manually trigger the "idle" logic? 
            // Or just do the swap manually here since we are controlling the stream directly now.
            this._movePendingToActive();
            // Don't play yet
        }

        this._emitStatusUpdate(); // Ensure UI is updated with new pending file
    }

    play() {
        // Scenario 1: Paused with pending track -> swap and play
        if (this.playerStatus === AudioPlayerStatus.Paused && this.pendingFilePath) {
            this.log('Play command received while paused with a pending track. Swapping and playing.');
            this._stopMusicStream();
            this._movePendingToActive();
            this._play();
            return;
        }

        // Scenario 2: Paused, no new track -> resume
        if (this.playerStatus === AudioPlayerStatus.Paused) {
            // For the mixer, "Paused" is tricky. We are streaming silence if "Paused".
            // But emulating the state: behavior is just starting the music stream again?
            // Or did we actually pause the discord player?
            // Since we share the player with SFX, we can't pause the player.
            // We must stop the music INPUT to the mixer to pause music, technically?
            // But if we stopped it, we lost position. 
            // FFmpeg doesn't support seeking easily without re-decoding.
            // For now, "Pause" will likely act as "Stop" for the music stream unless we keep the process alive but buffer?
            // Emulating full pause with shared mixer is hard without complex buffering.
            // **Simplification**: Pause = Stop Music (Save position? No, just restart for now, or use ffmpeg -ss if we tracked time).
            // Let's implement Pause as "Suspend Music Input".
            // Actually, the previous implementation Emulated pause by pausing the player.

            // If we pause the Discord Player, we pause ALL mixing outcomes (SFX too).
            // If the goal is premixing, maybe we WANT to pause music but let SFX play?
            // The user request said "premixing audio" for soundboard.
            // If I pause the music, I probably still want Soundboard to work?
            // If so, I cannot use `player.pause()`.
            // I have to stop reading from the music stream or mute it.

            // Let's assume for MVP: Play/Pause controls the MUSIC track.
            if (this.activeFilePath) {
                this._play(); // Restarting from beginning for now implies "Stop/Start" behavior more than Pause/Resume
                // Ideally we track timestamp.
            }
            return;
        }

        // Scenario 3: Idle
        if (this.playerStatus === AudioPlayerStatus.Idle) {
            if (this.pendingFilePath) {
                this.log('No active file, promoting pending file.');
                this._movePendingToActive();
            }
            if (this.activeFilePath) {
                this.log('Playback starting from idle state.');
                this._play();
            }
            return;
        }
    }

    pause() {
        this.log("Pause requested. Stopping music stream (Resume not fully implemented, restarts track).");
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
