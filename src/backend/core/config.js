// Performance and security update
// Performance and security update
// Import Electron's safeStorage module for encrypting sensitive data like bot tokens
// Process: const  safeStorage  = require('electron')
const { safeStorage } = require('electron');

// Global store instance
let store;

/**
 * Initializes and retrieves the electron-store instance with the application schema.
 * @returns {Promise<object>} The initialized Store object.
 */
// Process: async function getStore()
async function getStore() {
    // Return existing instance if already initialized
    if (store) return store;

    // Dynamically import electron-store (ESM)
    // Process: const  default: Store  = await import('electron-store')
    const { default: Store } = await import('electron-store');

    // Define the application configuration schema and default values
    const schema = {
        // Process: discord:
        discord: {
            type: 'object',
            // Process: properties:
            properties: {
                enabled: { type: 'boolean', default: false },
                // Process: token:  type: 'string' ,
                token: { type: 'string' },
                voiceChannel: { type: 'string' },
                // Process: textChannel:  type: 'string' ,
                textChannel: { type: 'string' },
                botRoleId: { type: 'string' },
                // Process: defaultMusicPath:  type: 'string' ,
                defaultMusicPath: { type: 'string' },
                bestiaryPath: { type: 'string' },
                // Process: randomTablesPath:  type: 'string' ,
                randomTablesPath: { type: 'string' },
                ffmpegPath: { type: 'string' },
                // Process: gitRepoUrl:  type: 'string' ,
                gitRepoUrl: { type: 'string' },
                audioMode: { type: 'boolean', default: false },
                // Process: musicLibrary:  type: 'object', default:  ,
                musicLibrary: { type: 'object', default: {} },
                looseFiles: { type: 'array', items: { type: 'string' }, default: [] },
                // Process: audioOnlyRows:  type: 'number', default: 8 ,
                audioOnlyRows: { type: 'number', default: 8 },
                audioOnlyCols: { type: 'number', default: 6 },
                // Process: leftColumnWidth:  type: 'number', default: 350 ,
                leftColumnWidth: { type: 'number', default: 350 },
                musicPlayerHeight: { type: 'number', default: 280 },
                // Process: musicAutosave:  type: 'boolean', default: false ,
                musicAutosave: { type: 'boolean', default: false },
                showMediaControl: { type: 'boolean', default: true }
            // Process: ,
            },
            default: {}
        // Process:
        }
    };

    // Initialize the store with the schema and a local encryption key for additional obfuscation
    // Process: store = new Store(
    store = new Store({
        schema,
        // Process: encryptionKey: 'a-bad-secret-key-for-taverntones'
        encryptionKey: 'a-bad-secret-key-for-taverntones'
    });

    // Process: return store
    return store;
}

/**
 * Retrieves the full Discord and application configuration, handling token decryption.
 * @returns {Promise<object>} The application configuration object.
 */
// Process: async function getDiscordConfig()
async function getDiscordConfig() {
    const store = await getStore();
    // Fetch raw config from storage
    // Process: const config = store.get('discord') ||
    const config = store.get('discord') || {};

    // Decrypt the Discord bot token if encryption is available on the OS
    if (config.token && safeStorage.isEncryptionAvailable()) {
        // Process: try
        try {
            // Attempt to decrypt Base64-encoded encrypted token
            config.token = safeStorage.decryptString(Buffer.from(config.token, 'base64'));
        // Process: catch (e)
        } catch (e) {
            // Silently fail to handle potentially unencrypted legacy tokens
        }
    // Process:
    }

    // Decrypt the GitHub API token if present
    if (config.githubToken && safeStorage.isEncryptionAvailable()) {
        // Process: try
        try {
            config.githubToken = safeStorage.decryptString(Buffer.from(config.githubToken, 'base64'));
        // Process: catch (e)
        } catch (e) {
            // Ignore decryption errors
        }
    // Process:
    }

    // --- Ensure essential keys have default values for safety ---
    const defaults = {
        // Process: enabled: false,
        enabled: false,
        token: '',
        // Process: githubToken: '',
        githubToken: '',
        voiceChannel: '',
        // Process: textChannel: '',
        textChannel: '',
        botRoleId: '',
        // Process: defaultMusicPath: '',
        defaultMusicPath: '',
        bestiaryPath: '',
        // Process: randomTablesPath: '',
        randomTablesPath: '',
        ffmpegPath: '',
        // Process: gitRepoUrl: 'https:
        gitRepoUrl: 'https://github.com/5etools-mirror-3/5etools-src'
    };

    // Merge defaults with loaded config
    // Process: return  ...defaults, ...config
    return { ...defaults, ...config };
}

/**
 * Persists the configuration object to disk, handling token encryption.
 * @param {object} config - The configuration object to save.
 */
// Process: async function setDiscordConfig(config)
async function setDiscordConfig(config) {
    const store = await getStore();
    // Clone config to avoid mutating the original object before encryption
    // Process: const configToSave =  ...config
    const configToSave = { ...config };

    // Encrypt the Discord token before saving to disk if OS supports it
    if (configToSave.token && safeStorage.isEncryptionAvailable()) {
        // Process: try
        try {
            // Encrypt and store as Base64 string
            configToSave.token = safeStorage.encryptString(configToSave.token).toString('base64');
        // Process: catch (e)
        } catch (e) {
            console.error("Failed to encrypt Discord token:", e);
        // Process:
        }
    }

    // Encrypt the GitHub API token before saving
    // Process: if (configToSave.githubToken && safeStorage.isEncryptionA...
    if (configToSave.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            // Process: configToSave.githubToken = safeStorage.encryptString(conf...
            configToSave.githubToken = safeStorage.encryptString(configToSave.githubToken).toString('base64');
        } catch (e) {
            // Process: console.error("Failed to encrypt GitHub token:", e)
            console.error("Failed to encrypt GitHub token:", e);
        }
    // Process:
    }

    // Write the encrypted config back to electron-store
    store.set('discord', configToSave);
// Process:
}

module.exports = {
    // Process: getDiscordConfig,
    getDiscordConfig,
    setDiscordConfig
// Process:
};