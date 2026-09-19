// Performance and security update
// Import necessary classes from @discordjs/voice for managing audio playback in Discord voice channels
const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
// Import filesystem module for basic file operations
const fs = require('fs');
// Import promise-based filesystem module for cleaner async/await usage
const fsp = require('fs').promises;
// Import path module to handle cross-platform file paths
const path = require('path');
// Import stream classes to handle audio data flow from FFmpeg to the mixer
const { Readable, PassThrough } = require('stream');
// Import EventEmitter to allow the player to notify the UI of state changes
const { EventEmitter } = require('events');
// Import spawn to execute FFmpeg processes for audio decoding
const { spawn } = require('child_process');
// Import the custom mixer that combines music and sound effects in a background thread
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

/**
 * BackendAudioPlayer manages the music playlist (stack), soundboard effects,
 * and the FFmpeg-to-Discord audio pipeline.
 */
class BackendAudioPlayer extends EventEmitter {
    /**
     * Initializes the player with configuration and sets up the audio mixer.
     */
    constructor(logCallback, shell, musicFolder, ffmpegBinFolder) {
        // Call parent EventEmitter constructor
        super();

        // --- Dependency Injection ---
        // Function to send log messages to the renderer process
        this.log = logCallback || console.log;
        // Electron shell for resolving Windows shortcuts (.lnk files)
        this.shell = shell;
        // Base directory for the music library
        this.musicFolder = musicFolder;
        // Directory containing ffmpeg and ffprobe executables
        this.ffmpegBinFolder = ffmpegBinFolder;

        // --- Core Playback State ---
        // Tracks the status of the Discord audio player (Idle, Playing, etc.)
        this.playerStatus = AudioPlayerStatus.Idle;
        // High-level flag to track if music is currently active
        this.isPlaying = false;
        // Prevents race conditions by locking the play() function during initialization
        this.playLock = false;

        // --- Music Playlist (Stack) System ---
        // Array of absolute file paths currently in the queue
        this.stack = [];
        // Pointer to the currently playing track in the stack
        this.currentIndex = -1;
        // Loop modes: 0: None (stops at end), 1: Loop All, 2: Loop Single track
        this.loopMode = 1;
        // Whether to pick the next track randomly
        this.shuffleMode = false;
        // History of played track indices to avoid repeating songs in shuffle mode
        this.playedIndices = [];

        // --- Timing and Progress Tracking ---
        // Elapsed playback time for the current track in seconds
        this.currentTime = 0;
        // Total length of the current track in seconds
        this.duration = 0;
        // Unique ID for each play instance to ignore stale duration/timer updates from previous tracks
        this.playCount = 0;
        // Interval for the 1-second UI progress timer
        this.timer = null;
        // Placeholder for potentially used caching intervals
        this.cacheInterval = null;
        // Tracks consecutive playback failures to avoid infinite error loops
        this.consecutiveErrors = 0;
        // Total cumulative playback failures encountered during session
        this.totalPlaybackFailures = 0;
        // Name of the most recent track that failed playback
        this.lastFailedTrack = null;
        // History of recovery attempts to detect rapid-fire crashing
        this.recoveryAttempts = [];

        // --- Volume and Mixing Configuration ---
        // Master volume for the music tracks
        this.playbackVolume = 1.0;
        // Master volume for the soundboard sound effects
        this.soundboardVolume = 0.5;
        // Whether soundboard music ducking is active
        this.duckingEnabled = true;
        // Volume multiplier for music when SFX are playing (ducking)
        this.duckingVolume = 0.3;
        // Ducking fade in/out duration in seconds
        this.duckingFadeDuration = 0.2;
        // Crossfading configurations
        this.crossfadeEnabled = false;
        this.crossfadeDuration = 2.0;
        // Counter for crossfading streams to manage unique mixer channel IDs
        this.fadeStreamCounter = 0;
        // Ducking fade interval reference
        this.duckingFadeInterval = null;
        // Current effective music duck multiplier (fades between 1.0 and duckingVolume)
        this.currentDuckMultiplier = 1.0;
        // Counter for currently playing sound effects to determine when to duck/unduck
        this.activeSfxCount = 0;

        // --- Audio Pipeline Initialization ---
        // Create the mixer instance that runs in a separate thread
        this.mixer = new ThreadedAudioMixer();
        // Handle mixer-level errors to prevent application crashes
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            this.log(`[AudioPlayer] Mixer Error: ${err.message}`);
        });

        // The mixerProxy connects the mixer's output to the Discord audio resource
        this.mixerProxy = null;
        // The resource that Discord's player actually consumes
        this.mixedResource = null;
        // The @discordjs/voice audio player instance
        this.player = null;
        // The active voice channel connection
        this.connection = null;

        // Setup the initial audio pipeline for Discord
        this._ensureDiscordPipeline();
        // Send initial state to the UI
        this._emitStatusUpdate();

        // Tracks active FFmpeg processes and their associated streams (e.g. 'music', 'sfx_0')
        this.activeStreams = new Map();
    }

    /**
     * Initializes or recovers the Discord audio pipeline.
     * Ensures that the mixer is piped to a proxy, which is then used as a Discord audio resource.
     */
    _ensureDiscordPipeline() {
        try {
            // Lazy initialization of the Discord AudioPlayer
            if (!this.player) {
                this.log('[AudioPlayer] Creating Discord AudioPlayer.');
                this.player = createAudioPlayer();
                this.setupPlayerEvents();
            }

            // If we have a voice connection, subscribe the player to it
            if (this.connection) {
                this.connection.subscribe(this.player);
            }

            // Create a PassThrough stream proxy for the mixer.
            // This allows us to keep the mixer alive even if the Discord resource is destroyed.
            if (!this.mixerProxy || this.mixerProxy.destroyed) {
                this.log('[AudioPlayer] Establishing mixer proxy.');
                if (this.mixerProxy) {
                    try { this.mixer.unpipe(this.mixerProxy); } catch (e) {}
                    try { this.mixerProxy.destroy(); } catch (e) {}
                }
                // Initialize the proxy and pipe the mixer into it
                this.mixerProxy = new PassThrough();
                this.mixer.pipe(this.mixerProxy);
                // Clear the resource as it needs recreation for the new proxy
                this.mixedResource = null;
            }

            // Create a new AudioResource if needed or if the player has gone idle
            if (!this.mixedResource || this.mixedResource.ended || this.player.state.status === AudioPlayerStatus.Idle) {
                const now = Date.now();
                // Filter out recovery attempts older than 10 seconds
                this.recoveryAttempts = this.recoveryAttempts.filter(t => now - t < 10000);
                this.recoveryAttempts.push(now);

                // Safety check: avoid infinite loops of resource recreation if something is fundamentally broken
                if (this.recoveryAttempts.length > 8) {
                    this.log('[AudioPlayer] CRITICAL: Rapid recovery loop detected. Stopping playback.');
                    this.stop();
                    return;
                }

                this.log('[AudioPlayer] Establishing audio pipeline resource.');
                // Create the Discord-compatible resource from our mixer proxy
                this.mixedResource = createAudioResource(this.mixerProxy, {
                    inputType: StreamType.Raw, // We are providing raw PCM from the mixer
                    inlineVolume: false // Volume is handled inside the mixer worker
                });
                // Command the player to start consuming the resource
                this.player.play(this.mixedResource);
            }
        } catch (e) {
            this.log(`[AudioPlayer] Error ensuring pipeline: ${e.message}`);
        }
    }

    /**
     * Emits a status-change event that the main process forwards to the renderer UI.
     * @param {boolean} isTimeUpdate - If true, omits heavy data like the full playlist stack.
     */
    _emitStatusUpdate(isTimeUpdate = false) {
        const status = {
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            playerStatus: this.playerStatus,
            currentTime: this.currentTime,
            duration: this.duration,
            isTimeUpdate: isTimeUpdate
        };

        // If this is a major state change (not just a timer tick), include the playlist info
        if (!isTimeUpdate) {
            // Helper to clean up absolute paths for display in the UI
            const getRelativePath = (filePath) => {
                if (!filePath || !this.musicFolder) return filePath;
                try {
                    return path.relative(this.musicFolder, filePath);
                } catch (e) {
                    return filePath;
                }
            };

            // Map the track stack to a UI-friendly object array
            status.stack = this.stack.map(p => ({
                path: p,
                name: path.basename(p),
                relativePath: getRelativePath(p)
            }));
            status.loopMode = this.loopMode;
            status.shuffleMode = this.shuffleMode;
        }

        // Notify listeners (the Electron main process) of the state change
        this.emit('status-change', status);
    }

    /**
     * Sets up event listeners for the @discordjs/voice AudioPlayer.
     */
    setupPlayerEvents() {
        // Triggered when a track finishes or the resource is exhausted
        this.player.on(AudioPlayerStatus.Idle, (oldState) => {
            this.log('[AudioPlayer] Mixer player went IDLE.');
            // If we are supposed to be playing, attempt to recover the pipeline
            if (this.isPlaying) {
                // Verify that the idle event is for the current resource, not a discarded one
                if (oldState.resource && oldState.resource !== this.mixedResource) {
                    this.log('[AudioPlayer] Idle event was for a stale resource. Ignoring.');
                    return;
                }
                // If the player stopped unexpectedly, try to restart the resource stream
                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    this.log('[AudioPlayer] Mixer unexpectedly idle, ensuring pipeline.');
                    this._ensureDiscordPipeline();
                }
            }
        });

        // Log any internal errors from the Discord audio player
        this.player.on('error', error => {
            this.log(`[AudioPlayer] Error in audio player (Mixer): ${error.message}`);
        });
    }

    /**
     * Sets the active Discord voice connection and subscribes the audio player to it.
     */
    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        // Connect the audio player's output to the voice channel's input
        this.connection.subscribe(this.player);
    }

    /**
     * Configures crossfading parameters.
     * @param {boolean} enabled - Whether crossfading is active.
     * @param {number} duration - Duration in seconds (0.1 to 60.0).
     */
    setCrossfadeConfig(enabled, duration) {
        this.crossfadeEnabled = !!enabled;
        this.crossfadeDuration = Math.max(0.1, Math.min(60.0, parseFloat(duration) || 2.0));
        this.log(`[AudioPlayer] Crossfade set to: enabled=${this.crossfadeEnabled}, duration=${this.crossfadeDuration}s`);
    }

    /**
     * Configures soundboard ducking parameters.
     * @param {boolean} enabled - Whether ducking is enabled.
     * @param {number} volume - Ducking multiplier (0.0 to 1.0).
     * @param {number} duration - Ducking fade duration in seconds (0.0 to 10.0).
     */
    setDuckingConfig(enabled, volume, duration) {
        this.duckingEnabled = !!enabled;
        this.duckingVolume = Math.max(0.0, Math.min(1.0, parseFloat(volume) ?? 0.3));
        this.duckingFadeDuration = Math.max(0.0, Math.min(10.0, parseFloat(duration) ?? 0.2));
        this.log(`[AudioPlayer] Ducking set to: enabled=${this.duckingEnabled}, volume=${this.duckingVolume}, fadeDuration=${this.duckingFadeDuration}s`);
    }

    /**
     * Updates the music playback volume and adjusts active music streams in the mixer.
     * @param {number} volume - Volume multiplier (0.0 to 2.0).
     */
    setVolume(volume) {
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            this.activeStreams.forEach((entry, id) => {
                if (id === 'music' || id.startsWith('music_fade_')) {
                    const effectiveVol = (entry.currentVolMultiplier ?? 1.0) * this.playbackVolume * this.currentDuckMultiplier;
                    this.mixer.setInputVolume(id, effectiveVol);
                }
            });
        }
    }

    /**
     * Changes the loop mode and notifies the UI.
     * @param {number} mode - 0: None, 1: Loop All, 2: Loop Single.
     */
    setLoopMode(mode) {
        this.loopMode = mode;
        this.log(`[AudioPlayer] Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    }

    /**
     * Toggles shuffle mode and resets the shuffle history.
     */
    setShuffle(enabled) {
        this.shuffleMode = enabled;
        // Reset the history so all songs are available to be picked
        this.playedIndices = [];
        this.log(`[AudioPlayer] Shuffle mode: ${enabled}`);
        this._emitStatusUpdate();
    }

    /**
     * Resolves a file path if it is a Windows shortcut (.lnk), returning the valid target path.
     * Returns original path if not a shortcut or if target resolution fails.
     * @param {string} filePath - Path to check and resolve.
     * @returns {string} Target path or original path.
     */
    resolveShortcutPath(filePath) {
        // Return immediately if invalid path supplied
        if (!filePath) return filePath;
        // Verify extension is .lnk and shell helper is available
        if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
            try {
                // Read metadata from Windows shortcut
                const shortcut = this.shell.readShortcutLink(filePath);
                // Return target if target exists on disk
                if (shortcut.target && fs.existsSync(shortcut.target)) {
                    return shortcut.target;
                }
            } catch (e) {
                // Log resolution error to visual console
                this.log(`[AudioPlayer] Failed to resolve shortcut: ${filePath}`);
            }
        }
        return filePath;
    }

    /**
     * Inserts a track immediately after the current playing track in the playlist stack,
     * resolving any shortcut link first.
     * @param {string} filePath - Path of track to insert.
     * @returns {string} Resolved track path added to stack.
     */
    insertNext(filePath) {
        // Resolve shortcut to target file
        const resolved = this.resolveShortcutPath(filePath);
        // Insert after active song index (inserts at index 0 if currentIndex is -1)
        this.stack.splice(this.currentIndex + 1, 0, resolved);
        // Broadcast playlist update to renderer and Discord
        this._emitStatusUpdate();
        return resolved;
    }

    /**
     * Adds one or more file paths to the playlist stack.
     * Automatically resolves Windows shortcuts (.lnk) to their targets.
     * @param {string|string[]} filePaths - The files to add.
     */
    async addToStack(filePaths) {
        // Normalize input to an array
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        for (let rawPath of paths) {
            // Resolve shortcut link to absolute target path
            const filePath = this.resolveShortcutPath(rawPath);
            // Add to stack only if it's not already present (prevent duplicates)
            if (!this.stack.includes(filePath)) {
                this.stack.push(filePath);
            }
        }
        // If the playlist was empty, point the index to the first added track
        if (this.currentIndex === -1 && this.stack.length > 0) {
            this.currentIndex = 0;
        }
        // Update UI with the new stack contents
        this._emitStatusUpdate();
    }

    /**
     * Removes a track from the stack by its index.
     */
    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            // Splice the item out of the array
            const removedPath = this.stack.splice(index, 1)[0];
            // If we just removed the currently playing track
            if (this.currentIndex === index) {
                // Kill the current stream
                this._stopMusicStream();
                // Move to a new track if the playlist isn't empty
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                    if (this.isPlaying) this._play();
                } else {
                    // Otherwise stop playback entirely
                    this.stop();
                }
            }
            // If we removed a track earlier in the list, shift the current index back
            else if (this.currentIndex > index) {
                this.currentIndex--;
            }
            // Refresh the UI
            this._emitStatusUpdate();
        }
    }

    /**
     * Reorders a track in the playlist stack from oldIndex to newIndex.
     * @param {number} oldIndex - Original position of the track.
     * @param {number} newIndex - Target position of the track.
     */
    reorderStack(oldIndex, newIndex) {
        if (oldIndex < 0 || oldIndex >= this.stack.length || newIndex < 0 || newIndex >= this.stack.length) {
            return;
        }
        if (oldIndex === newIndex) return;

        // Move track in stack array
        const [movedTrack] = this.stack.splice(oldIndex, 1);
        this.stack.splice(newIndex, 0, movedTrack);

        // Adjust active playing track index to maintain correct pointing
        if (this.currentIndex === oldIndex) {
            this.currentIndex = newIndex;
        } else if (this.currentIndex > oldIndex && this.currentIndex <= newIndex) {
            this.currentIndex--;
        } else if (this.currentIndex < oldIndex && this.currentIndex >= newIndex) {
            this.currentIndex++;
        }

        this.log(`[AudioPlayer] Reordered track from ${oldIndex} to ${newIndex}. Current index is now ${this.currentIndex}`);
        this._emitStatusUpdate();
    }

    /**
     * Clears the entire playlist and stops playback.
     */
    clearStack() {
        // Reset the mixer thread and buffers
        if (this.mixer) this.mixer.reset();
        // Stop current music process
        this._stopMusicStream();
        // Stop the UI timer
        this._stopTimer();
        // Reset all playlist-related state
        this.stack = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.consecutiveErrors = 0;
        // Refresh the UI
        this._emitStatusUpdate();
    }

    /**
     * Low-level method to start playback of the current track with optional crossfading or volume fade-in.
     * Spawns FFmpeg and pipes it into the mixer.
     * @param {number} [startTime=0] - The offset in seconds to start from.
     * @param {boolean} [isResume=false] - True if resuming from pause.
     */
    async _play(startTime = 0, isResume = false) {
        if (this.isDestroyed) return;
        if (this.playLock) return;
        this.playLock = true;
        this.playCount++;
        const currentPlayId = this.playCount;

        try {
            if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                } else {
                    this.stop();
                    return;
                }
            }

            const rawPath = this.stack[this.currentIndex];
            // Ensure shortcut is resolved if present in stack
            const filePath = this.resolveShortcutPath(rawPath);
            // Update stack entry with resolved target if shortcut was resolved
            if (filePath !== rawPath) {
                this.stack[this.currentIndex] = filePath;
            }

            // Verify file actually exists on disk before attempting spawn
            if (!fs.existsSync(filePath)) {
                this.log(`[AudioPlayer] File not found: ${filePath}`);
                this._handlePlaybackError(filePath);
                return;
            }

            this.log(`[AudioPlayer] Playing: ${path.basename(filePath)} from ${startTime}s (crossfade=${this.crossfadeEnabled})`);

            // Check if crossfading is applicable
            const oldMusic = this.activeStreams.get('music');
            const shouldCrossfade = this.crossfadeEnabled && oldMusic && oldMusic.process;

            if (shouldCrossfade) {
                // Determine safe crossfade duration (don't exceed track duration if known)
                let effectiveCrossfadeDur = this.crossfadeDuration;
                if (this.duration > 0 && effectiveCrossfadeDur > this.duration / 2) {
                    effectiveCrossfadeDur = Math.max(0.1, this.duration / 2);
                }

                // Move current active music stream to a unique fading ID
                const oldFadeId = `music_fade_${this.fadeStreamCounter++}`;
                this.activeStreams.delete('music');
                this.activeStreams.set(oldFadeId, oldMusic);

                // Dynamically reassign key in mixer by adding existing stream with new ID or renaming in worker
                this.mixer.addInput(oldMusic.stream, oldFadeId, (oldMusic.currentVolMultiplier ?? 1.0) * this.playbackVolume * this.currentDuckMultiplier);

                // Fade out old track
                this._fadeStream(oldFadeId, oldMusic.currentVolMultiplier ?? 1.0, 0.0, effectiveCrossfadeDur, () => {
                    this._stopStreamById(oldFadeId);
                });
            } else if (!isResume) {
                // If not crossfading or not resuming, stop old music stream cleanly
                this._stopMusicStream();
            }

            this._stopTimer();
            this.currentTime = startTime;
            this.isPlaying = true;

            if (startTime === 0) {
                this.duration = 0;
                this._ensureDiscordPipeline();
            }
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

            if (startTime === 0) {
                this._getDuration(filePath).then(duration => {
                    if (this.isPlaying && this.playCount === currentPlayId) {
                        this.duration = duration;
                        this._emitStatusUpdate();
                    }
                }).catch(err => this.log(`[AudioPlayer] Error fetching duration: ${err.message}`));
            }

            this.lastPlayStartTime = Date.now() - (startTime * 1000);

            const ffmpegProcess = this._createFfmpegStream(filePath, startTime);

            ffmpegProcess.on('error', (err) => {
                this.log(`[AudioPlayer] FFmpeg spawn error: ${err.message}`);
                this._handlePlaybackError(filePath);
            });

            ffmpegProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
                    this.log(`[AudioPlayer] FFmpeg Error: ${msg.trim()}`);
                }
            });

            const ffmpegOutput = ffmpegProcess.stdout;
            const mixerStream = new PassThrough();
            ffmpegOutput.pipe(mixerStream);

            mixerStream.once('end', () => {
                const currentMusic = this.activeStreams.get('music');
                if (currentMusic && currentMusic.stream === mixerStream) {
                    this.activeStreams.delete('music');
                    this.mixer.removeInput('music');

                    this._stopTimer();
                    this._emitStatusUpdate();
                    this._handleMusicFinish();
                }
            });

            // Start incoming stream at 0 volume if crossfading or resuming with fade, then fade up
            const initialVolMult = (this.crossfadeEnabled || (isResume && this.crossfadeEnabled)) ? 0.0 : 1.0;
            const streamEntry = { process: ffmpegProcess, stream: mixerStream, currentVolMultiplier: initialVolMult };

            this.activeStreams.set('music', streamEntry);
            this.mixer.addInput(mixerStream, 'music', initialVolMult * this.playbackVolume * this.currentDuckMultiplier);

            if (initialVolMult === 0.0) {
                let fadeUpDur = this.crossfadeDuration;
                if (this.duration > 0 && fadeUpDur > this.duration / 2) {
                    fadeUpDur = Math.max(0.1, this.duration / 2);
                }
                this._fadeStream('music', 0.0, 1.0, fadeUpDur);
            }

            this._startTimer();
            this.consecutiveErrors = 0;
            this.recoveryAttempts = [];

        } catch (error) {
            this.log(`[AudioPlayer] Error in _play: ${error.message}`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
        } finally {
            this.playLock = false;
        }
    }

    /**
     * Smoothly fades an active stream's volume multiplier from startVol to endVol over duration seconds.
     */
    _fadeStream(streamId, startVol, endVol, durationSec, onComplete) {
        const entry = this.activeStreams.get(streamId);
        if (!entry) {
            if (onComplete) onComplete();
            return;
        }

        if (entry.fadeInterval) clearInterval(entry.fadeInterval);

        const steps = Math.max(1, Math.floor(durationSec * 20)); // 20 updates per second (50ms interval)
        const stepTime = (durationSec * 1000) / steps;
        const delta = (endVol - startVol) / steps;
        let currentStep = 0;

        entry.currentVolMultiplier = startVol;

        entry.fadeInterval = setInterval(() => {
            currentStep++;
            entry.currentVolMultiplier = Math.max(0.0, Math.min(1.0, startVol + delta * currentStep));
            const effectiveVol = entry.currentVolMultiplier * this.playbackVolume * this.currentDuckMultiplier;
            this.mixer.setInputVolume(streamId, effectiveVol);

            if (currentStep >= steps) {
                clearInterval(entry.fadeInterval);
                entry.fadeInterval = null;
                entry.currentVolMultiplier = endVol;
                this.mixer.setInputVolume(streamId, endVol * this.playbackVolume * this.currentDuckMultiplier);
                if (onComplete) onComplete();
            }
        }, stepTime);
    }

    /**
     * Safely stops and removes a specific stream by its map ID.
     */
    _stopStreamById(id) {
        if (this.activeStreams.has(id)) {
            const entry = this.activeStreams.get(id);
            if (entry.fadeInterval) clearInterval(entry.fadeInterval);
            this.mixer.removeInput(id);
            if (entry.process) {
                try {
                    entry.process.stdout.unpipe();
                    entry.process.kill('SIGKILL');
                } catch (e) {}
            }
            if (entry.stream && entry.stream.end) {
                try { entry.stream.end(); } catch (e) {}
            }
            this.activeStreams.delete(id);
        }
    }

    /**
     * Handles fatal playback errors by retrying or skipping the track.
     * Tracks failure statistics for Discord embed error field updates.
     * @param {string} filePath - The file that failed to play.
     */
    _handlePlaybackError(filePath) {
        // Increment consecutive error counter for circuit breaking
        this.consecutiveErrors++;
        // Increment total failure count and record last failed filename
        this.totalPlaybackFailures++;
        if (filePath) {
            this.lastFailedTrack = path.basename(filePath);
        }
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        this._stopTimer();
        this._emitStatusUpdate();

        // If we hit 10 errors in a row, give up to prevent infinite CPU usage
        if (this.consecutiveErrors > 10) {
            this.log("[AudioPlayer] CRITICAL: Too many consecutive errors, stopping.");
            this.stop();
            return;
        }

        // If a track fails 3 times, assume it's corrupt and skip it
        if (this.consecutiveErrors % 3 === 0) {
            this.log("[AudioPlayer] Persistent error on current track, skipping.");
            // 1-second delay before skipping
            setTimeout(() => this.next(false), 1000);
        } else {
            // Otherwise, attempt a retry
            this.log("[AudioPlayer] Playback error, retrying/skipping...");
            setTimeout(() => this.next(true), 1000);
        }
    }

    /**
     * Resolves the path to the ffmpeg executable.
     */
    _getFfmpegPath() {
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            // If the folder is actually a direct path to the file, return it
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                return this.ffmpegBinFolder;
            }
            const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
            const fullPath = path.join(this.ffmpegBinFolder, exeName);
            // Return full path if found in the specified folder
            if (fs.existsSync(fullPath)) return fullPath;
        } catch (e) {}
        // Fallback to global system PATH
        return 'ffmpeg';
    }

    /**
     * Resolves the path to the ffprobe executable.
     */
    _getFfprobePath() {
        if (!this.ffmpegBinFolder) return 'ffprobe';
        try {
            // Look for ffprobe in the same directory as ffmpeg
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
        // Fallback to global system PATH
        return 'ffprobe';
    }

    /**
     * Spawns an FFmpeg process to stream audio as raw 16-bit PCM.
     * @param {string} filePath - Path to the audio file.
     * @param {number} [startTime=0] - Offset to start from.
     * @returns {ChildProcess} The spawned FFmpeg process.
     */
    _createFfmpegStream(filePath, startTime = 0) {
        const ffmpegPath = this._getFfmpegPath();
        const args = [];
        // Use -ss BEFORE -i for faster seeking
        if (startTime > 0) {
            args.push('-ss', startTime.toString());
        }
        // -re: Read at native frame rate (important to prevent overrunning the mixer buffer)
        // -f s16le: Output raw 16-bit little-endian PCM
        // -ar 48000: Set sample rate to 48kHz (Discord standard)
        // -ac 2: Stereo output
        args.push('-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
        return spawn(ffmpegPath, args);
    }

    /**
     * Uses ffprobe to determine the duration of an audio file in seconds.
     * @param {string} filePath - Path to the file.
     * @returns {Promise<number>} The duration in seconds.
     */
    _getDuration(filePath) {
        return new Promise((resolve, reject) => {
            let targetPath = filePath;
            // Resolve shortcuts before probing
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) targetPath = shortcut.target;
                } catch (e) {}
            }

            const ffprobePath = this._getFfprobePath();
            const { exec } = require('child_process');
            // Execute ffprobe and request only the duration value
            const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetPath}"`;

            exec(cmd, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const duration = parseFloat(stdout.trim());
                // Return 0 if the value is invalid
                resolve(isNaN(duration) ? 0 : duration);
            });
        });
    }

    /**
     * Starts the interval timer that updates the currentTime and UI every second.
     * Triggers natural crossfading before track completion when enabled.
     */
    _startTimer() {
        // Clear any existing timer first
        this._stopTimer();
        this.isCrossfadingAtEnd = false;

        this.timer = setInterval(() => {
            if (this.isPlaying) {
                // Calculate elapsed time based on real-world clock to avoid drift
                this.currentTime = (Date.now() - (this.lastPlayStartTime || 0)) / 1000;
                // Cap progress at the duration of the track
                if (this.duration > 0 && this.currentTime > this.duration) {
                    this.currentTime = this.duration;
                }

                // Check if we should initiate crossfading before track end (only when changing tracks, not on Loop Single)
                if (this.crossfadeEnabled && this.duration > 0 && !this.isCrossfadingAtEnd && this.loopMode !== 2) {
                    let fadeDur = this.crossfadeDuration;
                    if (fadeDur > this.duration / 2) fadeDur = Math.max(0.1, this.duration / 2);

                    if (this.currentTime >= this.duration - fadeDur) {
                        this.isCrossfadingAtEnd = true;
                        this.log(`[AudioPlayer] Triggering automatic crossfade at ${this.currentTime.toFixed(1)}s / ${this.duration.toFixed(1)}s`);
                        this.next(false, true);
                        return;
                    }
                }

                // Send time update to the UI
                this._emitStatusUpdate(true);
            }
        }, 1000);
    }

    /**
     * Stops and clears the UI update timer.
     */
    _stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Stops the FFmpeg music process and removes it from the mixer.
     */
    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const entry = this.activeStreams.get('music');
            // Remove from mixer first to stop sound immediately
            if (this.mixer) this.mixer.removeInput('music');
            // Kill the FFmpeg process
            if (entry.process) {
                try {
                    // Detach from stdout to avoid pipe errors during shutdown
                    entry.process.stdout.unpipe();
                    // Force kill the process
                    entry.process.kill('SIGKILL');
                } catch (e) {}
            }
            // End the internal stream if it exists
            if (entry.stream && entry.stream.end) {
                entry.stream.end();
            }
            this.activeStreams.delete('music');
        }
    }

    /**
     * Internal handler triggered when a track finishes naturally.
     * Manages looping and advancing to the next song.
     */
    _handleMusicFinish() {
        // Calculate how much time actually passed compared to expected duration
        const elapsed = Date.now() - (this.lastPlayStartTime || 0);
        this.log(`[AudioPlayer] _handleMusicFinish: elapsed=${elapsed}ms, duration=${this.duration}s, loopMode=${this.loopMode}`);

        // Safeguard: If a track with known duration > 2s finishes in < 1s, it likely crashed.
        // This prevents rapid-fire skipping through a broken library.
        if (elapsed < 1000 && (this.duration === 0 || this.duration > 2)) {
            this.log(`[AudioPlayer] Track finished too quickly (${elapsed}ms), considering it an error.`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
            return;
        }

        // Helper to restart playback with a tiny delay to prevent thrashing if track duration was very short
        const playWithDelay = () => {
            if (elapsed < 500) {
                this.log("[AudioPlayer] Rapid loop detected, delaying restart by 200ms.");
                setTimeout(() => this._play(0), 200);
            } else {
                this._play(0);
            }
        };

        // Logic based on loop mode
        if (this.loopMode === 2) {
            // Loop Single: Just restart the current track immediately for tight seamless looping
            this.log("[AudioPlayer] Loop Single: Restarting current track.");
            playWithDelay();
        } else if (this.loopMode === 1) {
            // Loop All: Move the finished track to the bottom and play the next one
            this.log("[AudioPlayer] Loop All: Rolling current track to bottom.");
            const finished = this.stack.shift();
            if (finished) this.stack.push(finished);
            this.currentIndex = 0;
            playWithDelay();
        } else {
            // No Loop: Remove the finished track and play the next if one exists
            this.log("[AudioPlayer] Loop None: Rolling current track off.");
            this.stack.shift();
            if (this.stack.length > 0) {
                this.currentIndex = 0;
                this._play(0);
            } else {
                this.log("[AudioPlayer] Playlist finished and loop is OFF.");
                this.stop();
            }
        }
    }

    /**
     * Advances to the next track in the playlist.
     * @param {boolean} [isError=false] - Whether this skip was triggered by an error.
     * @param {boolean} [forcePlay=false] - If true, starts playback even if currently paused.
     */
    next(isError = false, forcePlay = false) {
        // Determine if we should start playing after skipping
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] next(isError=${isError}, forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}, shuffle=${this.shuffleMode}`);

        // Stop if nothing to play
        if (this.stack.length === 0) return;

        // Shuffle logic: pick a random index that hasn't been played recently
        if (this.shuffleMode) {
            this.playedIndices.push(this.currentIndex);
            // Reset history if we've cycled through everyone
            if (this.playedIndices.length >= this.stack.length) this.playedIndices = [];
            let nextIndex;
            do {
                nextIndex = Math.floor(Math.random() * this.stack.length);
            } while (this.playedIndices.includes(nextIndex) && this.stack.length > 1);
            this.currentIndex = nextIndex;
            this.log(`[AudioPlayer] Shuffle chose index ${this.currentIndex}`);
        } else {
            // Normal skip logic
            if (this.loopMode === 2 && isError) {
                // If looping single track and it errored, just retry the same track
                this.log("[AudioPlayer] next(): Loop Single + Error, restarting same track.");
                this.currentIndex = 0;
            } else if (this.loopMode === 1 || this.loopMode === 2) {
                // If looping is on, move the current track to the end of the stack
                this.log("[AudioPlayer] next(): Moving current track to bottom.");
                const current = this.stack.shift();
                if (current) this.stack.push(current);
                this.currentIndex = 0;
            } else {
                // If looping is off, discard the current track
                this.log("[AudioPlayer] next(): Rolling current track off.");
                this.stack.shift();
                if (this.stack.length === 0) {
                    this.stop();
                    return;
                }
                this.currentIndex = 0;
            }
        }

        // Trigger playback or update UI state
        if (wasPlaying || isError) {
            this._play();
        } else {
            this.currentTime = 0;
            this._emitStatusUpdate();
        }
    }

    /**
     * Jumps to a specific index in the playlist stack.
     * @param {number} index - The target index.
     * @param {boolean} [forcePlay=false] - Whether to start playback immediately.
     */
    jumpTo(index, forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] jumpTo(${index}, forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}`);

        if (index >= 0 && index < this.stack.length) {
            // Remove everything before the target index
            const preceding = this.stack.splice(0, index);
            // If looping is on, put the skipped tracks at the end of the stack
            if (this.loopMode === 1 || this.loopMode === 2) {
                this.log(`[AudioPlayer] jumpTo: Moving ${preceding.length} preceding tracks to bottom.`);
                this.stack.push(...preceding);
            } else {
                this.log(`[AudioPlayer] jumpTo: Discarding ${preceding.length} preceding tracks.`);
            }
            // Pointer is now at the new top of the stack
            this.currentIndex = 0;
            this.playLock = false;

            if (wasPlaying) {
                this._play();
            } else {
                this.currentTime = 0;
                this._emitStatusUpdate();
            }
        }
    }

    /**
     * Goes back to the previous track (or the last track in the stack if looping).
     */
    prev(forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] prev(forcePlay=${forcePlay}) called. wasPlaying=${wasPlaying}, stackSize=${this.stack.length}, loopMode=${this.loopMode}`);

        if (this.stack.length === 0) return;

        // In a roll-off system, 'prev' means taking the last track and putting it at the top
        if (this.loopMode === 1 || this.loopMode === 2) {
            this.log("[AudioPlayer] prev(): Moving last track to top.");
            const last = this.stack.pop();
            if (last) this.stack.unshift(last);
            this.currentIndex = 0;
        } else {
            // Otherwise just restart the current track
            this.log("[AudioPlayer] prev(): Restarting current track (no loop).");
            this.currentIndex = 0;
        }

        if (wasPlaying) {
            this._play();
        } else {
            this.currentTime = 0;
            this._emitStatusUpdate();
        }
    }

    /**
     * Main public play command. Resumes from pause or starts the playlist.
     */
    play() {
        if (this.isPlaying) return;
        this.playLock = false;
        // If paused midway through a track, resume from that point
        if (this.playerStatus === AudioPlayerStatus.Paused && this.currentIndex >= 0) {
            this._play(this.currentTime, true);
            return;
        }
        // Initialize index if needed
        if (this.currentIndex < 0 && this.stack.length > 0) this.currentIndex = 0;
        // Start playback
        if (this.currentIndex >= 0) this._play(0, false);
    }

    /**
     * Seeks to a specific timestamp in the current track.
     */
    seek(time) {
        if (this.currentIndex >= 0 && this.stack.length > 0) {
            this.log(`[AudioPlayer] Seeking to ${time}s`);
            this._play(time);
        }
    }

    /**
     * Pauses playback by fading out active music stream if crossfading is enabled.
     */
    pause() {
        const musicEntry = this.activeStreams.get('music');
        if (this.crossfadeEnabled && musicEntry) {
            let fadeOutDur = this.crossfadeDuration;
            if (this.duration > 0 && fadeOutDur > this.duration / 2) {
                fadeOutDur = Math.max(0.1, this.duration / 2);
            }
            this._fadeStream('music', musicEntry.currentVolMultiplier ?? 1.0, 0.0, fadeOutDur, () => {
                this._stopMusicStream();
            });
        } else {
            this._stopMusicStream();
        }

        this._stopTimer();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    }

    /**
     * Stops all playback and resets session-level state.
     */
    stop() {
        this._stopMusicStream();
        this._stopTimer();
        this.isPlaying = false;
        this.currentIndex = -1;
        this.currentTime = 0;
        this.duration = 0;
        this.consecutiveErrors = 0;
        this.recoveryAttempts = [];
        this.playerStatus = AudioPlayerStatus.Idle;
        this._emitStatusUpdate();
    }

    // --- Soundboard API ---

    /**
     * Plays a sound effect in a specific soundboard slot.
     * SFX are mixed on top of the music.
     * @param {string} filePath - Path to the sound file.
     * @param {number} slotId - Slot identifier for UI state management.
     */
    playSound(filePath, slotId) {
        this.log(`[AudioPlayer] Soundboard: Playing slot ${slotId}`);
        const id = `sfx_${slotId}`;
        // Ensure only one sound plays per slot at a time
        this.stopSound(slotId);

        const startSfx = () => {
            try {
                // Spawn FFmpeg to stream the SFX
                const ffmpegProcess = this._createFfmpegStream(filePath);
                const stream = ffmpegProcess.stdout;

                this.activeSfxCount++;

                // Clean up when the SFX finishes
                stream.once('close', () => {
                    if (this.activeStreams.has(id)) {
                        this.activeStreams.delete(id);
                        this.mixer.removeInput(id);
                        // Notify UI that the slot is now free
                        this.emit('sound-finished', slotId);
                        this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                        // Restore music volume if all SFX have finished
                        if (this.activeSfxCount === 0) {
                            this._fadeDuckingMultiplier(this.currentDuckMultiplier, 1.0, this.duckingFadeDuration);
                        }
                    }
                });

                // Add the SFX stream to the mixer
                this.mixer.addInput(stream, id, this.soundboardVolume);
                this.activeStreams.set(id, { process: ffmpegProcess, stream });
            } catch (error) {
                this.log(`[AudioPlayer] SFX Error: ${error.message}`);
            }
        };

        // If ducking is enabled, music is playing, and fade duration > 0, fade music down FIRST before starting SFX
        if (this.duckingEnabled && this.activeSfxCount === 0 && this.duckingFadeDuration > 0 && this.isPlaying) {
            this._fadeDuckingMultiplier(this.currentDuckMultiplier, this.duckingVolume, this.duckingFadeDuration, () => {
                startSfx();
            });
        } else {
            if (this.duckingEnabled && this.activeSfxCount === 0) {
                this._fadeDuckingMultiplier(1.0, this.duckingVolume, 0);
            }
            startSfx();
        }
    }

    /**
     * Smoothly fades the music ducking multiplier from startVal to endVol over durationSec.
     */
    _fadeDuckingMultiplier(startVal, endVal, durationSec, onComplete) {
        if (this.duckingFadeInterval) clearInterval(this.duckingFadeInterval);

        if (durationSec <= 0) {
            this.currentDuckMultiplier = endVal;
            this.setVolume(this.playbackVolume);
            if (onComplete) onComplete();
            return;
        }

        const steps = Math.max(1, Math.floor(durationSec * 20));
        const stepTime = (durationSec * 1000) / steps;
        const delta = (endVal - startVal) / steps;
        let currentStep = 0;

        this.duckingFadeInterval = setInterval(() => {
            currentStep++;
            this.currentDuckMultiplier = Math.max(0.0, Math.min(1.0, startVal + delta * currentStep));
            this.setVolume(this.playbackVolume);

            if (currentStep >= steps) {
                clearInterval(this.duckingFadeInterval);
                this.duckingFadeInterval = null;
                this.currentDuckMultiplier = endVal;
                this.setVolume(this.playbackVolume);
                if (onComplete) onComplete();
            }
        }, stepTime);
    }

    /**
     * Stops a soundboard slot.
     */
    stopSound(slotId) {
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            const { process } = this.activeStreams.get(id);
            // Remove from mixer
            this.mixer.removeInput(id);
            // Kill FFmpeg process
            if (process) process.kill();
            this.activeStreams.delete(id);
            // Adjust ducking counter
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0) {
                this._fadeDuckingMultiplier(this.currentDuckMultiplier, 1.0, this.duckingFadeDuration);
            }
        }
    }

    /**
     * Updates the volume for all active and future soundboard effects.
     */
    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        // Update volume for currently playing SFX in the mixer thread
        this.activeStreams.forEach((value, id) => {
            if (id.startsWith('sfx_')) this.mixer.setInputVolume(id, volume);
        });
    }

    /**
     * Scans the default music folder asynchronously for all compatible audio files.
     * @returns {Promise<string[]>} List of absolute file paths.
     */
    async getMusicFiles() {
        if (!this.musicFolder || !fs.existsSync(this.musicFolder)) return [];

        const getAllFilesAsync = async (dir, results = []) => {
            try {
                const entries = await fsp.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await getAllFilesAsync(fullPath, results);
                    } else {
                        const ext = path.extname(fullPath).toLowerCase();
                        if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) {
                            results.push(fullPath);
                        }
                    }
                }
            } catch (e) {
                this.log(`[AudioPlayer] Error scanning directory ${dir}: ${e.message}`);
            }
            return results;
        };

        return await getAllFilesAsync(this.musicFolder);
    }

    /**
     * Returns the file path of the current track or the top of the stack.
     * Used for previewing audio in the UI.
     */
    getPreviewFilePath() {
        if (this.currentIndex >= 0 && this.currentIndex < this.stack.length) {
            return this.stack[this.currentIndex];
        } else if (this.stack.length > 0) {
            return this.stack[0];
        }
        return null;
    }

    /**
     * Completely destroys the player, killing all processes and the mixer thread.
     */
    destroy() {
        this.isDestroyed = true;
        // Stop the Discord player
        if (this.player) this.player.stop();
        // Kill all active FFmpeg processes
        this.activeStreams.forEach(({ process }) => {
            try { if (process) process.kill(); } catch (e) {}
        });
        this.activeStreams.clear();
        // Terminate the mixer worker thread
        if (this.mixer) this.mixer.destroy();
    }
}

// Export the class for use in main.js
module.exports = BackendAudioPlayer;
