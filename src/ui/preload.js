// Process: const  contextBridge, ipcRenderer  = require('electron')
const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

/**
 * Expose safe, limited APIs to the renderer process (frontend).
 * This follows the Electron security best practice of context isolation.
 */
// Process: contextBridge.exposeInMainWorld('electron',
contextBridge.exposeInMainWorld('electron', {
  /**
   * Safe access to path-related functions.
   */
  path: {
    // Allows UI to get the base filename without exposing the whole path module
    // Process: basename: path.basename
    basename: path.basename
  },

  /**
   * Wrapped IPC methods to prevent the renderer from accessing arbitrary channels.
   */
  // Process: ipcRenderer:
  ipcRenderer: {
    /**
     * Sends an asynchronous message to the main process via specified channels.
     * @param {string} channel - The IPC channel name.
     * @param {...any} args - Data to send.
     */
    send: (channel, ...args) => {
      // Whitelist of allowed asynchronous channels for security
      // Process: const validChannels = [
      const validChannels = [
        'push-initiative',
        // Process: 'play-music', 'pause-music', 'roll-dice',
        'play-music', 'pause-music', 'roll-dice',
        'add-creature', 'next-turn', 'previous-turn',
        // Process: 'update-hp', 'add-condition', 'remove-condition',
        'update-hp', 'add-condition', 'remove-condition',
        'update-creature-flag', 'show-reminders-dialog',
        // Process: 'save-encounter', 'load-encounter', 'update-reminders',
        'save-encounter', 'load-encounter', 'update-reminders',
        'roll-stat', 'add-temp-hp', 'edit-creature', 'update-creature',
        // Process: 'remove-creature', 'move-creature-bottom',
        'remove-creature', 'move-creature-bottom',
        'reset-encounter', 'clear-encounter', 'update-initiative',
        // Process: 'copy-creature', 'window-ready',
        'copy-creature', 'window-ready',
        'load-music-file',
        // Process: 'load-sound', 'play-sound', 'stop-sound', 'unload-sound',
        'load-sound', 'play-sound', 'stop-sound', 'unload-sound',
        'set-loop', 'set-soundboard-volume', 'request-initial-load',
        // Process: 'push-dicelog-to-discord', 'push-statblock-to-discord',
        'push-dicelog-to-discord', 'push-statblock-to-discord',
        'open-gamify-tool', 'save-high-score', 'open-settings-window',
        // Process: 'roll-attack', 'push-mob-rules-to-discord', 'save-soundbo...
        'roll-attack', 'push-mob-rules-to-discord', 'save-soundboard-state',
        'play-next', 'play-prev', 'set-loop-mode', 'set-shuffle', 'remove-from-stack', 'clear-stack',
        // Process: 'request-bot-status', 'voice-toggle', 'jump-to-track', 'p...
        'request-bot-status', 'voice-toggle', 'jump-to-track', 'play-now',
        'library-action', 'get-discord-config', 'seek-music', 'set-discord-config',
        // Process: 'show-emoji-panel', 'open-walkthrough', 'update-death-sav...
        'show-emoji-panel', 'open-walkthrough', 'update-death-saves', 'roll-death-save'
      ];
      // Only forward message if channel is in the whitelist
      // Process: if (validChannels.includes(channel))
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      // Process:
      }
    },

    /**
     * Sends an asynchronous request to the main process and waits for a response.
     * @param {string} channel - The IPC channel name.
     * @param {...any} args - Data to send.
     * @returns {Promise<any>} Response from the main process.
     */
    // Process: invoke: (channel, ...args) =>
    invoke: (channel, ...args) => {
      // Whitelist of allowed synchronous (invokable) channels
      const validChannels = [
        // Process: 'open-file-dialog', 'get-default-local-folder', 'get-dnd-...
        'open-file-dialog', 'get-default-local-folder', 'get-dnd-conditions',
        'load-encounter-dialog', 'search-monsters', 'get-monster-details',
        // Process: 'get-task-data', 'save-and-get-next-spell', 'undo-and-get...
        'get-task-data', 'save-and-get-next-spell', 'undo-and-get-previous-spell',
        'get-high-score', 'load-task-by-path', 'open-task-file-dialog',
        // Process: 'scrap-and-get-next-item', 'show-confirm-dialog', 'get-mo...
        'scrap-and-get-next-item', 'show-confirm-dialog', 'get-mob-rules-data',
        'get-image-as-data-url', 'get-preview-audio-data', 'load-sound',
        // Process: 'get-soundboard-state', 'save-soundboard-preset', 'load-s...
        'get-soundboard-state', 'save-soundboard-preset', 'load-soundboard-preset',
        'read-combat-file', 'save-music-preset', 'load-music-preset',
        // Process: 'get-music-library', 'rescan-music-library'
        'get-music-library', 'rescan-music-library'
      ];
      // Forward request only for whitelisted channels
      // Process: if (validChannels.includes(channel))
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      // Process:
      }
    },

    /**
     * Registers a listener for messages from the main process.
     * @param {string} channel - The IPC channel name.
     * @param {function} func - The callback function.
     * @returns {function} Cleanup function to remove the listener.
     */
    // Process: on: (channel, func) =>
    on: (channel, func) => {
      // Whitelist of allowed incoming channels
      const validChannels = [
        // Process: 'log-message', 'music-player-status', 'dice-log',
        'log-message', 'music-player-status', 'dice-log',
        'update-initiative-list', 'populate-edit-form',
        // Process: 'soundboard-state-change', 'populate-add-form',
        'soundboard-state-change', 'populate-add-form',
        'sound-finished', 'discord-bot-status',
        // Process: 'switch-panel', 'music-library-update', 'discord-config'
        'switch-panel', 'music-library-update', 'discord-config'
      ];

      // Process: if (validChannels.includes(channel))
      if (validChannels.includes(channel)) {
        // Create an internal subscription wrapper
        const subscription = (event, ...args) => func(event, ...args);
        // Register the listener
        // Process: ipcRenderer.on(channel, subscription)
        ipcRenderer.on(channel, subscription);

        // Return a cleanup function for React-style or lifecycle management
        return () => {
          // Process: ipcRenderer.removeListener(channel, subscription)
          ipcRenderer.removeListener(channel, subscription);
        };
      // Process:
      }
    },

    /**
     * Explicitly removes a listener from an IPC channel.
     * @param {string} channel - The IPC channel name.
     * @param {function} callback - The callback to remove.
     */
    // Process: off: (channel, callback) =>
    off: (channel, callback) => {
      const validChannels = ['log-message', 'dice-log', 'update-initiative-list'];
      // Process: if (validChannels.includes(channel))
      if (validChannels.includes(channel)) {
        ipcRenderer.off(channel, callback);
      // Process:
      }
    },

    /**
     * Registers a listener that fires only once.
     * @param {string} channel - The IPC channel name.
     * @param {function} callback - The callback function.
     */
    // Process: once: (channel, callback) =>
    once: (channel, callback) => {
      const validChannels = []; // No current 'once' channels required
      // Process: if (validChannels.includes(channel))
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, callback);
      // Process:
      }
    }
  // Process:
  }
});