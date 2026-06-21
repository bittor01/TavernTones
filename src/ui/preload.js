const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

/**
 * Expose safe, limited APIs to the renderer process (frontend).
 * This follows the Electron security best practice of context isolation.
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Safe access to path-related functions.
   */
  path: {
    // Allows UI to get the base filename without exposing the whole path module
    basename: path.basename
  },

  /**
   * Wrapped IPC methods to prevent the renderer from accessing arbitrary channels.
   */
  ipcRenderer: {
    /**
     * Sends an asynchronous message to the main process via specified channels.
     * @param {string} channel - The IPC channel name.
     * @param {...any} args - Data to send.
     */
    send: (channel, ...args) => {
      // Whitelist of allowed asynchronous channels for security
      const validChannels = [
        'push-initiative',
        'play-music', 'pause-music', 'roll-dice',
        'add-creature', 'next-turn', 'previous-turn',
        'update-hp', 'add-condition', 'remove-condition',
        'update-creature-flag', 'show-reminders-dialog',
        'save-encounter', 'load-encounter', 'update-reminders',
        'roll-stat', 'add-temp-hp', 'edit-creature', 'update-creature',
        'remove-creature', 'move-creature-bottom',
        'reset-encounter', 'clear-encounter', 'update-initiative',
        'copy-creature', 'window-ready',
        'load-music-file',
        'load-sound', 'play-sound', 'stop-sound', 'unload-sound',
        'set-loop', 'set-soundboard-volume', 'request-initial-load',
        'push-dicelog-to-discord', 'push-statblock-to-discord',
        'open-gamify-tool', 'save-high-score', 'open-settings-window',
        'roll-attack', 'push-mob-rules-to-discord', 'save-soundboard-state',
        'play-next', 'play-prev', 'set-loop-mode', 'set-shuffle', 'remove-from-stack', 'clear-stack',
        'request-bot-status', 'voice-toggle', 'jump-to-track', 'play-now',
        'library-action', 'get-discord-config', 'seek-music', 'set-discord-config',
        'show-emoji-panel', 'open-walkthrough', 'update-death-saves', 'roll-death-save'
      ];
      // Only forward message if channel is in the whitelist
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },

    /**
     * Sends an asynchronous request to the main process and waits for a response.
     * @param {string} channel - The IPC channel name.
     * @param {...any} args - Data to send.
     * @returns {Promise<any>} Response from the main process.
     */
    invoke: (channel, ...args) => {
      // Whitelist of allowed synchronous (invokable) channels
      const validChannels = [
        'open-file-dialog', 'get-default-local-folder', 'get-dnd-conditions',
        'load-encounter-dialog', 'search-monsters', 'get-monster-details',
        'get-task-data', 'save-and-get-next-spell', 'undo-and-get-previous-spell',
        'get-high-score', 'load-task-by-path', 'open-task-file-dialog',
        'scrap-and-get-next-item', 'show-confirm-dialog', 'get-mob-rules-data',
        'get-image-as-data-url', 'get-preview-audio-data', 'load-sound',
        'get-soundboard-state', 'save-soundboard-preset', 'load-soundboard-preset',
        'read-combat-file', 'save-music-preset', 'load-music-preset',
        'get-music-library', 'rescan-music-library'
      ];
      // Forward request only for whitelisted channels
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    },

    /**
     * Registers a listener for messages from the main process.
     * @param {string} channel - The IPC channel name.
     * @param {function} func - The callback function.
     * @returns {function} Cleanup function to remove the listener.
     */
    on: (channel, func) => {
      // Whitelist of allowed incoming channels
      const validChannels = [
        'log-message', 'music-player-status', 'dice-log',
        'update-initiative-list', 'populate-edit-form',
        'soundboard-state-change', 'populate-add-form',
        'sound-finished', 'discord-bot-status',
        'switch-panel', 'music-library-update', 'discord-config'
      ];
      if (validChannels.includes(channel)) {
        // Create an internal subscription wrapper
        const subscription = (event, ...args) => func(event, ...args);
        // Register the listener
        ipcRenderer.on(channel, subscription);

        // Return a cleanup function for React-style or lifecycle management
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },

    /**
     * Explicitly removes a listener from an IPC channel.
     * @param {string} channel - The IPC channel name.
     * @param {function} callback - The callback to remove.
     */
    off: (channel, callback) => {
      const validChannels = ['log-message', 'dice-log', 'update-initiative-list'];
      if (validChannels.includes(channel)) {
        ipcRenderer.off(channel, callback);
      }
    },

    /**
     * Registers a listener that fires only once.
     * @param {string} channel - The IPC channel name.
     * @param {function} callback - The callback function.
     */
    once: (channel, callback) => {
      const validChannels = []; // No current 'once' channels required
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, callback);
      }
    }
  }
});
