const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('emojiAPI', {
  submit: (emoji) => {
    ipcRenderer.send('submit-emoji', emoji);
  }
});
