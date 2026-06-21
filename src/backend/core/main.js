// Performance and security update
// Performance and security update
// Import Electron modules for window management, IPC, and OS integration
// Process: const  app, BrowserWindow, ipcMain, dialog, shell, protoc...
// Process: const  app, BrowserWindow, ipcMain, dialog, shell, protoc...
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');

// Register 'safe-media' protocol as privileged to allow streaming local audio files
protocol.registerSchemesAsPrivileged([
// Process: scheme: 'safe-media', privileges:  secure: true, standard...
    // Process: scheme: 'safe-media', privileges:  secure: true, standard...
    { scheme: 'safe-media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

// Import path and URL utilities for file handling
// Process: const path = require('path')
// Process: const path = require('path')
const path = require('path');
const { pathToFileURL } = require('url');
// Import Discord.js modules for bot functionality
// Process: const  Client, GatewayIntentBits, REST, Routes, EmbedBuil...
// Process: const  Client, GatewayIntentBits, REST, Routes, EmbedBuil...
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Events, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
// Import Discord voice modules for audio streaming
const { joinVoiceChannel, entersState, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');

// Initialize Discord client with required intents for messages and voice
// Process: const client = new Client(
// Process: const client = new Client(
const client = new Client({
    intents: [
// Process: GatewayIntentBits.Guilds,
        // Process: GatewayIntentBits.Guilds,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
// Process: GatewayIntentBits.GuildVoiceStates,
        // Process: GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
// Process: ],
    // Process: ],
    ],
    // Handle partials for DMs and uncached messages
    partials: [Partials.Channel, Partials.Message]
// Process: )
// Process: )
});
// Map to track dropdown interactions for NPC/Monster details
client.npcDropdownHandlers = new Map();
// Process: console.log('Discord client instantiated.')
// Process: console.log('Discord client instantiated.')
console.log('Discord client instantiated.');
// Import Axios for HTTP requests
const axios = require('axios');
// Process: console.log('Axios loaded.')
// Process: console.log('Axios loaded.')
console.log('Axios loaded.');
// Import core application components
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
// Process: const CommandHandler = require('../../discord/CommandHand...
// Process: const CommandHandler = require('../../discord/CommandHand...
const CommandHandler = require('../../discord/CommandHandler.js');
const FiveEToolsParser = require('./5eParser.js');
// Process: const  getDiscordConfig, setDiscordConfig  = require('./c...
// Process: const  getDiscordConfig, setDiscordConfig  = require('./c...
const { getDiscordConfig, setDiscordConfig } = require('./config.js');
const { format5eResult } = require('../../discord/5eEmbedFormatter.js');
// Process: const  mobRules  = require('../data/mobRules.js')
// Process: const  mobRules  = require('../data/mobRules.js')
const { mobRules } = require('../data/mobRules.js');
const DropdownHandler = require('../../discord/DropdownHandler.js');
// Import filesystem and dice utilities
// Process: const fs = require('fs')
// Process: const fs = require('fs')
const fs = require('fs');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
// Process: const GitHubSync = require('./GitHubSync.js')
// Process: const GitHubSync = require('./GitHubSync.js')
const GitHubSync = require('./GitHubSync.js');
// Import Worker threads for offloading heavy tasks
const { Worker } = require('worker_threads');

// Process: let discordConfig
// Process: let discordConfig
let discordConfig;

// Caching for music library
let cachedMusicLibrary = null;
// Process: let cachedFlatMusicList = null
// Process: let cachedFlatMusicList = null
let cachedFlatMusicList = null;
let cachedDiscordSongOptions = null;

/**
 * Retrieves and formats the music library structure.
 * @returns {object} The music library object.
 */
/**
 * Auto-generated documentation
 */
// Process: const getMusicLibrary = () =>
// Process: const getMusicLibrary = () =>
const getMusicLibrary = () => {
    // Return empty children if config is missing
    if (!discordConfig) return { children: [] };
    // Return cached version if available
// Process: if (cachedMusicLibrary) return cachedMusicLibrary
    // Process: if (cachedMusicLibrary) return cachedMusicLibrary
    if (cachedMusicLibrary) return cachedMusicLibrary;

    // Shallow clone the music library from config
    const library = { ...(discordConfig.musicLibrary || { children: [] }) };
    // Ensure children is an array
// Process: library.children = library.children ? [...library.childre...
    // Process: library.children = library.children ? [...library.childre...
    library.children = library.children ? [...library.children] : [];

    // Process loose files (files not in the main music directory)
    const looseFiles = discordConfig.looseFiles || [];
// Process: if (looseFiles.length > 0)
    // Process: if (looseFiles.length > 0)
    if (looseFiles.length > 0) {
        // Find or create the 'Loose Files' virtual folder
        let looseFolder = library.children.find(c => c.name === 'Loose Files');
// Process: if (looseFolder)
        // Process: if (looseFolder)
        if (looseFolder) {
            // Clone to avoid mutation
            looseFolder = { ...looseFolder };
/**
 * Auto-generated documentation
 */
// Process: const idx = library.children.findIndex(c => c.name === 'L...
            // Process: const idx = library.children.findIndex(c => c.name === 'L...
            const idx = library.children.findIndex(c => c.name === 'Loose Files');
            library.children[idx] = looseFolder;
// Process: else
        // Process: else
        } else {
            // Initialize new virtual folder for loose files
            looseFolder = { name: 'Loose Files', type: 'directory', children: [], path: 'loose' };
// Process: library.children.push(looseFolder)
            // Process: library.children.push(looseFolder)
            library.children.push(looseFolder);
        }
        // Map loose file paths into the library structure
// Process: looseFolder.children = looseFiles.map(p => (
        // Process: looseFolder.children = looseFiles.map(p => (
        looseFolder.children = looseFiles.map(p => ({
            name: path.basename(p),
// Process: path: p,
            // Process: path: p,
            path: p,
            type: 'file'
// Process: ))
        // Process: ))
        }));
    }
    // Update cache and return
// Process: cachedMusicLibrary = library
    // Process: cachedMusicLibrary = library
    cachedMusicLibrary = library;
    return library;
// Process:
// Process:
};

/**
 * Returns a flat array of all music file paths in the library.
 * @returns {string[]}
 */
/**
 * Auto-generated documentation
 */
const getFlatMusicList = () => {
    // Return cached list if valid
// Process: if (cachedFlatMusicList) return cachedFlatMusicList
    // Process: if (cachedFlatMusicList) return cachedFlatMusicList
    if (cachedFlatMusicList) return cachedFlatMusicList;

    const list = [];
    /**
     * Recursive helper to traverse the library tree.
     */
/**
 * Auto-generated documentation
 */
// Process: const traverse = (node) =>
    // Process: const traverse = (node) =>
    const traverse = (node) => {
        // Add file path to list if node is a file
        if (node.type === 'file') {
// Process: list.push(node.path)
            // Process: list.push(node.path)
            list.push(node.path);
        } else if (node.children) {
            // Recurse into children of directories
// Process: node.children.forEach(traverse)
            // Process: node.children.forEach(traverse)
            node.children.forEach(traverse);
        }
// Process:
    // Process:
    };
    // Get the formatted library
    const library = getMusicLibrary();
    // Start traversal from root
// Process: traverse(library)
    // Process: traverse(library)
    traverse(library);
    // Update cache
    cachedFlatMusicList = list;
// Process: return list
    // Process: return list
    return list;
};

/**
 * Invalidates all music-related caches.
 */
/**
 * Auto-generated documentation
 */
// Process: function invalidateMusicCache()
// Process: function invalidateMusicCache()
function invalidateMusicCache() {
    // Reset library and list caches
    cachedMusicLibrary = null;
// Process: cachedFlatMusicList = null
    // Process: cachedFlatMusicList = null
    cachedFlatMusicList = null;
    // Reset Discord dropdown options cache
    cachedDiscordSongOptions = null;
// Process:
// Process:
}

let connection;
// Process: let voiceStatus = 'disconnected' // disconnected, connect...
// Process: let voiceStatus = 'disconnected'
let voiceStatus = 'disconnected'; // disconnected, connecting, connected
let isJoiningVoice = false; // Prevents race conditions during knocking/joining
// Process: let musicPlayer
// Process: let musicPlayer
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
// Process: let initiativeTracker
// Process: let initiativeTracker
let initiativeTracker;
let fiveEToolsParser;

// Anti-collision state
// Process: let isSoftLocked = false
// Process: let isSoftLocked = false
let isSoftLocked = false;

// Local Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
// Process: if (!gotTheLock)
// Process: if (!gotTheLock)
if (!gotTheLock) {
    app.quit();
// Process: else
// Process: else
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
// Process: if (mainWindow)
        // Process: if (mainWindow)
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
// Process: mainWindow.focus()
            // Process: mainWindow.focus()
            mainWindow.focus();
        }
// Process: )
    // Process: )
    });
}

// --- JSDoc Comments ---

/**
 * @file This is the main entry point for the TavernTones Electron application.
 * It handles window creation, application lifecycle events, IPC communication between
 * the main and renderer processes, and the initialization of all backend services
 * such as the Discord bot, music player, and initiative tracker.
 */

// --- Global State ---

/** @type {BrowserWindow | null} The main application window. */
// Process: let mainWindow
// Process: let mainWindow
let mainWindow;
/** @type {BrowserWindow | null} The settings window. */
let settingsWindow;
/** @type {boolean} Flag to indicate if the main window has loaded its content. */
// Process: let windowloaded = false
// Process: let windowloaded = false
let windowloaded = false;

// --- State Management ---
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');
// Process: const musicAutosavePath = path.join(app.getPath('userData...
// Process: const musicAutosavePath = path.join(app.getPath('userData...
const musicAutosavePath = path.join(app.getPath('userData'), 'music-autosave.json');

/**
 * A map of D&D 5e conditions to their emoji, color, and description.
 * @type {Object.<string, {emoji: string, color: string, text: string}>}
 */
const DND_CONDITIONS = {
// Process: "Blinded":  emoji: "🙈", color: "#6c757d", text: "You can'...
    // Process: "Blinded":  emoji: "🙈", color: "#6c757d", text: "You can'...
    "Blinded": { emoji: "🙈", color: "#6c757d", text: "You can't see and automatically fail any ability check that requires sight. Attack rolls against you have Advantage, and your attack rolls have Disadvantage." },
    "Burning": { emoji: "🔥", color: "#e74c3c", text: "A burning creature takes 1d4 Fire damage at the start of each of its turns. A creature can end this damage by using its action to make a DC 10 Dexterity check to extinguish the flames." },
// Process: "Charmed":  emoji: "😍", color: "#e83e8c", text: "You can'...
    // Process: "Charmed":  emoji: "😍", color: "#e83e8c", text: "You can'...
    "Charmed": { emoji: "😍", color: "#e83e8c", text: "You can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has Advantage on any ability check to interact socially with you." },
    "Deafened": { emoji: "🙉", color: "#adb5bd", text: "You can't hear and automatically fail any ability check that requires hearing." },
// Process: "Exhaustion":  emoji: "😩", color: "#fd7e14", text: "This ...
    // Process: "Exhaustion":  emoji: "😩", color: "#fd7e14", text: "This ...
    "Exhaustion": { emoji: "😩", color: "#fd7e14", text: "This condition is cumulative. Each time you receive it, you gain 1 Exhaustion level. You die if your Exhaustion level is 6. When you make a D20 Test the roll is reduced by 2 times your Exhaustion level. Your Speed is reduced by a number of feet equal to 5 times your Exhaustion level." },
    "Frightened": { emoji: "😨", color: "#6f42c1", text: "You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight. You can't willingly move closer to the source of your fear." },
// Process: "Grappled":  emoji: "🤼", color: "#fd7e14", text: "Your sp...
    // Process: "Grappled":  emoji: "🤼", color: "#fd7e14", text: "Your sp...
    "Grappled": { emoji: "🤼", color: "#fd7e14", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. The condition ends if the grappler is incapacitated. The condition also ends if an effect removes the grappled creature from the reach of the grappler." },
    "Incapacitated": { emoji: "😵", color: "#6c757d", text: "You can't take actions or reactions. Your Concentration in broken. You can't speak." },
// Process: "Invisible":  emoji: "👻", color: "#f8f9fa", text: "You ar...
    // Process: "Invisible":  emoji: "👻", color: "#f8f9fa", text: "You ar...
    "Invisible": { emoji: "👻", color: "#f8f9fa", text: "You are Concealed. You aren't affected by any effect that requires its target to be seen unless the effect's creator can somehow see you. Any equipment you are wearing or carrying is also concealed. Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don't gain this benefit against that creature." },
    "Paralyzed": { emoji: "⚡", color: "#007bff", text: "You are Incapacitated and can't move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
// Process: "Petrified":  emoji: "🪨", color: "#343a40", text: "You ha...
    // Process: "Petrified":  emoji: "🪨", color: "#343a40", text: "You ha...
    "Petrified": { emoji: "🪨", color: "#343a40", text: "You have the Incapacitated condition. Your Speed is 0 and can't increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Poisoned": { emoji: "🤢", color: "#28a745", text: "You have Disadvantage on attack rolls and ability checks." },
// Process: "Prone":  emoji: "🛌", color: "#ffc107", text: "Your only ...
    // Process: "Prone":  emoji: "🛌", color: "#ffc107", text: "Your only ...
    "Prone": { emoji: "🛌", color: "#ffc107", text: "Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage." },
    "Restrained": { emoji: "⛓️", color: "#6c757d", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws." },
// Process: "Stunned":  emoji: "😵‍💫", color: "#ffc107", text: "You ar...
    // Process: "Stunned":  emoji: "😵‍💫", color: "#ffc107", text: "You ar...
    "Stunned": { emoji: "😵‍💫", color: "#ffc107", text: "You are Incapacitated, can't move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Unconscious": { emoji: "😴", color: "#343a40", text: "You are Incapacitated, can't move or speak, and are unaware of your surroundings. You drop whatever you're holding and fall prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.) (Prone: Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.)" }
// Process:
// Process:
};

const hpBarEmojiMap = {
// Process: '#007bff': '🟦',      // Blue (100%)
    // Process: '#007bff': '🟦',
    '#007bff': '🟦',      // Blue (100%)
    '#28a745': '🟩',     // Green (50-99%)
// Process: '#ffc107': '🟨',    // Yellow (25-49%)
    // Process: '#ffc107': '🟨',
    '#ffc107': '🟨',    // Yellow (25-49%)
    '#dc3545': '🟥',       // Red (<25%)
// Process: '#8a2be2': '🟪',    // Purple (Temp HP)
    // Process: '#8a2be2': '🟪',
    '#8a2be2': '🟪',    // Purple (Temp HP)
    '#6c757d': '💀',     // Dead
// Process: 'empty': '⬛'
    // Process: 'empty': '⬛'
    'empty': '⬛'
};

/**
 * Sends updated initiative data to the renderer process.
 * @param {object[]} initiativeOrder - The current initiative order.
 * @param {number} currentTurnIndex - Index of the current turn.
 * @param {any} [extra=null] - Optional additional data.
 */
// Process: async function sendInitiativeUpdate(initiativeOrder, curr...
// Process: async function sendInitiativeUpdate(initiativeOrder, curr...
async function sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra = null) {
    // Only send if app is ready and window exists
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
// Process: mainWindow.webContents.send('update-initiative-list',  in...
        // Process: mainWindow.webContents.send('update-initiative-list',  in...
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex, extra });
    }
// Process: else if (!isAppReady)
    // Process: else if (!isAppReady)
    else if (!isAppReady) {
        // Wait and retry if app is not yet initialized
        await sleep(100);
// Process: sendInitiativeUpdate(initiativeOrder, currentTurnIndex, e...
        // Process: sendInitiativeUpdate(initiativeOrder, currentTurnIndex, e...
        sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra);
    }
// Process:
// Process:
}

/**
 * Sends a dice roll log entry to the renderer.
 * @param {string} message - The roll description.
 */
async function logDiceRollToRenderer(message) {
    // Verify window state before sending
// Process: if (isAppReady && mainWindow && !mainWindow.isDestroyed()...
    // Process: if (isAppReady && mainWindow && !mainWindow.isDestroyed()...
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('dice-log', message);
// Process: else if (!isAppReady)
    // Process: else if (!isAppReady)
    } else if (!isAppReady) {
        // Retry loop if app is starting up
        await sleep(100);
// Process: logDiceRollToRenderer(message)
        // Process: logDiceRollToRenderer(message)
        logDiceRollToRenderer(message);
    }
// Process:
// Process:
}

/**
 * Utility to pause execution.
 * @param {number} ms - Time in milliseconds.
 * @returns {Promise}
 */
/**
 * Auto-generated documentation
 */
function sleep(ms) {
    // Clamp to minimum 0
// Process: const safeMs = Math.max(0, Number(ms) || 0)
    // Process: const safeMs = Math.max(0, Number(ms) || 0)
    const safeMs = Math.max(0, Number(ms) || 0);
    return new Promise(resolve => setTimeout(resolve, safeMs));
// Process:
// Process:
}

//Begin UI
// Electron Setup
/**
 * Creates and loads the main application window.
 * @param {boolean} [showWindow=true] - Whether to show the window immediately after creation.
 * @returns {Promise<void>}
 */
async function createWindow(showWindow = true) {
// Process: console.log('createWindow() called.')
    // Process: console.log('createWindow() called.')
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
// Process: show: false, // Do not show the window until it's ready
        // Process: show: false,
        show: false, // Do not show the window until it's ready
        webPreferences: {
// Process: preload: path.join(__dirname, '../../ui/preload.js'),
            // Process: preload: path.join(__dirname, '../../ui/preload.js'),
            preload: path.join(__dirname, '../../ui/preload.js'),
            contextIsolation: true,
// Process: enableRemoteModule: false,
            // Process: enableRemoteModule: false,
            enableRemoteModule: false,
            nodeIntegration: true
// Process:
        // Process:
        }
    });

// Process: if (showWindow)
    // Process: if (showWindow)
    if (showWindow) {
        mainWindow.maximize();
// Process: mainWindow.show()
        // Process: mainWindow.show()
        mainWindow.show();
        console.log('Window created and shown.');
// Process: else
    // Process: else
    } else {
        console.log('Window created minimized.');
// Process:
    // Process:
    }

    await mainWindow.loadFile(path.join(__dirname, '../../ui/Index.html'));
// Process: console.log('index.html loaded.')
    // Process: console.log('index.html loaded.')
    console.log('index.html loaded.');
    windowloaded = true;
// Process:
// Process:
}

/**
 * Creates and shows the settings window. If the window already exists, it focuses it.
 */
/**
 * Auto-generated documentation
 */
function createSettingsWindow() {
// Process: if (settingsWindow)
    // Process: if (settingsWindow)
    if (settingsWindow) {
        settingsWindow.focus();
// Process: return
        // Process: return
        return;
    }

// Process: settingsWindow = new BrowserWindow(
    // Process: settingsWindow = new BrowserWindow(
    settingsWindow = new BrowserWindow({
        width: 900,
// Process: height: 700,
        // Process: height: 700,
        height: 700,
        webPreferences: {
// Process: preload: path.join(__dirname, '../../ui/settings/settings...
            // Process: preload: path.join(__dirname, '../../ui/settings/settings...
            preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
            contextIsolation: true,
// Process: enableRemoteModule: false,
            // Process: enableRemoteModule: false,
            enableRemoteModule: false,
            nodeIntegration: true
// Process:
        // Process:
        }
    });

// Process: settingsWindow.loadFile(path.join(__dirname, '../../ui/se...
    // Process: settingsWindow.loadFile(path.join(__dirname, '../../ui/se...
    settingsWindow.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));

    settingsWindow.on('closed', () => {
// Process: settingsWindow = null
        // Process: settingsWindow = null
        settingsWindow = null;
    });
// Process:
// Process:
}

/**
 * The main application loader. This function is responsible for initializing the application,
 * creating the main window, checking for necessary configurations, and setting up all
 * backend services and IPC handlers. It runs once the Electron app is ready.
 */
async function apploader() {
// Process: await app.whenReady().then(async () =>
    // Process: await app.whenReady().then(async () =>
    await app.whenReady().then(async () => {
        discordConfig = await getDiscordConfig();
// Process: protocol.handle('safe-media', async (request) =>
        // Process: protocol.handle('safe-media', async (request) =>
        protocol.handle('safe-media', async (request) => {
            try {
// Process: const url = new URL(request.url)
                // Process: const url = new URL(request.url)
                const url = new URL(request.url);
                const absolutePath = url.searchParams.get('path');

// Process: if (!absolutePath || !fs.existsSync(absolutePath))
                // Process: if (!absolutePath || !fs.existsSync(absolutePath))
                if (!absolutePath || !fs.existsSync(absolutePath)) {
                    console.error(`[safe-media] File not found or invalid: ${absolutePath}`);
// Process: return new Response('File not found',  status: 404 )
                    // Process: return new Response('File not found',  status: 404 )
                    return new Response('File not found', { status: 404 });
                }

// Process: const ext = path.extname(absolutePath).toLowerCase()
                // Process: const ext = path.extname(absolutePath).toLowerCase()
                const ext = path.extname(absolutePath).toLowerCase();
                const mimeTypes = {
// Process: '.mp3': 'audio/mpeg',
                    // Process: '.mp3': 'audio/mpeg',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
// Process: '.ogg': 'audio/ogg'
                    // Process: '.ogg': 'audio/ogg'
                    '.ogg': 'audio/ogg'
                };
// Process: const contentType = mimeTypes[ext] || 'audio/mpeg'
                // Process: const contentType = mimeTypes[ext] || 'audio/mpeg'
                const contentType = mimeTypes[ext] || 'audio/mpeg';

                // Reading file into memory for the Response.
                // This is less efficient but avoids many issues with custom protocols and Range requests.
                const buffer = await fs.promises.readFile(absolutePath);
// Process: return new Response(buffer,
                // Process: return new Response(buffer,
                return new Response(buffer, {
                    headers: { 'Content-Type': contentType }
// Process: )
                // Process: )
                });

            } catch (error) {
// Process: console.error('[safe-media] Protocol error:', error)
                // Process: console.error('[safe-media] Protocol error:', error)
                console.error('[safe-media] Protocol error:', error);
                return new Response('Error: ' + error.message, { status: 500 });
// Process:
            // Process:
            }
        });
// Process: console.log('App is ready.')
        // Process: console.log('App is ready.')
        console.log('App is ready.');

        // Initialize components
        musicPlayer = new BackendAudioPlayer(logToRenderer, shell, discordConfig.defaultMusicPath, discordConfig.ffmpegPath);
// Process: setupFilesystemWatchers(discordConfig)
        // Process: setupFilesystemWatchers(discordConfig)
        setupFilesystemWatchers(discordConfig);

        // --- Start Music Library Scan ---
        if (discordConfig.defaultMusicPath) {
            // Load from cache immediately for speed
// Process: if (discordConfig.musicLibrary)
            // Process: if (discordConfig.musicLibrary)
            if (discordConfig.musicLibrary) {
                ipcMain.handleOnce('get-music-library-ready', () => true); // Signal that initial data is there
// Process:
            // Process:
            }
            scanMusicLibrary();
// Process:
        // Process:
        }
        ipcloader(); // Load all IPC handlers BEFORE creating window
// Process: fiveEToolsParser = new FiveEToolsParser(logToRenderer, ap...
        // Process: fiveEToolsParser = new FiveEToolsParser(logToRenderer, ap...
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app, discordConfig);

        // Check for folder configuration first
        const { bestiaryPath, randomTablesPath } = discordConfig;
// Process: const pathsConfigured = bestiaryPath && randomTablesPath
        // Process: const pathsConfigured = bestiaryPath && randomTablesPath
        const pathsConfigured = bestiaryPath && randomTablesPath;

        if (!pathsConfigured) {
// Process: logToRenderer("Essential data folders are not configured.")
            // Process: logToRenderer("Essential data folders are not configured.")
            logToRenderer("Essential data folders are not configured.");
            await dialog.showMessageBox(null, {
// Process: type: 'warning',
                // Process: type: 'warning',
                type: 'warning',
                title: 'Configuration Required',
// Process: message: 'One or more essential data folders have not bee...
                // Process: message: 'One or more essential data folders have not bee...
                message: 'One or more essential data folders have not been set up. Please configure them in the settings.',
                buttons: ['Go to Settings']
// Process: )
            // Process: )
            });
            createSettingsWindow();
// Process: return // Halt further initialization.
            // Process: return
            return; // Halt further initialization.
        }

        // If we've reached here, paths are configured, so we can show the main window.
// Process: await createWindow(true)
        // Process: await createWindow(true)
        await createWindow(true);
        isAppReady = true;

        // Handle Discord Bot setup.
// Process: if (discordConfig && discordConfig.enabled)
        // Process: if (discordConfig && discordConfig.enabled)
        if (discordConfig && discordConfig.enabled) {
            if (!discordConfig.token) {
// Process: logToRenderer("Discord token not found despite bot being ...
                // Process: logToRenderer("Discord token not found despite bot being ...
                logToRenderer("Discord token not found despite bot being enabled. Bot functionality will be disabled.");
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
// Process: else
            // Process: else
            } else {
                initializeDiscordBot();
// Process:
            // Process:
            }
        } else {
// Process: logToRenderer("Discord bot is disabled in settings.")
            // Process: logToRenderer("Discord bot is disabled in settings.")
            logToRenderer("Discord bot is disabled in settings.");
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Disabled' });
// Process:
        // Process:
        }

        app.on('activate', () => {
// Process: if (BrowserWindow.getAllWindows().length === 0)
            // Process: if (BrowserWindow.getAllWindows().length === 0)
            if (BrowserWindow.getAllWindows().length === 0) {
                // Re-check config on activate, in case it was the only window.
                if (pathsConfigured) {
// Process: createWindow(true)
                    // Process: createWindow(true)
                    createWindow(true);
                } else {
// Process: createSettingsWindow()
                    // Process: createSettingsWindow()
                    createSettingsWindow();
                }
// Process:
            // Process:
            }
        });
// Process: )
    // Process: )
    });
}

// Process: ipcMain.handle('get-dnd-conditions', async () =>
// Process: ipcMain.handle('get-dnd-conditions', async () =>
ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
// Process: )
// Process: )
});

ipcMain.handle('get-mob-rules-data', async () => {
// Process: return mobRules
    // Process: return mobRules
    return mobRules;
});

// Process: ipcMain.handle('get-image-as-data-url', async (event, rel...
// Process: ipcMain.handle('get-image-as-data-url', async (event, rel...
ipcMain.handle('get-image-as-data-url', async (event, relativePath) => {
    logToRenderer(`[IPC] Received 'get-image-as-data-url' request with relative path: ${relativePath}`);
// Process: const basePath = app.isPackaged ? process.resourcesPath :...
    // Process: const basePath = app.isPackaged ? process.resourcesPath :...
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    logToRenderer(`[IPC] Determined base path: ${basePath} (isPackaged: ${app.isPackaged})`);

// Process: const absoluteImagePath = app.isPackaged ? path.join(base...
    // Process: const absoluteImagePath = app.isPackaged ? path.join(base...
    const absoluteImagePath = app.isPackaged ? path.join(basePath, 'MobRules', 'MobRules.png') : path.join(basePath, relativePath);
    logToRenderer(`[IPC] Constructed absolute image path: ${absoluteImagePath}`);

// Process: try
    // Process: try
    try {
        logToRenderer(`[IPC] Attempting to read file at: ${absoluteImagePath}`);
// Process: const data = await fs.readFile(absoluteImagePath)
        // Process: const data = await fs.readFile(absoluteImagePath)
        const data = await fs.readFile(absoluteImagePath);
        const extension = path.extname(absoluteImagePath).substring(1);
// Process: const dataUrl = `data:image/$extensionbase64,$data.toStri...
        // Process: const dataUrl = `data:image/$extensionbase64,$data.toStri...
        const dataUrl = `data:image/${extension};base64,${data.toString('base64')}`;
        logToRenderer(`[IPC] Successfully read and encoded image.`);
// Process: return  success: true, dataUrl: dataUrl, absolutePath: ab...
        // Process: return  success: true, dataUrl: dataUrl, absolutePath: ab...
        return { success: true, dataUrl: dataUrl, absolutePath: absoluteImagePath };
    } catch (error) {
// Process: const errorMessage = `Failed to read image file. Error: $...
        // Process: const errorMessage = `Failed to read image file. Error: $...
        const errorMessage = `Failed to read image file. Error: ${error.message}`;
        logToRenderer(`[IPC] Error: ${errorMessage}`);
// Process: return  success: false, error: errorMessage, absolutePath...
        // Process: return  success: false, error: errorMessage, absolutePath...
        return { success: false, error: errorMessage, absolutePath: absoluteImagePath };
    }
// Process: )
// Process: )
});

// Disable hardware acceleration for headless environments (e.g., Playwright)
// This prevents crashes related to GPU initialization.
app.disableHardwareAcceleration();

// Handle uncaught exceptions to prevent the app from crashing on non-critical stream errors
// Process: process.on('uncaughtException', (error) =>
// Process: process.on('uncaughtException', (error) =>
process.on('uncaughtException', (error) => {
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        // This error is a known side effect of destroying audio streams during track changes or shutdown.
        // It is harmless in this context and can be safely ignored.
// Process: return
        // Process: return
        return;
    }
// Process: console.error('Uncaught Exception in Main Process:', error)
    // Process: console.error('Uncaught Exception in Main Process:', error)
    console.error('Uncaught Exception in Main Process:', error);
});

// Process: apploader()
// Process: apploader()
apploader();



/**
 * Creates a visual HP bar using emojis.
 * @param {object} creature - The combatant object.
 * @returns {string} Emoji string.
 */
/**
 * Auto-generated documentation
 */
function createEmojiHpBar(creature) {
// Process: const BAR_LENGTH = 8
    // Process: const BAR_LENGTH = 8
    const BAR_LENGTH = 8;
    const hp = creature.hp || 0;
// Process: const maxHp = creature.maxHp || 1
    // Process: const maxHp = creature.maxHp || 1
    const maxHp = creature.maxHp || 1;
    const tempHp = creature.tempHp || 0;

    // Return dead blocks if HP is 0 or less
// Process: if (hp <= 0)
    // Process: if (hp <= 0)
    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(BAR_LENGTH);
// Process:
    // Process:
    }

    // Calculate number of blocks for HP and Temp HP
    const hpBlocks = Math.round((hp / maxHp) * BAR_LENGTH);
// Process: const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tem...
    // Process: const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tem...
    const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tempHp / maxHp) * BAR_LENGTH));

    // Get color theme for HP
    const hpColorEmoji = hpBarEmojiMap[getHpColor(hp, maxHp)] || hpBarEmojiMap['#007bff'];
// Process: const tempHpEmoji = hpBarEmojiMap['#8a2be2']
    // Process: const tempHpEmoji = hpBarEmojiMap['#8a2be2']
    const tempHpEmoji = hpBarEmojiMap['#8a2be2'];
    const emptyEmoji = hpBarEmojiMap['empty'];

// Process: let bar = ''
    // Process: let bar = ''
    let bar = '';
    // Build bar string block by block
    for (let i = 0; i < BAR_LENGTH; i++) {
// Process: if (i < tempHpBlocks)
        // Process: if (i < tempHpBlocks)
        if (i < tempHpBlocks) {
            bar += tempHpEmoji;
// Process: else if (i < hpBlocks)
        // Process: else if (i < hpBlocks)
        } else if (i < hpBlocks) {
            bar += hpColorEmoji;
// Process: else
        // Process: else
        } else {
            bar += emptyEmoji;
// Process:
        // Process:
        }
    }
// Process: return bar
    // Process: return bar
    return bar;
}

/**
 * Formats a monster's stat block for Discord display.
 * @param {object} monster - Monster data.
 * @returns {object} Object containing mainEmbed and longFields.
 */
/**
 * Auto-generated documentation
 */
// Process: function formatStatBlockForDiscord(monster)
// Process: function formatStatBlockForDiscord(monster)
function formatStatBlockForDiscord(monster) {
    // Part 1: Create the main embed with core stats
    const mainEmbed = new EmbedBuilder()
// Process: .setColor(0x0099FF)
        // Process: .setColor(0x0099FF)
        .setColor(0x0099FF);

    // Build the header and core stats description
    let description = `# ${monster.name}\n*${monster.size} ${typeof monster.type === 'object' ? monster.type.type : monster.type}, ${monster.alignment}*\n\n`;
/**
 * Auto-generated documentation
 */
// Process: const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` ...
    // Process: const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` ...
    const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` (${a.from.join(', ')})` : '')).join(', ');
    description += `**Armor Class** ${ac}\n`;
// Process: description += `**Hit Points** $monster.hp.average ($mons...
    // Process: description += `**Hit Points** $monster.hp.average ($mons...
    description += `**Hit Points** ${monster.hp.average} (${monster.hp.formula})\n`;
    description += `**Speed** ${Object.entries(monster.speed).map(([type, val]) => `${type} ${val.number || val} ft.`).join(', ')}\n\n`;

    /**
     * Helper to format ability modifiers.
     */
/**
 * Auto-generated documentation
 */
// Process: const formatMod = (score) =>
    // Process: const formatMod = (score) =>
    const formatMod = (score) => {
        const mod = Math.floor(((score || 10) - 10) / 2);
// Process: return mod >= 0 ? `+$mod` : `$mod`
        // Process: return mod >= 0 ? `+$mod` : `$mod`
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };
    // Add ability scores
// Process: description += `**STR** $monster.str ($formatMod(monster....
    // Process: description += `**STR** $monster.str ($formatMod(monster....
    description += `**STR** ${monster.str} (${formatMod(monster.str)}) | **DEX** ${monster.dex} (${formatMod(monster.dex)}) | **CON** ${monster.con} (${formatMod(monster.con)})\n`;
    description += `**INT** ${monster.int} (${formatMod(monster.int)}) | **WIS** ${monster.wis} (${formatMod(monster.wis)}) | **CHA** ${monster.cha} (${formatMod(monster.cha)})`;

// Process: mainEmbed.setDescription(description)
    // Process: mainEmbed.setDescription(description)
    mainEmbed.setDescription(description);

    // Part 2: Prepare long fields for separate messages
    const longFields = [];
    /**
     * Helper to process nested entry arrays into strings.
     */
/**
 * Auto-generated documentation
 */
// Process: const processEntries = (entries) =>
    // Process: const processEntries = (entries) =>
    const processEntries = (entries) => {
        if (!entries) return '';
// Process: return entries.map(e =>
        // Process: return entries.map(e =>
        return entries.map(e => {
            if (typeof e === 'string') return e;
// Process: if (e.name && e.entries)
            // Process: if (e.name && e.entries)
            if (e.name && e.entries) {
                const entryText = e.entries.join(' ').replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)');
// Process: return `**_$e.name._** $entryText`
                // Process: return `**_$e.name._** $entryText`
                return `**_${e.name}._** ${entryText}`;
            }
// Process: return ''
            // Process: return ''
            return '';
        }).join('\n\n');
// Process:
    // Process:
    };

    // Separate long content into dedicated fields for threads
    if (monster.trait && monster.trait.length > 0) {
// Process: longFields.push( name: 'Traits', value: processEntries(mo...
        // Process: longFields.push( name: 'Traits', value: processEntries(mo...
        longFields.push({ name: 'Traits', value: processEntries(monster.trait) });
    }
// Process: if (monster.action && monster.action.length > 0)
    // Process: if (monster.action && monster.action.length > 0)
    if (monster.action && monster.action.length > 0) {
        longFields.push({ name: 'Actions', value: processEntries(monster.action) });
// Process:
    // Process:
    }
    if (monster.legendary && monster.legendary.length > 0) {
// Process: longFields.push( name: 'Legendary Actions', value: proces...
        // Process: longFields.push( name: 'Legendary Actions', value: proces...
        longFields.push({ name: 'Legendary Actions', value: processEntries(monster.legendary) });
    }
// Process: if (monster.reaction && monster.reaction.length > 0)
    // Process: if (monster.reaction && monster.reaction.length > 0)
    if (monster.reaction && monster.reaction.length > 0) {
        longFields.push({ name: 'Reactions', value: processEntries(monster.reaction) });
// Process:
    // Process:
    }

    return { mainEmbed, longFields };
// Process:
// Process:
}

/**
 * Prepares the Mob Rules reference embed for Discord.
 * @param {string} creatureName - Name of the mob.
 * @returns {object} Embed and image path.
 */
/**
 * Auto-generated documentation
 */
function formatMobRulesForDiscord(creatureName) {
// Process: const  discord: discordData, imagePath  = mobRules
    // Process: const  discord: discordData, imagePath  = mobRules
    const { discord: discordData, imagePath } = mobRules;

    // Create the rule reference embed
    const mainEmbed = new EmbedBuilder()
// Process: .setColor(0xFFA500) // Use orange theme
        // Process: .setColor(0xFFA500)
        .setColor(0xFFA500) // Use orange theme
        .setTitle(`${discordData.title}: ${creatureName}`)
// Process: .setDescription(discordData.description)
        // Process: .setDescription(discordData.description)
        .setDescription(discordData.description)
        .addFields(...discordData.fields)
        // Reference the attached image file
// Process: .setImage(`attachment://$path.basename(imagePath)`)
        // Process: .setImage(`attachment:
        .setImage(`attachment://${path.basename(imagePath)}`);

    return { mainEmbed, imagePath };
// Process:
// Process:
}

/**
 * Splits a long string into chunks for Discord.
 * @param {string} text - Input text.
 * @param {number} [maxLength=1024] - Max length per chunk.
 * @returns {string[]}
 */
/**
 * Auto-generated documentation
 */
function splitText(text, maxLength = 1024) {
// Process: const chunks = []
    // Process: const chunks = []
    const chunks = [];
    if (!text) return chunks;

// Process: let currentChunk = ""
    // Process: let currentChunk = ""
    let currentChunk = "";
    // Split by line to avoid breaking words where possible
    const lines = text.split('\n');

// Process: for (const line of lines)
    // Process: for (const line of lines)
    for (const line of lines) {
        // Forcefully split lines that are too long
        if (line.length > maxLength) {
// Process: if (currentChunk)
            // Process: if (currentChunk)
            if (currentChunk) {
                chunks.push(currentChunk);
// Process: currentChunk = ""
                // Process: currentChunk = ""
                currentChunk = "";
            }
// Process: const lineChunks = line.match(new RegExp(`.1,$maxLength`,...
            // Process: const lineChunks = line.match(new RegExp(`.1,$maxLength`,...
            const lineChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            chunks.push(...lineChunks);
// Process: continue
            // Process: continue
            continue;
        }

        // Buffer the next line
// Process: if (currentChunk.length + line.length + 1 > maxLength)
        // Process: if (currentChunk.length + line.length + 1 > maxLength)
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
// Process: currentChunk = ""
            // Process: currentChunk = ""
            currentChunk = "";
        }

        // Add the line to the current chunk
// Process: currentChunk += (currentChunk ? '\n' : '') + line
        // Process: currentChunk += (currentChunk ? '\n' : '') + line
        currentChunk += (currentChunk ? '\n' : '') + line;
    }

    // Add final chunk
// Process: if (currentChunk)
    // Process: if (currentChunk)
    if (currentChunk) {
        chunks.push(currentChunk);
// Process:
    // Process:
    }

    return chunks;
// Process:
// Process:
}

/**
 * Shows turn-based reminders in an Electron dialog.
 * @param {object} creature - The active combatant.
 * @param {string} turnEvent - 'start' or 'end'.
 */
async function checkAndShowReminders(creature, turnEvent) {
// Process: if (!creature) return
    // Process: if (!creature) return
    if (!creature) return;

    let reminderMessages = [];
    // Check for user-defined reminders
// Process: const reminderText = creature.reminders ? creature.remind...
    // Process: const reminderText = creature.reminders ? creature.remind...
    const reminderText = creature.reminders ? creature.reminders[turnEvent] : '';
    if (reminderText) {
// Process: reminderMessages.push(reminderText)
        // Process: reminderMessages.push(reminderText)
        reminderMessages.push(reminderText);
    }

    // Auto-reminder for legendary actions
// Process: if (turnEvent === 'end' && creature.isFriendly)
    // Process: if (turnEvent === 'end' && creature.isFriendly)
    if (turnEvent === 'end' && creature.isFriendly) {
        reminderMessages.push(`Legendary Action Reminder: End of ${creature.name}'s turn.`);
// Process:
    // Process:
    }

    // Show popup if any reminders were found
    if (reminderMessages.length > 0) {
// Process: const message = reminderMessages.join('\n\n')
        // Process: const message = reminderMessages.join('\n\n')
        const message = reminderMessages.join('\n\n');
        await dialog.showMessageBox(mainWindow, {
// Process: type: 'info',
            // Process: type: 'info',
            type: 'info',
            title: `Reminder for ${creature.name}`,
// Process: message: `$turnEvent.charAt(0).toUpperCase() + turnEvent....
            // Process: message: `$turnEvent.charAt(0).toUpperCase() + turnEvent....
            message: `${turnEvent.charAt(0).toUpperCase() + turnEvent.slice(1)} of Turn`,
            detail: message,
// Process: buttons: ['OK']
            // Process: buttons: ['OK']
            buttons: ['OK']
        });
// Process:
    // Process:
    }
}

// Process: const InitiativeTracker = require('../features/Initiative...
// Process: const InitiativeTracker = require('../features/Initiative...
const InitiativeTracker = require('../features/InitiativeTracker.js');

/**
 * Initializes OS-level file watchers for data directories.
 * @param {object} config - Configuration object.
 */
/**
 * Auto-generated documentation
 */
function setupFilesystemWatchers(config) {
// Process: const  defaultMusicPath, randomTablesPath, bestiaryPath  ...
    // Process: const  defaultMusicPath, randomTablesPath, bestiaryPath  ...
    const { defaultMusicPath, randomTablesPath, bestiaryPath } = config;

    // Define folders to watch and their update callbacks
    const watchers = [
// Process: name: 'Music', path: defaultMusicPath, callback: () => mu...
        // Process: name: 'Music', path: defaultMusicPath, callback: () => mu...
        { name: 'Music', path: defaultMusicPath, callback: () => musicPlayer && musicPlayer._emitStatusUpdate() },
        { name: 'Random Tables', path: randomTablesPath, callback: () => logToRenderer("Random tables folder changed. Refreshing...") },
// Process: name: 'Bestiary', path: bestiaryPath, callback: () => log...
        // Process: name: 'Bestiary', path: bestiaryPath, callback: () => log...
        { name: 'Bestiary', path: bestiaryPath, callback: () => logToRenderer("Bestiary folder changed. Refreshing...") }
    ];

// Process: const watcherTimers = new Map()
    // Process: const watcherTimers = new Map()
    const watcherTimers = new Map();

    watchers.forEach(w => {
        // Verify path existence before watching
// Process: if (w.path && fs.existsSync(w.path))
        // Process: if (w.path && fs.existsSync(w.path))
        if (w.path && fs.existsSync(w.path)) {
            try {
                // Watch for changes recursively
// Process: fs.watch(w.path,  recursive: true , (eventType, filename) =>
                // Process: fs.watch(w.path,  recursive: true , (eventType, filename) =>
                fs.watch(w.path, { recursive: true }, (eventType, filename) => {
                    // Debounce watcher events to prevent system spam
                    const timerKey = `${w.name}:${filename}`;
// Process: if (watcherTimers.has(timerKey))
                    // Process: if (watcherTimers.has(timerKey))
                    if (watcherTimers.has(timerKey)) {
                        clearTimeout(watcherTimers.get(timerKey));
// Process:
                    // Process:
                    }

                    // Execute callback after 500ms of stability
/**
 * Auto-generated documentation
 */
                    const timer = setTimeout(() => {
// Process: logToRenderer(`[Watcher] $w.name change detected: $eventT...
                        // Process: logToRenderer(`[Watcher] $w.name change detected: $eventT...
                        logToRenderer(`[Watcher] ${w.name} change detected: ${eventType} ${filename || ''}`);
                        w.callback();
// Process: watcherTimers.delete(timerKey)
                        // Process: watcherTimers.delete(timerKey)
                        watcherTimers.delete(timerKey);
                    }, 500);

// Process: watcherTimers.set(timerKey, timer)
                    // Process: watcherTimers.set(timerKey, timer)
                    watcherTimers.set(timerKey, timer);
                });
// Process: logToRenderer(`[Watcher] Started watching $w.name: $w.path`)
                // Process: logToRenderer(`[Watcher] Started watching $w.name: $w.path`)
                logToRenderer(`[Watcher] Started watching ${w.name}: ${w.path}`);
            } catch (err) {
// Process: logToRenderer(`[Watcher] Failed to watch $w.name: $err.me...
                // Process: logToRenderer(`[Watcher] Failed to watch $w.name: $err.me...
                logToRenderer(`[Watcher] Failed to watch ${w.name}: ${err.message}`);
            }
// Process:
        // Process:
        }
    });
// Process:
// Process:
}

/**
 * Registers all IPC (Inter-Process Communication) handlers for the application.
 * This function sets up listeners for events from the renderer process, allowing
 * the frontend to interact with the backend services like the file system,
 * music player, initiative tracker, and more.
 */
async function ipcloader() {
// Process: ipcMain.on('window-ready', () =>
    // Process: ipcMain.on('window-ready', () =>
    ipcMain.on('window-ready', () => {
        // Handle window ready if needed, or just let it be a signal
    });

    // Helper function to open a directory selection dialog
/**
 * Auto-generated documentation
 */
// Process: const selectDirectory = async (title) =>
    // Process: const selectDirectory = async (title) =>
    const selectDirectory = async (title) => {
        const { filePaths } = await dialog.showOpenDialog(settingsWindow || mainWindow, {
// Process: title,
            // Process: title,
            title,
            properties: ['openDirectory']
// Process: )
        // Process: )
        });
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
// Process:
    // Process:
    };

    // IPC Handlers for individual folder browsing
    ipcMain.handle('select-bestiary-folder', () => selectDirectory('Select Bestiary Data Folder'));
// Process: ipcMain.handle('select-random-tables-folder', () => selec...
    // Process: ipcMain.handle('select-random-tables-folder', () => selec...
    ipcMain.handle('select-random-tables-folder', () => selectDirectory('Select Random Tables Folder'));
    ipcMain.handle('select-music-folder', () => selectDirectory('Select Default Music Folder'));
// Process: ipcMain.handle('select-ffmpeg-bin-folder', () => selectDi...
    // Process: ipcMain.handle('select-ffmpeg-bin-folder', () => selectDi...
    ipcMain.handle('select-ffmpeg-bin-folder', () => selectDirectory('Select Folder Containing FFmpeg and ffprobe'));

    // IPC Handler for setting up all default folders with improved error handling and OneDrive support
    ipcMain.handle('setup-default-folders', async () => {
// Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        // Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select a Parent Directory for Tavern Tones Data',
// Process: defaultPath: app.getPath('documents'),
            // Process: defaultPath: app.getPath('documents'),
            defaultPath: app.getPath('documents'),
            properties: ['openDirectory']
// Process: )
        // Process: )
        });

        if (!filePaths || filePaths.length === 0) {
// Process: return null // User cancelled
            // Process: return null
            return null; // User cancelled
        }

// Process: const parentDir = filePaths[0]
        // Process: const parentDir = filePaths[0]
        const parentDir = filePaths[0];
        const dataDir = path.join(parentDir, 'Tavern Tones');

// Process: try
        // Process: try
        try {
            // Ensure the main data directory exists
            if (!fs.existsSync(dataDir)) {
// Process: await fs.promises.mkdir(dataDir,  recursive: true )
                // Process: await fs.promises.mkdir(dataDir,  recursive: true )
                await fs.promises.mkdir(dataDir, { recursive: true });
            }

// Process: const paths =
            // Process: const paths =
            const paths = {
                bestiaryPath: path.join(dataDir, 'bestiary'),
// Process: randomTablesPath: path.join(dataDir, 'randomtables'),
                // Process: randomTablesPath: path.join(dataDir, 'randomtables'),
                randomTablesPath: path.join(dataDir, 'randomtables'),
                defaultMusicPath: path.join(dataDir, 'music')
// Process:
            // Process:
            };

            // Create all subdirectories
            for (const p of Object.values(paths)) {
// Process: if (!fs.existsSync(p))
                // Process: if (!fs.existsSync(p))
                if (!fs.existsSync(p)) {
                    await fs.promises.mkdir(p, { recursive: true });
// Process:
                // Process:
                }
            }

            // Copy default data (random tables) from the application package
// Process: const sourcePath = app.getAppPath()
            // Process: const sourcePath = app.getAppPath()
            const sourcePath = app.getAppPath();
            const sourceTables = path.join(sourcePath, 'randomtables');

// Process: if (fs.existsSync(sourceTables))
            // Process: if (fs.existsSync(sourceTables))
            if (fs.existsSync(sourceTables)) {
                // Use a more compatible copy approach if cp is missing or fails
                if (fs.promises.cp) {
// Process: await fs.promises.cp(sourceTables, paths.randomTablesPath...
                    // Process: await fs.promises.cp(sourceTables, paths.randomTablesPath...
                    await fs.promises.cp(sourceTables, paths.randomTablesPath, { recursive: true, force: true });
                } else {
                    // Fallback for older Node versions (shouldn't happen in recent Electron)
// Process: const ncp = require('util').promisify(require('fs').copyF...
                    // Process: const ncp = require('util').promisify(require('fs').copyF...
                    const ncp = require('util').promisify(require('fs').copyFile); // simplistic
                    // Actually, let's assume cp is available in modern Electron.
                    throw new Error("fs.promises.cp is required for folder copying.");
// Process:
                // Process:
                }
            }

// Process: await dialog.showMessageBox(mainWindow,
            // Process: await dialog.showMessageBox(mainWindow,
            await dialog.showMessageBox(mainWindow, {
                type: 'info',
// Process: title: 'Success',
                // Process: title: 'Success',
                title: 'Success',
                message: `Default folders created inside:\n${dataDir}\n\nYou can now fetch bestiary data from the settings.`,
// Process: buttons: ['OK']
                // Process: buttons: ['OK']
                buttons: ['OK']
            });

// Process: return paths
            // Process: return paths
            return paths;
        } catch (error) {
// Process: console.error('Failed to create default folders:', error)
            // Process: console.error('Failed to create default folders:', error)
            console.error('Failed to create default folders:', error);
            await dialog.showMessageBox(mainWindow, {
// Process: type: 'error',
                // Process: type: 'error',
                type: 'error',
                title: 'Folder Creation Failed',
// Process: message: 'Tavern Tones was unable to create the data fold...
                // Process: message: 'Tavern Tones was unable to create the data fold...
                message: 'Tavern Tones was unable to create the data folders automatically.',
                detail: `This often happens if the location (like Program Files) has restricted permissions.\n\nError: ${error.message}\n\nSuggested Fix: Try creating the "Tavern Tones" folder manually in your Documents folder first, or choose a different location.`,
// Process: buttons: ['OK']
                // Process: buttons: ['OK']
                buttons: ['OK']
            });
// Process: return null
            // Process: return null
            return null;
        }
// Process: )
    // Process: )
    });

    ipcMain.handle('fetch-bestiary-data', async (event, { repoUrl, localPath, githubToken }) => {
// Process: const sync = new GitHubSync(logToRenderer, dialog, mainWi...
        // Process: const sync = new GitHubSync(logToRenderer, dialog, mainWi...
        const sync = new GitHubSync(logToRenderer, dialog, mainWindow, githubToken);
        return await sync.syncBestiary(repoUrl, localPath);
// Process: )
    // Process: )
    });

    ipcMain.handle('detect-ffmpeg', async () => {
// Process: const  exec  = require('child_process')
        // Process: const  exec  = require('child_process')
        const { exec } = require('child_process');
        const isWin = process.platform === 'win32';
// Process: const cmd = isWin ? 'where ffmpeg' : 'which ffmpeg'
        // Process: const cmd = isWin ? 'where ffmpeg' : 'which ffmpeg'
        const cmd = isWin ? 'where ffmpeg' : 'which ffmpeg';

/**
 * Auto-generated documentation
 */
        const foundPath = await new Promise(resolve => {
// Process: exec(cmd, (error, stdout) =>
            // Process: exec(cmd, (error, stdout) =>
            exec(cmd, (error, stdout) => {
                if (!error && stdout) {
/**
 * Auto-generated documentation
 */
// Process: const lines = stdout.split(/\r?\n/).map(l => l.trim()).fi...
                    // Process: const lines = stdout.split(/\r?\n/).map(l => l.trim()).fi...
                    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                    resolve(lines[0] || null);
// Process: else
                // Process: else
                } else {
                    resolve(null);
// Process:
                // Process:
                }
            });
// Process: )
        // Process: )
        });

        if (foundPath && fs.existsSync(foundPath)) return path.dirname(foundPath);

        // Check for bundled ffmpeg
// Process: const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
        // Process: const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
        const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
        const bundledPath = path.join(process.resourcesPath, 'ffmpeg', exeName);
// Process: if (fs.existsSync(bundledPath)) return path.dirname(bundl...
        // Process: if (fs.existsSync(bundledPath)) return path.dirname(bundl...
        if (fs.existsSync(bundledPath)) return path.dirname(bundledPath);

        const appDirFfmpeg = path.join(path.dirname(process.execPath), 'ffmpeg', exeName);
// Process: if (fs.existsSync(appDirFfmpeg)) return path.dirname(appD...
        // Process: if (fs.existsSync(appDirFfmpeg)) return path.dirname(appD...
        if (fs.existsSync(appDirFfmpeg)) return path.dirname(appDirFfmpeg);

        // Check same directory as executable
        const sameDirFfmpeg = path.join(path.dirname(process.execPath), exeName);
// Process: if (fs.existsSync(sameDirFfmpeg)) return path.dirname(sam...
        // Process: if (fs.existsSync(sameDirFfmpeg)) return path.dirname(sam...
        if (fs.existsSync(sameDirFfmpeg)) return path.dirname(sameDirFfmpeg);

        const localFfmpeg = path.join(app.getAppPath(), 'ffmpeg', exeName);
// Process: if (fs.existsSync(localFfmpeg)) return path.dirname(local...
        // Process: if (fs.existsSync(localFfmpeg)) return path.dirname(local...
        if (fs.existsSync(localFfmpeg)) return path.dirname(localFfmpeg);

        return null;
// Process: )
    // Process: )
    });


    // Settings window IPC
    ipcMain.on('get-discord-config', async (event) => {
// Process: const config = await getDiscordConfig()
        // Process: const config = await getDiscordConfig()
        const config = await getDiscordConfig();
        if (event.sender && !event.sender.isDestroyed()) {
// Process: event.sender.send('discord-config', config)
            // Process: event.sender.send('discord-config', config)
            event.sender.send('discord-config', config);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('set-discord-config', async (event, config) => {
        // Merge with existing config to prevent data loss
// Process: const existingConfig = await getDiscordConfig()
        // Process: const existingConfig = await getDiscordConfig()
        const existingConfig = await getDiscordConfig();
        const mergedConfig = { ...existingConfig, ...config };

// Process: await setDiscordConfig(mergedConfig)
        // Process: await setDiscordConfig(mergedConfig)
        await setDiscordConfig(mergedConfig);

        // --- Update the live configuration ---
        // The in-memory config needs to be updated to reflect the newly saved settings.
        const oldShowMediaControl = discordConfig ? discordConfig.showMediaControl : true;
// Process: discordConfig = mergedConfig
        // Process: discordConfig = mergedConfig
        discordConfig = mergedConfig;
        invalidateMusicCache();

// Process: if (oldShowMediaControl !== mergedConfig.showMediaControl)
        // Process: if (oldShowMediaControl !== mergedConfig.showMediaControl)
        if (oldShowMediaControl !== mergedConfig.showMediaControl) {
            updateDiscordMediaControl();
// Process:
        // Process:
        }

        // The music player instance also needs to be told about the new path.
        if (musicPlayer) {
// Process: musicPlayer.musicFolder = mergedConfig.defaultMusicPath
            // Process: musicPlayer.musicFolder = mergedConfig.defaultMusicPath
            musicPlayer.musicFolder = mergedConfig.defaultMusicPath;
            musicPlayer.ffmpegBinFolder = mergedConfig.ffmpegPath; // Note: config key remains ffmpegPath for compatibility
// Process: logToRenderer(`[IPC] Updated music player's default folde...
            // Process: logToRenderer(`[IPC] Updated music player's default folde...
            logToRenderer(`[IPC] Updated music player's default folder to: ${musicPlayer.musicFolder}`);
        }
        // --- End of update ---

        // Only show dialog and close if it was sent from the settings window
// Process: if (event.sender === (settingsWindow && settingsWindow.we...
        // Process: if (event.sender === (settingsWindow && settingsWindow.we...
        if (event.sender === (settingsWindow && settingsWindow.webContents)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
// Process: mainWindow.webContents.send('discord-config', mergedConfig)
                // Process: mainWindow.webContents.send('discord-config', mergedConfig)
                mainWindow.webContents.send('discord-config', mergedConfig);
            }
// Process: if (settingsWindow)
            // Process: if (settingsWindow)
            if (settingsWindow) {
                settingsWindow.close();
// Process:
            // Process:
            }
        }
// Process: )
    // Process: )
    });

    ipcMain.on('open-settings-window', createSettingsWindow);

// Process: ipcMain.on('open-walkthrough', () =>
    // Process: ipcMain.on('open-walkthrough', () =>
    ipcMain.on('open-walkthrough', () => {
        let walkthroughWindow = new BrowserWindow({
// Process: width: 600,
            // Process: width: 600,
            width: 600,
            height: 700,
// Process: alwaysOnTop: true,
            // Process: alwaysOnTop: true,
            alwaysOnTop: true,
            frame: true,
// Process: webPreferences:
            // Process: webPreferences:
            webPreferences: {
                nodeIntegration: true,
// Process: contextIsolation: false // Simplified for this walkthroug...
                // Process: contextIsolation: false
                contextIsolation: false // Simplified for this walkthrough window
            }
// Process: )
        // Process: )
        });
        walkthroughWindow.loadFile(path.join(__dirname, '../../ui/walkthrough/walkthrough.html'));
// Process: )
    // Process: )
    });

    ipcMain.handle('register-slash-commands', async () => {
// Process: if (!discordConfig.token) return  success: false, error: ...
        // Process: if (!discordConfig.token) return  success: false, error: ...
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        try {
// Process: const rest = new REST( version: '10' ).setToken(discordCo...
            // Process: const rest = new REST( version: '10' ).setToken(discordCo...
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);
            const commands = [
// Process:
                // Process:
                {
                    name: 'roll',
// Process: description: 'Roll arbitrary dice using RPG notation',
                    // Process: description: 'Roll arbitrary dice using RPG notation',
                    description: 'Roll arbitrary dice using RPG notation',
                    options: [{
// Process: name: 'notation',
                        // Process: name: 'notation',
                        name: 'notation',
                        type: 3, // STRING
// Process: description: 'e.g. 2d20kh1 + 5',
                        // Process: description: 'e.g. 2d20kh1 + 5',
                        description: 'e.g. 2d20kh1 + 5',
                        required: true
// Process: ]
                    // Process: ]
                    }]
                },
// Process:
                // Process:
                {
                    name: 'dice-help',
// Process: description: 'Get help with RPG dice notation'
                    // Process: description: 'Get help with RPG dice notation'
                    description: 'Get help with RPG dice notation'
                },
// Process:
                // Process:
                {
                    name: 'play',
// Process: description: 'Play music by folder or song name',
                    // Process: description: 'Play music by folder or song name',
                    description: 'Play music by folder or song name',
                    options: [
// Process: name: 'folder', type: 3, description: 'Folder name', requ...
                        // Process: name: 'folder', type: 3, description: 'Folder name', requ...
                        { name: 'folder', type: 3, description: 'Folder name', required: false },
                        { name: 'song', type: 3, description: 'Song name', required: false }
// Process: ]
                    // Process: ]
                    ]
                },
// Process:
                // Process:
                {
                    name: 'play-song',
// Process: description: 'Search and play a song',
                    // Process: description: 'Search and play a song',
                    description: 'Search and play a song',
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
// Process: ,
                // Process: ,
                },
                {
// Process: name: 'add-song',
                    // Process: name: 'add-song',
                    name: 'add-song',
                    description: 'Search and add a song to stack',
// Process: options: [ name: 'query', type: 3, description: 'Song nam...
                    // Process: options: [ name: 'query', type: 3, description: 'Song nam...
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
                },
// Process:
                // Process:
                {
                    name: 'play-folder',
// Process: description: 'Play all songs in a folder',
                    // Process: description: 'Play all songs in a folder',
                    description: 'Play all songs in a folder',
                    options: [{ name: 'query', type: 3, description: 'Folder name', required: true }]
// Process: ,
                // Process: ,
                },
                {
// Process: name: 'add-folder',
                    // Process: name: 'add-folder',
                    name: 'add-folder',
                    description: 'Add all songs in a folder to stack',
// Process: options: [ name: 'query', type: 3, description: 'Folder n...
                    // Process: options: [ name: 'query', type: 3, description: 'Folder n...
                    options: [{ name: 'query', type: 3, description: 'Folder name', required: true }]
                },
// Process: name: 'pause', description: 'Pause current audio' ,
                // Process: name: 'pause', description: 'Pause current audio' ,
                { name: 'pause', description: 'Pause current audio' },
                { name: 'stop', description: 'Stop audio and clear stack' },
// Process: name: 'ping', description: 'Test bot connectivity' ,
                // Process: name: 'ping', description: 'Test bot connectivity' ,
                { name: 'ping', description: 'Test bot connectivity' },
                { name: 'surge', description: 'Roll on the Wild Magic Surge table' },
// Process: name: 'shield', description: 'Roll on the Wild Magic Shie...
                // Process: name: 'shield', description: 'Roll on the Wild Magic Shie...
                { name: 'shield', description: 'Roll on the Wild Magic Shield table' },
                {
// Process: name: 'roll-table',
                    // Process: name: 'roll-table',
                    name: 'roll-table',
                    description: 'Roll on random tables',
// Process: options: [
                    // Process: options: [
                    options: [
                        { name: 'folder', type: 3, description: 'Folder name', required: true },
// Process: name: 'count', type: 4, description: 'Number of rolls', r...
                        // Process: name: 'count', type: 4, description: 'Number of rolls', r...
                        { name: 'count', type: 4, description: 'Number of rolls', required: true },
                        { name: 'args', type: 3, description: 'Weights and tables (e.g. "8 lvl1 4 lvl2")', required: true }
// Process: ]
                    // Process: ]
                    ]
                }
// Process: ]
            // Process: ]
            ];

            const guildIds = new Set();
/**
 * Auto-generated documentation
 */
// Process: const channelsToTry = [discordConfig.textChannel, discord...
            // Process: const channelsToTry = [discordConfig.textChannel, discord...
            const channelsToTry = [discordConfig.textChannel, discordConfig.voiceChannel].filter(id => !!id);
            for (const id of channelsToTry) {
// Process: let chan = client.channels.cache.get(id)
                // Process: let chan = client.channels.cache.get(id)
                let chan = client.channels.cache.get(id);
                if (!chan) {
// Process: try  chan = await client.channels.fetch(id)  catch(e)
                    // Process: try  chan = await client.channels.fetch(id)  catch(e)
                    try { chan = await client.channels.fetch(id); } catch(e) {}
                }
// Process: if (chan && chan.guild) guildIds.add(chan.guild.id)
                // Process: if (chan && chan.guild) guildIds.add(chan.guild.id)
                if (chan && chan.guild) guildIds.add(chan.guild.id);
            }

// Process: if (guildIds.size === 0)
            // Process: if (guildIds.size === 0)
            if (guildIds.size === 0) {
                // Fallback to global if no channels configured
                await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
// Process: else
            // Process: else
            } else {
                for (const guildId of guildIds) {
// Process: await rest.put(Routes.applicationGuildCommands(client.use...
                    // Process: await rest.put(Routes.applicationGuildCommands(client.use...
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                }
// Process:
            // Process:
            }
            return { success: true };
// Process: catch (e)
        // Process: catch (e)
        } catch (e) {
            return { success: false, error: e.message };
// Process:
        // Process:
        }
    });

// Process: ipcMain.handle('unregister-slash-commands', async () =>
    // Process: ipcMain.handle('unregister-slash-commands', async () =>
    ipcMain.handle('unregister-slash-commands', async () => {
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
// Process: try
        // Process: try
        try {
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);
// Process: const guildIds = new Set()
            // Process: const guildIds = new Set()
            const guildIds = new Set();
/**
 * Auto-generated documentation
 */
            const channelsToTry = [discordConfig.textChannel, discordConfig.voiceChannel].filter(id => !!id);
// Process: for (const id of channelsToTry)
            // Process: for (const id of channelsToTry)
            for (const id of channelsToTry) {
                let chan = client.channels.cache.get(id);
// Process: if (!chan)
                // Process: if (!chan)
                if (!chan) {
                    try { chan = await client.channels.fetch(id); } catch(e) {}
// Process:
                // Process:
                }
                if (chan && chan.guild) guildIds.add(chan.guild.id);
// Process:
            // Process:
            }

            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
// Process: for (const guildId of guildIds)
            // Process: for (const guildId of guildIds)
            for (const guildId of guildIds) {
                await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
// Process:
            // Process:
            }
            return { success: true };
// Process: catch (e)
        // Process: catch (e)
        } catch (e) {
            return { success: false, error: e.message };
// Process:
        // Process:
        }
    });

    // logToRenderer('ipcloader() called.');
// Process: musicPlayer.on('status-change', (status) =>
    // Process: musicPlayer.on('status-change', (status) =>
    musicPlayer.on('status-change', (status) => {
        if (mainWindow && mainWindow.webContents) {
// Process: mainWindow.webContents.send('music-player-status', status)
            // Process: mainWindow.webContents.send('music-player-status', status)
            mainWindow.webContents.send('music-player-status', status);
        }
// Process: )
    // Process: )
    });
    musicPlayer.on('sound-finished', (slotId) => {
// Process: if (mainWindow && mainWindow.webContents)
        // Process: if (mainWindow && mainWindow.webContents)
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('sound-finished', slotId);
// Process:
        // Process:
        }
    });
// Process: initiativeTracker = new InitiativeTracker(logToRenderer, ...
    // Process: initiativeTracker = new InitiativeTracker(logToRenderer, ...
    initiativeTracker = new InitiativeTracker(logToRenderer, logDiceRollToRenderer, sendInitiativeUpdate, autosavePath);
    // --- All core IPC listeners should be registered after the app is ready ---
    ipcMain.on('request-initial-load', () => {
// Process: if (initiativeTracker)
        // Process: if (initiativeTracker)
        if (initiativeTracker) {
            initiativeTracker.sendFullState();
// Process:
        // Process:
        }
        autoloadMusic();
// Process: if (discordConfig && discordConfig.enabled)
        // Process: if (discordConfig && discordConfig.enabled)
        if (discordConfig && discordConfig.enabled) {
            if (client && client.isReady()) {
// Process: mainWindow.webContents.send('discord-bot-status',  status...
                // Process: mainWindow.webContents.send('discord-bot-status',  status...
                mainWindow.webContents.send('discord-bot-status', { status: 'online', message: 'Connected' });
            } else if (!discordConfig.token) {
// Process: mainWindow.webContents.send('discord-bot-status',  status...
                // Process: mainWindow.webContents.send('discord-bot-status',  status...
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
            } else {
// Process: mainWindow.webContents.send('discord-bot-status',  status...
                // Process: mainWindow.webContents.send('discord-bot-status',  status...
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Connecting...' });
            }
// Process: else
        // Process: else
        } else {
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Disabled' });
// Process:
        // Process:
        }
    });

    // Music Player IPC Handlers
/**
 * Auto-generated documentation
 */
// Process: const autoloadMusic = async () =>
    // Process: const autoloadMusic = async () =>
    const autoloadMusic = async () => {
        if (discordConfig && discordConfig.musicAutosave && fs.existsSync(musicAutosavePath)) {
// Process: try
            // Process: try
            try {
                const data = await fs.promises.readFile(musicAutosavePath, 'utf-8');
// Process: const stack = JSON.parse(data)
                // Process: const stack = JSON.parse(data)
                const stack = JSON.parse(data);
                if (Array.isArray(stack)) {
// Process: musicPlayer.clearStack()
                    // Process: musicPlayer.clearStack()
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(stack);
// Process: logToRenderer(`[Music] Autoloaded $stack.length tracks.`)
                    // Process: logToRenderer(`[Music] Autoloaded $stack.length tracks.`)
                    logToRenderer(`[Music] Autoloaded ${stack.length} tracks.`);
                }
// Process: catch (e)
            // Process: catch (e)
            } catch (e) {
                console.error("Autoload failed:", e);
// Process:
            // Process:
            }
        }
// Process:
    // Process:
    };

    ipcMain.on('load-music-file', (event, filePaths) => {
// Process: if (filePaths)
        // Process: if (filePaths)
        if (filePaths) {
            musicPlayer.addToStack(filePaths);
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('play-music', async () =>
    // Process: ipcMain.on('play-music', async () =>
    ipcMain.on('play-music', async () => {
        logToRenderer(`IPC 'play-music' (command) received.`);
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
        // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
        if (voiceStatus !== 'connected') await joinVoiceChannelAction();
        musicPlayer.play();
// Process: )
    // Process: )
    });

    ipcMain.on('pause-music', () => {
// Process: logToRenderer(`IPC 'pause-music' received.`)
        // Process: logToRenderer(`IPC 'pause-music' received.`)
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
// Process: )
    // Process: )
    });

    ipcMain.on('play-next', (event) => {
// Process: if (musicPlayer) musicPlayer.next(false, false)
        // Process: if (musicPlayer) musicPlayer.next(false, false)
        if (musicPlayer) musicPlayer.next(false, false);
    });

// Process: ipcMain.on('play-prev', (event) =>
    // Process: ipcMain.on('play-prev', (event) =>
    ipcMain.on('play-prev', (event) => {
        if (musicPlayer) musicPlayer.prev(false);
// Process: )
    // Process: )
    });

    ipcMain.on('set-loop-mode', (event, { mode }) => {
// Process: if (musicPlayer) musicPlayer.setLoopMode(mode)
        // Process: if (musicPlayer) musicPlayer.setLoopMode(mode)
        if (musicPlayer) musicPlayer.setLoopMode(mode);
    });

// Process: ipcMain.on('set-shuffle', (event,  enabled ) =>
    // Process: ipcMain.on('set-shuffle', (event,  enabled ) =>
    ipcMain.on('set-shuffle', (event, { enabled }) => {
        if (musicPlayer) musicPlayer.setShuffle(enabled);
// Process: )
    // Process: )
    });

    ipcMain.on('remove-from-stack', (event, { index }) => {
// Process: if (musicPlayer) musicPlayer.removeFromStack(index)
        // Process: if (musicPlayer) musicPlayer.removeFromStack(index)
        if (musicPlayer) musicPlayer.removeFromStack(index);
    });

// Process: ipcMain.on('clear-stack', (event) =>
    // Process: ipcMain.on('clear-stack', (event) =>
    ipcMain.on('clear-stack', (event) => {
        if (musicPlayer) musicPlayer.clearStack();
// Process: )
    // Process: )
    });

    ipcMain.on('jump-to-track', async (event, { index }) => {
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
// Process: musicPlayer.jumpTo(index, true)
            // Process: musicPlayer.jumpTo(index, true)
            musicPlayer.jumpTo(index, true);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('play-now', async (event, { index }) => {
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
// Process: musicPlayer.jumpTo(index, true)
            // Process: musicPlayer.jumpTo(index, true)
            musicPlayer.jumpTo(index, true);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('seek-music', (event, { time }) => {
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            musicPlayer.seek(time);
// Process:
        // Process:
        }
    });

// Process: ipcMain.handle('save-music-preset', async (event, stack, ...
    // Process: ipcMain.handle('save-music-preset', async (event, stack, ...
    ipcMain.handle('save-music-preset', async (event, stack, isManual = true) => {
        // Internal call (autosave) or background save
        if ((!event || isManual === false || isManual === 'false') && stack) {
// Process: try
            // Process: try
            try {
                await fs.promises.writeFile(musicAutosavePath, JSON.stringify(stack, null, 2));
// Process: return  success: true
                // Process: return  success: true
                return { success: true };
            } catch (e) {
// Process: console.error("Autosave failed:", e)
                // Process: console.error("Autosave failed:", e)
                console.error("Autosave failed:", e);
                return { success: false, error: e.message };
// Process:
            // Process:
            }
        }

// Process: const  canceled, filePath  = await dialog.showSaveDialog(...
        // Process: const  canceled, filePath  = await dialog.showSaveDialog(...
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Music Stack Preset',
// Process: defaultPath: 'music-preset.json',
            // Process: defaultPath: 'music-preset.json',
            defaultPath: 'music-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
// Process: )
        // Process: )
        });
        if (!canceled && filePath) {
// Process: try
            // Process: try
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(stack, null, 2));
                // Also update autosave file if enabled
// Process: if (discordConfig && discordConfig.musicAutosave)
                // Process: if (discordConfig && discordConfig.musicAutosave)
                if (discordConfig && discordConfig.musicAutosave) {
                    await fs.promises.writeFile(musicAutosavePath, JSON.stringify(stack, null, 2));
// Process:
                // Process:
                }
                return { success: true };
// Process: catch (e)
            // Process: catch (e)
            } catch (e) {
                return { success: false, error: e.message };
// Process:
            // Process:
            }
        }
// Process: return  canceled: true
        // Process: return  canceled: true
        return { canceled: true };
    });

// Process: ipcMain.handle('load-music-preset', async () =>
    // Process: ipcMain.handle('load-music-preset', async () =>
    ipcMain.handle('load-music-preset', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
// Process: title: 'Load Music Stack Preset',
            // Process: title: 'Load Music Stack Preset',
            title: 'Load Music Stack Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
// Process: properties: ['openFile']
            // Process: properties: ['openFile']
            properties: ['openFile']
        });
// Process: if (!canceled && filePaths.length > 0)
        // Process: if (!canceled && filePaths.length > 0)
        if (!canceled && filePaths.length > 0) {
            try {
// Process: const data = await fs.promises.readFile(filePaths[0], 'ut...
                // Process: const data = await fs.promises.readFile(filePaths[0], 'ut...
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                const stack = JSON.parse(data);
// Process: if (Array.isArray(stack))
                // Process: if (Array.isArray(stack))
                if (Array.isArray(stack)) {
                    musicPlayer.clearStack();
// Process: await musicPlayer.addToStack(stack)
                    // Process: await musicPlayer.addToStack(stack)
                    await musicPlayer.addToStack(stack);
                    return { success: true };
// Process:
                // Process:
                }
                throw new Error("Invalid preset format.");
// Process: catch (e)
            // Process: catch (e)
            } catch (e) {
                return { success: false, error: e.message };
// Process:
            // Process:
            }
        }
// Process: return  canceled: true
        // Process: return  canceled: true
        return { canceled: true };
    });

// Process: ipcMain.handle('get-preview-audio-data', async (event,  i...
    // Process: ipcMain.handle('get-preview-audio-data', async (event,  i...
    ipcMain.handle('get-preview-audio-data', async (event, { index = -1 } = {}) => {
        let filePath;
// Process: if (index >= 0 && index < musicPlayer.stack.length)
        // Process: if (index >= 0 && index < musicPlayer.stack.length)
        if (index >= 0 && index < musicPlayer.stack.length) {
            filePath = musicPlayer.stack[index];
// Process: else
        // Process: else
        } else {
            filePath = musicPlayer.getPreviewFilePath();
// Process:
        // Process:
        }

        if (!filePath) {
// Process: return  success: false, error: 'No file available for pre...
            // Process: return  success: false, error: 'No file available for pre...
            return { success: false, error: 'No file available for preview.' };
        }
        // Use a more standard URL format with search params for better parsing
// Process: const safeUrl = `safe-media://local/?path=$encodeURICompo...
        // Process: const safeUrl = `safe-media:
        const safeUrl = `safe-media://local/?path=${encodeURIComponent(filePath)}`;
        return { success: true, url: safeUrl };
// Process: )
    // Process: )
    });

    ipcMain.handle('show-confirm-dialog', async (event, options) => {
// Process: const focusedWindow = BrowserWindow.getFocusedWindow()
        // Process: const focusedWindow = BrowserWindow.getFocusedWindow()
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (!focusedWindow) return { response: options.cancelId || 1 }; // Default to cancel if no window
// Process: return await dialog.showMessageBox(focusedWindow, options)
        // Process: return await dialog.showMessageBox(focusedWindow, options)
        return await dialog.showMessageBox(focusedWindow, options);
    });

// Process: ipcMain.on('voice-toggle', async () =>
    // Process: ipcMain.on('voice-toggle', async () =>
    ipcMain.on('voice-toggle', async () => {
        if (voiceStatus === 'connected') {
// Process: leaveVoiceChannelAction()
            // Process: leaveVoiceChannelAction()
            leaveVoiceChannelAction();
        } else {
// Process: joinVoiceChannelAction()
            // Process: joinVoiceChannelAction()
            joinVoiceChannelAction();
        }
// Process: )
    // Process: )
    });

    ipcMain.on('request-bot-status', () => {
// Process: broadcastBotStatus()
        // Process: broadcastBotStatus()
        broadcastBotStatus();
    });


// Process: ipcMain.handle('get-music-library', async () =>
    // Process: ipcMain.handle('get-music-library', async () =>
    ipcMain.handle('get-music-library', async () => {
        return getMusicLibrary();
// Process: )
    // Process: )
    });

    ipcMain.handle('rescan-music-library', async () => {
// Process: scanMusicLibrary()
        // Process: scanMusicLibrary()
        scanMusicLibrary();
        return { success: true };
// Process: )
    // Process: )
    });

    ipcMain.handle('get-licenses', async () => {
// Process: try
        // Process: try
        try {
            const licensesPath = path.join(__dirname, '../data/licenses.json');
// Process: if (fs.existsSync(licensesPath))
            // Process: if (fs.existsSync(licensesPath))
            if (fs.existsSync(licensesPath)) {
                const licenses = JSON.parse(await fs.promises.readFile(licensesPath, 'utf8'));
// Process: return  success: true, licenses
                // Process: return  success: true, licenses
                return { success: true, licenses };
            }

            // Fallback if licenses.json doesn't exist yet
// Process: return  success: false, error: "License data not generate...
            // Process: return  success: false, error: "License data not generate...
            return { success: false, error: "License data not generated. Please run build." };
        } catch (e) {
// Process: console.error("Error getting licenses:", e)
            // Process: console.error("Error getting licenses:", e)
            console.error("Error getting licenses:", e);
            return { success: false, error: e.message };
// Process:
        // Process:
        }
    });

/**
 * Auto-generated documentation
 */
// Process: const resolveLibraryPaths = (paths) =>
    // Process: const resolveLibraryPaths = (paths) =>
    const resolveLibraryPaths = (paths) => {
        return paths.map(p => {
// Process: if (path.extname(p).toLowerCase() === '.lnk')
            // Process: if (path.extname(p).toLowerCase() === '.lnk')
            if (path.extname(p).toLowerCase() === '.lnk') {
                try {
// Process: const shortcut = shell.readShortcutLink(p)
                    // Process: const shortcut = shell.readShortcutLink(p)
                    const shortcut = shell.readShortcutLink(p);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
// Process: return shortcut.target
                        // Process: return shortcut.target
                        return shortcut.target;
                    }
// Process: catch (e)
                // Process: catch (e)
                } catch (e) {
                    console.error(`Failed to resolve shortcut: ${p}`, e);
// Process:
                // Process:
                }
            }
// Process: return p
            // Process: return p
            return p;
        });
// Process:
    // Process:
    };

    ipcMain.on('library-action', async (event, { action, paths }) => {
// Process: if (!musicPlayer) return
        // Process: if (!musicPlayer) return
        if (!musicPlayer) return;
        const resolvedPaths = resolveLibraryPaths(paths);

// Process: switch (action)
        // Process: switch (action)
        switch (action) {
            case 'play-now':
                // For 'play now' from library, we insert at the very top (index 0) and play.
// Process: const currentStack = [...musicPlayer.stack]
                // Process: const currentStack = [...musicPlayer.stack]
                const currentStack = [...musicPlayer.stack];
                musicPlayer.stack = [...resolvedPaths, ...currentStack];
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                musicPlayer.jumpTo(0, true);
// Process: break
                // Process: break
                break;
            case 'add-top':
// Process: if (musicPlayer.currentIndex === -1)
                // Process: if (musicPlayer.currentIndex === -1)
                if (musicPlayer.currentIndex === -1) {
                    // Nothing playing, add to the very top
                    musicPlayer.stack = [...resolvedPaths, ...musicPlayer.stack];
// Process: else
                // Process: else
                } else {
                    // Add below the currently playing track
                    musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, ...resolvedPaths);
// Process:
                // Process:
                }
                musicPlayer._emitStatusUpdate();
// Process: break
                // Process: break
                break;
            case 'add-bottom':
// Process: musicPlayer.addToStack(resolvedPaths)
                // Process: musicPlayer.addToStack(resolvedPaths)
                musicPlayer.addToStack(resolvedPaths);
                break;
// Process: case 'add-loose':
            // Process: case 'add-loose':
            case 'add-loose':
                if (!discordConfig.looseFiles) discordConfig.looseFiles = [];
// Process: for (const p of paths)
                // Process: for (const p of paths)
                for (const p of paths) {
                    if (!discordConfig.looseFiles.includes(p)) {
// Process: discordConfig.looseFiles.push(p)
                        // Process: discordConfig.looseFiles.push(p)
                        discordConfig.looseFiles.push(p);
                    }
// Process:
                // Process:
                }
                await setDiscordConfig(discordConfig);
// Process: const updatedLibrary = getMusicLibrary()
                // Process: const updatedLibrary = getMusicLibrary()
                const updatedLibrary = getMusicLibrary();
                if (mainWindow && !mainWindow.isDestroyed()) {
// Process: mainWindow.webContents.send('music-library-update',  libr...
                    // Process: mainWindow.webContents.send('music-library-update',  libr...
                    mainWindow.webContents.send('music-library-update', { library: updatedLibrary, diff: null });
                }
// Process: break
                // Process: break
                break;
        }
// Process: )
    // Process: )
    });

    ipcMain.handle('read-combat-file', async () => {
// Process: const  canceled, filePaths  = await dialog.showOpenDialog...
        // Process: const  canceled, filePaths  = await dialog.showOpenDialog...
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
// Process: filters: [ name: 'JSON', extensions: ['json'] ]
            // Process: filters: [ name: 'JSON', extensions: ['json'] ]
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
// Process: if (canceled || filePaths.length === 0)
        // Process: if (canceled || filePaths.length === 0)
        if (canceled || filePaths.length === 0) {
            return null;
// Process:
        // Process:
        }
        try {
// Process: const content = fs.readFileSync(filePaths[0], 'utf8')
            // Process: const content = fs.readFileSync(filePaths[0], 'utf8')
            const content = fs.readFileSync(filePaths[0], 'utf8');
            const data = JSON.parse(content);

            // Detect Falindrith D&D Monster Maker format
// Process: if (data.saveVersion && data.stats && data.HP)
            // Process: if (data.saveVersion && data.stats && data.HP)
            if (data.saveVersion && data.stats && data.HP) {
                const monster = data;
/**
 * Auto-generated documentation
 */
// Process: const calculateModifier = (score) => Math.floor(((score |...
                // Process: const calculateModifier = (score) => Math.floor(((score |...
                const calculateModifier = (score) => Math.floor(((score || 10) - 10) / 2);
/**
 * Auto-generated documentation
 */
                const formatModifier = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);

// Process: const dexMod = calculateModifier(monster.stats.DEX)
                // Process: const dexMod = calculateModifier(monster.stats.DEX)
                const dexMod = calculateModifier(monster.stats.DEX);
                const hpFormula = `${monster.HP.HD}d${monster.HP.type}${monster.HP.modifier >= 0 ? '+' : ''}${monster.HP.modifier}`;

                // Map Falindrith saves to TavernTones saves
// Process: const ttSaves =
                // Process: const ttSaves =
                const ttSaves = {};
                const stats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
// Process: stats.forEach(s =>
                // Process: stats.forEach(s =>
                stats.forEach(s => {
                    const save = monster.saves[s];
// Process: let mod
                    // Process: let mod
                    let mod;
                    if (save.override) {
// Process: mod = save.overrideValue
                        // Process: mod = save.overrideValue
                        mod = save.overrideValue;
                    } else {
// Process: mod = calculateModifier(monster.stats[s])
                        // Process: mod = calculateModifier(monster.stats[s])
                        mod = calculateModifier(monster.stats[s]);
                        if (save.proficient) {
// Process: mod += (monster.proficiency || 0)
                            // Process: mod += (monster.proficiency || 0)
                            mod += (monster.proficiency || 0);
                        }
// Process:
                    // Process:
                    }
                    ttSaves[s.toLowerCase()] = formatModifier(mod);
// Process: )
                // Process: )
                });

                const ttScores = {};
// Process: stats.forEach(s =>
                // Process: stats.forEach(s =>
                stats.forEach(s => {
                    ttScores[s.toLowerCase()] = monster.stats[s];
// Process: )
                // Process: )
                });

/**
 * Auto-generated documentation
 */
                const parseSpeed = (speedObj) => {
// Process: if (!speedObj) return '30ft'
                    // Process: if (!speedObj) return '30ft'
                    if (!speedObj) return '30ft';
                    if (typeof speedObj === 'string') {
// Process: const matches = speedObj.match(/(\d+)\s*ft/g)
                        // Process: const matches = speedObj.match(/(\d+)\s*ft/g)
                        const matches = speedObj.match(/(\d+)\s*ft/g);
                        if (matches) {
/**
 * Auto-generated documentation
 */
// Process: const speeds = matches.map(m => parseInt(m, 10))
                            // Process: const speeds = matches.map(m => parseInt(m, 10))
                            const speeds = matches.map(m => parseInt(m, 10));
                            return Math.max(...speeds) + 'ft';
// Process:
                        // Process:
                        }
                        return speedObj;
// Process:
                    // Process:
                    }
                    if (typeof speedObj === 'object') {
/**
 * Auto-generated documentation
 */
// Process: const speeds = Object.values(speedObj).filter(s => typeof...
                        // Process: const speeds = Object.values(speedObj).filter(s => typeof...
                        const speeds = Object.values(speedObj).filter(s => typeof s === 'number');
                        if (speeds.length > 0) return Math.max(...speeds) + 'ft';
// Process:
                    // Process:
                    }
                    return '30ft';
// Process:
                // Process:
                };

                const ttCombatant = {
// Process: name: monster.name,
                    // Process: name: monster.name,
                    name: monster.name,
                    hp: hpFormula,
// Process: maxHp: null, // Will be rolled/parsed by addCreature
                    // Process: maxHp: null,
                    maxHp: null, // Will be rolled/parsed by addCreature
                    ac: monster.AC,
// Process: speed: parseSpeed(monster.speed),
                    // Process: speed: parseSpeed(monster.speed),
                    speed: parseSpeed(monster.speed),
                    initiative: formatModifier(dexMod),
// Process: scores: ttScores,
                    // Process: scores: ttScores,
                    scores: ttScores,
                    saves: ttSaves,
// Process: rawData: JSON.stringify(monster), // For the stat block view
                    // Process: rawData: JSON.stringify(monster),
                    rawData: JSON.stringify(monster), // For the stat block view
                    conditions: [], // Falindrith 'conditions' might be immunities, safer to leave empty or parse carefully
// Process: deathSaves:  successes: 0, failures: 0 ,
                    // Process: deathSaves:  successes: 0, failures: 0 ,
                    deathSaves: { successes: 0, failures: 0 },
                    noDeathSaves: false
// Process:
                // Process:
                };

                return [ttCombatant];
// Process:
            // Process:
            }

            // Support both full save state (with initiativeOrder) or simple array
            const combatants = Array.isArray(data) ? data : (data.initiativeOrder || []);
// Process: return combatants
            // Process: return combatants
            return combatants;
        } catch (e) {
// Process: logToRenderer(`Error reading combat file: $e.message`)
            // Process: logToRenderer(`Error reading combat file: $e.message`)
            logToRenderer(`Error reading combat file: ${e.message}`);
            return null;
// Process:
        // Process:
        }
    });

/**
 * Auto-generated documentation
 */
// Process: const getAudioFilesRecursive = async (paths) =>
    // Process: const getAudioFilesRecursive = async (paths) =>
    const getAudioFilesRecursive = async (paths) => {
        let results = [];
// Process: const extensions = ['.mp3', '.wav', '.ogg', '.lnk']
        // Process: const extensions = ['.mp3', '.wav', '.ogg', '.lnk']
        const extensions = ['.mp3', '.wav', '.ogg', '.lnk'];
        for (const p of paths) {
// Process: try
            // Process: try
            try {
                const stats = await fs.promises.stat(p);
// Process: if (stats.isDirectory())
                // Process: if (stats.isDirectory())
                if (stats.isDirectory()) {
                    const files = await fs.promises.readdir(p);
/**
 * Auto-generated documentation
 */
// Process: const subResults = await getAudioFilesRecursive(files.map...
                    // Process: const subResults = await getAudioFilesRecursive(files.map...
                    const subResults = await getAudioFilesRecursive(files.map(f => path.join(p, f)));
                    results = results.concat(subResults);
// Process: else
                // Process: else
                } else {
                    if (extensions.includes(path.extname(p).toLowerCase())) {
// Process: results.push(p)
                        // Process: results.push(p)
                        results.push(p);
                    }
// Process:
                // Process:
                }
            } catch (e) {
// Process: console.error(`Error processing path $p:`, e)
                // Process: console.error(`Error processing path $p:`, e)
                console.error(`Error processing path ${p}:`, e);
            }
// Process:
        // Process:
        }
        return results;
// Process:
    // Process:
    };

    ipcMain.handle('open-file-dialog', async (event, options = {}) => {
// Process: const properties = options.folders ? ['openDirectory'] : ...
        // Process: const properties = options.folders ? ['openDirectory'] : ...
        const properties = options.folders ? ['openDirectory'] : ['openFile'];
        if (options.multi) properties.push('multiSelections');

// Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        // Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: options.folders ? 'Select Music Folder(s)' : 'Select Music File(s)',
// Process: defaultPath: discordConfig.defaultMusicPath,
            // Process: defaultPath: discordConfig.defaultMusicPath,
            defaultPath: discordConfig.defaultMusicPath,
            properties,
// Process: filters: [
            // Process: filters: [
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
// Process: ]
            // Process: ]
            ]
        });

// Process: if (filePaths && filePaths.length > 0)
        // Process: if (filePaths && filePaths.length > 0)
        if (filePaths && filePaths.length > 0) {
            return await getAudioFilesRecursive(filePaths);
// Process:
        // Process:
        }
        return [];
// Process: )
    // Process: )
    });

    // --- Soundboard IPC ---
    ipcMain.handle('load-sound', async (event, { slotId, multi = false, folders = false } = {}) => {
// Process: const properties = folders ? ['openDirectory'] : ['openFi...
        // Process: const properties = folders ? ['openDirectory'] : ['openFi...
        const properties = folders ? ['openDirectory'] : ['openFile'];
        if (multi) properties.push('multiSelections');

// Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        // Process: const  filePaths  = await dialog.showOpenDialog(mainWindow,
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: folders ? `Select Folder(s) for Slot ${slotId + 1}` : `Select Sound(s) for Slot ${slotId + 1}`,
// Process: defaultPath: discordConfig.defaultMusicPath,
            // Process: defaultPath: discordConfig.defaultMusicPath,
            defaultPath: discordConfig.defaultMusicPath,
            properties,
// Process: filters: [
            // Process: filters: [
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
// Process: ]
            // Process: ]
            ]
        });

// Process: if (filePaths && filePaths.length > 0)
        // Process: if (filePaths && filePaths.length > 0)
        if (filePaths && filePaths.length > 0) {
            const allFiles = await getAudioFilesRecursive(filePaths);
// Process: return allFiles.map(p => ( path: p, name: path.basename(p...
            // Process: return allFiles.map(p => ( path: p, name: path.basename(p...
            return allFiles.map(p => ({ path: p, name: path.basename(p) }));
        }
// Process: return []
        // Process: return []
        return [];
    });

// Process: ipcMain.on('play-sound', async (event,  slotId, filePath ...
    // Process: ipcMain.on('play-sound', async (event,  slotId, filePath ...
    ipcMain.on('play-sound', async (event, { slotId, filePath }) => {
        logToRenderer(`IPC 'play-sound' slot ${slotId}, file: ${filePath}`);
// Process: if (filePath && musicPlayer)
        // Process: if (filePath && musicPlayer)
        if (filePath && musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
// Process: musicPlayer.playSound(filePath, slotId)
            // Process: musicPlayer.playSound(filePath, slotId)
            musicPlayer.playSound(filePath, slotId);
            // Notify renderer of state change? 
            // The renderer usually updates its own UI state, but if we want valid feedback:
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: true });
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('stop-sound', (event,  slotId ) =>
    // Process: ipcMain.on('stop-sound', (event,  slotId ) =>
    ipcMain.on('stop-sound', (event, { slotId }) => {
        logToRenderer(`IPC 'stop-sound' slot ${slotId}`);
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            musicPlayer.stopSound(slotId);
// Process: mainWindow.webContents.send('soundboard-state-change',  s...
            // Process: mainWindow.webContents.send('soundboard-state-change',  s...
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
        }
// Process: )
    // Process: )
    });

    ipcMain.on('set-soundboard-volume', (event, { volume }) => {
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            musicPlayer.setSoundboardVolume(volume);
// Process:
        // Process:
        }
    });

    // --- Soundboard Persistence ---
// Process: const soundboardConfigPath = path.join(app.getPath('userD...
    // Process: const soundboardConfigPath = path.join(app.getPath('userD...
    const soundboardConfigPath = path.join(app.getPath('userData'), 'soundboard.json');

    ipcMain.handle('get-soundboard-state', async () => {
// Process: try
        // Process: try
        try {
            if (fs.existsSync(soundboardConfigPath)) {
                // Using promises for reading
// Process: const data = await fs.promises.readFile(soundboardConfigP...
                // Process: const data = await fs.promises.readFile(soundboardConfigP...
                const data = await fs.promises.readFile(soundboardConfigPath, 'utf-8');
                return JSON.parse(data);
// Process:
            // Process:
            }
        } catch (error) {
// Process: console.error('Error loading soundboard config:', error)
            // Process: console.error('Error loading soundboard config:', error)
            console.error('Error loading soundboard config:', error);
        }
// Process: return null
        // Process: return null
        return null;
    });

// Process: ipcMain.on('save-soundboard-state', (event, state) =>
    // Process: ipcMain.on('save-soundboard-state', (event, state) =>
    ipcMain.on('save-soundboard-state', (event, state) => {
        try {
// Process: fs.promises.writeFile(soundboardConfigPath, JSON.stringif...
            // Process: fs.promises.writeFile(soundboardConfigPath, JSON.stringif...
            fs.promises.writeFile(soundboardConfigPath, JSON.stringify(state, null, 2))
                .catch(err => console.error("Error saving soundboard:", err));
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            console.error('Error initiating save soundboard:', error);
// Process:
        // Process:
        }
    });

// Process: ipcMain.handle('save-soundboard-preset', async (event, st...
    // Process: ipcMain.handle('save-soundboard-preset', async (event, st...
    ipcMain.handle('save-soundboard-preset', async (event, state) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
// Process: title: 'Save Soundboard Preset',
            // Process: title: 'Save Soundboard Preset',
            title: 'Save Soundboard Preset',
            defaultPath: 'soundboard-preset.json',
// Process: filters: [ name: 'JSON', extensions: ['json'] ]
            // Process: filters: [ name: 'JSON', extensions: ['json'] ]
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

// Process: if (!canceled && filePath)
        // Process: if (!canceled && filePath)
        if (!canceled && filePath) {
            try {
// Process: await fs.promises.writeFile(filePath, JSON.stringify(stat...
                // Process: await fs.promises.writeFile(filePath, JSON.stringify(stat...
                await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2));
                return { success: true, filePath };
// Process: catch (error)
            // Process: catch (error)
            } catch (error) {
                console.error('Error saving preset:', error);
// Process: return  success: false, error: error.message
                // Process: return  success: false, error: error.message
                return { success: false, error: error.message };
            }
// Process:
        // Process:
        }
        return { canceled: true };
// Process: )
    // Process: )
    });

    ipcMain.handle('get-help-content', async () => {
// Process: const paths = [
        // Process: const paths = [
        const paths = [
            path.join(__dirname, '../../../docs/HELP.md'),
// Process: path.join(app.getAppPath(), 'docs/HELP.md'),
            // Process: path.join(app.getAppPath(), 'docs/HELP.md'),
            path.join(app.getAppPath(), 'docs/HELP.md'),
            path.join(process.resourcesPath, 'docs/HELP.md')
// Process: ]
        // Process: ]
        ];

        for (const helpPath of paths) {
// Process: try
            // Process: try
            try {
                if (fs.existsSync(helpPath)) {
// Process: return await fs.promises.readFile(helpPath, 'utf-8')
                    // Process: return await fs.promises.readFile(helpPath, 'utf-8')
                    return await fs.promises.readFile(helpPath, 'utf-8');
                }
// Process: catch (e)
            // Process: catch (e)
            } catch (e) {}
        }
// Process: return "Help file not found. Checked: " + paths.join(', ')
        // Process: return "Help file not found. Checked: " + paths.join(', ')
        return "Help file not found. Checked: " + paths.join(', ');
    });

// Process: ipcMain.handle('load-soundboard-preset', async () =>
    // Process: ipcMain.handle('load-soundboard-preset', async () =>
    ipcMain.handle('load-soundboard-preset', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
// Process: title: 'Load Soundboard Preset',
            // Process: title: 'Load Soundboard Preset',
            title: 'Load Soundboard Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
// Process: properties: ['openFile']
            // Process: properties: ['openFile']
            properties: ['openFile']
        });

// Process: if (!canceled && filePaths.length > 0)
        // Process: if (!canceled && filePaths.length > 0)
        if (!canceled && filePaths.length > 0) {
            try {
// Process: const data = await fs.promises.readFile(filePaths[0], 'ut...
                // Process: const data = await fs.promises.readFile(filePaths[0], 'ut...
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                return { success: true, state: JSON.parse(data) };
// Process: catch (error)
            // Process: catch (error)
            } catch (error) {
                console.error('Error loading preset:', error);
// Process: return  success: false, error: error.message
                // Process: return  success: false, error: error.message
                return { success: false, error: error.message };
            }
// Process:
        // Process:
        }
        return { canceled: true };
// Process: )
    // Process: )
    });



    ipcMain.on('update-initiative', (event, { creatureId, initiative }) => {
// Process: initiativeTracker.updateInitiative(creatureId, initiative)
        // Process: initiativeTracker.updateInitiative(creatureId, initiative)
        initiativeTracker.updateInitiative(creatureId, initiative);
    });

// Process: ipcMain.on('push-initiative', async () =>
    // Process: ipcMain.on('push-initiative', async () =>
    ipcMain.on('push-initiative', async () => {
        logToRenderer(`'push-initiative-to-chat' invoked.`);
// Process: const initiativeOrder = initiativeTracker.getInitiativeOr...
        // Process: const initiativeOrder = initiativeTracker.getInitiativeOr...
        const initiativeOrder = initiativeTracker.getInitiativeOrder();
        const currentTurnIndex = initiativeTracker.currentTurnIndex;
// Process: if (initiativeOrder.length === 0)
        // Process: if (initiativeOrder.length === 0)
        if (initiativeOrder.length === 0) {
            logToRenderer('[push-initiative] Cannot push, initiative is empty.');
// Process: return
            // Process: return
            return;
        }

// Process: if (!discordConfig.textChannel)
        // Process: if (!discordConfig.textChannel)
        if (!discordConfig.textChannel) {
            logToRenderer('[push-initiative] No text channel configured.');
// Process: return
            // Process: return
            return;
        }

// Process: const channel = client.channels.cache.get(discordConfig.t...
        // Process: const channel = client.channels.cache.get(discordConfig.t...
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
// Process: logToRenderer(`[push-initiative] FAILED to find channel w...
            // Process: logToRenderer(`[push-initiative] FAILED to find channel w...
            logToRenderer(`[push-initiative] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
// Process:
        // Process:
        }
        logToRenderer(`[push-initiative] Found channel: ${channel.name}`);

// Process: try
        // Process: try
        try {
            const embed = new EmbedBuilder()
// Process: .setColor(0x0099FF)
                // Process: .setColor(0x0099FF)
                .setColor(0x0099FF)
                .setTitle('Initiative Order')
// Process: .setTimestamp()
                // Process: .setTimestamp()
                .setTimestamp();

            let description = '';
// Process: initiativeOrder.forEach((creature, index) =>
            // Process: initiativeOrder.forEach((creature, index) =>
            initiativeOrder.forEach((creature, index) => {
                const hpBar = createEmojiHpBar(creature);

// Process: let conditionEmojis = (creature.conditions || []).map(c =...
                // Process: let conditionEmojis = (creature.conditions || []).map(c =...
                let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
                let conditionStr;
// Process: if (conditionEmojis.length > 3)
                // Process: if (conditionEmojis.length > 3)
                if (conditionEmojis.length > 3) {
                    conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
// Process: else
                // Process: else
                } else {
                    conditionStr = conditionEmojis.join('');
// Process:
                // Process:
                }

                const activeMarker = index === currentTurnIndex ? '`➤`' : '` `';
// Process: const initiativeStr = creature.initiative.toString()
                // Process: const initiativeStr = creature.initiative.toString()
                const initiativeStr = creature.initiative.toString();
                let nameStr = creature.name || '';
// Process: if (creature.isMob)
                // Process: if (creature.isMob)
                if (creature.isMob) {
                    const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
// Process: nameStr = `Mob of $currentCount $creature.name`
                    // Process: nameStr = `Mob of $currentCount $creature.name`
                    nameStr = `Mob of ${currentCount} ${creature.name}`;
                }

                // New layout: Init | HP Bar | Name | Conditions
// Process: const line = `$activeMarker$hpBar$conditionStr $nameStr`
                // Process: const line = `$activeMarker$hpBar$conditionStr $nameStr`
                const line = `${activeMarker}${hpBar}${conditionStr} ${nameStr}`;
                description += line + '\n';
// Process: )
            // Process: )
            });

            embed.setDescription(description);

// Process: logToRenderer(`[push-initiative] Attempting to send embed...
            // Process: logToRenderer(`[push-initiative] Attempting to send embed...
            logToRenderer(`[push-initiative] Attempting to send embed...`);
            await channel.send({ embeds: [embed] });
// Process: logToRenderer('[push-initiative] Successfully pushed init...
            // Process: logToRenderer('[push-initiative] Successfully pushed init...
            logToRenderer('[push-initiative] Successfully pushed initiative to chat.');
        } catch (error) {
// Process: logToRenderer(`[push-initiative] FAILED to send embed: $e...
            // Process: logToRenderer(`[push-initiative] FAILED to send embed: $e...
            logToRenderer(`[push-initiative] FAILED to send embed: ${error}`);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('next-turn', async () => {
// Process: const turnInfo = initiativeTracker.nextTurn()
        // Process: const turnInfo = initiativeTracker.nextTurn()
        const turnInfo = initiativeTracker.nextTurn();
        if (turnInfo) {
// Process: await checkAndShowReminders(turnInfo.oldCreature, 'end')
            // Process: await checkAndShowReminders(turnInfo.oldCreature, 'end')
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            await checkAndShowReminders(turnInfo.newCreature, 'start');
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('save-encounter', async () =>
    // Process: ipcMain.on('save-encounter', async () =>
    ipcMain.on('save-encounter', async () => {
        try {
// Process: const  canceled, filePath  = await dialog.showSaveDialog(...
            // Process: const  canceled, filePath  = await dialog.showSaveDialog(...
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Encounter',
// Process: defaultPath: app.getPath('userData'),
                // Process: defaultPath: app.getPath('userData'),
                defaultPath: app.getPath('userData'),
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
// Process: )
            // Process: )
            });

            if (!canceled && filePath) {
// Process: initiativeTracker.saveEncounterToFile(filePath)
                // Process: initiativeTracker.saveEncounterToFile(filePath)
                initiativeTracker.saveEncounterToFile(filePath);
            }
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            logToRenderer(`Error saving encounter: ${error.message}`);
// Process:
        // Process:
        }
    });

// Process: ipcMain.handle('load-encounter-dialog', async () =>
    // Process: ipcMain.handle('load-encounter-dialog', async () =>
    ipcMain.handle('load-encounter-dialog', async () => {
        const confirmResult = await dialog.showMessageBox(mainWindow, {
// Process: type: 'warning',
            // Process: type: 'warning',
            type: 'warning',
            title: 'Confirm Load',
// Process: message: 'Are you sure you want to load a new encounter?',
            // Process: message: 'Are you sure you want to load a new encounter?',
            message: 'Are you sure you want to load a new encounter?',
            detail: 'This will overwrite the current encounter. You may want to save your current progress first.',
// Process: buttons: ['Load Encounter', 'Cancel'],
            // Process: buttons: ['Load Encounter', 'Cancel'],
            buttons: ['Load Encounter', 'Cancel'],
            defaultId: 0,
// Process: cancelId: 1
            // Process: cancelId: 1
            cancelId: 1
        });

// Process: if (confirmResult.response === 1)  // User clicked 'Cancel'
        // Process: if (confirmResult.response === 1)
        if (confirmResult.response === 1) { // User clicked 'Cancel'
            return;
// Process:
        // Process:
        }

        const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
// Process: title: 'Load Encounter',
            // Process: title: 'Load Encounter',
            title: 'Load Encounter',
            defaultPath: app.getPath('userData'),
// Process: properties: ['openFile'],
            // Process: properties: ['openFile'],
            properties: ['openFile'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
// Process: )
        // Process: )
        });

        if (!canceled && filePaths && filePaths.length > 0) {
// Process: const filePath = filePaths[0]
            // Process: const filePath = filePaths[0]
            const filePath = filePaths[0];
            initiativeTracker.loadEncounterFromFile(filePath);
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('add-creature', (event, creature) =>
    // Process: ipcMain.on('add-creature', (event, creature) =>
    ipcMain.on('add-creature', (event, creature) => {
        initiativeTracker.addCreature(creature);
// Process: )
    // Process: )
    });

    ipcMain.on('update-creature', (event, creature) => {
// Process: initiativeTracker.updateCreature(creature)
        // Process: initiativeTracker.updateCreature(creature)
        initiativeTracker.updateCreature(creature);
    });

// Process: ipcMain.on('update-reminders', (event,  creatureId, remin...
    // Process: ipcMain.on('update-reminders', (event,  creatureId, remin...
    ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
        initiativeTracker.updateReminders(creatureId, reminders);
// Process: )
    // Process: )
    });

    ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
// Process: const result = initiativeTracker.rollStat(creatureId, rol...
        // Process: const result = initiativeTracker.rollStat(creatureId, rol...
        const result = initiativeTracker.rollStat(creatureId, rollType, stat, type);
        if (result) {
// Process: const  message, embed  = result
            // Process: const  message, embed  = result
            const { message, embed } = result;
            mainWindow.webContents.send('dice-log', message);
// Process: if (discordConfig.textChannel)
            // Process: if (discordConfig.textChannel)
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
// Process: if (channel)
                // Process: if (channel)
                if (channel) {
                    channel.send({ embeds: [embed] });
// Process:
                // Process:
                }
            }
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('roll-attack', (event,  creatureId, rollType, ...
    // Process: ipcMain.on('roll-attack', (event,  creatureId, rollType, ...
    ipcMain.on('roll-attack', (event, { creatureId, rollType, modIndex }) => {
        const result = initiativeTracker.rollAttack(creatureId, rollType, modIndex);
// Process: if (result)
        // Process: if (result)
        if (result) {
            const { message, embed } = result;
// Process: mainWindow.webContents.send('dice-log', message)
            // Process: mainWindow.webContents.send('dice-log', message)
            mainWindow.webContents.send('dice-log', message);
            if (discordConfig.textChannel) {
// Process: const channel = client.channels.cache.get(discordConfig.t...
                // Process: const channel = client.channels.cache.get(discordConfig.t...
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
// Process: channel.send( embeds: [embed] )
                    // Process: channel.send( embeds: [embed] )
                    channel.send({ embeds: [embed] });
                }
// Process:
            // Process:
            }
        }
// Process: )
    // Process: )
    });

    ipcMain.on('reset-encounter', () => {
// Process: initiativeTracker.resetEncounter()
        // Process: initiativeTracker.resetEncounter()
        initiativeTracker.resetEncounter();
    });

// Process: ipcMain.on('clear-encounter', async () =>
    // Process: ipcMain.on('clear-encounter', async () =>
    ipcMain.on('clear-encounter', async () => {
        const result = await dialog.showMessageBox(mainWindow, {
// Process: type: 'warning',
            // Process: type: 'warning',
            type: 'warning',
            title: 'Confirm Clear',
// Process: message: 'Are you sure you want to clear the entire encou...
            // Process: message: 'Are you sure you want to clear the entire encou...
            message: 'Are you sure you want to clear the entire encounter? This cannot be undone.',
            detail: 'You may want to save the encounter first.',
// Process: buttons: ['Clear Encounter', 'Cancel'],
            // Process: buttons: ['Clear Encounter', 'Cancel'],
            buttons: ['Clear Encounter', 'Cancel'],
            defaultId: 1,
// Process: cancelId: 1
            // Process: cancelId: 1
            cancelId: 1
        });
// Process: if (result.response === 0)  // 'Clear Encounter' button
        // Process: if (result.response === 0)
        if (result.response === 0) { // 'Clear Encounter' button
            initiativeTracker.clearEncounter();
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('edit-creature', (event,  creatureId ) =>
    // Process: ipcMain.on('edit-creature', (event,  creatureId ) =>
    ipcMain.on('edit-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.editCreature(creatureId);
// Process: if (creature)
        // Process: if (creature)
        if (creature) {
            mainWindow.webContents.send('populate-edit-form', creature);
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('remove-creature', (event,  creatureId ) =>
    // Process: ipcMain.on('remove-creature', (event,  creatureId ) =>
    ipcMain.on('remove-creature', (event, { creatureId }) => {
        initiativeTracker.removeCreature(creatureId);
// Process: )
    // Process: )
    });

    ipcMain.on('copy-creature', (event, { creatureId }) => {
// Process: const creature = initiativeTracker.getCreature(creatureId)
        // Process: const creature = initiativeTracker.getCreature(creatureId)
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
// Process: mainWindow.webContents.send('populate-add-form', creature)
            // Process: mainWindow.webContents.send('populate-add-form', creature)
            mainWindow.webContents.send('populate-add-form', creature);
        }
// Process: )
    // Process: )
    });


    ipcMain.on('previous-turn', async () => {
// Process: const turnInfo = initiativeTracker.previousTurn()
        // Process: const turnInfo = initiativeTracker.previousTurn()
        const turnInfo = initiativeTracker.previousTurn();
        if (turnInfo) {
// Process: await checkAndShowReminders(turnInfo.oldCreature, 'end')
            // Process: await checkAndShowReminders(turnInfo.oldCreature, 'end')
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            await checkAndShowReminders(turnInfo.newCreature, 'start');
// Process:
        // Process:
        }
    });

// Process: ipcMain.on('add-temp-hp', (event,  creatureId, amount ) =>
    // Process: ipcMain.on('add-temp-hp', (event,  creatureId, amount ) =>
    ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
        initiativeTracker.addTempHp(creatureId, amount);
// Process: )
    // Process: )
    });

    ipcMain.on('update-hp', (event, { creatureId, amount }) => {
// Process: const result = initiativeTracker.updateHp(creatureId, amo...
        // Process: const result = initiativeTracker.updateHp(creatureId, amo...
        const result = initiativeTracker.updateHp(creatureId, amount);
        if (result && result.concentrationCheckDC) {
// Process: dialog.showMessageBox(mainWindow,  type: 'warning', title...
            // Process: dialog.showMessageBox(mainWindow,  type: 'warning', title...
            dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`, buttons: ['OK'] });
        }
// Process: )
    // Process: )
    });

    ipcMain.on('add-condition', (event, { creatureId, condition }) => {
// Process: logToRenderer(`Adding condition $condition to creature $c...
        // Process: logToRenderer(`Adding condition $condition to creature $c...
        logToRenderer(`Adding condition ${condition} to creature ${creatureId}`);
        initiativeTracker.addCondition(creatureId, condition);
// Process: )
    // Process: )
    });

    ipcMain.on('remove-condition', (event, { creatureId, condition }) => {
// Process: initiativeTracker.removeCondition(creatureId, condition)
        // Process: initiativeTracker.removeCondition(creatureId, condition)
        initiativeTracker.removeCondition(creatureId, condition);
    });

// Process: ipcMain.on('update-creature-flag', (event,  creatureId, f...
    // Process: ipcMain.on('update-creature-flag', (event,  creatureId, f...
    ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
        initiativeTracker.updateCreatureFlag(creatureId, flag, value);
// Process: )
    // Process: )
    });

    ipcMain.on('update-death-saves', (event, { creatureId, deathSaves }) => {
// Process: const creature = initiativeTracker.getCreature(creatureId)
        // Process: const creature = initiativeTracker.getCreature(creatureId)
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
// Process: const oldSaves = creature.deathSaves ||  successes: 0, fa...
            // Process: const oldSaves = creature.deathSaves ||  successes: 0, fa...
            const oldSaves = creature.deathSaves || { successes: 0, failures: 0 };
            creature.deathSaves = deathSaves;

            // Trigger popups if 3 is reached manually
// Process: if (deathSaves.successes >= 3 && oldSaves.successes < 3)
            // Process: if (deathSaves.successes >= 3 && oldSaves.successes < 3)
            if (deathSaves.successes >= 3 && oldSaves.successes < 3) {
                dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized!`, buttons: ['OK'] });
// Process: else if (deathSaves.failures >= 3 && oldSaves.failures < 3)
            // Process: else if (deathSaves.failures >= 3 && oldSaves.failures < 3)
            } else if (deathSaves.failures >= 3 && oldSaves.failures < 3) {
                dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died.`, buttons: ['OK'] });
// Process:
            // Process:
            }

            initiativeTracker._updateFrontend();
// Process: initiativeTracker._saveState()
            // Process: initiativeTracker._saveState()
            initiativeTracker._saveState();
        }
// Process: )
    // Process: )
    });

    ipcMain.on('roll-death-save', (event, { creatureId, rollType }) => {
// Process: const creature = initiativeTracker.getCreature(creatureId)
        // Process: const creature = initiativeTracker.getCreature(creatureId)
        const creature = initiativeTracker.getCreature(creatureId);
        if (!creature) return;
// Process: if (!creature.deathSaves) creature.deathSaves =  successe...
        // Process: if (!creature.deathSaves) creature.deathSaves =  successe...
        if (!creature.deathSaves) creature.deathSaves = { successes: 0, failures: 0 };

        let notation = '1d20';
// Process: if (rollType === 'adv') notation = '2d20kh1'
        // Process: if (rollType === 'adv') notation = '2d20kh1'
        if (rollType === 'adv') notation = '2d20kh1';
        if (rollType === 'dis') notation = '2d20kl1';

// Process: const roll = new DiceRoller().roll(notation)
        // Process: const roll = new DiceRoller().roll(notation)
        const roll = new DiceRoller().roll(notation);
        const result = roll.total;

// Process: let outcome = null
        // Process: let outcome = null
        let outcome = null;
        let message = `${creature.name} rolled a Death Saving Throw (${rollType}): **${result}**`;
// Process: if (result === 20)
        // Process: if (result === 20)
        if (result === 20) {
            message += " - **Critical Success!** (Regains 1 HP)";
// Process: outcome = 'crit-success'
            // Process: outcome = 'crit-success'
            outcome = 'crit-success';
            initiativeTracker.updateHp(creatureId, 1);
// Process: else if (result >= 10)
        // Process: else if (result >= 10)
        } else if (result >= 10) {
            message += " - Success";
// Process: creature.deathSaves.successes = Math.min(3, (creature.dea...
            // Process: creature.deathSaves.successes = Math.min(3, (creature.dea...
            creature.deathSaves.successes = Math.min(3, (creature.deathSaves.successes || 0) + 1);
            if (creature.deathSaves.successes >= 3) outcome = 'stabilized';
// Process: else if (result === 1)
        // Process: else if (result === 1)
        } else if (result === 1) {
            message += " - **Critical Failure!** (2 failures)";
// Process: creature.deathSaves.failures = Math.min(3, (creature.deat...
            // Process: creature.deathSaves.failures = Math.min(3, (creature.deat...
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 2);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
// Process: else
        // Process: else
        } else {
            message += " - Failure";
// Process: creature.deathSaves.failures = Math.min(3, (creature.deat...
            // Process: creature.deathSaves.failures = Math.min(3, (creature.deat...
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 1);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
// Process:
        // Process:
        }

        logDiceRollToRenderer(message);

// Process: if (outcome === 'crit-success')
        // Process: if (outcome === 'crit-success')
        if (outcome === 'crit-success') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Critical Success!', message: `${creature.name} rolled a natural 20 and regained 1 HP!`, buttons: ['OK'] });
// Process: else if (outcome === 'stabilized')
        // Process: else if (outcome === 'stabilized')
        } else if (outcome === 'stabilized') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized with 3 successes.`, buttons: ['OK'] });
// Process: else if (outcome === 'dead')
        // Process: else if (outcome === 'dead')
        } else if (outcome === 'dead') {
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died with 3 failures.`, buttons: ['OK'] });
// Process:
        // Process:
        }

        initiativeTracker._updateFrontend();
// Process: initiativeTracker._saveState()
        // Process: initiativeTracker._saveState()
        initiativeTracker._saveState();
    });

// Process: ipcMain.on('show-emoji-panel', () =>
    // Process: ipcMain.on('show-emoji-panel', () =>
    ipcMain.on('show-emoji-panel', () => {
        app.showEmojiPanel();
// Process: )
    // Process: )
    });

    ipcMain.handle('search-monsters', async (event, query) => {
// Process: logToRenderer(`[IPC] Received "search-monsters" with quer...
        // Process: logToRenderer(`[IPC] Received "search-monsters" with quer...
        logToRenderer(`[IPC] Received "search-monsters" with query: "${query}"`);
        if (!fiveEToolsParser) {
// Process: logToRenderer('[IPC] Parser not available.')
            // Process: logToRenderer('[IPC] Parser not available.')
            logToRenderer('[IPC] Parser not available.');
            return [];
// Process:
        // Process:
        }
        const results = await fiveEToolsParser.searchByName('bestiary', query);
// Process: logToRenderer(`[IPC] Found $results.length monsters, retu...
        // Process: logToRenderer(`[IPC] Found $results.length monsters, retu...
        logToRenderer(`[IPC] Found ${results.length} monsters, returning to renderer.`);
        return results;
// Process: )
    // Process: )
    });

    ipcMain.handle('get-monster-details', async (event, { name, source }) => {
// Process: logToRenderer(`[IPC] Received "get-monster-details" for: ...
        // Process: logToRenderer(`[IPC] Received "get-monster-details" for: ...
        logToRenderer(`[IPC] Received "get-monster-details" for: ${name} (${source})`);
        if (!fiveEToolsParser) {
// Process: logToRenderer('[IPC] Parser not available.')
            // Process: logToRenderer('[IPC] Parser not available.')
            logToRenderer('[IPC] Parser not available.');
            return null;
// Process:
        // Process:
        }
        const monster = await fiveEToolsParser.getExact('bestiary', name, source);
// Process: logToRenderer(`[IPC] Found monster details, returning to ...
        // Process: logToRenderer(`[IPC] Found monster details, returning to ...
        logToRenderer(`[IPC] Found monster details, returning to renderer.`);
        return monster;
// Process: )
    // Process: )
    });

    ipcMain.on('push-dicelog-to-discord', async (event, logContent) => {
// Process: if (!discordConfig.textChannel)
        // Process: if (!discordConfig.textChannel)
        if (!discordConfig.textChannel) {
            logToRenderer('[push-dicelog] No text channel configured.');
// Process: return
            // Process: return
            return;
        }
// Process: const channel = client.channels.cache.get(discordConfig.t...
        // Process: const channel = client.channels.cache.get(discordConfig.t...
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
// Process: logToRenderer(`[push-dicelog] FAILED to find channel with...
            // Process: logToRenderer(`[push-dicelog] FAILED to find channel with...
            logToRenderer(`[push-dicelog] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
// Process:
        // Process:
        }
        try {
// Process: const embed = new EmbedBuilder()
            // Process: const embed = new EmbedBuilder()
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
// Process: .setTitle('Dice Rolls')
                // Process: .setTitle('Dice Rolls')
                .setTitle('Dice Rolls')
                .setDescription(logContent)
// Process: .setTimestamp()
                // Process: .setTimestamp()
                .setTimestamp();
            await channel.send({ embeds: [embed] });
// Process: logToRenderer('[push-dicelog] Successfully pushed dice lo...
            // Process: logToRenderer('[push-dicelog] Successfully pushed dice lo...
            logToRenderer('[push-dicelog] Successfully pushed dice log to chat.');
        } catch (error) {
// Process: logToRenderer(`[push-dicelog] FAILED to send embed: $error`)
            // Process: logToRenderer(`[push-dicelog] FAILED to send embed: $error`)
            logToRenderer(`[push-dicelog] FAILED to send embed: ${error}`);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('push-statblock-to-discord', async (event, rawDataString) => {
// Process: if (!discordConfig.textChannel)
        // Process: if (!discordConfig.textChannel)
        if (!discordConfig.textChannel) {
            logToRenderer('[push-statblock] No text channel configured.');
// Process: return
            // Process: return
            return;
        }
// Process: const channel = client.channels.cache.get(discordConfig.t...
        // Process: const channel = client.channels.cache.get(discordConfig.t...
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
// Process: logToRenderer(`[push-statblock] FAILED to find channel wi...
            // Process: logToRenderer(`[push-statblock] FAILED to find channel wi...
            logToRenderer(`[push-statblock] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
// Process:
        // Process:
        }
        try {
// Process: const monster = JSON.parse(rawDataString)
            // Process: const monster = JSON.parse(rawDataString)
            const monster = JSON.parse(rawDataString);
            const { mainEmbed, longFields } = formatStatBlockForDiscord(monster);

            // Send the main embed
// Process: const mainMessage = await channel.send( embeds: [mainEmbe...
            // Process: const mainMessage = await channel.send( embeds: [mainEmbe...
            const mainMessage = await channel.send({ embeds: [mainEmbed] });
            logToRenderer('[push-statblock] Successfully pushed main stat block embed.');

            // If there are long fields, create a thread and post them
// Process: if (longFields.length > 0)
            // Process: if (longFields.length > 0)
            if (longFields.length > 0) {
                const thread = await mainMessage.startThread({
// Process: name: `$monster.name - Details`,
                    // Process: name: `$monster.name - Details`,
                    name: `${monster.name} - Details`,
                    autoArchiveDuration: 60,
// Process: )
                // Process: )
                });

                for (const field of longFields) {
// Process: const chunks = splitText(field.value, 1024)
                    // Process: const chunks = splitText(field.value, 1024)
                    const chunks = splitText(field.value, 1024);
                    for (let i = 0; i < chunks.length; i++) {
// Process: const chunkEmbed = new EmbedBuilder()
                        // Process: const chunkEmbed = new EmbedBuilder()
                        const chunkEmbed = new EmbedBuilder()
                            .setColor(0x0099FF)
// Process: .setTitle(chunks.length > 1 ? `$field.name ($i + 1/$chunk...
                            // Process: .setTitle(chunks.length > 1 ? `$field.name ($i + 1/$chunk...
                            .setTitle(chunks.length > 1 ? `${field.name} (${i + 1}/${chunks.length})` : field.name)
                            .setDescription(chunks[i]);
// Process: await thread.send( embeds: [chunkEmbed] )
                        // Process: await thread.send( embeds: [chunkEmbed] )
                        await thread.send({ embeds: [chunkEmbed] });
                    }
// Process:
                // Process:
                }
                logToRenderer(`[push-statblock] Sent ${longFields.length} detail section(s) to thread.`);
// Process:
            // Process:
            }
        } catch (error) {
// Process: logToRenderer(`[push-statblock] FAILED to send embed: $er...
            // Process: logToRenderer(`[push-statblock] FAILED to send embed: $er...
            logToRenderer(`[push-statblock] FAILED to send embed: ${error}`);
        }
// Process: )
    // Process: )
    });

    ipcMain.on('push-mob-rules-to-discord', async (event, { creatureName, absoluteImagePath }) => {
// Process: if (!creatureName || !absoluteImagePath)
        // Process: if (!creatureName || !absoluteImagePath)
        if (!creatureName || !absoluteImagePath) {
            const errorMsg = `[push-mob-rules] Error: Missing creatureName or absoluteImagePath.`;
// Process: logToRenderer(errorMsg)
            // Process: logToRenderer(errorMsg)
            logToRenderer(errorMsg);
            dialog.showErrorBox('Discord Error', `Could not push mob rules. Data from UI was incomplete.`);
// Process: return
            // Process: return
            return;
        }

// Process: if (!discordConfig.textChannel)
        // Process: if (!discordConfig.textChannel)
        if (!discordConfig.textChannel) {
            logToRenderer('[push-mob-rules] No text channel configured.');
// Process: return
            // Process: return
            return;
        }
// Process: const channel = client.channels.cache.get(discordConfig.t...
        // Process: const channel = client.channels.cache.get(discordConfig.t...
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
// Process: logToRenderer(`[push-mob-rules] FAILED to find channel wi...
            // Process: logToRenderer(`[push-mob-rules] FAILED to find channel wi...
            logToRenderer(`[push-mob-rules] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
// Process:
        // Process:
        }

        try {
// Process: logToRenderer(`[push-mob-rules] Reading image file into b...
            // Process: logToRenderer(`[push-mob-rules] Reading image file into b...
            logToRenderer(`[push-mob-rules] Reading image file into buffer from: ${absoluteImagePath}`);
            const imageBuffer = await fs.readFile(absoluteImagePath);
// Process: logToRenderer(`[push-mob-rules] Successfully read image i...
            // Process: logToRenderer(`[push-mob-rules] Successfully read image i...
            logToRenderer(`[push-mob-rules] Successfully read image into buffer (${imageBuffer.length} bytes).`);

            const { mainEmbed } = formatMobRulesForDiscord(creatureName);

// Process: await channel.send(
            // Process: await channel.send(
            await channel.send({
                embeds: [mainEmbed],
// Process: files: [
                // Process: files: [
                files: [{
                    attachment: imageBuffer, // Send the buffer directly
// Process: name: path.basename(absoluteImagePath)
                    // Process: name: path.basename(absoluteImagePath)
                    name: path.basename(absoluteImagePath)
                }]
// Process: )
            // Process: )
            });
            logToRenderer('[push-mob-rules] Successfully pushed mob rules embed with image buffer.');
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            logToRenderer(`[push-mob-rules] FAILED to send embed: ${error.message}`);
// Process: logToRenderer(`[push-mob-rules] Error stack: $error.stack`)
            // Process: logToRenderer(`[push-mob-rules] Error stack: $error.stack`)
            logToRenderer(`[push-mob-rules] Error stack: ${error.stack}`);
            dialog.showErrorBox('Discord Error', `Failed to read image file or send to Discord. Please check the file at: ${absoluteImagePath}\n\n${error.message}`);
// Process:
        // Process:
        }
    });
// Process:
// Process:
}

/**
 * Sends a log message to the renderer process to be displayed in the UI.
 * It waits until the app is ready before sending the message.
 * @param {string} message - The message to log.
 */
/**
 * Sends a log message to the renderer process to be displayed in the UI.
 * It waits until the app is ready before sending the message.
 * @param {string} message - The message to log.
 */
async function logToRenderer(...args) {
/**
 * Auto-generated documentation
 */
// Process: const message = args.map(arg =>
    // Process: const message = args.map(arg =>
    const message = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
// Process: if (typeof arg === 'object') return JSON.stringify(arg)
        // Process: if (typeof arg === 'object') return JSON.stringify(arg)
        if (typeof arg === 'object') return JSON.stringify(arg);
        return arg;
// Process: ).join(' ')
    // Process: ).join(' ')
    }).join(' ');

    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
// Process: mainWindow.webContents.send('log-message', message)
        // Process: mainWindow.webContents.send('log-message', message)
        mainWindow.webContents.send('log-message', message);
    }
// Process: else if (!isAppReady)
    // Process: else if (!isAppReady)
    else if (!isAppReady) {
        await sleep(100);
// Process: logToRenderer(message)
        // Process: logToRenderer(message)
        logToRenderer(message);
    }
// Process:
// Process:
}

/*
client.on('error', error => {
// Process: logToRenderer('An error occurred: ', error)
    // Process: logToRenderer('An error occurred: ', error)
    logToRenderer('An error occurred: ', error);
});
*/

/**
 * Initializes and logs in the Discord bot using the token from the configuration.
 * Handles login errors and notifies the user.
 */
/**
 * Initializes and logs in the Discord bot using the token from the configuration.
 * Handles login errors and notifies the user.
 */
/**
 * Auto-generated documentation
 */
// Process: function initializeDiscordBot()
// Process: function initializeDiscordBot()
function initializeDiscordBot() {
    if (!discordConfig || !discordConfig.token) {
// Process: logToRenderer('Discord token not found. Bot not started.')
        // Process: logToRenderer('Discord token not found. Bot not started.')
        logToRenderer('Discord token not found. Bot not started.');
        return;
// Process:
    // Process:
    }

    client.login(discordConfig.token).catch(error => {
// Process: logToRenderer(`Discord login failed: $error.message`)
        // Process: logToRenderer(`Discord login failed: $error.message`)
        logToRenderer(`Discord login failed: ${error.message}`);
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
// Process: broadcastBotStatus()
        // Process: broadcastBotStatus()
        broadcastBotStatus();
    });
// Process:
// Process:
}

/**
 * Broadcasts the current bot status to the renderer process.
 */
/**
 * Auto-generated documentation
 */
function broadcastBotStatus() {
// Process: const status = client.isReady() ? (isSoftLocked ? 'soft-l...
    // Process: const status = client.isReady() ? (isSoftLocked ? 'soft-l...
    const status = client.isReady() ? (isSoftLocked ? 'soft-locked' : 'online') : 'offline';
    const message = isSoftLocked ? 'Busy (Occupied)' : (client.isReady() ? 'Connected' : (discordConfig.token ? 'Connecting...' : 'Not Configured'));

// Process: const payload =
    // Process: const payload =
    const payload = {
        status,
// Process: message,
        // Process: message,
        message,
        voiceStatus,
// Process: isSoftLocked
        // Process: isSoftLocked
        isSoftLocked
    };

// Process: if (mainWindow && !mainWindow.isDestroyed())
    // Process: if (mainWindow && !mainWindow.isDestroyed())
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-bot-status', payload);
// Process:
    // Process:
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
// Process: settingsWindow.webContents.send('discord-bot-status', pay...
        // Process: settingsWindow.webContents.send('discord-bot-status', pay...
        settingsWindow.webContents.send('discord-bot-status', payload);
    }
// Process:
// Process:
}

let isShuttingDown = false;
/**
 * Auto-generated documentation
 */
// Process: const shutdown = async () =>
// Process: const shutdown = async () =>
const shutdown = async () => {
    if (isShuttingDown) return;
// Process: isShuttingDown = true
    // Process: isShuttingDown = true
    isShuttingDown = true;
    try {
// Process: console.log('Cleaning up and exiting.')
        // Process: console.log('Cleaning up and exiting.')
        console.log('Cleaning up and exiting.');


        // Delete media control message gracefully
        if (client && client.lastMediaMessage) {
// Process: try
            // Process: try
            try {
                await client.lastMediaMessage.delete().catch(() => {});
// Process: client.lastMediaMessage = null
                // Process: client.lastMediaMessage = null
                client.lastMediaMessage = null;
            } catch (e) {
// Process: console.error("Error deleting media control on shutdown:"...
                // Process: console.error("Error deleting media control on shutdown:"...
                console.error("Error deleting media control on shutdown:", e);
            }
// Process:
        // Process:
        }

        // Remove all event listeners
        if (client) {
// Process: client.removeAllListeners()
            // Process: client.removeAllListeners()
            client.removeAllListeners();
        }
// Process: if (musicPlayer)
        // Process: if (musicPlayer)
        if (musicPlayer) {
            if (musicPlayer.player) musicPlayer.player.removeAllListeners();
// Process: musicPlayer.destroy()
            // Process: musicPlayer.destroy()
            musicPlayer.destroy();
        }
// Process: if (connection)
        // Process: if (connection)
        if (connection) {
            connection.removeAllListeners();
// Process: connection.destroy()
            // Process: connection.destroy()
            connection.destroy();
        }

        // Optionally logout with a timeout to prevent hanging the shutdown
// Process: if (client)
        // Process: if (client)
        if (client) {
            try {
// Process: const destroyPromise = client.destroy()
                // Process: const destroyPromise = client.destroy()
                const destroyPromise = client.destroy();
/**
 * Auto-generated documentation
 */
                const timeoutPromise = new Promise((_, reject) =>
// Process: setTimeout(() => reject(new Error('Discord client destroy...
                    // Process: setTimeout(() => reject(new Error('Discord client destroy...
                    setTimeout(() => reject(new Error('Discord client destroy timed out')), 5000)
                );
// Process: await Promise.race([destroyPromise, timeoutPromise])
                // Process: await Promise.race([destroyPromise, timeoutPromise])
                await Promise.race([destroyPromise, timeoutPromise]);
            } catch (e) {
// Process: console.error("Error destroying discord client:", e)
                // Process: console.error("Error destroying discord client:", e)
                console.error("Error destroying discord client:", e);
            }
// Process:
        // Process:
        }

        console.log('Final exit.');
// Process: app.exit(0)
        // Process: app.exit(0)
        app.exit(0);
    }
// Process: catch (error)
    // Process: catch (error)
    catch (error) {
        console.log('Error during shutdown:', error);
// Process: process.exit(1)
        // Process: process.exit(1)
        process.exit(1);
    }
// Process:
// Process:
};

app.on('before-quit', (e) => {
// Process: if (!isShuttingDown)
    // Process: if (!isShuttingDown)
    if (!isShuttingDown) {
        e.preventDefault();
// Process: shutdown()
        // Process: shutdown()
        shutdown();
    }
// Process: )
// Process: )
});

app.on('window-all-closed', () => {
    // Standard behavior: quit when all windows are closed,
    // unless on macOS where apps typically stay active.
// Process: if (process.platform !== 'darwin')
    // Process: if (process.platform !== 'darwin')
    if (process.platform !== 'darwin') {
        app.quit();
// Process:
    // Process:
    }
});

/**
 * Joins a voice channel based on the configuration.
 * Implements a "knock" protocol to prevent multiple instances from joining the same channel.
 */
// Process: async function joinVoiceChannelAction()
// Process: async function joinVoiceChannelAction()
async function joinVoiceChannelAction() {
    if (isJoiningVoice) return;

    // Wait for client readiness if necessary
// Process: if (!client.isReady())
    // Process: if (!client.isReady())
    if (!client.isReady()) {
        logToRenderer("[Discord] Client not ready for voice join.");
// Process: return
        // Process: return
        return;
    }

// Process: const isActive = connection && (
    // Process: const isActive = connection && (
    const isActive = connection && (
        connection.state.status !== VoiceConnectionStatus.Disconnected &&
// Process: connection.state.status !== VoiceConnectionStatus.Destroyed
        // Process: connection.state.status !== VoiceConnectionStatus.Destroyed
        connection.state.status !== VoiceConnectionStatus.Destroyed
    );
// Process: if (isActive) return
    // Process: if (isActive) return
    if (isActive) return;

    isJoiningVoice = true;
// Process: isSoftLocked = false
    // Process: isSoftLocked = false
    isSoftLocked = false;

    const voiceChannelId = discordConfig.voiceChannel;
// Process: if (voiceChannelId && discordConfig.textChannel)
    // Process: if (voiceChannelId && discordConfig.textChannel)
    if (voiceChannelId && discordConfig.textChannel) {
        let textChannel = client.channels.cache.get(discordConfig.textChannel);
// Process: if (!textChannel)
        // Process: if (!textChannel)
        if (!textChannel) {
            try { textChannel = await client.channels.fetch(discordConfig.textChannel); } catch (e) {}
// Process:
        // Process:
        }

        if (textChannel && textChannel.isTextBased()) {
// Process: logToRenderer(`[Anti-Collision] Knocking on voice channel...
            // Process: logToRenderer(`[Anti-Collision] Knocking on voice channel...
            logToRenderer(`[Anti-Collision] Knocking on voice channel ${voiceChannelId}...`);
            const knockMsg = await textChannel.send(`||~~TT_KNOCK:${voiceChannelId}~~||`);
// Process: setTimeout(() => knockMsg.delete().catch(() => ), 500)
            // Process: setTimeout(() => knockMsg.delete().catch(() => ), 500)
            setTimeout(() => knockMsg.delete().catch(() => {}), 500);

            // Wait 1 second for occupancy response
            let isOccupied = false;
// Process: const collector = textChannel.createMessageCollector(
            // Process: const collector = textChannel.createMessageCollector(
            const collector = textChannel.createMessageCollector({
                filter: m => m.content.includes(`TT_OCCUPIED:${voiceChannelId}`) && m.author.id === client.user.id,
// Process: time: 1000
                // Process: time: 1000
                time: 1000
            });

// Process: await new Promise(resolve =>
            // Process: await new Promise(resolve =>
            await new Promise(resolve => {
                collector.on('collect', () => {
// Process: isOccupied = true
                    // Process: isOccupied = true
                    isOccupied = true;
                    collector.stop();
// Process: )
                // Process: )
                });
                collector.on('end', resolve);
// Process: )
            // Process: )
            });

            if (isOccupied) {
// Process: logToRenderer(`[Anti-Collision] Voice channel $voiceChann...
                // Process: logToRenderer(`[Anti-Collision] Voice channel $voiceChann...
                logToRenderer(`[Anti-Collision] Voice channel ${voiceChannelId} is occupied. Join cancelled.`);
                isSoftLocked = true;
// Process: isJoiningVoice = false
                // Process: isJoiningVoice = false
                isJoiningVoice = false;
                broadcastBotStatus();
// Process: return
                // Process: return
                return;
            }
// Process:
        // Process:
        }
    }

// Process: const voiceChannel = client.channels.cache.get(voiceChann...
    // Process: const voiceChannel = client.channels.cache.get(voiceChann...
    const voiceChannel = client.channels.cache.get(voiceChannelId);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
// Process: try
        // Process: try
        try {
            voiceStatus = 'connecting';
// Process: broadcastBotStatus()
            // Process: broadcastBotStatus()
            broadcastBotStatus();

            const existingConnection = getVoiceConnection(voiceChannel.guild.id);
// Process: if (existingConnection)
            // Process: if (existingConnection)
            if (existingConnection) {
                existingConnection.destroy();
// Process:
            // Process:
            }

            connection = joinVoiceChannel({
// Process: channelId: voiceChannel.id,
                // Process: channelId: voiceChannel.id,
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
// Process: adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                // Process: adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
// Process: selfMute: false
                // Process: selfMute: false
                selfMute: false
            });

// Process: connection.on(VoiceConnectionStatus.Ready, () =>
            // Process: connection.on(VoiceConnectionStatus.Ready, () =>
            connection.on(VoiceConnectionStatus.Ready, () => {
                voiceStatus = 'connected';
// Process: broadcastBotStatus()
                // Process: broadcastBotStatus()
                broadcastBotStatus();
                logToRenderer('The bot has connected to the channel!');
// Process: musicPlayer.setConnection(connection)
                // Process: musicPlayer.setConnection(connection)
                musicPlayer.setConnection(connection);
            });

// Process: connection.on(VoiceConnectionStatus.Disconnected, async (...
            // Process: connection.on(VoiceConnectionStatus.Disconnected, async (...
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                voiceStatus = 'connecting';
// Process: broadcastBotStatus()
                // Process: broadcastBotStatus()
                broadcastBotStatus();
                try {
// Process: await Promise.race([
                    // Process: await Promise.race([
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
// Process: entersState(connection, VoiceConnectionStatus.Connecting,...
                        // Process: entersState(connection, VoiceConnectionStatus.Connecting,...
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
// Process: catch (error)
                // Process: catch (error)
                } catch (error) {
                    leaveVoiceChannelAction();
// Process:
                // Process:
                }
            });

// Process: connection.on(VoiceConnectionStatus.Destroyed, () =>
            // Process: connection.on(VoiceConnectionStatus.Destroyed, () =>
            connection.on(VoiceConnectionStatus.Destroyed, () => {
                voiceStatus = 'disconnected';
// Process: broadcastBotStatus()
                // Process: broadcastBotStatus()
                broadcastBotStatus();
            });

// Process: await entersState(connection, VoiceConnectionStatus.Ready...
            // Process: await entersState(connection, VoiceConnectionStatus.Ready...
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        } catch (error) {
// Process: logToRenderer('Error joining voice channel: ', error.mess...
            // Process: logToRenderer('Error joining voice channel: ', error.mess...
            logToRenderer('Error joining voice channel: ', error.message || error);
            leaveVoiceChannelAction();
// Process: finally
        // Process: finally
        } finally {
            isJoiningVoice = false;
// Process:
        // Process:
        }
    } else {
// Process: logToRenderer('Voice channel not found or is not a voice ...
        // Process: logToRenderer('Voice channel not found or is not a voice ...
        logToRenderer('Voice channel not found or is not a voice channel!');
        isJoiningVoice = false;
// Process:
    // Process:
    }
}

/**
 * Leaves the current voice channel and destroys the connection.
 */
/**
 * Auto-generated documentation
 */
// Process: function leaveVoiceChannelAction()
// Process: function leaveVoiceChannelAction()
function leaveVoiceChannelAction() {
    if (connection) {
// Process: connection.destroy()
        // Process: connection.destroy()
        connection.destroy();
        connection = null;
// Process:
    // Process:
    }
    voiceStatus = 'disconnected';
// Process: broadcastBotStatus()
    // Process: broadcastBotStatus()
    broadcastBotStatus();
}

// Process: client.once(Events.ClientReady, async () =>
// Process: client.once(Events.ClientReady, async () =>
client.once(Events.ClientReady, async () => {
    logToRenderer('TavernTones is online!');

    // Robust collision detection for Voice Channels using a "Knock" protocol
// Process: if (discordConfig.textChannel)
    // Process: if (discordConfig.textChannel)
    if (discordConfig.textChannel) {
        try {
// Process: let channel = client.channels.cache.get(discordConfig.tex...
            // Process: let channel = client.channels.cache.get(discordConfig.tex...
            let channel = client.channels.cache.get(discordConfig.textChannel);
            if (!channel) channel = await client.channels.fetch(discordConfig.textChannel);

// Process: if (channel && channel.isTextBased())
            // Process: if (channel && channel.isTextBased())
            if (channel && channel.isTextBased()) {
                // Listen for knocks from other instances
                client.on('messageCreate', async (m) => {
// Process: if (m.author.id !== client.user.id) return
                    // Process: if (m.author.id !== client.user.id) return
                    if (m.author.id !== client.user.id) return;

                    // Response to a "knock" if we are currently in that voice channel
                    // AND we have an active connection (we don't respond if we are just a ghost/zombie)
                    if (m.content.includes('TT_KNOCK:')) {
// Process: const targetId = m.content.split('TT_KNOCK:')[1].split('~...
                        // Process: const targetId = m.content.split('TT_KNOCK:')[1].split('~...
                        const targetId = m.content.split('TT_KNOCK:')[1].split('~')[0];
                        const me = m.guild.members.me;
// Process: const isActivelyConnected = connection && (
                        // Process: const isActivelyConnected = connection && (
                        const isActivelyConnected = connection && (
                            connection.state.status === VoiceConnectionStatus.Ready ||
// Process: connection.state.status === VoiceConnectionStatus.Connect...
                            // Process: connection.state.status === VoiceConnectionStatus.Connect...
                            connection.state.status === VoiceConnectionStatus.Connecting ||
                            connection.state.status === VoiceConnectionStatus.Signalling
// Process: )
                        // Process: )
                        );

                        if (me && me.voice.channelId === targetId && isActivelyConnected) {
// Process: logToRenderer(`[Anti-Collision] Responding to knock for c...
                            // Process: logToRenderer(`[Anti-Collision] Responding to knock for c...
                            logToRenderer(`[Anti-Collision] Responding to knock for channel ${targetId}`);
                            const occMsg = await m.channel.send(`||~~TT_OCCUPIED:${targetId}~~||`);
// Process: setTimeout(() => occMsg.delete().catch(() => ), 500)
                            // Process: setTimeout(() => occMsg.delete().catch(() => ), 500)
                            setTimeout(() => occMsg.delete().catch(() => {}), 500);
                        }
// Process:
                    // Process:
                    }
                });
// Process:
            // Process:
            }
        } catch (e) {
// Process: logToRenderer("[Anti-Collision] Error setting up listener...
            // Process: logToRenderer("[Anti-Collision] Error setting up listener...
            logToRenderer("[Anti-Collision] Error setting up listener: " + e.message);
        }
// Process:
    // Process:
    }

    broadcastBotStatus();
    // updateDiscordMediaControl(); // MOVED DOWN


// Process: logToRenderer(`Logged in as $client.user.tag`)
    // Process: logToRenderer(`Logged in as $client.user.tag`)
    logToRenderer(`Logged in as ${client.user.tag}`);

    client.on('messageCreate', async message => {
// Process: if (client.commandHandler) client.commandHandler.handleMe...
        // Process: if (client.commandHandler) client.commandHandler.handleMe...
        if (client.commandHandler) client.commandHandler.handleMessage(message);
    });

// Process: const basePath = app.isPackaged
    // Process: const basePath = app.isPackaged
    const basePath = app.isPackaged
        ? path.dirname(app.getPath('exe'))
// Process: : app.getAppPath()
        // Process: : app.getAppPath()
        : app.getAppPath();

    const extendedConfig = {
// Process: ...discordConfig,
        // Process: ...discordConfig,
        ...discordConfig,
        joinVoiceCallback: async () => {
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
            // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
        }
// Process:
    // Process:
    };

    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, extendedConfig, fiveEToolsParser);
// Process: client.commandHandler = commandHandler
    // Process: client.commandHandler = commandHandler
    client.commandHandler = commandHandler;

    client.lastMediaMessage = null;
// Process: let isUpdatingMediaControl = false
    // Process: let isUpdatingMediaControl = false
    let isUpdatingMediaControl = false;
    let pendingMediaUpdate = false;
// Process: let selectedSongInDropdown = null
    // Process: let selectedSongInDropdown = null
    let selectedSongInDropdown = null;
    let currentDropdownPage = 0;
// Process: const PAGE_SIZE = 23
    // Process: const PAGE_SIZE = 23
    const PAGE_SIZE = 23;

    // Map to handle long file paths in Discord select menus (100 char limit)
    const songPathToIdMap = new Map();
// Process: const idToSongPathMap = new Map()
    // Process: const idToSongPathMap = new Map()
    const idToSongPathMap = new Map();
    let songIdCounter = 0;

/**
 * Auto-generated documentation
 */
// Process: function getSongId(filePath)
    // Process: function getSongId(filePath)
    function getSongId(filePath) {
        if (songPathToIdMap.has(filePath)) return songPathToIdMap.get(filePath);
// Process: const id = `s_$songIdCounter++`
        // Process: const id = `s_$songIdCounter++`
        const id = `s_${songIdCounter++}`;
        songPathToIdMap.set(filePath, id);
// Process: idToSongPathMap.set(id, filePath)
        // Process: idToSongPathMap.set(id, filePath)
        idToSongPathMap.set(id, filePath);
        return id;
// Process:
    // Process:
    }

    // Now call it once defined
    updateDiscordMediaControl();

    /**
     * Updates the media control message in the Discord text channel.
     * @param {boolean} [disabled=false] - Whether to show the controls as disabled.
     */
// Process: async function updateDiscordMediaControl(disabled = false)
    // Process: async function updateDiscordMediaControl(disabled = false)
    async function updateDiscordMediaControl(disabled = false) {
        if (isShuttingDown) return;

        // Delete the message if media controls are disabled in settings
// Process: if (discordConfig.showMediaControl === false)
        // Process: if (discordConfig.showMediaControl === false)
        if (discordConfig.showMediaControl === false) {
            if (client.lastMediaMessage) {
// Process: try
                // Process: try
                try {
                    await client.lastMediaMessage.delete().catch(() => {});
// Process: client.lastMediaMessage = null
                    // Process: client.lastMediaMessage = null
                    client.lastMediaMessage = null;
                } catch (e) {
// Process: console.error("Error deleting media control:", e)
                    // Process: console.error("Error deleting media control:", e)
                    console.error("Error deleting media control:", e);
                }
// Process:
            // Process:
            }
            return;
// Process:
        // Process:
        }

        // Validate text channel configuration
        if (!discordConfig.textChannel) {
// Process: logToRenderer('[Discord] No text channel configured for m...
            // Process: logToRenderer('[Discord] No text channel configured for m...
            logToRenderer('[Discord] No text channel configured for media controls.');
            return;
// Process:
        // Process:
        }

        // Handle concurrent update requests
        if (isUpdatingMediaControl) {
// Process: pendingMediaUpdate = true
            // Process: pendingMediaUpdate = true
            pendingMediaUpdate = true;
            return;
// Process:
        // Process:
        }

        // Fetch the target Discord channel
        let targetChannel = client.channels.cache.get(discordConfig.textChannel);
// Process: if (!targetChannel)
        // Process: if (!targetChannel)
        if (!targetChannel) {
            try {
// Process: targetChannel = await client.channels.fetch(discordConfig...
                // Process: targetChannel = await client.channels.fetch(discordConfig...
                targetChannel = await client.channels.fetch(discordConfig.textChannel);
            } catch (err) {
// Process: logToRenderer(`[Discord] Failed to fetch channel $discord...
                // Process: logToRenderer(`[Discord] Failed to fetch channel $discord...
                logToRenderer(`[Discord] Failed to fetch channel ${discordConfig.textChannel}: ${err.message}`);
                return;
// Process:
            // Process:
            }
        }

// Process: if (!targetChannel)
        // Process: if (!targetChannel)
        if (!targetChannel) {
            logToRenderer(`[Discord] Channel ${discordConfig.textChannel} not found.`);
// Process: return
            // Process: return
            return;
        }

// Process: isUpdatingMediaControl = true
        // Process: isUpdatingMediaControl = true
        isUpdatingMediaControl = true;

        // Compile current playback status for the embed
        const status = {
// Process: isPlaying: musicPlayer.isPlaying,
            // Process: isPlaying: musicPlayer.isPlaying,
            isPlaying: musicPlayer.isPlaying,
            loopMode: musicPlayer.loopMode,
// Process: shuffleMode: musicPlayer.shuffleMode,
            // Process: shuffleMode: musicPlayer.shuffleMode,
            shuffleMode: musicPlayer.shuffleMode,
            currentTrack: musicPlayer.stack[musicPlayer.currentIndex],
// Process: stackSize: musicPlayer.stack.length,
            // Process: stackSize: musicPlayer.stack.length,
            stackSize: musicPlayer.stack.length,
            currentIndex: musicPlayer.currentIndex,
// Process: currentTime: musicPlayer.currentTime,
            // Process: currentTime: musicPlayer.currentTime,
            currentTime: musicPlayer.currentTime,
            duration: musicPlayer.duration
// Process:
        // Process:
        };

        const loopIcons = ['➡️', '🔁', '🔂'];

        /**
         * Generates a visual progress bar string.
         */
/**
 * Auto-generated documentation
 */
// Process: function createProgressString(current, total)
        // Process: function createProgressString(current, total)
        function createProgressString(current, total) {
            const size = 10;
// Process: if (total <= 0) return '⬛'.repeat(size)
            // Process: if (total <= 0) return '⬛'.repeat(size)
            if (total <= 0) return '⬛'.repeat(size);
            const progress = Math.round((current / total) * size);
// Process: return '🟩'.repeat(Math.min(size, progress)) + '⬛'.repeat(...
            // Process: return '🟩'.repeat(Math.min(size, progress)) + '⬛'.repeat(...
            return '🟩'.repeat(Math.min(size, progress)) + '⬛'.repeat(Math.max(0, size - progress));
        }

        /**
         * Formats seconds into MM:SS.
         */
/**
 * Auto-generated documentation
 */
// Process: const formatTime = (s) =>
        // Process: const formatTime = (s) =>
        const formatTime = (s) => {
            const mins = Math.floor(s / 60);
// Process: const secs = Math.floor(s % 60)
            // Process: const secs = Math.floor(s % 60)
            const secs = Math.floor(s % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
// Process:
        // Process:
        };

        // Construct the media control embed
        const embed = new EmbedBuilder()
// Process: .setTitle('🎵 Music Player Control')
            // Process: .setTitle('🎵 Music Player Control')
            .setTitle('🎵 Music Player Control')
            .setColor(status.isPlaying ? 0x00FF00 : 0xFF0000)
// Process: .addFields(
            // Process: .addFields(
            .addFields(
                { name: 'Status', value: status.isPlaying ? '▶️ Playing' : '⏸️ Paused', inline: true },
// Process: name: 'Loop', value: loopIcons[status.loopMode], inline: ...
                // Process: name: 'Loop', value: loopIcons[status.loopMode], inline: ...
                { name: 'Loop', value: loopIcons[status.loopMode], inline: true },
                { name: 'Shuffle', value: status.shuffleMode ? '🔀 On' : '🔀 Off', inline: true },
// Process: name: 'Track', value: status.currentTrack ? path.basename...
                // Process: name: 'Track', value: status.currentTrack ? path.basename...
                { name: 'Track', value: status.currentTrack ? path.basename(status.currentTrack) : 'None' },
                { name: 'Progress', value: `${createProgressString(status.currentTime, status.duration)} \`[${formatTime(status.currentTime)} / ${formatTime(status.duration)}]\`` },
// Process: name: 'Playlist', value: `$status.stackSize tracks`
                // Process: name: 'Playlist', value: `$status.stackSize tracks`
                { name: 'Playlist', value: `${status.stackSize} tracks` }
            )
// Process: .setTimestamp()
            // Process: .setTimestamp()
            .setTimestamp();

        // --- Row 1: Song Selector Dropdown ---
        // Cache song options for performance
        if (!cachedDiscordSongOptions) {
// Process: cachedDiscordSongOptions = getFlatMusicList().map(p => (
            // Process: cachedDiscordSongOptions = getFlatMusicList().map(p => (
            cachedDiscordSongOptions = getFlatMusicList().map(p => ({
                label: path.basename(p).substring(0, 100),
// Process: value: getSongId(p)
                // Process: value: getSongId(p)
                value: getSongId(p)
            }));
// Process:
        // Process:
        }
        const songs = cachedDiscordSongOptions;

        // Calculate pagination for the song selector
// Process: const totalPages = Math.ceil(songs.length / PAGE_SIZE)
        // Process: const totalPages = Math.ceil(songs.length / PAGE_SIZE)
        const totalPages = Math.ceil(songs.length / PAGE_SIZE);
        const start = currentDropdownPage * PAGE_SIZE;
// Process: const end = start + PAGE_SIZE
        // Process: const end = start + PAGE_SIZE
        const end = start + PAGE_SIZE;
        const pageSongs = songs.slice(start, end);

        // Map song paths to selection options
/**
 * Auto-generated documentation
 */
// Process: const songOptions = pageSongs.map(s => (
        // Process: const songOptions = pageSongs.map(s => (
        const songOptions = pageSongs.map(s => ({
            label: s.label,
// Process: value: s.value,
            // Process: value: s.value,
            value: s.value,
            default: selectedSongInDropdown === idToSongPathMap.get(s.value)
// Process: ))
        // Process: ))
        }));

        // Inject pagination controls into the dropdown
        if (totalPages > 1) {
// Process: if (currentDropdownPage > 0)
            // Process: if (currentDropdownPage > 0)
            if (currentDropdownPage > 0) {
                songOptions.unshift({ label: '⬅️ Previous Page', value: 'prev_page' });
// Process:
            // Process:
            }
            if (currentDropdownPage < totalPages - 1) {
// Process: songOptions.push( label: '➡️ Next Page', value: 'next_pag...
                // Process: songOptions.push( label: '➡️ Next Page', value: 'next_pag...
                songOptions.push({ label: '➡️ Next Page', value: 'next_page' });
            }
// Process:
        // Process:
        }

        // Handle empty library state
        if (songOptions.length === 0) {
// Process: songOptions.push( label: 'No music found', value: 'none' )
            // Process: songOptions.push( label: 'No music found', value: 'none' )
            songOptions.push({ label: 'No music found', value: 'none' });
        }

        // Create the selection menu row
// Process: const songSelector = new ActionRowBuilder().addComponents(
        // Process: const songSelector = new ActionRowBuilder().addComponents(
        const songSelector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
// Process: .setCustomId('media-song-select')
                // Process: .setCustomId('media-song-select')
                .setCustomId('media-song-select')
                .setPlaceholder('Select a song...')
// Process: .addOptions(songOptions)
                // Process: .addOptions(songOptions)
                .addOptions(songOptions)
                .setDisabled(disabled || songs.length === 0)
// Process: )
        // Process: )
        );

        // --- Row 2: Selection Actions ---
        const selectionActions = new ActionRowBuilder().addComponents(
// Process: new ButtonBuilder().setCustomId('media-play-next').setLab...
            // Process: new ButtonBuilder().setCustomId('media-play-next').setLab...
            new ButtonBuilder().setCustomId('media-play-next').setLabel('Play Next').setStyle(ButtonStyle.Primary).setDisabled(disabled || !selectedSongInDropdown),
            new ButtonBuilder().setCustomId('media-play-now').setLabel('Play Now').setStyle(ButtonStyle.Success).setDisabled(disabled || !selectedSongInDropdown),
// Process: new ButtonBuilder().setCustomId('media-remove-stack').set...
            // Process: new ButtonBuilder().setCustomId('media-remove-stack').set...
            new ButtonBuilder().setCustomId('media-remove-stack').setLabel('Remove').setStyle(ButtonStyle.Danger).setDisabled(disabled || status.stackSize === 0)
        );

        // --- Row 3: Playback Controls ---
// Process: const playbackControls = new ActionRowBuilder().addCompon...
        // Process: const playbackControls = new ActionRowBuilder().addCompon...
        const playbackControls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('media-prev').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
// Process: new ButtonBuilder().setCustomId('media-play-pause').setLa...
            // Process: new ButtonBuilder().setCustomId('media-play-pause').setLa...
            new ButtonBuilder().setCustomId('media-play-pause').setLabel(status.isPlaying ? '⏸️' : '▶️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-next').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
// Process: new ButtonBuilder().setCustomId('media-loop').setLabel(lo...
            // Process: new ButtonBuilder().setCustomId('media-loop').setLabel(lo...
            new ButtonBuilder().setCustomId('media-loop').setLabel(loopIcons[status.loopMode]).setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-shuffle').setLabel('🔀').setStyle(status.shuffleMode ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(disabled)
// Process: )
        // Process: )
        );

        const components = [songSelector, selectionActions, playbackControls];

// Process: try
        // Process: try
        try {
            // Edit existing message or send a new one
            if (client.lastMediaMessage) {
// Process: await client.lastMediaMessage.edit( embeds: [embed], comp...
                // Process: await client.lastMediaMessage.edit( embeds: [embed], comp...
                await client.lastMediaMessage.edit({ embeds: [embed], components });
            } else {
// Process: client.lastMediaMessage = await targetChannel.send( embed...
                // Process: client.lastMediaMessage = await targetChannel.send( embed...
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            }
// Process: catch (e)
        // Process: catch (e)
        } catch (e) {
            try {
                // If edit fails (e.g. message deleted), resend
// Process: client.lastMediaMessage = await targetChannel.send( embed...
                // Process: client.lastMediaMessage = await targetChannel.send( embed...
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            } catch (err) {
// Process: logToRenderer(`Failed to send Discord media control: $err...
                // Process: logToRenderer(`Failed to send Discord media control: $err...
                logToRenderer(`Failed to send Discord media control: ${err.message}`);
            }
// Process: finally
        // Process: finally
        } finally {
            isUpdatingMediaControl = false;
            // Execute any pending updates that arrived during processing
// Process: if (pendingMediaUpdate)
            // Process: if (pendingMediaUpdate)
            if (pendingMediaUpdate) {
                pendingMediaUpdate = false;
// Process: updateDiscordMediaControl(disabled)
                // Process: updateDiscordMediaControl(disabled)
                updateDiscordMediaControl(disabled);
            }
// Process:
        // Process:
        }
    }

// Process: let lastDiscordMediaUpdate = 0
    // Process: let lastDiscordMediaUpdate = 0
    let lastDiscordMediaUpdate = 0;
    musicPlayer.on('status-change', (status) => {
// Process: const now = Date.now()
        // Process: const now = Date.now()
        const now = Date.now();
        // If it's just a time update, throttle to every 10 seconds
        if (status.isTimeUpdate) {
// Process: if (now - lastDiscordMediaUpdate >= 10000)
            // Process: if (now - lastDiscordMediaUpdate >= 10000)
            if (now - lastDiscordMediaUpdate >= 10000) {
                lastDiscordMediaUpdate = now;
// Process: updateDiscordMediaControl()
                // Process: updateDiscordMediaControl()
                updateDiscordMediaControl();
            }
// Process: else
        // Process: else
        } else {
            // Significant status change (play/pause/track change), update immediately
            lastDiscordMediaUpdate = now;
// Process: updateDiscordMediaControl()
            // Process: updateDiscordMediaControl()
            updateDiscordMediaControl();
        }
// Process: )
    // Process: )
    });

    client.on('interactionCreate', async interaction => {
// Process: if (interaction.isChatInputCommand())
        // Process: if (interaction.isChatInputCommand())
        if (interaction.isChatInputCommand()) {
            const { commandName, options } = interaction;

// Process: if (commandName === 'roll')
            // Process: if (commandName === 'roll')
            if (commandName === 'roll') {
                const notation = options.getString('notation');
// Process: try
                // Process: try
                try {
                    const roller = new DiceRoller();
// Process: const roll = roller.roll(notation)
                    // Process: const roll = roller.roll(notation)
                    const roll = roller.roll(notation);
                    await interaction.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
// Process: catch (e)
                // Process: catch (e)
                } catch (e) {
                    await interaction.reply({ content: 'Invalid notation.', ephemeral: true });
// Process:
                // Process:
                }
            } else if (commandName === 'play-song') {
// Process: const query = options.getString('query')
                // Process: const query = options.getString('query')
                const query = options.getString('query');
                const song = client.commandHandler.findSong(query);
// Process: if (song)
                // Process: if (song)
                if (song) {
                    await musicPlayer.addToStack(song);
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                    // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                    if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                    musicPlayer.play();
// Process: await interaction.reply(`Playing: **$path.basename(song)**`)
                    // Process: await interaction.reply(`Playing: **$path.basename(song)**`)
                    await interaction.reply(`Playing: **${path.basename(song)}**`);
                } else {
// Process: await interaction.reply( content: "Could not find that so...
                    // Process: await interaction.reply( content: "Could not find that so...
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
                }
// Process: else if (commandName === 'add-song')
            // Process: else if (commandName === 'add-song')
            } else if (commandName === 'add-song') {
                const query = options.getString('query');
// Process: const song = client.commandHandler.findSong(query)
                // Process: const song = client.commandHandler.findSong(query)
                const song = client.commandHandler.findSong(query);
                if (song) {
// Process: await musicPlayer.addToStack(song)
                    // Process: await musicPlayer.addToStack(song)
                    await musicPlayer.addToStack(song);
                    await interaction.reply(`Added to stack: **${path.basename(song)}**`);
// Process: else
                // Process: else
                } else {
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
// Process:
                // Process:
                }
            } else if (commandName === 'play-folder') {
// Process: await interaction.deferReply()
                // Process: await interaction.deferReply()
                await interaction.deferReply();
                const query = options.getString('query');
// Process: const folder = client.commandHandler.findFolder(query)
                // Process: const folder = client.commandHandler.findFolder(query)
                const folder = client.commandHandler.findFolder(query);
                if (folder) {
// Process: const songs = client.commandHandler.getFolderSongs(folder)
                    // Process: const songs = client.commandHandler.getFolderSongs(folder)
                    const songs = client.commandHandler.getFolderSongs(folder);
                    if (songs.length > 0) {
// Process: musicPlayer.clearStack()
                        // Process: musicPlayer.clearStack()
                        musicPlayer.clearStack();
                        await musicPlayer.addToStack(songs);
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                        // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                        if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                        musicPlayer.play();
// Process: await interaction.editReply( content: `Playing folder: **...
                        // Process: await interaction.editReply( content: `Playing folder: **...
                        await interaction.editReply({ content: `Playing folder: **${path.basename(folder)}** (${songs.length} songs)` });
                    } else {
// Process: await interaction.editReply( content: "Folder is empty." )
                        // Process: await interaction.editReply( content: "Folder is empty." )
                        await interaction.editReply({ content: "Folder is empty." });
                    }
// Process: else
                // Process: else
                } else {
                    await interaction.editReply({ content: "Could not find that folder." });
// Process:
                // Process:
                }
            } else if (commandName === 'add-folder') {
// Process: await interaction.deferReply()
                // Process: await interaction.deferReply()
                await interaction.deferReply();
                const query = options.getString('query');
// Process: const folder = client.commandHandler.findFolder(query)
                // Process: const folder = client.commandHandler.findFolder(query)
                const folder = client.commandHandler.findFolder(query);
                if (folder) {
// Process: const songs = client.commandHandler.getFolderSongs(folder)
                    // Process: const songs = client.commandHandler.getFolderSongs(folder)
                    const songs = client.commandHandler.getFolderSongs(folder);
                    if (songs.length > 0) {
// Process: await musicPlayer.addToStack(songs)
                        // Process: await musicPlayer.addToStack(songs)
                        await musicPlayer.addToStack(songs);
                        await interaction.editReply({ content: `Added folder to stack: **${path.basename(folder)}** (${songs.length} songs)` });
// Process: else
                    // Process: else
                    } else {
                        await interaction.editReply({ content: "Folder is empty." });
// Process:
                    // Process:
                    }
                } else {
// Process: await interaction.editReply( content: "Could not find tha...
                    // Process: await interaction.editReply( content: "Could not find tha...
                    await interaction.editReply({ content: "Could not find that folder." });
                }
// Process: else if (commandName === 'dice-help')
            // Process: else if (commandName === 'dice-help')
            } else if (commandName === 'dice-help') {
                const embed = new EmbedBuilder()
// Process: .setTitle("RPG Dice Notation Help")
                    // Process: .setTitle("RPG Dice Notation Help")
                    .setTitle("RPG Dice Notation Help")
                    .setColor(0x00FF00)
// Process: .setDescription("TavernTones uses the `@dice-roller/rpg-d...
                    // Process: .setDescription("TavernTones uses the `@dice-roller/rpg-d...
                    .setDescription("TavernTones uses the `@dice-roller/rpg-dice-roller` library.")
                    .addFields(
// Process: name: "Basic", value: "`2d20`, `1d12 + 4`, `3d6 - 2`" ,
                        // Process: name: "Basic", value: "`2d20`, `1d12 + 4`, `3d6 - 2`" ,
                        { name: "Basic", value: "`2d20`, `1d12 + 4`, `3d6 - 2`" },
                        { name: "Keep/Drop", value: "`4d6kh3` (Keep Highest 3), `2d20kl1` (Keep Lowest 1), `4d6dl1` (Drop Lowest 1)" },
// Process: name: "Exploding", value: "`4d10!` (Explode on max), `4d1...
                        // Process: name: "Exploding", value: "`4d10!` (Explode on max), `4d1...
                        { name: "Exploding", value: "`4d10!` (Explode on max), `4d10!>8` (Explode on 8 or higher)" },
                        { name: "Reroll", value: "`1d20r1` (Reroll 1s), `1d20r<3` (Reroll 3 or less)" },
// Process: name: "Success/Failure", value: "`10d6>4` (Count dice > 4)"
                        // Process: name: "Success/Failure", value: "`10d6>4` (Count dice > 4)"
                        { name: "Success/Failure", value: "`10d6>4` (Count dice > 4)" }
                    );
// Process: await interaction.reply( embeds: [embed] )
                // Process: await interaction.reply( embeds: [embed] )
                await interaction.reply({ embeds: [embed] });
            } else if (commandName === 'play') {
// Process: const f = options.getString('folder') || 'chill'
                // Process: const f = options.getString('folder') || 'chill'
                const f = options.getString('folder') || 'chill';
                const s = options.getString('song');
// Process: const songFilePath = await client.commandHandler.findMusi...
                // Process: const songFilePath = await client.commandHandler.findMusi...
                const songFilePath = await client.commandHandler.findMusic(f, s);
                if (songFilePath) {
// Process: await interaction.reply(`Playing: **$path.parse(songFileP...
                    // Process: await interaction.reply(`Playing: **$path.parse(songFileP...
                    await interaction.reply(`Playing: **${path.parse(songFilePath).name}**`);
                    musicPlayer.clearStack();
// Process: await musicPlayer.addToStack(songFilePath)
                    // Process: await musicPlayer.addToStack(songFilePath)
                    await musicPlayer.addToStack(songFilePath);
                    if (voiceStatus !== 'connected') await joinVoiceChannelAction();
// Process: musicPlayer.play()
                    // Process: musicPlayer.play()
                    musicPlayer.play();
                } else {
// Process: await interaction.reply( content: "Could not find that mu...
                    // Process: await interaction.reply( content: "Could not find that mu...
                    await interaction.reply({ content: "Could not find that music.", ephemeral: true });
                }
// Process: else if (commandName === 'pause')
            // Process: else if (commandName === 'pause')
            } else if (commandName === 'pause') {
                musicPlayer.pause();
// Process: await interaction.reply('Paused.')
                // Process: await interaction.reply('Paused.')
                await interaction.reply('Paused.');
            } else if (commandName === 'stop') {
// Process: musicPlayer.stop()
                // Process: musicPlayer.stop()
                musicPlayer.stop();
                musicPlayer.clearStack();
// Process: await interaction.reply('Stopped and cleared stack.')
                // Process: await interaction.reply('Stopped and cleared stack.')
                await interaction.reply('Stopped and cleared stack.');
            } else if (commandName === 'ping') {
// Process: await interaction.reply('Pong!')
                // Process: await interaction.reply('Pong!')
                await interaction.reply('Pong!');
            } else if (commandName === 'surge') {
                // Emulate surge command
/**
 * Auto-generated documentation
 */
// Process: const msg =  author: interaction.user, reply: (c) => inte...
                // Process: const msg =  author: interaction.user, reply: (c) => inte...
                const msg = { author: interaction.user, reply: (c) => interaction.reply(c), content: '!su', mentions: { has: () => true, roles: { has: () => false } } };
                await client.commandHandler.handleMessage(msg);
// Process: else if (commandName === 'shield')
            // Process: else if (commandName === 'shield')
            } else if (commandName === 'shield') {
/**
 * Auto-generated documentation
 */
                const msg = { author: interaction.user, reply: (c) => interaction.reply(c), content: '!sh', mentions: { has: () => true, roles: { has: () => false } } };
// Process: await client.commandHandler.handleMessage(msg)
                // Process: await client.commandHandler.handleMessage(msg)
                await client.commandHandler.handleMessage(msg);
            } else if (commandName === 'roll-table') {
// Process: const folder = interaction.options.getString('folder')
                // Process: const folder = interaction.options.getString('folder')
                const folder = interaction.options.getString('folder');
                const count = interaction.options.getInteger('count');
// Process: const args = interaction.options.getString('args')
                // Process: const args = interaction.options.getString('args')
                const args = interaction.options.getString('args');
                const msg = {
// Process: author: interaction.user,
                    // Process: author: interaction.user,
                    author: interaction.user,
                    reply: (c) => interaction.reply(c),
// Process: content: `!ro $folder $count $args`,
                    // Process: content: `!ro $folder $count $args`,
                    content: `!ro ${folder} ${count} ${args}`,
                    mentions: { has: () => true, roles: { has: () => false } },
// Process: channel: interaction.channel,
                    // Process: channel: interaction.channel,
                    channel: interaction.channel,
                    startThread: (o) => interaction.channel.threads.create(o)
// Process:
                // Process:
                };
                // Interaction needs to be deferred if it takes long
                await interaction.deferReply();
// Process: msg.reply = (c) => interaction.editReply(c)
                // Process: msg.reply = (c) => interaction.editReply(c)
                msg.reply = (c) => interaction.editReply(c);
                await client.commandHandler.handleMessage(msg);
// Process:
            // Process:
            }
        }

// Process: if (interaction.isStringSelectMenu())
        // Process: if (interaction.isStringSelectMenu())
        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

// Process: if (customId === '5e-result-select')
            // Process: if (customId === '5e-result-select')
            if (customId === '5e-result-select') {
                await interaction.deferUpdate();
// Process: const [category, source, name] = values[0].split('__')
                // Process: const [category, source, name] = values[0].split('__')
                const [category, source, name] = values[0].split('__');
                const item = await fiveEToolsParser.getExact(category, name, source);
// Process: if (item)
                // Process: if (item)
                if (item) {
                    const embed = format5eResult(item);
// Process: await interaction.editReply( embeds: [embed], components:...
                    // Process: await interaction.editReply( embeds: [embed], components:...
                    await interaction.editReply({ embeds: [embed], components: [] });
                } else {
// Process: await interaction.editReply( content: 'Sorry, I couldn\'t...
                    // Process: await interaction.editReply( content: 'Sorry, I couldn\'t...
                    await interaction.editReply({ content: 'Sorry, I couldn\'t retrieve the details.', components: [] });
                }
// Process: else if (customId === 'media-song-select')
            // Process: else if (customId === 'media-song-select')
            } else if (customId === 'media-song-select') {
                const val = values[0];
// Process: if (val === 'next_page')
                // Process: if (val === 'next_page')
                if (val === 'next_page') {
                    currentDropdownPage++;
// Process: else if (val === 'prev_page')
                // Process: else if (val === 'prev_page')
                } else if (val === 'prev_page') {
                    currentDropdownPage--;
// Process: else
                // Process: else
                } else {
                    selectedSongInDropdown = idToSongPathMap.get(val);
// Process:
                // Process:
                }
                await interaction.deferUpdate();
// Process: updateDiscordMediaControl()
                // Process: updateDiscordMediaControl()
                updateDiscordMediaControl();
            }
// Process:
        // Process:
        }

        if (interaction.isButton()) {
// Process: const  customId  = interaction
            // Process: const  customId  = interaction
            const { customId } = interaction;
            if (customId.startsWith('media-')) {
// Process: await interaction.deferUpdate()
                // Process: await interaction.deferUpdate()
                await interaction.deferUpdate();
                switch (customId) {
// Process: case 'media-prev': musicPlayer.prev() break
                    // Process: case 'media-prev': musicPlayer.prev() break
                    case 'media-prev': musicPlayer.prev(); break;
                    case 'media-next': musicPlayer.next(); break;
// Process: case 'media-play-pause':
                    // Process: case 'media-play-pause':
                    case 'media-play-pause':
                        if (musicPlayer.isPlaying) {
// Process: musicPlayer.pause()
                            // Process: musicPlayer.pause()
                            musicPlayer.pause();
                        } else {
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                            // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                            musicPlayer.play();
// Process:
                        // Process:
                        }
                        break;
// Process: case 'media-loop': musicPlayer.setLoopMode((musicPlayer.l...
                    // Process: case 'media-loop': musicPlayer.setLoopMode((musicPlayer.l...
                    case 'media-loop': musicPlayer.setLoopMode((musicPlayer.loopMode + 1) % 3); break;
                    case 'media-shuffle': musicPlayer.setShuffle(!musicPlayer.shuffleMode); break;
// Process: case 'media-play-next':
                    // Process: case 'media-play-next':
                    case 'media-play-next':
                        if (selectedSongInDropdown) {
// Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                            // Process: if (voiceStatus !== 'connected') await joinVoiceChannelAc...
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                            musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, selectedSongInDropdown);
// Process: selectedSongInDropdown = null
                            // Process: selectedSongInDropdown = null
                            selectedSongInDropdown = null;
                        }
// Process: break
                        // Process: break
                        break;
                    case 'media-play-now':
// Process: if (selectedSongInDropdown)
                        // Process: if (selectedSongInDropdown)
                        if (selectedSongInDropdown) {
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
// Process: musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0,...
                            // Process: musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0,...
                            musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, selectedSongInDropdown);
                            musicPlayer.next();
// Process: selectedSongInDropdown = null
                            // Process: selectedSongInDropdown = null
                            selectedSongInDropdown = null;
                        }
// Process: break
                        // Process: break
                        break;
                    case 'media-remove-stack':
// Process: musicPlayer.removeFromStack(musicPlayer.currentIndex)
                        // Process: musicPlayer.removeFromStack(musicPlayer.currentIndex)
                        musicPlayer.removeFromStack(musicPlayer.currentIndex);
                        break;
// Process:
                // Process:
                }
                updateDiscordMediaControl();
// Process:
            // Process:
            }
        }
// Process: )
    // Process: )
    });
});

// let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
// const startingMemUse = memoryUsage;
// setInterval(() => {
//     memoryUsage = process.memoryUsage().rss;
//     logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
// }, 60000);


/**
 * Calculates a hex color for the HP bar based on the current health percentage.
 */
/**
 * Auto-generated documentation
 */
// Process: function getHpColor(current, max)
// Process: function getHpColor(current, max)
function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Dead
// Process: if (current > max) return '#007bff' // Overhealed
    // Process: if (current > max) return '#007bff'
    if (current > max) return '#007bff'; // Overhealed

    const percentage = (current / max) * 100;
// Process: if (percentage >= 100) return '#007bff' // Blue
    // Process: if (percentage >= 100) return '#007bff'
    if (percentage >= 100) return '#007bff'; // Blue
    if (percentage >= 50) return '#28a745'; // Green
// Process: if (percentage >= 25) return '#ffc107' // Yellow
    // Process: if (percentage >= 25) return '#ffc107'
    if (percentage >= 25) return '#ffc107'; // Yellow
    return '#dc3545'; // Red (< 25%)
// Process:
// Process:
}

/**
 * Dispatches a music library scan to a background worker.
 */
/**
 * Auto-generated documentation
 */
function scanMusicLibrary() {
// Process: if (!discordConfig.defaultMusicPath || !fs.existsSync(dis...
    // Process: if (!discordConfig.defaultMusicPath || !fs.existsSync(dis...
    if (!discordConfig.defaultMusicPath || !fs.existsSync(discordConfig.defaultMusicPath)) {
        logToRenderer("[Library] No music folder configured or path invalid.");
// Process: return
        // Process: return
        return;
    }

// Process: logToRenderer("[Library] Scanning music folder...")
    // Process: logToRenderer("[Library] Scanning music folder...")
    logToRenderer("[Library] Scanning music folder...");
    // Spawn worker thread for disk scanning
    const worker = new Worker(path.join(__dirname, 'MusicScannerWorker.js'), {
// Process: workerData:
        // Process: workerData:
        workerData: {
            musicFolder: discordConfig.defaultMusicPath,
// Process: extensions: ['.mp3', '.wav', '.ogg', '.lnk']
            // Process: extensions: ['.mp3', '.wav', '.ogg', '.lnk']
            extensions: ['.mp3', '.wav', '.ogg', '.lnk']
        }
// Process: )
    // Process: )
    });

    // Handle scan results
    worker.on('message', async (result) => {
// Process: if (result.success)
        // Process: if (result.success)
        if (result.success) {
            const oldLibrary = discordConfig.musicLibrary || { children: [] };
// Process: const newLibrary = result.library
            // Process: const newLibrary = result.library
            const newLibrary = result.library;

            // --- Calculate Diffs for UI notification ---
            const oldFiles = new Set(), newFiles = new Set(), oldFolders = new Set(), newFolders = new Set();
/**
 * Auto-generated documentation
 */
// Process: const collect = (node, fileSet, folderSet) =>
            // Process: const collect = (node, fileSet, folderSet) =>
            const collect = (node, fileSet, folderSet) => {
                if (node.type === 'file') fileSet.add(node.path);
// Process: else
                // Process: else
                else {
                    folderSet.add(node.path);
// Process: if (node.children) node.children.forEach(c => collect(c, ...
                    // Process: if (node.children) node.children.forEach(c => collect(c, ...
                    if (node.children) node.children.forEach(c => collect(c, fileSet, folderSet));
                }
// Process:
            // Process:
            };
            collect(oldLibrary, oldFiles, oldFolders);
// Process: collect(newLibrary, newFiles, newFolders)
            // Process: collect(newLibrary, newFiles, newFolders)
            collect(newLibrary, newFiles, newFolders);

/**
 * Auto-generated documentation
 */
            const addedSongs = [...newFiles].filter(f => !oldFiles.has(f)).length;
/**
 * Auto-generated documentation
 */
// Process: const removedSongs = [...oldFiles].filter(f => !newFiles....
            // Process: const removedSongs = [...oldFiles].filter(f => !newFiles....
            const removedSongs = [...oldFiles].filter(f => !newFiles.has(f)).length;
/**
 * Auto-generated documentation
 */
            const addedFolders = [...newFolders].filter(f => !oldFolders.has(f)).length;
/**
 * Auto-generated documentation
 */
// Process: const removedFolders = [...oldFolders].filter(f => !newFo...
            // Process: const removedFolders = [...oldFolders].filter(f => !newFo...
            const removedFolders = [...oldFolders].filter(f => !newFolders.has(f)).length;

            // Report changes to UI
            if (addedSongs > 0 || removedSongs > 0 || addedFolders > 0 || removedFolders > 0) {
// Process: logToRenderer(`[Library] Scan complete with changes.`)
                // Process: logToRenderer(`[Library] Scan complete with changes.`)
                logToRenderer(`[Library] Scan complete with changes.`);
                if (mainWindow && !mainWindow.isDestroyed()) {
// Process: mainWindow.webContents.send('music-library-update',
                    // Process: mainWindow.webContents.send('music-library-update',
                    mainWindow.webContents.send('music-library-update', {
                        library: newLibrary,
// Process: diff:  added: addedSongs, removed: removedSongs, addedFol...
                        // Process: diff:  added: addedSongs, removed: removedSongs, addedFol...
                        diff: { added: addedSongs, removed: removedSongs, addedFolders, removedFolders }
                    });
// Process:
                // Process:
                }
            } else {
// Process: logToRenderer("[Library] Scan complete: No changes.")
                // Process: logToRenderer("[Library] Scan complete: No changes.")
                logToRenderer("[Library] Scan complete: No changes.");
                if (mainWindow && !mainWindow.isDestroyed()) {
// Process: mainWindow.webContents.send('music-library-update',  libr...
                    // Process: mainWindow.webContents.send('music-library-update',  libr...
                    mainWindow.webContents.send('music-library-update', { library: newLibrary, diff: null });
                }
// Process:
            // Process:
            }

            // Save new library state
            discordConfig.musicLibrary = newLibrary;
// Process: invalidateMusicCache()
            // Process: invalidateMusicCache()
            invalidateMusicCache();
            await setDiscordConfig(discordConfig);

// Process: else
        // Process: else
        } else {
            logToRenderer(`[Library] Scan failed: ${result.error}`);
// Process:
        // Process:
        }
    });

// Process: worker.on('error', (err) =>
    // Process: worker.on('error', (err) =>
    worker.on('error', (err) => {
        logToRenderer(`[Library] Worker error: ${err.message}`);
// Process: )
    // Process: )
    });
}
