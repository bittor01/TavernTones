// Performance and security update
const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('settings', {
    // Existing functions
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config)),

    // New functions for folder selection
    selectFolder: (channel) => ipcRenderer.invoke(channel),
    setupDefaultFolders: () => ipcRenderer.invoke('setup-default-folders'),
    detectFfmpeg: () => ipcRenderer.invoke('detect-ffmpeg'),
    selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-bin-folder'),
    fetchBestiaryData: (repoUrl, localPath, githubToken) => ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken }),
    registerSlashCommands: () => ipcRenderer.invoke('register-slash-commands'),
    unregisterSlashCommands: () => ipcRenderer.invoke('unregister-slash-commands'),
    requestBotStatus: () => ipcRenderer.send('request-bot-status'),
    onBotStatus: (callback) => ipcRenderer.on('discord-bot-status', (event, status) => callback(status)),
    getHelpContent: () => ipcRenderer.invoke('get-help-content'),
    getLicenses: () => ipcRenderer.invoke('get-licenses'),
    openExternal: (url) => shell.openExternal(url)
});