// Performance and security update
// Performance and security update
// Import Electron's safeStorage module for encrypting sensitive data like bot tokens
const { safeStorage } = require('electron');

// Global store instance
let store;

/**
 * Initializes and retrieves the electron-store instance with the application schema.
 * @returns {Promise<object>} The initialized Store object.
 */
/**
 * Initializes and retrieves the singleton electron-store instance.
 * It uses a schema to enforce data types and provides a level of encryption for the config file.
 */
async function getStore() {
    if (store) return store;

    // electron-store is an ESM module, so we use dynamic import for compatibility with our CJS backend.
    const { default: Store } = await import('electron-store');

    const schema = {
        discord: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean', default: false },
                token: { type: 'string' },
                voiceChannel: { type: 'string' },
                textChannel: { type: 'string' },
                botRoleId: { type: 'string' },
                defaultMusicPath: { type: 'string' },
                bestiaryPath: { type: 'string' },
                randomTablesPath: { type: 'string' },
                ffmpegPath: { type: 'string' },
                gitRepoUrl: { type: 'string' },
                audioMode: { type: 'boolean', default: false },
                musicLibrary: { type: 'object', default: {} },
                looseFiles: { type: 'array', items: { type: 'string' }, default: [] },
                audioOnlyRows: { type: 'number', default: 8 },
                audioOnlyCols: { type: 'number', default: 6 },
                leftColumnWidth: { type: 'number', default: 350 },
                musicPlayerHeight: { type: 'number', default: 280 },
                musicAutosave: { type: 'boolean', default: false },
                showMediaControl: { type: 'boolean', default: true }
            },
            default: {}
        }
    };

    // Initialize the store with the schema and a local encryption key for additional obfuscation
    store = new Store({
        schema,
        encryptionKey: 'a-bad-secret-key-for-taverntones'
    });
    return store;
}

/**
 * Retrieves the full Discord and application configuration, handling token decryption.
 * @returns {Promise<object>} The application configuration object.
 */
/**
 * Loads the application configuration and decrypts sensitive credentials.
 */
async function getDiscordConfig() {
    const store = await getStore();
    // Retrieve the 'discord' object which contains most of the app's settings.
    const config = store.get('discord') || {};

    // We use Electron's safeStorage to protect the Discord Bot Token.
    // This uses OS-level encryption (DPAPI on Windows, Keychain on macOS).
    if (config.token && safeStorage.isEncryptionAvailable()) {
        try {
            // The token is stored as a Base64 string of the encrypted bytes.
            config.token = safeStorage.decryptString(Buffer.from(config.token, 'base64'));
        } catch (e) {
            // If decryption fails, the token might be in plain text (legacy) or invalid.
        }
    }

    // Decrypt the GitHub API token if present
    if (config.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            config.githubToken = safeStorage.decryptString(Buffer.from(config.githubToken, 'base64'));
        } catch (e) {
            // Ignore decryption errors
        }
    }

    // --- Ensure essential keys have default values for safety ---
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

    // Merge defaults with loaded config
    return { ...defaults, ...config };
}

/**
 * Persists the configuration object to disk, handling token encryption.
 */
async function setDiscordConfig(config) {
    const store = await getStore();

    // We clone the config object to prevent side-effects on the live in-memory
    // configuration while we perform the encryption step.
    const configToSave = { ...config };

    // Before writing to the filesystem, we encrypt the sensitive Discord Bot Token.
    if (configToSave.token && safeStorage.isEncryptionAvailable()) {
        try {
            // safeStorage produces a Buffer, which we encode to Base64 for JSON-safe storage.
            configToSave.token = safeStorage.encryptString(configToSave.token).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt Discord token:", e);
        }
    }

    // Encrypt the GitHub API token before saving
    if (configToSave.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            configToSave.githubToken = safeStorage.encryptString(configToSave.githubToken).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt GitHub token:", e);
        }
    }

    // Write the encrypted config back to electron-store
    store.set('discord', configToSave);
}
module.exports = {
    getDiscordConfig,
    setDiscordConfig
};
