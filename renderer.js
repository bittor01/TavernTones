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
        <div class="form-group"><label for="creature-name">Name:</label><input type="text" id="creature-name" required></div>
        <div class="form-group"><label for="creature-initiative">Initiative:</label><input type="number" id="creature-initiative" step="0.01" placeholder="Total or leave blank"></div>
        <div class="form-group"><label for="creature-init-mod">or Init Mod:</label><input type="number" id="creature-init-mod" placeholder="e.g. 3"></div>
        <div class="form-group"><label for="creature-hp">HP:</label><input type="number" id="creature-hp"></div>
        <div class="form-group"><label for="creature-ac">AC:</label><input type="number" id="creature-ac"></div>
        <button type="submit">Add Creature</button>
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
            initiative: document.getElementById('creature-initiative').value ? parseFloat(document.getElementById('creature-initiative').value) : null,
            initMod: document.getElementById('creature-init-mod').value ? parseInt(document.getElementById('creature-init-mod').value, 10) : null,
            hp: document.getElementById('creature-hp').value ? parseInt(document.getElementById('creature-hp').value, 10) : 0,
            ac: document.getElementById('creature-ac').value ? parseInt(document.getElementById('creature-ac').value, 10) : null,
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
            creatureDiv.innerHTML = `
                <div class="combatant-header">
                    <h4>${creature.name} (AC: ${creature.ac ?? '?'})</h4>
                </div>
                <div class="combatant-body">
                    <div class="hp-tracker">
                        <p><strong>HP:</strong> ${creature.hp ?? '?'}</p>
                        <div class="hp-controls">
                            <input type="number" id="hp-change-${creature.id}" value="1">
                            <button class="hp-damage" data-id="${creature.id}">-</button>
                            <button class="hp-heal" data-id="${creature.id}">+</button>
                        </div>
                    </div>
                    <div class="condition-tracker">
                        <div class="condition-tags">${(creature.conditions || []).map(c => `
                            <span class="condition-tag">${c} <button class="remove-condition" data-id="${creature.id}" data-condition="${c}">x</button></span>
                        `).join('')}</div>
                        <div class="condition-controls">
                            <select id="condition-select-${creature.id}">${DND_CONDITIONS.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                            <button class="add-condition" data-id="${creature.id}">Add</button>
                        </div>
                    </div>
                    <div class="creature-flags">
                        <label><input type="checkbox" class="concentration-cb" data-id="${creature.id}" ${creature.isConcentrating ? 'checked' : ''}> Conc.</label>
                        <label><input type="checkbox" class="friendly-cb" data-id="${creature.id}" ${creature.isFriendly ? 'checked' : ''}> Friendly</label>
                    </div>
                </div>
            `;
            combatantDetailsListDiv.appendChild(creatureDiv);
        });

        // Add event listeners for all the new dynamic buttons
        document.querySelectorAll('.hp-damage').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            const amount = parseInt(document.getElementById(`hp-change-${id}`).value, 10);
            if (!isNaN(amount)) window.electron.ipcRenderer.send('update-hp', { creatureId: parseInt(id), amount: -amount });
        }));
        document.querySelectorAll('.hp-heal').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            const amount = parseInt(document.getElementById(`hp-change-${id}`).value, 10);
            if (!isNaN(amount)) window.electron.ipcRenderer.send('update-hp', { creatureId: parseInt(id), amount: amount });
        }));
        document.querySelectorAll('.add-condition').forEach(b => b.addEventListener('click', e => {
            const id = e.target.dataset.id;
            const condition = document.getElementById(`condition-select-${id}`).value;
            window.electron.ipcRenderer.send('add-condition', { creatureId: parseInt(id), condition });
        }));
        document.querySelectorAll('.remove-condition').forEach(b => b.addEventListener('click', e => {
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
    }
});
