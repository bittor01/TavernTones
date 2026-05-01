// Performance and security update
const { safeStorage } = require('electron');

let store;

async function getStore() {
    if (store) return store;

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
                musicAutosave: { type: 'boolean', default: false }
            },
            default: {}
        }
    };

    store = new Store({
        schema,
        encryptionKey: 'a-bad-secret-key-for-taverntones'
    });

    return store;
}

async function getDiscordConfig() {
    const store = await getStore();
    const config = store.get('discord') || {};

    // Decrypt tokens if they exist and safeStorage is available
    if (config.token && safeStorage.isEncryptionAvailable()) {
        try {
            config.token = safeStorage.decryptString(Buffer.from(config.token, 'base64'));
        } catch (e) {
            // Might be unencrypted from previous version
        }
    }
    if (config.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            config.githubToken = safeStorage.decryptString(Buffer.from(config.githubToken, 'base64'));
        } catch (e) {
            // Ignore
        }
    }

    // --- Ensure essential keys have default values ---
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

    return { ...defaults, ...config };
}

async function setDiscordConfig(config) {
    const store = await getStore();
    const configToSave = { ...config };

    // Encrypt tokens if safeStorage is available
    if (configToSave.token && safeStorage.isEncryptionAvailable()) {
        try {
            configToSave.token = safeStorage.encryptString(configToSave.token).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt Discord token:", e);
        }
    }
    if (configToSave.githubToken && safeStorage.isEncryptionAvailable()) {
        try {
            configToSave.githubToken = safeStorage.encryptString(configToSave.githubToken).toString('base64');
        } catch (e) {
            console.error("Failed to encrypt GitHub token:", e);
        }
    }

    store.set('discord', configToSave);
}

module.exports = {
    getDiscordConfig,
    setDiscordConfig
};