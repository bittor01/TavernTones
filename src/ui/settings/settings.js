document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');
    const defaultLocalFolderInput = document.getElementById('defaultLocalFolder');
    const saveButton = document.getElementById('save-button');
    const browseFolderButton = document.getElementById('browse-folder-button');

    // Request existing config from main process when window loads
    window.settings.getDiscordConfig();

    // Populate fields when config is received
    window.settings.onConfigReceived((config) => {
        if (config) {
            tokenInput.value = config.token || '';
            voiceChannelInput.value = config.voiceChannel || '';
            textChannelInput.value = config.textChannel || '';
            botRoleIdInput.value = config.botRoleId || '';
            defaultLocalFolderInput.value = config.defaultLocalFolder || '';
        }
    });

    browseFolderButton.addEventListener('click', async () => {
        const folderPath = await window.settings.selectMusicFolder();
        if (folderPath) {
            defaultLocalFolderInput.value = folderPath;
        }
    });

    saveButton.addEventListener('click', () => {
        const newConfig = {
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            defaultLocalFolder: defaultLocalFolderInput.value
        };
        window.settings.setDiscordConfig(newConfig);
    });
});