document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let taskData = null;
    let currentItem = null;
    let itemDetails = null; // e.g., for spell descriptions
    let previousItemState = null;
    let currentTaskPath = null;
    let score = 0;
    let highScore = 0;
    let itemsCompletedInSet = 0;
    let totalItemsInCurrentFile = 0;

    // --- DOM ELEMENTS ---
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');
    const progressBarEl = document.getElementById('progress-bar');
    const titleEl = document.getElementById('item-title');
    const detailsEl = document.getElementById('item-details');
    const dynamicUIContainerEl = document.getElementById('dynamic-ui-container');
    const nextButton = document.getElementById('next-button');
    const undoButton = document.getElementById('undo-button');
    const containerEl = document.getElementById('container');

    // --- RENDER & UI FUNCTIONS ---

    function generateUI(uiDefinition, data) {
        dynamicUIContainerEl.innerHTML = ''; // Clear previous form
        const formEl = document.createElement('form');
        formEl.id = 'dynamic-form';

        uiDefinition.fields.forEach(field => {
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.htmlFor = `field-${field.key}`;
            label.textContent = field.label;

            let input;
            const currentValue = data[field.key];

            switch (field.type) {
                case 'checkbox':
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.checked = currentValue === true;
                    break;
                case 'checkbox-group': // For string arrays like itemtypes
                    field.options.forEach(option => {
                        const checkGroup = document.createElement('div');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = `field-${field.key}-${option}`;
                        checkbox.dataset.key = field.key;
                        checkbox.value = option;
                        checkbox.checked = currentValue && currentValue.includes(option);

                        const checkLabel = document.createElement('label');
                        checkLabel.htmlFor = checkbox.id;
                        checkLabel.textContent = option;

                        checkGroup.append(checkbox, checkLabel);
                        formEl.appendChild(checkGroup);
                    });
                    return; // Skip default append
                case 'textarea':
                    input = document.createElement('textarea');
                    input.value = currentValue || '';
                    input.rows = field.rows || 3;
                    break;
                default: // text input
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = currentValue || '';
            }

            input.id = `field-${field.key}`;
            input.dataset.key = field.key;

            formGroup.appendChild(label);
            formGroup.appendChild(input);
            formEl.appendChild(formGroup);
        });

        dynamicUIContainerEl.appendChild(formEl);
    }

    function readUIData() {
        const updatedItem = JSON.parse(JSON.stringify(currentItem));
        const uiDefinition = taskData.ui;

        uiDefinition.fields.forEach(field => {
            switch (field.type) {
                case 'checkbox':
                    updatedItem[field.key] = document.getElementById(`field-${field.key}`).checked;
                    break;
                case 'checkbox-group':
                    const checkedValues = [];
                    document.querySelectorAll(`input[data-key="${field.key}"]:checked`).forEach(cb => {
                        checkedValues.push(cb.value);
                    });
                    updatedItem[field.key] = checkedValues;
                    break;
                case 'textarea':
                case 'text':
                    updatedItem[field.key] = document.getElementById(`field-${field.key}`).value;
                    break;
            }
        });
        return updatedItem;
    }

    function render() {
        if (!currentItem || !taskData) {
            titleEl.textContent = "Error";
            detailsEl.innerHTML = "<p>Could not load task item.</p>";
            return;
        }

        scoreEl.textContent = score;
        highScoreEl.textContent = highScore;

        const progressPercentage = totalItemsInCurrentFile > 0 ? ((taskData.progress.itemIndex + 1) / totalItemsInCurrentFile) * 100 : 0;
        progressBarEl.style.width = `${progressPercentage}%`;

        const title = currentItem[taskData.ui.titleField] || "Unnamed Item";
        const progressIndicator = `(${taskData.progress.itemIndex + 1} / ${totalItemsInCurrentFile} in File ${taskData.progress.fileIndex + 1})`;
        titleEl.textContent = `${title} ${progressIndicator}`;

        if (itemDetails && itemDetails.entries) {
            let html = '';
            itemDetails.entries.forEach(entry => {
                if (typeof entry === 'string') {
                    html += `<p>${entry.replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)')}</p>`;
                } else if (entry.type === 'list') {
                    html += `<ul>${entry.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
                }
            });
            detailsEl.innerHTML = html;
        } else {
            detailsEl.innerHTML = `<p>No detailed description available.</p>`;
        }

        generateUI(taskData.ui, currentItem);
    }

    async function handleTaskCompletion() {
        // Check for a next task
        if (taskData && taskData.nextTask) {
            const nextTaskPath = taskData.nextTask;
            // Reset state before loading new task
            taskData = null;
            currentItem = null;
            itemDetails = null;
            previousItemState = null;
            totalItemsInCurrentFile = 0;
            titleEl.textContent = "Loading next task...";
            detailsEl.innerHTML = "";
            dynamicUIContainerEl.innerHTML = "";

            const response = await window.electron.ipcRenderer.invoke('load-task-by-path', nextTaskPath);
            if (response.success) {
                // Essentially re-initializing
                taskData = response.taskData;
                currentTaskPath = response.taskFilePath;
                currentItem = response.spell;
                itemDetails = response.spellDetails;
                totalItemsInCurrentFile = response.spellCount;
                undoButton.disabled = true;
                render();
            } else {
                titleEl.textContent = "Error";
                detailsEl.textContent = `Failed to load next task: ${response.error}`;
            }
        } else {
            titleEl.textContent = "All Tasks Complete!";
            detailsEl.innerHTML = "<p>You've processed all the files. Great job!</p>";
            dynamicUIContainerEl.innerHTML = '';
            nextButton.disabled = true;
            undoButton.disabled = true;
        }
    }

    // --- EVENT LISTENERS ---
    nextButton.addEventListener('click', async () => {
        if (!currentItem) return;

        previousItemState = JSON.parse(JSON.stringify(currentItem));

        const updatedItem = readUIData();
        currentItem = updatedItem;

        const response = await window.electron.ipcRenderer.invoke('save-and-get-next-spell', {
            taskData,
            currentSpell: currentItem,
            taskFilePath: currentTaskPath
        });

        if (!response.success) {
            titleEl.textContent = "Error";
            detailsEl.textContent = `Failed to save or get next item: ${response.error}`;
            return;
        }

        score++;
        if (score > highScore) {
            highScore = score;
            window.electron.ipcRenderer.send('save-high-score', highScore);
        }

        itemsCompletedInSet++;
        if (itemsCompletedInSet >= 10) {
            itemsCompletedInSet = 0;
            // This is a placeholder for the reward animation/effect
            containerEl.style.boxShadow = '0 0 25px #7289da';
            setTimeout(() => {
                containerEl.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
            }, 600);
        }

        if (response.taskComplete) {
            await handleTaskCompletion();
            return;
        }
        taskData = response.taskData;
        currentItem = response.spell; // The backend still calls it 'spell'
        itemDetails = response.spellDetails;
        totalItemsInCurrentFile = response.spellCount;

        undoButton.disabled = false;
        render();
    });

    undoButton.addEventListener('click', async () => {
        if (!previousItemState) return;

        const response = await window.electron.ipcRenderer.invoke('undo-and-get-previous-spell', {
            taskData,
            previousSpellState: previousItemState,
            taskFilePath: currentTaskPath
        });

        if (!response.success) {
            console.error("Undo failed:", response.error);
            return;
        }

        score--;

        taskData = response.taskData;
        currentItem = response.spell;
        itemDetails = response.spellDetails;
        totalItemsInCurrentFile = response.spellCount;

        previousItemState = null;
        undoButton.disabled = true;

        render();
    });

    // --- INITIAL LOAD ---
    async function initialize() {
        highScore = await window.electron.ipcRenderer.invoke('get-high-score');
        highScoreEl.textContent = highScore;

        const response = await window.electron.ipcRenderer.invoke('get-task-data');
        if (response.success) {
            if (response.taskComplete) {
                await handleTaskCompletion(); // It's async now
                return;
            }
            taskData = response.taskData;
            currentTaskPath = response.taskFilePath;
            currentItem = response.spell;
            itemDetails = response.spellDetails;
            totalItemsInCurrentFile = response.spellCount;

            undoButton.disabled = true;
            render();
        } else {
            titleEl.textContent = "Error";
            detailsEl.textContent = `Failed to load task data: ${response.error}`;
        }
    }

    initialize();
});
