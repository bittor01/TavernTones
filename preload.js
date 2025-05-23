const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Expose the custom method for opening file dialogs
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Expose the ipcRenderer methods
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    off: (channel, callback) => ipcRenderer.off(channel, callback),
    once: (channel, callback) => ipcRenderer.once(channel, callback),
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  }
});