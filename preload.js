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
        'load-sound', 'play-sound', 'stop-sound', 'unload-sound',
        'set-loop', 'set-soundboard-volume', 'request-initial-load',
        'push-dicelog-to-discord', 'push-statblock-to-discord',
        'open-gamify-tool', 'save-high-score'
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
          'get-high-score', 'load-task-by-path'
        ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['log-message', 'music-player-status', 'dice-log', 'update-initiative-list', 'populate-edit-form', 'soundboard-state-change'];
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