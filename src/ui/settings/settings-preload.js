// Performance and security update
// Import contextBridge for secure API exposure and ipcRenderer/shell for process communication
const { contextBridge, ipcRenderer, shell } = require('electron');

/**
 * Preload script for the Settings window.
 * Exposes a specific 'settings' API to the frontend to manage configuration.
 */
contextBridge.exposeInMainWorld('settings', {
    // --- Configuration Handlers ---
    // Requests the current configuration from the main process
    getDiscordConfig: () => ipcRenderer.send('get-discord-config'),
    // Sends updated configuration to be saved
    setDiscordConfig: (config) => ipcRenderer.send('set-discord-config', config),
    // Registers a listener for when configuration data is received from the backend
    onConfigReceived: (callback) => ipcRenderer.on('discord-config', (event, config) => callback(config)),

    // --- Directory and Tool Management ---
    // Generic helper to trigger folder selection dialogs
    selectFolder: (channel) => ipcRenderer.invoke(channel),
    // Triggers the automated 'Default Folders' creation wizard
    setupDefaultFolders: () => ipcRenderer.invoke('setup-default-folders'),
    // Asks the backend to search for the FFmpeg binary on the system
    detectFfmpeg: () => ipcRenderer.invoke('detect-ffmpeg'),
    // Explicitly select the folder containing FFmpeg
    selectFfmpeg: () => ipcRenderer.invoke('select-ffmpeg-bin-folder'),

    // --- Data and Integration Handlers ---
    // Triggers the GitHub sync for bestiary monster data
    fetchBestiaryData: (repoUrl, localPath, githubToken) => ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken }),
    // Commands the bot to register its slash commands with Discord
    registerSlashCommands: () => ipcRenderer.invoke('register-slash-commands'),
    // Commands the bot to remove its slash commands from Discord
    unregisterSlashCommands: () => ipcRenderer.invoke('unregister-slash-commands'),
    // Asks the backend for an immediate update on Discord bot connectivity
    requestBotStatus: () => ipcRenderer.send('request-bot-status'),
    // Listens for bot connectivity updates (online/offline)
    onBotStatus: (callback) => ipcRenderer.on('discord-bot-status', (event, status) => callback(status)),

    // --- Documentation and UI Helpers ---
    // Fetches the Markdown content for the help/documentation view
    getHelpContent: () => ipcRenderer.invoke('get-help-content'),
    // Fetches the aggregated third-party license data
    getLicenses: () => ipcRenderer.invoke('get-licenses'),
    // Opens a URL in the user's default system browser (instead of inside Electron)
    openExternal: (url) => shell.openExternal(url),
    // Opens the separate 'Discord Bot Walkthrough' utility window
    openWalkthrough: () => ipcRenderer.send('open-walkthrough')
});
