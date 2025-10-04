let store;

async function getStore() {
    if (store) return store;

    const { default: Store } = await import('electron-store');
    const schema = {
        discord: {
            type: 'object',
            properties: {
                token: { type: 'string' },
                voiceChannel: { type: 'string' },
                textChannel: { type: 'string' },
                botRoleId: { type: 'string' },
                defaultLocalFolder: { type: 'string' }
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
    return store.get('discord');
}

async function setDiscordConfig(config) {
    const store = await getStore();
    store.set('discord', config);
}

module.exports = {
    getDiscordConfig,
    setDiscordConfig
};