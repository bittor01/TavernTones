const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electron', {
  path: {
    basename: path.basename
  },
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = [
        'push-initiative',
        'play-music', 'pause-music', 'roll-dice',
        'add-creature', 'next-turn', 'previous-turn',
        'update-hp', 'add-condition', 'remove-condition',
        'update-creature-flag', 'show-reminders-dialog',
        'save-encounter', 'load-encounter', 'update-reminders',
        'roll-stat', 'add-temp-hp', 'edit-creature',
        'remove-creature', 'move-creature-bottom',
        'reset-encounter', 'clear-encounter', 'update-initiative',
        'copy-creature', 'window-ready',
        'load-music-file', // Added for music player
        'load-sound', 'play-sound', 'stop-sound', 'unload-sound',
        'set-loop', 'set-soundboard-volume', 'request-initial-load',
        'push-dicelog-to-discord', 'push-statblock-to-discord',
        'open-gamify-tool', 'save-high-score', 'open-settings-window',
        'roll-attack', 'push-mob-rules-to-discord', 'save-soundboard-state'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel, data) => {
      const validChannels = [
        'open-file-dialog', 'get-default-local-folder', 'get-dnd-conditions',
        'load-encounter-dialog', 'search-monsters', 'get-monster-details',
        'get-task-data', 'save-and-get-next-spell', 'undo-and-get-previous-spell',
        'get-high-score', 'load-task-by-path', 'open-task-file-dialog',
        'scrap-and-get-next-item', 'show-confirm-dialog', 'get-mob-rules-data',
        'get-image-as-data-url', 'get-preview-audio-data', 'load-sound',
        'get-soundboard-state', 'save-soundboard-preset', 'load-soundboard-preset', 'open-soundboard-file-dialog'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['log-message', 'music-player-status', 'dice-log', 'update-initiative-list', 'populate-edit-form', 'soundboard-state-change', 'populate-add-form', 'sound-finished'];
      if (validChannels.includes(channel)) {
        const subscription = (event, ...args) => func(event, ...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    off: (channel, callback) => {
      const validChannels = ['log-message', 'dice-log', 'update-initiative-list'];
      if (validChannels.includes(channel)) {
        ipcRenderer.off(channel, callback);
      }
    },
    once: (channel, callback) => {
      const validChannels = [];
      if (validChannels.includes(channel)) {
        ipcRenderer.once(channel, callback);
      }
    }
  }
});