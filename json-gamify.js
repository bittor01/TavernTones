document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let taskData = null;
    let currentSpell = null;
    let spellDetails = null;
    let previousSpellState = null; // For the undo functionality
    let score = 0;
    let highScore = 0;
    let itemsCompletedInSet = 0;
    let totalSpellsInCurrentFile = 0;

    // --- CONSTANTS ---
    const ALL_ITEM_TYPES = ["Giz", "Scr", "GWT", "Amm", "Pot", "Ing", "Inh", "Con", "Inj"];
    const PROGRESS_BAR_SET_SIZE = 10;

    // --- DOM ELEMENTS ---
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');
    const progressBarEl = document.getElementById('progress-bar');
    const spellNameEl = document.getElementById('spell-name');
    const spellTextEl = document.getElementById('spell-text');
    const itemTypesCheckboxesEl = document.getElementById('item-types-checkboxes');
    const nextButton = document.getElementById('next-button');
    const undoButton = document.getElementById('undo-button');
    const containerEl = document.getElementById('container');

    // --- RENDER FUNCTIONS ---
    function render() {
        if (!currentSpell) {
            spellNameEl.textContent = "Error";
            spellTextEl.innerHTML = "<p>Could not load a spell.</p>";
            return;
        }

        // Update scores
        scoreEl.textContent = score;
        highScoreEl.textContent = highScore;

        // Update progress bar
        const progressPercentage = (itemsCompletedInSet / PROGRESS_BAR_SET_SIZE) * 100;
        progressBarEl.style.width = `${progressPercentage}%`;

        // Update spell info
        const spellName = currentSpell.text.split(' - ')[0];
        const progressIndicator = `(${taskData.progress.itemIndex + 1} / ${totalSpellsInCurrentFile} in Lvl ${taskData.progress.fileIndex})`;
        spellNameEl.textContent = `${spellName} ${progressIndicator}`;

        if (spellDetails && spellDetails.entries) {
            let html = '';
            spellDetails.entries.forEach(entry => {
                if (typeof entry === 'string') {
                    html += `<p>${entry.replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)')}</p>`;
                } else if (entry.type === 'list') {
                    html += `<ul>${entry.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
                }
            });
            spellTextEl.innerHTML = html;
        } else {
            spellTextEl.innerHTML = `<p>No detailed description available.</p>`;
        }


        // Update checkboxes
        itemTypesCheckboxesEl.innerHTML = '';
        ALL_ITEM_TYPES.forEach(itemType => {
            const isChecked = currentSpell.itemtypes.includes(itemType);
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.innerHTML = `
                <input type="checkbox" id="type-${itemType}" value="${itemType}" ${isChecked ? 'checked' : ''}>
                <label for="type-${itemType}">${itemType}</label>
            `;
            itemTypesCheckboxesEl.appendChild(checkboxWrapper);
        });
    }

    function handleTaskCompletion() {
        spellNameEl.textContent = "Task Complete!";
        spellTextEl.innerHTML = "<p>You've processed all the files. Great job!</p>";
        itemTypesCheckboxesEl.innerHTML = '';
        nextButton.disabled = true;
        undoButton.disabled = true;
    }

    function triggerProgressBarReward() {
        progressBarEl.style.backgroundColor = '#28a745'; // Green flash
        containerEl.style.boxShadow = '0 0 25px #28a745';
        setTimeout(() => {
            progressBarEl.style.backgroundColor = '#7289da'; // Revert to original color
            containerEl.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        }, 600);
    }

    // --- EVENT LISTENERS ---
    nextButton.addEventListener('click', async () => {
        if (!currentSpell) return;

        // 1. Store previous state for undo
        previousSpellState = JSON.parse(JSON.stringify(currentSpell)); // Deep copy

        // 2. Read current checkbox state and update spell
        const selectedTypes = [];
        itemTypesCheckboxesEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selectedTypes.push(cb.value);
        });
        currentSpell.itemtypes = selectedTypes;

        // 3. Send data to backend to save and get next item
        const response = await window.electron.ipcRenderer.invoke('save-and-get-next-spell', { taskData, currentSpell });

        if (!response.success) {
            spellNameEl.textContent = "Error";
            spellTextEl.textContent = `Failed to save or get next spell: ${response.error}`;
            return;
        }

        // 4. Update score and progress
        score++;
        if (score > highScore) {
            highScore = score;
        }
        itemsCompletedInSet++;
        if (itemsCompletedInSet >= PROGRESS_BAR_SET_SIZE) {
            itemsCompletedInSet = 0;
            triggerProgressBarReward();
        }

        // 5. Update state with new data from backend
        if (response.taskComplete) {
            handleTaskCompletion();
            return;
        }
        taskData = response.taskData;
        currentSpell = response.spell;
        spellDetails = response.spellDetails;
        totalSpellsInCurrentFile = response.spellCount;

        // 6. Enable undo button and re-render
        undoButton.disabled = false;
        render();
    });

    undoButton.addEventListener('click', async () => {
        if (!previousSpellState) return;

        // 1. Send previous state to backend to save and get it back
        const response = await window.electron.ipcRenderer.invoke('undo-and-get-previous-spell', { taskData, previousSpellState });

        if (!response.success) {
            // Maybe show a less intrusive error
            console.error("Undo failed:", response.error);
            return;
        }

        // 2. Update score
        score--;

        // 3. Update state with reverted data
        taskData = response.taskData;
        currentSpell = response.spell;
        spellDetails = response.spellDetails;
        totalSpellsInCurrentFile = response.spellCount;

        // 4. Clear previous state to prevent multiple undos, disable button
        previousSpellState = null;
        undoButton.disabled = true;

        // 5. Re-render
        render();
    });

    // --- INITIAL LOAD ---
    async function initialize() {
        const response = await window.electron.ipcRenderer.invoke('get-task-data');
        if (response.success) {
            if (response.taskComplete) {
                handleTaskCompletion();
                return;
            }
            taskData = response.taskData;
            currentSpell = response.spell;
            spellDetails = response.spellDetails;
            totalSpellsInCurrentFile = response.spellCount;

            undoButton.disabled = true; // Can't undo on the first item
            render();
        } else {
            spellNameEl.textContent = "Error";
            spellTextEl.textContent = `Failed to load task data: ${response.error}`;
        }
    }

    initialize();
});
