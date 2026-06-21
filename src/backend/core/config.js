// Import safeStorage from electron to handle encryption of sensitive data like tokens
const { safeStorage } = require('electron');

// Variable to hold the singleton instance of the electron-store
let store;

/**
 * Initializes and returns the electron-store instance.
 * Uses a schema to define the structure and default values of the configuration.
 * @returns {Promise<Store>} The initialized store instance.
 */
async function getStore() {
    // Return existing store if already initialized
    if (store) return store;

    // Dynamically import electron-store (it's an ESM module)
    const { default: Store } = await import('electron-store');

    // Define the configuration schema for validation and defaults
    const schema = {
        discord: {
            type: 'object',
            properties: {
                // Whether the Discord bot integration is active
                enabled: { type: 'boolean', default: false },
                // Discord Bot Token (encrypted on disk)
                token: { type: 'string' },
                // ID of the voice channel for the bot to join
                voiceChannel: { type: 'string' },
                // ID of the text channel for bot commands and logs
                textChannel: { type: 'string' },
                // ID of the role used for mentioning the bot
                botRoleId: { type: 'string' },
                // Local path to the user's music library
                defaultMusicPath: { type: 'string' },
                // Local path to the D&D bestiary JSON files
                bestiaryPath: { type: 'string' },
                // Local path to the random tables JSON files
                randomTablesPath: { type: 'string' },
                // Path to the FFmpeg executable for audio processing
                ffmpegPath: { type: 'string' },
                // URL of the GitHub repository for syncing 5e data
                gitRepoUrl: { type: 'string' },
                // Whether the app is in 'Audio-Only' UI mode
                audioMode: { type: 'boolean', default: false },
                // Cached structure of the music library folders
                musicLibrary: { type: 'object', default: {} },
                // List of files added directly to the music stack without being in the library
                looseFiles: { type: 'array', items: { type: 'string' }, default: [] },
                // Number of rows in the audio-only soundboard grid
                audioOnlyRows: { type: 'number', default: 8 },
                // Number of columns in the audio-only soundboard grid
                audioOnlyCols: { type: 'number', default: 6 },
                // Width of the left column in the standard UI
                leftColumnWidth: { type: 'number', default: 350 },
                // Height of the music player panel
                musicPlayerHeight: { type: 'number', default: 280 },
                // Whether to automatically save/load the music stack on restart
                musicAutosave: { type: 'boolean', default: false },
                // Whether to show the media control embed in Discord
                showMediaControl: { type: 'boolean', default: true }
            },
            // Default value for the 'discord' object itself
            default: {}
        }
    };

    // Instantiate the store with the schema and a basic encryption key for obfuscation
    store = new Store({
        schema,
        encryptionKey: 'a-bad-secret-key-for-taverntones'
    });

    return store;
}

/**
 * Retrieves the full Discord and application configuration from the store.
 * Handles decryption of sensitive tokens.
 * @returns {Promise<object>} The configuration object with decrypted tokens.
 */
async function getDiscordConfig() {
    // Get the store instance
    const store = await getStore();
    // Fetch the 'discord' configuration object, defaulting to empty
    const config = store.get('discord') || {};

    // Decrypt the Discord bot token if it exists and encryption is available on this OS
    if (config.token && safeStorage.isEncryptionAvailable()) {
        try {
            // tokens are stored as base64-encoded encrypted strings
            config.token = safeStorage.decryptString(Buffer.from(config.token, 'base64'));
        } catch (e) {
            // Decryption might fail if the token was stored unencrypted or with a different key
        }
    }
    // Decrypt the GitHub token used for bestiary syncing
    if (config.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            config.githubToken = safeStorage.decryptString(Buffer.from(config.githubToken, 'base64'));
        } catch (e) {
            // Ignore decryption errors for githubToken
        }
    }

    // --- Ensure essential keys have default values to avoid 'undefined' issues in the UI ---
    const defaults = {
        enabled: false,
        token: '',
        githubToken: '',
        voiceChannel: '',
        textChannel: '',
        botRoleId: '',
        defaultMusicPath: '',
        bestiaryPath: '',
        randomTablesPath: '',
        ffmpegPath: '',
        gitRepoUrl: 'https://github.com/5etools-mirror-3/5etools-src'
    };

    // Merge defaults with the retrieved config
    return { ...defaults, ...config };
}

/**
 * Saves a new configuration object to the store.
 * Handles encryption of sensitive tokens before writing to disk.
 * @param {object} config - The new configuration object.
 */
async function setDiscordConfig(config) {
    // Get the store instance
    const store = await getStore();
    // Create a shallow copy to avoid mutating the original object passed in
    const configToSave = { ...config };

    // Encrypt the Discord bot token if encryption is available
    if (configToSave.token && safeStorage.isEncryptionAvailable()) {
        try {
            // Encrypt and then convert to base64 for safe JSON storage
            configToSave.token = safeStorage.encryptString(configToSave.token).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt Discord token:", e);
        }
    }
    // Encrypt the GitHub token
    if (configToSave.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            configToSave.githubToken = safeStorage.encryptString(configToSave.githubToken).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt GitHub token:", e);
        }
    }

    // Persist the entire merged config object back to the electron-store
    store.set('discord', configToSave);
}

// Export the getter and setter for use throughout the main process
module.exports = {
    getDiscordConfig,
    setDiscordConfig
};
