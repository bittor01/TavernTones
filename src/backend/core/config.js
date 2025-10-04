const Store = require('electron-store');

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

// For a real app, this key should be stored securely and not be hardcoded.
// For example, it could be derived from a machine-specific identifier.
const store = new Store({
    schema,
    encryptionKey: 'a-bad-secret-key-for-taverntones'
});

function getDiscordConfig() {
    return store.get('discord');
}

function setDiscordConfig(config) {
    store.set('discord', config);
}

module.exports = {
    getDiscordConfig,
    setDiscordConfig
};