// Performance and security update
// Performance and security update
// Import Electron modules for safe context bridge communication
const { contextBridge, ipcRenderer, shell } = require('electron');

/**
 * Expose limited, safe configuration APIs to the Settings window.
 */
contextBridge.exposeInMainWorld('settings', {
    // Methods to request and update application configuration
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    /**
     * Listener for incoming configuration data from the main process.
     */
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config)),

    // Methods for directory and file path management
    selectFolder: (channel) => ipcRenderer.invoke(channel),
    setupDefaultFolders: () => ipcRenderer.invoke('setup-default-folders'),
    detectFfmpeg: () => ipcRenderer.invoke('detect-ffmpeg'),
    selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-bin-folder'),

    // Remote data synchronization (GitHub integration)
    fetchBestiaryData: (repoUrl, localPath, githubToken) => ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken }),

    // Discord bot interaction management
    registerSlashCommands: () => ipcRenderer.invoke('register-slash-commands'),
    unregisterSlashCommands: () => ipcRenderer.invoke('unregister-slash-commands'),

    // Real-time status reporting
    requestBotStatus: () => ipcRenderer.send('request-bot-status'),
    /**
     * Listener for bot connectivity and voice status updates.
     */
    onBotStatus: (callback) => ipcRenderer.on('discord-bot-status', (event, status) => callback(status)),

    // Help and dependency license retrieval
    getHelpContent: () => ipcRenderer.invoke('get-help-content'),
    getLicenses: () => ipcRenderer.invoke('get-licenses'),

    // OS-level interactions
    openExternal: (url) => shell.openExternal(url),
    openWalkthrough: () => ipcRenderer.send('open-walkthrough')
});
