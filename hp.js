document.addEventListener('DOMContentLoaded', () => {
    const addCreatureButton = document.getElementById('addCreatureButton');
    const clearAllButton = document.getElementById('clearAllButton');
    const creatureList = document.getElementById('creatureList');

    let creatures = [];

  // Load creature data from storage on startup
    window.electron.ipcRenderer.invoke('get-hp-data').then(data => {
        if (data) {
            creatures = data;
            renderCreatureList();
        }
    });

  // Add a new creature to the list
    addCreatureButton.addEventListener('click', () => {
        const name = prompt('Enter creature name:');
        if (name) {
            creatures.push({
                name,
                hp: 10,
                maxHp: 10,
                legendaryActions: 3,
                maxLegendaryActions: 3,
                legendaryResistances: 3,
                maxLegendaryResistances: 3,
                vulnerability: false,
                resistance: false,
            });
            saveHpData();
            renderCreatureList();
        }
    });

  // Clear all creatures from the list
    clearAllButton.addEventListener('click', () => {
        creatures = [];
        saveHpData();
        renderCreatureList();
    });

  // Render the creature list in the UI
    function renderCreatureList() {
        creatureList.innerHTML = '';
        creatures.forEach((creature, index) => {
            const item = document.createElement('div');
            item.classList.add('creature-item');
            if (creature.hp <= creature.maxHp / 2) {
                item.classList.add('bloodied');
            }

            const nameHeader = document.createElement('h3');
            nameHeader.textContent = creature.name;

            const hpContainer = document.createElement('div');
            const hpLabel = document.createElement('span');
            hpLabel.textContent = 'HP: ';
            const hpInput = document.createElement('input');
            hpInput.type = 'number';
            hpInput.value = creature.hp;
            hpInput.addEventListener('change', () => {
                creature.hp = parseInt(hpInput.value);
                saveHpData();
                renderCreatureList();
            });
            hpContainer.appendChild(hpLabel);
            hpContainer.appendChild(hpInput);

            const deltaContainer = document.createElement('div');
            const deltaInput = document.createElement('input');
            deltaInput.type = 'number';
            deltaInput.placeholder = 'Delta';
            const plusButton = document.createElement('button');
            plusButton.textContent = '+';
            plusButton.addEventListener('click', () => {
                creature.hp += parseInt(deltaInput.value || 0);
                saveHpData();
                renderCreatureList();
            });
            const minusButton = document.createElement('button');
            minusButton.textContent = '-';
            minusButton.addEventListener('click', () => {
                creature.hp -= parseInt(deltaInput.value || 0);
                saveHpData();
                renderCreatureList();
            });
            const x2Button = document.createElement('button');
            x2Button.textContent = 'x2';
            x2Button.addEventListener('click', () => {
                deltaInput.value = parseInt(deltaInput.value || 0) * 2;
            });
            const halfButton = document.createElement('button');
            halfButton.textContent = '/2';
            halfButton.addEventListener('click', () => {
                deltaInput.value = Math.floor(parseInt(deltaInput.value || 0) / 2);
            });
            deltaContainer.appendChild(deltaInput);
            deltaContainer.appendChild(plusButton);
            deltaContainer.appendChild(minusButton);
            deltaContainer.appendChild(x2Button);
            deltaContainer.appendChild(halfButton);

            const legendaryActionsContainer = document.createElement('div');
            const laLabel = document.createElement('span');
            laLabel.textContent = 'Legendary Actions: ';
            const laValue = document.createElement('span');
            laValue.textContent = `${creature.legendaryActions}/${creature.maxLegendaryActions}`;
            const useLaButton = document.createElement('button');
            useLaButton.textContent = 'Use';
            useLaButton.addEventListener('click', () => {
                if (creature.legendaryActions > 0) {
                    creature.legendaryActions--;
                    saveHpData();
                    renderCreatureList();
                }
            });
            const resetLaButton = document.createElement('button');
            resetLaButton.textContent = 'Reset';
            resetLaButton.addEventListener('click', () => {
                creature.legendaryActions = creature.maxLegendaryActions;
                saveHpData();
                renderCreatureList();
            });
            legendaryActionsContainer.appendChild(laLabel);
            legendaryActionsContainer.appendChild(laValue);
            legendaryActionsContainer.appendChild(useLaButton);
            legendaryActionsContainer.appendChild(resetLaButton);

            const legendaryResistancesContainer = document.createElement('div');
            const lrLabel = document.createElement('span');
            lrLabel.textContent = 'Legendary Resistances: ';
            const lrValue = document.createElement('span');
            lrValue.textContent = `${creature.legendaryResistances}/${creature.maxLegendaryResistances}`;
            const useLrButton = document.createElement('button');
            useLrButton.textContent = 'Use';
            useLrButton.addEventListener('click', () => {
                if (creature.legendaryResistances > 0) {
                    creature.legendaryResistances--;
                    saveHpData();
                    renderCreatureList();
                }
            });
            const resetLrButton = document.createElement('button');
            resetLrButton.textContent = 'Reset';
            resetLrButton.addEventListener('click', () => {
                creature.legendaryResistances = creature.maxLegendaryResistances;
                saveHpData();
                renderCreatureList();
            });
            legendaryResistancesContainer.appendChild(lrLabel);
            legendaryResistancesContainer.appendChild(lrValue);
            legendaryResistancesContainer.appendChild(useLrButton);
            legendaryResistancesContainer.appendChild(resetLrButton);

            const resistanceContainer = document.createElement('div');
            const resistanceLabel = document.createElement('label');
            resistanceLabel.textContent = 'Resistance';
            const resistanceCheckbox = document.createElement('input');
            resistanceCheckbox.type = 'checkbox';
            resistanceCheckbox.checked = creature.resistance;
            resistanceCheckbox.addEventListener('change', () => {
                creature.resistance = resistanceCheckbox.checked;
                saveHpData();
            });
            resistanceContainer.appendChild(resistanceLabel);
            resistanceContainer.appendChild(resistanceCheckbox);

            const vulnerabilityContainer = document.createElement('div');
            const vulnerabilityLabel = document.createElement('label');
            vulnerabilityLabel.textContent = 'Vulnerability';
            const vulnerabilityCheckbox = document.createElement('input');
            vulnerabilityCheckbox.type = 'checkbox';
            vulnerabilityCheckbox.checked = creature.vulnerability;
            vulnerabilityCheckbox.addEventListener('change', () => {
                creature.vulnerability = vulnerabilityCheckbox.checked;
                saveHpData();
            });
            vulnerabilityContainer.appendChild(vulnerabilityLabel);
            vulnerabilityContainer.appendChild(vulnerabilityCheckbox);

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                creatures.splice(index, 1);
                saveHpData();
                renderCreatureList();
            });

            item.appendChild(nameHeader);
            item.appendChild(hpContainer);
            item.appendChild(deltaContainer);
            item.appendChild(legendaryActionsContainer);
            item.appendChild(legendaryResistancesContainer);
            item.appendChild(resistanceContainer);
            item.appendChild(vulnerabilityContainer);
            item.appendChild(removeButton);

            creatureList.appendChild(item);
        });
    }

    // Save the creature data to storage
    function saveHpData() {
        window.electron.ipcRenderer.send('save-hp-data', creatures);
    }
});
