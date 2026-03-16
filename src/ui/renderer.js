// Performance and security update
document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    let initiativeOrder = [];
    let combatantPanelOrder = [];
    let currentTurnIndex = 0;
    const logPanels = [
        { id: 'logArea', title: 'Log' },
        { id: 'diceLog', title: 'Dice Log' },
        { id: 'statBlockArea', title: 'Stat Block' }
    ];
    let currentPanelIndex = 0;
    let botStatus = { status: 'offline', message: 'Unknown' };
    let isBotEnabled = false;
    let currentStatBlockData = null;
    let DND_CONDITIONS = {};
    let MOB_RULES_DATA = {};

    // Music Player State
    let musicStatus = {
        isPlaying: false,
        stack: [],
        currentTrackIndex: 0,
        loopMode: 'none',
        shuffle: false
    };

    // --- Form State ---
    let isMobMode = false;
    let singleCreatureHPForMob = '10';
    let calculatedSingleCreatureHP = 10;
    let creatureBeingEdited = null;

    // --- Element Refs ---
    const logArea = document.getElementById('logArea');
    const diceLog = document.getElementById('diceLog');
    const previewAudioPlayer = document.getElementById('preview-audio-player');
    const addCreatureForm = document.getElementById('add-creature-form');
    const initiativeListDiv = document.getElementById('initiative-list');
    const combatantDetailsListDiv = document.getElementById('combatant-details-list');
    const maxLogEntries = 50;

    // --- Initial Load ---
    window.electron.ipcRenderer.invoke('get-dnd-conditions').then(c => DND_CONDITIONS = c);
    window.electron.ipcRenderer.invoke('get-mob-rules-data').then(r => MOB_RULES_DATA = r);
    window.electron.ipcRenderer.send('window-ready');
    setTimeout(() => window.electron.ipcRenderer.send('request-initial-load'), 100);

    // --- Form Setup ---
    addCreatureForm.innerHTML = `
        <h2>Add Combatant <button id="import-from-file-btn" class="small-btn" title="Import from File">⬇️</button></h2>
        <div class="form-row">
            <div class="form-group name-group">
                <label>Combatant:</label>
                <input type="text" id="creature-name" required>
                <span id="imported-monster-info-btn" class="info-btn" style="display: none;">ℹ️</span>
            </div>
            <div id="mob-controls" class="form-group" style="display: none; align-items: center;">
                <label>Count:</label>
                <input type="number" id="mob-size" min="1" value="5" style="width: 60px;">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Initiative:</label><input type="text" id="creature-initiative" placeholder="+3 or 15"></div>
            <div class="form-group"><label>HP:</label><input type="text" id="creature-hp" placeholder="2d8+2"></div>
            <div class="form-group"><label>AC:</label><input type="number" id="creature-ac" placeholder="15"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Speed:</label><input type="text" id="creature-speed" placeholder="30ft"></div>
            <div class="form-group"><label>Atk Mod:</label><input type="text" id="attack-modifier" placeholder="+5"></div>
            <div class="form-group"><label>Save DC:</label><input type="number" id="save-dc" placeholder="13"></div>
        </div>
        <hr>
        <div class="stats-grid">
            <div class="grid-header"></div><div class="grid-header">STR</div><div class="grid-header">DEX</div><div class="grid-header">CON</div><div class="grid-header">INT</div><div class="grid-header">WIS</div><div class="grid-header">CHA</div>
            <div class="grid-label">Score</div>
            <input type="number" id="str-score" placeholder="12"><input type="number" id="dex-score" placeholder="12"><input type="number" id="con-score" placeholder="12"><input type="number" id="int-score" placeholder="12"><input type="number" id="wis-score" placeholder="12"><input type="number" id="cha-score" placeholder="12">
            <div class="grid-label">Save</div>
            <input type="text" id="str-save" placeholder="+1"><input type="text" id="dex-save" placeholder="+1"><input type="text" id="con-save" placeholder="+1"><input type="text" id="int-save" placeholder="+1"><input type="text" id="wis-save" placeholder="+1"><input type="text" id="cha-save" placeholder="+1">
        </div>
        <div class="form-actions">
            <button type="button" id="convert-to-mob-btn">Convert to Mob</button>
            <button type="button" id="import-monster-btn">Import Combatant</button>
            <button type="submit" class="add-creature-button">Add Combatant</button>
            <button type="button" id="clear-form-btn">Clear</button>
        </div>
    `;

    // --- Music UI Re-design ---
    const musicContainer = document.getElementById('music-controls-container');
    musicContainer.innerHTML = `
        <div class="panel-header">
            <h2>Music</h2>
            <div class="panel-header-controls">
                <button id="music-clear-btn" class="small-btn" title="Clear Stack">🗑️</button>
            </div>
        </div>
        <div class="music-stack-list" id="music-stack-list"></div>
        <div class="controls">
            <button id="music-prev-btn" title="Previous">⏮️</button>
            <button id="music-play-btn">▶️ Play</button>
            <button id="music-next-btn" title="Next">⏭️</button>
            <button id="music-loop-btn" title="Loop Mode">🔁</button>
            <button id="music-shuffle-btn" title="Shuffle">🔀</button>
        </div>
        <div class="controls">
            <button id="music-add-file-btn">➕ Files</button>
            <button id="music-add-folder-btn">➕ Folder</button>
            <button id="music-preview-btn">👁️ Preview</button>
        </div>
        <div class="fileLabel">
            <span>Now Playing:</span>
            <span id="music-now-playing" class="active-track-name">None</span>
        </div>
    `;

    function updateMusicUI() {
        const list = document.getElementById('music-stack-list');
        list.innerHTML = musicStatus.stack.map((t, i) => `
            <div class="music-stack-item ${i === musicStatus.currentTrackIndex ? 'active' : ''}" data-index="${i}">
                <span>${i + 1}. ${t.name}</span>
                <span class="stack-item-remove" data-index="${i}">×</span>
            </div>
        `).join('');

        const playBtn = document.getElementById('music-play-btn');
        playBtn.innerHTML = musicStatus.isPlaying ? '⏸️ Pause' : '▶️ Play';

        const loopBtn = document.getElementById('music-loop-btn');
        const loopModes = { 'none': '🔁', 'all': '🔁 (All)', 'one': '🔂' };
        loopBtn.textContent = loopModes[musicStatus.loopMode] || '🔁';
        loopBtn.classList.toggle('active', musicStatus.loopMode !== 'none');

        const shuffleBtn = document.getElementById('music-shuffle-btn');
        shuffleBtn.classList.toggle('active', musicStatus.shuffle);

        const nowPlaying = document.getElementById('music-now-playing');
        const active = musicStatus.stack[musicStatus.currentTrackIndex];
        nowPlaying.textContent = active ? active.name : 'None';
    }

    // --- Logging ---
    function logMessage(message) {
        if (typeof message !== 'string') message = JSON.stringify(message);
        const logEntry = document.createElement('div');
        logEntry.textContent = `> ${message}`;
        logArea.appendChild(logEntry);
        if (logArea.children.length > maxLogEntries) logArea.removeChild(logArea.firstChild);
        logArea.scrollTop = logArea.scrollHeight;
    }

    function showPanel(panelId, title) {
        const logTitle = document.getElementById('log-title');
        const pushButton = document.getElementById('push-panel-btn');
        logPanels.forEach((panel, index) => {
            const el = document.getElementById(panel.id);
            if (panel.id === panelId) {
                el.style.display = 'block';
                logTitle.textContent = title || panel.title;
                currentPanelIndex = index;
            } else {
                el.style.display = 'none';
            }
        });
        pushButton.style.display = (panelId === 'diceLog' || panelId === 'statBlockArea') ? 'inline-block' : 'none';
    }

    // --- Core Listeners ---
    document.addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.id;

        if (target.classList.contains('stack-item-remove')) {
            const index = parseInt(target.dataset.index);
            window.electron.ipcRenderer.send('remove-from-stack', index);
            return;
        }

        if (target.classList.contains('stack-play-btn')) {
            const slotId = parseInt(target.dataset.id);
            toggleSoundboardPlay(slotId);
            return;
        }

        if (target.classList.contains('stack-add-btn')) {
            const slotId = parseInt(target.dataset.id);
            const tracks = await window.electron.ipcRenderer.invoke('load-sound', { slotId });
            if (tracks) {
                soundboardState[slotId].tracks.push(...tracks);
                saveSoundboardState();
                renderSoundboard();
            }
            return;
        }

        switch(id) {
            case 'music-play-btn':
                if (!isBotEnabled) { showBotNag(); return; }
                musicStatus.isPlaying ? window.electron.ipcRenderer.send('pause-music') : window.electron.ipcRenderer.send('play-music');
                break;
            case 'music-prev-btn': window.electron.ipcRenderer.send('previous-track'); break;
            case 'music-next-btn': window.electron.ipcRenderer.send('next-track'); break;
            case 'music-clear-btn': window.electron.ipcRenderer.send('clear-music-stack'); break;
            case 'music-loop-btn':
                const nextLoop = { 'none': 'all', 'all': 'one', 'one': 'none' };
                window.electron.ipcRenderer.send('set-music-loop-mode', nextLoop[musicStatus.loopMode]);
                break;
            case 'music-shuffle-btn':
                window.electron.ipcRenderer.send('set-music-shuffle', !musicStatus.shuffle);
                break;
            case 'music-add-file-btn':
                const paths = await window.electron.ipcRenderer.invoke('open-file-dialog', { multi: true });
                if (paths) paths.forEach(p => window.electron.ipcRenderer.send('load-music-file', p));
                break;
            case 'music-add-folder-btn':
                const folderPaths = await window.electron.ipcRenderer.invoke('open-file-dialog', { multi: true, directory: true });
                if (folderPaths) folderPaths.forEach(p => window.electron.ipcRenderer.send('load-music-file', p));
                break;
            case 'music-preview-btn':
                if (!previewAudioPlayer.paused) { previewAudioPlayer.pause(); }
                else {
                    const res = await window.electron.ipcRenderer.invoke('get-preview-audio-data');
                    if (res.success) { previewAudioPlayer.src = res.url; previewAudioPlayer.play(); }
                }
                break;
            case 'settings-button': window.electron.ipcRenderer.send('open-settings-window'); break;
            case 'next-turn-button': window.electron.ipcRenderer.send('next-turn'); break;
            case 'previous-turn-button': window.electron.ipcRenderer.send('previous-turn'); break;
            case 'push-initiative-btn': window.electron.ipcRenderer.send('push-initiative'); break;
            case 'import-monster-btn': createPopup('monster-search', null, target); break;
            case 'log-toggle-btn':
                currentPanelIndex = (currentPanelIndex + 1) % logPanels.length;
                showPanel(logPanels[currentPanelIndex].id);
                break;
            case 'reset-encounter-mid':
            case 'reset-encounter-right': window.electron.ipcRenderer.send('reset-encounter'); break;
            case 'clear-encounter-mid':
            case 'clear-encounter-right': window.electron.ipcRenderer.send('clear-encounter'); break;
            case 'save-button': window.electron.ipcRenderer.send('save-encounter'); break;
            case 'load-button': window.electron.ipcRenderer.invoke('load-encounter-dialog'); break;
        }
    });

    // --- IPC Handlers ---
    window.electron.ipcRenderer.on('music-player-status', (event, status) => {
        musicStatus = status;
        updateMusicUI();
    });

    window.electron.ipcRenderer.on('log-message', (e, msg) => logMessage(msg));
    window.electron.ipcRenderer.on('dice-log', (e, msg) => {
        const entry = document.createElement('div');
        entry.textContent = msg;
        diceLog.appendChild(entry);
        showPanel('diceLog');
    });

    window.electron.ipcRenderer.on('discord-bot-status', (e, s) => {
        botStatus = s;
        isBotEnabled = s.status !== 'offline';
    });

    window.electron.ipcRenderer.on('update-initiative-list', (e, data) => {
        initiativeOrder = data.initiativeOrder;
        currentTurnIndex = data.currentTurnIndex;
        combatantPanelOrder = [...initiativeOrder];
        renderInitiativeList();
        renderCombatantDetailsList();
    });

    // Initiative and Combatant Rendering
    function renderInitiativeList() {
        initiativeListDiv.innerHTML = '';
        initiativeOrder.forEach((c, i) => {
            const entry = document.createElement('div');
            entry.className = 'initiative-entry' + (i === currentTurnIndex ? ' active-turn' : '');
            const maxHp = c.maxHp || 1;
            const hpPerc = Math.min(100, (c.hp / maxHp) * 100);
            entry.innerHTML = `
                <span class="initiative-score">${c.initiative}</span>
                <span class="creature-name">${c.name} ${c.isMob ? `(${Math.ceil(c.hp / (c.singleCreatureHP || 1))})` : ''}</span>
                <div class="initiative-hp-bar-container"><div class="hp-bar-current" style="width: ${hpPerc}%; background: ${getHpColor(c.hp, maxHp)}"></div></div>
            `;
            initiativeListDiv.appendChild(entry);
        });
    }

    function renderCombatantDetailsList() {
        combatantDetailsListDiv.innerHTML = '';
        combatantPanelOrder.forEach(c => {
            const entry = document.createElement('div');
            entry.className = 'combatant-details-entry';
            const maxHp = c.maxHp || 1;
            const hpPerc = Math.min(100, (c.hp / maxHp) * 100);
            entry.innerHTML = `
                <div class="combatant-header"><h4>${c.name}</h4><div class="header-right-group"><span>AC: ${c.ac}</span><button class="remove-btn" data-id="${c.id}">❌</button></div></div>
                <div class="combatant-body">
                    <div class="hp-bar-container">
                        <div class="hp-bar-current" style="width: ${hpPerc}%; background: ${getHpColor(c.hp, maxHp)}"></div>
                        <span class="hp-bar-text">${c.hp} / ${maxHp}</span>
                    </div>
                </div>
            `;
            combatantDetailsListDiv.appendChild(entry);
        });
    }

    function getHpColor(curr, max) {
        const p = (curr / max) * 100;
        if (p >= 100) return '#007bff';
        if (p >= 50) return '#28a745';
        if (p >= 25) return '#ffc107';
        return '#dc3545';
    }

    const showBotNag = () => {
        if (confirm("Discord bot is not configured or offline. Open settings?")) {
            window.electron.ipcRenderer.send('open-settings-window');
        }
    };

    // --- Form Handling ---
    addCreatureForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const creature = {
            id: Date.now(),
            name: document.getElementById('creature-name').value,
            initiative: document.getElementById('creature-initiative').value,
            hp: document.getElementById('creature-hp').value,
            ac: parseInt(document.getElementById('creature-ac').value) || 10,
            isMob: isMobMode,
            mobInitialCount: parseInt(document.getElementById('mob-size').value) || 1
        };
        window.electron.ipcRenderer.send('add-creature', creature);
        addCreatureForm.reset();
    });

    document.getElementById('convert-to-mob-btn').addEventListener('click', () => {
        isMobMode = !isMobMode;
        document.getElementById('mob-controls').style.display = isMobMode ? 'flex' : 'none';
        document.getElementById('convert-to-mob-btn').textContent = isMobMode ? 'Convert to Single' : 'Convert to Mob';
    });

    // --- Soundboard ---
    let soundboardState = [];
    window.electron.ipcRenderer.invoke('get-soundboard-state').then(state => {
        soundboardState = state?.slots || [];
        // Ensure 9 slots
        while(soundboardState.length < 9) soundboardState.push({ emoji: '🎨', tracks: [], isPlaying: false, currentTrackIndex: 0 });
        renderSoundboard();
    });

    function renderSoundboard() {
        const grid = document.getElementById('soundboard-grid');
        grid.innerHTML = '';
        soundboardState.forEach((slot, i) => {
            const div = document.createElement('div');
            div.className = 'soundboard-stack-slot';
            div.innerHTML = `
                <div class="stack-header"><button class="stack-emoji-btn">${slot.emoji}</button><span>${slot.tracks.length}</span></div>
                <button class="stack-play-btn" data-id="${i}" ${slot.tracks.length === 0 ? 'disabled' : ''}>${slot.isPlaying ? '⏹️' : '⏯️'}</button>
                <div class="stack-controls"><button class="stack-add-btn" data-id="${i}">➕</button></div>
            `;
            grid.appendChild(div);
        });
    }

    function toggleSoundboardPlay(slotId) {
        if (!isBotEnabled) { showBotNag(); return; }
        const slot = soundboardState[slotId];
        if (slot.isPlaying) {
            window.electron.ipcRenderer.send('stop-sound', { slotId });
            slot.isPlaying = false;
        } else {
            if (slot.tracks.length === 0) return;
            const track = slot.tracks[slot.currentTrackIndex || 0];
            window.electron.ipcRenderer.send('play-sound', { slotId, filePath: track.path });
            slot.isPlaying = true;
        }
        renderSoundboard();
    }

    function saveSoundboardState() {
        window.electron.ipcRenderer.send('save-soundboard-state', { slots: soundboardState });
    }

    // Handle sound finish for auto-advance in soundboard
    window.electron.ipcRenderer.on('sound-finished', (event, slotId) => {
        const slot = soundboardState[slotId];
        if (slot) {
            slot.isPlaying = false;
            slot.currentTrackIndex = (slot.currentTrackIndex + 1) % slot.tracks.length;
            renderSoundboard();
        }
    });

    // --- Popups ---
    function createPopup(type, creatureId, target) {
        const popup = document.createElement('div');
        popup.className = 'popup-dialog';
        popup.innerHTML = `<input type="text" id="popup-input"><button id="popup-ok">Ok</button>`;
        document.body.appendChild(popup);
        const rect = target.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY}px`;
        popup.style.left = `${rect.left + window.scrollX}px`;
        document.getElementById('popup-ok').onclick = () => popup.remove();
        setTimeout(() => document.addEventListener('click', e => { if (!popup.contains(e.target)) popup.remove(); }, {once:true}), 0);
    }
});
