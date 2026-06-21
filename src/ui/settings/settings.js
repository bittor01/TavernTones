/**
 * @file settings.js
 * Logic for the configuration window. Handles UI binding, folder selection,
 * bot control, and data syncing via the exposed 'settings' IPC API.
 */

// Wait for the DOM to be fully loaded before initializing listeners and fetching data
document.addEventListener('DOMContentLoaded', () => {
    // --- Discord Integration Inputs ---
    // Toggle for the bot feature
    const enableDiscordBotCheckbox = document.getElementById('enableDiscordBot');
    // Container for the detailed Discord fields (shown/hidden based on toggle)
    const discordFieldsContainer = document.getElementById('discord-fields');
    // Secret bot token
    const tokenInput = document.getElementById('token');
    // Target voice channel ID
    const voiceChannelInput = document.getElementById('voiceChannel');
    // Target text channel ID
    const textChannelInput = document.getElementById('textChannel');
    // Specific role ID for the bot to respond to
    const botRoleIdInput = document.getElementById('botRoleId');

    // --- Path and Data Inputs ---
    // Executable path for FFmpeg
    const ffmpegPathInput = document.getElementById('ffmpegPath');
    // Path to bestiary data folder
    const bestiaryPathInput = document.getElementById('bestiaryPath');
    // Source URL for syncing 5e data
    const gitRepoUrlInput = document.getElementById('gitRepoUrl');
    // Optional Personal Access Token for GitHub
    const githubTokenInput = document.getElementById('githubToken');
    // Path to random tables folder
    const randomTablesPathInput = document.getElementById('randomTablesPath');
    // Base folder for the music library
    const defaultMusicPathInput = document.getElementById('defaultMusicPath');
    // Global toggle for 'Audio-Only' mode layout
    const audioModeToggle = document.getElementById('audioModeToggle');

    // --- Action Buttons ---
    const browseFfmpegBtn = document.getElementById('browse-ffmpeg');
    const browseBestiaryBtn = document.getElementById('browse-bestiary');
    const fetchBestiaryBtn = document.getElementById('fetch-bestiary-btn');
    const browseRandomTablesBtn = document.getElementById('browse-random-tables');
    const browseMusicBtn = document.getElementById('browse-music');
    const setupDefaultFoldersBtn = document.getElementById('setup-default-folders');
    const registerSlashBtn = document.getElementById('register-slash-btn');
    const unregisterSlashBtn = document.getElementById('unregister-slash-btn');
    const walkthroughBtn = document.getElementById('walkthrough-btn');
    const saveButton = document.getElementById('save-button');

    // Stores the initial configuration state to detect unsaved changes
    let originalConfig = {};

    /**
     * Compares the current UI values against the original config.
     * Highlights the save button if changes are detected.
     */
    const checkDirty = () => {
        // Collect current values from the form
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

        // Iterate through all tracked config keys to find any changes
        const isDirty = Object.keys(currentConfig).some(key => {
            const val = currentConfig[key];
            const orig = originalConfig[key];
            // Handle boolean (checkbox) vs string comparisons
            if (typeof val === 'boolean') return val !== !!orig;
            return val !== (orig || '');
        });

        // --- Validation Logic ---
        // If the bot is enabled, ensure all mandatory fields are filled out
        let isValid = true;
        if (enableDiscordBotCheckbox.checked) {
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                isValid = false;
            }
        }

        // Apply visual 'dirty' state to the save button if changes exist and the form is valid
        if (isDirty && isValid) {
            saveButton.classList.add('dirty');
        } else {
            saveButton.classList.remove('dirty');
        }
    };

    // Toggle the visual state (opacity/interaction) of the Discord fields based on the checkbox
    enableDiscordBotCheckbox.addEventListener('change', () => {
        discordFieldsContainer.style.opacity = enableDiscordBotCheckbox.checked ? '1' : '0.5';
        discordFieldsContainer.style.pointerEvents = enableDiscordBotCheckbox.checked ? 'auto' : 'none';
        checkDirty();
    });

    // Attach real-time 'dirty' check to all text inputs
    [tokenInput, voiceChannelInput, textChannelInput, botRoleIdInput, ffmpegPathInput, bestiaryPathInput, gitRepoUrlInput, githubTokenInput, randomTablesPathInput, defaultMusicPathInput].forEach(el => {
        el.addEventListener('input', checkDirty);
    });
    // Attach check to the audio mode checkbox
    audioModeToggle.addEventListener('change', checkDirty);

    /**
     * Shared helper to open a folder picker and update the corresponding input field.
     * @param {string} ipcChannel - The IPC channel to invoke.
     * @param {HTMLElement} inputElement - The text input to populate with the result.
     */
    const handleBrowse = async (ipcChannel, inputElement) => {
        const path = await window.settings.selectFolder(ipcChannel);
        if (path) {
            inputElement.value = path;
        }
    };

    // --- Specialized Browse Handlers ---

    // FFmpeg uses a specific detector/selector bridge
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

    /**
     * Executes the GitHub sync for bestiary data.
     * Provides visual feedback during the network operation.
     */
    fetchBestiaryBtn.addEventListener('click', async () => {
        // Path is required for syncing
        if (!bestiaryPathInput.value) {
            alert("Please set a Bestiary Data Path first.");
            return;
        }
        // Visual 'Busy' state
        fetchBestiaryBtn.disabled = true;
        fetchBestiaryBtn.textContent = "Syncing...";

        // Trigger sync via settings API
        const result = await window.settings.fetchBestiaryData(gitRepoUrlInput.value, bestiaryPathInput.value, githubTokenInput.value);

        // Show result to user
        if (result.success) {
            alert(result.message);
        } else {
            alert("Error: " + result.error);
        }

        // Restore button state
        fetchBestiaryBtn.disabled = false;
        fetchBestiaryBtn.textContent = "Fetch/Update Bestiary Data";
    });

    // --- Discord Bot Control & Status ---

    /**
     * Updates the UI buttons and status indicator based on the bot's connectivity.
     */
    const updateBotStatusUI = (status) => {
        const isOnline = status && status.status === 'online';
        const isConnecting = status && status.status === 'offline' && status.message === 'Connecting...';

        // Disable command registration buttons if the bot isn't online
        [registerSlashBtn, unregisterSlashBtn].forEach(btn => {
            btn.disabled = !isOnline;
            btn.style.opacity = isOnline ? '1' : '0.5';
            btn.title = isOnline ? "" : "The bot must be connected to register slash commands.";
        });

        // Update the visual emoji indicator and tooltip
        const indicator = document.getElementById('bot-status-indicator');
        if (indicator) {
            if (isOnline) {
                indicator.textContent = '🟩'; // Connected
            } else if (isConnecting) {
                indicator.textContent = '🟨'; // Transitioning
            } else {
                indicator.textContent = '🟥'; // Disconnected
            }
            indicator.title = `Bot Status: ${status.message}`;
        }
    };

    // Slash command registration listener
    registerSlashBtn.addEventListener('click', async () => {
        registerSlashBtn.disabled = true;
        const result = await window.settings.registerSlashCommands();
        if (result.success) alert("Slash commands registered!");
        else alert("Error: " + result.error);
        registerSlashBtn.disabled = false;
    });

    // Slash command removal listener
    unregisterSlashBtn.addEventListener('click', async () => {
        unregisterSlashBtn.disabled = true;
        const result = await window.settings.unregisterSlashCommands();
        if (result.success) alert("Slash commands unregistered!");
        else alert("Error: " + result.error);
        unregisterSlashBtn.disabled = false;
    });

    // Walkthrough button listener
    if (walkthroughBtn) {
        walkthroughBtn.addEventListener('click', () => {
            window.settings.openWalkthrough();
        });
    }

    // --- Help and Documentation Logic ---
    const helpButton = document.getElementById('help-button');
    const helpDialog = document.getElementById('help-dialog');
    const helpContent = document.getElementById('help-content');
    const licenseButton = document.getElementById('license-button');
    const licenseDialog = document.getElementById('license-dialog');
    const licenseTableBody = document.getElementById('license-table-body');
    const licenseTextDialog = document.getElementById('license-text-dialog');
    const licenseTextTitle = document.getElementById('license-text-title');
    const licenseTextContent = document.getElementById('license-text-content');

    /**
     * Loads the help Markdown file, performs basic HTML conversion, and shows the modal.
     */
    helpButton.addEventListener('click', async () => {
        // Fetch raw Markdown from backend
        const content = await window.settings.getHelpContent();

        // Simple regex-based Markdown parser to avoid adding a heavy library dependency
        const parsed = content
            .replace(/^# (.*$)/gm, '<h1>$1</h1>') // Headers
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/^- (.*$)/gm, '<li>$1</li>') // List items
            // Links (converted to Shell Open calls for security)
            .replace(/\[(.*?)\]\((.*?)\)/g, (m, text, url) => `<a href="#" onclick="window.settings.openExternal('${url}')">${text}</a>`)
            .replace(/\n\n/g, '<br><br>'); // Paragraphs

        // Inject and show
        helpContent.innerHTML = parsed;
        helpDialog.showModal();
    });

    /**
     * Fetches third-party license data and builds the interactive credits table.
     */
    licenseButton.addEventListener('click', async () => {
        const result = await window.settings.getLicenses();
        if (result.success) {
            // Clear existing table content
            licenseTableBody.innerHTML = '';
            // Generate a table row for each dependency
            result.licenses.forEach(pkg => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #333';

                const nameTd = document.createElement('td');
                nameTd.style.padding = '8px';
                nameTd.textContent = pkg.name;

                const versionTd = document.createElement('td');
                versionTd.style.padding = '8px';
                versionTd.textContent = pkg.version;

                const licenseTd = document.createElement('td');
                licenseTd.style.padding = '8px';
                const licenseSpan = document.createElement('span');
                licenseSpan.textContent = pkg.licenseType || pkg.license || 'Unknown';
                // Style the license name as a clickable link
                licenseSpan.style.cursor = 'pointer';
                licenseSpan.style.textDecoration = 'underline';
                licenseSpan.style.color = '#a0c8ff';
                licenseSpan.title = 'Click to view full license text';

                // On click, show the full raw license text in a separate nested modal
                licenseSpan.onclick = () => {
                    licenseTextTitle.textContent = `${pkg.name} - ${licenseSpan.textContent} License`;
                    licenseTextContent.textContent = pkg.licenseText || 'No license text available.';
                    licenseTextDialog.showModal();
                };

                licenseTd.appendChild(licenseSpan);
                tr.appendChild(nameTd);
                tr.appendChild(versionTd);
                tr.appendChild(licenseTd);

                licenseTableBody.appendChild(tr);
            });
            // Show the master license dialog
            licenseDialog.showModal();
        } else {
            alert("Error fetching licenses: " + result.error);
        }
    });

    // --- Bot Status Listeners ---

    // Listener for bot connectivity updates from the backend
    window.settings.onBotStatus(updateBotStatusUI);

    // Request existing configuration from the main process when the window loads
    window.settings.getDiscordConfig();
    // Request an immediate bot status update
    window.settings.requestBotStatus();

    /**
     * Listener: Processes configuration data and populates the form fields.
     * Includes auto-detection logic for FFmpeg if its path is empty.
     */
    window.settings.onConfigReceived((config) => {
        if (config) {
            // Set the baseline for change detection
            originalConfig = config;
            // Map values to UI inputs
            enableDiscordBotCheckbox.checked = !!config.enabled;
            // Update visual state of Discord section
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

            // Automation: If FFmpeg path isn't configured, try to locate it on the system
            if (!config.ffmpegPath) {
                window.settings.detectFfmpeg().then(path => {
                    if (path) {
                        ffmpegPathInput.value = path;
                        // Mark form as 'dirty' if an auto-detection occurred
                        checkDirty();
                    }
                });
            }
            // Update the initial state of the save button
            checkDirty();
        }
    });

    /**
     * Finalizes and saves all configuration changes back to the backend.
     */
    saveButton.addEventListener('click', () => {
        // Validation: require all bot fields if integration is enabled
        if (enableDiscordBotCheckbox.checked) {
            if (!tokenInput.value || !voiceChannelInput.value || !textChannelInput.value || !botRoleIdInput.value) {
                alert("Please enter all Discord bot settings or disable the bot.");
                return;
            }
        }

        // Assemble the final configuration object from UI state
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
        // Command the backend to save the new settings
        window.settings.setDiscordConfig(newConfig);
        // Reset the baseline to the new saved state
        originalConfig = newConfig;
        // Refresh button state
        checkDirty();
    });
});
