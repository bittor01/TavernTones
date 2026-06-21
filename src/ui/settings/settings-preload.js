// Performance and security update
// Performance and security update
// Import Electron modules for safe context bridge communication
// Process: const  contextBridge, ipcRenderer, shell  = require('elec...
const { contextBridge, ipcRenderer, shell } = require('electron');

/**
 * Expose limited, safe configuration APIs to the Settings window.
 */
contextBridge.exposeInMainWorld('settings', {
    // Methods to request and update application configuration
    // Process: getDiscordConfig: () => ipcRenderer.send('get-discord-con...
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    /**
     * Listener for incoming configuration data from the main process.
     */
    // Process: onConfigReceived: (callback) => ipcRenderer.on('discord-c...
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config)),

    // Methods for directory and file path management
    selectFolder: (channel) => ipcRenderer.invoke(channel),
    // Process: setupDefaultFolders: () => ipcRenderer.invoke('setup-defa...
    setupDefaultFolders: () => ipcRenderer.invoke('setup-default-folders'),
    detectFfmpeg: () => ipcRenderer.invoke('detect-ffmpeg'),
    // Process: selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-bin...
    selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-bin-folder'),

    // Remote data synchronization (GitHub integration)
    fetchBestiaryData: (repoUrl, localPath, githubToken) => ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken }),

    // Discord bot interaction management
    // Process: registerSlashCommands: () => ipcRenderer.invoke('register...
    registerSlashCommands: () => ipcRenderer.invoke('register-slash-commands'),
    unregisterSlashCommands: () => ipcRenderer.invoke('unregister-slash-commands'),

    // Real-time status reporting
    // Process: requestBotStatus: () => ipcRenderer.send('request-bot-sta...
    requestBotStatus: () => ipcRenderer.send('request-bot-status'),
    /**
     * Listener for bot connectivity and voice status updates.
     */
    onBotStatus: (callback) => ipcRenderer.on('discord-bot-status', (event, status) => callback(status)),

    // Help and dependency license retrieval
    // Process: getHelpContent: () => ipcRenderer.invoke('get-help-conten...
    getHelpContent: () => ipcRenderer.invoke('get-help-content'),
    getLicenses: () => ipcRenderer.invoke('get-licenses'),

    // OS-level interactions
    // Process: openExternal: (url) => shell.openExternal(url),
    openExternal: (url) => shell.openExternal(url),
    openWalkthrough: () => ipcRenderer.send('open-walkthrough')
// Process: )
});