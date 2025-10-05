document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');
    const masterDataFolderInput = document.getElementById('masterDataFolder');
    const selectFolderButton = document.getElementById('select-folder-button');
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
            masterDataFolderInput.value = config.masterDataFolder || '';
        }
    });

    selectFolderButton.addEventListener('click', async () => {
        const folderPath = await window.settings.selectMasterDataFolder();
        if (folderPath) {
            masterDataFolderInput.value = folderPath;
        }
    });

    saveButton.addEventListener('click', () => {
        const newConfig = {
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            masterDataFolder: masterDataFolderInput.value
        };
        window.settings.setDiscordConfig(newConfig);
    });
});