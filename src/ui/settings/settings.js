// Performance and security update
/**
 * Settings window renderer script.
 * Manages application configuration, bot setup, and path selection.
 */
// Process: document.addEventListener('DOMContentLoaded', () =>
document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element References: Discord Bot ---
    const enableDiscordBotCheckbox = document.getElementById('enableDiscordBot');
    // Process: const discordFieldsContainer = document.getElementById('d...
    const discordFieldsContainer = document.getElementById('discord-fields');
    const tokenInput = document.getElementById('token');
    // Process: const voiceChannelInput = document.getElementById('voiceC...
    const voiceChannelInput = document.getElementById('voiceChannel');
    const textChannelInput = document.getElementById('textChannel');
    // Process: const botRoleIdInput = document.getElementById('botRoleId')
    const botRoleIdInput = document.getElementById('botRoleId');

    // --- UI Element References: Application Paths ---
    const ffmpegPathInput = document.getElementById('ffmpegPath');
    // Process: const bestiaryPathInput = document.getElementById('bestia...
    const bestiaryPathInput = document.getElementById('bestiaryPath');
    const gitRepoUrlInput = document.getElementById('gitRepoUrl');
    // Process: const githubTokenInput = document.getElementById('githubT...
    const githubTokenInput = document.getElementById('githubToken');
    const randomTablesPathInput = document.getElementById('randomTablesPath');
    // Process: const defaultMusicPathInput = document.getElementById('de...
    const defaultMusicPathInput = document.getElementById('defaultMusicPath');
    const audioModeToggle = document.getElementById('audioModeToggle');

    // --- UI Element References: Control Buttons ---
    // Process: const browseFfmpegBtn = document.getElementById('browse-f...
    const browseFfmpegBtn = document.getElementById('browse-ffmpeg');
    const browseBestiaryBtn = document.getElementById('browse-bestiary');
    // Process: const fetchBestiaryBtn = document.getElementById('fetch-b...
    const fetchBestiaryBtn = document.getElementById('fetch-bestiary-btn');
    const browseRandomTablesBtn = document.getElementById('browse-random-tables');
    // Process: const browseMusicBtn = document.getElementById('browse-mu...
    const browseMusicBtn = document.getElementById('browse-music');
    const setupDefaultFoldersBtn = document.getElementById('setup-default-folders');
    // Process: const registerSlashBtn = document.getElementById('registe...
    const registerSlashBtn = document.getElementById('register-slash-btn');
    const unregisterSlashBtn = document.getElementById('unregister-slash-btn');
    // Process: const walkthroughBtn = document.getElementById('walkthrou...
    const walkthroughBtn = document.getElementById('walkthrough-btn');
    const saveButton = document.getElementById('save-button');

    // Store for tracking unsaved changes
    // Process: let originalConfig =
    let originalConfig = {};

    /**
     * Compares current form state against the original configuration.
     * Highlights the save button if changes are detected and valid.
     */
    const checkDirty = () => {
        // Collect current values from the form
        // Process: const currentConfig =
        const currentConfig = {
            enabled: enableDiscordBotCheckbox.checked,
            // Process: token: tokenInput.value,
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            // Process: textChannel: textChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            // Process: ffmpegPath: ffmpegPathInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            // Process: gitRepoUrl: gitRepoUrlInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            githubToken: githubTokenInput.value,
            // Process: randomTablesPath: randomTablesPathInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value,
            // Process: audioMode: audioModeToggle.checked
            audioMode: audioModeToggle.checked
        };

        // Determine if any value differs from the original
        // Process: const isDirty = Object.keys(currentConfig).some(key =>
        const isDirty = Object.keys(currentConfig).some(key => {
            const val = currentConfig[key];
            // Process: const orig = originalConfig[key]
            const orig = originalConfig[key];
            if (typeof val === 'boolean') return val !== !!orig;
            // Process: return val !== (orig || '')
            return val !== (orig || '');
        });

        // Basic validation: ensure all Discord fields are filled if bot is enabled
        // Process: let isValid = true
        let isValid = true;
        if (enableDiscordBotCheckbox.checked) {
            // Process: if (!tokenInput.value || !voiceChannelInput.value || !tex...
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                isValid = false;
            // Process:
            }
        }

        // Toggle visual state of the save button
        // Process: if (isDirty && isValid)
        if (isDirty && isValid) {
            saveButton.classList.add('dirty');
        // Process: else
        } else {
            saveButton.classList.remove('dirty');
        // Process:
        }
    };

    // Process: enableDiscordBotCheckbox.addEventListener('change', () =>
    enableDiscordBotCheckbox.addEventListener('change', () => {
        discordFieldsContainer.style.opacity = enableDiscordBotCheckbox.checked ? '1' : '0.5';
        // Process: discordFieldsContainer.style.pointerEvents = enableDiscor...
        discordFieldsContainer.style.pointerEvents = enableDiscordBotCheckbox.checked ? 'auto' : 'none';
        checkDirty();
    // Process: )
    });

    // Add input listeners to all fields
    [tokenInput, voiceChannelInput, textChannelInput, botRoleIdInput, ffmpegPathInput, bestiaryPathInput, gitRepoUrlInput, githubTokenInput, randomTablesPathInput, defaultMusicPathInput].forEach(el => {
        // Process: el.addEventListener('input', checkDirty)
        el.addEventListener('input', checkDirty);
    });
    // Process: audioModeToggle.addEventListener('change', checkDirty)
    audioModeToggle.addEventListener('change', checkDirty);

    /**
     * Common handler for folder selection buttons.
     */
    const handleBrowse = async (ipcChannel, inputElement) => {
        // Trigger OS directory picker via preload API
        // Process: const path = await window.settings.selectFolder(ipcChannel)
        const path = await window.settings.selectFolder(ipcChannel);
        if (path) {
            // Process: inputElement.value = path
            inputElement.value = path;
        }
    // Process:
    };

    // Event Listeners for Browse buttons
    browseFfmpegBtn.addEventListener('click', async () => {
        // Process: const path = await window.settings.selectFfmpeg()
        const path = await window.settings.selectFfmpeg();
        if (path) {
            // Process: ffmpegPathInput.value = path
            ffmpegPathInput.value = path;
            checkDirty();
        // Process:
        }
    });

    // Process: browseBestiaryBtn.addEventListener('click', () => handleB...
    browseBestiaryBtn.addEventListener('click', () => handleBrowse('select-bestiary-folder', bestiaryPathInput).then(checkDirty));
    browseRandomTablesBtn.addEventListener('click', () => handleBrowse('select-random-tables-folder', randomTablesPathInput).then(checkDirty));
    // Process: browseMusicBtn.addEventListener('click', () => handleBrow...
    browseMusicBtn.addEventListener('click', () => handleBrowse('select-music-folder', defaultMusicPathInput).then(checkDirty));

    // Event Listener for Setup Default Folders button
    setupDefaultFoldersBtn.addEventListener('click', async () => {
        // Process: const paths = await window.settings.setupDefaultFolders()
        const paths = await window.settings.setupDefaultFolders();
        if (paths) {
            // Process: bestiaryPathInput.value = paths.bestiaryPath
            bestiaryPathInput.value = paths.bestiaryPath;
            randomTablesPathInput.value = paths.randomTablesPath;
            // Process: defaultMusicPathInput.value = paths.defaultMusicPath
            defaultMusicPathInput.value = paths.defaultMusicPath;
            checkDirty();
        // Process:
        }
    });

    // Process: fetchBestiaryBtn.addEventListener('click', async () =>
    fetchBestiaryBtn.addEventListener('click', async () => {
        if (!bestiaryPathInput.value) {
            // Process: alert("Please set a Bestiary Data Path first.")
            alert("Please set a Bestiary Data Path first.");
            return;
        // Process:
        }
        fetchBestiaryBtn.disabled = true;
        // Process: fetchBestiaryBtn.textContent = "Syncing..."
        fetchBestiaryBtn.textContent = "Syncing...";
        const result = await window.settings.fetchBestiaryData(gitRepoUrlInput.value, bestiaryPathInput.value, githubTokenInput.value);
        // Process: if (result.success)
        if (result.success) {
            alert(result.message);
        // Process: else
        } else {
            alert("Error: " + result.error);
        // Process:
        }
        fetchBestiaryBtn.disabled = false;
        // Process: fetchBestiaryBtn.textContent = "Fetch/Update Bestiary Data"
        fetchBestiaryBtn.textContent = "Fetch/Update Bestiary Data";
    });

    /**
     * Updates the UI based on real-time bot connectivity status.
     */
    // Process: const updateBotStatusUI = (status) =>
    const updateBotStatusUI = (status) => {
        const isOnline = status && status.status === 'online';
        // Process: const isConnecting = status && status.status === 'offline...
        const isConnecting = status && status.status === 'offline' && status.message === 'Connecting...';

        // Enable Slash Command registration only if bot is online
        [registerSlashBtn, unregisterSlashBtn].forEach(btn => {
            // Process: btn.disabled = !isOnline
            btn.disabled = !isOnline;
            btn.style.opacity = isOnline ? '1' : '0.5';
            // Process: btn.title = isOnline ? "" : "The bot must be connected to...
            btn.title = isOnline ? "" : "The bot must be connected to register slash commands.";
        });

        // Update the visual status LED emoji
        // Process: const indicator = document.getElementById('bot-status-ind...
        const indicator = document.getElementById('bot-status-indicator');
        if (indicator) {
            // Process: if (isOnline) indicator.textContent = '🟩'
            if (isOnline) indicator.textContent = '🟩';
            else if (isConnecting) indicator.textContent = '🟨';
            // Process: else indicator.textContent = '🟥'
            else indicator.textContent = '🟥';
            indicator.title = `Bot Status: ${status.message}`;
        // Process:
        }
    };

    // Process: registerSlashBtn.addEventListener('click', async () =>
    registerSlashBtn.addEventListener('click', async () => {
        registerSlashBtn.disabled = true;
        // Process: const result = await window.settings.registerSlashCommands()
        const result = await window.settings.registerSlashCommands();
        if (result.success) alert("Slash commands registered!");
        // Process: else alert("Error: " + result.error)
        else alert("Error: " + result.error);
        registerSlashBtn.disabled = false;
    // Process: )
    });

    unregisterSlashBtn.addEventListener('click', async () => {
        // Process: unregisterSlashBtn.disabled = true
        unregisterSlashBtn.disabled = true;
        const result = await window.settings.unregisterSlashCommands();
        // Process: if (result.success) alert("Slash commands unregistered!")
        if (result.success) alert("Slash commands unregistered!");
        else alert("Error: " + result.error);
        // Process: unregisterSlashBtn.disabled = false
        unregisterSlashBtn.disabled = false;
    });

    // Process: if (walkthroughBtn)
    if (walkthroughBtn) {
        walkthroughBtn.addEventListener('click', () => {
            // Process: window.settings.openWalkthrough()
            window.settings.openWalkthrough();
        });
    // Process:
    }

    // --- Help Button ---
    const helpButton = document.getElementById('help-button');
    // Process: const helpDialog = document.getElementById('help-dialog')
    const helpDialog = document.getElementById('help-dialog');
    const helpContent = document.getElementById('help-content');
    // Process: const licenseButton = document.getElementById('license-bu...
    const licenseButton = document.getElementById('license-button');
    const licenseDialog = document.getElementById('license-dialog');
    // Process: const licenseTableBody = document.getElementById('license...
    const licenseTableBody = document.getElementById('license-table-body');
    const licenseTextDialog = document.getElementById('license-text-dialog');
    // Process: const licenseTextTitle = document.getElementById('license...
    const licenseTextTitle = document.getElementById('license-text-title');
    const licenseTextContent = document.getElementById('license-text-content');

    // Process: helpButton.addEventListener('click', async () =>
    helpButton.addEventListener('click', async () => {
        const content = await window.settings.getHelpContent();
        // Basic Markdown-ish parsing for better display
        // Process: const parsed = content
        const parsed = content
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Process: .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            // Process: .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            // Process: .replace(/\[(.*?)\]\((.*?)\)/g, (m, text, url) => `<a hre...
            .replace(/\[(.*?)\]\((.*?)\)/g, (m, text, url) => `<a href="#" onclick="window.settings.openExternal('${url}')">${text}</a>`)
            .replace(/\n\n/g, '<br><br>');

        // Process: helpContent.innerHTML = parsed
        helpContent.innerHTML = parsed;
        helpDialog.showModal();
    // Process: )
    });

    licenseButton.addEventListener('click', async () => {
        // Process: const result = await window.settings.getLicenses()
        const result = await window.settings.getLicenses();
        if (result.success) {
            // Process: licenseTableBody.innerHTML = ''
            licenseTableBody.innerHTML = '';
            result.licenses.forEach(pkg => {
                // Process: const tr = document.createElement('tr')
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';

                // Process: const nameTd = document.createElement('td')
                const nameTd = document.createElement('td');
                nameTd.style.padding = '8px';
                // Process: nameTd.textContent = pkg.name
                nameTd.textContent = pkg.name;

                const versionTd = document.createElement('td');
                // Process: versionTd.style.padding = '8px'
                versionTd.style.padding = '8px';
                versionTd.textContent = pkg.version;

                // Process: const licenseTd = document.createElement('td')
                const licenseTd = document.createElement('td');
                licenseTd.style.padding = '8px';
                // Process: const licenseSpan = document.createElement('span')
                const licenseSpan = document.createElement('span');
                licenseSpan.textContent = pkg.licenseType || pkg.license || 'Unknown';
                // Process: licenseSpan.style.cursor = 'pointer'
                licenseSpan.style.cursor = 'pointer';
                licenseSpan.style.textDecoration = 'underline';
                // Process: licenseSpan.style.color = '#a0c8ff'
                licenseSpan.style.color = '#a0c8ff';
                licenseSpan.title = 'Click to view full license text';

                // Process: licenseSpan.onclick = () =>
                licenseSpan.onclick = () => {
                    licenseTextTitle.textContent = `${pkg.name} - ${licenseSpan.textContent} License`;
                    // Process: licenseTextContent.textContent = pkg.licenseText || 'No l...
                    licenseTextContent.textContent = pkg.licenseText || 'No license text available.';
                    licenseTextDialog.showModal();
                // Process:
                };

                licenseTd.appendChild(licenseSpan);
                // Process: tr.appendChild(nameTd)
                tr.appendChild(nameTd);
                tr.appendChild(versionTd);
                // Process: tr.appendChild(licenseTd)
                tr.appendChild(licenseTd);

                licenseTableBody.appendChild(tr);
            // Process: )
            });
            licenseDialog.showModal();
        // Process: else
        } else {
            alert("Error fetching licenses: " + result.error);
        // Process:
        }
    });

    // Process: window.settings.onBotStatus(updateBotStatusUI)
    window.settings.onBotStatus(updateBotStatusUI);

    // Request existing config from main process when window loads
    window.settings.getDiscordConfig();
    // Process: window.settings.requestBotStatus()
    window.settings.requestBotStatus();

    // Populate fields when config is received
    window.settings.onConfigReceived((config) => {
        // Process: if (config)
        if (config) {
            originalConfig = config;
            // Process: enableDiscordBotCheckbox.checked = !!config.enabled
            enableDiscordBotCheckbox.checked = !!config.enabled;
            discordFieldsContainer.style.opacity = enableDiscordBotCheckbox.checked ? '1' : '0.5';
            // Process: discordFieldsContainer.style.pointerEvents = enableDiscor...
            discordFieldsContainer.style.pointerEvents = enableDiscordBotCheckbox.checked ? 'auto' : 'none';

            tokenInput.value = config.token || '';
            // Process: voiceChannelInput.value = config.voiceChannel || ''
            voiceChannelInput.value = config.voiceChannel || '';
            textChannelInput.value = config.textChannel || '';
            // Process: botRoleIdInput.value = config.botRoleId || ''
            botRoleIdInput.value = config.botRoleId || '';
            ffmpegPathInput.value = config.ffmpegPath || '';
            // Process: bestiaryPathInput.value = config.bestiaryPath || ''
            bestiaryPathInput.value = config.bestiaryPath || '';
            gitRepoUrlInput.value = config.gitRepoUrl || 'https://github.com/5etools-mirror-3/5etools-src';
            // Process: githubTokenInput.value = config.githubToken || ''
            githubTokenInput.value = config.githubToken || '';
            randomTablesPathInput.value = config.randomTablesPath || '';
            // Process: defaultMusicPathInput.value = config.defaultMusicPath || ''
            defaultMusicPathInput.value = config.defaultMusicPath || '';
            audioModeToggle.checked = !!config.audioMode;

            // Auto-detect FFmpeg if not set
            // Process: if (!config.ffmpegPath)
            if (!config.ffmpegPath) {
                window.settings.detectFfmpeg().then(path => {
                    // Process: if (path)
                    if (path) {
                        ffmpegPathInput.value = path;
                        // Process: checkDirty()
                        checkDirty();
                    }
                // Process: )
                });
            }
            // Process: checkDirty()
            checkDirty();
        }
    // Process: )
    });

    saveButton.addEventListener('click', () => {
        // Process: if (enableDiscordBotCheckbox.checked)
        if (enableDiscordBotCheckbox.checked) {
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                // Process: alert("Please enter all Discord bot settings or disable t...
                alert("Please enter all Discord bot settings or disable the bot.");
                return;
            // Process:
            }
        }

        // Process: const newConfig =
        const newConfig = {
            enabled: enableDiscordBotCheckbox.checked,
            // Process: token: tokenInput.value,
            token: tokenInput.value,
            voiceChannel: voiceChannelInput.value,
            // Process: textChannel: textChannelInput.value,
            textChannel: textChannelInput.value,
            botRoleId: botRoleIdInput.value,
            // Process: ffmpegPath: ffmpegPathInput.value,
            ffmpegPath: ffmpegPathInput.value,
            bestiaryPath: bestiaryPathInput.value,
            // Process: gitRepoUrl: gitRepoUrlInput.value,
            gitRepoUrl: gitRepoUrlInput.value,
            githubToken: githubTokenInput.value,
            // Process: randomTablesPath: randomTablesPathInput.value,
            randomTablesPath: randomTablesPathInput.value,
            defaultMusicPath: defaultMusicPathInput.value,
            // Process: audioMode: audioModeToggle.checked
            audioMode: audioModeToggle.checked
        };
        // Process: window.settings.setDiscordConfig(newConfig)
        window.settings.setDiscordConfig(newConfig);
        originalConfig = newConfig;
        // Process: checkDirty()
        checkDirty();
    });
// Process: )
});