const { createAudioPlayer, AudioPlayerStatus, entersState, VoiceConnectionStatus, createAudioResource } = require('@discordjs/voice');
const { spawn, execFile } = require('child_process');
const { Readable } = require('stream');
const EventEmitter = require('events');
const os = require('os');

class SoundboardAudioMixer extends EventEmitter {
    constructor(logCallback) {
        super();
        this.log = logCallback || console.log;

        // Audio sources
        this.mainTrack = null; // { path: string, volume: float }
        this.soundEffects = new Map(); // K: uniqueId, V: { path: string, volume: float }

        // FFmpeg process
        this.ffmpegProcess = null;
        this.mixedStream = null;

        // Discord.js Voice components
        this.player = createAudioPlayer();
        this.connection = null;

        this.setupPlayerEvents();
    }

    setupPlayerEvents() {
        this.player.on('error', error => {
            this.log(`Error in audio mixer player: ${error.message}`);
            this.stopMixing();
        });
    }

    setConnection(connection) {
        if (!connection) return;
        this.connection = connection;
        this.connection.subscribe(this.player);
    }

    _constructFfmpegArgs() {
        const inputs = [];
        const filterComplex = [];
        const outputMap = [];
        let inputIndex = 0;

        // Add main track if it exists
        if (this.mainTrack && this.mainTrack.path) {
            inputs.push('-i', this.mainTrack.path);
            filterComplex.push(`[${inputIndex}:a]volume=${this.mainTrack.volume}[a${inputIndex}]`);
            outputMap.push(`[a${inputIndex}]`);
            inputIndex++;
        }

        // Add all sound effects
        for (const [id, sfx] of this.soundEffects.entries()) {
            inputs.push('-i', sfx.path);
            filterComplex.push(`[${inputIndex}:a]volume=${sfx.volume}[a${inputIndex}]`);
            outputMap.push(`[a${inputIndex}]`);
            inputIndex++;
        }

        const amixFilter = `amix=inputs=${outputMap.length}:duration=longest`;

        // If there are inputs, build the full filtergraph
        if (outputMap.length > 0) {
            filterComplex.push(`${outputMap.join('')}${amixFilter}[aout]`);
        } else {
             // No inputs, no filtergraph
            return null;
        }

        const args = [
            ...inputs,
            '-filter_complex', filterComplex.join(';'),
            '-map', '[aout]',
            '-f', 'opus', // Discord.js prefers opus
            '-ar', '48000',
            '-ac', '2',
            'pipe:1' // Output to stdout
        ];

        return args;
    }

    _startMixing() {
        if (this.ffmpegProcess) {
            this.log('Mixing process already running. It will be restarted with new inputs.');
            this.stopMixing();
        }

        const args = this._constructFfmpegArgs();
        if (!args) {
            this.log('No audio sources to mix. Player remains idle.');
            return;
        }

        this.log(`Spawning FFmpeg with args: ${args.join(' ')}`);

        // Spawn FFmpeg
        const ffmpegPath = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
        this.ffmpegProcess = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        this.mixedStream = this.ffmpegProcess.stdout;

        // Log FFmpeg errors
        this.ffmpegProcess.stderr.on('data', (data) => {
            this.log(`FFmpeg stderr: ${data}`);
        });

        this.ffmpegProcess.on('close', (code) => {
            this.log(`FFmpeg process exited with code ${code}`);
            if (code !== 0) {
                // Handle unexpected exit
                this.stopMixing();
            }
        });

        const resource = createAudioResource(this.mixedStream);
        this.player.play(resource);
    }

    stopMixing() {
        if (this.ffmpegProcess) {
            this.log('Stopping FFmpeg process.');
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
        }
        if (this.player.state.status !== AudioPlayerStatus.Idle) {
            this.player.stop();
        }
        this.mixedStream = null;
    }

    // --- Private Helpers ---

    _getAudioDuration(filePath) {
        return new Promise((resolve, reject) => {
            const ffprobePath = os.platform() === 'win32' ? 'ffprobe.exe' : 'ffprobe';
            const args = [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ];

            execFile(ffprobePath, args, (error, stdout, stderr) => {
                if (error) {
                    this.log(`ffprobe error for ${filePath}: ${stderr}`);
                    return reject(stderr);
                }
                const duration = parseFloat(stdout);
                if (isNaN(duration)) {
                    return reject('Failed to parse duration from ffprobe output.');
                }
                resolve(duration * 1000); // Convert to milliseconds
            });
        });
    }

    // --- Public API ---

    updateMainTrack(track) { // track can be null or { path: string, volume: float }
        this.mainTrack = track;
        this.log(`Main track updated: ${track ? track.path : 'None'}`);
        this._startMixing();
    }

    async addSoundEffect(id, filePath, volume = 1.0) {
        try {
            const duration = await this._getAudioDuration(filePath);
            this.soundEffects.set(id, { path: filePath, volume: volume });
            this.log(`Added sound effect [${id}]: ${filePath} with duration ${duration}ms`);
            this._startMixing();

            // Schedule removal
            setTimeout(() => {
                this.removeSoundEffect(id);
            }, duration);

        } catch (error) {
            this.log(`Could not add sound effect for ${filePath}. Reason: ${error}`);
        }
    }

    removeSoundEffect(id) {
        if (this.soundEffects.has(id)) {
            this.soundEffects.delete(id);
            this.log(`Removed sound effect [${id}].`);
            this._startMixing();
        }
    }

    clearAll() {
        this.mainTrack = null;
        this.soundEffects.clear();
        this.log('Cleared all audio sources.');
        this.stopMixing();
    }
}

module.exports = SoundboardAudioMixer;
