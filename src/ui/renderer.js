// Performance and security update
document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    let isPlaying = false;
    let initiativeOrder = [];
    let combatantPanelOrder = []; // For custom sorting of the right-hand panel
    let currentTurnIndex = 0;
    const logPanels = [
        { id: 'logArea', title: 'Log' },
        { id: 'diceLog', title: 'Dice Log' },
        { id: 'statBlockArea', title: 'Stat Block' }
    ];
    let currentPanelIndex = 0; // Default to 'Log'
    let botStatus = { status: 'offline', message: 'Unknown' };
    let isBotEnabled = false;
    let currentStatBlockData = null; // To hold the raw data of the currently viewed stat block
    let DND_CONDITIONS = {};
    let MOB_RULES_DATA = {};

    // --- Form State ---
    let isMobMode = false;
    let singleCreatureHPForMob = '10'; // Can be a dice formula string or a number
    let calculatedSingleCreatureHP = 10; // Is always the calculated number
    let creatureBeingEdited = null;

    // --- Element Refs ---
    const logArea = document.getElementById('logArea');
    const formatModifier = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
    const diceLog = document.getElementById('diceLog');
    const playPauseButton = document.getElementById('playPauseButton');
    const playPrevButton = document.getElementById('playPrevButton');
    const playNextButton = document.getElementById('playNextButton');
    const loopModeBtn = document.getElementById('loop-mode-btn');
    const shuffleBtn = document.getElementById('shuffle-btn');
    const clearStackBtn = document.getElementById('clear-stack-btn');
    const saveMusicPresetBtn = document.getElementById('save-music-preset-btn');
    const loadMusicPresetBtn = document.getElementById('load-music-preset-btn');
    const musicStackList = document.getElementById('music-stack-list');
    const previewButton = document.getElementById('previewButton');
    const previewAudioPlayer = document.getElementById('preview-audio-player');
    const addCreatureForm = document.getElementById('add-creature-form');
    const initiativeListDiv = document.getElementById('initiative-list');
    const combatantDetailsListDiv = document.getElementById('combatant-details-list');
    const maxLogEntries = 50;

    // --- Initial Load (Non-blocking) ---
    // Fetch initial data without blocking the UI rendering.
    window.electron.ipcRenderer.invoke('get-dnd-conditions').then(conditions => {
        DND_CONDITIONS = conditions;
    });
    window.electron.ipcRenderer.invoke('get-mob-rules-data').then(rules => {
        MOB_RULES_DATA = rules;
    });

    // Send a signal to the main process that the window is ready for data.
    window.electron.ipcRenderer.send('window-ready');
    // Specifically request the initial load after a short delay to ensure the main process is ready.
    setTimeout(() => {
        window.electron.ipcRenderer.send('request-initial-load');
    }, 100);

    // --- Initial UI Setup ---
    addCreatureForm.innerHTML = `
        <h2>Add Combatant <button id="import-from-file-btn" class="small-btn" title="Import from File" style="font-size: 0.8em; padding: 2px 6px; margin-left: 10px;">⬇️</button></h2>
        <div class="form-row">
            <div class="form-group name-group">
                <label for="creature-name">Combatant:</label>
                <input type="text" id="creature-name" required>
                <span id="imported-monster-info-btn" class="info-btn" style="display: none;" title="Show Stat Block">ℹ️</span>
            </div>
            <div id="mob-controls" class="form-group" style="display: none; align-items: center;">
                <label for="mob-size" style="margin-right: 5px;">Count:</label>
                <input type="number" id="mob-size" min="1" value="5" style="width: 60px;">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label for="creature-initiative">Initiative:</label><input type="text" id="creature-initiative" placeholder="+3 or 15"></div>
            <div class="form-group"><label for="creature-hp">HP:</label><input type="text" id="creature-hp" placeholder="2d8+2"></div>
            <div class="form-group"><label for="creature-ac">AC:</label><input type="number" id="creature-ac" placeholder="15"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label for="creature-speed">Speed:</label><input type="text" id="creature-speed" placeholder="30ft"></div>
            <div class="form-group"><label for="attack-modifier">Atk Mod:</label><input type="text" id="attack-modifier" placeholder="+5"></div>
            <div class="form-group"><label for="save-dc">Save DC:</label><input type="number" id="save-dc" placeholder="13"></div>
        </div>
        <hr>
        <div class="stats-grid">
            <div class="grid-header"></div>
            <div class="grid-header">STR</div>
            <div class="grid-header">DEX</div>
            <div class="grid-header">CON</div>
            <div class="grid-header">INT</div>
            <div class="grid-header">WIS</div>
            <div class="grid-header">CHA</div>

            <div class="grid-label">Score</div>
            <input type="number" id="str-score" placeholder="12">
            <input type="number" id="dex-score" placeholder="12">
            <input type="number" id="con-score" placeholder="12">
            <input type="number" id="int-score" placeholder="12">
            <input type="number" id="wis-score" placeholder="12">
            <input type="number" id="cha-score" placeholder="12">

            <div class="grid-label">Save</div>
            <input type="text" id="str-save" placeholder="+1">
            <input type="text" id="dex-save" placeholder="+1">
            <input type="text" id="con-save" placeholder="+1">
            <input type="text" id="int-save" placeholder="+1">
            <input type="text" id="wis-save" placeholder="+1">
            <input type="text" id="cha-save" placeholder="+1">
        </div>
        <div class="form-actions">
            <button type="button" id="convert-to-mob-btn">Convert to Mob</button>
            <button type="button" id="import-monster-btn">Import Combatant</button>
            <button type="submit" class="add-creature-button">Add Combatant</button>
            <button type="button" id="clear-form-btn">Clear</button>
        </div>
    `;
    // --- Mob Form Logic ---
    const convertToMobBtn = document.getElementById('convert-to-mob-btn');
    const mobControls = document.getElementById('mob-controls');
    const mobSizeInput = document.getElementById('mob-size');
    const creatureHpInput = document.getElementById('creature-hp');

    // This function is no longer needed, as the backend will handle all HP calculations.
    // We keep the logic for converting back to a single creature.
    convertToMobBtn.addEventListener('click', () => {
        isMobMode = !isMobMode;
        if (isMobMode) {
            // When converting TO a mob, we just show the controls.
            // The HP input now holds the dice formula for a single creature.
            singleCreatureHPForMob = creatureHpInput.value || '10';
            mobControls.style.display = 'flex';
            convertToMobBtn.textContent = 'Convert to Single';
            if (!mobSizeInput.value) mobSizeInput.value = 5;
            // We don't change the HP input value anymore. It stays as the formula.
        } else {
            // When converting FROM a mob, restore the single creature HP formula.
            mobControls.style.display = 'none';
            convertToMobBtn.textContent = 'Convert to Mob';
            creatureHpInput.value = singleCreatureHPForMob;
        }
    });

    // We no longer need a listener on the mob size input, as HP is not pre-calculated.


    // --- Logging ---
    function logMessage(message) {
        if (typeof message !== 'string') message = JSON.stringify(message);
        const logEntry = document.createElement('div');
        logEntry.textContent = `> ${message}`;
        if (logArea) {
            logArea.appendChild(logEntry);
            if (logArea.children.length > maxLogEntries) logArea.removeChild(logArea.firstChild);
            logArea.scrollTop = logArea.scrollHeight;
        }
    }

    // --- Panel Switching Logic ---
    function showPanel(panelId, title) {
        const logTitle = document.getElementById('log-title');
        const pushButton = document.getElementById('push-panel-btn');
        let foundPanel = false;

        logPanels.forEach((panel, index) => {
            const panelEl = document.getElementById(panel.id);
            if (panel.id === panelId) {
                panelEl.style.display = 'block';
                logTitle.textContent = title || panel.title;
                currentPanelIndex = index;
                foundPanel = true;
            } else {
                panelEl.style.display = 'none';
            }
        });

        // Show push button only for certain panels
        if (panelId === 'diceLog' || panelId === 'statBlockArea') {
            pushButton.style.display = 'inline-block';
        } else {
            pushButton.style.display = 'none';
        }

        if (!foundPanel) showPanel('logArea', 'Log'); // Fallback
    }

    function displayStatBlock(rawDataString) {
        const statBlockArea = document.getElementById('statBlockArea');
        currentStatBlockData = null; // Reset first
        if (!rawDataString) {
            statBlockArea.innerHTML = '<p>No data available for this creature.</p>';
            showPanel('statBlockArea', 'Stat Block');
            return;
        }
        try {
            const monster = JSON.parse(rawDataString);
            statBlockArea.innerHTML = renderStatBlock(rawDataString);
            showPanel('statBlockArea', monster.name || 'Stat Block'); // Update title and show panel
            currentStatBlockData = { type: 'statblock', data: rawDataString }; // Set the data for the push button
        } catch (e) {
            statBlockArea.innerHTML = '<p>Error: Could not parse creature data.</p>';
            showPanel('statBlockArea', 'Error');
        }
    }

    async function displayMobRules(creatureId) {
        const statBlockArea = document.getElementById('statBlockArea');

        if (!MOB_RULES_DATA) {
            logMessage('[UI] Error: MOB_RULES_DATA is null or undefined.');
            statBlockArea.innerHTML = '<p>Fatal Error: Mob rules data object is not available.</p>';
            showPanel('statBlockArea', 'Error');
            return;
        }

        const { ui, imagePath } = MOB_RULES_DATA;

        if (!ui || !ui.text || !imagePath) {
            logMessage(`[UI] Error: Mob rules data is missing or malformed. UI: ${!!ui}, Text: ${!!ui.text}, Path: ${!!imagePath}`);
            statBlockArea.innerHTML = '<p>Mob rules data is missing or malformed.</p>';
            showPanel('statBlockArea', 'Error');
            return;
        }

        const result = await window.electron.ipcRenderer.invoke('get-image-as-data-url', imagePath);

        if (!result.success) {
            statBlockArea.innerHTML = `<p>Failed to load mob rules image. See log for details.</p>`;
            showPanel('statBlockArea', 'Error');
            return;
        }

        const contentHTML = `
            <style>
                .mob-rules-container h3, .mob-rules-container p, .mob-rules-container ul {
                    margin-top: 0.5em;
                    margin-bottom: 0.5em;
                }
                .mob-rules-container ul {
                    padding-left: 20px;
                }
                #image-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                    cursor: pointer;
                }
                #image-overlay img {
                    max-width: 90%;
                    max-height: 90%;
                    object-fit: contain;
                }
            </style>
            <div class="mob-rules-container">
                ${ui.text}
                <img id="mob-rules-image" src="${result.dataUrl}" alt="Mob Rules Table" style="width: 100%; height: auto; cursor: zoom-in;"/>
            </div>
        `;

        statBlockArea.innerHTML = contentHTML;

        document.getElementById('mob-rules-image').addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.id = 'image-overlay';
            const img = document.createElement('img');
            img.src = result.dataUrl;
            overlay.appendChild(img);
            overlay.addEventListener('click', () => {
                overlay.remove();
            });
            document.body.appendChild(overlay);
        });
        showPanel('statBlockArea', 'Mob Rules');
        const creature = initiativeOrder.find(c => c.id === creatureId);
        const creatureName = creature ? creature.name : 'Unknown Mob';
        currentStatBlockData = { type: 'mob-rules', data: { creatureName, absoluteImagePath: result.absolutePath } };
    }

    // --- Event Listeners ---
    document.addEventListener('click', (event) => {
        const target = event.target;
        const targetId = target.id;

        // Handle info button clicks specifically
        if (target.classList.contains('info-btn')) {
            let rawDataString = null;
            if (target.id === 'imported-monster-info-btn') {
                rawDataString = addCreatureForm.dataset.monsterRawData;
            } else if (target.classList.contains('combatant-info-btn')) {
                const creatureId = parseInt(target.dataset.id, 10);
                const creature = initiativeOrder.find(c => c.id === creatureId);
                if (creature) rawDataString = creature.rawData;
            }

            if (rawDataString) {
                displayStatBlock(rawDataString);
            }
            return; // Done with this click event
        }

        switch (targetId) {
            case 'import-monster-btn':
                createPopup('monster-search', null, event.target);
                break;
            case 'clear-form-btn':
                addCreatureForm.reset();
                document.getElementById('imported-monster-info-btn').style.display = 'none';
                delete addCreatureForm.dataset.monsterRawData;
                // Reset edit/mob state
                delete addCreatureForm.dataset.editingId;
                creatureBeingEdited = null;
                isMobMode = false;
                document.getElementById('mob-controls').style.display = 'none';
                document.getElementById('convert-to-mob-btn').textContent = 'Convert to Mob';
                break;
            case 'log-toggle-btn':
                currentPanelIndex = (currentPanelIndex + 1) % logPanels.length;
                const nextPanel = logPanels[currentPanelIndex];

                // If the next panel is the stat block and it's empty, skip it.
                const statBlockEl = document.getElementById('statBlockArea');
                if (nextPanel.id === 'statBlockArea' && !statBlockEl.innerHTML) {
                    currentPanelIndex = (currentPanelIndex + 1) % logPanels.length;
                }
                showPanel(logPanels[currentPanelIndex].id);
                break;
            case 'push-panel-btn': {
                const activePanelId = logPanels[currentPanelIndex].id;
                if (activePanelId === 'diceLog') {
                    const diceLog = document.getElementById('diceLog');
                    const entries = Array.from(diceLog.children).slice(-12); // Get last 12 entries
                    const logContent = entries.map(entry => entry.textContent).join('\n');
                    if (logContent) {
                        window.electron.ipcRenderer.send('push-dicelog-to-discord', logContent);
                    }
                } else if (activePanelId === 'statBlockArea' && currentStatBlockData) {
                    if (currentStatBlockData.type === 'statblock') {
                        window.electron.ipcRenderer.send('push-statblock-to-discord', currentStatBlockData.data);
                    } else if (currentStatBlockData.type === 'mob-rules') {
                        window.electron.ipcRenderer.send('push-mob-rules-to-discord', currentStatBlockData.data);
                    }
                }
                break;
            }
            case 'reset-encounter-mid':
            case 'reset-encounter-right':
                window.electron.ipcRenderer.send('reset-encounter');
                break;
            case 'clear-encounter-mid':
            case 'clear-encounter-right':
                window.electron.ipcRenderer.send('clear-encounter');
                break;
            case 'save-button':
                window.electron.ipcRenderer.send('save-encounter');
                break;
            case 'load-button':
                window.electron.ipcRenderer.invoke('load-encounter-dialog');
                break;
            case 'settings-button':
                window.electron.ipcRenderer.send('open-settings-window');
                break;
            case 'next-turn-button':
                window.electron.ipcRenderer.send('next-turn');
                break;
            case 'previous-turn-button':
                window.electron.ipcRenderer.send('previous-turn');
                break;
            case 'push-initiative-btn':
                window.electron.ipcRenderer.send('push-initiative');
                break;
            case 'selectFileButton':
                window.electron.ipcRenderer.invoke('open-file-dialog', { multi: true }).then(filePaths => {
                    if (filePaths && filePaths.length > 0) {
                        window.electron.ipcRenderer.send('load-music-file', filePaths);
                    }
                });
                break;
            case 'playPauseButton':
                if (!isBotEnabled) {
                    showBotNag();
                    return;
                }
                previewAudioPlayer.pause();
                if (isPlaying) {
                    window.electron.ipcRenderer.send('pause-music');
                } else {
                    window.electron.ipcRenderer.send('play-music');
                }
                break;
            case 'playPrevButton':
                window.electron.ipcRenderer.send('play-prev');
                break;
            case 'playNextButton':
                window.electron.ipcRenderer.send('play-next');
                break;
            case 'loop-mode-btn': {
                // Cycle loop mode: 0 -> 1 -> 2 -> 0
                // We'll let the backend handle the state but we can optimistically cycle or just wait for update
                // Actually BackendAudioPlayer has loopMode 0, 1, 2.
                // Let's assume we want to send the command to cycle or set specifically.
                // For simplicity, let's just cycle here.
                const nextMode = (currentLoopMode + 1) % 3;
                window.electron.ipcRenderer.send('set-loop-mode', { mode: nextMode });
                break;
            }
            case 'shuffle-btn':
                window.electron.ipcRenderer.send('set-shuffle', { enabled: !currentShuffleMode });
                break;
            case 'clear-stack-btn':
                window.electron.ipcRenderer.send('clear-stack');
                break;
            case 'save-music-preset-btn':
                // We need the current stack from the UI state or ask backend
                // The renderer doesn't have a local 'stack' variable, it relies on status updates.
                // We'll use the latest initiativeOrder as a proxy for 'has data',
                // but actually we need the music stack.
                // Let's store the last received stack.
                if (lastMusicStatus && lastMusicStatus.stack) {
                    window.electron.ipcRenderer.invoke('save-music-preset', lastMusicStatus.stack.map(t => t.path));
                }
                break;
            case 'load-music-preset-btn':
                window.electron.ipcRenderer.invoke('load-music-preset');
                break;
            case 'previewButton':
                if (!previewAudioPlayer.paused) {
                    previewAudioPlayer.pause();
                } else {
                    window.electron.ipcRenderer.invoke('get-preview-audio-data').then(result => {
                        if (result.success) {
                            previewAudioPlayer.src = result.url; // Use the custom protocol URL
                            previewAudioPlayer.play();
                        } else {
                            logMessage(`Preview Error: ${result.error}`);
                        }
                    });
                }
                break;
        }
    });

    // --- Soundboard Listeners (placeholders for now) ---
    // --- Soundboard Listeners ---
    const soundboardVolumeSlider = document.getElementById('soundboard-volume');

    soundboardVolumeSlider.addEventListener('input', (e) => {
        const sliderValue = parseFloat(e.target.value);
        // Scale: 0-1 slider maps to 0-1.5 actual volume (150%)
        const effectiveVolume = sliderValue * 1.5;

        // Update backend
        window.electron.ipcRenderer.send('set-soundboard-volume', { volume: effectiveVolume });

        // Save state (debounced ideally, but on input for now is fine for local app)
        saveSoundboardState();
    });

    addCreatureForm.addEventListener('submit', (event) => {
        event.preventDefault();
        try {
            const getVal = (id) => document.getElementById(id).value;
            const getInt = (id) => getVal(id) ? parseInt(getVal(id), 10) : null;

            // Use dataset ID as primary source of truth, fallback to global variable if needed
            const editingId = addCreatureForm.dataset.editingId ? parseInt(addCreatureForm.dataset.editingId, 10) : null;
            const isEditing = !!editingId || !!creatureBeingEdited;

            // console.log('[Form Submit] Editing ID:', editingId, 'Is Editing:', isEditing);

            let creature;

            if (isEditing) {
                // alert(`[DEBUG] Entering Edit Mode Logic`);
                // If we have an ID but lost the object (due to reload/race condition),
                // we reconstruct a partial object with the ID. 
                // Ideally we have the full object in creatureBeingEdited.
                if (creatureBeingEdited && creatureBeingEdited.id === editingId) {
                    creature = { ...creatureBeingEdited };
                } else if (editingId) {
                    // Fallback: create object with just ID so backend can find it
                    creature = { id: editingId };
                    // We might miss some hidden fields here (like reminders), 
                    // but backend merge logic usually replaces the whole object.
                    // IMPORTANT: To avoid data loss, we should try to fetch it from the initiativeOrder if possible,
                    // but renderer doesn't have direct access.
                    // However, since we populate from initiativeOrder, we can find it in the local global var.
                    const existing = initiativeOrder.find(c => c.id === editingId);
                    if (existing) {
                        creature = { ...existing };
                    } else if (creatureBeingEdited) {
                        creature = { ...creatureBeingEdited };
                    }
                } else {
                    creature = { ...creatureBeingEdited };
                }

                // Overwrite properties from the form
                creature.name = getVal('creature-name');
                creature.ac = getInt('creature-ac');
                creature.speed = getVal('creature-speed');
                creature.attackMod = getVal('attack-modifier');
                creature.saveDc = getInt('save-dc');
                creature.scores = { str: getInt('str-score'), dex: getInt('dex-score'), con: getInt('con-score'), int: getInt('int-score'), wis: getInt('wis-score'), cha: getInt('cha-score'), };
                creature.saves = { str: getVal('str-save'), dex: getVal('dex-save'), con: getVal('con-save'), int: getVal('int-save'), wis: getVal('wis-save'), cha: getVal('cha-save'), };
                creature.isMob = isMobMode;
                creature.hp = getInt('creature-hp'); // Always take current HP from form for edits
                creature.hidden = false; // Ensure creature is visible after update

                // Parse initiative as a number for updates (it's already been rolled)
                const initVal = getVal('creature-initiative');
                creature.initiative = parseFloat(initVal) || creature.initiative;

                if (isMobMode) {
                    const newMobSize = getInt('mob-size');
                    // Preserve the original hpFormula if converting, otherwise it's already there.
                    if (creatureBeingEdited && !creatureBeingEdited.isMob) {
                        creature.hpFormula = singleCreatureHPForMob;
                    }
                    creature.singleCreatureHP = calculatedSingleCreatureHP;
                    creature.maxHp = newMobSize * calculatedSingleCreatureHP;
                    creature.mobInitialCount = (creatureBeingEdited && creatureBeingEdited.isMob) ? creatureBeingEdited.mobInitialCount : newMobSize;
                } else {
                    // If converting from a mob, the hpFormula is still correct on the object.
                    creature.hpFormula = singleCreatureHPForMob;
                    creature.maxHp = (creatureBeingEdited && creatureBeingEdited.isMob) ? calculatedSingleCreatureHP : (creature.maxHp || getInt('creature-hp'));
                    delete creature.mobInitialCount;
                    delete creature.singleCreatureHP;
                }

                // console.log('[Form Submit] Sending update-creature', creature);
                window.electron.ipcRenderer.send('update-creature', creature);

            } else { // This is a new creature
                creature = {
                    id: Date.now(),
                    name: getVal('creature-name'),
                    initiative: getVal('creature-initiative'),
                    hp: getVal('creature-hp') || '10', // Keep as string for dice notation in backend
                    ac: getInt('creature-ac'),
                    speed: getVal('creature-speed'),
                    attackMod: getVal('attack-modifier'),
                    saveDc: getInt('save-dc'),
                    scores: { str: getInt('str-score'), dex: getInt('dex-score'), con: getInt('con-score'), int: getInt('int-score'), wis: getInt('wis-score'), cha: getInt('cha-score'), },
                    saves: { str: getVal('str-save'), dex: getVal('dex-save'), con: getVal('con-save'), int: getVal('int-save'), wis: getVal('wis-save'), cha: getVal('cha-save'), },
                    tempHp: 0, conditions: [], isConcentrating: false, isFriendly: false, reminders: { start: '', end: '' },
                    isMob: isMobMode,
                };

                if (isMobMode) {
                    // The 'hp' field now contains the dice formula for a single creature.
                    // The backend will handle the calculation.
                    creature.hp = getVal('creature-hp') || '10'; // Send the formula string
                    creature.mobInitialCount = getInt('mob-size');
                    // No need to set maxHp, singleCreatureHP, or hpFormula here.
                    // The backend will derive everything from the .hp formula and mobInitialCount.
                }

                if (addCreatureForm.dataset.monsterRawData) {
                    creature.rawData = addCreatureForm.dataset.monsterRawData;
                }

                // console.log('[Form Submit] Sending add-creature', creature);
                window.electron.ipcRenderer.send('add-creature', creature);
            }

            // --- Reset Form ---
            addCreatureForm.reset();
            document.getElementById('imported-monster-info-btn').style.display = 'none';
            delete addCreatureForm.dataset.monsterRawData;
            delete addCreatureForm.dataset.editingId;
            creatureBeingEdited = null;
            isMobMode = false;
            document.getElementById('mob-controls').style.display = 'none';
            document.getElementById('convert-to-mob-btn').textContent = 'Convert to Mob';
            document.getElementById('creature-name').focus();
        } catch (err) {
            console.error('[Form Submit Error]', err);
            alert('Error submitting form: ' + err.message);
        }
    });

    // --- IPC Listeners ---
    window.electron.ipcRenderer.on('log-message', (event, message) => logMessage(message));

    window.electron.ipcRenderer.on('dice-log', (event, message) => {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        diceLog.appendChild(logEntry);
        if (diceLog.children.length > maxLogEntries) diceLog.removeChild(diceLog.firstChild);
        diceLog.scrollTop = diceLog.scrollHeight;
        showPanel('diceLog');
    });

    const showBotNag = () => {
        let message = "The Discord bot is currently disabled. You need to enable and configure it in settings to use audio features on Discord. Open settings now?";

        if (botStatus.message === 'Not Configured') {
            message = "The Discord bot is enabled but not fully configured. Would you like to open settings to finish setup?";
        }

        if (confirm(message)) {
            window.electron.ipcRenderer.send('open-settings-window');
        }
    };

    window.electron.ipcRenderer.on('discord-bot-status', (event, status) => {
        botStatus = status;
        isBotEnabled = status.status !== 'offline';
    });

    window.electron.ipcRenderer.on('switch-panel', (event, panelId) => {
        showPanel(panelId);
    });

    let currentLoopMode = 1;
    let currentShuffleMode = false;
    let lastMusicStatus = null;

    window.electron.ipcRenderer.on('music-player-status', (event, status) => {
        lastMusicStatus = status;
        isPlaying = status.isPlaying;
        currentLoopMode = status.loopMode;
        currentShuffleMode = status.shuffleMode;

        playPauseButton.textContent = isPlaying ? '⏸️' : '▶️';
        playPauseButton.disabled = status.stack.length === 0;
        previewButton.disabled = status.currentIndex < 0;

        // Update Loop Button
        const loopEmojis = ['➡️', '🔁', '1️⃣'];
        loopModeBtn.textContent = loopEmojis[currentLoopMode];

        // Update Shuffle Button
        shuffleBtn.classList.toggle('active', currentShuffleMode);

        // Render Stack
        musicStackList.innerHTML = '';
        status.stack.forEach((track, index) => {
            const div = document.createElement('div');
            div.className = 'music-stack-item' + (index === status.currentIndex ? ' active' : '');
            if (status.isCaching && index === status.currentIndex) div.classList.add('caching');

            div.innerHTML = `
                <span class="track-name">${track.name}</span>
                <button class="small-btn remove-track-btn" data-index="${index}">❌</button>
            `;
            div.querySelector('.remove-track-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                window.electron.ipcRenderer.send('remove-from-stack', { index });
            });
            div.addEventListener('click', () => {
                // Logic to jump to this track could be added
            });
            musicStackList.appendChild(div);
        });
    });

    window.electron.ipcRenderer.on('update-initiative-list', (event, data) => {
        initiativeOrder = data.initiativeOrder;
        currentTurnIndex = data.currentTurnIndex;
        combatantPanelOrder = [...initiativeOrder];
        renderInitiativeList(initiativeOrder, currentTurnIndex);
        renderCombatantDetailsList(combatantPanelOrder, currentTurnIndex);
    });

    window.electron.ipcRenderer.on('soundboard-state-change', (event, { slotId, isPlaying, file, emoji }) => {
        const slot = soundboardState[slotId];
        if (slot) {
            slot.isPlaying = isPlaying;
            if (file !== undefined) slot.file = file;
            if (emoji !== undefined) slot.emoji = emoji;
            renderSoundboard();
        }
    });

    window.electron.ipcRenderer.on('populate-edit-form', (event, creature) => {
        if (!creature) return;

        // --- Store the creature for submission ---
        creatureBeingEdited = creature;
        addCreatureForm.dataset.editingId = creature.id; // Store ID in dataset for robust state tracking

        // --- Populate basic fields ---
        document.getElementById('creature-name').value = creature.name || '';
        document.getElementById('creature-initiative').value = creature.initiative || '';
        // When editing, show the CURRENT HP so the user can edit the value directly.
        // We do store the formula separately if needed, but the user requested editing current values.
        document.getElementById('creature-hp').value = creature.hp || '';
        document.getElementById('creature-ac').value = creature.ac || '';
        document.getElementById('creature-speed').value = creature.speed || '';
        document.getElementById('attack-modifier').value = creature.attackMod || '';
        document.getElementById('save-dc').value = creature.saveDc || '';

        // --- Populate stats ---
        const scores = creature.scores || {};
        document.getElementById('str-score').value = scores.str || '';
        document.getElementById('dex-score').value = scores.dex || '';
        document.getElementById('con-score').value = scores.con || '';
        document.getElementById('int-score').value = scores.int || '';
        document.getElementById('wis-score').value = scores.wis || '';
        document.getElementById('cha-score').value = scores.cha || '';
        const saves = creature.saves || {};
        document.getElementById('str-save').value = saves.str || '';
        document.getElementById('dex-save').value = saves.dex || '';
        document.getElementById('con-save').value = saves.con || '';
        document.getElementById('int-save').value = saves.int || '';
        document.getElementById('wis-save').value = saves.wis || '';
        document.getElementById('cha-save').value = saves.cha || '';

        // --- Handle Mob State ---
        isMobMode = creature.isMob || false;
        const mobControls = document.getElementById('mob-controls');
        const convertToMobBtn = document.getElementById('convert-to-mob-btn');
        if (isMobMode) {
            const mobSize = Math.ceil(creature.hp / creature.singleCreatureHP) || 1;
            document.getElementById('mob-size').value = mobSize;
            // Always store the base formula for potential conversion back to single
            singleCreatureHPForMob = creature.hpFormula || creature.singleCreatureHP;
            calculatedSingleCreatureHP = creature.singleCreatureHP; // Store the already calculated value
            mobControls.style.display = 'flex';
            convertToMobBtn.textContent = 'Convert to Single';
        } else {
            mobControls.style.display = 'none';
            convertToMobBtn.textContent = 'Convert to Mob';
            // Store the formula (or maxHP if no formula) for potential conversion
            singleCreatureHPForMob = creature.hpFormula || creature.maxHp;
        }

        // --- Handle imported monster data ---
        if (creature.rawData) {
            addCreatureForm.dataset.monsterRawData = creature.rawData;
            document.getElementById('imported-monster-info-btn').style.display = 'inline-block';
        } else {
            delete addCreatureForm.dataset.monsterRawData;
            document.getElementById('imported-monster-info-btn').style.display = 'none';
        }
    });

    window.electron.ipcRenderer.on('populate-add-form', (event, creature) => {
        if (!creature) return;

        // This is for "Copying" a creature. It populates the form but doesn't
        // put the form into "edit mode".
        creatureBeingEdited = null; // Ensure we are not in edit mode
        delete addCreatureForm.dataset.editingId;

        // Populate basic fields
        document.getElementById('creature-name').value = creature.name || '';
        document.getElementById('creature-initiative').value = creature.initiativeFormula || creature.initiative || '';
        document.getElementById('creature-hp').value = creature.hpFormula || creature.hp || '';
        document.getElementById('creature-ac').value = creature.ac || '';
        document.getElementById('creature-speed').value = creature.speed || '';
        document.getElementById('attack-modifier').value = creature.attackMod || '';
        document.getElementById('save-dc').value = creature.saveDc || '';

        // Populate stats
        const scores = creature.scores || {};
        document.getElementById('str-score').value = scores.str || '';
        document.getElementById('dex-score').value = scores.dex || '';
        document.getElementById('con-score').value = scores.con || '';
        document.getElementById('int-score').value = scores.int || '';
        document.getElementById('wis-score').value = scores.wis || '';
        document.getElementById('cha-score').value = scores.cha || '';
        const saves = creature.saves || {};
        document.getElementById('str-save').value = saves.str || '';
        document.getElementById('dex-save').value = saves.dex || '';
        document.getElementById('con-save').value = saves.con || '';
        document.getElementById('int-save').value = saves.int || '';
        document.getElementById('wis-save').value = saves.wis || '';
        document.getElementById('cha-save').value = saves.cha || '';

        // Handle Mob State
        isMobMode = creature.isMob || false;
        const mobControls = document.getElementById('mob-controls');
        const convertToMobBtn = document.getElementById('convert-to-mob-btn');
        if (isMobMode) {
            // When copying a mob, we need to know the count. We can derive it.
            const mobSize = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 1;
            document.getElementById('mob-size').value = mobSize;
            singleCreatureHPForMob = creature.hpFormula || creature.singleCreatureHP;
            mobControls.style.display = 'flex';
            convertToMobBtn.textContent = 'Convert to Single';
        } else {
            mobControls.style.display = 'none';
            convertToMobBtn.textContent = 'Convert to Mob';
            singleCreatureHPForMob = creature.hpFormula || creature.maxHp;
        }

        // Handle imported monster data
        if (creature.rawData) {
            addCreatureForm.dataset.monsterRawData = creature.rawData;
            document.getElementById('imported-monster-info-btn').style.display = 'inline-block';
        } else {
            delete addCreatureForm.dataset.monsterRawData;
            document.getElementById('imported-monster-info-btn').style.display = 'none';
        }

        // Scroll to the top and focus the name field for a better user experience
        window.scrollTo(0, 0);
        document.getElementById('creature-name').focus();
    });

    function populateMonsterForm(monster) {
        if (!monster) return;

        document.getElementById('imported-monster-info-btn').style.display = 'inline-block';
        document.getElementById('creature-name').value = monster.name || '';
        document.getElementById('creature-hp').value = monster.hp.formula || monster.hp.average || '';

        if (monster.ac && monster.ac[0]) {
            document.getElementById('creature-ac').value = monster.ac[0].ac || monster.ac[0];
        } else {
            document.getElementById('creature-ac').value = '';
        }

        let highestSpeed = 0;
        if (monster.speed) {
            if (typeof monster.speed === 'number') {
                highestSpeed = monster.speed;
            } else if (typeof monster.speed === 'object') {
                const speeds = Object.values(monster.speed).filter(s => typeof s === 'number');
                if (speeds.length > 0) {
                    highestSpeed = Math.max(...speeds);
                }
            }
        }
        document.getElementById('creature-speed').value = highestSpeed > 0 ? `${highestSpeed}ft` : '30ft';

        const calculateModifier = (score) => Math.floor(((score || 10) - 10) / 2);

        const dexMod = calculateModifier(monster.dex);
        document.getElementById('creature-initiative').value = formatModifier(dexMod);

        // --- Auto-parsing for Atk Mod and Save DC ---
        const rawDataString = JSON.stringify(monster);

        const findMode = (arr) => {
            if (!arr.length) return null;
            const counts = arr.reduce((acc, val) => {
                acc[val] = (acc[val] || 0) + 1;
                return acc;
            }, {});
            const maxCount = Math.max(...Object.values(counts));
            const modes = Object.keys(counts).filter(key => counts[key] === maxCount);
            return Math.max(...modes.map(m => parseInt(m, 10))); // Return highest in case of a tie
        };

        const atkMatches = [...rawDataString.matchAll(/{@atkr[^}]*?}\s*\(([\+\-]?\d+)\)|{@hit ([\+\-]?\d+)}/g)];
        const allAtkBonuses = atkMatches.map(match => parseInt(match[1] || match[2], 10));
        const atkBonus = findMode(allAtkBonuses);
        if (atkBonus !== null) {
            document.getElementById('attack-modifier').value = formatModifier(atkBonus);
        } else {
            document.getElementById('attack-modifier').value = '';
        }

        const dcMatches = [...rawDataString.matchAll(/{@dc\s+(\d+)}/g)];
        const allDcs = dcMatches.map(match => parseInt(match[1], 10));
        const saveDc = findMode(allDcs);
        if (saveDc !== null) {
            document.getElementById('save-dc').value = saveDc;
        } else {
            document.getElementById('save-dc').value = '';
        }

        document.getElementById('str-score').value = monster.str || 10;
        document.getElementById('dex-score').value = monster.dex || 10;
        document.getElementById('con-score').value = monster.con || 10;
        document.getElementById('int-score').value = monster.int || 10;
        document.getElementById('wis-score').value = monster.wis || 10;
        document.getElementById('cha-score').value = monster.cha || 10;

        const saves = monster.save || {};
        document.getElementById('str-save').value = saves.str || formatModifier(calculateModifier(monster.str));
        document.getElementById('dex-save').value = saves.dex || formatModifier(calculateModifier(monster.dex));
        document.getElementById('con-save').value = saves.con || formatModifier(calculateModifier(monster.con));
        document.getElementById('int-save').value = saves.int || formatModifier(calculateModifier(monster.int));
        document.getElementById('wis-save').value = saves.wis || formatModifier(calculateModifier(monster.wis));
        document.getElementById('cha-save').value = saves.cha || formatModifier(calculateModifier(monster.cha));

        const fullStatBlock = JSON.stringify(monster);
        addCreatureForm.dataset.monsterRawData = fullStatBlock;
    }

    // --- Soundboard State ---

    function migrateSoundboardState(savedState) {
        if (!savedState || !Array.isArray(savedState)) return [];
        return savedState.map((slot, index) => {
            if (!slot.tracks) {
                // Old format detected
                const tracks = slot.file ? [{ path: slot.file, name: slot.name }] : [];
                return {
                    id: index,
                    tracks: tracks,
                    currentTrackIndex: 0,
                    emoji: slot.emoji || '🎨',
                    loop: 'none',
                    playMode: 'sequential',
                    isPlaying: false
                };
            }
            // Reset transient flags
            return { ...slot, isPlaying: false };
        });
    }

    let soundboardState = [];
    const SOUNDBOARD_SIZE = 3;

    // Load state from backend

    // Load state from backend
    window.electron.ipcRenderer.invoke('get-soundboard-state').then(savedState => {
        let slotsToLoad = [];
        let volumeToLoad = 0.5; // Default slider value (which is ~0.75 effective volume)

        if (savedState) {
            if (Array.isArray(savedState)) {
                // Legacy format: just an array of slots
                slotsToLoad = savedState;
            } else if (typeof savedState === 'object') {
                // New format: { volume, slots }
                if (savedState.slots) slotsToLoad = savedState.slots;
                if (savedState.volume !== undefined) volumeToLoad = savedState.volume;
            }
        }

        // Apply Logic
        if (slotsToLoad && slotsToLoad.length === SOUNDBOARD_SIZE) {
            soundboardState = migrateSoundboardState(slotsToLoad);
        } else {
            // Initialize defaults
            soundboardState = [];
            for (let i = 0; i < SOUNDBOARD_SIZE; i++) {
                soundboardState.push({
                    id: i,
                    tracks: [],
                    currentTrackIndex: 0,
                    emoji: '🎨',
                    loop: 'none',
                    playMode: 'sequential',
                    isPlaying: false
                });
            }
        }

        // Set Volume UI and Backend
        const soundboardVolumeSlider = document.getElementById('soundboard-volume');
        if (soundboardVolumeSlider) {
            soundboardVolumeSlider.value = volumeToLoad;
            // Trigger 1.5x scaling logic immediately
            const effectiveVolume = volumeToLoad * 1.5;
            window.electron.ipcRenderer.send('set-soundboard-volume', { volume: effectiveVolume });
        }

        // Force a render
        renderSoundboard();
    });

    let saveSoundboardStateTimeout;
    function saveSoundboardState() {
        const volume = parseFloat(document.getElementById('soundboard-volume').value);
        const stateToSave = {
            volume: volume,
            slots: soundboardState.map(slot => ({
                ...slot,
                isPlaying: false // Don't save playing state
            }))
        };

        clearTimeout(saveSoundboardStateTimeout);
        saveSoundboardStateTimeout = setTimeout(() => {
            window.electron.ipcRenderer.send('save-soundboard-state', stateToSave);
        }, 1000);
    }



    // --- Preset Buttons ---
    const savePresetBtn = document.getElementById('save-preset-btn');
    const loadPresetBtn = document.getElementById('load-preset-btn');

    if (savePresetBtn) {
        savePresetBtn.addEventListener('click', () => {
            window.electron.ipcRenderer.invoke('save-soundboard-preset', soundboardState).then(result => {
                if (result.success) {
                    console.log('Saved preset to', result.filePath);
                }
            });
        });
    }

    if (loadPresetBtn) {
        loadPresetBtn.addEventListener('click', () => {
            window.electron.ipcRenderer.invoke('load-soundboard-preset').then(result => {
                if (result.success && result.state) {
                    soundboardState = migrateSoundboardState(result.state);
                    saveSoundboardState();
                    renderSoundboard();
                }
            });
        });
    }

    // --- Emoji Picker Logic ---
    const emojiDialog = document.getElementById('emoji-picker-dialog');
    const emojiInput = document.getElementById('emoji-input');
    let currentEditingSlotId = null;

    if (emojiDialog) {
        emojiDialog.addEventListener('close', () => {
            if (emojiDialog.returnValue === 'default') {
                const newEmoji = emojiInput.value;
                if (currentEditingSlotId !== null && soundboardState[currentEditingSlotId]) {
                    soundboardState[currentEditingSlotId].emoji = newEmoji || '🎨';
                    saveSoundboardState();
                    renderSoundboard();
                }
            }
            currentEditingSlotId = null;
        });
    }

    function openEmojiPicker(slotId) {
        if (emojiDialog && soundboardState[slotId]) {
            currentEditingSlotId = slotId;
            emojiInput.value = soundboardState[slotId].emoji;
            emojiDialog.showModal();
        }
    }

    function saveSoundboardState() {
        window.electron.ipcRenderer.send('save-soundboard-state', soundboardState);
    }

    // --- Global Event Delegation for Combatant Details ---
    combatantDetailsListDiv.addEventListener('click', (e) => {
        const target = e.target;
        const creatureId = parseInt(target.dataset.id, 10);
        if (isNaN(creatureId)) return;

        const creature = initiativeOrder.find(c => c.id === creatureId);

        if (target.classList.contains('attack-btn')) {
            if (creature) {
                if (creature.isMob) {
                    displayMobRules(creatureId);
                } else {
                    createPopup('attack-roll', creatureId, target);
                }
            }
        } else if (target.classList.contains('stat-roll-btn')) {
            const { type, stat } = target.dataset;
            createPopup('stat-roll', creatureId, target, { type, stat });
        } else if (target.classList.contains('hp-change-btn')) {
            createPopup('hp', creatureId, target);
        } else if (target.classList.contains('add-condition-btn')) {
            createPopup('condition', creatureId, target);
        } else if (target.classList.contains('temp-hp-btn')) {
            createPopup('temp-hp', creatureId, target);
        } else if (target.classList.contains('remove-condition-btn')) {
            const { condition } = target.dataset;
            window.electron.ipcRenderer.send('remove-condition', { creatureId, condition });
            // Hide tooltip immediately when condition is removed
            if (globalTooltip) {
                globalTooltip.style.visibility = 'hidden';
                globalTooltip.style.opacity = '0';
            }
        } else if (target.classList.contains('reminders-btn')) {
            createPopup('reminders', creatureId, target);
        } else if (target.classList.contains('copy-btn')) {
            window.electron.ipcRenderer.send('copy-creature', { creatureId });
        } else if (target.classList.contains('edit-btn')) {
            window.electron.ipcRenderer.send('edit-creature', { creatureId });
        } else if (target.classList.contains('remove-btn')) {
            window.electron.ipcRenderer.send('remove-creature', { creatureId });
        } else if (target.classList.contains('move-to-bottom-btn')) {
            const creatureIndex = combatantPanelOrder.findIndex(c => c.id === creatureId);
            if (creatureIndex > -1) {
                const [creature] = combatantPanelOrder.splice(creatureIndex, 1);
                combatantPanelOrder.push(creature);
                renderCombatantDetailsList(combatantPanelOrder, currentTurnIndex);
            }
        }
    });

    combatantDetailsListDiv.addEventListener('change', (e) => {
        const target = e.target;
        const creatureId = parseInt(target.dataset.id, 10);
        if (isNaN(creatureId)) return;

        if (target.classList.contains('concentration-cb')) {
            window.electron.ipcRenderer.send('update-creature-flag', { creatureId, flag: 'isConcentrating', value: e.target.checked });
        } else if (target.classList.contains('friendly-cb')) {
            window.electron.ipcRenderer.send('update-creature-flag', { creatureId, flag: 'isFriendly', value: e.target.checked });
        }
    });

    // --- Render Functions ---
    function renderSoundboard() {
        const grid = document.getElementById('soundboard-grid');
        grid.innerHTML = '';

        soundboardState.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'soundboard-stack-slot';

            const trackCount = slot.tracks.length;

            // --- Icon Logic ---
            const loopIcon = '🔁';
            const loopClass = slot.loop === 'stack' ? 'active' : '';
            const shuffleIcon = '🔀';
            const shuffleClass = slot.playMode === 'shuffle' ? 'active' : '';
            const playIcon = slot.isPlaying ? '⏹️' : '⏯️';

            let addOrCountIcon;
            if (trackCount === 0) {
                addOrCountIcon = '➕';
            } else if (trackCount > 9) {
                addOrCountIcon = '♾️';
            } else {
                addOrCountIcon = trackCount.toString();
            }


            slotDiv.innerHTML = `
                <div class="stack-header">
                    <button class="stack-emoji-btn" data-id="${slot.id}" title="Edit Emoji">${slot.emoji}</button>
                    <button class="stack-btn stack-add-btn" data-id="${slot.id}" title="Add Sound">${addOrCountIcon}</button>
                    <button class="stack-btn stack-clear-btn" data-id="${slot.id}" title="Clear Stack">🗑️</button>
                </div>
                <div class="stack-controls">
                    <button class="stack-btn stack-play-btn" data-id="${slot.id}" title="Play/Pause" ${trackCount === 0 ? 'disabled' : ''}>${playIcon}</button>
                    <button class="stack-btn stack-loop-btn ${loopClass}" data-id="${slot.id}" title="Toggle Loop (Stack)">${loopIcon}</button>
                    <button class="stack-btn stack-shuffle-btn ${shuffleClass}" data-id="${slot.id}" title="Toggle Shuffle">${shuffleIcon}</button>
                </div>
            `;
            grid.appendChild(slotDiv);
        });

        attachSoundboardListeners();
    }

    function attachSoundboardListeners() {
        // Emoji
        document.querySelectorAll('.stack-emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                openEmojiPicker(slotId);
            });
        });

        // Play/Pause
        document.querySelectorAll('.stack-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                togglePlay(slotId);
            });
        });

        // Loop Toggle
        document.querySelectorAll('.stack-loop-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                const slot = soundboardState[slotId];
                slot.loop = slot.loop === 'none' ? 'stack' : 'none';
                saveSoundboardState();
                renderSoundboard();
            });
        });

        // Shuffle Toggle
        document.querySelectorAll('.stack-shuffle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                const slot = soundboardState[slotId];
                slot.playMode = slot.playMode === 'sequential' ? 'shuffle' : 'sequential';
                saveSoundboardState();
                renderSoundboard();
            });
        });

        // Add Sound
        document.querySelectorAll('.stack-add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                window.electron.ipcRenderer.invoke('load-sound', { slotId, multi: true }).then(tracks => {
                    if (tracks && tracks.length > 0) {
                        soundboardState[slotId].tracks.push(...tracks);
                        saveSoundboardState();
                        renderSoundboard();
                    }
                });
            });
        });

        // Clear Stack
        document.querySelectorAll('.stack-clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                window.electron.ipcRenderer.send('stop-sound', { slotId });
                soundboardState[slotId].tracks = [];
                soundboardState[slotId].currentTrackIndex = 0;
                soundboardState[slotId].isPlaying = false;
                saveSoundboardState();
                renderSoundboard();
            });
        });
    }

    function togglePlay(slotId) {
        if (!isBotEnabled) {
            showBotNag();
            return;
        }
        const slot = soundboardState[slotId];
        if (slot.tracks.length === 0) return;

        if (slot.isPlaying) {
            // Stop
            window.electron.ipcRenderer.send('stop-sound', { slotId });
            slot.isPlaying = false;
            // Manual stop does NOT advance track (usually).
        } else {
            // Play
            const track = slot.tracks[slot.currentTrackIndex];
            window.electron.ipcRenderer.send('play-sound', { slotId, filePath: track.path });
            slot.isPlaying = true;
        }
        renderSoundboard();
    }

    // Handle Sound Finished (Auto-Advance)
    window.electron.ipcRenderer.on('sound-finished', (event, finishedSlotId) => {
        // Warning: slotId from backend might be string or number? Main usually sends what play-sound got.
        // It was passed as integer in play-sound logic usually. 
        const slotId = parseInt(finishedSlotId, 10);
        const slot = soundboardState[slotId];
        if (!slot) return;

        // Logic:
        // 1. Mark current not playing
        slot.isPlaying = false;

        // 2. Advance Index
        if (slot.playMode === 'shuffle') {
            slot.currentTrackIndex = Math.floor(Math.random() * slot.tracks.length);
        } else {
            slot.currentTrackIndex = (slot.currentTrackIndex + 1) % slot.tracks.length;
        }

        // 3. Check Loop Mode
        if (slot.loop === 'stack') {
            // Auto-play next
            const nextTrack = slot.tracks[slot.currentTrackIndex];
            window.electron.ipcRenderer.send('play-sound', { slotId, filePath: nextTrack.path });
            slot.isPlaying = true;
        } else {
            // Stop (but we already advanced the index for next manual press)
            // Just update UI
        }
        renderSoundboard();
    });

    function renderInitiativeList(initiativeOrder, currentTurnIndex) {
        initiativeListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        const fragment = document.createDocumentFragment();

        initiativeOrder.forEach((creature, index) => {
            if (creature.hidden) return; // Skip hidden creatures (e.g. being edited)

            const isActive = index === currentTurnIndex;
            const creatureDiv = document.createElement('div');
            creatureDiv.className = 'initiative-entry' + (isActive ? ' active-turn' : '');
            creatureDiv.dataset.id = creature.id;

            const hp = creature.hp || 0;
            const maxHp = creature.maxHp || 1;
            const tempHp = creature.tempHp || 0;
            const hpPercentage = Math.min(100, (hp / maxHp) * 100);
            const tempHpPercentage = (tempHp / maxHp) * 100;
            const hpColor = getHpColor(hp, maxHp);

            const hpBarHTML = `
                <div class="initiative-hp-bar-container">
                    <div class="hp-bar-temp" style="width: ${tempHpPercentage}%;"></div>
                    <div class="hp-bar-current" style="width: ${hpPercentage}%; background-color: ${hpColor};"></div>
                </div>
            `;

            let conditionHTML = '';
            const allConditionNames = creature.conditions || [];

            // Render up to 3, plus an indicator if more
            const visibleConditions = allConditionNames.slice(0, 3);

            visibleConditions.forEach(name => {
                const cond = DND_CONDITIONS[name];
                if (cond) {
                    conditionHTML += `
                    <span class="has-tooltip" data-tooltip="${name}: ${cond.text}">
                        ${cond.emoji}
                    </span>`;
                }
            });

            if (allConditionNames.length > 3) {
                const tooltipText = allConditionNames.slice(3).map(name => {
                    const c = DND_CONDITIONS[name];
                    return c ? `${name}: ${c.text}` : name;
                }).join('\n\n');
                conditionHTML += `
                 <span class="has-tooltip" data-tooltip="${tooltipText}">
                    ♾️
                 </span>`;
            }
            let conditionStr = conditionHTML;

            let displayName = creature.name;
            if (creature.isMob) {
                const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                displayName = `${creature.name} (${currentCount})`;
            }

            let content = '';
            if (isActive) {
                content += '<span class="active-chevron">></span>';
            }
            content += `<span class="initiative-score" data-id="${creature.id}">${creature.initiative}</span>`;
            content += `<span class="creature-name">${displayName}</span>`;
            content += `<span class="initiative-conditions">${conditionStr}</span>`;
            content += hpBarHTML;

            creatureDiv.innerHTML = content;

            creatureDiv.querySelector('.initiative-score').addEventListener('click', (e) => {
                e.stopPropagation();
                createPopup('edit-initiative', creature.id, e.target);
            });

            creatureDiv.addEventListener('click', () => {
                const targetPanel = document.querySelector(`.combatant-details-entry[data-id='${creature.id}']`);
                if (targetPanel) {
                    targetPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });

            fragment.appendChild(creatureDiv);
        });
        initiativeListDiv.appendChild(fragment);
    }

    function getHpColor(current, max) {
        if (current <= 0) return '#6c757d'; // Grey (dead/0 HP)
        if (current > max) return '#8a2be2'; // Purple (overhealed/temp HP)

        const percentage = (current / max) * 100;
        if (percentage >= 100) return '#007bff'; // Blue (full HP)
        if (percentage >= 50) return '#28a745'; // Green (50-99%)
        if (percentage >= 25) return '#ffc107'; // Yellow (25-49%)
        return '#dc3545'; // Red (<25%)
    }

    function renderCombatantDetailsList(orderToRender, currentTurnIndex) {
        combatantDetailsListDiv.innerHTML = '';
        if (!orderToRender || orderToRender.length === 0) return;

        const fragment = document.createDocumentFragment();
        const activeCreatureId = initiativeOrder.length > 0 ? initiativeOrder[currentTurnIndex]?.id : null;

        orderToRender.forEach((creature) => {
            if (creature.hidden) return; // Skip hidden creatures (e.g. being edited)

            const creatureDiv = document.createElement('div');
            const isActive = activeCreatureId === creature.id;
            creatureDiv.className = 'combatant-details-entry' + (isActive ? ' active-turn' : '');
            creatureDiv.dataset.id = creature.id;

            const saves = creature.saves || {};
            const scores = creature.scores || {};
            const savesHTML = `
                <div class="saves-grid">
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="str">STR: ${saves.str || '+0'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="dex">DEX: ${saves.dex || '+0'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="con">CON: ${saves.con || '+0'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="int">INT: ${saves.int || '+0'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="wis">WIS: ${saves.wis || '+0'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="save" data-stat="cha">CHA: ${saves.cha || '+0'}</button>
                </div>
            `;
            const scoresHTML = `
                <div class="scores-grid">
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="str">STR: ${scores.str || '10'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="dex">DEX: ${scores.dex || '10'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="con">CON: ${scores.con || '10'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="int">INT: ${scores.int || '10'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="wis">WIS: ${scores.wis || '10'}</button>
                    <button class="stat-roll-btn" data-id="${creature.id}" data-type="check" data-stat="cha">CHA: ${scores.cha || '10'}</button>
                </div>
            `;

            const hp = creature.hp || 0;
            const maxHp = creature.maxHp || 1;
            const tempHp = creature.tempHp || 0;
            const hpPercentage = Math.min(100, (hp / maxHp) * 100);
            const tempHpPercentage = (tempHp / maxHp) * 100;
            const hpColor = getHpColor(hp, maxHp);

            let displayName = creature.name;
            if (creature.isMob) {
                const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                displayName = `${creature.name} (${currentCount})`;
            }
            const attackButtonHTML = `<span class="header-stat interactive-stat attack-btn" data-id="${creature.id}">Attack: ${creature.attackMod || '+0'}</span>`;

            const hasStatBlock = creature.rawData;
            creatureDiv.innerHTML = `
                <div class="combatant-header">
                    <div class="combatant-name-group">
                        <h4>${displayName}</h4>
                        ${hasStatBlock ? `<span class="info-btn combatant-info-btn" data-id="${creature.id}" title="Show Stat Block">ℹ️</span>` : ''}
                    </div>
                    <div class="header-right-group">
                        ${attackButtonHTML}
                        <span class="header-stat">AC: ${creature.ac ?? '?'}</span>
                        <span class="header-stat">Speed: ${creature.speed || '?'}</span>
                        <span class="header-stat">DC: ${creature.saveDc ?? '?'}</span>
                        <button class="copy-btn" title="Copy" data-id="${creature.id}">👥</button>
                        <button class="edit-btn" title="Edit" data-id="${creature.id}">📝</button>
                        <button class="move-to-bottom-btn" title="Move to Bottom" data-id="${creature.id}">🔽</button>
                        <button class="remove-btn" title="Remove" data-id="${creature.id}">❌</button>
                    </div>
                </div>
                <div class="combatant-body">
                    <div class="main-controls">
                        <div class="hp-bar-container">
                            <div class="hp-bar-temp" style="width: ${tempHpPercentage}%;"></div>
                            <div class="hp-bar-current" style="width: ${hpPercentage}%; background-color: ${hpColor};"></div>
                            <span class="hp-bar-text">${hp} / ${maxHp} ${tempHp > 0 ? `(+${tempHp})` : ''}</span>
                        </div>
                        <button class="hp-change-btn" data-id="${creature.id}">+/- HP</button>
                        <button class="temp-hp-btn" data-id="${creature.id}">+ Temp HP</button>
                        <button class="add-condition-btn" data-id="${creature.id}">+ Condition</button>
                        <button class="reminders-btn" data-id="${creature.id}">Reminders</button>
                    </div>
                    <div class="secondary-controls">
                        <label><input type="checkbox" class="concentration-cb" data-id="${creature.id}" ${creature.isConcentrating ? 'checked' : ''}> Conc.</label>
                        <label><input type="checkbox" class="friendly-cb" data-id="${creature.id}" ${creature.isFriendly ? 'checked' : ''}> Legendary reminder</label>
                        <div class="condition-tags">${(creature.conditions || []).map(conditionName => {
                const condition = DND_CONDITIONS[conditionName];
                if (!condition) return '';
                return `
                                <span class="condition-tag has-tooltip" style="background-color: ${condition.color};" data-tooltip="${conditionName}: ${condition.text}">
                                    ${condition.emoji} ${conditionName}
                                    <button class="remove-condition-btn" data-id="${creature.id}" data-condition="${conditionName}">x</button>
                                </span>`;
            }).join('')}</div>
                    </div>
                    <div class="stats-footer">
                        ${scoresHTML}
                        ${savesHTML}
                    </div>
                </div>
            `;
            fragment.appendChild(creatureDiv);
        });
        combatantDetailsListDiv.appendChild(fragment);
    }

    function createPopup(type, creatureId, targetElement, data = {}) {
        // Close any existing popups
        document.querySelectorAll('.popup-dialog').forEach(p => p.remove());

        const popup = document.createElement('div');
        popup.className = 'popup-dialog';

        let contentHTML = '';
        if (type === 'hp') {
            contentHTML = `
                <input type="number" id="popup-hp-input" placeholder="e.g. -10 or 5">
                <button id="popup-hp-ok">Ok</button>
            `;
        } else if (type === 'condition') {
            const creature = initiativeOrder.find(c => c.id === parseInt(creatureId));
            const existingConditions = creature ? (creature.conditions || []) : [];
            const availableConditions = Object.keys(DND_CONDITIONS).filter(c => !existingConditions.includes(c));

            if (availableConditions.length === 0) {
                contentHTML = `<p style="padding: 10px; margin: 0; font-size: 0.9em; color: #666;">All conditions applied.</p>`;
            } else {
                contentHTML = `
                    <select id="popup-condition-select">
                        ${availableConditions.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                    <button id="popup-condition-add">Add</button>
                `;
            }
        } else if (type === 'stat-roll' || type === 'attack-roll') {
            contentHTML = `
                <button class="roll-type-btn" data-roll="adv">Advantage</button>
                <button class="roll-type-btn" data-roll="flat">Flat</button>
                <button class="roll-type-btn" data-roll="dis">Disadvantage</button>
            `;
        } else if (type === 'temp-hp') {
            contentHTML = `
                <input type="number" id="popup-temp-hp-input" placeholder="Amount">
                <button id="popup-temp-hp-ok">Ok</button>
            `;
        } else if (type === 'edit-initiative') {
            const creature = initiativeOrder.find(c => c.id === parseInt(creatureId));
            contentHTML = `
                <input type="text" id="popup-initiative-input" value="${creature.initiative}">
                <button id="popup-initiative-ok">Ok</button>
            `;
        } else if (type === 'reminders') {
            const creature = initiativeOrder.find(c => c.id === parseInt(creatureId));
            const startReminder = creature.reminders ? creature.reminders.start : '';
            const endReminder = creature.reminders ? creature.reminders.end : '';
            contentHTML = `
                <div class="reminders-popup">
                    <label>Beginning of Turn:</label>
                    <textarea id="start-turn-reminder">${startReminder}</textarea>
                    <label>End of Turn:</label>
                    <textarea id="end-turn-reminder">${endReminder}</textarea>
                    <button id="popup-reminders-save">Save</button>
                </div>
            `;
        } else if (type === 'monster-search') {
            contentHTML = `
                <input type="text" id="popup-monster-query" placeholder="Combatant Name">
                <button id="popup-monster-search">Search</button>
            `;
        } else if (type === 'monster-results') {
            const results = data.results || [];
            if (results.length === 0) {
                contentHTML = `<p>No results found.</p>`;
            } else {
                const itemsHTML = results.map(r => `<div class="popup-result-item" data-name="${r.name}" data-source="${r.source}">${r.name} (${r.source})</div>`).join('');
                contentHTML = `<div class="popup-results-list">${itemsHTML}</div>`;
            }
        }


        popup.innerHTML = contentHTML;
        document.body.appendChild(popup);

        const inputToFocus = popup.querySelector('input[type="text"], input[type="number"], textarea');
        if (inputToFocus) {
            inputToFocus.focus();
        }

        const rect = targetElement.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY}px`;

        popup.style.left = `${rect.left + window.scrollX}px`;

        // Add listeners for popup actions
        if (type === 'hp') {
            const input = document.getElementById('popup-hp-input');
            document.getElementById('popup-hp-ok').addEventListener('click', () => {
                const amount = parseInt(input.value, 10);
                if (!isNaN(amount)) {
                    window.electron.ipcRenderer.send('update-hp', { creatureId: parseInt(creatureId), amount: amount });
                }
                popup.remove();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('popup-hp-ok').click();
                }
            });
        } else if (type === 'condition') {
            const addBtn = document.getElementById('popup-condition-add');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const condition = document.getElementById('popup-condition-select').value;
                    window.electron.ipcRenderer.send('add-condition', { creatureId: parseInt(creatureId), condition });
                    popup.remove();
                });
            }
        } else if (type === 'temp-hp') {
            const input = document.getElementById('popup-temp-hp-input');
            document.getElementById('popup-temp-hp-ok').addEventListener('click', () => {
                const amount = parseInt(input.value, 10);
                if (!isNaN(amount)) {
                    window.electron.ipcRenderer.send('add-temp-hp', { creatureId: parseInt(creatureId), amount: amount });
                }
                popup.remove();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('popup-temp-hp-ok').click();
                }
            });
        } else if (type === 'stat-roll' || type === 'attack-roll') {
            document.querySelectorAll('.roll-type-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const rollType = button.dataset.roll;
                    if (type === 'attack-roll') {
                        window.electron.ipcRenderer.send('roll-attack', {
                            creatureId: parseInt(creatureId),
                            rollType: rollType,
                        });
                    } else {
                        window.electron.ipcRenderer.send('roll-stat', {
                            creatureId: parseInt(creatureId),
                            rollType: rollType,
                            stat: targetElement.dataset.stat,
                            type: targetElement.dataset.type
                        });
                    }
                    popup.remove();
                });
            });
        } else if (type === 'edit-initiative') {
            const input = document.getElementById('popup-initiative-input');
            document.getElementById('popup-initiative-ok').addEventListener('click', () => {
                const newInitiative = input.value;
                window.electron.ipcRenderer.send('update-initiative', { creatureId: parseInt(creatureId), initiative: newInitiative });
                popup.remove();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('popup-initiative-ok').click();
                }
            });
        } else if (type === 'reminders') {
            document.getElementById('popup-reminders-save').addEventListener('click', () => {
                const start = document.getElementById('start-turn-reminder').value;
                const end = document.getElementById('end-turn-reminder').value;
                window.electron.ipcRenderer.send('update-reminders', { creatureId: parseInt(creatureId), reminders: { start, end } });
                popup.remove();
            });
        } else if (type === 'monster-search') {
            const searchBtn = document.getElementById('popup-monster-search');
            const queryInput = document.getElementById('popup-monster-query');
            const addCreatureBtn = document.querySelector('.add-creature-button');

            const handleSearch = async () => {
                const query = queryInput.value;
                if (!query || searchBtn.disabled) return;

                const originalButtonText = searchBtn.innerHTML;

                try {
                    // --- Enter loading state ---
                    searchBtn.disabled = true;
                    queryInput.disabled = true;
                    if (addCreatureBtn) addCreatureBtn.disabled = true;
                    searchBtn.innerHTML = '🔄'; // Spinner

                    // --- Perform search ---
                    const results = await window.electron.ipcRenderer.invoke('search-monsters', query);
                    // On success, create a new popup with results. The old one is discarded.
                    createPopup('monster-results', null, targetElement, { results });

                } catch (error) {
                    console.error("Error searching for monster:", error);
                } finally {
                    // --- Exit loading state ---
                    // This block runs whether the search succeeds or fails.
                    // It restores the UI to its original state.
                    searchBtn.disabled = false;
                    queryInput.disabled = false;
                    if (addCreatureBtn) addCreatureBtn.disabled = false;
                    searchBtn.innerHTML = originalButtonText;
                }
            };

            searchBtn.addEventListener('click', handleSearch);
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleSearch();
                }
            });
        } else if (type === 'monster-results') {
            popup.querySelectorAll('.popup-result-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const { name, source } = item.dataset;
                    const monster = await window.electron.ipcRenderer.invoke('get-monster-details', { name, source });
                    if (monster) {
                        populateMonsterForm(monster);
                        displayStatBlock(JSON.stringify(monster));
                    }
                    popup.remove();
                });
            });
        }

        // Close popup when clicking outside
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (!popup.contains(e.target) && e.target !== targetElement) {
                    popup.remove();
                }
            }, { once: true });
        }, 0);
    }

    // --- Stat Block Rendering (for panel) ---
    function renderStatBlock(rawDataString) {
        if (!rawDataString) return 'No data available.';

        try {
            const monster = JSON.parse(rawDataString);

            // --- Helper Functions ---
            const renderAc = (ac) => {
                if (!ac || !ac.length) return 'N/A';
                return ac.map(val => {
                    if (typeof val === 'object' && val.ac) {
                        let from = '';
                        if (val.from) from = ` (${val.from.join(', ')})`;
                        return `${val.ac}${from}`;
                    }
                    return val.toString();
                }).join(', ');
            };

            const renderSpeed = (speed) => {
                if (!speed) return 'N/A';
                return Object.entries(speed).map(([type, val]) => {
                    let speedVal = '';
                    let condition = '';
                    if (typeof val === 'object' && val.number) {
                        speedVal = val.number;
                        if (val.condition) condition = ` ${val.condition}`;
                    } else {
                        speedVal = val;
                    }
                    return `${type} ${speedVal} ft.${condition}`;
                }).join(', ');
            };

            const renderCr = (cr) => {
                if (!cr) return 'N/A';
                if (typeof cr === 'object' && cr.cr) {
                    return cr.cr;
                }
                return cr.toString();
            };

            const renderEntries = (entries) => {
                if (!entries || !Array.isArray(entries)) return '';
                return entries.map(entry => {
                    if (typeof entry === 'string') {
                        // Replace 5eTools tags like {@dice 1d6 + 2} with (1d6 + 2)
                        return entry.replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)');
                    }
                    if (typeof entry === 'object' && entry.type === 'list') {
                        const listItems = entry.items.map(item => {
                            const name = item.name ? `<strong>${item.name}.</strong> ` : '';
                            const text = item.entry ? item.entry : (item.entries ? renderEntries(item.entries) : '');
                            return `<li>${name}${text}</li>`;
                        }).join('');
                        return `<ul>${listItems}</ul>`;
                    }
                    if (typeof entry === 'object' && entry.name && entry.entries) {
                        return `<div class="trait-block"><strong><em>${entry.name}.</em></strong> ${renderEntries(entry.entries)}</div>`;
                    }
                    return ''; // Fallback for unknown entry types
                }).join(' ');
            };

            // --- HTML Construction ---
            let html = `<h3>${monster.name || 'Unknown Creature'}</h3>`;

            const type = monster.type ? (typeof monster.type === 'object' ? monster.type.type : monster.type) : 'unknown';
            html += `<p><em>${monster.size || ''} ${type}, ${monster.alignment || ''}</em></p><hr>`;

            html += `<div class="property-line"><strong>Armor Class</strong> <span>${renderAc(monster.ac)}</span></div>`;
            html += `<div class="property-line"><strong>Hit Points</strong> <span>${monster.hp ? `${monster.hp.average} (${monster.hp.formula})` : 'N/A'}</span></div>`;
            html += `<div class="property-line"><strong>Speed</strong> <span>${renderSpeed(monster.speed)}</span></div><hr>`;

            // Stats
            const renderStat = (stat) => `${monster[stat] || 10} (${formatModifier(Math.floor(((monster[stat] || 10) - 10) / 2))})`;
            html += `<table class="stat-block-table">
                <tr><th>STR</th><th>DEX</th><th>CON</th></tr>
                <tr><td>${renderStat('str')}</td><td>${renderStat('dex')}</td><td>${renderStat('con')}</td></tr>
                <tr><th>INT</th><th>WIS</th><th>CHA</th></tr>
                <tr><td>${renderStat('int')}</td><td>${renderStat('wis')}</td><td>${renderStat('cha')}</td></tr>
            </table><hr>`;

            // Saves, Skills, Senses, Languages, CR
            if (monster.save) html += `<div class="property-line"><strong>Saving Throws</strong> <span>${Object.entries(monster.save).map(([stat, val]) => `${stat.toUpperCase()} ${val}`).join(', ')}</span></div>`;
            if (monster.skill) html += `<div class="property-line"><strong>Skills</strong> <span>${Object.entries(monster.skill).map(([name, val]) => `${name.charAt(0).toUpperCase() + name.slice(1)} ${val}`).join(', ')}</span></div>`;
            if (monster.senses) html += `<div class="property-line"><strong>Senses</strong> <span>${monster.senses.join(', ')}</span></div>`;
            if (monster.languages) html += `<div class="property-line"><strong>Languages</strong> <span>${monster.languages.join(', ')}</span></div>`;
            html += `<div class="property-line"><strong>Challenge</strong> <span>${renderCr(monster.cr)}</span></div><hr>`;

            // Traits, Actions, etc.
            if (monster.trait) html += renderEntries(monster.trait);
            if (monster.action) {
                html += `<h3>Actions</h3>${renderEntries(monster.action)}`;
            }
            if (monster.legendary) {
                html += `<h3>Legendary Actions</h3>${renderEntries(monster.legendary)}`;
            }
            if (monster.reaction) {
                html += `<h3>Reactions</h3>${renderEntries(monster.reaction)}`;
            }

            return html;

        } catch (e) {
            console.error("Failed to parse or render stat block:", e);
            return "Error: Could not display stat block. Data might be malformed.";
        }
    }


    // Ensure state is saved when closing the window
    window.addEventListener('beforeunload', () => {
        if (saveSoundboardStateTimeout) {
            clearTimeout(saveSoundboardStateTimeout);
        }
        // Force immediate save
        const soundboardVolumeSlider = document.getElementById('soundboard-volume');
        if (soundboardVolumeSlider) {
            const volume = parseFloat(soundboardVolumeSlider.value);
            const stateToSave = {
                volume: volume,
                slots: soundboardState.map(slot => ({
                    ...slot,
                    isPlaying: false
                }))
            };
            window.electron.ipcRenderer.send('save-soundboard-state', stateToSave);
        }
    });

    // --- Import Combatants Logic ---
    const importDialog = document.getElementById('import-selection-dialog');
    const importListContainer = document.getElementById('import-list-container');
    const importBtn = document.getElementById('import-from-file-btn');
    const confirmImportBtn = document.getElementById('confirm-import-btn');
    const importSelectAllBtn = document.getElementById('import-select-all');
    const importClearAllBtn = document.getElementById('import-clear-all');

    if (importSelectAllBtn) {
        importSelectAllBtn.addEventListener('click', () => {
            const checkboxes = importListContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
        });
    }

    if (importClearAllBtn) {
        importClearAllBtn.addEventListener('click', () => {
            const checkboxes = importListContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const combatants = await window.electron.ipcRenderer.invoke('read-combat-file');
            if (combatants && combatants.length > 0) {
                importListContainer.innerHTML = '';
                combatants.forEach((c, index) => {
                    const div = document.createElement('div');
                    div.style.padding = '5px';
                    div.style.borderBottom = '1px solid #ddd';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `import-check-${index}`;
                    checkbox.value = index;
                    checkbox.checked = false; // Default to UNCHECKED per user request

                    const label = document.createElement('label');
                    label.htmlFor = `import-check-${index}`;
                    label.textContent = ` ${c.name} (Init: ${c.initiativeFormula || c.initiative || '?'}, HP: ${c.hpFormula || c.hp || '?'})`;
                    label.style.marginLeft = '10px';

                    div.appendChild(checkbox);
                    div.appendChild(label);
                    importListContainer.appendChild(div);
                });
                // Store the combatants temporarily on the dialog
                importDialog.dataset.combatants = JSON.stringify(combatants);
                importDialog.showModal();
            }
        });
    }

    if (confirmImportBtn) {
        confirmImportBtn.addEventListener('click', (e) => {
            if (importDialog.returnValue === 'cancel') return;

            const combatants = JSON.parse(importDialog.dataset.combatants || '[]');
            const checkedBoxes = importListContainer.querySelectorAll('input[type="checkbox"]:checked');

            // Use a base timestamp that is definitely unique for this batch
            const baseTimestamp = Date.now();

            checkedBoxes.forEach((box, i) => {
                const index = parseInt(box.value);
                const c = combatants[index];
                if (c) {
                    const newCreature = { ...c };
                    // Ensure unique ID by adding loop index to timestamp.
                    // This guarantees they are distinct and integers.
                    newCreature.id = baseTimestamp + i;

                    window.electron.ipcRenderer.send('add-creature', newCreature);
                }
            });
            importDialog.close();
        });
    }

    // --- Global Tooltip Logic ---
    const globalTooltip = document.getElementById('global-tooltip');

    if (globalTooltip) {
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('.has-tooltip');
            if (target && target.dataset.tooltip) {
                globalTooltip.textContent = target.dataset.tooltip;
                globalTooltip.style.visibility = 'visible';
                globalTooltip.style.opacity = '1';
                updateTooltipPosition(e);
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (globalTooltip.style.visibility === 'visible') {
                updateTooltipPosition(e);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('.has-tooltip');
            if (target) {
                globalTooltip.style.visibility = 'hidden';
                globalTooltip.style.opacity = '0';
            }
        });

        function updateTooltipPosition(e) {
            const offset = 15;
            let x = e.clientX + offset;
            let y = e.clientY + offset;

            // Prevent going off screen (basic check)
            const rect = globalTooltip.getBoundingClientRect();
            if (x + rect.width > window.innerWidth) {
                x = e.clientX - rect.width - offset;
            }
            if (y + rect.height > window.innerHeight) {
                y = e.clientY - rect.height - offset;
            }

            globalTooltip.style.left = `${x}px`;
            globalTooltip.style.top = `${y}px`;
        }
    }

});