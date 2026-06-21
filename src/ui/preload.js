// Import contextBridge and ipcRenderer to create a secure bridge between the main and renderer processes
const { contextBridge, ipcRenderer } = require('electron');
// Import path to provide basic path manipulation utilities to the frontend
const path = require('path');

/**
 * The preload script acts as a secure intermediary.
 * It exposes a limited set of APIs to the 'window.electron' object in the renderer.
 * This prevents the frontend from having direct access to Node.js internals (Security).
 */
contextBridge.exposeInMainWorld('electron', {
  // Expose specific path utilities
  path: {
    // Allows the UI to extract filenames from absolute paths
    basename: path.basename
  },
  // Expose a restricted set of IPC methods
  ipcRenderer: {
    /**
     * Sends an asynchronous message to the main process via a channel.
     * Includes a whitelist check to ensure only authorized messages are sent.
     */
    send: (channel, ...args) => {
      // List of all IPC channels that the renderer is allowed to 'send' to
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
      // Only forward the message if the channel is in the whitelist
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },

    /**
     * Sends an IPC message and waits for a response (Promise-based).
     */
    invoke: (channel, ...args) => {
      // Whitelist for 'invoke' (request-response) channels
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
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
    },

    /**
     * Registers a listener for messages coming FROM the main process.
     * Returns a cleanup function to remove the listener.
     */
    on: (channel, func) => {
      // Whitelist for incoming events
      const validChannels = ['log-message', 'music-player-status', 'dice-log', 'update-initiative-list', 'populate-edit-form', 'soundboard-state-change', 'populate-add-form', 'sound-finished', 'discord-bot-status', 'switch-panel', 'music-library-update', 'discord-config'];
      if (validChannels.includes(channel)) {
        // Wrapper function to ensure the original event object isn't leaked directly
        const subscription = (event, ...args) => func(event, ...args);
        ipcRenderer.on(channel, subscription);
        // Return an unsubscription helper
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },

    /**
     * Manually removes a listener from a specific channel.
     */
    off: (channel, callback) => {
      const validChannels = ['log-message', 'dice-log', 'update-initiative-list'];
      if (validChannels.includes(channel)) {
        ipcRenderer.off(channel, callback);
      }
    },

    /**
     * Registers a listener that triggers once and then automatically removes itself.
     */
    once: (channel, callback) => {
      const validChannels = []; // Currently no 'once' channels are whitelisted
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, callback);
      }
    }
  }
});
