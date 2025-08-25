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

// --- Initialization State ---
let isDiscordReady = false;
let isWindowReady = false;

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
        fs.writeFileSync(autosavePath, JSON.stringify(state, null, 2));
        logToRenderer(`Encounter state autosaved with ${initiativeOrder.length} creatures.`);
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

// --- Helper Functions ---
function getValidTableFolders() {
    const randomTablesPath = path.join(__dirname, 'randomtables');
    try {
        const allEntries = fs.readdirSync(randomTablesPath, { withFileTypes: true });
        return allEntries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    } catch (error) {
        logToRenderer(`Error reading '${randomTablesPath}': ${error.message}`);
        return [];
    }
}

async function rollFromTable(folderName, tablesConfig, channelId) {
    // ... (implementation remains the same)
}

function getRandomEffect(table, userId) {
    // ... (implementation remains the same)
}

function evaluateDiceRolls(text, diceLimit = 24000) {
    // ... (implementation remains the same)
}

async function askGPT4All(prompt, model) {
    // ... (implementation remains the same)
}

async function findMusic(folderSearchTerm, songSearchTerm) {
    // ... (implementation remains the same)
}

// --- Globals ---
let mainWindow;

// --- Soundboard Backend ---
const SOUNDBOARD_SIZE = 10; // As per renderer.js
let soundboardSlots = Array.from({ length: SOUNDBOARD_SIZE }, (_, i) => ({ id: i, file: null, emoji: '➕', loop: false }));
const activeSoundboardPlayers = new Map();
let soundboardVolume = 0.5;

// --- Music System ---
const player = createAudioPlayer();

player.on('error', (error) => {
    logToRenderer(`Player Error: ${error.message}`);
    audioState.activeFile = null;
    audioState.playerStatus = AudioPlayerStatus.Idle;
    sendGuiUpdate();
});

player.on(AudioPlayerStatus.Idle, () => {
    audioState.playerStatus = AudioPlayerStatus.Idle;
    if (audioState.activeFile) {
        logToRenderer(`Looping: ${audioState.activeFile}`);
        try {
            const resource = createAudioResource(fs.createReadStream(audioState.activeFile));
            player.play(resource);
        } catch (error) {
            logToRenderer(`Error creating resource for loop: ${error}`);
            audioState.activeFile = null;
            sendGuiUpdate();
        }
    } else {
        sendGuiUpdate();
    }
});

player.on(AudioPlayerStatus.Playing, () => {
    audioState.playerStatus = AudioPlayerStatus.Playing;
    sendGuiUpdate();
});

player.on(AudioPlayerStatus.Paused, () => {
    audioState.playerStatus = AudioPlayerStatus.Paused;
    sendGuiUpdate();
});

// --- Core App Functions ---

async function createWindow() {
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        }
    });
    mainWindow.maximize();
    mainWindow.show();
    console.log('Window created and shown.');
    await mainWindow.loadFile('index.html');
    console.log('index.html loaded.');
    // The 'window-ready' event from renderer will now trigger the final setup.
}

function runFinalSetup() {
    // This function is the gate. It only runs when both flags are true.
    if (isDiscordReady && isWindowReady) {
        console.log('>>> Both Discord and Window are ready. Running final setup. <<<');

        if (connection) {
            connection.subscribe(player);
        }

        registerIpcHandlers();
        loadState();
        sendInitiativeUpdate();
        sendGuiUpdate();
        logToRenderer('Final setup complete. Application is fully operational.');
    } else {
        console.log(`Setup check: Discord Ready? ${isDiscordReady}, Window Ready? ${isWindowReady}`);
    }
}

// --- IPC Handlers Registration ---
function registerIpcHandlers() {
    console.log("Registering all IPC Handlers...");

    ipcMain.on('window-ready', () => {
        console.log('IPC: Window is ready.');
        if (!isWindowReady) {
            isWindowReady = true;
            runFinalSetup();
        }
    });

    // --- System & State ---
    ipcMain.on('exit-app', () => app.quit());

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

    ipcMain.on('clear-encounter', async () => {
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Confirm Clear',
            message: 'Are you sure you want to clear the entire encounter?',
            detail: 'You may want to save the encounter first.',
            buttons: ['Clear Encounter', 'Cancel'],
            defaultId: 1,
            cancelId: 1
        });
        if (result.response === 0) {
            initiativeOrder = [];
            currentTurnIndex = 0;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('reset-encounter', () => {
        initiativeOrder.forEach(c => {
            c.hp = c.maxHp;
            c.tempHp = 0;
            c.conditions = [];
        });
        currentTurnIndex = 0;
        sendInitiativeUpdate();
        saveState();
    });

    // --- Initiative Tracker ---
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
        initiativeOrder.push(creature);
        initiativeOrder.sort((a, b) => b.initiative - a.initiative);
        sendInitiativeUpdate();
        saveState();
    });

    ipcMain.on('edit-creature', (event, { creatureId }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            mainWindow.webContents.send('populate-edit-form', creature);
            initiativeOrder = initiativeOrder.filter(c => c.id !== creatureId);
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('copy-creature', (event, { creatureId }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            mainWindow.webContents.send('populate-edit-form', creature);
        }
    });

    ipcMain.on('remove-creature', (event, { creatureId }) => {
        initiativeOrder = initiativeOrder.filter(c => c.id !== creatureId);
        sendInitiativeUpdate();
        saveState();
    });

    ipcMain.on('update-initiative', (event, { creatureId, initiative }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.initiative = parseFloat(initiative) || 0;
            initiativeOrder.sort((a, b) => b.initiative - a.initiative);
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
            sendInitiativeUpdate();
            saveState();

            const startingTurnCreature = initiativeOrder[currentTurnIndex];
            if (startingTurnCreature && startingTurnCreature.reminders && startingTurnCreature.reminders.start) {
                dialog.showMessageBox(mainWindow, { title: `Start of Turn: ${startingTurnCreature.name}`, message: startingTurnCreature.reminders.start });
            }
            if (endingTurnCreature?.isFriendly) {
                dialog.showMessageBox(mainWindow, { type: 'question', title: 'Legendary Action Reminder', message: `End of ${endingTurnCreature.name}'s turn. Do you take a legendary action?`, buttons: ['Yes', 'No'] });
            }
        }
    });

    ipcMain.on('previous-turn', () => {
        if (initiativeOrder.length > 0) {
            currentTurnIndex = (currentTurnIndex - 1 + initiativeOrder.length) % initiativeOrder.length;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('move-creature-bottom', (event, { creatureId }) => {
        const creatureIndex = initiativeOrder.findIndex(c => c.id === creatureId);
        if (creatureIndex > -1) {
            const [creature] = initiativeOrder.splice(creatureIndex, 1);
            creature.initiative = (initiativeOrder.length > 0 ? initiativeOrder[initiativeOrder.length - 1].initiative : 0) - 1;
            initiativeOrder.push(creature);
            sendInitiativeUpdate();
            saveState();
        }
    });

    // --- Creature Details ---
    ipcMain.on('update-hp', (event, { creatureId, amount }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (!creature) return;

        if (amount < 0) { // Damage
            let damage = -amount;
            const tempHpDamage = Math.min(creature.tempHp || 0, damage);
            creature.tempHp -= tempHpDamage;
            damage -= tempHpDamage;
            creature.hp -= damage;

            if (creature.isConcentrating) {
                const dc = Math.max(10, Math.floor(-amount / 2));
                dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${creature.name} must make a DC ${dc} Constitution saving throw.`, buttons: ['OK'] });
            }
        } else { // Healing
            creature.hp += amount;
        }
        sendInitiativeUpdate();
        saveState();
    });

    ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.tempHp = (creature.tempHp || 0) + amount;
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
            }
            sendInitiativeUpdate();
            saveState();
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

    ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature[flag] = value;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.reminders = reminders;
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
        } else { // 'save'
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

    // --- Music Player ---
    ipcMain.on('play-music', () => {
        if (audioState.isCaching) return;
        if (audioState.playerStatus === AudioPlayerStatus.Paused) {
            player.unpause();
        } else if (audioState.playerStatus === AudioPlayerStatus.Idle && audioState.activeFile) {
            try {
                const resource = createAudioResource(fs.createReadStream(audioState.activeFile));
                player.play(resource);
            } catch (error) {
                logToRenderer(`Error creating resource for play: ${error}`);
                audioState.activeFile = null;
                sendGuiUpdate();
            }
        }
    });

    ipcMain.on('pause-music', () => {
        if (audioState.playerStatus === AudioPlayerStatus.Playing) {
            player.pause();
        }
    });

    ipcMain.handle('open-file-dialog', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            defaultPath: DEFAULT_LOCAL_FOLDER,
            filters: [
                { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'lnk'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) return null;
        let resolvedPath = result.filePaths[0];

        if (path.extname(resolvedPath).toLowerCase() === '.lnk') {
            try {
                const shortcut = shell.readShortcutLink(resolvedPath);
                if (shortcut.target && fs.existsSync(shortcut.target)) {
                    resolvedPath = shortcut.target;
                } else { return null; }
            } catch (error) { return null; }
        }

        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) return null;

        audioState.pendingFile = resolvedPath;
        audioState.isCaching = true;
        sendGuiUpdate();
        await new Promise(resolve => setTimeout(resolve, 100));
        audioState.isCaching = false;
        player.stop();
        audioState.activeFile = audioState.pendingFile;
        audioState.pendingFile = null;
        sendGuiUpdate();
        return audioState.activeFile;
    });

    // --- Soundboard ---
    ipcMain.handle('load-sound', async (event, { slotId }) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            defaultPath: DEFAULT_LOCAL_FOLDER,
            filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg'] }]
        });

        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0];
        const emoji = '🔊';
        soundboardSlots[slotId].file = filePath;
        soundboardSlots[slotId].emoji = emoji;
        return { file: filePath, emoji: emoji };
    });

    ipcMain.on('play-sound', async (event, { slotId }) => {
        const slot = soundboardSlots[slotId];
        if (!slot || !slot.file) return;

        if (activeSoundboardPlayers.has(slotId)) {
            const { player: soundPlayer, connection: soundConnection } = activeSoundboardPlayers.get(slotId);
            soundPlayer.stop();
            soundConnection.destroy();
            activeSoundboardPlayers.delete(slotId);
        }

        const resource = createAudioResource(fs.createReadStream(slot.file), { inlineVolume: true });
        resource.volume.setVolume(soundboardVolume);
        const soundPlayer = createAudioPlayer();
        const voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) return;

        const soundConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        soundConnection.subscribe(soundPlayer);
        soundPlayer.play(resource);
        activeSoundboardPlayers.set(slotId, { player: soundPlayer, connection: soundConnection, resource });
        mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: true });

        soundPlayer.on(AudioPlayerStatus.Idle, () => {
            if (soundboardSlots[slotId]?.loop) {
                const newResource = createAudioResource(fs.createReadStream(slot.file), { inlineVolume: true });
                newResource.volume.setVolume(soundboardVolume);
                soundPlayer.play(newResource);
            } else {
                soundConnection.destroy();
                activeSoundboardPlayers.delete(slotId);
                mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
            }
        });
    });

    ipcMain.on('stop-sound', (event, { slotId }) => {
        if (activeSoundboardPlayers.has(slotId)) {
            const { player, connection } = activeSoundboardPlayers.get(slotId);
            player.stop();
            connection.destroy();
            activeSoundboardPlayers.delete(slotId);
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
        }
    });

    ipcMain.on('unload-sound', (event, { slotId }) => {
        if (activeSoundboardPlayers.has(slotId)) {
            const { player, connection } = activeSoundboardPlayers.get(slotId);
            player.stop();
            connection.destroy();
            activeSoundboardPlayers.delete(slotId);
        }
        soundboardSlots[slotId] = { id: slotId, file: null, emoji: '➕', loop: false };
        mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false, file: null, emoji: '➕' });
    });

    ipcMain.on('set-loop', (event, { slotId, loop }) => {
        const slot = soundboardSlots[slotId];
        if (slot) slot.loop = loop;
    });

    ipcMain.on('set-soundboard-volume', (event, volume) => {
        soundboardVolume = parseFloat(volume);
        activeSoundboardPlayers.forEach(({ resource }) => {
            if (resource && resource.volume) {
                resource.volume.setVolume(soundboardVolume);
            }
        });
    });

    // --- Misc ---
    ipcMain.handle('get-default-local-folder', () => DEFAULT_LOCAL_FOLDER);
}

// --- Helper Functions ---
function logToRenderer(message) {
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('log-message', message);
    }
}

function sendInitiativeUpdate() {
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
    }
}

function sendGuiUpdate() {
    if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('update-gui-state', {
            isPlaying: audioState.playerStatus === AudioPlayerStatus.Playing,
            isCaching: audioState.isCaching,
            filePath: audioState.activeFile || audioState.pendingFile
        });
    }
}

// ... other helpers like findMusic, rollFromTable, etc.
function getValidTableFolders() {
    const randomTablesPath = path.join(__dirname, 'randomtables');
    try {
        const allEntries = fs.readdirSync(randomTablesPath, { withFileTypes: true });
        return allEntries.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    } catch (error) {
        logToRenderer(`Error reading '${randomTablesPath}': ${error.message}`);
        return [];
    }
}

async function rollFromTable(folderName, tablesConfig, channelId) {
    // ... (implementation remains the same)
}

function getRandomEffect(table, userId) {
    // ... (implementation remains the same)
}

function evaluateDiceRolls(text, diceLimit = 24000) {
    // ... (implementation remains the same)
}

async function askGPT4All(prompt, model) {
    // ... (implementation remains the same)
}

async function findMusic(folderSearchTerm, songSearchTerm) {
    // ... (implementation remains the same)
}


// --- Application Lifecycle ---

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    console.log('Quitting app...');
    if (connection) {
        connection.destroy();
    }
    if (client) {
        client.destroy();
    }
    console.log('Cleanup complete.');
});

app.whenReady().then(() => {
    console.log('App is ready.');
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                logToRenderer('Voice connection is ready!');
                if (!isDiscordReady) {
                    isDiscordReady = true;
                    runFinalSetup();
                }
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                logToRenderer('Voice connection disconnected. Attempting to rejoin...');
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                } catch (error) {
                    logToRenderer('Could not reconnect to voice, destroying connection.');
                    connection.destroy();
                }
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30000);

        } catch (error) {
            logToRenderer(`Error joining voice channel: ${error}`);
            isDiscordReady = true; // Flag as ready so UI doesn't hang forever
            runFinalSetup();
        }
    } else {
        logToRenderer('Voice channel not found or is not a voice channel! Voice features disabled.');
        isDiscordReady = true; // Flag as ready so UI doesn't hang
        runFinalSetup();
    }
});

client.on('messageCreate', async message => {
    try {
        if (message.author.bot) return;
        if (message.mentions.has(client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
            // Command processing logic remains the same
        }
    } catch (error) {
        logToRenderer(`Error in messageCreate: ${error.message}`);
    }
});

client.login(DISCORD_TOKEN);