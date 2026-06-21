// Performance and security update
const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { Readable, PassThrough } = require('stream');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

/**
 * Manages audio playback for music and soundboard effects.
 * Handles FFmpeg streaming, Discord voice integration, and playlist management.
 */
class BackendAudioPlayer extends EventEmitter {
    /**
     * Initializes the audio player with necessary dependencies.
     * @param {function} logCallback - Function for logging messages.
     * @param {object} shell - Electron shell object for handling shortcuts.
     * @param {string} musicFolder - Root directory for music files.
     * @param {string} ffmpegBinFolder - Directory containing FFmpeg binaries.
     */
    constructor(logCallback, shell, musicFolder, ffmpegBinFolder) {
        super();
        // TavernTones pipes log messages back to the Electron renderer via this callback.
        this.log = logCallback || console.log;
        this.shell = shell;

        // Base directories for audio assets and FFmpeg/ffprobe binaries.
        this.musicFolder = musicFolder;
        this.ffmpegBinFolder = ffmpegBinFolder;

        // The playerStatus tracks the Discord player state (Playing, Paused, Idle).
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isPlaying = false;

        // playLock is a critical semaphore to prevent race conditions during rapid track skipping.
        this.playLock = false;

        // TavernTones uses a "roll-off" stack where the top track is the current one.
        this.stack = [];
        this.currentIndex = -1;
        // 0: None, 1: Loop All, 2: Loop 1
        this.loopMode = 1;
        this.shuffleMode = false;
        // Track history for shuffle mode
        this.playedIndices = [];

        // Playback progress tracking
        this.currentTime = 0; // Current time in seconds
        this.duration = 0; // Total track duration
        // Correlation ID for duration updates
        this.playCount = 0;
        this.timer = null;

        // Error handling and recovery state
        this.consecutiveErrors = 0;
        this.recoveryAttempts = [];

        // Volume configuration
        this.playbackVolume = 1.0;
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        this.activeSfxCount = 0;

        // Initialize the audio mixer
        this.mixer = new ThreadedAudioMixer();
        // Handle mixer errors, ignoring expected stream closures
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            this.log(`[AudioPlayer] Mixer Error: ${err.message}`);
        });

        // Initialize Discord-specific audio components
        this.mixerProxy = null;
        this.mixedResource = null;
        this.player = null;
        this.connection = null;

        // Build the initial audio pipeline
        this._ensureDiscordPipeline();
        // Broadcast initial status
        this._emitStatusUpdate();

        // Track all active audio streams (music and SFX)
        this.activeStreams = new Map(); // id -> { process, stream }
    }

    /**
     * Ensures the Discord audio player and resource pipeline are correctly initialized.
     * Handles creation and reconnection of the audio stream.
     * @private
     */
    /**
     * Lazy-initializes and monitors the audio connection between the mixer and Discord.
     * It uses a PassThrough proxy to prevent the Discord AudioResource from closing
     * the long-lived ThreadedAudioMixer during track transitions.
     */
    _ensureDiscordPipeline() {
        try {
            if (!this.player) {
                this.player = createAudioPlayer();
                this.setupPlayerEvents();
            }

            // Link the player to the voice connection if one is active.
            if (this.connection) {
                this.connection.subscribe(this.player);
            }

            // We pipe the mixer into a short-lived PassThrough stream. This "proxy"
            // allows us to tear down Discord resources without killing our audio mixer.
            if (!this.mixerProxy || this.mixerProxy.destroyed) {
                if (this.mixerProxy) {
                    try { this.mixer.unpipe(this.mixerProxy); } catch (e) {}
                    try { this.mixerProxy.destroy(); } catch (e) {}
                }
                this.mixerProxy = new PassThrough();
                this.mixer.pipe(this.mixerProxy);
                this.mixedResource = null;
            }

            // If the resource has ended or the player stalled, we re-create the resource
            // to kickstart the stream. A recovery limit prevents infinite crash loops.
            if (!this.mixedResource || this.mixedResource.ended || this.player.state.status === AudioPlayerStatus.Idle) {
                const now = Date.now();
                this.recoveryAttempts = this.recoveryAttempts.filter(t => now - t < 10000);
                this.recoveryAttempts.push(now);

                if (this.recoveryAttempts.length > 8) {
                    this.log('[AudioPlayer] CRITICAL: Rapid recovery loop detected. Stopping playback.');
                    this.stop();
                    return;
                }

                // Discord expects 48kHz Stereo Raw PCM for optimized performance.
                this.mixedResource = createAudioResource(this.mixerProxy, {
                    inputType: StreamType.Raw,
                    inlineVolume: false
                });
                this.player.play(this.mixedResource);
            }
        } catch (e) {
            this.log(`[AudioPlayer] Error ensuring pipeline: ${e.message}`);
        }
    }

    /**
     * Emits a status update event for the UI and Discord media controls.
     * @param {boolean} [isTimeUpdate=false] - Whether this is a frequent progress update.
     * @private
     */
    _emitStatusUpdate(isTimeUpdate = false) {
        // Compile basic status data
        const status = {
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            playerStatus: this.playerStatus,
            currentTime: this.currentTime,
            duration: this.duration,
            isTimeUpdate: isTimeUpdate
        };

        // Include heavier metadata only for non-time updates
        if (!isTimeUpdate) {
            /**
             * Helper to get path relative to the music root.
             */
            const getRelativePath = (filePath) => {
                if (!filePath || !this.musicFolder) return filePath;
                try {
                    return path.relative(this.musicFolder, filePath);
                } catch (e) {
                    return filePath;
                }
            };

            // Map the playlist stack for the UI
            status.stack = this.stack.map(p => ({
                path: p,
                name: path.basename(p),
                relativePath: getRelativePath(p)
            }));
            status.loopMode = this.loopMode;
            status.shuffleMode = this.shuffleMode;
        }

        // Emit status to listeners (main.js)
        this.emit('status-change', status);
    }

    /**
     * Configures event listeners for the Discord AudioPlayer.
     */
    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, (oldState) => {
            this.log('[AudioPlayer] Mixer player went IDLE.');
            // Automatically attempt recovery if we should be playing
            if (this.isPlaying) {
                // Ignore idle events for resources that have been replaced
                if (oldState.resource && oldState.resource !== this.mixedResource) {
                    this.log('[AudioPlayer] Idle event was for a stale resource. Ignoring.');
                    return;
                }
                // Ensure pipeline if player stalled unexpectedly
                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    this.log('[AudioPlayer] Mixer unexpectedly idle, ensuring pipeline.');
                    this._ensureDiscordPipeline();
                }
            }
        });
        this.player.on('error', error => {
            this.log(`[AudioPlayer] Error in audio player (Mixer): ${error.message}`);
        });
    }

    /**
     * Sets the current active voice connection.
     * @param {object} connection - The Discord voice connection.
     */
    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        // Connect the audio player to the new voice channel
        this.connection.subscribe(this.player);
    }

    /**
     * Sets the master playback volume for music.
     * @param {number} volume - Volume multiplier (0.0 to 2.0).
     */
    setVolume(volume) {
        // Clamp volume within valid range
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            // Apply volume update to the active music stream in the mixer
            if (this.activeStreams.has('music')) {
                // Respect ducking if sound effects are playing
                const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
                this.mixer.setInputVolume('music', currentVolume);
            }
        }
    }

    /**
     * Sets the playlist loop mode.
     * @param {number} mode - 0: None, 1: Loop All, 2: Loop 1.
     */
    setLoopMode(mode) {
        this.loopMode = mode;
        this.log(`[AudioPlayer] Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    }

    /**
     * Toggles shuffle mode.
     * @param {boolean} enabled - Whether shuffle is enabled.
     */
    setShuffle(enabled) {
        this.shuffleMode = enabled;
        // Reset shuffle history when toggled
        this.playedIndices = [];
        this.log(`[AudioPlayer] Shuffle mode: ${enabled}`);
        this._emitStatusUpdate();
    }

    /**
     * Adds files to the playlist stack.
     * @param {string|string[]} filePaths - Single path or array of paths to add.
     */
    async addToStack(filePaths) {
        // Convert to array if a single path was passed
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        for (let filePath of paths) {
            // Resolve Windows shortcuts before adding to stack
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        filePath = shortcut.target;
                    }
                } catch (e) {
                    this.log(`[AudioPlayer] Failed to resolve shortcut: ${filePath}`);
                }
            }
            // Add unique file paths only
            if (!this.stack.includes(filePath)) {
                this.stack.push(filePath);
            }
        }
        // Initialize current index if first items were added
        if (this.currentIndex === -1 && this.stack.length > 0) {
            this.currentIndex = 0;
        }
        this._emitStatusUpdate();
    }

    /**
     * Removes an item from the playlist by index.
     * @param {number} index - Index in the stack.
     */
    removeFromStack(index) {
        if (index >= 0 && index < this.stack.length) {
            // Remove the track from the array
            const removedPath = this.stack.splice(index, 1)[0];
            // Handle removal of the currently playing track
            if (this.currentIndex === index) {
                this._stopMusicStream();
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                    if (this.isPlaying) this._play();
                } else {
                    this.stop();
                }
            } else if (this.currentIndex > index) {
                // Adjust index if an earlier item was removed
                this.currentIndex--;
            }
            this._emitStatusUpdate();
        }
    }

    /**
     * Clears the entire playlist stack and stops playback.
     */
    clearStack() {
        // Flush all active audio in the mixer
        if (this.mixer) this.mixer.reset();
        // Terminate FFmpeg and timers
        this._stopMusicStream();
        this._stopTimer();
        // Reset state variables
        this.stack = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.consecutiveErrors = 0;
        this._emitStatusUpdate();
    }

    /**
     * Internal play method to start a track.
     * @param {number} [startTime=0] - Time offset in seconds.
     * @private
     */
    async _play(startTime = 0) {
        // Safety checks before starting playback
        if (this.isDestroyed) return;
        if (this.playLock) return;

        // Use lock and ID tracking to prevent race conditions
        this.playLock = true;
        this.playCount++;
        const currentPlayId = this.playCount;
        try {
            // Validate playlist index
            if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                } else {
                    this.stop();
                    return;
                }
            }

            // Retrieve the file path for the current track
            const filePath = this.stack[this.currentIndex];
            this.log(`[AudioPlayer] Playing: ${path.basename(filePath)} from ${startTime}s`);

            // Stop existing streams and timers before starting new one
            this._stopMusicStream();
            this._stopTimer();

            // Initialize progress and status
            this.currentTime = startTime;
            this.isPlaying = true;

            // If starting from the beginning, reset pipeline and duration
            if (startTime === 0) {
                this.duration = 0;
                this._ensureDiscordPipeline();
                if (this.mixer) this.mixer.reset();
            }
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

            // Start duration fetch in background
            if (startTime === 0) {
                this._getDuration(filePath).then(duration => {
                    // Update only if track hasn't changed since request
                    if (this.isPlaying && this.playCount === currentPlayId) {
                        this.duration = duration;
                        this._emitStatusUpdate();
                    }
                }).catch(err => this.log(`[AudioPlayer] Error fetching duration: ${err.message}`));
            }

            // Record wall clock time for internal progress tracking
            this.lastPlayStartTime = Date.now() - (startTime * 1000);

            // Spawn FFmpeg process to decode audio to Raw PCM
            this.log(`[AudioPlayer] Starting FFmpeg stream for: ${path.basename(filePath)} at offset ${startTime}`);
            const ffmpegProcess = this._createFfmpegStream(filePath, startTime);

            // Handle process spawning errors
            ffmpegProcess.on('error', (err) => {
                this.log(`[AudioPlayer] FFmpeg spawn error: ${err.message}`);
                this._handlePlaybackError(filePath);
            });

            // Log FFmpeg errors from stderr
            ffmpegProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
                    this.log(`[AudioPlayer] FFmpeg Error: ${msg.trim()}`);
                }
            });

            // Pipe FFmpeg output into the mixer via a PassThrough proxy
            const ffmpegOutput = ffmpegProcess.stdout;
            const mixerStream = new PassThrough();
            ffmpegOutput.pipe(mixerStream);

            // Handle natural end of track
            mixerStream.once('end', () => {
                const currentMusic = this.activeStreams.get('music');
                // Ensure this event belongs to the current active track
                if (currentMusic && currentMusic.stream === mixerStream) {
                    this.activeStreams.delete('music');
                    this.mixer.removeInput('music');
                    this._stopTimer();
                    this._emitStatusUpdate();
                    // Transition to next track or loop
                    this._handleMusicFinish();
                }
            });

            // Add the stream as 'music' input to the mixer
            this.mixer.addInput(mixerStream, 'music');
            this.activeStreams.set('music', { process: ffmpegProcess, stream: mixerStream });

            // Start progress timer
            this._startTimer();
            // Reset recovery states on success
            this.consecutiveErrors = 0;
            this.recoveryAttempts = [];

            // Apply initial volume with ducking if needed
            const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
            this.mixer.setInputVolume('music', currentVolume);
        } catch (error) {
            this.log(`[AudioPlayer] Error in _play: ${error.message}`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
        } finally {
            // Release the play lock
            this.playLock = false;
        }
    }

    /**
     * Handles playback errors by retrying or skipping tracks.
     * @param {string} filePath - Path of the failed track.
     * @private
     */
    _handlePlaybackError(filePath) {
        this.consecutiveErrors++;
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        this._stopTimer();
        this._emitStatusUpdate();

        // Stop completely if we hit the global retry limit
        if (this.consecutiveErrors > 10) {
            this.log("[AudioPlayer] CRITICAL: Too many consecutive errors, stopping.");
            this.stop();
            return;
        }

        // If a specific track fails repeatedly, skip it
        if (this.consecutiveErrors % 3 === 0) {
            this.log("[AudioPlayer] Persistent error on current track, skipping.");
            setTimeout(() => this.next(false), 1000);
        } else {
            // Otherwise retry the track
            this.log("[AudioPlayer] Playback error, retrying/skipping...");
            setTimeout(() => this.next(true), 1000);
        }
    }

    /**
     * Resolves the path to the FFmpeg binary.
     * @returns {string}
     * @private
     */
    _getFfmpegPath() {
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            // Check if configured path is a direct file
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                return this.ffmpegBinFolder;
            }
            // Otherwise search for executable within the folder
            const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
            const fullPath = path.join(this.ffmpegBinFolder, exeName);
            if (fs.existsSync(fullPath)) return fullPath;
        } catch (e) {}
        // Fallback to system path
        return 'ffmpeg';
    }

    /**
     * Resolves the path to the ffprobe binary.
     * @returns {string}
     * @private
     */
    _getFfprobePath() {
        if (!this.ffmpegBinFolder) return 'ffprobe';
        try {
            // Check for sibling executable to FFmpeg
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
        // Fallback to system path
        return 'ffprobe';
    }

    /**
     * Spawns an FFmpeg process to stream audio from a file.
     * @param {string} filePath - Path to the audio file.
     * @param {number} [startTime=0] - Seek offset.
     * @returns {ChildProcess}
     * @private
     */
    _createFfmpegStream(filePath, startTime = 0) {
        const ffmpegPath = this._getFfmpegPath();
        const args = [];
        // Add seek argument before input if starting mid-track
        if (startTime > 0) {
            args.push('-ss', startTime.toString());
        }
        // Arguments: -re (realtime), -i (input), -f s16le (Raw PCM format), -ar 48k (Discord sample rate), -ac 2 (Stereo), pipe:1 (output to stdout)
        args.push('-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
        // Spawn FFmpeg with arguments, ensuring path is handled safely via spawn API
        return spawn(ffmpegPath, args);
    }

    /**
     * Uses ffprobe to determine the duration of an audio file.
     * @param {string} filePath - Path to file.
     * @returns {Promise<number>} Duration in seconds.
     * @private
     */
    _getDuration(filePath) {
        return new Promise((resolve, reject) => {
            let targetPath = filePath;
            // Resolve shortcuts for duration probe
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) targetPath = shortcut.target;
                } catch (e) {}
            }
            const ffprobePath = this._getFfprobePath();
            const { exec } = require('child_process');
            // Command to extract duration from media metadata
            const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetPath}"`;
            exec(cmd, (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const duration = parseFloat(stdout.trim());
                resolve(isNaN(duration) ? 0 : duration);
            });
        });
    }

    /**
     * Starts the playback progress timer.
     * @private
     */
    _startTimer() {
        this._stopTimer();
        // Update currentTime every second based on wall clock elapsed time
        this.timer = setInterval(() => {
            if (this.isPlaying) {
                this.currentTime = (Date.now() - (this.lastPlayStartTime || 0)) / 1000;
                // Cap progress at total duration
                if (this.duration > 0 && this.currentTime > this.duration) {
                    this.currentTime = this.duration;
                }
                this._emitStatusUpdate(true);
            }
        }, 1000);
    }

    /**
     * Stops the progress timer.
     * @private
     */
    _stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Gracefully stops and cleans up the active music FFmpeg process.
     * @private
     */
    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            const entry = this.activeStreams.get('music');
            // Remove stream from mixer processing
            if (this.mixer) this.mixer.removeInput('music');
            if (entry.process) {
                try {
                    // Unpipe and terminate the child process
                    entry.process.stdout.unpipe();
                    entry.process.kill('SIGKILL');
                } catch (e) {}
            }
            // End the PassThrough stream
            if (entry.stream && entry.stream.end) {
                entry.stream.end();
            }
            this.activeStreams.delete('music');
        }
    }

    /**
     * Transition logic when a music track finishes naturally.
     * @private
     */
    /**
     * Logic for transitioning when a music track finishes.
     * Implements "Loop Single", "Loop All", and "Auto-Advance" behaviors.
     */
    _handleMusicFinish() {
        const elapsed = Date.now() - (this.lastPlayStartTime || 0);

        // Safeguard: If a track finishes in under 1 second, it's likely corrupt or
        // inaccessible. We treat this as an error to prevent rapid-cycle thrashing.
        if (elapsed < 1000 && (this.duration === 0 || this.duration > 2)) {
            this.log(`[AudioPlayer] Track finished too quickly (${elapsed}ms), considering it an error.`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
            return;
        }

        // To ensure the mixer worker has time to drain its internal buffer,
        // we add a tiny delay for extremely short loops.
        const playWithDelay = () => {
            if (elapsed < 500) {
                setTimeout(() => this._play(0), 200);
            } else {
                this._play(0);
            }
        };

        if (this.loopMode === 2) {
            // Loop Single: Repeat the same file immediately.
            playWithDelay();
        } else if (this.loopMode === 1) {
            // Loop All: Move the finished track to the bottom and start the new top.
            const finished = this.stack.shift();
            if (finished) this.stack.push(finished);
            this.currentIndex = 0;
            playWithDelay();
        } else {
            // No Loop: Remove the track and stop if the playlist is empty.
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
     * Advances to the next track in the stack.
     * @param {boolean} [isError=false] - Whether this skip was triggered by an error.
     * @param {boolean} [forcePlay=false] - Whether to start playing even if currently paused.
     */
    next(isError = false, forcePlay = false) {
        // Capture intention to continue playing
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] next(isError=${isError}, forcePlay=${forcePlay}) called.`);
        if (this.stack.length === 0) return;

        // Shuffle logic
        if (this.shuffleMode) {
            // Add current track to history
            this.playedIndices.push(this.currentIndex);
            // Reset history if all tracks have played
            if (this.playedIndices.length >= this.stack.length) this.playedIndices = [];
            let nextIndex;
            // Pick a random track that isn't in recent history
            do {
                nextIndex = Math.floor(Math.random() * this.stack.length);
            } while (this.playedIndices.includes(nextIndex) && this.stack.length > 1);
            this.currentIndex = nextIndex;
        } else {
            // Standard linear skip logic
            if (this.loopMode === 2 && isError) {
                // Restart same track on error if Loop 1 is active
                this.currentIndex = 0;
            } else if (this.loopMode === 1 || this.loopMode === 2) {
                // Move current to bottom for loops
                const current = this.stack.shift();
                if (current) this.stack.push(current);
                this.currentIndex = 0;
            } else {
                // Drop track if no loop
                this.stack.shift();
                if (this.stack.length === 0) {
                    this.stop();
                    return;
                }
                this.currentIndex = 0;
            }
        }

        // Start playing the new track if needed
        if (wasPlaying || isError) {
            this._play();
        } else {
            // Otherwise just update the stack state
            this.currentTime = 0;
            this._emitStatusUpdate();
        }
    }

    /**
     * Jumps to a specific track in the stack by index.
     * @param {number} index - Index to jump to.
     * @param {boolean} [forcePlay=false] - Whether to force playback.
     */
    jumpTo(index, forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        if (index >= 0 && index < this.stack.length) {
            // In the roll-off system, jumping to index X means bumping preceding tracks to the bottom
            const preceding = this.stack.splice(0, index);
            if (this.loopMode === 1 || this.loopMode === 2) {
                this.stack.push(...preceding);
            }
            // Target track is now at index 0
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
     * Reverts to the previous track by pulling from the bottom of the stack.
     * @param {boolean} [forcePlay=false] - Whether to force playback.
     */
    prev(forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        if (this.stack.length === 0) return;

        // Pull the last track to the top
        if (this.loopMode === 1 || this.loopMode === 2) {
            const last = this.stack.pop();
            if (last) this.stack.unshift(last);
            this.currentIndex = 0;
        } else {
            // Just restart current if no loop
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
     * Explicit play command. Resumes from pause or starts stack.
     */
    play() {
        if (this.isPlaying) return;
        this.playLock = false;
        // Handle resume from paused state
        if (this.playerStatus === AudioPlayerStatus.Paused && this.currentIndex >= 0) {
            this._play(this.currentTime);
            return;
        }
        // Initialize index if needed
        if (this.currentIndex < 0 && this.stack.length > 0) this.currentIndex = 0;
        // Start playback
        if (this.currentIndex >= 0) this._play();
    }

    /**
     * Seeks to a specific timestamp in the current track.
     * @param {number} time - Offset in seconds.
     */
    seek(time) {
        if (this.currentIndex >= 0 && this.stack.length > 0) {
            this.log(`[AudioPlayer] Seeking to ${time}s`);
            this._play(time);
        }
    }

    /**
     * Pauses playback by stopping the music stream.
     */
    pause() {
        this._stopMusicStream();
        this._stopTimer();
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    }

    /**
     * Stops playback and resets progress.
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
     * Plays a sound effect on a specific soundboard slot.
     * @param {string} filePath - Path to SFX file.
     * @param {number} slotId - Slot identifier.
     */
    playSound(filePath, slotId) {
        this.log(`[AudioPlayer] Soundboard: Playing slot ${slotId}`);
        const id = `sfx_${slotId}`;
        // Stop any sound currently playing on this slot
        this.stopSound(slotId);
        try {
            // Spawn FFmpeg for the sound effect
            const ffmpegProcess = this._createFfmpegStream(filePath);
            const stream = ffmpegProcess.stdout;

            // Handle music ducking when SFX starts
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.mixer.setInputVolume('music', this.playbackVolume * this.duckingVolume);
            }
            this.activeSfxCount++;

            // Handle SFX completion
            stream.once('close', () => {
                if (this.activeStreams.has(id)) {
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    // Notify UI that slot is free
                    this.emit('sound-finished', slotId);
                    this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                    // Restore music volume if all SFX finished
                    if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                        this.mixer.setInputVolume('music', this.playbackVolume);
                    }
                }
            });

            // Add sound to mixer with independent volume
            this.mixer.addInput(stream, id, this.soundboardVolume);
            this.activeStreams.set(id, { process: ffmpegProcess, stream });
        } catch (error) {
            this.log(`[AudioPlayer] SFX Error: ${error.message}`);
        }
    }

    /**
     * Terminates a sound effect by slot ID.
     * @param {number} slotId - Slot to stop.
     */
    stopSound(slotId) {
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            const { process } = this.activeStreams.get(id);
            // Remove from mixer and kill process
            this.mixer.removeInput(id);
            if (process) process.kill();
            this.activeStreams.delete(id);

            // Handle volume restoration
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.mixer.setInputVolume('music', this.playbackVolume);
            }
        }
    }

    /**
     * Sets the volume for all soundboard effects.
     * @param {number} volume - Multiplier.
     */
    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        // Update all active SFX inputs in the mixer
        this.activeStreams.forEach((value, id) => {
            if (id.startsWith('sfx_')) this.mixer.setInputVolume(id, volume);
        });
    }

    /**
     * Recursively retrieves all music files from the music root folder.
     * @returns {string[]} List of full file paths.
     */
    getMusicFiles() {
        if (!this.musicFolder || !fs.existsSync(this.musicFolder)) return [];

        /**
         * Helper to traverse directories.
         */
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    getAllFiles(fullPath, results);
                } else {
                    const ext = path.extname(fullPath).toLowerCase();
                    // Include supported audio and shortcuts
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) {
                        results.push(fullPath);
                    }
                }
            });
            return results;
        };
        return getAllFiles(this.musicFolder);
    }

    /**
     * Retrieves the path of the file that would be previewed (current or top of stack).
     * @returns {string|null}
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
     * Tears down the audio player and all active processes.
     */
    destroy() {
        this.isDestroyed = true;
        // Stop Discord player
        if (this.player) this.player.stop();
        // Kill all FFmpeg processes
        this.activeStreams.forEach(({ process }) => {
            try { if (process) process.kill(); } catch (e) {}
        });
        this.activeStreams.clear();
        // Terminate the mixer worker
        if (this.mixer) this.mixer.destroy();
    }
}
module.exports = BackendAudioPlayer;
