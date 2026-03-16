// Performance and security update
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settings', {
    // Existing functions
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config)),

    // New functions for folder selection
    selectFolder: (channel) => ipcRenderer.invoke(channel),
    setupDefaultFolders: () => ipcRenderer.invoke('setup-default-folders'),
    detectFfmpeg: () => ipcRenderer.invoke('detect-ffmpeg'),
    selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-file'),
    fetchBestiaryData: (repoUrl, localPath, githubToken) => ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken }),
    registerSlashCommands: () => ipcRenderer.invoke('register-slash-commands'),
    unregisterSlashCommands: () => ipcRenderer.invoke('unregister-slash-commands'),
    onBotStatus: (callback) => ipcRenderer.on('discord-bot-status', (event, status) => callback(status))
});