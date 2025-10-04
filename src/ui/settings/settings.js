document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');
    const defaultLocalFolderInput = document.getElementById('defaultLocalFolder');
    const saveButton = document.getElementById('save-button');

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