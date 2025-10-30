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

# Future Enhancements

This section lists planned features and improvements for future development cycles.

## Soundboard
- **Advanced Playlist Management**: Instead of a simple "Clear All" button, implement a popup dialog for the `🗑️` button that gives the user options to remove the last sound played, the last sound added, or the entire playlist.
- **Save/Load Presets**: Add functionality to manually save the current soundboard configuration to a named JSON file (e.g., "Campaign A Sounds") and load these presets back in. This will allow users to have different soundboard setups for different games.
- **Per-Stack Volume Sliders**: Add an individual volume slider to each sound stack, allowing for finer control over the audio mix.
