/**
 * @file This is the main entry point for the TavernTones Electron application.
 * It handles window creation, application lifecycle events, IPC communication,
 * and the initialization of all backend services like the Discord bot and music player.
 */

// Import core Electron modules for app lifecycle, window management, and IPC
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');

// Register a custom protocol 'safe-media' to allow loading local audio files
// securely without enabling full 'file://' access in the renderer.
protocol.registerSchemesAsPrivileged([
    { scheme: 'safe-media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

// Import path for file path manipulation and url for path conversion
const path = require('path');
const { pathToFileURL } = require('url');
// Import discord.js components for bot functionality and message building
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Events, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
// Import @discordjs/voice for managing voice channel connections and audio streaming
const { joinVoiceChannel, entersState, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');

// Instantiate the Discord client with required intents for reading messages and joining voice
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, // Access to guild metadata
        GatewayIntentBits.GuildMessages, // Ability to read messages in guilds
        GatewayIntentBits.GuildVoiceStates, // Tracking voice channel occupancy
        GatewayIntentBits.DirectMessages // Ability to respond to DMs
    ],
    // Partials allow receiving events for messages or channels that aren't cached
    partials: [Partials.Channel, Partials.Message]
});
// Map to track active NPC selection menus in Discord threads
client.npcDropdownHandlers = new Map();
console.log('Discord client instantiated.');
// Axios for making HTTP requests (e.g. to GitHub or external APIs)
const axios = require('axios');
console.log('Axios loaded.');
// Import internal modules for audio playback, command handling, and 5e data parsing
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
const CommandHandler = require('../../discord/CommandHandler.js');
const FiveEToolsParser = require('./5eParser.js');
// Configuration helpers to read/write persistent settings
const { getDiscordConfig, setDiscordConfig } = require('./config.js');
// UI helpers for formatting Discord messages
const { format5eResult } = require('../../discord/5eEmbedFormatter.js');
// Pre-defined rules for handling mob combat
const { mobRules } = require('../data/mobRules.js');
const DropdownHandler = require('../../discord/DropdownHandler.js');
// Standard Node.js modules
const fs = require('fs');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const GitHubSync = require('./GitHubSync.js');
const { Worker } = require('worker_threads');

// Global variable to store the currently loaded configuration
let discordConfig;

// --- Caching for music library to improve IPC performance ---
// Stores the tree structure of the music library
let cachedMusicLibrary = null;
// Stores a flat array of all music file paths
let cachedFlatMusicList = null;
// Stores pre-formatted options for the Discord song selection menu
let cachedDiscordSongOptions = null;

/**
 * Retrieves the music library tree, applying 'Loose Files' if they exist.
 * Uses caching to avoid expensive cloning of large library objects.
 */
const getMusicLibrary = () => {
    // Return empty if no config is loaded yet
    if (!discordConfig) return { children: [] };
    // Return cached version if available
    if (cachedMusicLibrary) return cachedMusicLibrary;

    // Create a shallow copy of the library root to avoid mutating the master config object
    const library = { ...(discordConfig.musicLibrary || { children: [] }) };
    // Ensure the children array is cloned
    library.children = library.children ? [...library.children] : [];

    // Inject 'Loose Files' (manually added files) into the library tree view
    const looseFiles = discordConfig.looseFiles || [];
    if (looseFiles.length > 0) {
        // Look for an existing 'Loose Files' virtual folder
        let looseFolder = library.children.find(c => c.name === 'Loose Files');
        if (looseFolder) {
            // Clone folder if found
            looseFolder = { ...looseFolder };
            const idx = library.children.findIndex(c => c.name === 'Loose Files');
            library.children[idx] = looseFolder;
        } else {
            // Create a new virtual folder if it doesn't exist
            looseFolder = { name: 'Loose Files', type: 'directory', children: [], path: 'loose' };
            library.children.push(looseFolder);
        }
        // Map loose file paths into standard library nodes
        looseFolder.children = looseFiles.map(p => ({
            name: path.basename(p),
            path: p,
            type: 'file'
        }));
    }
    // Cache the assembled library for future calls
    cachedMusicLibrary = library;
    return library;
};

/**
 * Traverses the music library tree and returns a flat array of all file paths.
 * Useful for search and populating select menus.
 */
const getFlatMusicList = () => {
    // Return cached list if available
    if (cachedFlatMusicList) return cachedFlatMusicList;

    const list = [];
    // Recursive helper to find all 'file' nodes in the tree
    const traverse = (node) => {
        if (node.type === 'file') {
            list.push(node.path);
        } else if (node.children) {
            node.children.forEach(traverse);
        }
    };
    // Ensure we have the latest library structure before traversing
    const library = getMusicLibrary();
    traverse(library);
    // Cache the flattened list
    cachedFlatMusicList = list;
    return list;
};

/**
 * Resets all music-related caches. Called when the library is rescanned or
 * when 'Loose Files' are added.
 */
function invalidateMusicCache() {
    cachedMusicLibrary = null;
    cachedFlatMusicList = null;
    cachedDiscordSongOptions = null;
}

// --- Discord Voice Connection State ---
// Holds the active @discordjs/voice connection
let connection;
// High-level connection status for the UI
let voiceStatus = 'disconnected'; // Options: disconnected, connecting, connected
// Flag to prevent overlapping connection attempts
let isJoiningVoice = false;

// --- Singleton Service Instances ---
let musicPlayer;
// Becomes true once the initial window and all handlers are initialized
let isAppReady = false;
let initiativeTracker;
let fiveEToolsParser;

// --- Anti-collision State ---
// Set to true if another instance of TavernTones is detected in the same voice channel
let isSoftLocked = false;

// --- Single Instance Management ---
// Request a lock to ensure only one copy of the app runs at a time
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // If we didn't get the lock, another instance is already running; quit this one
    app.quit();
} else {
    // If someone tries to start a second instance, focus the already-open window instead
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            // Restore from taskbar if minimized
            if (mainWindow.isMinimized()) mainWindow.restore();
            // Bring window to front
            mainWindow.focus();
        }
    });
}

// --- Global Electron Window References ---

/** @type {BrowserWindow | null} The main application dashboard window. */
let mainWindow;
/** @type {BrowserWindow | null} The configuration/settings popup window. */
let settingsWindow;
/** @type {boolean} Becomes true once the main window's HTML has finished loading. */
let windowloaded = false;

// --- Persistent Data Paths ---
// Path for initiative tracker state
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');
// Path for music stack/playlist state
const musicAutosavePath = path.join(app.getPath('userData'), 'music-autosave.json');

/**
 * A map of D&D 5e conditions to their emoji, color, and description.
 * @type {Object.<string, {emoji: string, color: string, text: string}>}
 */
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
    "Paralyzed": { emoji: "⚡", color: "#007bff", text: "You are Incapacitated and can't move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Petrified": { emoji: "🪨", color: "#343a40", text: "You have the Incapacitated condition. Your Speed is 0 and can't increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Poisoned": { emoji: "🤢", color: "#28a745", text: "You have Disadvantage on attack rolls and ability checks." },
    "Prone": { emoji: "🛌", color: "#ffc107", text: "Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage." },
    "Restrained": { emoji: "⛓️", color: "#6c757d", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws." },
    "Stunned": { emoji: "😵‍💫", color: "#ffc107", text: "You are Incapacitated, can't move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Unconscious": { emoji: "😴", color: "#343a40", text: "You are Incapacitated, can't move or speak, and are unaware of your surroundings. You drop whatever you're holding and fall prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.) (Prone: Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.)" }
};

/**
 * Maps CSS color codes to Discord-friendly emojis for health bars.
 */
const hpBarEmojiMap = {
    '#007bff': '🟦',      // Blue (Full Health)
    '#28a745': '🟩',     // Green (Healthy)
    '#ffc107': '🟨',    // Yellow (Injured)
    '#dc3545': '🟥',       // Red (Critical)
    '#8a2be2': '🟪',    // Purple (Temporary HP)
    '#6c757d': '💀',     // Grey/Dead (0 HP)
    'empty': '⬛'       // Black (Missing Health)
};

/**
 * Sends a full initiative update to the renderer process.
 * If the app isn't ready yet, it retries after a short delay.
 */
async function sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra = null) {
    // Check if the window is alive and communication is possible
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex, extra });
    }
    // If not ready, wait and recurse
    else if (!isAppReady) {
        await sleep(100);
        sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra);
    }
}

/**
 * Sends a dice roll result string to the renderer's log panel.
 * @param {string} message - The message to display.
 */
async function logDiceRollToRenderer(message) {
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('dice-log', message);
    } else if (!isAppReady) {
        // Wait for startup to complete if necessary
        await sleep(100);
        logDiceRollToRenderer(message);
    }
}

/**
 * Simple async sleep helper.
 * @param {number} ms - Milliseconds to sleep.
 */
function sleep(ms) {
    // Ensure the value is a positive number
    const safeMs = Math.max(0, Number(ms) || 0);
    return new Promise(resolve => setTimeout(resolve, safeMs));
}

// --- Electron Window Initialization ---

/**
 * Creates and loads the main application dashboard window.
 * @param {boolean} [showWindow=true] - Whether to show the window immediately.
 */
async function createWindow(showWindow = true) {
    console.log('createWindow() called.');
    // Create the browser window with secure preferences
    mainWindow = new BrowserWindow({
        show: false, // Hidden until content is loaded to prevent visual flickering
        webPreferences: {
            // Preload script to expose safe IPC APIs to the renderer
            preload: path.join(__dirname, '../../ui/preload.js'),
            // Isolate renderer from main process Node.js environment
            contextIsolation: true,
            // Disable legacy remote module for security
            enableRemoteModule: false,
            // Required for certain legacy plugins, though contextIsolation is preferred
            nodeIntegration: true
        }
    });

    // Handle initial window visibility
    if (showWindow) {
        mainWindow.maximize();
        mainWindow.show();
        console.log('Window created and shown.');
    } else {
        console.log('Window created minimized.');
    }

    // Load the main HTML entry point
    await mainWindow.loadFile(path.join(__dirname, '../../ui/Index.html'));
    console.log('index.html loaded.');
    windowloaded = true;
}

/**
 * Creates and shows the settings configuration window.
 * Focuses the existing window if it's already open.
 */
function createSettingsWindow() {
    // Bring existing window to front if it exists
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    // Create a new settings window with fixed dimensions
    settingsWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            // Specific preload for the settings context
            preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });

    // Load the settings HTML
    settingsWindow.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));

    // Clean up reference when the window is closed
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

/**
 * Core application initialization logic.
 * Runs once Electron is fully ready. Handles:
 * 1. Configuration loading.
 * 2. Protocol registration for audio files.
 * 3. Backend service initialization (Music, 5e Parser).
 * 4. Window creation and error handling for missing paths.
 */
async function apploader() {
    // Wait for Electron to signal readiness
    await app.whenReady().then(async () => {
        // Load persistent settings from the store
        discordConfig = await getDiscordConfig();

        // Implement the custom 'safe-media' protocol for secure local file access
        protocol.handle('safe-media', async (request) => {
            try {
                // Parse the requested URL to extract the 'path' parameter
                const url = new URL(request.url);
                const absolutePath = url.searchParams.get('path');

                // Basic validation: ensure path exists
                if (!absolutePath || !fs.existsSync(absolutePath)) {
                    console.error(`[safe-media] File not found or invalid: ${absolutePath}`);
                    return new Response('File not found', { status: 404 });
                }

                // Determine appropriate MIME type based on file extension
                const ext = path.extname(absolutePath).toLowerCase();
                const mimeTypes = {
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg'
                };
                const contentType = mimeTypes[ext] || 'audio/mpeg';

                // Read the file into a buffer and return as a Response
                // Note: Reading the whole file into memory is less efficient for large files
                // but simplifies protocol implementation for simple audio playback.
                const buffer = await fs.promises.readFile(absolutePath);
                return new Response(buffer, {
                    headers: { 'Content-Type': contentType }
                });

            } catch (error) {
                // Catch and log any protocol-level errors
                console.error('[safe-media] Protocol error:', error);
                return new Response('Error: ' + error.message, { status: 500 });
            }
        });
        console.log('App is ready.');

        // Initialize the backend audio player with logging and shell access
        musicPlayer = new BackendAudioPlayer(logToRenderer, shell, discordConfig.defaultMusicPath, discordConfig.ffmpegPath);
        // Start watching data folders for external changes
        setupFilesystemWatchers(discordConfig);

        // --- Start Music Library Scan ---
        if (discordConfig.defaultMusicPath) {
            // If we have a cached library from a previous run, tell the renderer it's ready
            if (discordConfig.musicLibrary) {
                ipcMain.handleOnce('get-music-library-ready', () => true);
            }
            // Trigger an asynchronous scan of the music directory
            scanMusicLibrary();
        }

        // Register all IPC message handlers BEFORE showing any windows
        ipcloader();
        // Initialize the 5e data parser
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app, discordConfig);

        // Check if the user has configured mandatory data directories
        const { bestiaryPath, randomTablesPath } = discordConfig;
        const pathsConfigured = bestiaryPath && randomTablesPath;

        if (!pathsConfigured) {
            // If paths are missing, show a warning and redirect to settings
            logToRenderer("Essential data folders are not configured.");
            await dialog.showMessageBox(null, {
                type: 'warning',
                title: 'Configuration Required',
                message: 'One or more essential data folders have not been set up. Please configure them in the settings.',
                buttons: ['Go to Settings']
            });
            createSettingsWindow();
            return; // Abort further startup logic until configured
        }

        // Create the main window if all paths are valid
        await createWindow(true);
        // Signal that the backend is fully initialized
        isAppReady = true;

        // Handle Discord Bot connection if enabled
        if (discordConfig && discordConfig.enabled) {
            if (!discordConfig.token) {
                // Warning for enabled bot without a token
                logToRenderer("Discord token not found despite bot being enabled. Bot functionality will be disabled.");
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
            } else {
                // Attempt to log in to Discord
                initializeDiscordBot();
            }
        } else {
            // Inform renderer that bot is disabled
            logToRenderer("Discord bot is disabled in settings.");
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Disabled' });
        }

        // Support standard Electron 'activate' event (e.g. clicking the dock icon on macOS)
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                // Re-open appropriate window based on configuration state
                if (pathsConfigured) {
                    createWindow(true);
                } else {
                    createSettingsWindow();
                }
            }
        });
    });
}

// --- Miscellaneous IPC Handlers ---

// Returns the map of D&D 5e conditions to the renderer
ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
});

// Returns the pre-defined mob combat rules data
ipcMain.handle('get-mob-rules-data', async () => {
    return mobRules;
});

// Helper to load a local image and convert it to a Base64 Data URL for the UI
ipcMain.handle('get-image-as-data-url', async (event, relativePath) => {
    logToRenderer(`[IPC] Received 'get-image-as-data-url' request with relative path: ${relativePath}`);
    // Determine the base path of the app, accounting for whether it is packaged or in dev mode
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    logToRenderer(`[IPC] Determined base path: ${basePath} (isPackaged: ${app.isPackaged})`);

    // Construct the absolute path to the image
    const absoluteImagePath = app.isPackaged ? path.join(basePath, 'MobRules', 'MobRules.png') : path.join(basePath, relativePath);
    logToRenderer(`[IPC] Constructed absolute image path: ${absoluteImagePath}`);

    try {
        logToRenderer(`[IPC] Attempting to read file at: ${absoluteImagePath}`);
        // Read raw file data
        const data = await fs.promises.readFile(absoluteImagePath);
        // Extract extension to set appropriate MIME type
        const extension = path.extname(absoluteImagePath).substring(1);
        // Convert buffer to Base64 string
        const dataUrl = `data:image/${extension};base64,${data.toString('base64')}`;
        logToRenderer(`[IPC] Successfully read and encoded image.`);
        return { success: true, dataUrl: dataUrl, absolutePath: absoluteImagePath };
    } catch (error) {
        // Log and return error if file reading fails
        const errorMessage = `Failed to read image file. Error: ${error.message}`;
        logToRenderer(`[IPC] Error: ${errorMessage}`);
        return { success: false, error: errorMessage, absolutePath: absoluteImagePath };
    }
});

// --- Global Application Settings and Error Handling ---

// Disable hardware acceleration to ensure stability in headless or VM environments (e.g. CI/CD or Playwright)
// This prevents crashes related to GPU driver initialization.
app.disableHardwareAcceleration();

// Global handler for uncaught exceptions to prevent the entire app from crashing.
process.on('uncaughtException', (error) => {
    // Check for a specific, expected error code
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        // This error is a harmless side effect of killing FFmpeg processes during track skips or app shutdown.
        return;
    }
    // Log any other serious errors to the console
    console.error('Uncaught Exception in Main Process:', error);
});

// Trigger the main application loader
apploader();



/**
 * Generates an 8-character long string of emojis representing a creature's health bar for Discord.
 * @param {object} creature - The creature object with hp, maxHp, and tempHp properties.
 * @returns {string} The emoji health bar.
 */
function createEmojiHpBar(creature) {
    // Width of the bar in emojis
    const BAR_LENGTH = 8;
    // Current health, defaulting to 0
    const hp = creature.hp || 0;
    // Maximum health, defaulting to 1 to avoid division by zero
    const maxHp = creature.maxHp || 1;
    // Temporary hit points
    const tempHp = creature.tempHp || 0;

    // If the creature is dead, return a bar of skulls
    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(BAR_LENGTH);
    }

    // Calculate how many emojis represent current HP and Temp HP
    const hpBlocks = Math.round((hp / maxHp) * BAR_LENGTH);
    const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tempHp / maxHp) * BAR_LENGTH));

    // Choose the emoji color based on the health percentage
    const hpColorEmoji = hpBarEmojiMap[getHpColor(hp, maxHp)] || hpBarEmojiMap['#007bff'];
    // Purple emojis for temp HP
    const tempHpEmoji = hpBarEmojiMap['#8a2be2'];
    // Black emojis for empty health
    const emptyEmoji = hpBarEmojiMap['empty'];

    let bar = '';
    // Assemble the bar character by character
    for (let i = 0; i < BAR_LENGTH; i++) {
        // Priority: Temp HP > Current HP > Empty
        if (i < tempHpBlocks) {
            bar += tempHpEmoji;
        } else if (i < hpBlocks) {
            bar += hpColorEmoji;
        } else {
            bar += emptyEmoji;
        }
    }
    return bar;
}

/**
 * Formats a 5e monster stat block into a high-quality Discord embed.
 * Extracts AC, HP, Speed, and Ability Scores.
 * @param {object} monster - The raw monster data object.
 * @returns {object} { mainEmbed: EmbedBuilder, longFields: object[] }
 */
function formatStatBlockForDiscord(monster) {
    // Initialize the main header embed
    const mainEmbed = new EmbedBuilder()
        .setColor(0x0099FF); // Blue theme

    // Construct the header description with name, size, type, and alignment
    let description = `# ${monster.name}\n*${monster.size} ${typeof monster.type === 'object' ? monster.type.type : monster.type}, ${monster.alignment}*\n\n`;

    // Map AC data (handles complex AC sources)
    const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` (${a.from.join(', ')})` : '')).join(', ');
    description += `**Armor Class** ${ac}\n`;

    // Display HP average and formula
    description += `**Hit Points** ${monster.hp.average} (${monster.hp.formula})\n`;

    // Map all movement speeds (walk, fly, swim, etc.)
    description += `**Speed** ${Object.entries(monster.speed).map(([type, val]) => `${type} ${val.number || val} ft.`).join(', ')}\n\n`;

    // Helper to calculate and format 5e ability modifiers (e.g. 14 -> +2)
    const formatMod = (score) => {
        const mod = Math.floor(((score || 10) - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };

    // Add the 6 core ability scores with their modifiers
    description += `**STR** ${monster.str} (${formatMod(monster.str)}) | **DEX** ${monster.dex} (${formatMod(monster.dex)}) | **CON** ${monster.con} (${formatMod(monster.con)})\n`;
    description += `**INT** ${monster.int} (${formatMod(monster.int)}) | **WIS** ${monster.wis} (${formatMod(monster.wis)}) | **CHA** ${monster.cha} (${formatMod(monster.cha)})`;

    mainEmbed.setDescription(description);

    // Part 2: Extract complex text blocks (Traits, Actions, etc.)
    // These often exceed Discord's 4096 character limit and are split into separate messages/threads.
    const longFields = [];

    // Helper to recursively flatten 5e data entry blocks into clean Markdown
    const processEntries = (entries) => {
        if (!entries) return '';
        return entries.map(e => {
            if (typeof e === 'string') return e;
            if (e.name && e.entries) {
                // Clean up 5eTools special tags like {@dice 1d6}
                const entryText = e.entries.join(' ').replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)');
                return `**_${e.name}._** ${entryText}`;
            }
            return '';
        }).join('\n\n');
    };

    // Add sections only if they contain data
    if (monster.trait && monster.trait.length > 0) {
        longFields.push({ name: 'Traits', value: processEntries(monster.trait) });
    }
    if (monster.action && monster.action.length > 0) {
        longFields.push({ name: 'Actions', value: processEntries(monster.action) });
    }
    if (monster.legendary && monster.legendary.length > 0) {
        longFields.push({ name: 'Legendary Actions', value: processEntries(monster.legendary) });
    }
    if (monster.reaction && monster.reaction.length > 0) {
        longFields.push({ name: 'Reactions', value: processEntries(monster.reaction) });
    }

    return { mainEmbed, longFields };
}

/**
 * Formats the mob combat rules into a Discord embed for quick reference.
 * @param {string} creatureName - Name of the creature the rules are being shown for.
 * @returns {object} { mainEmbed: EmbedBuilder, imagePath: string }
 */
function formatMobRulesForDiscord(creatureName) {
    // Extract rules data and path to the reference image
    const { discord: discordData, imagePath } = mobRules;

    // Build the rules embed
    const mainEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Orange theme for rules
        .setTitle(`${discordData.title}: ${creatureName}`)
        .setDescription(discordData.description)
        .addFields(...discordData.fields)
        // Reference the image as an attachment (sent alongside the message)
        .setImage(`attachment://${path.basename(imagePath)}`);

    return { mainEmbed, imagePath };
}

/**
 * Splits a long string into chunks that fit within Discord's field/embed limits.
 * Tries to split at newlines to preserve readability.
 * @param {string} text - The text to split.
 * @param {number} [maxLength=1024] - Maximum length of each chunk.
 * @returns {string[]} Array of text chunks.
 */
function splitText(text, maxLength = 1024) {
    const chunks = [];
    if (!text) return chunks;

    let currentChunk = "";
    // Split by line to avoid cutting words/sentences in half
    const lines = text.split('\n');

    for (const line of lines) {
        // Handle extreme case: a single line is longer than the whole chunk limit
        if (line.length > maxLength) {
            // Push whatever we had first
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            // Force-split the long line using regex
            const lineChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            chunks.push(...lineChunks);
            continue;
        }

        // If adding this line would exceed the limit, start a new chunk
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = "";
        }

        // Append line to the current chunk with a newline separator
        currentChunk += (currentChunk ? '\n' : '') + line;
    }

    // Capture the final chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Checks if a creature has any reminders for the start or end of its turn
 * and displays them in a blocking Electron message box.
 * @param {object} creature - The creature whose turn is starting or ending.
 * @param {string} turnEvent - 'start' or 'end'.
 */
async function checkAndShowReminders(creature, turnEvent) {
    // Safety check
    if (!creature) return;

    let reminderMessages = [];
    // Extract custom text reminder if defined for this event type
    const reminderText = creature.reminders ? creature.reminders[turnEvent] : '';
    if (reminderText) {
        reminderMessages.push(reminderText);
    }

    // Automated Legendary Action reminder for friendly creatures at the end of their turn
    if (turnEvent === 'end' && creature.isFriendly) {
        reminderMessages.push(`Legendary Action Reminder: End of ${creature.name}'s turn.`);
    }

    // If any messages were gathered, show them to the user
    if (reminderMessages.length > 0) {
        const message = reminderMessages.join('\n\n');
        // This is a blocking dialog - the user must click OK to continue
        await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: `Reminder for ${creature.name}`,
            message: `${turnEvent.charAt(0).toUpperCase() + turnEvent.slice(1)} of Turn`,
            detail: message,
            buttons: ['OK']
        });
    }
}

const InitiativeTracker = require('../features/InitiativeTracker.js');

/**
 * Sets up recursive filesystem watchers for music and data folders.
 * Automatically notifies the UI when local files are changed externally.
 * @param {object} config - The application configuration object.
 */
function setupFilesystemWatchers(config) {
    // Extract paths from the configuration
    const { defaultMusicPath, randomTablesPath, bestiaryPath } = config;

    // Define the list of folders to watch and their respective change handlers
    const watchers = [
        { name: 'Music', path: defaultMusicPath, callback: () => musicPlayer && musicPlayer._emitStatusUpdate() },
        { name: 'Random Tables', path: randomTablesPath, callback: () => logToRenderer("Random tables folder changed. Refreshing...") },
        { name: 'Bestiary', path: bestiaryPath, callback: () => logToRenderer("Bestiary folder changed. Refreshing...") }
    ];

    // Map to hold debounce timers, indexed by folder and filename
    const watcherTimers = new Map();

    // Initialize a watcher for each configured path
    watchers.forEach(w => {
        // Only start watching if the path exists on disk
        if (w.path && fs.existsSync(w.path)) {
            try {
                // Use native fs.watch for recursive monitoring
                fs.watch(w.path, { recursive: true }, (eventType, filename) => {
                    // Debounce logic: wait 500ms after the last change event before triggering the callback.
                    // This prevents "event storms" during large file copies or multi-file edits.
                    const timerKey = `${w.name}:${filename}`;
                    if (watcherTimers.has(timerKey)) {
                        clearTimeout(watcherTimers.get(timerKey));
                    }

                    // Create the debounce timer
                    const timer = setTimeout(() => {
                        logToRenderer(`[Watcher] ${w.name} change detected: ${eventType} ${filename || ''}`);
                        // Execute the specific refresh logic for this watcher
                        w.callback();
                        // Clean up the timer reference
                        watcherTimers.delete(timerKey);
                    }, 500);

                    // Store the timer so it can be reset if another event arrives quickly
                    watcherTimers.set(timerKey, timer);
                });
                logToRenderer(`[Watcher] Started watching ${w.name}: ${w.path}`);
            } catch (err) {
                // Log errors (e.g. if the OS limit for watchers is reached)
                logToRenderer(`[Watcher] Failed to watch ${w.name}: ${err.message}`);
            }
        }
    });
}

/**
 * Registers all IPC (Inter-Process Communication) handlers for the application.
 * This function sets up listeners for events from the renderer process, allowing
 * the frontend to interact with the backend services like the file system,
 * music player, initiative tracker, and more.
 */
/**
 * Registers all IPC (Inter-Process Communication) listeners.
 * This is the primary bridge between the renderer's UI actions and the backend's services.
 */
async function ipcloader() {
    // Basic signal from renderer that the window is ready for data
    ipcMain.on('window-ready', () => {});

    /**
     * Shared helper to trigger an Electron directory selection dialog.
     * @param {string} title - The title of the dialog.
     */
    const selectDirectory = async (title) => {
        const { filePaths } = await dialog.showOpenDialog(settingsWindow || mainWindow, {
            title,
            properties: ['openDirectory']
        });
        // Return the first selected path, or null if cancelled
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    };

    // --- Individual Folder Selectors ---
    ipcMain.handle('select-bestiary-folder', () => selectDirectory('Select Bestiary Data Folder'));
    ipcMain.handle('select-random-tables-folder', () => selectDirectory('Select Random Tables Folder'));
    ipcMain.handle('select-music-folder', () => selectDirectory('Select Default Music Folder'));
    ipcMain.handle('select-ffmpeg-bin-folder', () => selectDirectory('Select Folder Containing FFmpeg and ffprobe'));

    /**
     * Wizard-style handler to create and populate the standard Tavern Tones data structure.
     * Handles directory creation and initial file copying.
     */
    ipcMain.handle('setup-default-folders', async () => {
        // Ask user where the root 'Tavern Tones' folder should live
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select a Parent Directory for Tavern Tones Data',
            defaultPath: app.getPath('documents'),
            properties: ['openDirectory']
        });

        // Abort if user closed the dialog
        if (!filePaths || filePaths.length === 0) {
            return null;
        }

        const parentDir = filePaths[0];
        const dataDir = path.join(parentDir, 'Tavern Tones');

        try {
            // Ensure the master data directory exists on disk
            if (!fs.existsSync(dataDir)) {
                await fs.promises.mkdir(dataDir, { recursive: true });
            }

            // Define target subdirectories for each data type
            const paths = {
                bestiaryPath: path.join(dataDir, 'bestiary'),
                randomTablesPath: path.join(dataDir, 'randomtables'),
                defaultMusicPath: path.join(dataDir, 'music')
            };

            // Create each subdirectory if it doesn't already exist
            for (const p of Object.values(paths)) {
                if (!fs.existsSync(p)) {
                    await fs.promises.mkdir(p, { recursive: true });
                }
            }

            // Copy the app's bundled random tables to the new local data folder
            const sourcePath = app.getAppPath();
            const sourceTables = path.join(sourcePath, 'randomtables');

            if (fs.existsSync(sourceTables)) {
                // Use modern Node.js recursive copy if available
                if (fs.promises.cp) {
                    await fs.promises.cp(sourceTables, paths.randomTablesPath, { recursive: true, force: true });
                } else {
                    // Fallback or error if using an extremely old Electron version
                    throw new Error("fs.promises.cp is required for folder copying.");
                }
            }

            // Inform user of success
            await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Success',
                message: `Default folders created inside:\n${dataDir}\n\nYou can now fetch bestiary data from the settings.`,
                buttons: ['OK']
            });

            // Return the new paths so the UI can update the config immediately
            return paths;
        } catch (error) {
            // Provide detailed error feedback if creation fails (usually due to permissions)
            console.error('Failed to create default folders:', error);
            await dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Folder Creation Failed',
                message: 'Tavern Tones was unable to create the data folders automatically.',
                detail: `This often happens if the location (like Program Files) has restricted permissions.\n\nError: ${error.message}\n\nSuggested Fix: Try creating the "Tavern Tones" folder manually in your Documents folder first, or choose a different location.`,
                buttons: ['OK']
            });
            return null;
        }
    });

    // Triggers the GitHub sync process to fetch monster data
    ipcMain.handle('fetch-bestiary-data', async (event, { repoUrl, localPath, githubToken }) => {
        const sync = new GitHubSync(logToRenderer, dialog, mainWindow, githubToken);
        return await sync.syncBestiary(repoUrl, localPath);
    });

    /**
     * Attempts to automatically locate the FFmpeg executable on the user's system.
     * Checks the system PATH and several common bundled locations.
     */
    ipcMain.handle('detect-ffmpeg', async () => {
        const { exec } = require('child_process');
        const isWin = process.platform === 'win32';
        // Use 'where' on Windows and 'which' on Unix to find global binaries
        const cmd = isWin ? 'where ffmpeg' : 'which ffmpeg';

        // 1. Check system PATH
        const foundPath = await new Promise(resolve => {
            exec(cmd, (error, stdout) => {
                if (!error && stdout) {
                    // Split results by newline and take the first valid one
                    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                    resolve(lines[0] || null);
                } else {
                    resolve(null);
                }
            });
        });

        // If found in PATH, return the directory containing it
        if (foundPath && fs.existsSync(foundPath)) return path.dirname(foundPath);

        // 2. Check various relative application paths
        const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg';

        // Bundled in process.resourcesPath (production build)
        const bundledPath = path.join(process.resourcesPath, 'ffmpeg', exeName);
        if (fs.existsSync(bundledPath)) return path.dirname(bundledPath);

        // In a subfolder of the executable directory
        const appDirFfmpeg = path.join(path.dirname(process.execPath), 'ffmpeg', exeName);
        if (fs.existsSync(appDirFfmpeg)) return path.dirname(appDirFfmpeg);

        // Directly in the executable directory
        const sameDirFfmpeg = path.join(path.dirname(process.execPath), exeName);
        if (fs.existsSync(sameDirFfmpeg)) return path.dirname(sameDirFfmpeg);

        // In the project root (dev mode)
        const localFfmpeg = path.join(app.getAppPath(), 'ffmpeg', exeName);
        if (fs.existsSync(localFfmpeg)) return path.dirname(localFfmpeg);

        // Return null if search fails
        return null;
    });


    // --- Configuration IPC Handlers ---

    // Fetches the current configuration and sends it back to the requester
    ipcMain.on('get-discord-config', async (event) => {
        const config = await getDiscordConfig();
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('discord-config', config);
        }
    });

    // Saves new configuration settings and updates live services
    ipcMain.on('set-discord-config', async (event, config) => {
        // Fetch existing config to perform a deep-ish merge
        const existingConfig = await getDiscordConfig();
        const mergedConfig = { ...existingConfig, ...config };

        // Persist to disk
        await setDiscordConfig(mergedConfig);

        // --- Live configuration updates ---
        const oldShowMediaControl = discordConfig ? discordConfig.showMediaControl : true;
        // Update the global in-memory config object
        discordConfig = mergedConfig;
        // Clear music caches as paths or library settings might have changed
        invalidateMusicCache();

        // Refresh the Discord media control message if visibility settings changed
        if (oldShowMediaControl !== mergedConfig.showMediaControl) {
            updateDiscordMediaControl();
        }

        // Inform the music player instance about any path changes
        if (musicPlayer) {
            musicPlayer.musicFolder = mergedConfig.defaultMusicPath;
            musicPlayer.ffmpegBinFolder = mergedConfig.ffmpegPath;
            logToRenderer(`[IPC] Updated music player's default folder to: ${musicPlayer.musicFolder}`);
        }

        // If the save was triggered from the settings window, update the main window and close the settings
        if (event.sender === (settingsWindow && settingsWindow.webContents)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('discord-config', mergedConfig);
            }
            if (settingsWindow) {
                settingsWindow.close();
            }
        }
    });

    // --- Popup Window IPC Handlers ---

    // Triggers the creation of the settings window
    ipcMain.on('open-settings-window', createSettingsWindow);

    // Creates and shows the 'Discord Setup Walkthrough' utility window
    ipcMain.on('open-walkthrough', () => {
        let walkthroughWindow = new BrowserWindow({
            width: 600,
            height: 700,
            // Keep walkthrough visible above other windows for easy reference
            alwaysOnTop: true,
            frame: true,
            webPreferences: {
                // nodeIntegration enabled here to allow simple script access in the walkthrough
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        // Load the walkthrough UI
        walkthroughWindow.loadFile(path.join(__dirname, '../../ui/walkthrough/walkthrough.html'));
    });

    /**
     * Registers application slash commands with Discord.
     * Attempts to register specifically for configured guilds to ensure immediate updates.
     */
    ipcMain.handle('register-slash-commands', async () => {
        // Abort if no token is configured
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        try {
            // Initialize the REST client with the bot token
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);
            // Define the list of slash commands and their parameters
            const commands = [
                {
                    name: 'roll',
                    description: 'Roll arbitrary dice using RPG notation',
                    options: [{
                        name: 'notation',
                        type: 3, // STRING
                        description: 'e.g. 2d20kh1 + 5',
                        required: true
                    }]
                },
                {
                    name: 'dice-help',
                    description: 'Get help with RPG dice notation'
                },
                {
                    name: 'play',
                    description: 'Play music by folder or song name',
                    options: [
                        { name: 'folder', type: 3, description: 'Folder name', required: false },
                        { name: 'song', type: 3, description: 'Song name', required: false }
                    ]
                },
                {
                    name: 'play-song',
                    description: 'Search and play a song',
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
                },
                {
                    name: 'add-song',
                    description: 'Search and add a song to stack',
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
                },
                {
                    name: 'play-folder',
                    description: 'Play all songs in a folder',
                    options: [{ name: 'query', type: 3, description: 'Folder name', required: true }]
                },
                {
                    name: 'add-folder',
                    description: 'Add all songs in a folder to stack',
                    options: [{ name: 'query', type: 3, description: 'Folder name', required: true }]
                },
                { name: 'pause', description: 'Pause current audio' },
                { name: 'stop', description: 'Stop audio and clear stack' },
                { name: 'ping', description: 'Test bot connectivity' },
                { name: 'surge', description: 'Roll on the Wild Magic Surge table' },
                { name: 'shield', description: 'Roll on the Wild Magic Shield table' },
                {
                    name: 'roll-table',
                    description: 'Roll on random tables',
                    options: [
                        { name: 'folder', type: 3, description: 'Folder name', required: true },
                        { name: 'count', type: 4, description: 'Number of rolls', required: true },
                        { name: 'args', type: 3, description: 'Weights and tables (e.g. "8 lvl1 4 lvl2")', required: true }
                    ]
                }
            ];

            // Determine which guilds the bot belongs to based on configured channels
            const guildIds = new Set();
            const channelsToTry = [discordConfig.textChannel, discordConfig.voiceChannel].filter(id => !!id);
            for (const id of channelsToTry) {
                let chan = client.channels.cache.get(id);
                if (!chan) {
                    try { chan = await client.channels.fetch(id); } catch(e) {}
                }
                if (chan && chan.guild) guildIds.add(chan.guild.id);
            }

            // Register commands globally if no specific guilds were found
            if (guildIds.size === 0) {
                await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            }
            // Otherwise, register for each guild individually (updates faster than global)
            else {
                for (const guildId of guildIds) {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                }
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    /**
     * Removes all registered slash commands for this bot.
     */
    ipcMain.handle('unregister-slash-commands', async () => {
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        try {
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);
            const guildIds = new Set();
            const channelsToTry = [discordConfig.textChannel, discordConfig.voiceChannel].filter(id => !!id);
            for (const id of channelsToTry) {
                let chan = client.channels.cache.get(id);
                if (!chan) {
                    try { chan = await client.channels.fetch(id); } catch(e) {}
                }
                if (chan && chan.guild) guildIds.add(chan.guild.id);
            }

            // Clear global commands
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            // Clear guild-specific commands
            for (const guildId of guildIds) {
                await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // --- Audio Player Event Forwarding ---

    // Forward music player status updates (playing, progress, current track) to the renderer UI
    musicPlayer.on('status-change', (status) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('music-player-status', status);
        }
    });

    // Notify the renderer when a specific soundboard slot finishes playback
    musicPlayer.on('sound-finished', (slotId) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('sound-finished', slotId);
        }
    });

    // Initialize the initiative tracker feature
    initiativeTracker = new InitiativeTracker(logToRenderer, logDiceRollToRenderer, sendInitiativeUpdate, autosavePath);

    /**
     * Initial handshake from the renderer.
     * Triggers the first push of tracker state and bot status to the UI.
     */
    ipcMain.on('request-initial-load', () => {
        // Send full initiative list and current turn info
        if (initiativeTracker) {
            initiativeTracker.sendFullState();
        }
        // Restore music stack from the last session if enabled
        autoloadMusic();

        // Push initial Discord bot connectivity status
        if (discordConfig && discordConfig.enabled) {
            if (client && client.isReady()) {
                mainWindow.webContents.send('discord-bot-status', { status: 'online', message: 'Connected' });
            } else if (!discordConfig.token) {
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
            } else {
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Connecting...' });
            }
        } else {
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Disabled' });
        }
    });

    // --- Music Player Control IPC Handlers ---

    /**
     * Reads the music stack from a JSON autosave file and restores it to the player.
     */
    const autoloadMusic = async () => {
        // Only run if the feature is enabled in settings and the save file exists
        if (discordConfig && discordConfig.musicAutosave && fs.existsSync(musicAutosavePath)) {
            try {
                const data = await fs.promises.readFile(musicAutosavePath, 'utf-8');
                const stack = JSON.parse(data);
                // Verify the data is an array of paths
                if (Array.isArray(stack)) {
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(stack);
                    logToRenderer(`[Music] Autoloaded ${stack.length} tracks.`);
                }
            } catch (e) {
                console.error("Autoload failed:", e);
            }
        }
    };

    // Adds selected audio files to the end of the current playlist stack
    ipcMain.on('load-music-file', (event, filePaths) => {
        if (filePaths) {
            musicPlayer.addToStack(filePaths);
        }
    });

    // Starts or resumes music playback, joining voice if necessary
    ipcMain.on('play-music', async () => {
        logToRenderer(`IPC 'play-music' (command) received.`);
        // Auto-join voice channel if play is pressed while disconnected
        if (voiceStatus !== 'connected') await joinVoiceChannelAction();
        musicPlayer.play();
    });

    // Pauses current playback
    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });

    // Skips to the next track in the stack
    ipcMain.on('play-next', (event) => {
        if (musicPlayer) musicPlayer.next(false, false);
    });

    // Goes back to the previous track
    ipcMain.on('play-prev', (event) => {
        if (musicPlayer) musicPlayer.prev(false);
    });

    // Updates the repeat/loop mode (None, All, or Single)
    ipcMain.on('set-loop-mode', (event, { mode }) => {
        if (musicPlayer) musicPlayer.setLoopMode(mode);
    });

    // Enables or disables random track selection
    ipcMain.on('set-shuffle', (event, { enabled }) => {
        if (musicPlayer) musicPlayer.setShuffle(enabled);
    });

    // Removes a specific track from the playlist by its index
    ipcMain.on('remove-from-stack', (event, { index }) => {
        if (musicPlayer) musicPlayer.removeFromStack(index);
    });

    // Empties the entire playlist stack and stops playback
    ipcMain.on('clear-stack', (event) => {
        if (musicPlayer) musicPlayer.clearStack();
    });

    // Skips directly to a specific track in the playlist
    ipcMain.on('jump-to-track', async (event, { index }) => {
        if (musicPlayer) {
            // Ensure voice channel is connected before jumping
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            musicPlayer.jumpTo(index, true);
        }
    });

    // Immediate playback command for a specific track in the stack
    ipcMain.on('play-now', async (event, { index }) => {
        if (musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            musicPlayer.jumpTo(index, true);
        }
    });

    // Seeks to a specific timestamp within the currently playing track
    ipcMain.on('seek-music', (event, { time }) => {
        if (musicPlayer) {
            musicPlayer.seek(time);
        }
    });

    /**
     * Saves the current music stack to a JSON file.
     * Handles both manual 'Save As' and automatic 'Autosave' background operations.
     */
    ipcMain.handle('save-music-preset', async (event, stack, isManual = true) => {
        // Handle background autosave (triggered periodically or on track change)
        if ((!event || isManual === false || isManual === 'false') && stack) {
            try {
                // Write to the fixed autosave path
                await fs.promises.writeFile(musicAutosavePath, JSON.stringify(stack, null, 2));
                return { success: true };
            } catch (e) {
                console.error("Autosave failed:", e);
                return { success: false, error: e.message };
            }
        }

        // Handle manual 'Save As' triggered by the user via a dialog
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Music Stack Preset',
            defaultPath: 'music-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (!canceled && filePath) {
            try {
                // Write the JSON data to the selected file path
                await fs.promises.writeFile(filePath, JSON.stringify(stack, null, 2));
                // If autosave is enabled, also keep the autosave file in sync
                if (discordConfig && discordConfig.musicAutosave) {
                    await fs.promises.writeFile(musicAutosavePath, JSON.stringify(stack, null, 2));
                }
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return { canceled: true };
    });

    /**
     * Loads a music stack from a JSON file selected by the user.
     */
    ipcMain.handle('load-music-preset', async () => {
        // Open the file selection dialog
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Music Stack Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (!canceled && filePaths.length > 0) {
            try {
                // Read and parse the JSON file
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                const stack = JSON.parse(data);
                // Verify the format and update the music player
                if (Array.isArray(stack)) {
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(stack);
                    return { success: true };
                }
                throw new Error("Invalid preset format.");
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return { canceled: true };
    });

    /**
     * Generates a safe-media URL for a track to allow the renderer to play it
     * using standard HTML5 Audio (for local previews/scrubbing).
     */
    ipcMain.handle('get-preview-audio-data', async (event, { index = -1 } = {}) => {
        let filePath;
        // If an index is provided, use that specific track from the stack
        if (index >= 0 && index < musicPlayer.stack.length) {
            filePath = musicPlayer.stack[index];
        }
        // Otherwise, use the player's default preview file (usually current or top)
        else {
            filePath = musicPlayer.getPreviewFilePath();
        }

        if (!filePath) {
            return { success: false, error: 'No file available for preview.' };
        }
        // Construct the custom protocol URL with the encoded file path as a search parameter
        const safeUrl = `safe-media://local/?path=${encodeURIComponent(filePath)}`;
        return { success: true, url: safeUrl };
    });

    /**
     * Shared handler for showing standardized Electron confirmation dialogs from the renderer.
     */
    ipcMain.handle('show-confirm-dialog', async (event, options) => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        // Fallback to cancel if no window is currently focused
        if (!focusedWindow) return { response: options.cancelId || 1 };
        return await dialog.showMessageBox(focusedWindow, options);
    });

    /**
     * Toggles the Discord voice connection on or off.
     */
    ipcMain.on('voice-toggle', async () => {
        if (voiceStatus === 'connected') {
            leaveVoiceChannelAction();
        } else {
            joinVoiceChannelAction();
        }
    });

    /**
     * Force-broadcasts the current Discord bot status to all open windows.
     */
    ipcMain.on('request-bot-status', () => {
        broadcastBotStatus();
    });


    /**
     * Returns the full music library tree to the renderer.
     */
    ipcMain.handle('get-music-library', async () => {
        return getMusicLibrary();
    });

    /**
     * Manually triggers a scan of the local music directory.
     */
    ipcMain.handle('rescan-music-library', async () => {
        scanMusicLibrary();
        return { success: true };
    });

    /**
     * Reads the third-party software license data from a JSON file.
     * Used for the 'About' or 'Licenses' section of the UI.
     */
    ipcMain.handle('get-licenses', async () => {
        try {
            // Path to the generated licenses file
            const licensesPath = path.join(__dirname, '../data/licenses.json');
            if (fs.existsSync(licensesPath)) {
                // Read and parse the file
                const licenses = JSON.parse(await fs.promises.readFile(licensesPath, 'utf8'));
                return { success: true, licenses };
            }

            // Return an error if the file was not found (usually means build step was skipped)
            return { success: false, error: "License data not generated. Please run build." };
        } catch (e) {
            console.error("Error getting licenses:", e);
            return { success: false, error: e.message };
        }
    });

    /**
     * Helper to resolve an array of file paths, converting any Windows .lnk files
     * to their actual target absolute paths.
     * @param {string[]} paths - List of paths to resolve.
     */
    const resolveLibraryPaths = (paths) => {
        return paths.map(p => {
            // Only process .lnk files
            if (path.extname(p).toLowerCase() === '.lnk') {
                try {
                    // Use Electron shell to read the shortcut metadata
                    const shortcut = shell.readShortcutLink(p);
                    if (shortcut.target && fs.existsSync(shortcut.target)) {
                        return shortcut.target;
                    }
                } catch (e) {
                    console.error(`Failed to resolve shortcut: ${p}`, e);
                }
            }
            return p;
        });
    };

    /**
     * Handles contextual actions performed on files/folders in the music library UI.
     */
    ipcMain.on('library-action', async (event, { action, paths }) => {
        if (!musicPlayer) return;
        // Resolve shortcuts before performing actions
        const resolvedPaths = resolveLibraryPaths(paths);

        switch (action) {
            case 'play-now':
                // Inserts selected tracks at the very start of the stack and starts playback
                const currentStack = [...musicPlayer.stack];
                musicPlayer.stack = [...resolvedPaths, ...currentStack];
                if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                musicPlayer.jumpTo(0, true);
                break;
            case 'add-top':
                // Adds selected tracks immediately after the current playing song
                if (musicPlayer.currentIndex === -1) {
                    // If nothing is playing, just put them at the top
                    musicPlayer.stack = [...resolvedPaths, ...musicPlayer.stack];
                } else {
                    // Splice into the array after the current index
                    musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, ...resolvedPaths);
                }
                musicPlayer._emitStatusUpdate();
                break;
            case 'add-bottom':
                // Adds tracks to the end of the playlist
                musicPlayer.addToStack(resolvedPaths);
                break;
            case 'add-loose':
                // Adds files to the 'Loose Files' collection, which persists across library rescans
                if (!discordConfig.looseFiles) discordConfig.looseFiles = [];
                for (const p of paths) {
                    // Prevent duplicates in the loose files list
                    if (!discordConfig.looseFiles.includes(p)) {
                        discordConfig.looseFiles.push(p);
                    }
                }
                // Save updated config and notify the renderer to refresh the library tree
                await setDiscordConfig(discordConfig);
                const updatedLibrary = getMusicLibrary();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('music-library-update', { library: updatedLibrary, diff: null });
                }
                break;
        }
    });

    /**
     * Reads a combat encounter or monster definition from a JSON file.
     * Supports standard TavernTones JSON and the Falindrith Monster Maker format.
     */
    ipcMain.handle('read-combat-file', async () => {
        // Prompt the user to select a JSON file
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        // Abort if no file was selected
        if (canceled || filePaths.length === 0) {
            return null;
        }

        try {
            // Read and parse the file contents
            const content = fs.readFileSync(filePaths[0], 'utf8');
            const data = JSON.parse(content);

            // --- Format Detection: Falindrith D&D Monster Maker ---
            if (data.saveVersion && data.stats && data.HP) {
                const monster = data;
                // Helper to calculate ability modifiers (e.g. 14 -> +2)
                const calculateModifier = (score) => Math.floor(((score || 10) - 10) / 2);
                // Helper to format modifiers for display (e.g. 2 -> +2, -1 -> -1)
                const formatModifier = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);

                // Initiative defaults to the DEX modifier
                const dexMod = calculateModifier(monster.stats.DEX);
                // Construct the D&D HP formula (e.g. 2d8 + 4)
                const hpFormula = `${monster.HP.HD}d${monster.HP.type}${monster.HP.modifier >= 0 ? '+' : ''}${monster.HP.modifier}`;

                // Map Falindrith saving throw data to TavernTones format
                const ttSaves = {};
                const stats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
                stats.forEach(s => {
                    const save = monster.saves[s];
                    let mod;
                    // Use override value if provided
                    if (save.override) {
                        mod = save.overrideValue;
                    }
                    // Otherwise calculate based on score and optional proficiency bonus
                    else {
                        mod = calculateModifier(monster.stats[s]);
                        if (save.proficient) {
                            mod += (monster.proficiency || 0);
                        }
                    }
                    ttSaves[s.toLowerCase()] = formatModifier(mod);
                });

                // Extract core ability scores
                const ttScores = {};
                stats.forEach(s => {
                    ttScores[s.toLowerCase()] = monster.stats[s];
                });

                // Robust speed parser to extract numeric feet from various string/object formats
                const parseSpeed = (speedObj) => {
                    if (!speedObj) return '30ft';
                    if (typeof speedObj === 'string') {
                        const matches = speedObj.match(/(\d+)\s*ft/g);
                        if (matches) {
                            const speeds = matches.map(m => parseInt(m, 10));
                            return Math.max(...speeds) + 'ft'; // Use the highest speed found (e.g. fly vs walk)
                        }
                        return speedObj;
                    }
                    if (typeof speedObj === 'object') {
                        const speeds = Object.values(speedObj).filter(s => typeof s === 'number');
                        if (speeds.length > 0) return Math.max(...speeds) + 'ft';
                    }
                    return '30ft';
                };

                // Build a TavernTones-compatible combatant object
                const ttCombatant = {
                    name: monster.name,
                    hp: hpFormula,
                    maxHp: null, // Will be calculated by the initiative tracker on add
                    ac: monster.AC,
                    speed: parseSpeed(monster.speed),
                    initiative: formatModifier(dexMod),
                    scores: ttScores,
                    saves: ttSaves,
                    rawData: JSON.stringify(monster), // Store original data for the Discord stat block view
                    conditions: [],
                    deathSaves: { successes: 0, failures: 0 },
                    noDeathSaves: false
                };

                // Return as an array containing the single imported creature
                return [ttCombatant];
            }

            // --- Standard Format: TavernTones Encounter Save ---
            // Data can be a simple array of combatants or a full save object containing 'initiativeOrder'
            const combatants = Array.isArray(data) ? data : (data.initiativeOrder || []);
            return combatants;

        } catch (e) {
            // Log parsing or read errors
            logToRenderer(`Error reading combat file: ${e.message}`);
            return null;
        }
    });

    /**
     * Recursively scans a list of paths and returns all discovered audio files.
     * @param {string[]} paths - Array of file or directory paths.
     */
    const getAudioFilesRecursive = async (paths) => {
        let results = [];
        // List of supported file extensions
        const extensions = ['.mp3', '.wav', '.ogg', '.lnk'];
        for (const p of paths) {
            try {
                const stats = await fs.promises.stat(p);
                // If path is a directory, recurse into its contents
                if (stats.isDirectory()) {
                    const files = await fs.promises.readdir(p);
                    const subResults = await getAudioFilesRecursive(files.map(f => path.join(p, f)));
                    results = results.concat(subResults);
                }
                // If path is a file, verify it has a supported extension
                else {
                    if (extensions.includes(path.extname(p).toLowerCase())) {
                        results.push(p);
                    }
                }
            } catch (e) {
                // Ignore individual file access errors
                console.error(`Error processing path ${p}:`, e);
            }
        }
        return results;
    };

    /**
     * Standardized file/folder selection dialog for adding music.
     * Supports multi-select and recursive directory expansion.
     */
    ipcMain.handle('open-file-dialog', async (event, options = {}) => {
        // Configure dialog properties based on request options
        const properties = options.folders ? ['openDirectory'] : ['openFile'];
        if (options.multi) properties.push('multiSelections');

        // Show the native Electron open dialog
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: options.folders ? 'Select Music Folder(s)' : 'Select Music File(s)',
            defaultPath: discordConfig.defaultMusicPath,
            properties,
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });

        // If files were selected, expand any directories and return the full list of paths
        if (filePaths && filePaths.length > 0) {
            return await getAudioFilesRecursive(filePaths);
        }
        return [];
    });

    // --- Soundboard IPC Handlers ---

    /**
     * Triggers a file dialog to load one or more sound effects into a soundboard slot.
     */
    ipcMain.handle('load-sound', async (event, { slotId, multi = false, folders = false } = {}) => {
        // Toggle between file and directory selection
        const properties = folders ? ['openDirectory'] : ['openFile'];
        // Enable multiple selection if requested
        if (multi) properties.push('multiSelections');

        // Show selection dialog
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: folders ? `Select Folder(s) for Slot ${slotId + 1}` : `Select Sound(s) for Slot ${slotId + 1}`,
            defaultPath: discordConfig.defaultMusicPath,
            properties,
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });

        // If files were chosen, resolve shortcuts and subdirectories
        if (filePaths && filePaths.length > 0) {
            const allFiles = await getAudioFilesRecursive(filePaths);
            // Return an array of objects containing the path and display name for the UI
            return allFiles.map(p => ({ path: p, name: path.basename(p) }));
        }
        return [];
    });

    /**
     * Plays a specific sound effect file for a given soundboard slot.
     */
    ipcMain.on('play-sound', async (event, { slotId, filePath }) => {
        logToRenderer(`IPC 'play-sound' slot ${slotId}, file: ${filePath}`);
        if (filePath && musicPlayer) {
            // Auto-join voice channel if play is triggered while disconnected
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            // Command the backend player to start the SFX stream
            musicPlayer.playSound(filePath, slotId);
            // Notify the renderer that this slot is now active
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: true });
        }
    });

    /**
     * Forcefully stops the sound effect playing in a specific slot.
     */
    ipcMain.on('stop-sound', (event, { slotId }) => {
        logToRenderer(`IPC 'stop-sound' slot ${slotId}`);
        if (musicPlayer) {
            // Command the backend to kill the FFmpeg process for this slot
            musicPlayer.stopSound(slotId);
            // Notify the renderer that the slot is now idle
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
        }
    });

    /**
     * Updates the global soundboard volume multiplier.
     */
    ipcMain.on('set-soundboard-volume', (event, { volume }) => {
        if (musicPlayer) {
            musicPlayer.setSoundboardVolume(volume);
        }
    });

    // --- Soundboard Persistence & Presets ---

    // Path where the primary soundboard configuration is stored
    const soundboardConfigPath = path.join(app.getPath('userData'), 'soundboard.json');

    /**
     * Reads the current soundboard configuration (button assignments, etc.) from disk.
     */
    ipcMain.handle('get-soundboard-state', async () => {
        try {
            // Check if the configuration file exists
            if (fs.existsSync(soundboardConfigPath)) {
                // Read and parse the JSON file
                const data = await fs.promises.readFile(soundboardConfigPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading soundboard config:', error);
        }
        // Return null if file doesn't exist or is corrupt
        return null;
    });

    /**
     * Automatically saves the current soundboard UI state to the primary config file.
     */
    ipcMain.on('save-soundboard-state', (event, state) => {
        try {
            // Perform an asynchronous write without blocking the event loop
            fs.promises.writeFile(soundboardConfigPath, JSON.stringify(state, null, 2))
                .catch(err => console.error("Error saving soundboard:", err));
        } catch (error) {
            console.error('Error initiating save soundboard:', error);
        }
    });

    /**
     * Allows the user to manually export their current soundboard setup to a chosen file.
     */
    ipcMain.handle('save-soundboard-preset', async (event, state) => {
        // Open the native save file dialog
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Soundboard Preset',
            defaultPath: 'soundboard-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        // If the user selected a path, write the current state to that file
        if (!canceled && filePath) {
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2));
                return { success: true, filePath };
            } catch (error) {
                console.error('Error saving preset:', error);
                return { success: false, error: error.message };
            }
        }
        // Indicate cancellation
        return { canceled: true };
    });

    /**
     * Reads the application documentation (Markdown format) from one of several possible locations.
     * Searches relative to the source code, app root, and resources folder.
     */
    ipcMain.handle('get-help-content', async () => {
        const paths = [
            path.join(__dirname, '../../../docs/HELP.md'), // Dev path
            path.join(app.getAppPath(), 'docs/HELP.md'),   // Portable path
            path.join(process.resourcesPath, 'docs/HELP.md') // Packaged path
        ];

        // Check each potential path sequentially
        for (const helpPath of paths) {
            try {
                if (fs.existsSync(helpPath)) {
                    // Read and return the first valid file found
                    return await fs.promises.readFile(helpPath, 'utf-8');
                }
            } catch (e) {
                // Silently ignore errors for specific missing paths
            }
        }
        // Return a detailed error if no help file was found
        return "Help file not found. Checked: " + paths.join(', ');
    });

    /**
     * Loads a soundboard preset from a user-selected JSON file.
     */
    ipcMain.handle('load-soundboard-preset', async () => {
        // Open the selection dialog
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Soundboard Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        // If a file was picked, read and return its parsed contents
        if (!canceled && filePaths.length > 0) {
            try {
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                return { success: true, state: JSON.parse(data) };
            } catch (error) {
                console.error('Error loading preset:', error);
                return { success: false, error: error.message };
            }
        }
        return { canceled: true };
    });



    // --- Initiative Tracker IPC Handlers ---

    /**
     * Updates the initiative score for a specific creature.
     */
    ipcMain.on('update-initiative', (event, { creatureId, initiative }) => {
        initiativeTracker.updateInitiative(creatureId, initiative);
    });

    /**
     * Constructs a summary of the current initiative order and posts it to the Discord text channel.
     * Includes health bars and active conditions for all combatants.
     */
    ipcMain.on('push-initiative', async () => {
        logToRenderer(`'push-initiative-to-chat' invoked.`);
        // Get the sorted initiative list and current turn from the tracker
        const initiativeOrder = initiativeTracker.getInitiativeOrder();
        const currentTurnIndex = initiativeTracker.currentTurnIndex;
        // Abort if no combatants are in the list
        if (initiativeOrder.length === 0) {
            logToRenderer('[push-initiative] Cannot push, initiative is empty.');
            return;
        }

        // Verify that a text channel has been configured for the bot
        if (!discordConfig.textChannel) {
            logToRenderer('[push-initiative] No text channel configured.');
            return;
        }

        // Attempt to find the Discord channel by ID
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-initiative] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }
        logToRenderer(`[push-initiative] Found channel: ${channel.name}`);

        try {
            // Build the initiative summary embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF) // Blue theme
                .setTitle('Initiative Order')
                .setTimestamp();

            let description = '';
            // Process each creature in the initiative order
            initiativeOrder.forEach((creature, index) => {
                // Generate the emoji-based health bar
                const hpBar = createEmojiHpBar(creature);

                // Gather emojis for active conditions
                let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
                let conditionStr;
                // Cap displayed conditions at 3 to keep the list clean
                if (conditionEmojis.length > 3) {
                    conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
                } else {
                    conditionStr = conditionEmojis.join('');
                }

                // Marker to indicate whose turn it is
                const activeMarker = index === currentTurnIndex ? '`➤`' : '` `';
                let nameStr = creature.name || '';
                // Handle naming for Mob-type creatures (e.g. "Mob of 5 Goblins")
                if (creature.isMob) {
                    const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                    nameStr = `Mob of ${currentCount} ${creature.name}`;
                }

                // Format the line for this combatant: [Turn Marker] [HP Bar] [Conditions] [Name]
                const line = `${activeMarker}${hpBar}${conditionStr} ${nameStr}`;
                description += line + '\n';
            });

            // Set the assembled text as the embed description
            embed.setDescription(description);

            logToRenderer(`[push-initiative] Attempting to send embed...`);
            // Send the embed to the Discord channel
            await channel.send({ embeds: [embed] });
            logToRenderer('[push-initiative] Successfully pushed initiative to chat.');
        } catch (error) {
            // Catch and log any Discord API errors
            logToRenderer(`[push-initiative] FAILED to send embed: ${error}`);
        }
    });

    /**
     * Advances the combat tracker to the next turn.
     * Triggers turn-end and turn-start reminders for the respective creatures.
     */
    ipcMain.on('next-turn', async () => {
        // Increment the turn index in the tracker
        const turnInfo = initiativeTracker.nextTurn();
        if (turnInfo) {
            // Display turn end reminders for the creature who just finished
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            // Display turn start reminders for the creature who is up next
            await checkAndShowReminders(turnInfo.newCreature, 'start');
        }
    });

    /**
     * Exports the entire current initiative list and combat state to a user-selected JSON file.
     */
    ipcMain.on('save-encounter', async () => {
        try {
            // Open the save file dialog
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Encounter',
                defaultPath: app.getPath('userData'),
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });

            // If a path was chosen, command the tracker to write its state to that file
            if (!canceled && filePath) {
                initiativeTracker.saveEncounterToFile(filePath);
            }
        } catch (error) {
            logToRenderer(`Error saving encounter: ${error.message}`);
        }
    });

    /**
     * Prompts the user to select an encounter JSON file and loads it into the initiative tracker.
     * Includes a confirmation check as this action overwrites current data.
     */
    ipcMain.handle('load-encounter-dialog', async () => {
        // Show overwrite confirmation warning
        const confirmResult = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Confirm Load',
            message: 'Are you sure you want to load a new encounter?',
            detail: 'This will overwrite the current encounter. You may want to save your current progress first.',
            buttons: ['Load Encounter', 'Cancel'],
            defaultId: 0,
            cancelId: 1
        });

        // Abort if the user clicked 'Cancel'
        if (confirmResult.response === 1) {
            return;
        }

        // Open the file selection dialog
        const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Encounter',
            defaultPath: app.getPath('userData'),
            properties: ['openFile'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });

        // If a file was selected, tell the tracker to load it
        if (!canceled && filePaths && filePaths.length > 0) {
            const filePath = filePaths[0];
            initiativeTracker.loadEncounterFromFile(filePath);
        }
    });

    /**
     * Adds a new creature (or mob) to the initiative tracker.
     */
    ipcMain.on('add-creature', (event, creature) => {
        initiativeTracker.addCreature(creature);
    });

    /**
     * Updates the properties of an existing creature in the tracker.
     */
    ipcMain.on('update-creature', (event, creature) => {
        initiativeTracker.updateCreature(creature);
    });

    /**
     * Specifically updates the turn start/end reminder text for a creature.
     */
    ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
        initiativeTracker.updateReminders(creatureId, reminders);
    });

    /**
     * Executes a D&D stat check or saving throw for a creature.
     * Posts the result to both the UI log and the Discord channel.
     */
    ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
        // Trigger the dice roll logic in the tracker
        const result = initiativeTracker.rollStat(creatureId, rollType, stat, type);
        if (result) {
            const { message, embed } = result;
            // Update the local dashboard log
            mainWindow.webContents.send('dice-log', message);
            // Push the result to Discord if a channel is configured
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
                }
            }
        }
    });

    /**
     * Executes an attack roll for a creature and posts the result to Discord.
     */
    ipcMain.on('roll-attack', (event, { creatureId, rollType, modIndex }) => {
        // modIndex allows selecting between primary and secondary attack bonuses
        const result = initiativeTracker.rollAttack(creatureId, rollType, modIndex);
        if (result) {
            const { message, embed } = result;
            // Update local log
            mainWindow.webContents.send('dice-log', message);
            // Push to Discord
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
                }
            }
        }
    });

    /**
     * Resets all creature health and conditions to their starting state for the encounter.
     */
    ipcMain.on('reset-encounter', () => {
        initiativeTracker.resetEncounter();
    });

    /**
     * Completely wipes the initiative list after user confirmation.
     */
    ipcMain.on('clear-encounter', async () => {
        // Confirm before destructive action
        const result = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Confirm Clear',
            message: 'Are you sure you want to clear the entire encounter? This cannot be undone.',
            detail: 'You may want to save the encounter first.',
            buttons: ['Clear Encounter', 'Cancel'],
            defaultId: 1,
            cancelId: 1
        });
        // Execute clear if user clicked the primary button
        if (result.response === 0) {
            initiativeTracker.clearEncounter();
        }
    });

    /**
     * Retrieves creature data and sends it to the renderer to populate the edit modal.
     */
    ipcMain.on('edit-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.editCreature(creatureId);
        if (creature) {
            // Signal the UI to open the edit form with this data
            mainWindow.webContents.send('populate-edit-form', creature);
        }
    });

    /**
     * Removes a specific creature from the encounter.
     */
    ipcMain.on('remove-creature', (event, { creatureId }) => {
        initiativeTracker.removeCreature(creatureId);
    });

    /**
     * Retrieves creature data to populate the 'Add Creature' form for duplication.
     */
    ipcMain.on('copy-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
            // Pre-fill the add form with the existing creature's stats
            mainWindow.webContents.send('populate-add-form', creature);
        }
    });


    /**
     * Moves the combat tracker back to the previous turn.
     * Triggers turn reminders accordingly.
     */
    ipcMain.on('previous-turn', async () => {
        const turnInfo = initiativeTracker.previousTurn();
        if (turnInfo) {
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            await checkAndShowReminders(turnInfo.newCreature, 'start');
        }
    });

    /**
     * Adds temporary hit points to a creature.
     */
    ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
        initiativeTracker.addTempHp(creatureId, amount);
    });

    /**
     * Updates hit points and handles concentration check prompts if damage was taken.
     */
    ipcMain.on('update-hp', (event, { creatureId, amount }) => {
        // Apply the HP change
        const result = initiativeTracker.updateHp(creatureId, amount);
        // If the tracker determines a concentration check is needed (damage while concentrating)
        if (result && result.concentrationCheckDC) {
            // Show a blocking warning to the user
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Concentration Check',
                message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`,
                buttons: ['OK']
            });
        }
    });

    /**
     * Applies a condition (e.g. Blinded, Stunned) to a creature.
     */
    ipcMain.on('add-condition', (event, { creatureId, condition }) => {
        logToRenderer(`Adding condition ${condition} to creature ${creatureId}`);
        initiativeTracker.addCondition(creatureId, condition);
    });

    /**
     * Removes a condition from a creature.
     */
    ipcMain.on('remove-condition', (event, { creatureId, condition }) => {
        initiativeTracker.removeCondition(creatureId, condition);
    });

    /**
     * Updates boolean flags for a creature (e.g. isconcentrating, isFriendly).
     */
    ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
        initiativeTracker.updateCreatureFlag(creatureId, flag, value);
    });

    /**
     * Manually updates the death saving throw counters for a creature.
     * Triggers stabilization/death popups if the 3-threshold is crossed.
     */
    ipcMain.on('update-death-saves', (event, { creatureId, deathSaves }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
            // Track previous save state to detect changes
            const oldSaves = creature.deathSaves || { successes: 0, failures: 0 };
            creature.deathSaves = deathSaves;

            // Trigger stabilization popup if successes reached 3 for the first time
            if (deathSaves.successes >= 3 && oldSaves.successes < 3) {
                dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized!`, buttons: ['OK'] });
            }
            // Trigger death popup if failures reached 3 for the first time
            else if (deathSaves.failures >= 3 && oldSaves.failures < 3) {
                dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died.`, buttons: ['OK'] });
            }

            // Push updated state to renderer and disk
            initiativeTracker._updateFrontend();
            initiativeTracker._saveState();
        }
    });

    /**
     * Executes an automated death saving throw for a creature at 0 HP.
     * Handles logic for criticals, successes, and failures.
     */
    ipcMain.on('roll-death-save', (event, { creatureId, rollType }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (!creature) return;
        // Ensure death save object exists
        if (!creature.deathSaves) creature.deathSaves = { successes: 0, failures: 0 };

        // Determine dice notation based on advantage/disadvantage
        let notation = '1d20';
        if (rollType === 'adv') notation = '2d20kh1'; // Keep highest
        if (rollType === 'dis') notation = '2d20kl1'; // Keep lowest

        // Execute the roll using the RPG dice roller
        const roll = new DiceRoller().roll(notation);
        const result = roll.total;

        let outcome = null;
        let message = `${creature.name} rolled a Death Saving Throw (${rollType}): **${result}**`;

        // --- 5e Death Save Rules Logic ---
        // Natural 20: Immediately regain 1 HP
        if (result === 20) {
            message += " - **Critical Success!** (Regains 1 HP)";
            outcome = 'crit-success';
            initiativeTracker.updateHp(creatureId, 1);
        }
        // 10-19: Standard success
        else if (result >= 10) {
            message += " - Success";
            creature.deathSaves.successes = Math.min(3, (creature.deathSaves.successes || 0) + 1);
            if (creature.deathSaves.successes >= 3) outcome = 'stabilized';
        }
        // Natural 1: Two failures
        else if (result === 1) {
            message += " - **Critical Failure!** (2 failures)";
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 2);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
        }
        // 2-9: Standard failure
        else {
            message += " - Failure";
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 1);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
        }

        // Log the result to the dashboard
        logDiceRollToRenderer(message);

        // Show prominent notifications for significant outcomes
        if (outcome === 'crit-success') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Critical Success!', message: `${creature.name} rolled a natural 20 and regained 1 HP!`, buttons: ['OK'] });
        } else if (outcome === 'stabilized') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized with 3 successes.`, buttons: ['OK'] });
        } else if (outcome === 'dead') {
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died with 3 failures.`, buttons: ['OK'] });
        }

        // Push state updates
        initiativeTracker._updateFrontend();
        initiativeTracker._saveState();
    });

    /**
     * Triggers the native OS emoji picker (Windows/macOS).
     */
    ipcMain.on('show-emoji-panel', () => {
        app.showEmojiPanel();
    });

    /**
     * Searches the local 5e bestiary files for monsters matching a query.
     */
    ipcMain.handle('search-monsters', async (event, query) => {
        logToRenderer(`[IPC] Received "search-monsters" with query: "${query}"`);
        // Verify that the data parser is initialized
        if (!fiveEToolsParser) {
            logToRenderer('[IPC] Parser not available.');
            return [];
        }
        // Execute search specifically in the 'bestiary' category
        const results = await fiveEToolsParser.searchByName('bestiary', query);
        logToRenderer(`[IPC] Found ${results.length} monsters, returning to renderer.`);
        return results;
    });

    /**
     * Retrieves the full JSON data for a specific monster.
     */
    ipcMain.handle('get-monster-details', async (event, { name, source }) => {
        logToRenderer(`[IPC] Received "get-monster-details" for: ${name} (${source})`);
        if (!fiveEToolsParser) {
            logToRenderer('[IPC] Parser not available.');
            return null;
        }
        // Exact match search by name and source book
        const monster = await fiveEToolsParser.getExact('bestiary', name, source);
        logToRenderer(`[IPC] Found monster details, returning to renderer.`);
        return monster;
    });

    /**
     * Pushes the entire local dice log content to the Discord text channel.
     */
    ipcMain.on('push-dicelog-to-discord', async (event, logContent) => {
        // Ensure a target channel is configured
        if (!discordConfig.textChannel) {
            logToRenderer('[push-dicelog] No text channel configured.');
            return;
        }
        // Find the channel in the Discord cache
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-dicelog] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }
        try {
            // Build the log summary embed
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Dice Rolls')
                .setDescription(logContent)
                .setTimestamp();
            // Post to Discord
            await channel.send({ embeds: [embed] });
            logToRenderer('[push-dicelog] Successfully pushed dice log to chat.');
        } catch (error) {
            logToRenderer(`[push-dicelog] FAILED to send embed: ${error}`);
        }
    });

    /**
     * Posts a monster's full stat block to Discord.
     * Uses a thread for detailed traits/actions to avoid cluttering the main channel.
     */
    ipcMain.on('push-statblock-to-discord', async (event, rawDataString) => {
        if (!discordConfig.textChannel) {
            logToRenderer('[push-statblock] No text channel configured.');
            return;
        }
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-statblock] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }
        try {
            // Parse the monster JSON
            const monster = JSON.parse(rawDataString);
            // Format into a primary embed and a list of detail sections
            const { mainEmbed, longFields } = formatStatBlockForDiscord(monster);

            // Send the primary stats embed
            const mainMessage = await channel.send({ embeds: [mainEmbed] });
            logToRenderer('[push-statblock] Successfully pushed main stat block embed.');

            // If the monster has complex traits/actions, create a sub-thread for them
            if (longFields.length > 0) {
                const thread = await mainMessage.startThread({
                    name: `${monster.name} - Details`,
                    autoArchiveDuration: 60, // Archive after 1 hour of inactivity
                });

                // Post each detail section into the thread
                for (const field of longFields) {
                    // Split sections that exceed 1024 characters
                    const chunks = splitText(field.value, 1024);
                    for (let i = 0; i < chunks.length; i++) {
                        const chunkEmbed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle(chunks.length > 1 ? `${field.name} (${i + 1}/${chunks.length})` : field.name)
                            .setDescription(chunks[i]);
                        await thread.send({ embeds: [chunkEmbed] });
                    }
                }
                logToRenderer(`[push-statblock] Sent ${longFields.length} detail section(s) to thread.`);
            }
        } catch (error) {
            logToRenderer(`[push-statblock] FAILED to send embed: ${error}`);
        }
    });

    /**
     * Posts the mob combat rules along with a reference image to Discord.
     */
    ipcMain.on('push-mob-rules-to-discord', async (event, { creatureName, absoluteImagePath }) => {
        // Validate input data
        if (!creatureName || !absoluteImagePath) {
            const errorMsg = `[push-mob-rules] Error: Missing creatureName or absoluteImagePath.`;
            logToRenderer(errorMsg);
            dialog.showErrorBox('Discord Error', `Could not push mob rules. Data from UI was incomplete.`);
            return;
        }

        if (!discordConfig.textChannel) {
            logToRenderer('[push-mob-rules] No text channel configured.');
            return;
        }
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-mob-rules] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }

        try {
            logToRenderer(`[push-mob-rules] Reading image file into buffer from: ${absoluteImagePath}`);
            // Read the rules reference image into memory
            const imageBuffer = await fs.promises.readFile(absoluteImagePath);
            logToRenderer(`[push-mob-rules] Successfully read image into buffer (${imageBuffer.length} bytes).`);

            // Construct the rules embed
            const { mainEmbed } = formatMobRulesForDiscord(creatureName);

            // Send the embed with the image attached
            await channel.send({
                embeds: [mainEmbed],
                files: [{
                    attachment: imageBuffer, // Send the buffer directly as an attachment
                    name: path.basename(absoluteImagePath)
                }]
            });
            logToRenderer('[push-mob-rules] Successfully pushed mob rules embed with image buffer.');
        } catch (error) {
            // Log and show error if communication or file access fails
            logToRenderer(`[push-mob-rules] FAILED to send embed: ${error.message}`);
            logToRenderer(`[push-mob-rules] Error stack: ${error.stack}`);
            dialog.showErrorBox('Discord Error', `Failed to read image file or send to Discord. Please check the file at: ${absoluteImagePath}\n\n${error.message}`);
        }
    });
}

/**
 * Helper to log information back to the renderer's visual console.
 * Handles multiple arguments and complex objects (Errors, JSON).
 */
async function logToRenderer(...args) {
    // Flatten and stringify all arguments into a single message
    const message = args.map(arg => {
        // Special handling to extract stack traces from Error objects
        if (arg instanceof Error) return arg.stack || arg.message;
        // Stringify JSON objects
        if (typeof arg === 'object') return JSON.stringify(arg);
        return arg;
    }).join(' ');

    // Only attempt to send if the window is fully initialized and not being destroyed
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('log-message', message);
    }
    // If called before startup is complete, wait and retry to ensure logs aren't lost
    else if (!isAppReady) {
        await sleep(100);
        logToRenderer(message);
    }
}

/**
 * Connects the Discord client to the Discord gateway using the configured token.
 * Includes error handling for invalid tokens or network issues.
 */
function initializeDiscordBot() {
    // Verify that a token exists before attempting login
    if (!discordConfig || !discordConfig.token) {
        logToRenderer('Discord token not found. Bot not started.');
        return;
    }

    // Attempt to log in
    client.login(discordConfig.token).catch(error => {
        logToRenderer(`Discord login failed: ${error.message}`);
        // Show an error box to the user to highlight the configuration issue
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
        // Notify UI that the bot is offline
        broadcastBotStatus();
    });
}

/**
 * Broadcasts the current Discord connectivity and voice status to all open renderer windows.
 */
function broadcastBotStatus() {
    // Determine the high-level connection status (Online, Soft-Locked, or Offline)
    const status = client.isReady() ? (isSoftLocked ? 'soft-locked' : 'online') : 'offline';
    // Construct a user-friendly status message
    const message = isSoftLocked ? 'Busy (Occupied)' : (client.isReady() ? 'Connected' : (discordConfig.token ? 'Connecting...' : 'Not Configured'));

    // Prepare the state payload for the UI
    const payload = {
        status,
        message,
        voiceStatus,
        isSoftLocked
    };

    // Send the update to the main dashboard
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-bot-status', payload);
    }
    // Also send to the settings window if it is currently open
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('discord-bot-status', payload);
    }
}

// --- Application Shutdown Management ---

// Flag to prevent the shutdown sequence from running multiple times
let isShuttingDown = false;
/**
 * Gracefully shuts down all services (Discord, Audio Mixer, FFmpeg) before exiting the app.
 */
const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
        console.log('Cleaning up and exiting.');


        // Attempt to delete the Discord media control embed so it doesn't stay as a zombie in the chat
        if (client && client.lastMediaMessage) {
            try {
                await client.lastMediaMessage.delete().catch(() => {});
                client.lastMediaMessage = null;
            } catch (e) {
                console.error("Error deleting media control on shutdown:", e);
            }
        }

        // Stop listening to all Discord events
        if (client) {
            client.removeAllListeners();
        }
        // Destroy the audio player and kill any lingering FFmpeg decoding processes
        if (musicPlayer) {
            if (musicPlayer.player) musicPlayer.player.removeAllListeners();
            musicPlayer.destroy();
        }
        // Cleanup the voice connection
        if (connection) {
            connection.removeAllListeners();
            connection.destroy();
        }

        // Log out of the Discord API with a 5-second timeout to prevent the app from hanging
        if (client) {
            try {
                const destroyPromise = client.destroy();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Discord client destroy timed out')), 5000)
                );
                await Promise.race([destroyPromise, timeoutPromise]);
            } catch (e) {
                console.error("Error destroying discord client:", e);
            }
        }

        console.log('Final exit.');
        // Exit the Electron process cleanly
        app.exit(0);
    }
    catch (error) {
        console.log('Error during shutdown:', error);
        // Force exit with error code if cleanup failed
        process.exit(1);
    }
};

// Catch the quit event from the OS or application menu
app.on('before-quit', (e) => {
    if (!isShuttingDown) {
        // Stop standard exit so we can run our async shutdown logic
        e.preventDefault();
        shutdown();
    }
});

// Standard behavior: quit the app when all windows are closed
app.on('window-all-closed', () => {
    // macOS apps usually stay active until the user explicitly quits (Cmd+Q)
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Initiates the process to join a Discord voice channel.
 * Implements an "Anti-Collision" protocol to prevent two TavernTones instances
 * from fighting over the same channel.
 */
async function joinVoiceChannelAction() {
    // Prevent overlapping join attempts
    if (isJoiningVoice) return;

    // Wait for the Discord client to be fully authenticated
    if (!client.isReady()) {
        logToRenderer("[Discord] Client not ready for voice join.");
        return;
    }

    // Check if we already have an active, non-destroyed connection
    const isActive = connection && (
        connection.state.status !== VoiceConnectionStatus.Disconnected &&
        connection.state.status !== VoiceConnectionStatus.Destroyed
    );
    if (isActive) return;

    isJoiningVoice = true;
    isSoftLocked = false;

    // --- Anti-Collision Logic ---
    // We send a "Knock" message to the text channel. If another instance is already
    // in the voice channel, it will respond with "Occupied".
    const voiceChannelId = discordConfig.voiceChannel;
    if (voiceChannelId && discordConfig.textChannel) {
        let textChannel = client.channels.cache.get(discordConfig.textChannel);
        if (!textChannel) {
            try { textChannel = await client.channels.fetch(discordConfig.textChannel); } catch (e) {}
        }

        if (textChannel && textChannel.isTextBased()) {
            logToRenderer(`[Anti-Collision] Knocking on voice channel ${voiceChannelId}...`);
            // Send a hidden knock message
            const knockMsg = await textChannel.send(`||~~TT_KNOCK:${voiceChannelId}~~||`);
            // Delete the knock message shortly after to keep the channel clean
            setTimeout(() => knockMsg.delete().catch(() => {}), 500);

            // Wait 1 second to see if any other instance claims occupancy
            let isOccupied = false;
            const collector = textChannel.createMessageCollector({
                filter: m => m.content.includes(`TT_OCCUPIED:${voiceChannelId}`) && m.author.id === client.user.id,
                time: 1000
            });

            // Promisify the collector wait
            await new Promise(resolve => {
                collector.on('collect', () => {
                    isOccupied = true;
                    collector.stop();
                });
                collector.on('end', resolve);
            });

            // If another instance is present, abort the join
            if (isOccupied) {
                logToRenderer(`[Anti-Collision] Voice channel ${voiceChannelId} is occupied. Join cancelled.`);
                isSoftLocked = true;
                isJoiningVoice = false;
                broadcastBotStatus();
                return;
            }
        }
    }

    // Attempt to retrieve the voice channel object
    const voiceChannel = client.channels.cache.get(voiceChannelId);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            voiceStatus = 'connecting';
            broadcastBotStatus();

            // Destroy any existing stale connection for this guild
            const existingConnection = getVoiceConnection(voiceChannel.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }

            // Create the new voice connection
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            // Listener: Connection successfully established
            connection.on(VoiceConnectionStatus.Ready, () => {
                voiceStatus = 'connected';
                broadcastBotStatus();
                logToRenderer('The bot has connected to the channel!');
                // Give the connection reference to the music player
                musicPlayer.setConnection(connection);
            });

            // Listener: Connection lost (attempting automatic recovery)
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                voiceStatus = 'connecting';
                broadcastBotStatus();
                try {
                    // Wait for the connection to signal a path back to 'Ready'
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    // Fail over to full disconnect if recovery times out
                    leaveVoiceChannelAction();
                }
            });

            // Listener: Connection permanently closed
            connection.on(VoiceConnectionStatus.Destroyed, () => {
                voiceStatus = 'disconnected';
                broadcastBotStatus();
            });

            // Wait up to 30s for initial connection success
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        } catch (error) {
            logToRenderer('Error joining voice channel: ', error.message || error);
            leaveVoiceChannelAction();
        } finally {
            isJoiningVoice = false;
        }
    } else {
        logToRenderer('Voice channel not found or is not a voice channel!');
        isJoiningVoice = false;
    }
}

/**
 * Disconnects from the current Discord voice channel.
 */
function leaveVoiceChannelAction() {
    if (connection) {
        connection.destroy();
        connection = null;
    }
    voiceStatus = 'disconnected';
    broadcastBotStatus();
}

client.once(Events.ClientReady, async () => {
    logToRenderer('TavernTones is online!');

    // Robust collision detection for Voice Channels using a "Knock" protocol
    if (discordConfig.textChannel) {
        try {
            let channel = client.channels.cache.get(discordConfig.textChannel);
            if (!channel) channel = await client.channels.fetch(discordConfig.textChannel);

            if (channel && channel.isTextBased()) {
                // Listen for knocks from other instances
                client.on('messageCreate', async (m) => {
                    if (m.author.id !== client.user.id) return;

                    // Response to a "knock" if we are currently in that voice channel
                    // AND we have an active connection (we don't respond if we are just a ghost/zombie)
                    if (m.content.includes('TT_KNOCK:')) {
                        const targetId = m.content.split('TT_KNOCK:')[1].split('~')[0];
                        const me = m.guild.members.me;
                        const isActivelyConnected = connection && (
                            connection.state.status === VoiceConnectionStatus.Ready ||
                            connection.state.status === VoiceConnectionStatus.Connecting ||
                            connection.state.status === VoiceConnectionStatus.Signalling
                        );

                        if (me && me.voice.channelId === targetId && isActivelyConnected) {
                            logToRenderer(`[Anti-Collision] Responding to knock for channel ${targetId}`);
                            const occMsg = await m.channel.send(`||~~TT_OCCUPIED:${targetId}~~||`);
                            setTimeout(() => occMsg.delete().catch(() => {}), 500);
                        }
                    }
                });
            }
        } catch (e) {
            logToRenderer("[Anti-Collision] Error setting up listener: " + e.message);
        }
    }

    broadcastBotStatus();
    // updateDiscordMediaControl(); // MOVED DOWN


    logToRenderer(`Logged in as ${client.user.tag}`);

    client.on('messageCreate', async message => {
        if (client.commandHandler) client.commandHandler.handleMessage(message);
    });

    const basePath = app.isPackaged
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();

    const extendedConfig = {
        ...discordConfig,
        joinVoiceCallback: async () => {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
        }
    };

    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, extendedConfig, fiveEToolsParser);
    client.commandHandler = commandHandler;

    client.lastMediaMessage = null;
    let isUpdatingMediaControl = false;
    let pendingMediaUpdate = false;
    let selectedSongInDropdown = null;
    let currentDropdownPage = 0;
    const PAGE_SIZE = 23;

    // Map to handle long file paths in Discord select menus (100 char limit)
    const songPathToIdMap = new Map();
    const idToSongPathMap = new Map();
    let songIdCounter = 0;

    function getSongId(filePath) {
        if (songPathToIdMap.has(filePath)) return songPathToIdMap.get(filePath);
        const id = `s_${songIdCounter++}`;
        songPathToIdMap.set(filePath, id);
        idToSongPathMap.set(id, filePath);
        return id;
    }

    // Now call it once defined
    updateDiscordMediaControl();

    async function updateDiscordMediaControl(disabled = false) {
        if (isShuttingDown) return;

        if (discordConfig.showMediaControl === false) {
            if (client.lastMediaMessage) {
                try {
                    await client.lastMediaMessage.delete().catch(() => {});
                    client.lastMediaMessage = null;
                } catch (e) {
                    console.error("Error deleting media control:", e);
                }
            }
            return;
        }

        if (!discordConfig.textChannel) {
            logToRenderer('[Discord] No text channel configured for media controls.');
            return;
        }
        if (isUpdatingMediaControl) {
            pendingMediaUpdate = true;
            return;
        }

        let targetChannel = client.channels.cache.get(discordConfig.textChannel);
        if (!targetChannel) {
            try {
                targetChannel = await client.channels.fetch(discordConfig.textChannel);
            } catch (err) {
                logToRenderer(`[Discord] Failed to fetch channel ${discordConfig.textChannel}: ${err.message}`);
                return;
            }
        }

        if (!targetChannel) {
            logToRenderer(`[Discord] Channel ${discordConfig.textChannel} not found.`);
            return;
        }

        isUpdatingMediaControl = true;

        const status = {
            isPlaying: musicPlayer.isPlaying,
            loopMode: musicPlayer.loopMode,
            shuffleMode: musicPlayer.shuffleMode,
            currentTrack: musicPlayer.stack[musicPlayer.currentIndex],
            stackSize: musicPlayer.stack.length,
            currentIndex: musicPlayer.currentIndex,
            currentTime: musicPlayer.currentTime,
            duration: musicPlayer.duration
        };

        const loopIcons = ['➡️', '🔁', '🔂'];

        function createProgressString(current, total) {
            const size = 10;
            if (total <= 0) return '⬛'.repeat(size);
            const progress = Math.round((current / total) * size);
            return '🟩'.repeat(Math.min(size, progress)) + '⬛'.repeat(Math.max(0, size - progress));
        }

        const formatTime = (s) => {
            const mins = Math.floor(s / 60);
            const secs = Math.floor(s % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const embed = new EmbedBuilder()
            .setTitle('🎵 Music Player Control')
            .setColor(status.isPlaying ? 0x00FF00 : 0xFF0000)
            .addFields(
                { name: 'Status', value: status.isPlaying ? '▶️ Playing' : '⏸️ Paused', inline: true },
                { name: 'Loop', value: loopIcons[status.loopMode], inline: true },
                { name: 'Shuffle', value: status.shuffleMode ? '🔀 On' : '🔀 Off', inline: true },
                { name: 'Track', value: status.currentTrack ? path.basename(status.currentTrack) : 'None' },
                { name: 'Progress', value: `${createProgressString(status.currentTime, status.duration)} \`[${formatTime(status.currentTime)} / ${formatTime(status.duration)}]\`` },
                { name: 'Playlist', value: `${status.stackSize} tracks` }
            )
            .setTimestamp();

        // --- Row 1: Song Selector Dropdown ---
        if (!cachedDiscordSongOptions) {
            cachedDiscordSongOptions = getFlatMusicList().map(p => ({
                label: path.basename(p).substring(0, 100),
                value: getSongId(p)
            }));
        }
        const songs = cachedDiscordSongOptions;

        const totalPages = Math.ceil(songs.length / PAGE_SIZE);
        const start = currentDropdownPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageSongs = songs.slice(start, end);

        const songOptions = pageSongs.map(s => ({
            label: s.label,
            value: s.value,
            default: selectedSongInDropdown === idToSongPathMap.get(s.value)
        }));

        // Add pagination options if needed
        if (totalPages > 1) {
            if (currentDropdownPage > 0) {
                songOptions.unshift({ label: '⬅️ Previous Page', value: 'prev_page' });
            }
            if (currentDropdownPage < totalPages - 1) {
                songOptions.push({ label: '➡️ Next Page', value: 'next_page' });
            }
        }

        if (songOptions.length === 0) {
            songOptions.push({ label: 'No music found', value: 'none' });
        }

        const songSelector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('media-song-select')
                .setPlaceholder('Select a song...')
                .addOptions(songOptions)
                .setDisabled(disabled || songs.length === 0)
        );

        // --- Row 2: Selection Actions ---
        const selectionActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('media-play-next').setLabel('Play Next').setStyle(ButtonStyle.Primary).setDisabled(disabled || !selectedSongInDropdown),
            new ButtonBuilder().setCustomId('media-play-now').setLabel('Play Now').setStyle(ButtonStyle.Success).setDisabled(disabled || !selectedSongInDropdown),
            new ButtonBuilder().setCustomId('media-remove-stack').setLabel('Remove').setStyle(ButtonStyle.Danger).setDisabled(disabled || status.stackSize === 0)
        );

        // --- Row 3: Playback Controls ---
        const playbackControls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('media-prev').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-play-pause').setLabel(status.isPlaying ? '⏸️' : '▶️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-next').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-loop').setLabel(loopIcons[status.loopMode]).setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('media-shuffle').setLabel('🔀').setStyle(status.shuffleMode ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(disabled)
        );

        const components = [songSelector, selectionActions, playbackControls];

        try {
            if (client.lastMediaMessage) {
                // Check if message still exists by fetching or just trying to edit
                await client.lastMediaMessage.edit({ embeds: [embed], components });
            } else {
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            }
        } catch (e) {
            try {
                // If edit fails, it might be deleted. Send new one.
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            } catch (err) {
                logToRenderer(`Failed to send Discord media control: ${err.message}`);
            }
        } finally {
            isUpdatingMediaControl = false;
            if (pendingMediaUpdate) {
                pendingMediaUpdate = false;
                updateDiscordMediaControl(disabled);
            }
        }
    }

    let lastDiscordMediaUpdate = 0;
    musicPlayer.on('status-change', (status) => {
        const now = Date.now();
        // If it's just a time update, throttle to every 10 seconds
        if (status.isTimeUpdate) {
            if (now - lastDiscordMediaUpdate >= 10000) {
                lastDiscordMediaUpdate = now;
                updateDiscordMediaControl();
            }
        } else {
            // Significant status change (play/pause/track change), update immediately
            lastDiscordMediaUpdate = now;
            updateDiscordMediaControl();
        }
    });

    client.on('interactionCreate', async interaction => {
        if (interaction.isChatInputCommand()) {
            const { commandName, options } = interaction;

            if (commandName === 'roll') {
                const notation = options.getString('notation');
                try {
                    const roller = new DiceRoller();
                    const roll = roller.roll(notation);
                    await interaction.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
                } catch (e) {
                    await interaction.reply({ content: 'Invalid notation.', ephemeral: true });
                }
            } else if (commandName === 'play-song') {
                const query = options.getString('query');
                const song = client.commandHandler.findSong(query);
                if (song) {
                    await musicPlayer.addToStack(song);
                    if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                    musicPlayer.play();
                    await interaction.reply(`Playing: **${path.basename(song)}**`);
                } else {
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
                }
            } else if (commandName === 'add-song') {
                const query = options.getString('query');
                const song = client.commandHandler.findSong(query);
                if (song) {
                    await musicPlayer.addToStack(song);
                    await interaction.reply(`Added to stack: **${path.basename(song)}**`);
                } else {
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
                }
            } else if (commandName === 'play-folder') {
                await interaction.deferReply();
                const query = options.getString('query');
                const folder = client.commandHandler.findFolder(query);
                if (folder) {
                    const songs = client.commandHandler.getFolderSongs(folder);
                    if (songs.length > 0) {
                        musicPlayer.clearStack();
                        await musicPlayer.addToStack(songs);
                        if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                        musicPlayer.play();
                        await interaction.editReply({ content: `Playing folder: **${path.basename(folder)}** (${songs.length} songs)` });
                    } else {
                        await interaction.editReply({ content: "Folder is empty." });
                    }
                } else {
                    await interaction.editReply({ content: "Could not find that folder." });
                }
            } else if (commandName === 'add-folder') {
                await interaction.deferReply();
                const query = options.getString('query');
                const folder = client.commandHandler.findFolder(query);
                if (folder) {
                    const songs = client.commandHandler.getFolderSongs(folder);
                    if (songs.length > 0) {
                        await musicPlayer.addToStack(songs);
                        await interaction.editReply({ content: `Added folder to stack: **${path.basename(folder)}** (${songs.length} songs)` });
                    } else {
                        await interaction.editReply({ content: "Folder is empty." });
                    }
                } else {
                    await interaction.editReply({ content: "Could not find that folder." });
                }
            } else if (commandName === 'dice-help') {
                const embed = new EmbedBuilder()
                    .setTitle("RPG Dice Notation Help")
                    .setColor(0x00FF00)
                    .setDescription("TavernTones uses the `@dice-roller/rpg-dice-roller` library.")
                    .addFields(
                        { name: "Basic", value: "`2d20`, `1d12 + 4`, `3d6 - 2`" },
                        { name: "Keep/Drop", value: "`4d6kh3` (Keep Highest 3), `2d20kl1` (Keep Lowest 1), `4d6dl1` (Drop Lowest 1)" },
                        { name: "Exploding", value: "`4d10!` (Explode on max), `4d10!>8` (Explode on 8 or higher)" },
                        { name: "Reroll", value: "`1d20r1` (Reroll 1s), `1d20r<3` (Reroll 3 or less)" },
                        { name: "Success/Failure", value: "`10d6>4` (Count dice > 4)" }
                    );
                await interaction.reply({ embeds: [embed] });
            } else if (commandName === 'play') {
                const f = options.getString('folder') || 'chill';
                const s = options.getString('song');
                const songFilePath = await client.commandHandler.findMusic(f, s);
                if (songFilePath) {
                    await interaction.reply(`Playing: **${path.parse(songFilePath).name}**`);
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(songFilePath);
                    if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                    musicPlayer.play();
                } else {
                    await interaction.reply({ content: "Could not find that music.", ephemeral: true });
                }
            } else if (commandName === 'pause') {
                musicPlayer.pause();
                await interaction.reply('Paused.');
            } else if (commandName === 'stop') {
                musicPlayer.stop();
                musicPlayer.clearStack();
                await interaction.reply('Stopped and cleared stack.');
            } else if (commandName === 'ping') {
                await interaction.reply('Pong!');
            } else if (commandName === 'surge') {
                // Emulate surge command
                const msg = { author: interaction.user, reply: (c) => interaction.reply(c), content: '!su', mentions: { has: () => true, roles: { has: () => false } } };
                await client.commandHandler.handleMessage(msg);
            } else if (commandName === 'shield') {
                const msg = { author: interaction.user, reply: (c) => interaction.reply(c), content: '!sh', mentions: { has: () => true, roles: { has: () => false } } };
                await client.commandHandler.handleMessage(msg);
            } else if (commandName === 'roll-table') {
                const folder = interaction.options.getString('folder');
                const count = interaction.options.getInteger('count');
                const args = interaction.options.getString('args');
                const msg = {
                    author: interaction.user,
                    reply: (c) => interaction.reply(c),
                    content: `!ro ${folder} ${count} ${args}`,
                    mentions: { has: () => true, roles: { has: () => false } },
                    channel: interaction.channel,
                    startThread: (o) => interaction.channel.threads.create(o)
                };
                // Interaction needs to be deferred if it takes long
                await interaction.deferReply();
                msg.reply = (c) => interaction.editReply(c);
                await client.commandHandler.handleMessage(msg);
            }
        }

        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

            if (customId === '5e-result-select') {
                await interaction.deferUpdate();
                const [category, source, name] = values[0].split('__');
                const item = await fiveEToolsParser.getExact(category, name, source);
                if (item) {
                    const embed = format5eResult(item);
                    await interaction.editReply({ embeds: [embed], components: [] });
                } else {
                    await interaction.editReply({ content: 'Sorry, I couldn\'t retrieve the details.', components: [] });
                }
            } else if (customId === 'media-song-select') {
                const val = values[0];
                if (val === 'next_page') {
                    currentDropdownPage++;
                } else if (val === 'prev_page') {
                    currentDropdownPage--;
                } else {
                    selectedSongInDropdown = idToSongPathMap.get(val);
                }
                await interaction.deferUpdate();
                updateDiscordMediaControl();
            }
        }

        if (interaction.isButton()) {
            const { customId } = interaction;
            if (customId.startsWith('media-')) {
                await interaction.deferUpdate();
                switch (customId) {
                    case 'media-prev': musicPlayer.prev(); break;
                    case 'media-next': musicPlayer.next(); break;
                    case 'media-play-pause':
                        if (musicPlayer.isPlaying) {
                            musicPlayer.pause();
                        } else {
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                            musicPlayer.play();
                        }
                        break;
                    case 'media-loop': musicPlayer.setLoopMode((musicPlayer.loopMode + 1) % 3); break;
                    case 'media-shuffle': musicPlayer.setShuffle(!musicPlayer.shuffleMode); break;
                    case 'media-play-next':
                        if (selectedSongInDropdown) {
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                            musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, selectedSongInDropdown);
                            selectedSongInDropdown = null;
                        }
                        break;
                    case 'media-play-now':
                        if (selectedSongInDropdown) {
                            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                            musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, selectedSongInDropdown);
                            musicPlayer.next();
                            selectedSongInDropdown = null;
                        }
                        break;
                    case 'media-remove-stack':
                        musicPlayer.removeFromStack(musicPlayer.currentIndex);
                        break;
                }
                updateDiscordMediaControl();
            }
        }
    });
});

// let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
// const startingMemUse = memoryUsage;
// setInterval(() => {
//     memoryUsage = process.memoryUsage().rss;
//     logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
// }, 60000);


function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Dead
    if (current > max) return '#007bff'; // Overhealed? Treat as blue/100% or purple? Sticking to blue for base HP.

    const percentage = (current / max) * 100;
    if (percentage >= 100) return '#007bff'; // Blue
    if (percentage >= 50) return '#28a745'; // Green
    if (percentage >= 25) return '#ffc107'; // Yellow
    return '#dc3545'; // Red (< 25%)
}

function scanMusicLibrary() {
    if (!discordConfig.defaultMusicPath || !fs.existsSync(discordConfig.defaultMusicPath)) {
        logToRenderer("[Library] No music folder configured or path invalid.");
        return;
    }

    logToRenderer("[Library] Scanning music folder...");
    const worker = new Worker(path.join(__dirname, 'MusicScannerWorker.js'), {
        workerData: {
            musicFolder: discordConfig.defaultMusicPath,
            extensions: ['.mp3', '.wav', '.ogg', '.lnk']
        }
    });

    worker.on('message', async (result) => {
        if (result.success) {
            const oldLibrary = discordConfig.musicLibrary || { children: [] };
            const newLibrary = result.library;

            // --- Diff logic for modal ---
            const oldFiles = new Set();
            const newFiles = new Set();
            const oldFolders = new Set();
            const newFolders = new Set();

            const collectMetadata = (node, fileSet, folderSet) => {
                if (node.type === 'file') fileSet.add(node.path);
                else {
                    folderSet.add(node.path);
                    if (node.children) node.children.forEach(c => collectMetadata(c, fileSet, folderSet));
                }
            };

            collectMetadata(oldLibrary, oldFiles, oldFolders);
            collectMetadata(newLibrary, newFiles, newFolders);

            const addedSongs = [...newFiles].filter(f => !oldFiles.has(f)).length;
            const removedSongs = [...oldFiles].filter(f => !newFiles.has(f)).length;
            const addedFolders = [...newFolders].filter(f => !oldFolders.has(f)).length;
            const removedFolders = [...oldFolders].filter(f => !newFolders.has(f)).length;

            if (addedSongs > 0 || removedSongs > 0 || addedFolders > 0 || removedFolders > 0) {
                logToRenderer(`[Library] Scan complete: ${addedSongs} songs, ${addedFolders} folders added; ${removedSongs} songs, ${removedFolders} folders removed.`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('music-library-update', {
                        library: newLibrary,
                        diff: { added: addedSongs, removed: removedSongs, addedFolders, removedFolders }
                    });
                }
            } else {
                logToRenderer("[Library] Scan complete: No changes.");
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('music-library-update', { library: newLibrary, diff: null });
                }
            }

            discordConfig.musicLibrary = newLibrary;
            invalidateMusicCache();
            await setDiscordConfig(discordConfig);

        } else {
            logToRenderer(`[Library] Scan failed: ${result.error}`);
        }
    });

    worker.on('error', (err) => {
        logToRenderer(`[Library] Worker error: ${err.message}`);
    });
}
