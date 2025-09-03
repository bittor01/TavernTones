document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    let isPlaying = false;
    let initiativeOrder = [];
    let combatantPanelOrder = []; // For custom sorting of the right-hand panel
    let currentTurnIndex = 0;
    let DND_CONDITIONS = {};

    // --- Element Refs ---
    const logArea = document.getElementById('logArea');
    const diceLog = document.getElementById('diceLog');
    const saveButton = document.getElementById('save-button');
    const loadButton = document.getElementById('load-button');
    const playPauseButton = document.getElementById('playPauseButton');
    const selectFileButton = document.getElementById('selectFileButton');
    const selectedFileLabel = document.getElementById('selectedFileLabel');
    const addCreatureForm = document.getElementById('add-creature-form');
    const initiativeListDiv = document.getElementById('initiative-list');
    const combatantDetailsListDiv = document.getElementById('combatant-details-list');
    const nextTurnButton = document.getElementById('next-turn-button');
    const previousTurnButton = document.getElementById('previous-turn-button');
    const maxLogEntries = 50;

    // --- Initial Load ---
    DND_CONDITIONS = await window.electron.ipcRenderer.invoke('get-dnd-conditions');
    window.electron.ipcRenderer.send('window-ready');
    setTimeout(() => {
        window.electron.ipcRenderer.send('request-initial-load');
    }, 100); // 100ms delay to ensure main process is ready

    // --- Initial UI Setup ---
    addCreatureForm.innerHTML = `
        <div class="form-row">
            <div class="form-group name-group">
                <label for="creature-name">Name:</label>
                <input type="text" id="creature-name" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label for="creature-initiative">Initiative:</label><input type="text" id="creature-initiative" placeholder="+3 or 15"></div>
            <div class="form-group"><label for="creature-hp">HP:</label><input type="number" id="creature-hp" placeholder="30"></div>
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
        <button type="submit" class="add-creature-button">Add Creature</button>
    `;

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

    // --- Event Listeners ---
    document.addEventListener('click', (event) => {
        const targetId = event.target.id;

        switch (targetId) {
            case 'log-toggle-btn': {
                const logArea = document.getElementById('logArea');
                const diceLog = document.getElementById('diceLog');
                const logTitle = document.getElementById('log-title');
                if (logArea.style.display === 'none') {
                    logArea.style.display = 'none';
                    diceLog.style.display = 'block';
                    logTitle.textContent = 'Dice Log';

                } else {
                    logArea.style.display = 'block';
                    diceLog.style.display = 'none';
                    logTitle.textContent = 'Log';
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

        const creature = {
            id: Date.now(),
            name: getVal('creature-name'),
            initiative: getVal('creature-initiative'),
            hp: getInt('creature-hp') || 0,
            maxHp: getInt('creature-hp') || 0, // Set maxHp from the same field
            tempHp: 0, // Initialize tempHp to 0
            ac: getInt('creature-ac'),
            speed: getVal('creature-speed'),
            attackMod: getVal('attack-modifier'),
            saveDc: getInt('save-dc'),
            scores: {
                str: getInt('str-score'),
                dex: getInt('dex-score'),
                con: getInt('con-score'),
                int: getInt('int-score'),
                wis: getInt('wis-score'),
                cha: getInt('cha-score'),
            },
            saves: {
                str: getVal('str-save'),
                dex: getVal('dex-save'),
                con: getVal('con-save'),
                int: getVal('int-save'),
                wis: getVal('wis-save'),
                cha: getVal('cha-save'),
            },
            conditions: [],
            isConcentrating: false,
            isFriendly: false,
            reminders: { start: '', end: '' }
        };
        window.electron.ipcRenderer.send('add-creature', creature);
        addCreatureForm.reset();
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
    });

    window.electron.ipcRenderer.on('update-gui-state', (event, state) => {
        isPlaying = state.isPlaying;
        playPauseButton.textContent = isPlaying ? 'Pause' : 'Play';
        if (state.filePath) {
            selectedFileLabel.textContent = window.electron.path.basename(state.filePath);
        } else {
            selectedFileLabel.textContent = 'No file selected';
        }
        playPauseButton.disabled = !state.filePath || state.isCaching;
        if (state.isCaching) {
            selectedFileLabel.textContent = `(Caching...) ${window.electron.path.basename(state.filePath)}`;
        }
    });

    window.electron.ipcRenderer.on('update-initiative-list', (event, data) => {
        initiativeOrder = data.initiativeOrder;
        currentTurnIndex = data.currentTurnIndex;

        // Create a map of the latest creature data for efficient lookup
        const newCreatureMap = new Map(initiativeOrder.map(c => [c.id, c]));

        // Get the updated data for creatures already in the panel, preserving their order
        const syncedPanelOrder = combatantPanelOrder
            .map(oldCreature => newCreatureMap.get(oldCreature.id))
            .filter(Boolean); // Filter out any creatures that may have been deleted

        // Identify any brand-new creatures that are not yet in our panel order
        const syncedPanelIds = new Set(syncedPanelOrder.map(c => c.id));
        const newCreatures = initiativeOrder.filter(c => !syncedPanelIds.has(c.id));

        // Update the panel order with the synced and new creatures
        combatantPanelOrder = [...syncedPanelOrder, ...newCreatures];

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
        document.getElementById('creature-name').value = creature.name || '';
        document.getElementById('creature-initiative').value = creature.initiative || '';
        document.getElementById('creature-hp').value = creature.maxHp || '';
        document.getElementById('creature-ac').value = creature.ac || '';
        document.getElementById('creature-speed').value = creature.speed || '';
        document.getElementById('attack-modifier').value = creature.attackMod || '';
        document.getElementById('save-dc').value = creature.saveDc || '';

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
    });

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

            // HP Bar Logic
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

            // Condition Emojis
            const conditionEmojis = (creature.conditions || [])
                .map(conditionName => DND_CONDITIONS[conditionName]?.emoji || '')
                .join(' ');

            // Build Content
            let content = '';
            if (isActive) {
                content += '<span class="active-chevron">></span>';
            }
            content += `<span class="initiative-score" data-id="${creature.id}">${creature.initiative}</span>`;
            content += `<div class="initiative-details">
                            <span class="creature-name">${creature.name}</span>
                            ${hpBarHTML}
                        </div>`;
            content += `<span class="initiative-conditions">${conditionEmojis}</span>`;

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

        // Find the ID of the creature whose turn it is, for highlighting
        const activeCreatureId = initiativeOrder.length > 0 ? initiativeOrder[currentTurnIndex]?.id : null;

        orderToRender.forEach((creature) => {
            const creatureDiv = document.createElement('div');
            // Highlight based on the actual turn index from the main initiativeOrder
            const isActive = activeCreatureId === creature.id;
            creatureDiv.className = 'combatant-details-entry' + (isActive ? ' active-turn' : '');
            creatureDiv.dataset.id = creature.id; // Add id for scrolling

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

            creatureDiv.innerHTML = `
                <div class="combatant-header">
                    <h4>${creature.name}</h4>
                    <div class="header-controls">
                        <button class="attack-roll-btn" data-id="${creature.id}">Attack ${creature.attackMod || '+0'}</button>
                        <div class="header-stats">
                            <span>AC: ${creature.ac ?? '?'}</span>
                            <span>Speed: ${creature.speed || '?'}</span>
                            <span>DC: ${creature.saveDc ?? '?'}</span>
                        </div>
                    </div>
                    <div class="card-controls">
                        <button class="copy-btn" title="Copy" data-id="${creature.id}">📋</button>
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
                // Re-render the list with the new order
                renderCombatantDetailsList(combatantPanelOrder, currentTurnIndex);
            }
        }));
    }

    function createPopup(type, creatureId, targetElement) {
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
        }

        popup.innerHTML = contentHTML;
        document.body.appendChild(popup);

        // Programmatically focus the first input or textarea in the popup
        const inputToFocus = popup.querySelector('input[type="text"], input[type="number"], textarea');
        if (inputToFocus) {
            inputToFocus.focus();
        }

        // Position popup near the button that was clicked
        const rect = targetElement.getBoundingClientRect();
        popup.style.top = `${rect.bottom + window.scrollY}px`;
        const popupWidth = popup.offsetWidth;
        popup.style.left = `${rect.left + window.scrollX - popupWidth}px`;

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
});
