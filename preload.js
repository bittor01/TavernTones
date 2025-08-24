const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('electron', {
  path: {
    basename: path.basename
  },
  ipcRenderer: {
    send: (channel, data) => {
      const validChannels = [
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
        'set-loop', 'set-soundboard-volume'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel, data) => {
      const validChannels = ['open-file-dialog', 'get-default-local-folder'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = ['log-message', 'update-gui-state', 'dice-log', 'update-initiative-list', 'populate-edit-form', 'soundboard-state-change'];
      if (validChannels.includes(channel)) {
        const subscription = (event, ...args) => func(event, ...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    off: (channel, callback) => {
      const validChannels = ['log-message', 'update-gui-state', 'dice-log', 'update-initiative-list'];
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