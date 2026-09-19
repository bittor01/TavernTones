// Import required Node.js core modules for file system manipulation, path resolution, child process spawning, and URL parsing
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { URL } = require('url');

// Import external dependencies for media downloading and metadata fetching
const ytdl = require('@distube/ytdl-core');
const play = require('play-dl');
const axios = require('axios');

/**
 * Utility class providing secure URL metadata extraction and background audio downloading.
 * All inputs are rigorously sanitized to prevent directory traversal, shell injection, and arbitrary file writes.
 */
class UrlDownloader {
    /**
     * @param {string} musicFolder - The absolute root path of the user's Music Library.
     * @param {string} [ffmpegBinFolder] - Optional directory containing FFmpeg binaries.
     * @param {Function} [logCallback] - Callback for logging debug and error messages.
     */
    constructor(musicFolder, ffmpegBinFolder, logCallback) {
        this.musicFolder = musicFolder;
        this.ffmpegBinFolder = ffmpegBinFolder;
        this.log = logCallback || console.log;
        // Track active download processes so they can be canceled if requested
        this.activeDownloads = new Map();
    }

    /**
     * Resolves the executable path for FFmpeg.
     * @returns {string} Absolute path to ffmpeg or fallback executable string.
     */
    getFfmpegPath() {
        if (!this.ffmpegBinFolder) return 'ffmpeg';
        try {
            if (fs.existsSync(this.ffmpegBinFolder) && fs.lstatSync(this.ffmpegBinFolder).isFile()) {
                return this.ffmpegBinFolder;
            }
            const exeName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
            const fullPath = path.join(this.ffmpegBinFolder, exeName);
            if (fs.existsSync(fullPath)) return fullPath;
        } catch (e) {
            this.log(`[UrlDownloader] Error resolving FFmpeg path: ${e.message}`);
        }
        return 'ffmpeg';
    }

    /**
     * Validates that an input URL is well-formed and uses HTTP/HTTPS protocol.
     * @param {string} urlStr - Raw URL string.
     * @returns {URL} Validated URL object.
     */
    validateUrl(urlStr) {
        if (!urlStr || typeof urlStr !== 'string') {
            throw new Error('URL string is required');
        }
        const trimmed = urlStr.trim();
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('Invalid URL protocol. Only HTTP and HTTPS are allowed.');
        }
        return parsed;
    }

    /**
     * Sanitizes a proposed file name to prevent path traversal, null byte injection, and illegal characters.
     * @param {string} rawName - User-provided or fetched file name.
     * @returns {string} Safe filename ending in .mp3.
     */
    sanitizeFileName(rawName) {
        if (!rawName || typeof rawName !== 'string') {
            rawName = 'downloaded_audio';
        }

        // Remove control characters and null bytes
        let clean = rawName.replace(/[\x00-\x1F\x7F]/g, '');

        // Replace relative directory traversal sequences (..)
        clean = clean.replace(/\.\./g, '_');

        // Strip directory separators to prevent path traversal
        clean = clean.replace(/[\/\\]/g, '_');

        // Replace illegal Windows & POSIX filesystem characters
        clean = clean.replace(/[<>:"|?*]/g, '_');

        // Remove leading/trailing dots and spaces
        clean = clean.trim().replace(/^[\.\s]+/, '').replace(/[\.\s]+$/, '');

        // Check for reserved Windows filenames (e.g., CON, PRN, AUX, NUL, COM1-9, LPT1-9)
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
        if (reservedNames.test(clean)) {
            clean = `audio_${clean}`;
        }

        // Ensure length doesn't exceed safe filesystem limits (120 chars max base name)
        if (clean.length > 120) {
            clean = clean.substring(0, 120);
        }

        // Default fallback if string is empty after cleaning
        if (!clean || clean.trim() === '') {
            clean = 'downloaded_track';
        }

        // Ensure .mp3 extension
        if (!clean.toLowerCase().endsWith('.mp3')) {
            clean += '.mp3';
        }

        return clean;
    }

    /**
     * Validates that the target destination folder resides safely within the configured Music Library directory.
     * Prevents path traversal vulnerabilities (`../`).
     * @param {string} targetFolder - Absolute or relative target directory.
     * @returns {string} Resolved and validated absolute path to target directory.
     */
    validateDestinationFolder(targetFolder) {
        if (!this.musicFolder) {
            throw new Error('Music Library root directory is not configured.');
        }

        const resolvedMusicFolder = path.resolve(this.musicFolder);
        const resolvedTargetFolder = targetFolder ? path.resolve(targetFolder) : resolvedMusicFolder;

        // Check relative path to verify target resides inside musicFolder
        const relative = path.relative(resolvedMusicFolder, resolvedTargetFolder);
        const isInside = relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

        if (!isInside) {
            throw new Error(`Security Violation: Target folder '${resolvedTargetFolder}' is outside the Music Library '${resolvedMusicFolder}'.`);
        }

        return resolvedTargetFolder;
    }

    /**
     * Fetches metadata (title/author) for a given URL without downloading the audio payload.
     * @param {string} urlStr - The URL to inspect.
     * @returns {Promise<{title: string, author: string, source: string}>} Resolved title and details.
     */
    async fetchUrlDetails(urlStr) {
        this.validateUrl(urlStr);
        const urlLower = urlStr.toLowerCase();

        // 1. YouTube metadata extraction via @distube/ytdl-core or play-dl
        if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
            try {
                if (ytdl.validateURL(urlStr)) {
                    const info = await ytdl.getBasicInfo(urlStr);
                    if (info && info.videoDetails && info.videoDetails.title) {
                        return {
                            title: info.videoDetails.title,
                            author: info.videoDetails.author ? info.videoDetails.author.name : 'YouTube',
                            source: 'YouTube'
                        };
                    }
                }
            } catch (err) {
                this.log(`[UrlDownloader] ytdl.getBasicInfo error: ${err.message}. Trying play-dl...`);
            }

            try {
                const playInfo = await play.video_info(urlStr);
                if (playInfo && playInfo.video_details && playInfo.video_details.title) {
                    return {
                        title: playInfo.video_details.title,
                        author: playInfo.video_details.channel ? playInfo.video_details.channel.name : 'YouTube',
                        source: 'YouTube'
                    };
                }
            } catch (err) {
                this.log(`[UrlDownloader] play-dl video_info error: ${err.message}`);
            }
        }

        // 2. SoundCloud metadata extraction via play-dl
        if (urlLower.includes('soundcloud.com')) {
            try {
                const scInfo = await play.soundcloud(urlStr);
                if (scInfo && scInfo.name) {
                    return {
                        title: scInfo.name,
                        author: scInfo.publisher ? scInfo.publisher.artist : 'SoundCloud',
                        source: 'SoundCloud'
                    };
                }
            } catch (err) {
                this.log(`[UrlDownloader] play-dl soundcloud error: ${err.message}`);
            }
        }

        // 3. Fallback: Direct audio or Web Page HTTP title extraction via Axios
        try {
            const response = await axios.get(urlStr, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                responseType: 'text'
            });

            // If html body returned, extract <title> tag
            if (typeof response.data === 'string') {
                const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    const cleanTitle = titleMatch[1].trim().replace(/\s+/g, ' ');
                    return {
                        title: cleanTitle,
                        author: 'Web Media',
                        source: 'Web'
                    };
                }
            }
        } catch (err) {
            this.log(`[UrlDownloader] HTTP title fetch error: ${err.message}`);
        }

        // 4. Default fallback: derive name from URL pathname
        const parsed = new URL(urlStr);
        let baseName = path.basename(parsed.pathname);
        if (!baseName || baseName === '/' || baseName === '.') {
            baseName = parsed.hostname;
        }

        return {
            title: baseName,
            author: parsed.hostname,
            source: 'Direct Stream'
        };
    }

    /**
     * Downloads audio from a URL, encodes it as an MP3 using FFmpeg, and writes it safely to disk.
     * Runs asynchronously without blocking the Electron main thread.
     *
     * @param {Object} options - Configuration for download.
     * @param {string} options.downloadId - Unique identifier for cancellation tracking.
     * @param {string} options.url - Source URL.
     * @param {string} options.fileName - User-confirmed target file name.
     * @param {string} options.targetFolder - Destination folder path.
     * @param {Function} [options.onProgress] - Callback for progress reporting ({percent, status}).
     * @returns {Promise<{success: boolean, filePath: string, fileName: string}>} Download result object.
     */
    async downloadUrlToMp3({ downloadId, url, fileName, targetFolder, onProgress }) {
        // Validate input URL and target folder
        this.validateUrl(url);
        const resolvedFolder = this.validateDestinationFolder(targetFolder);
        const sanitizedFileName = this.sanitizeFileName(fileName);
        const finalFilePath = path.join(resolvedFolder, sanitizedFileName);

        // Ensure destination folder exists
        if (!fs.existsSync(resolvedFolder)) {
            fs.mkdirSync(resolvedFolder, { recursive: true });
        }

        const reportProgress = (percent, status) => {
            if (typeof onProgress === 'function') {
                onProgress({ downloadId, percent, status, filePath: finalFilePath });
            }
        };

        reportProgress(0, 'Initializing download process...');
        this.log(`[UrlDownloader] Starting download from ${url} to ${finalFilePath}`);

        const ffmpegPath = this.getFfmpegPath();
        const urlLower = url.toLowerCase();

        return new Promise((resolve, reject) => {
            let ffmpegProcess = null;
            let inputStream = null;

            const cleanup = () => {
                if (downloadId && this.activeDownloads.has(downloadId)) {
                    this.activeDownloads.delete(downloadId);
                }
            };

            // Setup YouTube streaming if applicable
            if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
                try {
                    reportProgress(10, 'Connecting to YouTube audio stream...');
                    // Use @distube/ytdl-core for audio streaming
                    inputStream = ytdl(url, {
                        filter: 'audioonly',
                        quality: 'highest'
                    });

                    inputStream.on('progress', (chunkLength, downloaded, total) => {
                        if (total) {
                            const pct = Math.min(95, Math.round((downloaded / total) * 100));
                            reportProgress(pct, `Downloading audio: ${pct}%`);
                        }
                    });

                    let ytdlErrorOccurred = false;
                    let ytdlErrorMessage = '';

                    inputStream.on('error', (err) => {
                        this.log(`[UrlDownloader] ytdl stream error: ${err.message}`);
                        ytdlErrorOccurred = true;
                        ytdlErrorMessage = err.message;
                        if (ffmpegProcess) {
                            ffmpegProcess.kill('SIGKILL');
                        }
                    });

                    // Pipe ytdl output into FFmpeg for encoding to MP3
                    const ffmpegArgs = [
                        '-y',
                        '-i', 'pipe:0',
                        '-vn',
                        '-ar', '44100',
                        '-ac', '2',
                        '-b:a', '192k',
                        '-f', 'mp3',
                        finalFilePath
                    ];

                    ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
                    if (downloadId) this.activeDownloads.set(downloadId, { ffmpegProcess, inputStream });

                    inputStream.pipe(ffmpegProcess.stdin);

                    ffmpegProcess.stderr.on('data', (data) => {
                        // Monitor FFmpeg logs if needed
                    });

                    ffmpegProcess.on('close', (code) => {
                        cleanup();
                        if (code === 0 && fs.existsSync(finalFilePath) && !ytdlErrorOccurred) {
                            reportProgress(100, 'Download complete!');
                            resolve({ success: true, filePath: finalFilePath, fileName: sanitizedFileName });
                        } else {
                            // If failed, clean up partial download
                            if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
                            if (ytdlErrorOccurred) {
                                reject(new Error(`YouTube stream failed: ${ytdlErrorMessage || 'Audio stream error'}`));
                            } else {
                                reject(new Error(`FFmpeg processing failed with exit code ${code}`));
                            }
                        }
                    });

                    ffmpegProcess.on('error', (err) => {
                        cleanup();
                        if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
                        reject(err);
                    });

                    return;
                } catch (err) {
                    this.log(`[UrlDownloader] YouTube stream setup error: ${err.message}`);
                }
            }

            // Fallback for SoundCloud or Direct HTTP/Audio URLs via FFmpeg directly or play-dl stream
            reportProgress(15, 'Streaming and converting media via FFmpeg...');

            // Pass URL directly to FFmpeg for direct network stream fetching
            const ffmpegArgs = [
                '-y',
                '-i', url,
                '-vn',
                '-ar', '44100',
                '-ac', '2',
                '-b:a', '192k',
                '-f', 'mp3',
                finalFilePath
            ];

            ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
            if (downloadId) this.activeDownloads.set(downloadId, { ffmpegProcess });

            ffmpegProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                // Extract duration/time progress from FFmpeg output if present
                const timeMatch = msg.match(/time=(\d+):(\d+):(\d+)\.\d+/);
                if (timeMatch) {
                    reportProgress(50, 'Converting audio to MP3...');
                }
            });

            ffmpegProcess.on('close', (code) => {
                cleanup();
                if (code === 0 && fs.existsSync(finalFilePath)) {
                    reportProgress(100, 'Download complete!');
                    resolve({ success: true, filePath: finalFilePath, fileName: sanitizedFileName });
                } else {
                    if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
                    reject(new Error(`FFmpeg stream download failed with exit code ${code}`));
                }
            });

            ffmpegProcess.on('error', (err) => {
                cleanup();
                if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath);
                reject(err);
            });
        });
    }

    /**
     * Cancels an active download process by its ID.
     * @param {string} downloadId - The unique download identifier.
     */
    cancelDownload(downloadId) {
        if (this.activeDownloads.has(downloadId)) {
            const { ffmpegProcess, inputStream } = this.activeDownloads.get(downloadId);
            if (inputStream && typeof inputStream.destroy === 'function') {
                inputStream.destroy();
            }
            if (ffmpegProcess) {
                ffmpegProcess.kill('SIGKILL');
            }
            this.activeDownloads.delete(downloadId);
            this.log(`[UrlDownloader] Canceled download ${downloadId}`);
        }
    }
}

module.exports = UrlDownloader;
