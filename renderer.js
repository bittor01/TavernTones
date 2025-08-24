document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let isPlaying = false;
    let initiativeOrder = [];

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
    const resetEncounterBtn = document.getElementById('reset-encounter-btn');
    const clearEncounterBtn = document.getElementById('clear-encounter-btn');
    const resetEncounterBtnAlt = document.getElementById('reset-encounter-btn-alt');
    const clearEncounterBtnAlt = document.getElementById('clear-encounter-btn-alt');
    const maxLogEntries = 50;

    let DND_CONDITIONS_DATA = {};
    const DND_CONDITIONS = [
        "Blinded", "Burning", "Charmed", "Deafened", "Exhaustion", "Frightened",
        "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
        "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Burning"
    ];

    const CONDITION_STYLES = {
        "blinded": { emoji: "🙈", color: "#7f8c8d" },
        "burning": { emoji: "🔥", color: "#e74c3c" },
        "charmed": { emoji: "😍", color: "#e91e63" },
        "deafened": { emoji: "🙉", color: "#95a5a6" },
        "exhaustion": { emoji: "😩", color: "#f39c12" },
        "frightened": { emoji: "😨", color: "#9b59b6" },
        "grappled": { emoji: "🤼", color: "#34495e" },
        "incapacitated": { emoji: "😵", color: "#d35400" },
        "invisible": { emoji: "👻", color: "#ecf0f1" },
        "paralyzed": { emoji: "🥶", color: "#3498db" },
        "petrified": { emoji: "🗿", color: "#5d4037" },
        "poisoned": { emoji: "🤢", color: "#27ae60" },
        "prone": { emoji: "🤸", color: "#16a085" },
        "restrained": { emoji: "⛓️", color: "#2c3e50" },
        "stunned": { emoji: "🤯", color: "#f1c40f" },
        "unconscious": { emoji: "😴", color: "#8e44ad" }
    };

    // --- HP Bar Helper Functions ---
    function getHpPercentage(creature) {
        if (typeof creature.hp !== 'number' || typeof creature.maxHp !== 'number' || creature.maxHp === 0) {
            return 100; // Default to full if data is invalid
        }
        const percentage = (creature.hp / creature.maxHp) * 100;
        return Math.max(0, Math.min(percentage, 100)); // Cap between 0 and 100
    }

    function getHpColorClass(creature) {
        if (typeof creature.hp !== 'number' || typeof creature.maxHp !== 'number') {
            return 'hp-grey'; // Default for invalid data
        }

        if (creature.hp <= 0) return 'hp-grey';

        const percentage = (creature.hp / creature.maxHp) * 100;
        if (percentage > 100) return 'hp-purple';
        if (percentage > 75) return 'hp-blue';
        if (percentage > 50) return 'hp-green';
        if (percentage > 25) return 'hp-yellow';
        return 'hp-red';
    }

    function generateConditionTooltip(conditionName) {
        const lowerCaseName = conditionName.toLowerCase();
        const data = DND_CONDITIONS_DATA[lowerCaseName];
        if (!data) return "No description available.";

        let text = `${data.name.toUpperCase()}\n${data.text}`;

        if (data.causes && data.causes.length > 0) {
            text += '\n\n--------------------\n';
            data.causes.forEach(causedConditionName => {
                const causedData = DND_CONDITIONS_DATA[causedConditionName.toLowerCase()];
                if (causedData) {
                    text += `\n${causedData.name.toUpperCase()} (Caused by ${data.name})\n${causedData.text}`;
                }
            });
        }
        return text;
    }

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

    // --- Initial Data Load ---
    (async () => {
        try {
            DND_CONDITIONS_DATA = await window.electron.ipcRenderer.invoke('get-conditions');
            logMessage("Conditions data loaded successfully.");
        } catch (error) {
            logMessage(`Error loading conditions data: ${error.message}`);
        }
    })();

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
    saveButton.addEventListener('click', () => window.electron.ipcRenderer.send('save-encounter'));
    loadButton.addEventListener('click', () => window.electron.ipcRenderer.send('load-encounter'));

    resetEncounterBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset the encounter? This will restore all HP, clear conditions, and reset turns.')) {
            window.electron.ipcRenderer.send('reset-encounter');
        }
    });
    clearEncounterBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire encounter?')) {
            window.electron.ipcRenderer.send('clear-encounter');
        }
    });
    resetEncounterBtnAlt.addEventListener('click', () => resetEncounterBtn.click());
    clearEncounterBtnAlt.addEventListener('click', () => clearEncounterBtn.click());

    nextTurnButton.addEventListener('click', () => window.electron.ipcRenderer.send('next-turn'));
    previousTurnButton.addEventListener('click', () => window.electron.ipcRenderer.send('previous-turn'));
    selectFileButton.addEventListener('click', () => window.electron.ipcRenderer.invoke('open-file-dialog'));
    playPauseButton.addEventListener('click', () => {
        if (isPlaying) {
            window.electron.ipcRenderer.send('pause-music');
        } else {
            window.electron.ipcRenderer.send('play-music');
        }
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
        initiativeOrder = data.initiativeOrder; // Store globally
        renderInitiativeList(data.initiativeOrder, data.currentTurnIndex);
        renderCombatantDetailsList(data.initiativeOrder, data.currentTurnIndex);
    });

    window.electron.ipcRenderer.on('populate-creature-form', (event, creature) => {
        const setVal = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };

        setVal('creature-name', creature.name);
        // Note: We don't set initiative, as it might be a roll. Let user decide.
        setVal('creature-hp', creature.hp);
        setVal('creature-ac', creature.ac);
        setVal('creature-speed', creature.speed);
        setVal('attack-modifier', creature.attackMod);
        setVal('save-dc', creature.saveDc);

        if (creature.scores) {
            setVal('str-score', creature.scores.str);
            setVal('dex-score', creature.scores.dex);
            setVal('con-score', creature.scores.con);
            setVal('int-score', creature.scores.int);
            setVal('wis-score', creature.scores.wis);
            setVal('cha-score', creature.scores.cha);
        }
        if (creature.saves) {
            setVal('str-save', creature.saves.str);
            setVal('dex-save', creature.saves.dex);
            setVal('con-save', creature.saves.con);
            setVal('int-save', creature.saves.int);
            setVal('wis-save', creature.saves.wis);
            setVal('cha-save', creature.saves.cha);
        }

        // Scroll to the top and focus the form
        const creatureEntryContainer = document.getElementById('creature-entry-container');
        creatureEntryContainer.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('creature-name').focus();

        // Now, remove the old creature from the tracker
        window.electron.ipcRenderer.send('remove-creature', { creatureId: creature.id });
    });

    // --- Render Functions ---
    function renderInitiativeList(initiativeOrder, currentTurnIndex) {
        initiativeListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        const displayOrder = [...initiativeOrder.slice(currentTurnIndex), ...initiativeOrder.slice(0, currentTurnIndex)];
        displayOrder.forEach((creature, displayIndex) => {
            const creatureDiv = document.createElement('div');
            creatureDiv.className = 'initiative-entry' + (displayIndex === 0 ? ' active-turn' : '');
            creatureDiv.dataset.id = creature.id; // Add ID for click-to-scroll

            let content = `<span class="initiative-score" data-id="${creature.id}">${creature.initiative}</span> <span class="creature-name">${creature.name}</span>`;
            if (displayIndex === 0) {
                content = `<span class="active-chevron">></span> ${content}`;
            }
            creatureDiv.innerHTML = content;

            initiativeListDiv.appendChild(creatureDiv);
        });

        // Add event listeners for this list
        document.querySelectorAll('.initiative-entry').forEach(entry => {
            // Click on the whole entry to scroll
            entry.addEventListener('click', (e) => {
                // Don't trigger if the click was on the score itself
                if (e.target.classList.contains('initiative-score')) return;

                const creatureId = e.currentTarget.dataset.id;
                const targetCombatant = combatantDetailsListDiv.querySelector(`.combatant-details-entry[data-id="${creatureId}"]`);
                if (targetCombatant) {
                    targetCombatant.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });

        document.querySelectorAll('.initiative-score').forEach(score => {
            score.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the scroll-to-view from firing
                const id = e.currentTarget.dataset.id;
                createPopup('initiative', id, e.currentTarget);
            });
        });
    }

    function renderCombatantDetailsList(initiativeOrder, currentTurnIndex) {
        combatantDetailsListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        initiativeOrder.forEach((creature, index) => {
            const creatureDiv = document.createElement('div');
            creatureDiv.className = 'combatant-details-entry' + (index === currentTurnIndex ? ' active-turn' : '');
            creatureDiv.dataset.id = creature.id; // Add ID for click-to-scroll target

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

            creatureDiv.innerHTML = `
                <div class="combatant-header">
                    <div class="combatant-header-left">
                        <button class="edit-creature-btn icon-btn" title="Edit" data-id="${creature.id}">&#128221;</button>
                        <h4 class="combatant-name">${creature.name}</h4>
                    </div>
                    <div class="combatant-header-right">
                        <div class="header-stats">
                            <span>AC: ${creature.ac ?? '?'}</span>
                            <span>Speed: ${creature.speed || '?'}</span>
                            <span>DC: ${creature.saveDc ?? '?'}</span>
                        </div>
                        <div class="header-buttons">
                            <button class="move-bottom-btn icon-btn" title="Move to Bottom" data-id="${creature.id}">&#11163;</button>
                            <button class="remove-creature-btn icon-btn" title="Remove" data-id="${creature.id}">&#10060;</button>
                        </div>
                    </div>
                </div>
                <div class="combatant-body">
                    <div class="main-controls">
                        <div class="hp-bar-container">
                            <div class="hp-bar ${getHpColorClass(creature)}" style="width: ${getHpPercentage(creature)}%;"></div>
                            <span class="hp-bar-text">${creature.hp} / ${creature.maxHp} ${creature.tempHp > 0 ? `(+${creature.tempHp})` : ''}</span>
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
                            const style = CONDITION_STYLES[conditionName.toLowerCase()] || { emoji: '❓', color: '#7f8c8d' };
                            const tooltipText = generateConditionTooltip(conditionName);
                            return `
                                <span class="condition-tag" style="background-color: ${style.color};" title="${tooltipText}">
                                    ${style.emoji} ${conditionName}
                                    <button class="remove-condition-btn" data-id="${creature.id}" data-condition="${conditionName}">x</button>
                                </span>
                            `;
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

        document.querySelectorAll('.temp-hp-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('temp-hp', id, e.target);
        }));
        document.querySelectorAll('.add-condition-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('condition', id, e.target);
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

        // --- New Button Listeners ---
        document.querySelectorAll('.edit-creature-btn').forEach(b => b.addEventListener('click', e => {
            const id = parseInt(e.currentTarget.dataset.id);
            window.electron.ipcRenderer.send('edit-creature', { creatureId: id });
        }));

        document.querySelectorAll('.remove-creature-btn').forEach(b => b.addEventListener('click', e => {
            const id = parseInt(e.currentTarget.dataset.id);
            const creature = initiativeOrder.find(c => c.id === id);
            if (confirm(`Are you sure you want to remove ${creature.name}?`)) {
                window.electron.ipcRenderer.send('remove-creature', { creatureId: id });
            }
        }));

        document.querySelectorAll('.move-bottom-btn').forEach(b => b.addEventListener('click', e => {
            const id = parseInt(e.currentTarget.dataset.id);
            window.electron.ipcRenderer.send('move-creature-to-bottom', { creatureId: id });
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
                <input type="number" id="popup-hp-input" placeholder="e.g. -10 or 5" autofocus>
                <button id="popup-hp-ok">Ok</button>
            `;
        } else if (type === 'temp-hp') {
            contentHTML = `
                <input type="number" id="popup-temp-hp-input" placeholder="e.g. 10" autofocus>
                <button id="popup-temp-hp-ok">Set</button>
            `;
        } else if (type === 'initiative') {
            const creature = initiativeOrder.find(c => c.id === parseInt(creatureId));
            contentHTML = `
                <input type="text" id="popup-initiative-input" value="${creature.initiative}" autofocus>
                <button id="popup-initiative-ok">Set</button>
            `;
        } else if (type === 'condition') {
            contentHTML = `
                <select id="popup-condition-select">
                    ${DND_CONDITIONS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <button id="popup-condition-add">Add</button>
            `;
        } else if (type === 'stat-roll') {
            contentHTML = `
                <button class="roll-type-btn" data-roll="adv">Advantage</button>
                <button class="roll-type-btn" data-roll="flat">Flat</button>
                <button class="roll-type-btn" data-roll="dis">Disadvantage</button>
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

        // Position popup near the button that was clicked
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
        } else if (type === 'temp-hp') {
            const input = document.getElementById('popup-temp-hp-input');
            document.getElementById('popup-temp-hp-ok').addEventListener('click', () => {
                const amount = parseInt(input.value, 10);
                if (!isNaN(amount) && amount >= 0) { // Temp HP shouldn't be negative
                    window.electron.ipcRenderer.send('update-temp-hp', { creatureId: parseInt(creatureId), amount: amount });
                }
                popup.remove();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('popup-temp-hp-ok').click();
                }
            });
        } else if (type === 'initiative') {
            const input = document.getElementById('popup-initiative-input');
            document.getElementById('popup-initiative-ok').addEventListener('click', () => {
                const value = input.value;
                // Basic validation: ensure it's not empty and can be a number
                if (value.trim() !== '' && !isNaN(parseFloat(value))) {
                    window.electron.ipcRenderer.send('update-initiative-value', { creatureId: parseInt(creatureId), value: value });
                }
                popup.remove();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    document.getElementById('popup-initiative-ok').click();
                }
            });
        } else if (type === 'condition') {
            document.getElementById('popup-condition-add').addEventListener('click', () => {
                const condition = document.getElementById('popup-condition-select').value;
                window.electron.ipcRenderer.send('add-condition', { creatureId: parseInt(creatureId), condition });
                popup.remove();
            });
        } else if (type === 'stat-roll') {
            document.querySelectorAll('.roll-type-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const rollType = button.dataset.roll;
                    window.electron.ipcRenderer.send('roll-stat', {
                        creatureId: parseInt(creatureId),
                        rollType: rollType,
                        stat: targetElement.dataset.stat,
                        type: targetElement.dataset.type
                    });
                    popup.remove();
                });
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
