// Performance and security update
const { ipcRenderer } = window.electron;

document.addEventListener('DOMContentLoaded', () => {
    const fields = ['token', 'voiceChannel', 'textChannel', 'botRoleId', 'ffmpegPath', 'defaultMusicPath', 'randomTablesPath', 'bestiaryPath', 'gitRepoUrl', 'githubToken'];
    const enableDiscordBot = document.getElementById('enableDiscordBot');
    const saveButton = document.getElementById('save-button');
    let originalConfig = {};

    // --- Slash Command Buttons ---
    const settingsContainer = document.querySelector('.settings-container');
    const slashBtnGroup = document.createElement('div');
    slashBtnGroup.className = 'form-group';
    slashBtnGroup.style.marginTop = '20px';
    slashBtnGroup.innerHTML = `
        <label>Slash Commands</label>
        <div style="display: flex; gap: 5px;">
            <button id="register-slash-btn" style="flex: 1;">Register</button>
            <button id="unregister-slash-btn" style="flex: 1;">Unregister</button>
        </div>
        <p id="slash-hint" style="font-size: 0.75em; color: #888; margin-top: 5px; display: none;">Restart the application with the info in here to make these buttons work.</p>
    `;
    // Insert before save button
    settingsContainer.insertBefore(slashBtnGroup, saveButton);

    const regBtn = document.getElementById('register-slash-btn');
    const unregBtn = document.getElementById('unregister-slash-btn');
    const hint = document.getElementById('slash-hint');

    function updateSlashButtons(botReady) {
        const msg = "Restart the application with the info in here to make these buttons work.";
        regBtn.disabled = !botReady;
        unregBtn.disabled = !botReady;
        regBtn.title = botReady ? "" : msg;
        unregBtn.title = botReady ? "" : msg;
        hint.style.display = botReady ? 'none' : 'block';
    }

    regBtn.addEventListener('click', async () => {
        const res = await ipcRenderer.invoke('register-slash-commands');
        alert(res.success ? 'Slash commands registered!' : 'Error: ' + res.error);
    });

    unregBtn.addEventListener('click', async () => {
        const res = await ipcRenderer.invoke('unregister-slash-commands');
        alert(res.success ? 'Slash commands removed.' : 'Error: ' + res.error);
    });

    // --- Load Config ---
    ipcRenderer.send('get-discord-config');
    ipcRenderer.on('discord-config', (event, config) => {
        originalConfig = { ...config };
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = config[id] || '';
        });
        enableDiscordBot.checked = !!config.enabled;
        document.getElementById('discord-fields').style.opacity = enableDiscordBot.checked ? '1' : '0.5';

        // Initial button state - we don't know if bot is ready yet, but assume if no token, it isn't.
        updateSlashButtons(!!config.token);
    });

    // --- Save Logic ---
    saveButton.addEventListener('click', () => {
        const config = { enabled: enableDiscordBot.checked };
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) config[id] = el.value;
        });
        ipcRenderer.send('set-discord-config', config);
    });

    // --- Folder Setup ---
    document.getElementById('setup-default-folders').addEventListener('click', async () => {
        const paths = await ipcRenderer.invoke('setup-default-folders');
        if (paths) {
            Object.keys(paths).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = paths[id];
            });
            saveButton.classList.add('dirty');
        }
    });

    // --- Browse Buttons ---
    const bindBrowse = (btnId, fieldId, channel) => {
        document.getElementById(btnId).addEventListener('click', async () => {
            const path = await ipcRenderer.invoke(channel);
            if (path) {
                document.getElementById(fieldId).value = path;
                saveButton.classList.add('dirty');
            }
        });
    };

    bindBrowse('browse-ffmpeg', 'ffmpegPath', 'select-ffmpeg-file');
    bindBrowse('browse-music', 'defaultMusicPath', 'select-music-folder');
    bindBrowse('browse-random-tables', 'randomTablesPath', 'select-random-tables-folder');
    bindBrowse('browse-bestiary', 'bestiaryPath', 'select-bestiary-folder');

    // --- Bestiary Fetch ---
    document.getElementById('fetch-bestiary-btn').addEventListener('click', async () => {
        const repoUrl = document.getElementById('gitRepoUrl').value;
        const localPath = document.getElementById('bestiaryPath').value;
        const githubToken = document.getElementById('githubToken').value;

        if (!repoUrl || !localPath) {
            alert('Please provide both the Git Repo URL and a local path for the bestiary.');
            return;
        }

        document.getElementById('fetch-bestiary-btn').disabled = true;
        document.getElementById('fetch-bestiary-btn').innerText = 'Syncing... (Check Main Log)';

        const result = await ipcRenderer.invoke('fetch-bestiary-data', { repoUrl, localPath, githubToken });
        alert(result.success ? 'Bestiary sync complete!' : 'Bestiary sync failed: ' + result.error);

        document.getElementById('fetch-bestiary-btn').disabled = false;
        document.getElementById('fetch-bestiary-btn').innerText = 'Fetch/Update Bestiary Data From Git';
    });

    // --- UI State ---
    enableDiscordBot.addEventListener('change', () => {
        document.getElementById('discord-fields').style.opacity = enableDiscordBot.checked ? '1' : '0.5';
        saveButton.classList.add('dirty');
    });

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => saveButton.classList.add('dirty'));
    });
});
