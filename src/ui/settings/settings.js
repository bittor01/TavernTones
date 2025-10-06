document.addEventListener('DOMContentLoaded', () => {
    // Discord settings
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');

    // Folder settings
    const resourcesPathInput = document.getElementById('resourcesPath');
    const randomTablesPathInput = document.getElementById('randomTablesPath');
    const tasksPathInput = document.getElementById('tasksPath');
    const defaultMusicPathInput = document.getElementById('defaultMusicPath');

    // Buttons
    const browseResourcesBtn = document.getElementById('browse-resources');
    const browseRandomTablesBtn = document.getElementById('browse-random-tables');
    const browseTasksBtn = document.getElementById('browse-tasks');
    const browseMusicBtn = document.getElementById('browse-music');
    const setupDefaultFoldersBtn = document.getElementById('setup-default-folders');
    const saveButton = document.getElementById('save-button');

    // Function to handle browsing for a folder
    const handleBrowse = async (ipcChannel, inputElement) => {
        const path = await window.settings.selectFolder(ipcChannel);
        if (path) {
            inputElement.value = path;
        }
    };

    // Event Listeners for Browse buttons
    browseResourcesBtn.addEventListener('click', () => handleBrowse('select-resources-folder', resourcesPathInput));
    browseRandomTablesBtn.addEventListener('click', () => handleBrowse('select-random-tables-folder', randomTablesPathInput));
    browseTasksBtn.addEventListener('click', () => handleBrowse('select-tasks-folder', tasksPathInput));
    browseMusicBtn.addEventListener('click', () => handleBrowse('select-music-folder', defaultMusicPathInput));

    // Event Listener for Setup Default Folders button
    setupDefaultFoldersBtn.addEventListener('click', async () => {
        const paths = await window.settings.setupDefaultFolders();
        if (paths) {
            resourcesPathInput.value = paths.resourcesPath;
            randomTablesPathInput.value = paths.randomTablesPath;
            tasksPathInput.value = paths.tasksPath;
            defaultMusicPathInput.value = paths.defaultMusicPath;
        }
    });

    // Request existing config from main process when window loads
    window.settings.getDiscordConfig();

    // Populate fields when config is received
    window.settings.onConfigReceived((config) => {
        if (config) {
            tokenInput.value = config.token || '';
            voiceChannelInput.value = config.voiceChannel || '';
            textChannelInput.value = config.textChannel || '';
            botRoleIdInput.value = config.botRoleId || '';
            resourcesPathInput.value = config.resourcesPath || '';
            randomTablesPathInput.value = config.randomTablesPath || '';
            tasksPathInput.value = config.tasksPath || '';
            defaultMusicPathInput.value = config.defaultMusicPath || '';
        }
    });

    saveButton.addEventListener('click', () => {
        const newConfig = {
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            resourcesPath: resourcesPathInput.value,
            randomTablesPath: randomTablesPathInput.value,
            tasksPath: tasksPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value
        };
        window.settings.setDiscordConfig(newConfig);
    });
});