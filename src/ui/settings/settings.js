document.addEventListener('DOMContentLoaded', () => {
    // Discord settings
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');

    // Settings fields
    const ffmpegPathInput = document.getElementById('ffmpegPath');
    const bestiaryPathInput = document.getElementById('bestiaryPath');
    const gitRepoUrlInput = document.getElementById('gitRepoUrl');
    const randomTablesPathInput = document.getElementById('randomTablesPath');
    const defaultMusicPathInput = document.getElementById('defaultMusicPath');

    // Buttons
    const browseFfmpegBtn = document.getElementById('browse-ffmpeg');
    const browseBestiaryBtn = document.getElementById('browse-bestiary');
    const fetchBestiaryBtn = document.getElementById('fetch-bestiary-btn');
    const browseRandomTablesBtn = document.getElementById('browse-random-tables');
    const browseMusicBtn = document.getElementById('browse-music');
    const setupDefaultFoldersBtn = document.getElementById('setup-default-folders');
    const saveButton = document.getElementById('save-button');

    let originalConfig = {};

    const checkDirty = () => {
        const currentConfig = {
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value
        };

        const isDirty = Object.keys(currentConfig).some(key => currentConfig[key] !== (originalConfig[key] || ''));
        if (isDirty) {
            saveButton.classList.add('dirty');
        } else {
            saveButton.classList.remove('dirty');
        }
    };

    // Add input listeners to all fields
    [tokenInput, voiceChannelInput, textChannelInput, botRoleIdInput, ffmpegPathInput, bestiaryPathInput, gitRepoUrlInput, randomTablesPathInput, defaultMusicPathInput].forEach(el => {
        el.addEventListener('input', checkDirty);
    });

    // Function to handle browsing for a folder
    const handleBrowse = async (ipcChannel, inputElement) => {
        const path = await window.settings.selectFolder(ipcChannel);
        if (path) {
            inputElement.value = path;
        }
    };

    // Event Listeners for Browse buttons
    browseFfmpegBtn.addEventListener('click', async () => {
        const path = await window.settings.selectFfmpeg();
        if (path) {
            ffmpegPathInput.value = path;
            checkDirty();
        }
    });

    browseBestiaryBtn.addEventListener('click', () => handleBrowse('select-bestiary-folder', bestiaryPathInput).then(checkDirty));
    browseRandomTablesBtn.addEventListener('click', () => handleBrowse('select-random-tables-folder', randomTablesPathInput).then(checkDirty));
    browseMusicBtn.addEventListener('click', () => handleBrowse('select-music-folder', defaultMusicPathInput).then(checkDirty));

    // Event Listener for Setup Default Folders button
    setupDefaultFoldersBtn.addEventListener('click', async () => {
        const paths = await window.settings.setupDefaultFolders();
        if (paths) {
            bestiaryPathInput.value = paths.bestiaryPath;
            randomTablesPathInput.value = paths.randomTablesPath;
            defaultMusicPathInput.value = paths.defaultMusicPath;
            checkDirty();
        }
    });

    fetchBestiaryBtn.addEventListener('click', async () => {
        if (!bestiaryPathInput.value) {
            alert("Please set a Bestiary Data Path first.");
            return;
        }
        fetchBestiaryBtn.disabled = true;
        fetchBestiaryBtn.textContent = "Syncing...";
        const result = await window.settings.fetchBestiaryData(gitRepoUrlInput.value, bestiaryPathInput.value);
        if (result.success) {
            alert(result.message);
        } else {
            alert("Error: " + result.error);
        }
        fetchBestiaryBtn.disabled = false;
        fetchBestiaryBtn.textContent = "Fetch/Update Bestiary Data";
    });

    // Request existing config from main process when window loads
    window.settings.getDiscordConfig();

    // Populate fields when config is received
    window.settings.onConfigReceived((config) => {
        if (config) {
            originalConfig = config;
            tokenInput.value = config.token || '';
            voiceChannelInput.value = config.voiceChannel || '';
            textChannelInput.value = config.textChannel || '';
            botRoleIdInput.value = config.botRoleId || '';
            ffmpegPathInput.value = config.ffmpegPath || '';
            bestiaryPathInput.value = config.bestiaryPath || '';
            gitRepoUrlInput.value = config.gitRepoUrl || 'https://github.com/5etools-mirror-3/5etools-src';
            randomTablesPathInput.value = config.randomTablesPath || '';
            defaultMusicPathInput.value = config.defaultMusicPath || '';

            // Auto-detect FFmpeg if not set
            if (!config.ffmpegPath) {
                window.settings.detectFfmpeg().then(path => {
                    if (path) {
                        ffmpegPathInput.value = path;
                        checkDirty();
                    }
                });
            }
            checkDirty();
        }
    });

    saveButton.addEventListener('click', () => {
        const newConfig = {
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value
        };
        window.settings.setDiscordConfig(newConfig);
        originalConfig = newConfig;
        checkDirty();
    });
});