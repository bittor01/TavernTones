// Performance and security update
// Process: const  createAudioPlayer, AudioPlayerStatus, entersState,...
const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
// Process: const fsp = require('fs').promises
const fsp = require('fs').promises;
const path = require('path');
// Process: const  Readable, PassThrough  = require('stream')
const { Readable, PassThrough } = require('stream');
const { EventEmitter } = require('events');
// Process: const  spawn  = require('child_process')
const { spawn } = require('child_process');
const ThreadedAudioMixer = require('./ThreadedAudioMixer');

/**
 * Manages audio playback for music and soundboard effects.
 * Handles FFmpeg streaming, Discord voice integration, and playlist management.
 */
// Process: class BackendAudioPlayer extends EventEmitter
class BackendAudioPlayer extends EventEmitter {
    /**
     * Initializes the audio player with necessary dependencies.
     * @param {function} logCallback - Function for logging messages.
     * @param {object} shell - Electron shell object for handling shortcuts.
     * @param {string} musicFolder - Root directory for music files.
     * @param {string} ffmpegBinFolder - Directory containing FFmpeg binaries.
     */
    constructor(logCallback, shell, musicFolder, ffmpegBinFolder) {
        // Process: super()
        super();
        // Store logging and shell dependencies
        this.log = logCallback || console.log;
        // Process: this.shell = shell
        this.shell = shell;
        // Set base paths for media and binaries
        this.musicFolder = musicFolder;
        // Process: this.ffmpegBinFolder = ffmpegBinFolder
        this.ffmpegBinFolder = ffmpegBinFolder;

        // Initialize playback state
        this.playerStatus = AudioPlayerStatus.Idle;
        // Process: this.isPlaying = false
        this.isPlaying = false;
        // Lock to prevent concurrent play requests
        this.playLock = false;

        // Playlist (stack) system state
        // Process: this.stack = []
        this.stack = [];
        this.currentIndex = -1;
        // 0: None, 1: Loop All, 2: Loop 1
        // Process: this.loopMode = 1
        this.loopMode = 1;
        this.shuffleMode = false;
        // Track history for shuffle mode
        // Process: this.playedIndices = []
        this.playedIndices = [];

        // Playback progress tracking
        this.currentTime = 0; // Current time in seconds
        // Process: this.duration = 0
        this.duration = 0; // Total track duration
        // Correlation ID for duration updates
        this.playCount = 0;
        // Process: this.timer = null
        this.timer = null;

        // Error handling and recovery state
        this.consecutiveErrors = 0;
        // Process: this.recoveryAttempts = []
        this.recoveryAttempts = [];

        // Volume configuration
        this.playbackVolume = 1.0;
        // Process: this.soundboardVolume = 0.5
        this.soundboardVolume = 0.5;
        this.duckingVolume = 0.3;
        // Process: this.activeSfxCount = 0
        this.activeSfxCount = 0;

        // Initialize the audio mixer
        this.mixer = new ThreadedAudioMixer();
        // Handle mixer errors, ignoring expected stream closures
        // Process: this.mixer.on('error', (err) =>
        this.mixer.on('error', (err) => {
            if (err.code === 'ERR_STREAM_PREMATURE_CLOSE') return;
            // Process: this.log(`[AudioPlayer] Mixer Error: $err.message`)
            this.log(`[AudioPlayer] Mixer Error: ${err.message}`);
        });

        // Initialize Discord-specific audio components
        // Process: this.mixerProxy = null
        this.mixerProxy = null;
        this.mixedResource = null;
        // Process: this.player = null
        this.player = null;
        this.connection = null;

        // Build the initial audio pipeline
        // Process: this._ensureDiscordPipeline()
        this._ensureDiscordPipeline();
        // Broadcast initial status
        this._emitStatusUpdate();

        // Track all active audio streams (music and SFX)
        // Process: this.activeStreams = new Map()
        this.activeStreams = new Map(); // id -> { process, stream }
    }

    /**
     * Ensures the Discord audio player and resource pipeline are correctly initialized.
     * Handles creation and reconnection of the audio stream.
     * @private
     */
    // Process: _ensureDiscordPipeline()
    _ensureDiscordPipeline() {
        try {
            // Create Discord AudioPlayer if it doesn't exist
            // Process: if (!this.player)
            if (!this.player) {
                this.log('[AudioPlayer] Creating Discord AudioPlayer.');
                // Process: this.player = createAudioPlayer()
                this.player = createAudioPlayer();
                this.setupPlayerEvents();
            // Process:
            }

            // Subscribe existing voice connection to the player
            if (this.connection) {
                // Process: this.connection.subscribe(this.player)
                this.connection.subscribe(this.player);
            }

            // Establish a PassThrough proxy for the mixer output
            // Process: if (!this.mixerProxy || this.mixerProxy.destroyed)
            if (!this.mixerProxy || this.mixerProxy.destroyed) {
                this.log('[AudioPlayer] Establishing mixer proxy.');
                // Process: if (this.mixerProxy)
                if (this.mixerProxy) {
                    try { this.mixer.unpipe(this.mixerProxy); } catch (e) {}
                    // Process: try  this.mixerProxy.destroy()  catch (e)
                    try { this.mixerProxy.destroy(); } catch (e) {}
                }
                // Process: this.mixerProxy = new PassThrough()
                this.mixerProxy = new PassThrough();
                // Pipe mixed audio to the proxy
                this.mixer.pipe(this.mixerProxy);
                // Process: this.mixedResource = null
                this.mixedResource = null;
            }

            // Create a new Discord audio resource if needed
            // Process: if (!this.mixedResource || this.mixedResource.ended || th...
            if (!this.mixedResource || this.mixedResource.ended || this.player.state.status === AudioPlayerStatus.Idle) {
                const now = Date.now();
                // Filter recovery attempts to the last 10 seconds
                // Process: this.recoveryAttempts = this.recoveryAttempts.filter(t =>...
                this.recoveryAttempts = this.recoveryAttempts.filter(t => now - t < 10000);
                this.recoveryAttempts.push(now);

                // Stop if we are stuck in a rapid recovery loop
                // Process: if (this.recoveryAttempts.length > 8)
                if (this.recoveryAttempts.length > 8) {
                    this.log('[AudioPlayer] CRITICAL: Rapid recovery loop detected. Stopping playback.');
                    // Process: this.stop()
                    this.stop();
                    return;
                // Process:
                }

                this.log('[AudioPlayer] Establishing audio pipeline resource.');
                // Create resource from the mixer proxy stream
                // Process: this.mixedResource = createAudioResource(this.mixerProxy,
                this.mixedResource = createAudioResource(this.mixerProxy, {
                    inputType: StreamType.Raw,
                    // Process: inlineVolume: false
                    inlineVolume: false
                });
                // Begin playback on the Discord player
                // Process: this.player.play(this.mixedResource)
                this.player.play(this.mixedResource);
            }
        // Process: catch (e)
        } catch (e) {
            this.log(`[AudioPlayer] Error ensuring pipeline: ${e.message}`);
        // Process:
        }
    }

    /**
     * Emits a status update event for the UI and Discord media controls.
     * @param {boolean} [isTimeUpdate=false] - Whether this is a frequent progress update.
     * @private
     */
    // Process: _emitStatusUpdate(isTimeUpdate = false)
    _emitStatusUpdate(isTimeUpdate = false) {
        // Compile basic status data
        const status = {
            // Process: isPlaying: this.isPlaying,
            isPlaying: this.isPlaying,
            currentIndex: this.currentIndex,
            // Process: playerStatus: this.playerStatus,
            playerStatus: this.playerStatus,
            currentTime: this.currentTime,
            // Process: duration: this.duration,
            duration: this.duration,
            isTimeUpdate: isTimeUpdate
        // Process:
        };

        // Include heavier metadata only for non-time updates
        if (!isTimeUpdate) {
            /**
             * Helper to get path relative to the music root.
             */
            // Process: const getRelativePath = (filePath) =>
            const getRelativePath = (filePath) => {
                if (!filePath || !this.musicFolder) return filePath;
                // Process: try
                try {
                    return path.relative(this.musicFolder, filePath);
                // Process: catch (e)
                } catch (e) {
                    return filePath;
                // Process:
                }
            };

            // Map the playlist stack for the UI
            // Process: status.stack = this.stack.map(p => (
            status.stack = this.stack.map(p => ({
                path: p,
                // Process: name: path.basename(p),
                name: path.basename(p),
                relativePath: getRelativePath(p)
            // Process: ))
            }));
            status.loopMode = this.loopMode;
            // Process: status.shuffleMode = this.shuffleMode
            status.shuffleMode = this.shuffleMode;
        }

        // Emit status to listeners (main.js)
        // Process: this.emit('status-change', status)
        this.emit('status-change', status);
    }

    /**
     * Configures event listeners for the Discord AudioPlayer.
     */
    // Process: setupPlayerEvents()
    setupPlayerEvents() {
        this.player.on(AudioPlayerStatus.Idle, (oldState) => {
            // Process: this.log('[AudioPlayer] Mixer player went IDLE.')
            this.log('[AudioPlayer] Mixer player went IDLE.');
            // Automatically attempt recovery if we should be playing
            if (this.isPlaying) {
                // Ignore idle events for resources that have been replaced
                // Process: if (oldState.resource && oldState.resource !== this.mixed...
                if (oldState.resource && oldState.resource !== this.mixedResource) {
                    this.log('[AudioPlayer] Idle event was for a stale resource. Ignoring.');
                    // Process: return
                    return;
                }
                // Ensure pipeline if player stalled unexpectedly
                // Process: if (this.player.state.status === AudioPlayerStatus.Idle)
                if (this.player.state.status === AudioPlayerStatus.Idle) {
                    this.log('[AudioPlayer] Mixer unexpectedly idle, ensuring pipeline.');
                    // Process: this._ensureDiscordPipeline()
                    this._ensureDiscordPipeline();
                }
            // Process:
            }
        });

        // Process: this.player.on('error', error =>
        this.player.on('error', error => {
            this.log(`[AudioPlayer] Error in audio player (Mixer): ${error.message}`);
        // Process: )
        });
    }

    /**
     * Sets the current active voice connection.
     * @param {object} connection - The Discord voice connection.
     */
    // Process: setConnection(connection)
    setConnection(connection) {
        if (!connection) return;
        // Process: this.connection = connection
        this.connection = connection;
        // Connect the audio player to the new voice channel
        this.connection.subscribe(this.player);
    // Process:
    }

    /**
     * Sets the master playback volume for music.
     * @param {number} volume - Volume multiplier (0.0 to 2.0).
     */
    setVolume(volume) {
        // Clamp volume within valid range
        // Process: if (volume >= 0 && volume <= 2)
        if (volume >= 0 && volume <= 2) {
            this.playbackVolume = volume;
            // Apply volume update to the active music stream in the mixer
            // Process: if (this.activeStreams.has('music'))
            if (this.activeStreams.has('music')) {
                // Respect ducking if sound effects are playing
                const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
                // Process: this.mixer.setInputVolume('music', currentVolume)
                this.mixer.setInputVolume('music', currentVolume);
            }
        // Process:
        }
    }

    /**
     * Sets the playlist loop mode.
     * @param {number} mode - 0: None, 1: Loop All, 2: Loop 1.
     */
    // Process: setLoopMode(mode)
    setLoopMode(mode) {
        this.loopMode = mode;
        // Process: this.log(`[AudioPlayer] Loop mode set to: $mode`)
        this.log(`[AudioPlayer] Loop mode set to: ${mode}`);
        this._emitStatusUpdate();
    // Process:
    }

    /**
     * Toggles shuffle mode.
     * @param {boolean} enabled - Whether shuffle is enabled.
     */
    setShuffle(enabled) {
        // Process: this.shuffleMode = enabled
        this.shuffleMode = enabled;
        // Reset shuffle history when toggled
        this.playedIndices = [];
        // Process: this.log(`[AudioPlayer] Shuffle mode: $enabled`)
        this.log(`[AudioPlayer] Shuffle mode: ${enabled}`);
        this._emitStatusUpdate();
    // Process:
    }

    /**
     * Adds files to the playlist stack.
     * @param {string|string[]} filePaths - Single path or array of paths to add.
     */
    async addToStack(filePaths) {
        // Convert to array if a single path was passed
        // Process: const paths = Array.isArray(filePaths) ? filePaths : [fil...
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        for (let filePath of paths) {
            // Resolve Windows shortcuts before adding to stack
            // Process: if (path.extname(filePath).toLowerCase() === '.lnk' && th...
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                try {
                    // Process: const shortcut = this.shell.readShortcutLink(filePath)
                    const shortcut = this.shell.readShortcutLink(filePath);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        // Process: filePath = shortcut.target
                        filePath = shortcut.target;
                    }
                // Process: catch (e)
                } catch (e) {
                    this.log(`[AudioPlayer] Failed to resolve shortcut: ${filePath}`);
                // Process:
                }
            }
            // Add unique file paths only
            // Process: if (!this.stack.includes(filePath))
            if (!this.stack.includes(filePath)) {
                this.stack.push(filePath);
            // Process:
            }
        }
        // Initialize current index if first items were added
        // Process: if (this.currentIndex === -1 && this.stack.length > 0)
        if (this.currentIndex === -1 && this.stack.length > 0) {
            this.currentIndex = 0;
        // Process:
        }
        this._emitStatusUpdate();
    // Process:
    }

    /**
     * Removes an item from the playlist by index.
     * @param {number} index - Index in the stack.
     */
    removeFromStack(index) {
        // Process: if (index >= 0 && index < this.stack.length)
        if (index >= 0 && index < this.stack.length) {
            // Remove the track from the array
            const removedPath = this.stack.splice(index, 1)[0];
            // Handle removal of the currently playing track
            // Process: if (this.currentIndex === index)
            if (this.currentIndex === index) {
                this._stopMusicStream();
                // Process: if (this.stack.length > 0)
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                    // Process: if (this.isPlaying) this._play()
                    if (this.isPlaying) this._play();
                } else {
                    // Process: this.stop()
                    this.stop();
                }
            // Process: else if (this.currentIndex > index)
            } else if (this.currentIndex > index) {
                // Adjust index if an earlier item was removed
                this.currentIndex--;
            // Process:
            }
            this._emitStatusUpdate();
        // Process:
        }
    }

    /**
     * Clears the entire playlist stack and stops playback.
     */
    // Process: clearStack()
    clearStack() {
        // Flush all active audio in the mixer
        if (this.mixer) this.mixer.reset();
        // Terminate FFmpeg and timers
        // Process: this._stopMusicStream()
        this._stopMusicStream();
        this._stopTimer();
        // Reset state variables
        // Process: this.stack = []
        this.stack = [];
        this.currentIndex = -1;
        // Process: this.isPlaying = false
        this.isPlaying = false;
        this.currentTime = 0;
        // Process: this.duration = 0
        this.duration = 0;
        this.consecutiveErrors = 0;
        // Process: this._emitStatusUpdate()
        this._emitStatusUpdate();
    }

    /**
     * Internal play method to start a track.
     * @param {number} [startTime=0] - Time offset in seconds.
     * @private
     */
    // Process: async _play(startTime = 0)
    async _play(startTime = 0) {
        // Safety checks before starting playback
        if (this.isDestroyed) return;
        // Process: if (this.playLock) return
        if (this.playLock) return;

        // Use lock and ID tracking to prevent race conditions
        this.playLock = true;
        // Process: this.playCount++
        this.playCount++;
        const currentPlayId = this.playCount;

        // Process: try
        try {
            // Validate playlist index
            if (this.currentIndex < 0 || this.currentIndex >= this.stack.length) {
                // Process: if (this.stack.length > 0)
                if (this.stack.length > 0) {
                    this.currentIndex = 0;
                // Process: else
                } else {
                    this.stop();
                    // Process: return
                    return;
                }
            // Process:
            }

            // Retrieve the file path for the current track
            const filePath = this.stack[this.currentIndex];
            // Process: this.log(`[AudioPlayer] Playing: $path.basename(filePath)...
            this.log(`[AudioPlayer] Playing: ${path.basename(filePath)} from ${startTime}s`);

            // Stop existing streams and timers before starting new one
            this._stopMusicStream();
            // Process: this._stopTimer()
            this._stopTimer();

            // Initialize progress and status
            this.currentTime = startTime;
            // Process: this.isPlaying = true
            this.isPlaying = true;

            // If starting from the beginning, reset pipeline and duration
            if (startTime === 0) {
                // Process: this.duration = 0
                this.duration = 0;
                this._ensureDiscordPipeline();
                // Process: if (this.mixer) this.mixer.reset()
                if (this.mixer) this.mixer.reset();
            }
            // Process: this.playerStatus = AudioPlayerStatus.Playing
            this.playerStatus = AudioPlayerStatus.Playing;
            this._emitStatusUpdate();

            // Start duration fetch in background
            // Process: if (startTime === 0)
            if (startTime === 0) {
                this._getDuration(filePath).then(duration => {
                    // Update only if track hasn't changed since request
                    // Process: if (this.isPlaying && this.playCount === currentPlayId)
                    if (this.isPlaying && this.playCount === currentPlayId) {
                        this.duration = duration;
                        // Process: this._emitStatusUpdate()
                        this._emitStatusUpdate();
                    }
                // Process: ).catch(err => this.log(`[AudioPlayer] Error fetching dur...
                }).catch(err => this.log(`[AudioPlayer] Error fetching duration: ${err.message}`));
            }

            // Record wall clock time for internal progress tracking
            // Process: this.lastPlayStartTime = Date.now() - (startTime * 1000)
            this.lastPlayStartTime = Date.now() - (startTime * 1000);

            // Spawn FFmpeg process to decode audio to Raw PCM
            this.log(`[AudioPlayer] Starting FFmpeg stream for: ${path.basename(filePath)} at offset ${startTime}`);
            // Process: const ffmpegProcess = this._createFfmpegStream(filePath, ...
            const ffmpegProcess = this._createFfmpegStream(filePath, startTime);

            // Handle process spawning errors
            ffmpegProcess.on('error', (err) => {
                // Process: this.log(`[AudioPlayer] FFmpeg spawn error: $err.message`)
                this.log(`[AudioPlayer] FFmpeg spawn error: ${err.message}`);
                this._handlePlaybackError(filePath);
            // Process: )
            });

            // Log FFmpeg errors from stderr
            ffmpegProcess.stderr.on('data', (data) => {
                // Process: const msg = data.toString()
                const msg = data.toString();
                if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
                    // Process: this.log(`[AudioPlayer] FFmpeg Error: $msg.trim()`)
                    this.log(`[AudioPlayer] FFmpeg Error: ${msg.trim()}`);
                }
            // Process: )
            });

            // Pipe FFmpeg output into the mixer via a PassThrough proxy
            const ffmpegOutput = ffmpegProcess.stdout;
            // Process: const mixerStream = new PassThrough()
            const mixerStream = new PassThrough();
            ffmpegOutput.pipe(mixerStream);

            // Handle natural end of track
            // Process: mixerStream.once('end', () =>
            mixerStream.once('end', () => {
                const currentMusic = this.activeStreams.get('music');
                // Ensure this event belongs to the current active track
                // Process: if (currentMusic && currentMusic.stream === mixerStream)
                if (currentMusic && currentMusic.stream === mixerStream) {
                    this.activeStreams.delete('music');
                    // Process: this.mixer.removeInput('music')
                    this.mixer.removeInput('music');

                    this._stopTimer();
                    // Process: this._emitStatusUpdate()
                    this._emitStatusUpdate();
                    // Transition to next track or loop
                    this._handleMusicFinish();
                // Process:
                }
            });

            // Add the stream as 'music' input to the mixer
            // Process: this.mixer.addInput(mixerStream, 'music')
            this.mixer.addInput(mixerStream, 'music');
            this.activeStreams.set('music', { process: ffmpegProcess, stream: mixerStream });

            // Start progress timer
            // Process: this._startTimer()
            this._startTimer();
            // Reset recovery states on success
            this.consecutiveErrors = 0;
            // Process: this.recoveryAttempts = []
            this.recoveryAttempts = [];

            // Apply initial volume with ducking if needed
            const currentVolume = this.activeSfxCount > 0 ? this.playbackVolume * this.duckingVolume : this.playbackVolume;
            // Process: this.mixer.setInputVolume('music', currentVolume)
            this.mixer.setInputVolume('music', currentVolume);

        } catch (error) {
            // Process: this.log(`[AudioPlayer] Error in _play: $error.message`)
            this.log(`[AudioPlayer] Error in _play: ${error.message}`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
        // Process: finally
        } finally {
            // Release the play lock
            this.playLock = false;
        // Process:
        }
    }

    /**
     * Handles playback errors by retrying or skipping tracks.
     * @param {string} filePath - Path of the failed track.
     * @private
     */
    // Process: _handlePlaybackError(filePath)
    _handlePlaybackError(filePath) {
        this.consecutiveErrors++;
        // Process: this.isPlaying = false
        this.isPlaying = false;
        this.playerStatus = AudioPlayerStatus.Idle;
        // Process: this._stopTimer()
        this._stopTimer();
        this._emitStatusUpdate();

        // Stop completely if we hit the global retry limit
        // Process: if (this.consecutiveErrors > 10)
        if (this.consecutiveErrors > 10) {
            this.log("[AudioPlayer] CRITICAL: Too many consecutive errors, stopping.");
            // Process: this.stop()
            this.stop();
            return;
        // Process:
        }

        // If a specific track fails repeatedly, skip it
        if (this.consecutiveErrors % 3 === 0) {
            // Process: this.log("[AudioPlayer] Persistent error on current track...
            this.log("[AudioPlayer] Persistent error on current track, skipping.");
            setTimeout(() => this.next(false), 1000);
        // Process: else
        } else {
            // Otherwise retry the track
            this.log("[AudioPlayer] Playback error, retrying/skipping...");
            // Process: setTimeout(() => this.next(true), 1000)
            setTimeout(() => this.next(true), 1000);
        }
    // Process:
    }

    /**
     * Resolves the path to the FFmpeg binary.
     * @returns {string}
     * @private
     */
    _getFfmpegPath() {
        // Process: if (!this.ffmpegBinFolder) return 'ffmpeg'
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            // Check if configured path is a direct file
            // Process: if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(t...
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                return this.ffmpegBinFolder;
            // Process:
            }
            // Otherwise search for executable within the folder
            const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
            // Process: const fullPath = path.join(this.ffmpegBinFolder, exeName)
            const fullPath = path.join(this.ffmpegBinFolder, exeName);
            if (fs.existsSync(fullPath)) return fullPath;
        // Process: catch (e)
        } catch (e) {}
        // Fallback to system path
        return 'ffmpeg';
    // Process:
    }

    /**
     * Resolves the path to the ffprobe binary.
     * @returns {string}
     * @private
     */
    _getFfprobePath() {
        // Process: if (!this.ffmpegBinFolder) return 'ffprobe'
        if (!this.ffmpegBinFolder) return 'ffprobe';
        try {
            // Check for sibling executable to FFmpeg
            // Process: if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(t...
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                const dir = path.dirname(this.ffmpegBinFolder);
                // Process: const exeName = process.platform === 'win32' ? 'ffprobe.e...
                const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
                const siblingPath = path.join(dir, exeName);
                // Process: if (fs.existsSync(siblingPath)) return siblingPath
                if (fs.existsSync(siblingPath)) return siblingPath;
            } else {
                // Process: const exeName = process.platform === 'win32' ? 'ffprobe.e...
                const exeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
                const fullPath = path.join(this.ffmpegBinFolder, exeName);
                // Process: if (fs.existsSync(fullPath)) return fullPath
                if (fs.existsSync(fullPath)) return fullPath;
            }
        // Process: catch (e)
        } catch (e) {}
        // Fallback to system path
        return 'ffprobe';
    // Process:
    }

    /**
     * Spawns an FFmpeg process to stream audio from a file.
     * @param {string} filePath - Path to the audio file.
     * @param {number} [startTime=0] - Seek offset.
     * @returns {ChildProcess}
     * @private
     */
    _createFfmpegStream(filePath, startTime = 0) {
        // Process: const ffmpegPath = this._getFfmpegPath()
        const ffmpegPath = this._getFfmpegPath();
        const args = [];
        // Add seek argument before input if starting mid-track
        // Process: if (startTime > 0)
        if (startTime > 0) {
            args.push('-ss', startTime.toString());
        // Process:
        }
        // Arguments: -re (realtime), -i (input), -f s16le (Raw PCM format), -ar 48k (Discord sample rate), -ac 2 (Stereo), pipe:1 (output to stdout)
        args.push('-re', '-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');
        // Spawn FFmpeg with arguments, ensuring path is handled safely via spawn API
        // Process: return spawn(ffmpegPath, args)
        return spawn(ffmpegPath, args);
    }

    /**
     * Uses ffprobe to determine the duration of an audio file.
     * @param {string} filePath - Path to file.
     * @returns {Promise<number>} Duration in seconds.
     * @private
     */
    // Process: _getDuration(filePath)
    _getDuration(filePath) {
        return new Promise((resolve, reject) => {
            // Process: let targetPath = filePath
            let targetPath = filePath;
            // Resolve shortcuts for duration probe
            if (path.extname(filePath).toLowerCase() === '.lnk' && this.shell) {
                // Process: try
                try {
                    const shortcut = this.shell.readShortcutLink(filePath);
                    // Process: if (shortcut.target && fs.existsSync(shortcut.target)) ta...
                    if (shortcut.target && fs.existsSync(shortcut.target)) targetPath = shortcut.target;
                } catch (e) {}
            // Process:
            }

            const ffprobePath = this._getFfprobePath();
            // Process: const  exec  = require('child_process')
            const { exec } = require('child_process');
            // Command to extract duration from media metadata
            const cmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetPath}"`;

            // Process: exec(cmd, (error, stdout) =>
            exec(cmd, (error, stdout) => {
                if (error) {
                    // Process: reject(error)
                    reject(error);
                    return;
                // Process:
                }
                const duration = parseFloat(stdout.trim());
                // Process: resolve(isNaN(duration) ? 0 : duration)
                resolve(isNaN(duration) ? 0 : duration);
            });
        // Process: )
        });
    }

    /**
     * Starts the playback progress timer.
     * @private
     */
    // Process: _startTimer()
    _startTimer() {
        this._stopTimer();
        // Update currentTime every second based on wall clock elapsed time
        // Process: this.timer = setInterval(() =>
        this.timer = setInterval(() => {
            if (this.isPlaying) {
                // Process: this.currentTime = (Date.now() - (this.lastPlayStartTime ...
                this.currentTime = (Date.now() - (this.lastPlayStartTime || 0)) / 1000;
                // Cap progress at total duration
                if (this.duration > 0 && this.currentTime > this.duration) {
                    // Process: this.currentTime = this.duration
                    this.currentTime = this.duration;
                }
                // Process: this._emitStatusUpdate(true)
                this._emitStatusUpdate(true);
            }
        // Process: , 1000)
        }, 1000);
    }

    /**
     * Stops the progress timer.
     * @private
     */
    // Process: _stopTimer()
    _stopTimer() {
        if (this.timer) {
            // Process: clearInterval(this.timer)
            clearInterval(this.timer);
            this.timer = null;
        // Process:
        }
    }

    /**
     * Gracefully stops and cleans up the active music FFmpeg process.
     * @private
     */
    // Process: _stopMusicStream()
    _stopMusicStream() {
        if (this.activeStreams.has('music')) {
            // Process: const entry = this.activeStreams.get('music')
            const entry = this.activeStreams.get('music');
            // Remove stream from mixer processing
            if (this.mixer) this.mixer.removeInput('music');
            // Process: if (entry.process)
            if (entry.process) {
                try {
                    // Unpipe and terminate the child process
                    // Process: entry.process.stdout.unpipe()
                    entry.process.stdout.unpipe();
                    entry.process.kill('SIGKILL');
                // Process: catch (e)
                } catch (e) {}
            }
            // End the PassThrough stream
            // Process: if (entry.stream && entry.stream.end)
            if (entry.stream && entry.stream.end) {
                entry.stream.end();
            // Process:
            }
            this.activeStreams.delete('music');
        // Process:
        }
    }

    /**
     * Transition logic when a music track finishes naturally.
     * @private
     */
    // Process: _handleMusicFinish()
    _handleMusicFinish() {
        // Calculate total time played for this track
        const elapsed = Date.now() - (this.lastPlayStartTime || 0);
        // Process: this.log(`[AudioPlayer] _handleMusicFinish: elapsed=$elap...
        this.log(`[AudioPlayer] _handleMusicFinish: elapsed=${elapsed}ms, duration=${this.duration}s, loopMode=${this.loopMode}`);

        // Thrashing protection: if track finished in <1s, treat as error
        if (elapsed < 1000 && (this.duration === 0 || this.duration > 2)) {
            // Process: this.log(`[AudioPlayer] Track finished too quickly ($elap...
            this.log(`[AudioPlayer] Track finished too quickly (${elapsed}ms), considering it an error.`);
            this._handlePlaybackError(this.stack[this.currentIndex]);
            // Process: return
            return;
        }

        /**
         * Helper to restart playback with potential delay to prevent mixer saturation.
         */
        // Process: const playWithDelay = () =>
        const playWithDelay = () => {
            if (elapsed < 500) {
                // Process: this.log("[AudioPlayer] Rapid loop detected, delaying res...
                this.log("[AudioPlayer] Rapid loop detected, delaying restart by 200ms.");
                setTimeout(() => this._play(0), 200);
            // Process: else
            } else {
                this._play(0);
            // Process:
            }
        };

        // Transition based on current loop mode
        // Process: if (this.loopMode === 2)
        if (this.loopMode === 2) {
            // Loop Single: Replay current track immediately
            this.log("[AudioPlayer] Loop 1: Restarting current track.");
            // Process: playWithDelay()
            playWithDelay();
        } else if (this.loopMode === 1) {
            // Loop All: Move current track to end of stack and play new top
            // Process: this.log("[AudioPlayer] Loop All: Rolling current track t...
            this.log("[AudioPlayer] Loop All: Rolling current track to bottom.");
            const finished = this.stack.shift();
            // Process: if (finished) this.stack.push(finished)
            if (finished) this.stack.push(finished);
            this.currentIndex = 0;
            // Process: playWithDelay()
            playWithDelay();
        } else {
            // No Loop: Discard finished track
            // Process: this.log("[AudioPlayer] Loop None: Rolling current track ...
            this.log("[AudioPlayer] Loop None: Rolling current track off.");
            this.stack.shift();
            // Process: if (this.stack.length > 0)
            if (this.stack.length > 0) {
                this.currentIndex = 0;
                // Process: this._play(0)
                this._play(0);
            } else {
                // End of playlist
                // Process: this.log("[AudioPlayer] Playlist finished and loop is OFF.")
                this.log("[AudioPlayer] Playlist finished and loop is OFF.");
                this.stop();
            // Process:
            }
        }
    // Process:
    }

    /**
     * Advances to the next track in the stack.
     * @param {boolean} [isError=false] - Whether this skip was triggered by an error.
     * @param {boolean} [forcePlay=false] - Whether to start playing even if currently paused.
     */
    next(isError = false, forcePlay = false) {
        // Capture intention to continue playing
        // Process: const wasPlaying = this.isPlaying || forcePlay
        const wasPlaying = this.isPlaying || forcePlay;
        this.log(`[AudioPlayer] next(isError=${isError}, forcePlay=${forcePlay}) called.`);
        // Process: if (this.stack.length === 0) return
        if (this.stack.length === 0) return;

        // Shuffle logic
        if (this.shuffleMode) {
            // Add current track to history
            // Process: this.playedIndices.push(this.currentIndex)
            this.playedIndices.push(this.currentIndex);
            // Reset history if all tracks have played
            if (this.playedIndices.length >= this.stack.length) this.playedIndices = [];
            // Process: let nextIndex
            let nextIndex;
            // Pick a random track that isn't in recent history
            do {
                // Process: nextIndex = Math.floor(Math.random() * this.stack.length)
                nextIndex = Math.floor(Math.random() * this.stack.length);
            } while (this.playedIndices.includes(nextIndex) && this.stack.length > 1);
            // Process: this.currentIndex = nextIndex
            this.currentIndex = nextIndex;
        } else {
            // Standard linear skip logic
            // Process: if (this.loopMode === 2 && isError)
            if (this.loopMode === 2 && isError) {
                // Restart same track on error if Loop 1 is active
                this.currentIndex = 0;
            // Process: else if (this.loopMode === 1 || this.loopMode === 2)
            } else if (this.loopMode === 1 || this.loopMode === 2) {
                // Move current to bottom for loops
                const current = this.stack.shift();
                // Process: if (current) this.stack.push(current)
                if (current) this.stack.push(current);
                this.currentIndex = 0;
            // Process: else
            } else {
                // Drop track if no loop
                this.stack.shift();
                // Process: if (this.stack.length === 0)
                if (this.stack.length === 0) {
                    this.stop();
                    // Process: return
                    return;
                }
                // Process: this.currentIndex = 0
                this.currentIndex = 0;
            }
        // Process:
        }

        // Start playing the new track if needed
        if (wasPlaying || isError) {
            // Process: this._play()
            this._play();
        } else {
            // Otherwise just update the stack state
            // Process: this.currentTime = 0
            this.currentTime = 0;
            this._emitStatusUpdate();
        // Process:
        }
    }

    /**
     * Jumps to a specific track in the stack by index.
     * @param {number} index - Index to jump to.
     * @param {boolean} [forcePlay=false] - Whether to force playback.
     */
    // Process: jumpTo(index, forcePlay = false)
    jumpTo(index, forcePlay = false) {
        const wasPlaying = this.isPlaying || forcePlay;
        // Process: if (index >= 0 && index < this.stack.length)
        if (index >= 0 && index < this.stack.length) {
            // In the roll-off system, jumping to index X means bumping preceding tracks to the bottom
            const preceding = this.stack.splice(0, index);
            // Process: if (this.loopMode === 1 || this.loopMode === 2)
            if (this.loopMode === 1 || this.loopMode === 2) {
                this.stack.push(...preceding);
            // Process:
            }
            // Target track is now at index 0
            this.currentIndex = 0;
            // Process: this.playLock = false
            this.playLock = false;

            if (wasPlaying) {
                // Process: this._play()
                this._play();
            } else {
                // Process: this.currentTime = 0
                this.currentTime = 0;
                this._emitStatusUpdate();
            // Process:
            }
        }
    // Process:
    }

    /**
     * Reverts to the previous track by pulling from the bottom of the stack.
     * @param {boolean} [forcePlay=false] - Whether to force playback.
     */
    prev(forcePlay = false) {
        // Process: const wasPlaying = this.isPlaying || forcePlay
        const wasPlaying = this.isPlaying || forcePlay;
        if (this.stack.length === 0) return;

        // Pull the last track to the top
        // Process: if (this.loopMode === 1 || this.loopMode === 2)
        if (this.loopMode === 1 || this.loopMode === 2) {
            const last = this.stack.pop();
            // Process: if (last) this.stack.unshift(last)
            if (last) this.stack.unshift(last);
            this.currentIndex = 0;
        // Process: else
        } else {
            // Just restart current if no loop
            this.currentIndex = 0;
        // Process:
        }

        if (wasPlaying) {
            // Process: this._play()
            this._play();
        } else {
            // Process: this.currentTime = 0
            this.currentTime = 0;
            this._emitStatusUpdate();
        // Process:
        }
    }

    /**
     * Explicit play command. Resumes from pause or starts stack.
     */
    // Process: play()
    play() {
        if (this.isPlaying) return;
        // Process: this.playLock = false
        this.playLock = false;
        // Handle resume from paused state
        if (this.playerStatus === AudioPlayerStatus.Paused && this.currentIndex >= 0) {
            // Process: this._play(this.currentTime)
            this._play(this.currentTime);
            return;
        // Process:
        }
        // Initialize index if needed
        if (this.currentIndex < 0 && this.stack.length > 0) this.currentIndex = 0;
        // Start playback
        // Process: if (this.currentIndex >= 0) this._play()
        if (this.currentIndex >= 0) this._play();
    }

    /**
     * Seeks to a specific timestamp in the current track.
     * @param {number} time - Offset in seconds.
     */
    // Process: seek(time)
    seek(time) {
        if (this.currentIndex >= 0 && this.stack.length > 0) {
            // Process: this.log(`[AudioPlayer] Seeking to $times`)
            this.log(`[AudioPlayer] Seeking to ${time}s`);
            this._play(time);
        // Process:
        }
    }

    /**
     * Pauses playback by stopping the music stream.
     */
    // Process: pause()
    pause() {
        this._stopMusicStream();
        // Process: this._stopTimer()
        this._stopTimer();
        this.isPlaying = false;
        // Process: this.playerStatus = AudioPlayerStatus.Paused
        this.playerStatus = AudioPlayerStatus.Paused;
        this._emitStatusUpdate();
    // Process:
    }

    /**
     * Stops playback and resets progress.
     */
    stop() {
        // Process: this._stopMusicStream()
        this._stopMusicStream();
        this._stopTimer();
        // Process: this.isPlaying = false
        this.isPlaying = false;
        this.currentIndex = -1;
        // Process: this.currentTime = 0
        this.currentTime = 0;
        this.duration = 0;
        // Process: this.consecutiveErrors = 0
        this.consecutiveErrors = 0;
        this.recoveryAttempts = [];
        // Process: this.playerStatus = AudioPlayerStatus.Idle
        this.playerStatus = AudioPlayerStatus.Idle;
        this._emitStatusUpdate();
    // Process:
    }

    // --- Soundboard API ---

    /**
     * Plays a sound effect on a specific soundboard slot.
     * @param {string} filePath - Path to SFX file.
     * @param {number} slotId - Slot identifier.
     */
    playSound(filePath, slotId) {
        // Process: this.log(`[AudioPlayer] Soundboard: Playing slot $slotId`)
        this.log(`[AudioPlayer] Soundboard: Playing slot ${slotId}`);
        const id = `sfx_${slotId}`;
        // Stop any sound currently playing on this slot
        // Process: this.stopSound(slotId)
        this.stopSound(slotId);

        try {
            // Spawn FFmpeg for the sound effect
            // Process: const ffmpegProcess = this._createFfmpegStream(filePath)
            const ffmpegProcess = this._createFfmpegStream(filePath);
            const stream = ffmpegProcess.stdout;

            // Handle music ducking when SFX starts
            // Process: if (this.activeSfxCount === 0 && this.activeStreams.has('...
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                this.mixer.setInputVolume('music', this.playbackVolume * this.duckingVolume);
            // Process:
            }
            this.activeSfxCount++;

            // Handle SFX completion
            // Process: stream.once('close', () =>
            stream.once('close', () => {
                if (this.activeStreams.has(id)) {
                    // Process: this.activeStreams.delete(id)
                    this.activeStreams.delete(id);
                    this.mixer.removeInput(id);
                    // Notify UI that slot is free
                    // Process: this.emit('sound-finished', slotId)
                    this.emit('sound-finished', slotId);
                    this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
                    // Restore music volume if all SFX finished
                    // Process: if (this.activeSfxCount === 0 && this.activeStreams.has('...
                    if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                        this.mixer.setInputVolume('music', this.playbackVolume);
                    // Process:
                    }
                }
            // Process: )
            });

            // Add sound to mixer with independent volume
            this.mixer.addInput(stream, id, this.soundboardVolume);
            // Process: this.activeStreams.set(id,  process: ffmpegProcess, stream )
            this.activeStreams.set(id, { process: ffmpegProcess, stream });
        } catch (error) {
            // Process: this.log(`[AudioPlayer] SFX Error: $error.message`)
            this.log(`[AudioPlayer] SFX Error: ${error.message}`);
        }
    // Process:
    }

    /**
     * Terminates a sound effect by slot ID.
     * @param {number} slotId - Slot to stop.
     */
    stopSound(slotId) {
        // Process: const id = `sfx_$slotId`
        const id = `sfx_${slotId}`;
        if (this.activeStreams.has(id)) {
            // Process: const  process  = this.activeStreams.get(id)
            const { process } = this.activeStreams.get(id);
            // Remove from mixer and kill process
            this.mixer.removeInput(id);
            // Process: if (process) process.kill()
            if (process) process.kill();
            this.activeStreams.delete(id);

            // Handle volume restoration
            // Process: this.activeSfxCount = Math.max(0, this.activeSfxCount - 1)
            this.activeSfxCount = Math.max(0, this.activeSfxCount - 1);
            if (this.activeSfxCount === 0 && this.activeStreams.has('music')) {
                // Process: this.mixer.setInputVolume('music', this.playbackVolume)
                this.mixer.setInputVolume('music', this.playbackVolume);
            }
        // Process:
        }
    }

    /**
     * Sets the volume for all soundboard effects.
     * @param {number} volume - Multiplier.
     */
    // Process: setSoundboardVolume(volume)
    setSoundboardVolume(volume) {
        this.soundboardVolume = volume;
        // Update all active SFX inputs in the mixer
        // Process: this.activeStreams.forEach((value, id) =>
        this.activeStreams.forEach((value, id) => {
            if (id.startsWith('sfx_')) this.mixer.setInputVolume(id, volume);
        // Process: )
        });
    }

    /**
     * Recursively retrieves all music files from the music root folder.
     * @returns {string[]} List of full file paths.
     */
    // Process: getMusicFiles()
    getMusicFiles() {
        if (!this.musicFolder || !fs.existsSync(this.musicFolder)) return [];

        /**
         * Helper to traverse directories.
         */
        // Process: const getAllFiles = (dir, results = []) =>
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            // Process: list.forEach(file =>
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                // Process: const stat = fs.statSync(fullPath)
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    // Process: getAllFiles(fullPath, results)
                    getAllFiles(fullPath, results);
                } else {
                    // Process: const ext = path.extname(fullPath).toLowerCase()
                    const ext = path.extname(fullPath).toLowerCase();
                    // Include supported audio and shortcuts
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) {
                        // Process: results.push(fullPath)
                        results.push(fullPath);
                    }
                // Process:
                }
            });
            // Process: return results
            return results;
        };

        // Process: return getAllFiles(this.musicFolder)
        return getAllFiles(this.musicFolder);
    }

    /**
     * Retrieves the path of the file that would be previewed (current or top of stack).
     * @returns {string|null}
     */
    // Process: getPreviewFilePath()
    getPreviewFilePath() {
        if (this.currentIndex >= 0 && this.currentIndex < this.stack.length) {
            // Process: return this.stack[this.currentIndex]
            return this.stack[this.currentIndex];
        } else if (this.stack.length > 0) {
            // Process: return this.stack[0]
            return this.stack[0];
        }
        // Process: return null
        return null;
    }

    /**
     * Tears down the audio player and all active processes.
     */
    // Process: destroy()
    destroy() {
        this.isDestroyed = true;
        // Stop Discord player
        // Process: if (this.player) this.player.stop()
        if (this.player) this.player.stop();
        // Kill all FFmpeg processes
        this.activeStreams.forEach(({ process }) => {
            // Process: try  if (process) process.kill()  catch (e)
            try { if (process) process.kill(); } catch (e) {}
        });
        // Process: this.activeStreams.clear()
        this.activeStreams.clear();
        // Terminate the mixer worker
        if (this.mixer) this.mixer.destroy();
    // Process:
    }
}

// Process: module.exports = BackendAudioPlayer
module.exports = BackendAudioPlayer;
