document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let isPlaying = false;

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

    const DND_CONDITIONS = [
        "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
        "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
        "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"
    ];

    // --- Initial UI Setup ---
    addCreatureForm.innerHTML = `
        <div class="form-grid">
            <div class="form-group span-2">
                <label for="creature-name">Name:</label>
                <input type="text" id="creature-name" required>
            </div>
            <div class="form-group">
                <label for="creature-initiative">Initiative:</label>
                <input type="text" id="creature-initiative" placeholder="+3 or 15">
            </div>
            <div class="form-group">
                <label for="creature-hp">HP:</label>
                <input type="number" id="creature-hp">
            </div>
            <div class="form-group">
                <label for="creature-ac">AC:</label>
                <input type="number" id="creature-ac">
            </div>
            <div class="form-group">
                <label for="creature-speed">Speed:</label>
                <input type="text" id="creature-speed" placeholder="30ft">
            </div>
            <div class="form-group">
                <label for="attack-modifier">Attack Mod:</label>
                <input type="text" id="attack-modifier" placeholder="+5">
            </div>
            <div class="form-group">
                <label for="save-dc">Save DC:</label>
                <input type="number" id="save-dc" placeholder="13">
            </div>
            <div class="form-group save-input"><label>STR</label><input type="text" id="str-save" placeholder="+2"></div>
            <div class="form-group save-input"><label>DEX</label><input type="text" id="dex-save" placeholder="+2"></div>
            <div class="form-group save-input"><label>CON</label><input type="text" id="con-save" placeholder="+2"></div>
            <div class="form-group save-input"><label>INT</label><input type="text" id="int-save" placeholder="+2"></div>
            <div class="form-group save-input"><label>WIS</label><input type="text" id="wis-save" placeholder="+2"></div>
            <div class="form-group save-input"><label>CHA</label><input type="text" id="cha-save" placeholder="+2"></div>
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
    saveButton.addEventListener('click', () => window.electron.ipcRenderer.send('save-encounter'));
    loadButton.addEventListener('click', () => window.electron.ipcRenderer.send('load-encounter'));
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
        const creature = {
            id: Date.now(),
            name: document.getElementById('creature-name').value,
            initiative: document.getElementById('creature-initiative').value, // Send as string
            hp: document.getElementById('creature-hp').value ? parseInt(document.getElementById('creature-hp').value, 10) : 0,
            ac: document.getElementById('creature-ac').value ? parseInt(document.getElementById('creature-ac').value, 10) : null,
            speed: document.getElementById('creature-speed').value,
            attackMod: document.getElementById('attack-modifier').value,
            saveDc: document.getElementById('save-dc').value ? parseInt(document.getElementById('save-dc').value, 10) : null,
            saves: {
                str: document.getElementById('str-save').value,
                dex: document.getElementById('dex-save').value,
                con: document.getElementById('con-save').value,
                int: document.getElementById('int-save').value,
                wis: document.getElementById('wis-save').value,
                cha: document.getElementById('cha-save').value,
            },
            conditions: [],
            isConcentrating: false,
            isFriendly: false
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

    window.electron.ipcRenderer.on('update-initiative-list', (event, { initiativeOrder, currentTurnIndex }) => {
        renderInitiativeList(initiativeOrder, currentTurnIndex);
        renderCombatantDetailsList(initiativeOrder, currentTurnIndex);
    });

    // --- Render Functions ---
    function renderInitiativeList(initiativeOrder, currentTurnIndex) {
        initiativeListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        const displayOrder = [...initiativeOrder.slice(currentTurnIndex), ...initiativeOrder.slice(0, currentTurnIndex)];
        displayOrder.forEach((creature, displayIndex) => {
            const creatureDiv = document.createElement('div');
            creatureDiv.className = 'initiative-entry' + (displayIndex === 0 ? ' active-turn' : '');
            creatureDiv.innerHTML = `<span class="initiative-score">${creature.initiative}</span> <span class="creature-name">${creature.name}</span>`;
            initiativeListDiv.appendChild(creatureDiv);
        });
    }

    function renderCombatantDetailsList(initiativeOrder, currentTurnIndex) {
        combatantDetailsListDiv.innerHTML = '';
        if (!initiativeOrder || initiativeOrder.length === 0) return;

        initiativeOrder.forEach((creature, index) => {
            const creatureDiv = document.createElement('div');
            creatureDiv.className = 'combatant-details-entry' + (index === currentTurnIndex ? ' active-turn' : '');

            const saves = creature.saves || {};
            const savesHTML = `
                <div class="saves-grid">
                    <span>STR: ${saves.str || 'N/A'}</span><span>DEX: ${saves.dex || 'N/A'}</span><span>CON: ${saves.con || 'N/A'}</span>
                    <span>INT: ${saves.int || 'N/A'}</span><span>WIS: ${saves.wis || 'N/A'}</span><span>CHA: ${saves.cha || 'N/A'}</span>
                </div>
            `;

            creatureDiv.innerHTML = `
                <div class="combatant-header">
                    <h4>${creature.name}</h4>
                    <div class="header-stats">
                        <span>AC: ${creature.ac ?? '?'}</span>
                        <span>Speed: ${creature.speed || '?'}</span>
                        <span>DC: ${creature.saveDc ?? '?'}</span>
                    </div>
                </div>
                <div class="combatant-body">
                    <div class="main-controls">
                        <span class="hp-display">HP: ${creature.hp ?? '?'}</span>
                        <button class="hp-change-btn" data-id="${creature.id}">+/- HP</button>
                        <button class="add-condition-btn" data-id="${creature.id}">+ Condition</button>
                        <button class="reminders-btn" data-id="${creature.id}">Reminders</button>
                    </div>
                    <div class="secondary-controls">
                        <label><input type="checkbox" class="concentration-cb" data-id="${creature.id}" ${creature.isConcentrating ? 'checked' : ''}> Conc.</label>
                        <label><input type="checkbox" class="friendly-cb" data-id="${creature.id}" ${creature.isFriendly ? 'checked' : ''}> Friendly</label>
                        <div class="condition-tags">${(creature.conditions || []).map(c => `
                            <span class="condition-tag">${c} <button class="remove-condition-btn" data-id="${creature.id}" data-condition="${c}">x</button></span>
                        `).join('')}</div>
                    </div>
                    <div class="stats-footer">
                        ${savesHTML}
                    </div>
                </div>
            `;
            combatantDetailsListDiv.appendChild(creatureDiv);
        });

        // Add event listeners for all the new dynamic buttons
        document.querySelectorAll('.hp-change-btn').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            createPopup('hp', id, e.target);
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
            window.electron.ipcRenderer.send('show-reminders-dialog', { creatureId: parseInt(id) });
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
        } else if (type === 'condition') {
            contentHTML = `
                <select id="popup-condition-select">
                    ${DND_CONDITIONS.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
                <button id="popup-condition-add">Add</button>
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
        } else if (type === 'condition') {
            document.getElementById('popup-condition-add').addEventListener('click', () => {
                const condition = document.getElementById('popup-condition-select').value;
                window.electron.ipcRenderer.send('add-condition', { creatureId: parseInt(creatureId), condition });
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
