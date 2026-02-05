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
                gitRepoUrl: { type: 'string' }
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

    // --- Ensure essential keys have default values ---
    // This prevents the app from crashing or behaving unexpectedly if the config file
    // is missing keys (e.g., on a fresh install).
    const defaults = {
        enabled: false,
        token: '',
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
    store.set('discord', config);
}

module.exports = {
    getDiscordConfig,
    setDiscordConfig
};