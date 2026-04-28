// Performance and security update
document.addEventListener('DOMContentLoaded', () => {
    // Discord settings
    const enableDiscordBotCheckbox = document.getElementById('enableDiscordBot');
    const discordFieldsContainer = document.getElementById('discord-fields');
    const tokenInput = document.getElementById('token');
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    const botRoleIdInput = document.getElementById('botRoleId');

    // Settings fields
    const ffmpegPathInput = document.getElementById('ffmpegPath');
    const bestiaryPathInput = document.getElementById('bestiaryPath');
    const gitRepoUrlInput = document.getElementById('gitRepoUrl');
    const githubTokenInput = document.getElementById('githubToken');
    const randomTablesPathInput = document.getElementById('randomTablesPath');
    const defaultMusicPathInput = document.getElementById('defaultMusicPath');
    const audioModeToggle = document.getElementById('audioModeToggle');

    // Buttons
    const browseFfmpegBtn = document.getElementById('browse-ffmpeg');
    const browseBestiaryBtn = document.getElementById('browse-bestiary');
    const fetchBestiaryBtn = document.getElementById('fetch-bestiary-btn');
    const browseRandomTablesBtn = document.getElementById('browse-random-tables');
    const browseMusicBtn = document.getElementById('browse-music');
    const setupDefaultFoldersBtn = document.getElementById('setup-default-folders');
    const registerSlashBtn = document.getElementById('register-slash-btn');
    const unregisterSlashBtn = document.getElementById('unregister-slash-btn');
    const saveButton = document.getElementById('save-button');

    let originalConfig = {};

    const checkDirty = () => {
        const currentConfig = {
            enabled: enableDiscordBotCheckbox.checked,
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            githubToken: githubTokenInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value,
            audioMode: audioModeToggle.checked
        };

        const isDirty = Object.keys(currentConfig).some(key => {
            const val = currentConfig[key];
            const orig = originalConfig[key];
            if (typeof val === 'boolean') return val !== !!orig;
            return val !== (orig || '');
        });

        // Validation: If bot enabled, all 4 fields must be present
        let isValid = true;
        if (enableDiscordBotCheckbox.checked) {
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                isValid = false;
            }
        }

        if (isDirty && isValid) {
            saveButton.classList.add('dirty');
        } else {
            saveButton.classList.remove('dirty');
        }
    };

    enableDiscordBotCheckbox.addEventListener('change', () => {
        discordFieldsContainer.style.opacity = enableDiscordBotCheckbox.checked ? '1' : '0.5';
        discordFieldsContainer.style.pointerEvents = enableDiscordBotCheckbox.checked ? 'auto' : 'none';
        checkDirty();
    });

    // Add input listeners to all fields
    [tokenInput, voiceChannelInput, textChannelInput, botRoleIdInput, ffmpegPathInput, bestiaryPathInput, gitRepoUrlInput, githubTokenInput, randomTablesPathInput, defaultMusicPathInput].forEach(el => {
        el.addEventListener('input', checkDirty);
    });
    audioModeToggle.addEventListener('change', checkDirty);

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
        const result = await window.settings.fetchBestiaryData(gitRepoUrlInput.value, bestiaryPathInput.value, githubTokenInput.value);
        if (result.success) {
            alert(result.message);
        } else {
            alert("Error: " + result.error);
        }
        fetchBestiaryBtn.disabled = false;
        fetchBestiaryBtn.textContent = "Fetch/Update Bestiary Data";
    });

    // --- Slash Commands ---
    const updateBotStatusUI = (status) => {
        const isOnline = status && status.status === 'online';
        const isConnecting = status && status.status === 'offline' && status.message === 'Connecting...';

        // Update Buttons
        [registerSlashBtn, unregisterSlashBtn].forEach(btn => {
            btn.disabled = !isOnline;
            btn.style.opacity = isOnline ? '1' : '0.5';
            btn.title = isOnline ? "" : "The bot must be connected to register slash commands.";
        });

        // Update Status Indicator
        const indicator = document.getElementById('bot-status-indicator');
        if (indicator) {
            if (isOnline) {
                indicator.textContent = '🟩';
            } else if (isConnecting) {
                indicator.textContent = '🟨';
            } else {
                indicator.textContent = '🟥';
            }
            indicator.title = `Bot Status: ${status.message}`;
        }
    };

    registerSlashBtn.addEventListener('click', async () => {
        registerSlashBtn.disabled = true;
        const result = await window.settings.registerSlashCommands();
        if (result.success) alert("Slash commands registered!");
        else alert("Error: " + result.error);
        registerSlashBtn.disabled = false;
    });

    unregisterSlashBtn.addEventListener('click', async () => {
        unregisterSlashBtn.disabled = true;
        const result = await window.settings.unregisterSlashCommands();
        if (result.success) alert("Slash commands unregistered!");
        else alert("Error: " + result.error);
        unregisterSlashBtn.disabled = false;
    });

    // --- Help Button ---
    const helpButton = document.getElementById('help-button');
    const helpDialog = document.getElementById('help-dialog');
    const helpContent = document.getElementById('help-content');
    const licenseButton = document.getElementById('license-button');
    const licenseDialog = document.getElementById('license-dialog');
    const licenseTableBody = document.getElementById('license-table-body');

    helpButton.addEventListener('click', async () => {
        const content = await window.settings.getHelpContent();
        // Basic Markdown-ish parsing for better display
        const parsed = content
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/\[(.*?)\]\((.*?)\)/g, (m, text, url) => `<a href="#" onclick="window.settings.openExternal('${url}')">${text}</a>`)
            .replace(/\n\n/g, '<br><br>');

        helpContent.innerHTML = parsed;
        helpDialog.showModal();
    });

    licenseButton.addEventListener('click', async () => {
        const result = await window.settings.getLicenses();
        if (result.success) {
            licenseTableBody.innerHTML = '';
            result.licenses.forEach(pkg => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';
                tr.innerHTML = `
                    <td style="padding: 8px;">${pkg.name}</td>
                    <td style="padding: 8px;">${pkg.version}</td>
                    <td style="padding: 8px;">${pkg.license}</td>
                `;
                licenseTableBody.appendChild(tr);
            });
            licenseDialog.showModal();
        } else {
            alert("Error fetching licenses: " + result.error);
        }
    });

    window.settings.onBotStatus(updateBotStatusUI);

    // Request existing config from main process when window loads
    window.settings.getDiscordConfig();
    window.settings.requestBotStatus();

    // Populate fields when config is received
    window.settings.onConfigReceived((config) => {
        if (config) {
            originalConfig = config;
            enableDiscordBotCheckbox.checked = !!config.enabled;
            discordFieldsContainer.style.opacity = enableDiscordBotCheckbox.checked ? '1' : '0.5';
            discordFieldsContainer.style.pointerEvents = enableDiscordBotCheckbox.checked ? 'auto' : 'none';

            tokenInput.value = config.token || '';
            voiceChannelInput.value = config.voiceChannel || '';
            textChannelInput.value = config.textChannel || '';
            botRoleIdInput.value = config.botRoleId || '';
            ffmpegPathInput.value = config.ffmpegPath || '';
            bestiaryPathInput.value = config.bestiaryPath || '';
            gitRepoUrlInput.value = config.gitRepoUrl || 'https://github.com/5etools-mirror-3/5etools-src';
            githubTokenInput.value = config.githubToken || '';
            randomTablesPathInput.value = config.randomTablesPath || '';
            defaultMusicPathInput.value = config.defaultMusicPath || '';
            audioModeToggle.checked = !!config.audioMode;

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
        if (enableDiscordBotCheckbox.checked) {
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                alert("Please enter all Discord bot settings or disable the bot.");
                return;
            }
        }

        const newConfig = {
            enabled: enableDiscordBotCheckbox.checked,
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            githubToken: githubTokenInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value,
            audioMode: audioModeToggle.checked
        };
        window.settings.setDiscordConfig(newConfig);
        originalConfig = newConfig;
        checkDirty();
    });
});