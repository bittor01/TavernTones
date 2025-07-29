const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      let validChannels = ['play-music', 'pause-music', 'exit-app', 'open-initiative-tracker', 'save-initiative-data', 'open-hp-tracker', 'save-hp-data', 'roll-dice'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel, data) => {
      let validChannels = ['open-file-dialog', 'get-default-local-folder', 'get-initiative-data', 'get-hp-data'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    on: (channel, func) => {
      let validChannels = ['log-message', 'update-gui-state', 'dice-log'];
      if (validChannels.includes(channel)) {
        const subscription = (event, ...args) => func(event, ...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    off: (channel, callback) => {
        let validChannels = ['log-message', 'update-gui-state', 'dice-log'];
        if (validChannels.includes(channel)) {
            ipcRenderer.off(channel, callback);
        }
    },
    once: (channel, callback) => {
        let validChannels = [];
        if (validChannels.includes(channel)) {
            ipcRenderer.once(channel, callback);
        }
    }
  }
});