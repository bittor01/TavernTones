require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
console.log('Main.js script started');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
console.log('Electron loaded.');
const fs = require('fs');
const path = require('path');
console.log('FS and Path loaded.');
const { PassThrough, Readable } = require('stream'); // Updated stream import
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
console.log('DiceRoller loaded.');
const { Client, GatewayIntentBits } = require('discord.js');
console.log('Discord.js Client loaded.');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
console.log('Discord.js Voice loaded.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });
console.log('Discord client instantiated.');
const axios = require('axios');
console.log('Axios loaded.');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Use the token from environment variables
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const BOT_ROLE_ID = process.env.BOT_ROLE_ID;
const DEFAULT_LOCAL_FOLDER = process.env.DEFAULT_LOCAL_FOLDER;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;
let connection;
let lastResponse = null; // Variable to store the last response
//adding a comment so i can flipping commit this

// --- State Management ---
let initiativeOrder = [];
let currentTurnIndex = 0;
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');

function saveState() {
    try {
        const state = {
            initiativeOrder,
            currentTurnIndex
        };
        logToRenderer(`saveState: Writing ${initiativeOrder.length} creatures to autosave.json.`);
        fs.writeFileSync(autosavePath, JSON.stringify(state, null, 2));
        logToRenderer('Encounter state autosaved.');
    } catch (error) {
        logToRenderer(`Error autosaving state: ${error.message}`);
    }
}

function loadState() {
    try {
        if (fs.existsSync(autosavePath)) {
            const savedState = JSON.parse(fs.readFileSync(autosavePath, 'utf8'));
            initiativeOrder = savedState.initiativeOrder || [];
            currentTurnIndex = savedState.currentTurnIndex || 0;
            logToRenderer('Autosaved encounter state loaded.');
        }
    } catch (error) {
        logToRenderer(`Error loading state: ${error.message}`);
        initiativeOrder = [];
        currentTurnIndex = 0;
    }
}

class AudioState {
    constructor() {
        this.activeFile = null;
        this.pendingFile = null;
        this.playerStatus = AudioPlayerStatus.Idle;
        this.isCaching = false;
    }
}

const audioState = new AudioState();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Begin UI
// Electron Setup
let mainWindow;
async function createWindow() {
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
        show: false, // Do not show the window until it's ready and maximized
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });
    mainWindow.maximize();
    mainWindow.show();
    console.log('Window created and shown.');
    await mainWindow.loadFile('index.html');
    console.log('index.html loaded.');
}

async function apploader() {
    await app.whenReady().then(() => {
        console.log('App is ready.');
        createWindow();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length == 0) createWindow();
        });
    });
}

apploader();

// --- Core App Functions ---

// Function to send log messages to the renderer
function logToRenderer(message) {
    if (mainWindow) {
        mainWindow.webContents.send('log-message', message);
    }
}

// Function to send initiative updates to the renderer
function sendInitiativeUpdate() {
    if (mainWindow) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
    }
}

// --- Load initial state and send to UI ---
loadState();
// Small delay to ensure window is ready before sending initial update
setTimeout(() => {
    if (mainWindow) {
        sendInitiativeUpdate();
    }
}, 500);


// --- IPC Handlers for UI and Core App Logic ---

ipcMain.handle('get-conditions', () => {
    try {
        const conditionsData = fs.readFileSync(path.join(__dirname, 'conditions.json'), 'utf8');
        return JSON.parse(conditionsData);
    } catch (error) {
        logToRenderer(`Error loading conditions.json: ${error.message}`);
        return {};
    }
});

ipcMain.on('edit-creature', (event, { creatureId }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        mainWindow.webContents.send('populate-creature-form', creature);
    }
});

ipcMain.on('save-encounter', async () => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Encounter',
            defaultPath: 'encounter.json',
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (filePath) {
            const state = { initiativeOrder, currentTurnIndex };
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            logToRenderer(`Encounter saved to ${filePath}`);
        }
    } catch (error) {
        logToRenderer(`Error saving encounter: ${error.message}`);
    }
});

ipcMain.on('load-encounter', async () => {
    try {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Encounter',
            properties: ['openFile'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (filePaths && filePaths.length > 0) {
            const savedState = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
            initiativeOrder = savedState.initiativeOrder || [];
            currentTurnIndex = savedState.currentTurnIndex || 0;
            logToRenderer(`Encounter loaded from ${filePaths[0]}`);
            saveState();
            sendInitiativeUpdate();
        }
    } catch (error) {
        logToRenderer(`Error loading encounter: ${error.message}`);
    }
});

ipcMain.on('add-creature', (event, creature) => {
    const initiativeInput = creature.initiative.toString();
    if (initiativeInput.startsWith('+') || initiativeInput.startsWith('-')) {
        const modifier = parseInt(initiativeInput, 10);
        const roll = new DiceRoller().roll('1d20').total;
        creature.initiative = roll + modifier;
        const message = `${creature.name} rolled initiative: ${roll} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)} = ${creature.initiative}`;
        logToRenderer(message);
        mainWindow.webContents.send('dice-log', message);
    } else {
        creature.initiative = parseFloat(initiativeInput) || 0;
    }
    creature.maxHp = creature.hp;
    creature.tempHp = 0;
    initiativeOrder.push(creature);
    initiativeOrder.sort((a, b) => b.initiative - a.initiative);
    sendInitiativeUpdate();
    saveState();
});

ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        creature.reminders = reminders;
        saveState();
    }
});

ipcMain.on('move-creature-to-bottom', (event, { creatureId }) => {
    const index = initiativeOrder.findIndex(c => c.id === creatureId);
    if (index > -1) {
        const [creature] = initiativeOrder.splice(index, 1);
        initiativeOrder.push(creature);
        if (index < currentTurnIndex) {
            currentTurnIndex--;
        }
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('remove-creature', (event, { creatureId }) => {
    logToRenderer(`ipc: remove-creature received for id: ${creatureId}`);
    logToRenderer(`State before removal: ${initiativeOrder.length} creatures.`);
    const index = initiativeOrder.findIndex(c => c.id === creatureId);
    logToRenderer(`Found creature at index: ${index}`);
    if (index > -1) {
        initiativeOrder.splice(index, 1);
        logToRenderer(`State after removal: ${initiativeOrder.length} creatures.`);
        if (index < currentTurnIndex) {
            currentTurnIndex--;
        } else if (index === currentTurnIndex && currentTurnIndex === initiativeOrder.length) {
            currentTurnIndex = 0;
        }
        if (currentTurnIndex >= initiativeOrder.length) {
            currentTurnIndex = 0;
        }
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('next-turn', () => {
    if (initiativeOrder.length > 0) {
        const endingTurnCreature = initiativeOrder[currentTurnIndex];
        if (endingTurnCreature && endingTurnCreature.reminders && endingTurnCreature.reminders.end) {
            dialog.showMessageBox(mainWindow, { title: `End of Turn: ${endingTurnCreature.name}`, message: endingTurnCreature.reminders.end });
        }
        currentTurnIndex = (currentTurnIndex + 1) % initiativeOrder.length;
        const startingTurnCreature = initiativeOrder[currentTurnIndex];
        if (startingTurnCreature && startingTurnCreature.reminders && startingTurnCreature.reminders.start) {
            dialog.showMessageBox(mainWindow, { title: `Start of Turn: ${startingTurnCreature.name}`, message: startingTurnCreature.reminders.start });
        }
        if (endingTurnCreature && endingTurnCreature.isFriendly) {
            dialog.showMessageBox(mainWindow, { type: 'question', title: 'Legendary Action', message: `End of ${endingTurnCreature.name}'s turn. Do you take a legendary action?`, buttons: ['Yes', 'No']});
        }
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (!creature) return;
    let modifier = 0;
    if (type === 'check') {
        const score = creature.scores ? (creature.scores[stat] || 10) : 10;
        modifier = Math.floor((score - 10) / 2);
    } else {
        modifier = creature.saves ? (parseInt(creature.saves[stat], 10) || 0) : 0;
    }
    let rollNotation = '1d20';
    if (rollType === 'adv') rollNotation = '2d20kh1';
    if (rollType === 'dis') rollNotation = '2d20kl1';
    const roll = new DiceRoller().roll(rollNotation);
    const total = roll.total + modifier;
    const rollDetails = roll.rolls[0].rolls.map(r => r.value).join(', ');
    const message = `${creature.name} rolled a ${stat.toUpperCase()} ${type} (${rollType})\nResult: ${total} ([${rollDetails}] + ${modifier})`;
    logToRenderer(message);
    mainWindow.webContents.send('dice-log', message);
    const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
    if (channel) {
        channel.send(message);
    }
});

ipcMain.on('previous-turn', () => {
    if (initiativeOrder.length > 0) {
        currentTurnIndex = (currentTurnIndex - 1 + initiativeOrder.length) % initiativeOrder.length;
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('update-temp-hp', (event, { creatureId, amount }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        creature.tempHp = Math.max(creature.tempHp, amount);
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('update-hp', (event, { creatureId, amount }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        if (amount > 0) {
            creature.hp += amount;
        } else {
            const damage = Math.abs(amount);
            const tempHpDamage = Math.min(damage, creature.tempHp);
            creature.tempHp -= tempHpDamage;
            const remainingDamage = damage - tempHpDamage;
            creature.hp -= remainingDamage;
            if (creature.isConcentrating && remainingDamage > 0) {
                const dc = Math.max(10, Math.floor(remainingDamage / 2));
                dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${creature.name} must make a DC ${dc} Constitution saving throw.`, buttons: ['OK']});
            }
        }
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('add-condition', (event, { creatureId, condition }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        if (!creature.conditions) creature.conditions = [];
        if (!creature.conditions.includes(condition)) {
            creature.conditions.push(condition);
            sendInitiativeUpdate();
            saveState();
        }
    }
});

ipcMain.on('remove-condition', (event, { creatureId, condition }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature && creature.conditions) {
        creature.conditions = creature.conditions.filter(c => c !== condition);
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('clear-encounter', async (event) => {
    logToRenderer('ipc: clear-encounter received.');
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save and Clear', 'Clear Without Saving', 'Cancel'],
        defaultId: 0,
        title: 'Clear Encounter',
        message: 'Do you want to save the current encounter before clearing it?'
    });

    logToRenderer(`Clear dialog response: ${result.response}`);

    if (result.response === 0) { // Save and Clear
        logToRenderer('Clear: User chose to save.');
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Encounter',
            defaultPath: 'encounter.json',
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (filePath) {
            const state = { initiativeOrder, currentTurnIndex };
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            logToRenderer(`Encounter saved to ${filePath}`);
        } else {
            logToRenderer('Clear: Save dialog cancelled. Aborting clear.');
            return; // User cancelled save dialog
        }
    } else if (result.response === 2) { // Cancel
        logToRenderer('Clear: User cancelled.');
        return;
    }

    logToRenderer(`State before clear: ${initiativeOrder.length} creatures.`);
    initiativeOrder = [];
    currentTurnIndex = 0;
    logToRenderer(`State after clear: ${initiativeOrder.length} creatures.`);
    sendInitiativeUpdate();
    saveState();
});

ipcMain.on('reset-encounter', (event) => {
    initiativeOrder.forEach(creature => {
        creature.hp = creature.maxHp;
        creature.tempHp = 0;
        creature.conditions = [];
    });
    currentTurnIndex = 0;
    initiativeOrder.sort((a, b) => b.initiative - a.initiative);
    sendInitiativeUpdate();
    saveState();
});

ipcMain.on('update-initiative-value', (event, { creatureId, value }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        creature.initiative = parseFloat(value);
        initiativeOrder.sort((a, b) => b.initiative - a.initiative);
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
    const creature = initiativeOrder.find(c => c.id === creatureId);
    if (creature) {
        creature[flag] = value;
        sendInitiativeUpdate();
        saveState();
    }
});

ipcMain.on('roll-dice', (event, { name, type, bonus }) => {
    const roller = new DiceRoller();
    const roll = roller.roll('1d20').total;
    const result = roll + bonus;
    const message = `${name} ${type}: ${result} (${roll} + ${bonus})`;
    mainWindow.webContents.send('log-message', message);
    mainWindow.webContents.send('dice-log', message);
});


// --- Music and Discord Bot ---
client.once('ready', async () => {
    logToRenderer('TavernTones is online!');
    logToRenderer(`Logged in as ${client.user.tag}`);

    const voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });
            connection.on(VoiceConnectionStatus.Ready, () => logToRenderer('The bot has connected to the channel!'));
            connection.on(VoiceConnectionStatus.Disconnected, () => logToRenderer('The bot has been disconnected.'));
            await entersState(connection, VoiceConnectionStatus.Ready, 60000);
            logToRenderer('Connection is ready!');
        } catch (error) {
            logToRenderer('Error joining voice channel: ' + error);
        }
    } else {
        logToRenderer('Voice channel not found or is not a voice based channel!');
    }

    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (message.mentions.has(client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
           // Discord command handling logic here...
        }
    });

    const player = createAudioPlayer();
    if(connection) {
        connection.subscribe(player);
    }

    // ... Player event listeners ...

    ipcMain.on('play-music', () => {
        // ...
    });

    ipcMain.on('pause-music', () => {
        // ...
    });

    ipcMain.handle('open-file-dialog', async () => {
        // ...
    });

});

client.login(DISCORD_TOKEN);

let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
const startingMemUse = memoryUsage;
setInterval(() => {
    memoryUsage = process.memoryUsage().rss;
    logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
}, 60000);

function getValidTableFolders() {
    const randomTablesPath = path.join(__dirname, 'randomtables');
    try {
        const allEntries = fs.readdirSync(randomTablesPath, { withFileTypes: true });
        const directories = allEntries
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        return directories;
    } catch (error) {
        logToRenderer(`Error reading '${randomTablesPath}': ${error.message}`);
        // If the directory doesn't exist or there's another error, return an empty array.
        return [];
    }
}

async function rollFromTable(folderName, tablesConfig, channelId) {
    const encounterTablesFolder = path.join(__dirname, 'randomtables', folderName);

    // 1. Path Generation (done implicitly in step 2)
    // 2. File Existence Check
    const missingTables = [];
    for (const entry of tablesConfig) {
        const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
        if (!fs.existsSync(filePath)) {
            missingTables.push(entry.tableName);
        }
    }

    if (missingTables.length > 0) {
        return { success: false, message: `Missing tables: ${missingTables.join(', ')}` };
    }

    // 3. Table Loading
    const tables = tablesConfig.map(entry => {
        const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
        // It's good practice to handle potential errors during file reading and JSON parsing
        try {
            const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return { ...entry, data: tableData, filePath: filePath }; // Store filePath for later use
        } catch (error) {
            // Log the error and potentially return a specific error for this table
            logToRenderer(`Error loading table ${entry.tableName}: ${error.message}`);
            // Depending on desired strictness, you could either throw here or mark this table as invalid
            return { ...entry, data: null, filePath: filePath, error: true }; 
        }
    });

    // Filter out tables that failed to load, if any
    const validTables = tables.filter(table => !table.error && table.data);
    if (validTables.length !== tablesConfig.length) {
        // This means some tables had read/parse errors
        const erroredTableNames = tables.filter(t => t.error).map(t => t.tableName).join(', ');
        return { success: false, message: `Error loading or parsing tables: ${erroredTableNames}`};
    }


    // 4. Weighted Selection (Table)
    const totalWeight = validTables.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) {
        return { success: false, message: "Total weight of tables must be positive." };
    }

    const roller = new DiceRoller(); // Assuming DiceRoller is available
    const tableRoll = roller.roll(`1d${totalWeight}`).total;
    let cumulativeWeight = 0;
    let selectedTableEntry = null;

    for (const entry of validTables) {
        cumulativeWeight += entry.weight;
        if (tableRoll <= cumulativeWeight) {
            selectedTableEntry = entry;
            break;
        }
    }

    if (!selectedTableEntry) {
        // This should ideally not happen if totalWeight > 0 and tables exist
        logToRenderer(`Error selecting table. Roll: ${tableRoll}, TotalWeight: ${totalWeight}, Tables: ${JSON.stringify(validTables.map(t=>({tn:t.tableName, w:t.weight})))}`);
        return { success: false, message: "Error selecting table." };
    }

    // 5. Effect Selection (from Table)
    // The selectedTableEntry.data should be the array of effects
    if (!Array.isArray(selectedTableEntry.data)) {
        logToRenderer(`Selected table ${selectedTableEntry.tableName} does not contain an array of effects.`);
        return { success: false, message: `Data format error in table ${selectedTableEntry.tableName}.` };
    }
    
    const availableEffects = selectedTableEntry.data.filter(effect => {
        return !effect.unique || !Array.isArray(effect.used) || !effect.used.includes(channelId);
    });

    if (availableEffects.length === 0) {
        return { success: false, message: `No available effects in the selected table: ${selectedTableEntry.tableName}.` };
    }

    const effect = availableEffects[Math.floor(Math.random() * availableEffects.length)];

    // 6. Handle Unique Effects
    if (effect.unique) {
        if (!Array.isArray(effect.used)) {
            effect.used = [];
        }
        effect.used.push(channelId);

        // Update the original table data array
        const effectIndexInOriginalTable = selectedTableEntry.data.findIndex(e => e.text === effect.text); // Assuming text is a unique identifier within a table
        if (effectIndexInOriginalTable !== -1) {
            selectedTableEntry.data[effectIndexInOriginalTable] = effect; // Update the effect in the loaded table data
            try {
                fs.writeFileSync(selectedTableEntry.filePath, JSON.stringify(selectedTableEntry.data, null, 2), 'utf8');
                logToRenderer(`Updated unique effect usage in ${selectedTableEntry.filePath}`);
            } catch (error) {
                logToRenderer(`Error writing updated table ${selectedTableEntry.filePath}: ${error.message}`);
                // Decide if this is a critical failure. For now, proceed with returning the effect.
                // Could return a partial success or a specific error:
                // return { success: false, message: `Failed to save unique effect update for ${selectedTableEntry.tableName}. Effect was still rolled.` };
            }
        } else {
            logToRenderer(`Could not find effect in original table data to update 'used' status. This is unexpected. Effect: ${effect.text}`);
        }
    }

    // 7. Return Value
    return { success: true, text: effect.text };
}

// Function to get a random effect from a table, filtering out used unique effects for the user
function getRandomEffect(table, userId) {
    const availableEffects = table.filter(effect => !effect.unique || !effect.used.includes(userId));
    if (availableEffects.length === 0) {
        return null; // No available effects
    }
    const randomIndex = Math.floor(Math.random() * availableEffects.length);
    return availableEffects[randomIndex];
}

function evaluateDiceRolls(text, diceLimit = 24000) {
    const roller = new DiceRoller();

    while (text.includes("[[")) {
        text = text.replace(/\[\[([^\[\]]+)\]\]/g, (match, diceExpression) => {
            const roll = roller.roll(diceExpression);
            let result = roll.total;

            // Cap the result at diceLimit if exceeded
            if (result > diceLimit) {
                result = diceLimit;
            }

            return result;
        });
    }

    return text;
}

async function askGPT4All(prompt, model) {
    let chatmodel = 'Meta-Llama-3-8B-Instruct.Q4_0.gguf'; // Default to ll model
    if (model === 're') {
        chatmodel = 'qwen2.5-coder-7b-instruct-q4_0.gguf';
    }

    // Sanitize the prompt to prevent command injection
    const sanitizedPrompt = prompt.replace(/"/g, '\\"');
    const tailPrompt = ' - Thanks for the help!'
    const sanitizedPromptTail = sanitizedPrompt + tailPrompt;
    try {
        const response = await axios.post('http://localhost:4891/v1/chat/completions', {
            "model": chatmodel,
            "messages": [{"role":"user","content":sanitizedPromptTail}],
            "max_tokens": 8000
        });


        // Log the entire response to inspect its structure
        logToRenderer(`Response length: ${response.data.choices[0].message.content.length} characters`);

        if (response.data && response.data.choices && response.data.choices[0].message.content) {
            let reply = response.data.choices[0].message.content.trim();

            // Append references to the reply
            if (response.data.choices[0].references && response.data.choices[0].references.length > 0) {
                //logToRenderer(JSON.stringify(response.data.choices[0].references));
                reply += `\n\n${response.data.choices[0].references.length} Sources:`;
                let refList = '';
                for (const ref of response.data.choices[0].references) {
                    if (!refList.includes(ref.file.toString().trim())) {
                        refList += `\n${ref.file.toString()}`;
                    }
                }
                reply += refList;
            }
            else {
                reply += `\n\nSource: ***My butt*** (tell Crisp the RAG isn't working)`;
            }

            // Save the last response
            lastResponse = response.data;

            return reply;

        } else {
            throw new Error('Invalid response from GPT-4All server');
        }
    } catch (error) {
        logToRenderer(`Error: ${error.message}`);
        throw new Error(`An error occurred while running the query: ${error.message}`);
    }
}

// Add this function somewhere in main.js, for example, near other helper functions.
// Ensure fs, path, DEFAULT_LOCAL_FOLDER, and logToRenderer are accessible.
async function findMusic(folderSearchTerm, songSearchTerm) {
    logToRenderer(`findMusic: Initiating search with folderSearchTerm='${folderSearchTerm}', songSearchTerm='${songSearchTerm}'.`);

    let targetFolderToSearch;
    // Determine the folder name to search for. Default to "chill" if no folder term is provided.
    if (!folderSearchTerm || folderSearchTerm.trim() === "") {
        targetFolderToSearch = "chill";
        logToRenderer(`findMusic: folderSearchTerm is empty or null. Using default 'chill' folder.`);
    } else {
        targetFolderToSearch = folderSearchTerm;
    }

    let actualFolderPath = null;
    let foundFolderOriginalName = null;

    // Phase 1: Find the folder
    try {
        // Check if DEFAULT_LOCAL_FOLDER is accessible
        // DEFAULT_LOCAL_FOLDER should be available from process.env
        if (!DEFAULT_LOCAL_FOLDER || !fs.existsSync(DEFAULT_LOCAL_FOLDER)) {
            logToRenderer(`findMusic: Error - DEFAULT_LOCAL_FOLDER ('${DEFAULT_LOCAL_FOLDER}') is not defined or does not exist.`);
            return null;
        }

        // Get all directory names from DEFAULT_LOCAL_FOLDER
        const allEntities = fs.readdirSync(DEFAULT_LOCAL_FOLDER, { withFileTypes: true });
        const subDirectories = allEntities.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

        if (subDirectories.length === 0) {
            logToRenderer(`findMusic: No sub-folders found within DEFAULT_LOCAL_FOLDER ('${DEFAULT_LOCAL_FOLDER}').`);
            return null;
        }

        // Attempt to match the targetFolderToSearch with a directory name (substring match, case-insensitive)
        const targetFolderLower = targetFolderToSearch.toLowerCase();
        for (const dirName of subDirectories) {
            if (dirName.toLowerCase().includes(targetFolderLower)) {
                actualFolderPath = path.join(DEFAULT_LOCAL_FOLDER, dirName);
                foundFolderOriginalName = dirName; // Store the actual name of the matched folder
                logToRenderer(`findMusic: Successfully matched folder: name='${foundFolderOriginalName}', path='${actualFolderPath}'.`);
                break; // Use the first match
            }
        }

        if (!actualFolderPath) {
            logToRenderer(`findMusic: No folder found containing '${targetFolderToSearch}' within '${DEFAULT_LOCAL_FOLDER}'.`);
            return null; // Folder not found
        }

    } catch (error) {
        logToRenderer(`findMusic: Exception while accessing or reading DEFAULT_LOCAL_FOLDER ('${DEFAULT_LOCAL_FOLDER}'): ${error.message}`);
        return null;
    }

    // Phase 2: Find the song within the identified folder
    try {
        const filesInFolder = fs.readdirSync(actualFolderPath);
        // Filter for .mp3 and .wav files
        const audioFiles = filesInFolder.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ext === '.wav' || ext === '.lnk';
        });

        if (audioFiles.length === 0) {
            logToRenderer(`findMusic: No audio files (.wav) found in the folder '${foundFolderOriginalName}'.`);
            return null;
        }

        let songFilePath = null;

        // If a songSearchTerm is provided, try to find a matching song
        if (songSearchTerm && songSearchTerm.trim() !== "") {
            const songSearchLower = songSearchTerm.toLowerCase();
            for (const fileName of audioFiles) {
                const songNameWithoutExt = path.parse(fileName).name; // Get filename without extension
                if (songNameWithoutExt.toLowerCase().includes(songSearchLower)) {
                    songFilePath = path.join(actualFolderPath, fileName);
                    logToRenderer(`findMusic: Successfully matched song: '${fileName}' in folder '${foundFolderOriginalName}'. Full path: '${songFilePath}'.`);
                    break; // Use the first match
                }
            }
            if (!songFilePath) {
                logToRenderer(`findMusic: No song found containing '${songSearchTerm}' in folder '${foundFolderOriginalName}'.`);
                return null; // Specific song not found
            }
        } else {
            // No songSearchTerm provided, so pick a random song from the folder
            const randomIndex = Math.floor(Math.random() * audioFiles.length);
            const randomSongName = audioFiles[randomIndex];
            songFilePath = path.join(actualFolderPath, randomSongName);
            logToRenderer(`findMusic: No songSearchTerm provided. Selected random song: '${randomSongName}' from folder '${foundFolderOriginalName}'. Full path: '${songFilePath}'.`);
        }
        
        return songFilePath; // Return the full path to the song, or null if errors occurred

    } catch (error) {
        logToRenderer(`findMusic: Exception while reading files from folder '${foundFolderOriginalName}' (path: '${actualFolderPath}'): ${error.message}`);
        return null;
    }
}