const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config))
});