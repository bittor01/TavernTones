document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('nameInput');
  const initiativeInput = document.getElementById('initiativeInput');
  const addButton = document.getElementById('addButton');
  const clearAllButton = document.getElementById('clearAllButton');
  const nextButton = document.getElementById('nextButton');
  const initiativeList = document.getElementById('initiativeList');

  let initiativeOrder = [];
  let currentIndex = -1;

  // Load initiative data from storage on startup
  window.electron.ipcRenderer.invoke('get-initiative-data').then(data => {
    if (data) {
      initiativeOrder = data;
      renderInitiativeList();
    }
  });

  addButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const initiative = parseInt(initiativeInput.value);

    if (name && !isNaN(initiative)) {
      initiativeOrder.push({ name, initiative });
      initiativeOrder.sort((a, b) => b.initiative - a.initiative);
      saveInitiativeData();
      renderInitiativeList();
      nameInput.value = '';
      initiativeInput.value = '';
    }
  });

  // Clear all entries from the initiative list
  clearAllButton.addEventListener('click', () => {
    initiativeOrder = [];
    currentIndex = -1;
    saveInitiativeData();
    renderInitiativeList();
  });

  // Move to the next person in the initiative order
  nextButton.addEventListener('click', () => {
    if (initiativeOrder.length > 0) {
      currentIndex = (currentIndex + 1) % initiativeOrder.length;
      renderInitiativeList();
    }
  });

  // Render the initiative list in the UI
  function renderInitiativeList() {
    initiativeList.innerHTML = '';
    initiativeOrder.forEach((entry, index) => {
      const item = document.createElement('div');
      item.classList.add('initiative-item');
      if (index === currentIndex) {
        item.classList.add('active');
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = entry.name;

      const initiativeSpan = document.createElement('span');
      initiativeSpan.textContent = entry.initiative;

      const saveButton = document.createElement('button');
      saveButton.textContent = 'Save';
      saveButton.addEventListener('click', () => {
        const saveBonus = prompt('Enter save bonus:');
        if (saveBonus) {
            window.electron.ipcRenderer.send('roll-dice', {
                name: entry.name,
                type: 'Save',
                bonus: parseInt(saveBonus)
            });
        }
      });

      const attackButton = document.createElement('button');
      attackButton.textContent = 'Attack';
      attackButton.addEventListener('click', () => {
          const attackBonus = prompt('Enter attack bonus:');
          if (attackBonus) {
              window.electron.ipcRenderer.send('roll-dice', {
                  name: entry.name,
                  type: 'Attack',
                  bonus: parseInt(attackBonus)
              });
          }
      });

      item.appendChild(nameSpan);
      item.appendChild(initiativeSpan);
      item.appendChild(saveButton);
      item.appendChild(attackButton);

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(entry, index);
      });

      initiativeList.appendChild(item);
    });
  }

  // Show a context menu for editing or removing an entry
  function showContextMenu(entry, index) {
    const menu = document.createElement('div');
    menu.classList.add('context-menu');
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;

    const editButton = document.createElement('button');
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => {
      const newName = prompt('Enter new name:', entry.name);
      const newInitiative = prompt('Enter new initiative:', entry.initiative);
      if (newName && newInitiative) {
        initiativeOrder[index] = { name: newName, initiative: parseInt(newInitiative) };
        initiativeOrder.sort((a, b) => b.initiative - a.initiative);
        saveInitiativeData();
        renderInitiativeList();
      }
      document.body.removeChild(menu);
    });

    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
      initiativeOrder.splice(index, 1);
      if (currentIndex >= index) {
        currentIndex--;
      }
      saveInitiativeData();
      renderInitiativeList();
      document.body.removeChild(menu);
    });

    menu.appendChild(editButton);
    menu.appendChild(removeButton);
    document.body.appendChild(menu);

    const clickOutsideListener = (e) => {
      if (!menu.contains(e.target)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', clickOutsideListener);
      }
    };
    document.addEventListener('click', clickOutsideListener);
  }

  function saveInitiativeData() {
    window.electron.ipcRenderer.send('save-initiative-data', initiativeOrder);
  }
});
