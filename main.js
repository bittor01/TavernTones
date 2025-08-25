require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
console.log('Main.js script started');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
console.log('Electron loaded.');
const fs = require('fs');
const path = require('path');
console.log('FS and Path loaded.');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
console.log('DiceRoller loaded.');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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
let player;
let connection;
let lastResponse = null; // Variable to store the last response
let isAppReady = false; // Flag to indicate if the app is ready

// --- State Management ---
let initiativeOrder = [];
let currentTurnIndex = 0;
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');

const DND_CONDITIONS = {
    "Blinded": { emoji: "🙈", color: "#6c757d", text: "You can't see and automatically fail any ability check that requires sight. Attack rolls against you have Advantage, and your attack rolls have Disadvantage." },
    "Burning": { emoji: "🔥", color: "#e74c3c", text: "A burning creature takes 1d4 Fire damage at the start of each of its turns. A creature can end this damage by using its action to make a DC 10 Dexterity check to extinguish the flames." },
    "Charmed": { emoji: "😍", color: "#e83e8c", text: "You can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has Advantage on any ability check to interact socially with you." },
    "Deafened": { emoji: "🙉", color: "#adb5bd", text: "You can't hear and automatically fail any ability check that requires hearing." },
    "Exhaustion": { emoji: "😩", color: "#fd7e14", text: "This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6. When you make a D20 Test the roll is reduced by 2 times your Exhaustion level. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level." },
    "Frightened": { emoji: "😨", color: "#6f42c1", text: "You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight. You can't willingly move closer to the source of your fear." },
    "Grappled": { emoji: "🤼", color: "#fd7e14", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. The condition ends if the grappler is incapacitated. The condition also ends if an effect removes the grappled creature from the reach of the grappler." },
    "Incapacitated": { emoji: "😵", color: "#6c757d", text: "You can't take actions or reactions. Your Concentration in broken. You can't speak." },
    "Invisible": { emoji: "👻", color: "#f8f9fa", text: "You are Concealed. You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed. Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature." },
    "Paralyzed": { emoji: "🥶", color: "#007bff", text: "You are Incapacitated and can't move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Petrified": { emoji: "🗿", color: "#343a40", text: "You have the Incapacitated condition. Your Speed is 0 and can't increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Poisoned": { emoji: "🤢", color: "#28a745", text: "You have Disadvantage on attack rolls and ability checks." },
    "Prone": { emoji: "🙇", color: "#ffc107", text: "Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage." },
    "Restrained": { emoji: "⛓️", color: "#6c757d", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws." },
    "Stunned": { emoji: "🤯", color: "#ffc107", text: "You are Incapacitated, can't move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Unconscious": { emoji: "😴", color: "#343a40", text: "You are Incapacitated, can't move or speak, and are unaware of your surroundings. You drop whatever you're holding and fall prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.) (Prone: Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.)" }
};

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

async function sendInitiativeUpdate() {
    if (isAppReady && mainWindow.webContents) {   
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
    }
    else {
        await sleep(100);
        sendInitiativeUpdate();
    }
}

async function loadState() {
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
        await sleep(100);
        loadState();
    }
    sendInitiativeUpdate();
}

loadState();

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
let windowloaded = false;
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
    windowloaded = true;
}

async function apploader() {
    await app.whenReady().then(() => {
        console.log('App is ready.');
        createWindow();
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length == 0) createWindow();
        });
        isAppReady = true;
        ipcloader();
    });
}

ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
});

apploader();

const hpBarEmojiMap = {
    '#007bff': ':blue_square:',      // Blue
    '#28a745': ':green_square:',     // Green
    '#ffc107': ':yellow_square:',    // Yellow
    '#dc3545': ':red_square:',       // Red
    '#8a2be2': ':purple_square:',    // Purple
    '#6c757d': ':x:',               // Grey (Dead)
    'empty': ':black_large_square:'
};

function createEmojiHpBar(creature) {
    let hp = creature.hp || 0;
    let maxHp = creature.maxHp || 1;

    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(8);
    }

    if (hp > maxHp) {
        hp = maxHp;
    }

    const color = getHpColor(hp, maxHp);
    const emoji = hpBarEmojiMap[color] || hpBarEmojiMap['#007bff'];
    const percentage = Math.max(0, (hp / maxHp));

    const filledBlocks = Math.round(percentage * 8);
    const emptyBlocks = 8 - filledBlocks;

    return emoji.repeat(filledBlocks) + hpBarEmojiMap['empty'].repeat(emptyBlocks);
}

async function ipcloader() {
    if (windowloaded) {
        logToRenderer('ipcloader() called.');
        // --- All core IPC listeners should be registered after the app is ready ---
        ipcMain.handle('open-file-dialog', async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Select Music File',
                defaultPath: DEFAULT_LOCAL_FOLDER,
                properties: ['openFile'],
                filters: [
                    { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
                ]
            });

            if (filePaths && filePaths.length > 0) {
                // Here, you would typically do something with the selected file path,
                // like sending it back to the renderer process or loading the music.
                // For now, we'll just return it.
                return filePaths[0];
            }
            return null;
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

        ipcMain.on('push-initiative', async () => {
            logToRenderer(`'push-initiative-to-chat' invoked.`);
            if (initiativeOrder.length === 0) {
                logToRenderer('[push-initiative] Cannot push, initiative is empty.');
                return;
            }

            const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
            if (!channel) {
                logToRenderer(`[push-initiative] FAILED to find channel with ID: ${TEXT_CHANNEL_ID}`);
                return;
            }
            logToRenderer(`[push-initiative] Found channel: ${channel.name}`);

            try {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Initiative Order')
                    .setTimestamp();

                let description = '';
                initiativeOrder.forEach((creature, index) => {
                    const hpBar = createEmojiHpBar(creature);
                    const conditions = (creature.conditions || [])
                        .map(c => DND_CONDITIONS[c]?.emoji || c)
                        .join(' ');

                    const activeMarker = index === currentTurnIndex ? '➤ ' : '';
                    description += `${activeMarker}**${creature.initiative}** - ${creature.name}  |  ${hpBar}  |  ${conditions}\n`;
                });

                embed.setDescription(description);

                logToRenderer(`[push-initiative] Attempting to send embed...`);
                await channel.send({ embeds: [embed] });
                logToRenderer('[push-initiative] Successfully pushed initiative to chat.');
            } catch (error) {
                logToRenderer(`[push-initiative] FAILED to send embed: ${error}`);
            }
        });

        ipcMain.on('next-turn', () => {
            if (initiativeOrder.length > 0) {
                currentTurnIndex = (currentTurnIndex + 1) % initiativeOrder.length;
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('copy-creature', (event, { creatureId }) => {
            const creature = initiativeOrder.find(c => c.id === creatureId);
            if (creature) {
                // Send a copy of the creature data, but don't remove the original
                mainWindow.webContents.send('populate-edit-form', creature);
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

        ipcMain.handle('load-encounter-dialog', async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                title: 'Load Encounter',
                defaultPath: app.getPath('userData'),
                properties: ['openFile'],
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            if (filePaths && filePaths.length > 0) {
                mainWindow.webContents.send('load-encounter', filePaths[0]);
            }
        });

        ipcMain.on('load-encounter', async (event, filePath) => {
            try {
                if (filePath) {
                    const savedState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    initiativeOrder = savedState.initiativeOrder || [];
                    currentTurnIndex = savedState.currentTurnIndex || 0;
                    logToRenderer(`Encounter loaded from ${filePath}`);
                    saveState(); // Autosave the newly loaded state
                    sendInitiativeUpdate();
                }
            } catch (error) {
                logToRenderer(`Error loading encounter: ${error.message}`);
            }
        });

        ipcMain.on('add-creature', (event, creature) => {
            const initiativeInput = creature.initiative.toString(); // Ensure it's a string
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
            const message = `${creature.name} rolled a ${stat.toUpperCase()} ${type} (${rollType})
    Result: ${total} ([${rollDetails}] + ${modifier})`;

            logToRenderer(message);
            mainWindow.webContents.send('dice-log', message);

            const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
            if (channel) {
                channel.send(message);
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

        ipcMain.on('clear-encounter', async () => {
            const result = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Confirm Clear',
                message: 'Are you sure you want to clear the entire encounter? This cannot be undone.',
                detail: 'You may want to save the encounter first.',
                buttons: ['Clear Encounter', 'Cancel'],
                defaultId: 1,
                cancelId: 1
            });
            if (result.response === 0) { // 'Clear Encounter' button
                initiativeOrder = [];
                currentTurnIndex = 0;
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('edit-creature', (event, { creatureId }) => {
            const creature = initiativeOrder.find(c => c.id === creatureId);
            if (creature) {
                mainWindow.webContents.send('populate-edit-form', creature);
                // Remove the creature after sending its data to the form
                initiativeOrder = initiativeOrder.filter(c => c.id !== creatureId);
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('remove-creature', (event, { creatureId }) => {
            initiativeOrder = initiativeOrder.filter(c => c.id !== creatureId);
            sendInitiativeUpdate();
            saveState();
        });

        ipcMain.on('previous-turn', () => {
            if (initiativeOrder.length > 0) {
                currentTurnIndex = (currentTurnIndex - 1 + initiativeOrder.length) % initiativeOrder.length;
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
            const creature = initiativeOrder.find(c => c.id === creatureId);
            if (creature) {
                creature.tempHp = (creature.tempHp || 0) + amount;
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('update-hp', (event, { creatureId, amount }) => {
            const creature = initiativeOrder.find(c => c.id === creatureId);
            if (creature) {
                if (amount < 0) { // Damage
                    let damage = -amount;

                    // Subtract from temp HP first
                    const tempHpDamage = Math.min(creature.tempHp || 0, damage);
                    creature.tempHp -= tempHpDamage;
                    damage -= tempHpDamage;

                    // Subtract remaining damage from main HP
                    creature.hp -= damage;

                    if (creature.isConcentrating) {
                        const dc = Math.max(10, Math.floor(-amount / 2)); // DC is based on total damage
                        dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${creature.name} must make a DC ${dc} Constitution saving throw.`, buttons: ['OK']});
                    }
                } else { // Healing
                    creature.hp += amount;
                }
                sendInitiativeUpdate();
                saveState();
            }
        });

        ipcMain.on('add-condition', (event, { creatureId, condition }) => {
            logToRenderer(`Adding condition ${condition} to creature ${creatureId}`);
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

        ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
            const creature = initiativeOrder.find(c => c.id === creatureId);
            if (creature) {
                creature[flag] = value;
                sendInitiativeUpdate();
                saveState();
            }
        });
    }
    else {
        logToRenderer('ipcloader() waiting for window to load...');
        await sleep(100);
        ipcloader();
    }  
}

// Function to send log messages to the renderer
async function logToRenderer(message) {
    if (isAppReady) {
        mainWindow.webContents.send('log-message', message);
    }
    else {
        await sleep(100);
        logToRenderer(message);
    }
}

/*
client.on('error', error => {
    logToRenderer('An error occurred: ', error);
});
*/

client.once('ready', async () => {
    const shutdown = async () => {
        try {
            console.log('Cleaning up and exiting.');
            // Remove all event listeners
            client.removeAllListeners();
            player.removeAllListeners();
            connection.removeAllListeners();
            app.removeAllListeners();
            ipcMain.removeAllListeners();

            // Close any other resources, e.g., voice connections
            if (connection) {
                connection.destroy();
            }

            // Optionally logout
            await client.destroy();

            app.quit();
        }
        catch (error) {
            console.log('Error during shutdown:', error);
        }
    };
    app.on('before-quit', shutdown);

    logToRenderer('TavernTones is online!');

    //Connect to the voice channel

    //connection status enums
    //VoiceConnectionStatus.Signalling
    //VoiceConnectionStatus.Connecting
    //VoiceConnectionStatus.Ready
    //VoiceConnectionStatus.Disconnected
    //VoiceConnectionStatus.Destroyed

    //player status enums
    //AudioPlayerStatus.Buffering
    //AudioPlayerStatus.Playing
    //AudioPlayerStatus.Paused
    //AudioPlayerStatus.Idle
    //AudioPlayerStatus.AutoPaused

    const voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            });

            // Listen for connection status changes
            connection.on(VoiceConnectionStatus.Ready, () => {
                logToRenderer('The bot has connected to the channel!');
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                logToRenderer('The bot has been disconnected. Attempting to reconnect...');
                // Optionally, try to reconnect or handle disconnection
                setTimeout(() => {
                    joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });
                }, 5000); // Delay before attempting to reconnect
            });

            connection.on(VoiceConnectionStatus.Signalling, () => {
                logToRenderer('The bot is attempting to establish a connection.');
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                logToRenderer('The connection has been destroyed.');
            });

            logToRenderer(`Joined voice channel: ${voiceChannel.name}: ${connection.state.status}`);

            await entersState(connection, VoiceConnectionStatus.Ready, 60000);
            logToRenderer('Connection is ready!');
            sendInitiativeUpdate();
        }
        catch (error) {
            logToRenderer('Error joining voice channel: ', error);
        }
    }
    else {
        logToRenderer('Voice channel not found or is not a voice channel!');
    }

    player = createAudioPlayer(); // This is the main player
    connection.subscribe(player);

    ipcMain.on('play-music', async (event, filePathFromRenderer) => {
    logToRenderer(`Play command received. pendingFile: ${audioState.pendingFile}, filePathFromRenderer: ${filePathFromRenderer}, playerStatus: ${audioState.playerStatus}`);

    if (audioState.pendingFile) {
        logToRenderer(`Play command received for pending file: ${audioState.pendingFile}`);
        await play(audioState.pendingFile);
        audioState.clearPendingFile();
    } else if (audioState.playerStatus === AudioPlayerStatus.Paused) {
        logToRenderer('Resuming current track: ' + audioState.activeFile);
        resumeAudio();
    } else if (filePathFromRenderer) {
            logToRenderer('Play command: Direct play from renderer path: ' + filePathFromRenderer);
        await play(filePathFromRenderer);
    } else {
            logToRenderer('Play command: Nothing to play.');
            if (mainWindow && mainWindow.webContents) { // Ensure GUI reflects non-playing state if nothing happens
                mainWindow.webContents.send('update-gui-state', {
                    isPlaying: false,
                filePath: audioState.activeFile, // Keep showing current file if paused or idle
                isPending: !!audioState.pendingFile
                });
            }
        }
    });

    ipcMain.on('pause-music', () => {
        logToRenderer('Pause command received. Current player status: ' + player.state.status + ', isPlaying: ' + audioState.isPlaying);
    if (audioState.isPlaying) {
        pauseAudio();
    }
    });

    //Begin audio processing
    async function createReadableStream(filePath, useCache = true) {
        if (!filePath) { // Ensure filePath is not null or undefined
            logToRenderer('createReadableStream: filePath is null or undefined.');
            return null;
        }
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.wav') {
            try {
                // Create a readable stream from the WAV file
                const wavStream = fs.createReadStream(filePath);
                logToRenderer('Successfully created readable stream from WAV file.');
                return wavStream;
            } catch (error) {
                logToRenderer('Error processing WAV file in createReadableStream: ' + error.message);
                return null;
            }
        } else {
            logToRenderer('Unsupported file type in createReadableStream: ' + ext);
            return null;
        }
    }

    // Setup main player's event listeners once
    player.on(AudioPlayerStatus.Idle, async () => {
    logToRenderer('Main player entered Idle state. Current track: ' + audioState.activeFile + '. Pending track: ' + audioState.pendingFile);
    audioState.setPlayerStatus(AudioPlayerStatus.Idle);
        // This Idle handler is primarily for looping non-OGG files or playing the next track if a queue system were implemented.
        // OGG files are handled by a temporary player and should not trigger this main player's looping logic for themselves.

    if (audioState.pendingFile) {
        logToRenderer('Main player Idle: Pending resource found. Starting playback for: ' + audioState.pendingFile);
        const stream = await createReadableStream(audioState.pendingFile);
        if (stream) {
            const resourceToPlay = createAudioResource(stream);
            await startPlaybackFromResource(resourceToPlay, audioState.pendingFile);
            audioState.clearPendingFile();
        } else {
            logToRenderer('Main player Idle: Failed to create stream for pending file: ' + audioState.pendingFile);
            audioState.clearPendingFile();
        }
    } else if (audioState.activeFile) {
        const isOggLoop = path.extname(audioState.activeFile).toLowerCase() === '.ogg';
            if (isOggLoop) {
                logToRenderer('Main player Idle: OGG file finished (expected to be played by temporary player), not looping with main player.');
            audioState.clearActiveFile();
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                }
                // Ensure main player remains subscribed if no other pending actions
                if (connection && connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player !== player) {
                connection.subscribe(player);
                }
            } else {
                // Existing loop logic for non-OGG files:
                logToRenderer('Main player Idle (Looping non-OGG): Forcing player.stop(true) before re-creating resource for loop.');
                player.stop(true);
            logToRenderer('Main player Idle: No pending resource. Attempting to loop current (non-OGG) track: ' + audioState.activeFile);
            const newReadableStream = await createReadableStream(audioState.activeFile);
                if (newReadableStream) {
                    const newAudioResourceForLoop = createAudioResource(newReadableStream);
                    // currentAudioResource is already set for non-OGG, startPlaybackFromResource will use it.
                await startPlaybackFromResource(newAudioResourceForLoop, audioState.activeFile);
                } else {
                logToRenderer('Main player Idle: Failed to create stream for looping non-OGG: ' + audioState.activeFile);
                audioState.clearActiveFile();
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                    }
                }
            }
        } else {
        logToRenderer('Main player Idle and no activeFile or pendingFile, so not looping or starting new track.');
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
            }
        }
    });

    player.on(AudioPlayerStatus.AutoPaused, () => {
        if (currentPlayingFilePath) { // Check if a track was supposed to be playing
            logToRenderer('Main player Autopaused, check connection... Track: ' + currentPlayingFilePath);
        }
    });

    player.on('error', (error) => {
    logToRenderer(`Error in main player for ${audioState.activeFile}: ${error.message}`);
    audioState.clearActiveFile();
    audioState.setPlayerStatus(AudioPlayerStatus.Idle);
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null, error: true });
        }
    });


    async function startPlaybackFromResource(audioResourceToPlay, filePathOfResource) {
        logToRenderer('Using main player for: ' + filePathOfResource);
        if (connection && connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player !== player) {
            logToRenderer('Main player was not subscribed. Re-subscribing.');
            connection.subscribe(player);
        } else if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
            logToRenderer('ERROR: Voice connection not ready to subscribe main player.');
            if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: filePathOfResource, error: true });
            }
            return;
        }

    audioState.setActiveFile(filePathOfResource);

        // Crucially, ensure main player's listeners are set up (they are, once, above)
        // player.removeAllListeners(AudioPlayerStatus.Idle); // This was here before, but listeners are now set once globally
        // player.removeAllListeners(AudioPlayerStatus.AutoPaused);
        // player.removeAllListeners('error');
        // Re-attaching listeners like this on every play can lead to multiple listeners.
        // They are now set once when the main `player` is created.

        player.play(audioResourceToPlay);
        logToRenderer('Main player.play called for: ' + filePathOfResource);

        try {
            await entersState(player, AudioPlayerStatus.Playing, 5000);
        audioState.setPlayerStatus(AudioPlayerStatus.Playing);
        logToRenderer('Main player is now Playing: ' + audioState.activeFile);
            if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: audioState.activeFile });
            }
        } catch (error) {
        logToRenderer(`Main player did not enter Playing state for ${audioState.activeFile}: ${error.message}. Current state: ${player.state.status}`);
        audioState.setPlayerStatus(AudioPlayerStatus.Idle);
            if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: audioState.activeFile, error: true });
            }
            // Don't nullify currentPlayingFilePath here if we want to potentially retry/log
        }
    }

    function pauseAudio() {
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause(true); // Pass true to pause even if resource is still buffering
        audioState.setPlayerStatus(AudioPlayerStatus.Paused);
            logToRenderer('Audio paused. Player state: ' + player.state.status);
            if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: audioState.activeFile });
            }
        } else {
            logToRenderer('Audio is not playing or player unavailable. Player state: ' + player.state.status);
        }
    }

    async function play(filePath) {
        if (!filePath) {
            logToRenderer('play: filePath is null or undefined.');
            return;
        }

        const stream = await createReadableStream(filePath);
        if (stream) {
            const resource = createAudioResource(stream);
            await startPlaybackFromResource(resource, filePath);
        } else {
            logToRenderer(`Failed to create stream for: ${filePath}`);
        }
    }


    function resumeAudio() {
        if (player && player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
        audioState.setPlayerStatus(AudioPlayerStatus.Playing);
            logToRenderer('Audio resumed. Player state: ' + player.state.status);
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: audioState.activeFile });
            }
        } else {
            logToRenderer('Audio is not paused or player unavailable. Player state: ' + player.state.status);
        }
    }
    logToRenderer(`Logged in as ${client.user.tag}`);

    // Send a startup embed to test permissions
    try {
        const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
        if (channel) {
            const startupEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('TavernTones is Ready!')
                .setDescription('The bot has successfully connected and is ready for commands.')
                .setTimestamp();
            await channel.send({ embeds: [startupEmbed] });
        }
    } catch (error) {
        logToRenderer(`[Startup Test] FAILED to send startup embed: ${error}`);
    }

    // startup message
    /*
    const textChannel = client.channels.cache.get(TEXT_CHANNEL_ID);
    if (textChannel) {
        try {
            const message = await textChannel.send('TavernTones is now online!');
            // Wait for 5 seconds
            setTimeout(() => {
                message.delete()
                    .then(() => logToRenderer('Announcement message deleted.'))
                    .catch(error => logToRenderer('Error deleting message: ', error));
            }, 5000);
        }
        catch (error) {
            logToRenderer('Error sending message: ', error);
        }
    }
    else {
        logToRenderer('Text channel not found!');
    }
    */

    client.on('messageCreate', async message => {
        // Ignore messages from the bot itself
        if (message.author.bot) {
            logToRenderer('Ignoring my own message.');
            return;
        }

        logToRenderer(`Message received: ${message.content}`); // Log received messages

        if (message.mentions.has(client.user) || message.mentions.roles.has(BOT_ROLE_ID)) { // Check if the bot is mentioned
            const userId = message.author.id;
            const content = message.content.toLowerCase();

            try {
                let typingInterval;
                switch (true) {
                    case content.includes('!ping'):
                        logToRenderer('Ping command detected'); // Log when ping command is detected
                        await message.reply('Pong!');
                        logToRenderer('Ping successfully ponged.');
                        break;



                    case content.includes('!su'):
                        const surgeFilePath = path.join(__dirname, 'randomtables/surge.json');
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        const surgeEffect = getRandomEffect(surgeData, userId);
                        if (surgeEffect) {
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            logToRenderer(evaluatedText + (surgeEffect.unique ? '  - Unique!' : ''));
                            await message.reply(evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : ''));

                            if (surgeEffect.unique) {
                                if (!Array.isArray(surgeEffect.used)) {
                                    surgeEffect.used = [];
                                }
                                surgeEffect.used.push(userId);
                                fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData, null, 2), 'utf8');
                                logToRenderer('Updated surgeData written to file.');
                            }

                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;

                    case content.includes('!sh'):
                        const shieldFilePath = path.join(__dirname, 'randomtables/shield.json');
                        const shieldData = JSON.parse(fs.readFileSync(shieldFilePath, 'utf8'));
                        const shieldEffect = getRandomEffect(shieldData, userId);
                        if (shieldEffect) {
                            const evaluatedText = evaluateDiceRolls(shieldEffect.text);
                            logToRenderer(evaluatedText + (shieldEffect.unique ? '  - Unique!' : ''));
                            await message.reply(evaluatedText + (shieldEffect.unique ? '  - 🥳Unique!🎊' : ''));

                            // Mark the effect as used by the user if it's unique
                            if (shieldEffect.unique) {
                                if (!Array.isArray(shieldEffect.used)) {
                                    shieldEffect.used = [];
                                }
                                shieldEffect.used.push(userId);
                                fs.writeFileSync(shieldFilePath, JSON.stringify(shieldData, null, 2), 'utf8');
                                logToRenderer('Updated shieldData written to file.');
                            }
                        } else {
                            logToRenderer('No Available effects for user!');
                            await message.reply('No available effects for you.');
                        }
                        break;

                    case content.includes('!en'):
                        const invalidCharsRegex = /[.,:;\/\\?*"<>|&]+/g;
                        const regex = /^!\S*\s*(.*)/;
                        const match = content.match(regex);
                        let args;

                        if (match) {
                            // Filtered and split arguments
                            args = match[1]
                                .replace(invalidCharsRegex, "")    // Remove invalid characters
                                .trim()                            // Remove extra spaces at the ends
                                .split(/\s+/);
                        } else {
                            await message.reply('Invalid format. Please use the command like this: @TT !en 80 clear 30 calmweather 15 choppyweather 5 specialweather');
                            break;
                        }

                        // Parse weights and table names
                        const tableEntries = [];
                        let validArgs = true; // Flag to track argument validity
                        for (let i = 0; i < args.length; i += 2) {
                            const weight = parseInt(args[i], 10);
                            const tableName = args[i + 1];

                            if (isNaN(weight) || weight <= 0 || !tableName) {
                                await message.reply('Invalid format. Please ensure weights are positive integers and table names are valid.');
                                validArgs = false; // Set flag to false
                                break; // Exit loop early
                            }
                            tableEntries.push({ weight, tableName });
                        }

                        if (!validArgs) { // Check flag before proceeding
                            break; // Exit case if arguments were invalid
                        }

                        if (tableEntries.length === 0 && args.length > 0) {
                            // This case implies that parsing failed to produce entries,
                            // possibly due to an odd number of arguments or other unhandled parsing issues,
                            // though the loop's `!tableName` check should catch most.
                            // However, if the loop was broken due to invalid format, the message is already sent.
                            // This is a fallback.
                            if (validArgs) { // Only send if no other error message was sent
                                await message.reply('Could not parse table entries. Please check the format.');
                            }
                            break;
                        }

                        if (tableEntries.length === 0 && args.length === 0) {
                             await message.reply('No table arguments provided. Please specify weights and table names.');
                             break;
                        }


                        // Call the new rollFromTable function
                        const result = await rollFromTable("encountertables", tableEntries, message.channel.id);

                        if (result.success) {
                            const finalMessage = `Effect: ||${result.text}||`;
                            await message.reply(finalMessage);
                        } else {
                            await message.reply(result.message); // Send the error message from rollFromTable
                        }
                        break;

                    case content.includes('!ro'):
                        logToRenderer('!ro command detected');
                        // Find the index of '!ro' (case-insensitive)
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        if (roIndex === -1) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <numberOfIterations> <weight1> <tableName1> <weight2> <tableName2> ...');
                            break;
                        }
                        // Get everything after '!ro'
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        const roArgs = roArgsStr.split(/\s+/);

                        if (roArgs.length < 3) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <numberOfIterations> <weight1> <tableName1> <weight2> <tableName2> ...');
                            break;
                        }

                        const folderName = roArgs[0];
                        const iterationCountStr = roArgs[1];
                        const tableArgs = roArgs.slice(2);

                        // Validate folderName
                        const validFolders = getValidTableFolders();
                        if (!validFolders.includes(folderName)) {
                            await message.reply(`Folder '${folderName}' not found. Valid folders are: ${validFolders.join(', ')}.`);
                            break;
                        }

                        // Parse and validate iterationCount
                        const iterationCount = parseInt(iterationCountStr, 10);
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 999) {
                            await message.reply('Invalid number of iterations. Please use a number between 1 and 999.');
                            break;
                        }

                        // Parse tableArgs for tableEntries
                        const roTableEntries = [];
                        if (tableArgs.length === 0 || tableArgs.length % 2 !== 0) {
                            await message.reply('Invalid weight or table name format in table arguments. Ensure you have pairs of weight and table names, and at least one pair.');
                            break;
                        }

                        let validRoTableArgs = true;
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            const weightStr = tableArgs[i];
                            const tableName = tableArgs[i + 1];
                            const weight = parseInt(weightStr, 10);

                            if (isNaN(weight) || weight <= 0 || !tableName) {
                                await message.reply('Invalid weight or table name format. Weights must be positive integers and table names must be provided.');
                                validRoTableArgs = false;
                                break;
                            }
                            roTableEntries.push({ weight, tableName });
                        }

                        if (!validRoTableArgs) {
                            break;
                        }

                        if (roTableEntries.length === 0) {
                            await message.reply('You must specify at least one valid table and weight.');
                            break;
                        }

                        await message.reply(`Starting ${iterationCount} rolls from folder '${folderName}' in a new thread...`);
                        const thread = await message.startThread({
                            name: `Rolls from ${folderName} (${iterationCount} times)`,
                            autoArchiveDuration: 60, // 60 minutes
                        });

                        for (let i = 0; i < iterationCount; i++) {
                            const result = await rollFromTable(folderName, roTableEntries, message.channel.id);
                            if (result.success) {
                                await thread.send(`Roll ${i + 1}: ${result.text}`);
                            } else {
                                await thread.send(`Roll ${i + 1} Error: ${result.message}`);
                            }
                            // Delay to prevent flooding and potential rate limits
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        await thread.send(`Completed ${iterationCount} rolls from ${folderName}.`);
                        break;

                    case content.includes('!ll'):
                        logToRenderer('LL command detected');
                        const llCommandRegex = /!ll\w*\s+(.*)/;
                        const llMatch = content.match(llCommandRegex);
                        if (llMatch && llMatch[1]) {
                            const prompt = llMatch[1];
                            try {
                                const startTime = Date.now();
                                const thinkingMessage = await message.reply('Checking local docs with Llama...');
                                typingInterval = setInterval(() => message.channel.sendTyping(), 5000); // Show typing indicator every 5 seconds
                                let response = await askGPT4All(prompt, 'll');
                                clearInterval(typingInterval); // Stop typing indicator
                                if (response.length > 1940) {
                                    const llThread = await message.startThread({
                                        name: `Response to ${llMatch[1]}`,
                                        autoArchiveDuration: 15,
                                        reason: `Response to ${llMatch[1]}`
                                    });
                                    const parts = response.match(/[\s\S]{1,1940}/g) || [];
                                    response += ` (${parts.length} total messages)`;
                                    for (const part of parts) {
                                        await llThread.send(part);
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                    let time = (Date.now() - startTime) / 1000;
                                    await thinkingMessage.edit(` - Response sent in ${parts.length} parts and took ${time} seconds.`);
                                }
                                else {
                                    let time = (Date.now() - startTime) / 1000;
                                    response += `\nResponse sent in ${time} seconds.`;
                                    await thinkingMessage.edit(response);
                                }
                            } catch (error) {
                                logToRenderer(`Error: ${error}`);
                                clearInterval(typingInterval);
                                await message.reply('An error occurred while processing your request. Ask Crisp if it\'s on?');
                            }
                        } else {
                            await message.reply('Invalid format. Please use the command like this: @TT !ll your prompt here');
                        }
                        break;

                    case content.includes('!re'):
                        logToRenderer('RE command detected');
                        const reCommandRegex = /!re\w*\s+(.*)/;
                        const reMatch = content.match(reCommandRegex);
                        if (reMatch && reMatch[1]) {
                            const prompt = reMatch[1];
                            try {
                                const startTime = Date.now();
                                const thinkingMessage = await message.reply('Checking local docs with Reasoner...');
                                typingInterval = setInterval(() => message.channel.sendTyping(), 5000); // Show typing indicator every 5 seconds
                                let response = await askGPT4All(prompt, 're');
                                clearInterval(typingInterval); // Stop typing indicator
                                if (response.length > 1940) {
                                    const reThread = await message.startThread({
                                        name: `Response to ${reMatch[1]}`,
                                        autoArchiveDuration: 15,
                                        reason: `Response to ${reMatch[1]}`
                                    });
                                    const parts = response.match(/[\s\S]{1,1940}/g) || [];
                                    response += ` (${parts.length} total messages)`;
                                    for (const part of parts) {
                                        await reThread.send(part);
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                    }
                                    let time = (Date.now() - startTime) / 1000;
                                    await thinkingMessage.edit(` - Response sent in ${parts.length} parts and took ${time} seconds.`);
                                }
                                else {
                                    let time = (Date.now() - startTime) / 1000;
                                    response += `\nResponse sent in ${time} seconds.`;
                                    await thinkingMessage.edit(response);
                                }
                            } catch (error) {
                                logToRenderer(`Error: ${error}`);
                                clearInterval(typingInterval);
                                await message.reply('An error occurred while processing your request. Ask Crisp if it\'s on?');
                            }
                        } else {
                            await message.reply('Invalid format. Please use the command like this: @TT !re your prompt here');
                        }
                        break;

                    case content.includes('!in'):
                        logToRenderer('IN command detected');
                        if (lastResponse && lastResponse.choices && lastResponse.choices[0].references) {
                            const thread = await message.startThread({
                                name: 'References',
                                autoArchiveDuration: 15,
                                reason: 'References from the last query'
                            });
                            for (const ref of lastResponse.choices[0].references) {
                                await thread.send(`${ref.file}\n\`\`\`${ref.text}\`\`\``);
                                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before sending the next message
                            }
                        } else {
                            await message.reply('No references available from the last response.');
                        }
                        break;

                    case content.includes('!pl'):
                        logToRenderer('!pl command detected');

                        const fullCommand = message.content.substring(message.content.toLowerCase().indexOf('!pl')).trim();
                        const parts = fullCommand.split(/\s+/); // Split by one or more spaces
                        // parts[0] is "!pl" itself. commandArgs will be the actual arguments after "!pl".
                        const commandArgs = parts.slice(1).filter(arg => arg.length > 0); // Filter out empty strings that might result from multiple spaces

                        let parsedFolder = null;
                        let parsedSong = null;

                        if (commandArgs.length === 1) {
                            parsedFolder = commandArgs[0];
                        } else if (commandArgs.length >= 2) {
                            parsedFolder = commandArgs[0];
                            parsedSong = commandArgs[1];
                        }

                        let songFilePath = await findMusic(parsedFolder, parsedSong);

                        if (songFilePath) {
                            if (path.extname(songFilePath).toLowerCase() === '.lnk') {
                                try {
                                    const shortcut = shell.readShortcutLink(songFilePath);
                                    const targetPath = shortcut.target || null;

                                    if (targetPath && fs.existsSync(targetPath)) {
                                        songFilePath = targetPath;
                                    } else {
                                        songFilePath = null;
                                    }
                                } catch (error) {
                                    songFilePath = null;
                                }
                            }

                            if (songFilePath) {
                                queue(songFilePath);
                                const songNameForMessage = path.parse(songFilePath).name;
                                await message.reply(`Okay, queuing up: **${songNameForMessage}**. It will play when ready.`);
                                if (audioState.isPlaying) {
                                    player.stop(true);
                                } else if (audioState.playerStatus === AudioPlayerStatus.Idle) {
                                    await play(audioState.pendingFile);
                                    audioState.clearPendingFile();
                                }
                            } else {
                                await message.reply("Sorry, I couldn't find the music you were looking for.");
                            }
                        } else {
                            await message.reply("Sorry, I couldn't find the music you were looking for.");
                        }
                        break;

                    case content.includes('!pa'):
                        logToRenderer('!pa command detected');
                        if (audioState.isPlaying) {
                            pauseAudio();
                            await message.reply('Playback paused.');
                        } else if (audioState.playerStatus === AudioPlayerStatus.Paused) {
                            await message.reply('Playback is already paused.');
                        } else {
                            await message.reply('Nothing is currently playing to pause.');
                        }
                        break;

                    case content.includes('!h'):
                        logToRenderer('Help command detected');
                        await message.reply('Commands:\n!su (surge)\n!sh (shield)\n!ll (Llama model)\n!re (Reasoner model)\n!in (inspect referenced material from last response)\n!h (returns this help message)\nany other message will return the currently playing track and album, if any.');
                        break;

                    default:
                        logToRenderer('No recognized command found.');
                        if (audioState.isPlaying) {
                            if (audioState.activeFile) {
                                const albumName = path.basename(path.dirname(audioState.activeFile));
                                const trackName = path.basename(audioState.activeFile, path.extname(audioState.activeFile));
                                await message.reply(`I'm currently playing: **${trackName}** from the album **${albumName}**`);
                            } else {
                                await message.reply('Sorry, no track information available.');
                            }
                        } else {
                            await message.reply('Sorry, I\'m not playing any music right now.');
                        }
                        break;
                }
            } catch (error) {
                logToRenderer('Error processing command: ' + error.message);
            }
        }
    });

});

client.login(DISCORD_TOKEN);

let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
const startingMemUse = memoryUsage;
setInterval(() => {
    memoryUsage = process.memoryUsage().rss;
    logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
}, 60000);

function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Grey
    if (current > max) return '#8a2be2'; // Purple

    const percentage = (current / max) * 100;
    if (percentage <= 25) return '#dc3545'; // Red
    if (percentage <= 50) return '#ffc107'; // Yellow
    if (percentage <= 75) return '#28a745'; // Green
    return '#007bff'; // Blue
}

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