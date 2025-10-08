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
    let currentStatBlockData = null; // To hold the raw data of the currently viewed stat block
    let DND_CONDITIONS = {};
    let MOB_RULES_DATA = {};

    // --- Form State ---
    let isMobMode = false;
    let singleCreatureHPForMob = '10';
    let creatureBeingEdited = null;

    // --- Element Refs ---
    const logArea = document.getElementById('logArea');
    const formatModifier = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;
    const diceLog = document.getElementById('diceLog');
    const playPauseButton = document.getElementById('playPauseButton');
    const selectedFileLabel = document.getElementById('selectedFileLabel');
    const addCreatureForm = document.getElementById('add-creature-form');
    const initiativeListDiv = document.getElementById('initiative-list');
    const combatantDetailsListDiv = document.getElementById('combatant-details-list');
    const maxLogEntries = 50;

    // --- Initial Load ---
    DND_CONDITIONS = await window.electron.ipcRenderer.invoke('get-dnd-conditions');
    MOB_RULES_DATA = await window.electron.ipcRenderer.invoke('get-mob-rules-data');
    window.electron.ipcRenderer.send('window-ready');
    setTimeout(() => {
        window.electron.ipcRenderer.send('request-initial-load');
    }, 100); // 100ms delay to ensure main process is ready

    // --- Initial UI Setup ---
    addCreatureForm.innerHTML = `
        <h2>Add Combatant</h2>
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

    async function updateMobHP() {
        if (!isMobMode) return;
        const mobSize = parseInt(mobSizeInput.value, 10) || 0;
        // singleCreatureHPForMob can be a dice formula, so we ask the main process to calculate its max value.
        const singleHP = await window.electron.ipcRenderer.invoke('calculate-max-hp', singleCreatureHPForMob);
        if (!isNaN(singleHP) && singleHP > 0) {
            creatureHpInput.value = mobSize * singleHP;
        }
    }

    convertToMobBtn.addEventListener('click', async () => {
        isMobMode = !isMobMode;
        if (isMobMode) {
            singleCreatureHPForMob = creatureHpInput.value || '10';
            mobControls.style.display = 'flex';
            convertToMobBtn.textContent = 'Convert to Single';
            if (!mobSizeInput.value) mobSizeInput.value = 5;
            await updateMobHP();
        } else {
            mobControls.style.display = 'none';
            convertToMobBtn.textContent = 'Convert to Mob';
            creatureHpInput.value = singleCreatureHPForMob;
        }
    });

    mobSizeInput.addEventListener('input', updateMobHP);


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
            currentStatBlockData = rawDataString; // Set the data for the push button
        } catch (e) {
            statBlockArea.innerHTML = '<p>Error: Could not parse creature data.</p>';
            showPanel('statBlockArea', 'Error');
        }
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
                // Reset mob state
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
                    window.electron.ipcRenderer.send('push-statblock-to-discord', currentStatBlockData);
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
            case 'gamify-tool-button':
                window.electron.ipcRenderer.send('open-gamify-tool');
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
                window.electron.ipcRenderer.invoke('open-file-dialog').then(filePath => {
                    if (filePath) {
                        window.electron.ipcRenderer.send('play-music', filePath);
                    }
                });
                break;
            case 'playPauseButton':
                if (isPlaying) {
                    window.electron.ipcRenderer.send('pause-music');
                } else {
                    window.electron.ipcRenderer.send('play-music');
                }
                break;
        }
    });

    // --- Soundboard Listeners (placeholders for now) ---
    document.getElementById('soundboard-volume').addEventListener('input', (e) => {
        console.log("Soundboard volume changed to:", e.target.value);
        // This will later send an IPC message, e.g., window.electron.ipcRenderer.send('set-soundboard-volume', e.target.value);
    });

    addCreatureForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const getVal = (id) => document.getElementById(id).value;
        const getInt = (id) => getVal(id) ? parseInt(getVal(id), 10) : null;

        const isEditing = !!creatureBeingEdited;
        let creature;

        if (isEditing) {
            // Start with a copy of the creature being edited to preserve existing state
            creature = { ...creatureBeingEdited };

            // Overwrite properties from the form
            creature.name = getVal('creature-name');
            creature.initiative = getVal('creature-initiative');
            creature.ac = getInt('creature-ac');
            creature.speed = getVal('creature-speed');
            creature.attackMod = getVal('attack-modifier');
            creature.saveDc = getInt('save-dc');
            creature.scores = { str: getInt('str-score'), dex: getInt('dex-score'), con: getInt('con-score'), int: getInt('int-score'), wis: getInt('wis-score'), cha: getInt('cha-score'), };
            creature.saves = { str: getVal('str-save'), dex: getVal('dex-save'), con: getVal('con-save'), int: getVal('int-save'), wis: getVal('wis-save'), cha: getVal('cha-save'), };
            creature.isMob = isMobMode;
            creature.hp = getInt('creature-hp'); // Always take current HP from form for edits

            if (isMobMode) {
                const singleHP = parseInt(singleCreatureHPForMob, 10) || 10;
                const newMobSize = getInt('mob-size');
                creature.singleCreatureHP = singleHP;
                creature.maxHp = newMobSize * singleHP; // Recalculate max HP based on size
                creature.mobInitialCount = creatureBeingEdited.isMob ? creatureBeingEdited.mobInitialCount : newMobSize;
                creature.hpFormula = `${creature.mobInitialCount} x ${creature.singleCreatureHP} HP`;
            } else {
                // If converting from a mob, the new max HP is the single creature's HP.
                // Otherwise, preserve the original max HP.
                creature.maxHp = creatureBeingEdited.isMob ? creature.hp : creatureBeingEdited.maxHp;
                creature.hpFormula = getVal('creature-hp');
                delete creature.mobInitialCount;
            }

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
                 // HP is already set correctly by the mob-size input listener
                 // but let's ensure it's a string for the backend.
                 creature.hp = getVal('creature-hp');
                 creature.singleCreatureHP = parseInt(singleCreatureHPForMob, 10) || 10;
                 creature.mobInitialCount = getInt('mob-size');
            }

            if (addCreatureForm.dataset.monsterRawData) {
                creature.rawData = addCreatureForm.dataset.monsterRawData;
            }

            window.electron.ipcRenderer.send('add-creature', creature);
        }

        // --- Reset Form ---
        addCreatureForm.reset();
        document.getElementById('imported-monster-info-btn').style.display = 'none';
        delete addCreatureForm.dataset.monsterRawData;
        creatureBeingEdited = null;
        isMobMode = false;
        document.getElementById('mob-controls').style.display = 'none';
        document.getElementById('convert-to-mob-btn').textContent = 'Convert to Mob';
        document.getElementById('creature-name').focus();
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

    window.electron.ipcRenderer.on('music-player-status', (event, status) => {
        isPlaying = status.isPlaying;
        playPauseButton.textContent = isPlaying ? 'Pause' : 'Play';

        if (status.isCaching) {
            selectedFileLabel.textContent = `(Caching...) ${window.electron.path.basename(status.filePath)}`;
            playPauseButton.disabled = true;
        } else if (status.filePath) {
            selectedFileLabel.textContent = window.electron.path.basename(status.filePath);
            playPauseButton.disabled = false;
        } else {
            selectedFileLabel.textContent = 'No file selected';
            playPauseButton.disabled = true;
        }
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

        // --- Populate basic fields ---
        document.getElementById('creature-name').value = creature.name || '';
        document.getElementById('creature-initiative').value = creature.initiative || '';
        document.getElementById('creature-hp').value = creature.hp || ''; // Show current HP
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
            singleCreatureHPForMob = creature.singleCreatureHP;
            mobControls.style.display = 'flex';
            convertToMobBtn.textContent = 'Convert to Single';
        } else {
            mobControls.style.display = 'none';
            convertToMobBtn.textContent = 'Convert to Mob';
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

        // Parse Attack Modifier from formats like "{@atkr m,r} (+7)" or "{@atkr m} (12)"
        const atkMatches = [...rawDataString.matchAll(/{@atkr[^}]*?}\s*\(([\+\-]?\d+)\)/g)];
        if (atkMatches.length > 0) {
            const highestAtk = Math.max(...atkMatches.map(match => parseInt(match[1], 10)));
            document.getElementById('attack-modifier').value = formatModifier(highestAtk);
        }

        // Parse Save DC from "{@dc 15}"
        const dcMatches = [...rawDataString.matchAll(/{@dc\s+(\d+)}/g)];
        if (dcMatches.length > 0) {
            const highestDc = Math.max(...dcMatches.map(match => parseInt(match[1], 10)));
            document.getElementById('save-dc').value = highestDc;
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

    renderSoundboard();

    // --- Soundboard State ---
    let soundboardState = [];
    const SOUNDBOARD_SIZE = 9;

    for (let i = 0; i < SOUNDBOARD_SIZE; i++) {
        soundboardState.push({ id: i, file: null, emoji: '➕', loop: false, isPlaying: false });
    }

    // --- Render Functions ---
    function renderSoundboard() {
        const grid = document.getElementById('soundboard-grid');
        grid.innerHTML = '';
        soundboardState.forEach(slot => {
            const controlSet = document.createElement('div');
            controlSet.className = 'soundboard-slot';
            controlSet.innerHTML = `
                <button class="soundboard-play-btn" data-id="${slot.id}">${slot.isPlaying ? '⏹️' : slot.emoji}</button>
                <div class="soundboard-slot-controls">
                    <input type="checkbox" id="loop-${slot.id}" data-id="${slot.id}" class="soundboard-loop-cb" ${slot.loop ? 'checked' : ''}>
                    <label for="loop-${slot.id}">Loop</label>
                    <button class="soundboard-unload-btn" data-id="${slot.id}" ${!slot.file ? 'disabled' : ''}>🗑️</button>
                </div>
            `;
            grid.appendChild(controlSet);
        });

        // Add listeners after rendering
        document.querySelectorAll('.soundboard-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                const slot = soundboardState[slotId];
                if (slot.isPlaying) {
                    window.electron.ipcRenderer.send('stop-sound', { slotId });
                } else if (slot.file) {
                    window.electron.ipcRenderer.send('play-sound', { slotId });
                } else {
                    window.electron.ipcRenderer.invoke('load-sound', { slotId }).then(result => {
                        if (result) {
                            soundboardState[slotId].file = result.file;
                            soundboardState[slotId].emoji = result.emoji;
                            renderSoundboard();
                        }
                    });
                }
            });
        });
        document.querySelectorAll('.soundboard-loop-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                const loop = e.target.checked;
                soundboardState[slotId].loop = loop;
                window.electron.ipcRenderer.send('set-loop', { slotId, loop });
            });
        });
        document.querySelectorAll('.soundboard-unload-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slotId = parseInt(e.target.dataset.id, 10);
                window.electron.ipcRenderer.send('unload-sound', { slotId });
            });
        });
    }

    function renderInitiativeList(initiativeOrder, currentTurnIndex) {
        initiativeListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        initiativeOrder.forEach((creature, index) => {
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

            let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
            let conditionStr;
            if (conditionEmojis.length > 3) {
                conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
            } else {
                conditionStr = conditionEmojis.join('');
            }

            let displayName = creature.name;
            if (creature.isMob) {
                const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                displayName = `Mob of ${currentCount} ${creature.name} (of ${creature.mobInitialCount})`;
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

            initiativeListDiv.appendChild(creatureDiv);
        });
    }

    function getHpColor(current, max) {
        if (current <= 0) return '#6c757d'; // Grey
        if (current > max) return '#8a2be2'; // Purple

        const percentage = (current / max) * 100;
        if (percentage <= 25) return '#dc3545'; // Red
        if (percentage <= 50) return '#ffc107'; // Yellow
        if (percentage <= 75) return '#28a745'; // Green
        return '#007bff'; // Blue
    }

    function renderCombatantDetailsList(orderToRender, currentTurnIndex) {
        combatantDetailsListDiv.innerHTML = '';
        if (!orderToRender || orderToRender.length === 0) return;

        const activeCreatureId = initiativeOrder.length > 0 ? initiativeOrder[currentTurnIndex]?.id : null;

        orderToRender.forEach((creature) => {
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
            let attackButtonHTML = '';
            if (creature.isMob) {
                const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                displayName = `Mob of ${currentCount} ${creature.name} (of ${creature.mobInitialCount})`;
                attackButtonHTML = `<span class="header-stat interactive-stat mob-rules-btn" data-id="${creature.id}">Mob Rules</span>`;
            } else {
                displayName = creature.name;
                attackButtonHTML = `<span class="header-stat interactive-stat attack-roll-btn" data-id="${creature.id}">Attack: ${creature.attackMod || '+0'}</span>`;
            }

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
                                <span class="condition-tag" style="background-color: ${condition.color};" title="${condition.text}">
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
            combatantDetailsListDiv.appendChild(creatureDiv);
        });

        // Add event listeners for all the new dynamic buttons
        document.querySelectorAll('.attack-roll-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('attack-roll', id, e.target);
        }));

        document.querySelectorAll('.mob-rules-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('mob-rules', id, e.target);
        }));

        document.querySelectorAll('.stat-roll-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            const type = e.target.dataset.type;
            const stat = e.target.dataset.stat;
            createPopup('stat-roll', id, e.target, { type, stat });
        }));

        document.querySelectorAll('.hp-change-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('hp', id, e.target);
        }));
        document.querySelectorAll('.add-condition-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('condition', id, e.target);
        }));

        document.querySelectorAll('.temp-hp-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('temp-hp', id, e.target);
        }));

        document.querySelectorAll('.remove-condition-btn').forEach(b => b.addEventListener('click', e => {
            const { id, condition } = e.target.dataset;
            window.electron.ipcRenderer.send('remove-condition', { creatureId: parseInt(id), condition });
        }));
        document.querySelectorAll('.concentration-cb').forEach(cb => cb.addEventListener('change', e => {
            const id = e.target.dataset.id;
            window.electron.ipcRenderer.send('update-creature-flag', { creatureId: parseInt(id), flag: 'isConcentrating', value: e.target.checked });
        }));
        document.querySelectorAll('.friendly-cb').forEach(cb => cb.addEventListener('change', e => {
            const id = e.target.dataset.id;
            window.electron.ipcRenderer.send('update-creature-flag', { creatureId: parseInt(id), flag: 'isFriendly', value: e.target.checked });
        }));
        document.querySelectorAll('.reminders-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('reminders', id, e.target);
        }));

        document.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', e => {
            window.electron.ipcRenderer.send('copy-creature', { creatureId: parseInt(e.target.dataset.id) });
        }));
        document.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', e => {
            window.electron.ipcRenderer.send('edit-creature', { creatureId: parseInt(e.target.dataset.id) });
        }));
        document.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', e => {
            window.electron.ipcRenderer.send('remove-creature', { creatureId: parseInt(e.target.dataset.id) });
        }));
        document.querySelectorAll('.move-to-bottom-btn').forEach(b => b.addEventListener('click', e => {
            const creatureId = parseInt(e.target.dataset.id);
            const creatureIndex = combatantPanelOrder.findIndex(c => c.id === creatureId);
            if (creatureIndex > -1) {
                const [creature] = combatantPanelOrder.splice(creatureIndex, 1);
                combatantPanelOrder.push(creature);
                renderCombatantDetailsList(combatantPanelOrder, currentTurnIndex);
            }
        }));
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
            contentHTML = `
                <select id="popup-condition-select">
                    ${Object.keys(DND_CONDITIONS).map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <button id="popup-condition-add">Add</button>
            `;
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
        } else if (type === 'mob-rules') {
            const creature = initiativeOrder.find(c => c.id === parseInt(creatureId));
            const attackMod = parseInt(creature.attackMod, 10) || 0;
            const { mobAttackResults, areaTargets } = MOB_RULES_DATA;

            const mobAttackRows = mobAttackResults.map(row => {
                const ac = row.rollNeeded + attackMod;
                return `<tr><td>${ac}</td><td>${row.hitsPer4}</td><td>${row.hitsPer5}</td><td>${row.hitsPer6}</td><td>${row.hitsPer8}</td><td>${row.hitsPer10}</td></tr>`;
            }).join('');

            const areaTargetRows = areaTargets.map(row => {
                return `<tr><td>${row.targets}</td><td>${row.cone}</td><td>${row.cube}</td><td>${row.circular}</td><td>${row.line}</td></tr>`;
            }).join('');

            contentHTML = `
                <div class="mob-rules-popup">
                    <button id="push-mob-rules-btn" class="small-btn" title="Push to Chat">💬</button>
                    <h4>Mob Attacks (Atk: ${formatModifier(attackMod)})</h4>
                    <p class="footnote">The table shows the number of hits an attack action generates against a target's AC, based on the number of creatures in the mob.</p>
                    <table class="mob-rules-table">
                        <thead>
                            <tr><th>AC</th><th>4 in Mob</th><th>5 in Mob</th><th>6 in Mob</th><th>8 in Mob</th><th>10 in Mob</th></tr>
                        </thead>
                        <tbody>${mobAttackRows}</tbody>
                    </table>
                    <hr>
                    <h4>Targets in Area of Effect</h4>
                    <table class="mob-rules-table">
                         <thead>
                            <tr><th>Targets</th><th>Cone</th><th>Cube</th><th>Circular*</th><th>Line</th></tr>
                        </thead>
                        <tbody>${areaTargetRows}</tbody>
                    </table>
                    <p class="footnote"><em>*Use for Cylinders, Emanations, and Spheres.</em></p>
                </div>
            `;
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
            document.getElementById('popup-condition-add').addEventListener('click', () => {
                const condition = document.getElementById('popup-condition-select').value;
                window.electron.ipcRenderer.send('add-condition', { creatureId: parseInt(creatureId), condition });
                popup.remove();
            });
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
});