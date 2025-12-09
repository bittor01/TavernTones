# TavernTones Development Guide

This document provides a high-level overview of the TavernTones application and its new documentation structure. For detailed information on specific parts of the application, please refer to the other documents in this folder.

- **[Backend Core Documentation](./backend_core.md)**: An overview of the application's architecture, key core files, and the IPC communication system.

- **[UI Documentation](./ui.md)**: Documentation for the Electron-based user interface, including the Initiative Tracker and Soundboard.

- **[File Reference](./file_reference.md)**: A reference guide to the purpose of important files and directories in the project (will be updated at the end of this reorganization).

# Development Notes

## Headless Environment and Hardware Acceleration

When running the application in a headless environment for testing (e.g., using `xvfb-run` for Playwright), you may encounter a startup crash related to the GPU process. This is because Electron's hardware acceleration is not compatible with a virtual display.

To fix this, you must temporarily disable hardware acceleration in `src/backend/core/main.js` by adding the following line:

```javascript
app.disableHardwareAcceleration();
```

Place this line **before** the `app.whenReady()` block.

**IMPORTANT:** This line should be commented out or removed before creating a final production build, as hardware acceleration is desirable for performance on a user's machine.

## Audio Engine Architecture

The audio system has been refactored to ensure glitch-free playback during heavy main-thread operations (like rapid UI updates or logging).

1.  **BackendAudioPlayer.js**: The main controller. Checks file existence, resolves shortcuts (.lnk), and manages the `ffmpeg` process. It spawns `ffmpeg` with `-re` (real-time) flag to sync playback speed.
2.  **ThreadedAudioMixer.js**: A bridge between the main process and the worker thread. It implements a `Readable` stream interface that Discord's `createAudioResource` can consume. It forwards add/remove/volume commands to the worker.
3.  **AudioMixerWorker.js**: dedicated worker thread that performs the actual audio mixing. It holds the buffers for active streams (Music + SFX), sums the PCM data, applies volume scaling, and posts mixed chunks back to the main thread.

### Playback Flow
`mp3/wav file` -> `ffmpeg (subprocess)` -> `stdout pipe` -> `ThreadedAudioMixer` -> `AudioMixerWorker` -> `Mixed PCM` -> `Discord Voice Connection`
