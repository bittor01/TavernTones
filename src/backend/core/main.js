// Initialize the core application components and environment.
// Performance and security updates are prioritized here.

// Electron modules facilitate window management, IPC, and secure OS integration.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');

// Register a custom 'safe-media' protocol to allow the UI to stream local audio
// files without violating restrictive Content Security Policies (CSP).
protocol.registerSchemesAsPrivileged([
    { scheme: 'safe-media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

const path = require('path');
const { pathToFileURL } = require('url');

// Discord.js and Voice modules provide the backbone for bot interaction and audio streaming.
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Events, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
// Import Discord voice modules for audio streaming
const { joinVoiceChannel, entersState, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');

// Instantiate the Discord client with intents required to listen for commands
// and manage voice connections across servers.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages
    ],
    // Partials enable the bot to handle interactions in DMs or with older messages.
    partials: [Partials.Channel, Partials.Message]
});
// Store active dropdown handlers directly on the client for easy access during interactions.
client.npcDropdownHandlers = new Map();

// External dependencies for network requests, audio processing, and data parsing.
const axios = require('axios');
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
const CommandHandler = require('../../discord/CommandHandler.js');
const FiveEToolsParser = require('./5eParser.js');
const { getDiscordConfig, setDiscordConfig } = require('./config.js');
const { format5eResult } = require('../../discord/5eEmbedFormatter.js');
const { mobRules } = require('../data/mobRules.js');
const DropdownHandler = require('../../discord/DropdownHandler.js');
const fs = require('fs');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const GitHubSync = require('./GitHubSync.js');

// Use Worker threads to keep the main process responsive during heavy disk scans.
const { Worker } = require('worker_threads');
let discordConfig;

// Caching for music library
let cachedMusicLibrary = null;
let cachedFlatMusicList = null;
let cachedDiscordSongOptions = null;

/**
 * Retrieves and formats the music library structure.
 * It combines the disk-scanned library with "loose" files added manually.
 * @returns {object} The music library object.
 */
const getMusicLibrary = () => {
    // Fail-safe for initialization race conditions where config isn't yet loaded.
    if (!discordConfig) return { children: [] };

    // Memoize the library structure to prevent expensive re-parsing on every UI update.
    if (cachedMusicLibrary) return cachedMusicLibrary;

    // Start with the base scanned library from disk.
    const library = { ...(discordConfig.musicLibrary || { children: [] }) };
    library.children = library.children ? [...library.children] : [];

    // Loose files are audio tracks added outside the primary music directory.
    // They are grouped into a virtual "Loose Files" folder for a cleaner UI.
    const looseFiles = discordConfig.looseFiles || [];
    if (looseFiles.length > 0) {
        let looseFolder = library.children.find(c => c.name === 'Loose Files');
        if (looseFolder) {
            // Clone the existing virtual folder to avoid direct mutation of the config object.
            looseFolder = { ...looseFolder };
            const idx = library.children.findIndex(c => c.name === 'Loose Files');
            library.children[idx] = looseFolder;
        } else {
            // Create the virtual folder if this is the first loose file being added.
            looseFolder = { name: 'Loose Files', type: 'directory', children: [], path: 'loose' };
            library.children.push(looseFolder);
        }

        // Convert raw file paths into the structured node format used by the tree view.
        looseFolder.children = looseFiles.map(p => ({
            name: path.basename(p),
            path: p,
            type: 'file'
        }));
    }

    cachedMusicLibrary = library;
    return library;
};

/**
 * Returns a flat array of all music file paths in the library.
 * Useful for index-based selection and fuzzy searching.
 * @returns {string[]}
 */
const getFlatMusicList = () => {
    // Return the cached flattened list if the library hasn't changed.
    if (cachedFlatMusicList) return cachedFlatMusicList;

    const list = [];
    /**
     * Recursive helper to traverse the library tree and harvest all file nodes.
     */
    const traverse = (node) => {
        if (node.type === 'file') {
            list.push(node.path);
        } else if (node.children) {
            node.children.forEach(traverse);
        }
    };

    // Flatten the library starting from the root of the hierarchy.
    const library = getMusicLibrary();
    traverse(library);

    cachedFlatMusicList = list;
    return list;
};

/**
 * Invalidates all music-related caches.
 */
function invalidateMusicCache() {
    // Reset library and list caches
    cachedMusicLibrary = null;
    cachedFlatMusicList = null;
    // Reset Discord dropdown options cache
    cachedDiscordSongOptions = null;
}
let connection;
let voiceStatus = 'disconnected'; // disconnected, connecting, connected
let isJoiningVoice = false; // Prevents race conditions during knocking/joining
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
let fiveEToolsParser;

// Anti-collision state
let isSoftLocked = false;

// Implement a Single Instance Lock to prevent database or audio port collisions.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // If another instance is already running, exit immediately.
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // If a user tries to launch TavernTones again, bring the existing window to the front.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
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
let mainWindow;
/** @type {BrowserWindow | null} The settings window. */
let settingsWindow;
/** @type {boolean} Flag to indicate if the main window has loaded its content. */
let windowloaded = false;

// --- State Management ---
const autosavePath = path.join(app.getPath('userData'), 'autosave.json');
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
const hpBarEmojiMap = {
    '#007bff': '🟦',      // Blue (100%)
    '#28a745': '🟩',     // Green (50-99%)
    '#ffc107': '🟨',    // Yellow (25-49%)
    '#dc3545': '🟥',       // Red (<25%)
    '#8a2be2': '🟪',    // Purple (Temp HP)
    '#6c757d': '💀',     // Dead
    'empty': '⬛'
};

/**
 * Sends updated initiative data to the renderer process.
 * @param {object[]} initiativeOrder - The current initiative order.
 * @param {number} currentTurnIndex - Index of the current turn.
 * @param {any} [extra=null] - Optional additional data.
 */
async function sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra = null) {
    // Only send if app is ready and window exists
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex, extra });
    }
    else if (!isAppReady) {
        // Wait and retry if app is not yet initialized
        await sleep(100);
        sendInitiativeUpdate(initiativeOrder, currentTurnIndex, extra);
    }
}

/**
 * Sends a dice roll log entry to the renderer.
 * @param {string} message - The roll description.
 */
async function logDiceRollToRenderer(message) {
    // Verify window state before sending
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('dice-log', message);
    } else if (!isAppReady) {
        // Retry loop if app is starting up
        await sleep(100);
        logDiceRollToRenderer(message);
    }
}

/**
 * Utility to pause execution.
 * @param {number} ms - Time in milliseconds.
 * @returns {Promise}
 */
function sleep(ms) {
    // Clamp to minimum 0
    const safeMs = Math.max(0, Number(ms) || 0);
    return new Promise(resolve => setTimeout(resolve, safeMs));
}

//Begin UI
// Electron Setup
/**
 * Creates and loads the main application window.
 * @param {boolean} [showWindow=true] - Whether to show the window immediately after creation.
 * @returns {Promise<void>}
 */
async function createWindow(showWindow = true) {
    console.log('createWindow() called.');
    mainWindow = new BrowserWindow({
        show: false, // Do not show the window until it's ready
        webPreferences: {
            preload: path.join(__dirname, '../../ui/preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });
    if (showWindow) {
        mainWindow.maximize();
        mainWindow.show();
        console.log('Window created and shown.');
    } else {
        console.log('Window created minimized.');
    }
    await mainWindow.loadFile(path.join(__dirname, '../../ui/Index.html'));
    console.log('index.html loaded.');
    windowloaded = true;
}

/**
 * Creates and shows the settings window. If the window already exists, it focuses it.
 */
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }
    settingsWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, '../../ui/settings/settings-preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });
    settingsWindow.loadFile(path.join(__dirname, '../../ui/settings/settings.html'));
    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

/**
 * The core application bootstrapper. It coordinates configuration loading,
 * protocol registration, service initialization, and window creation.
 */
async function apploader() {
    await app.whenReady().then(async () => {
        // Load persistent settings from Electron-store.
        discordConfig = await getDiscordConfig();

        // Implement the custom 'safe-media' protocol to bypass CORS/CSP
        // restrictions when the UI needs to play local audio files.
        protocol.handle('safe-media', async (request) => {
            try {
                const url = new URL(request.url);
                const absolutePath = url.searchParams.get('path');

                // Security check: Verify file exists before attempting to read.
                if (!absolutePath || !fs.existsSync(absolutePath)) {
                    console.error(`[safe-media] File not found or invalid: ${absolutePath}`);
                    return new Response('File not found', { status: 404 });
                }

                const ext = path.extname(absolutePath).toLowerCase();
                const mimeTypes = {
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg'
                };
                const contentType = mimeTypes[ext] || 'audio/mpeg';

                // We load the file into a buffer to ensure compatibility with various browser
                // fetching strategies, even if it's slightly more memory-intensive for large files.
                const buffer = await fs.promises.readFile(absolutePath);
                return new Response(buffer, {
                    headers: { 'Content-Type': contentType }
                });
            } catch (error) {
                console.error('[safe-media] Protocol error:', error);
                return new Response('Error: ' + error.message, { status: 500 });
            }
        });
        console.log('App is ready.');

        // Instantiate core logic handlers for audio, filesystem watching, and 5e data parsing.
        musicPlayer = new BackendAudioPlayer(logToRenderer, shell, discordConfig.defaultMusicPath, discordConfig.ffmpegPath);
        setupFilesystemWatchers(discordConfig);

        // Initiate a background scan of the music library.
        if (discordConfig.defaultMusicPath) {
            // Use existing cached library metadata if available for instant UI responsiveness.
            if (discordConfig.musicLibrary) {
                ipcMain.handleOnce('get-music-library-ready', () => true);
            }
            scanMusicLibrary();
        }

        // Map all IPC events. This must happen before window creation to avoid race conditions.
        ipcloader();
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app, discordConfig);

        // Verify that critical data directories are configured.
        const { bestiaryPath, randomTablesPath } = discordConfig;
        const pathsConfigured = bestiaryPath && randomTablesPath;
        if (!pathsConfigured) {
            logToRenderer("Essential data folders are not configured.");
            // Blocking dialog to force user configuration before the app continues.
            await dialog.showMessageBox(null, {
                type: 'warning',
                title: 'Configuration Required',
                message: 'One or more essential data folders have not been set up. Please configure them in the settings.',
                buttons: ['Go to Settings']
            });
            createSettingsWindow();
            return;
        }

        // Configuration is valid, proceed to launch the primary interface.
        await createWindow(true);
        isAppReady = true;

        // Handle Discord Bot setup.
        if (discordConfig && discordConfig.enabled) {
            if (!discordConfig.token) {
                logToRenderer("Discord token not found despite bot being enabled. Bot functionality will be disabled.");
                mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Not Configured' });
            } else {
                initializeDiscordBot();
            }
        } else {
            logToRenderer("Discord bot is disabled in settings.");
            mainWindow.webContents.send('discord-bot-status', { status: 'offline', message: 'Disabled' });
        }
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                // Re-check config on activate, in case it was the only window.
                if (pathsConfigured) {
                    createWindow(true);
                } else {
                    createSettingsWindow();
                }
            }
        });
    });
}
ipcMain.handle('get-dnd-conditions', async () => {
    return DND_CONDITIONS;
});
ipcMain.handle('get-mob-rules-data', async () => {
    return mobRules;
});
ipcMain.handle('get-image-as-data-url', async (event, relativePath) => {
    // Determine the base path for assets, which varies depending on whether the app is packaged.
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();

    // Resolve the full filesystem path for the requested image.
    const absoluteImagePath = app.isPackaged
        ? path.join(basePath, 'MobRules', 'MobRules.png')
        : path.join(basePath, relativePath);

    try {
        // Read the image file directly from disk.
        const data = await fs.readFile(absoluteImagePath);
        const extension = path.extname(absoluteImagePath).substring(1);

        // Convert to Base64 Data URL so the UI can display it without worrying about file protocol security.
        const dataUrl = `data:image/${extension};base64,${data.toString('base64')}`;
        return { success: true, dataUrl: dataUrl, absolutePath: absoluteImagePath };
    } catch (error) {
        const errorMessage = `Failed to read image file. Error: ${error.message}`;
        logToRenderer(`[IPC] Error: ${errorMessage}`);
        return { success: false, error: errorMessage, absolutePath: absoluteImagePath };
    }
});

// Disable hardware acceleration for headless environments (e.g., Playwright)
// This prevents crashes related to GPU initialization.
app.disableHardwareAcceleration();

// Handle uncaught exceptions to prevent the app from crashing on non-critical stream errors
process.on('uncaughtException', (error) => {
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        // This error is a known side effect of destroying audio streams during track changes or shutdown.
        // It is harmless in this context and can be safely ignored.
        return;
    }
    console.error('Uncaught Exception in Main Process:', error);
});
apploader();



/**
 * Creates a visual HP bar using emojis.
 * @param {object} creature - The combatant object.
 * @returns {string} Emoji string.
 */
function createEmojiHpBar(creature) {
    const BAR_LENGTH = 8;
    const hp = creature.hp || 0;
    const maxHp = creature.maxHp || 1;
    const tempHp = creature.tempHp || 0;

    // Return dead blocks if HP is 0 or less
    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(BAR_LENGTH);
    }

    // Calculate number of blocks for HP and Temp HP
    const hpBlocks = Math.round((hp / maxHp) * BAR_LENGTH);
    const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tempHp / maxHp) * BAR_LENGTH));

    // Get color theme for HP
    const hpColorEmoji = hpBarEmojiMap[getHpColor(hp, maxHp)] || hpBarEmojiMap['#007bff'];
    const tempHpEmoji = hpBarEmojiMap['#8a2be2'];
    const emptyEmoji = hpBarEmojiMap['empty'];
    let bar = '';
    // Build bar string block by block
    for (let i = 0; i < BAR_LENGTH; i++) {
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
 * Formats a monster's stat block for Discord display.
 * @param {object} monster - Monster data.
 * @returns {object} Object containing mainEmbed and longFields.
 */
function formatStatBlockForDiscord(monster) {
    // Part 1: Create the main embed with core stats
    const mainEmbed = new EmbedBuilder()
        .setColor(0x0099FF);

    // Build the header and core stats description
    let description = `# ${monster.name}\n*${monster.size} ${typeof monster.type === 'object' ? monster.type.type : monster.type}, ${monster.alignment}*\n\n`;
    const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` (${a.from.join(', ')})` : '')).join(', ');
    description += `**Armor Class** ${ac}\n`;
    description += `**Hit Points** ${monster.hp.average} (${monster.hp.formula})\n`;
    description += `**Speed** ${Object.entries(monster.speed).map(([type, val]) => `${type} ${val.number || val} ft.`).join(', ')}\n\n`;

    /**
     * Helper to format ability modifiers.
     */
    const formatMod = (score) => {
        const mod = Math.floor(((score || 10) - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };
    // Add ability scores
    description += `**STR** ${monster.str} (${formatMod(monster.str)}) | **DEX** ${monster.dex} (${formatMod(monster.dex)}) | **CON** ${monster.con} (${formatMod(monster.con)})\n`;
    description += `**INT** ${monster.int} (${formatMod(monster.int)}) | **WIS** ${monster.wis} (${formatMod(monster.wis)}) | **CHA** ${monster.cha} (${formatMod(monster.cha)})`;
    mainEmbed.setDescription(description);

    // Part 2: Prepare long fields for separate messages
    const longFields = [];
    /**
     * Helper to process nested entry arrays into strings.
     */
    const processEntries = (entries) => {
        if (!entries) return '';
        return entries.map(e => {
            if (typeof e === 'string') return e;
            if (e.name && e.entries) {
                const entryText = e.entries.join(' ').replace(/{@(dice|damage|hit) ([^}]+)}/g, '($2)');
                return `**_${e.name}._** ${entryText}`;
            }
            return '';
        }).join('\n\n');
    };

    // Separate long content into dedicated fields for threads
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
 * Prepares the Mob Rules reference embed for Discord.
 * @param {string} creatureName - Name of the mob.
 * @returns {object} Embed and image path.
 */
function formatMobRulesForDiscord(creatureName) {
    const { discord: discordData, imagePath } = mobRules;

    // Create the rule reference embed
    const mainEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Use orange theme
        .setTitle(`${discordData.title}: ${creatureName}`)
        .setDescription(discordData.description)
        .addFields(...discordData.fields)
        // Reference the attached image file
        .setImage(`attachment://${path.basename(imagePath)}`);
    return { mainEmbed, imagePath };
}

/**
 * Splits a long string into chunks for Discord.
 * @param {string} text - Input text.
 * @param {number} [maxLength=1024] - Max length per chunk.
 * @returns {string[]}
 */
function splitText(text, maxLength = 1024) {
    const chunks = [];
    if (!text) return chunks;
    let currentChunk = "";
    // Split by line to avoid breaking words where possible
    const lines = text.split('\n');
    for (const line of lines) {
        // Forcefully split lines that are too long
        if (line.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            const lineChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            chunks.push(...lineChunks);
            continue;
        }

        // Buffer the next line
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = "";
        }

        // Add the line to the current chunk
        currentChunk += (currentChunk ? '\n' : '') + line;
    }

    // Add final chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    return chunks;
}

/**
 * Shows turn-based reminders in an Electron dialog.
 * @param {object} creature - The active combatant.
 * @param {string} turnEvent - 'start' or 'end'.
 */
async function checkAndShowReminders(creature, turnEvent) {
    if (!creature) return;
    let reminderMessages = [];
    // Check for user-defined reminders
    const reminderText = creature.reminders ? creature.reminders[turnEvent] : '';
    if (reminderText) {
        reminderMessages.push(reminderText);
    }

    // Auto-reminder for legendary actions
    if (turnEvent === 'end' && creature.isFriendly) {
        reminderMessages.push(`Legendary Action Reminder: End of ${creature.name}'s turn.`);
    }

    // Show popup if any reminders were found
    if (reminderMessages.length > 0) {
        const message = reminderMessages.join('\n\n');
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
 * Initializes OS-level file watchers for data directories.
 * @param {object} config - Configuration object.
 */
function setupFilesystemWatchers(config) {
    const { defaultMusicPath, randomTablesPath, bestiaryPath } = config;

    // Define folders to watch and their update callbacks
    const watchers = [
        { name: 'Music', path: defaultMusicPath, callback: () => musicPlayer && musicPlayer._emitStatusUpdate() },
        { name: 'Random Tables', path: randomTablesPath, callback: () => logToRenderer("Random tables folder changed. Refreshing...") },
        { name: 'Bestiary', path: bestiaryPath, callback: () => logToRenderer("Bestiary folder changed. Refreshing...") }
    ];
    const watcherTimers = new Map();
    watchers.forEach(w => {
        // Verify path existence before watching
        if (w.path && fs.existsSync(w.path)) {
            try {
                // Watch for changes recursively
                fs.watch(w.path, { recursive: true }, (eventType, filename) => {
                    // Debounce watcher events to prevent system spam
                    const timerKey = `${w.name}:${filename}`;
                    if (watcherTimers.has(timerKey)) {
                        clearTimeout(watcherTimers.get(timerKey));
                    }

                    // Execute callback after 500ms of stability
                    const timer = setTimeout(() => {
                        logToRenderer(`[Watcher] ${w.name} change detected: ${eventType} ${filename || ''}`);
                        w.callback();
                        watcherTimers.delete(timerKey);
                    }, 500);
                    watcherTimers.set(timerKey, timer);
                });
                logToRenderer(`[Watcher] Started watching ${w.name}: ${w.path}`);
            } catch (err) {
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
async function ipcloader() {
    ipcMain.on('window-ready', () => {
        // Handle window ready if needed, or just let it be a signal
    });

    // Helper function to open a directory selection dialog
    const selectDirectory = async (title) => {
        const { filePaths } = await dialog.showOpenDialog(settingsWindow || mainWindow, {
            title,
            properties: ['openDirectory']
        });
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    };

    // IPC Handlers for individual folder browsing
    ipcMain.handle('select-bestiary-folder', () => selectDirectory('Select Bestiary Data Folder'));
    ipcMain.handle('select-random-tables-folder', () => selectDirectory('Select Random Tables Folder'));
    ipcMain.handle('select-music-folder', () => selectDirectory('Select Default Music Folder'));
    ipcMain.handle('select-ffmpeg-bin-folder', () => selectDirectory('Select Folder Containing FFmpeg and ffprobe'));

    // IPC Handler for setting up all default folders with improved error handling and OneDrive support
    ipcMain.handle('setup-default-folders', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select a Parent Directory for Tavern Tones Data',
            defaultPath: app.getPath('documents'),
            properties: ['openDirectory']
        });
        if (!filePaths || filePaths.length === 0) {
            return null; // User cancelled
        }
        const parentDir = filePaths[0];
        const dataDir = path.join(parentDir, 'Tavern Tones');
        try {
            // Ensure the main data directory exists
            if (!fs.existsSync(dataDir)) {
                await fs.promises.mkdir(dataDir, { recursive: true });
            }
            const paths = {
                bestiaryPath: path.join(dataDir, 'bestiary'),
                randomTablesPath: path.join(dataDir, 'randomtables'),
                defaultMusicPath: path.join(dataDir, 'music')
            };

            // Create all subdirectories
            for (const p of Object.values(paths)) {
                if (!fs.existsSync(p)) {
                    await fs.promises.mkdir(p, { recursive: true });
                }
            }

            // Copy default data (random tables) from the application package
            const sourcePath = app.getAppPath();
            const sourceTables = path.join(sourcePath, 'randomtables');
            if (fs.existsSync(sourceTables)) {
                // Use a more compatible copy approach if cp is missing or fails
                if (fs.promises.cp) {
                    await fs.promises.cp(sourceTables, paths.randomTablesPath, { recursive: true, force: true });
                } else {
                    // Fallback for older Node versions (shouldn't happen in recent Electron)
                    const ncp = require('util').promisify(require('fs').copyFile); // simplistic
                    // Actually, let's assume cp is available in modern Electron.
                    throw new Error("fs.promises.cp is required for folder copying.");
                }
            }
            await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Success',
                message: `Default folders created inside:\n${dataDir}\n\nYou can now fetch bestiary data from the settings.`,
                buttons: ['OK']
            });
            return paths;
        } catch (error) {
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
    ipcMain.handle('fetch-bestiary-data', async (event, { repoUrl, localPath, githubToken }) => {
        const sync = new GitHubSync(logToRenderer, dialog, mainWindow, githubToken);
        return await sync.syncBestiary(repoUrl, localPath);
    });
    ipcMain.handle('detect-ffmpeg', async () => {
        const { exec } = require('child_process');
        const isWin = process.platform === 'win32';
        const cmd = isWin ? 'where ffmpeg' : 'which ffmpeg';
        const foundPath = await new Promise(resolve => {
            exec(cmd, (error, stdout) => {
                if (!error && stdout) {
                    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                    resolve(lines[0] || null);
                } else {
                    resolve(null);
                }
            });
        });
        if (foundPath && fs.existsSync(foundPath)) return path.dirname(foundPath);

        // Check for bundled ffmpeg
        const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
        const bundledPath = path.join(process.resourcesPath, 'ffmpeg', exeName);
        if (fs.existsSync(bundledPath)) return path.dirname(bundledPath);
        const appDirFfmpeg = path.join(path.dirname(process.execPath), 'ffmpeg', exeName);
        if (fs.existsSync(appDirFfmpeg)) return path.dirname(appDirFfmpeg);

        // Check same directory as executable
        const sameDirFfmpeg = path.join(path.dirname(process.execPath), exeName);
        if (fs.existsSync(sameDirFfmpeg)) return path.dirname(sameDirFfmpeg);
        const localFfmpeg = path.join(app.getAppPath(), 'ffmpeg', exeName);
        if (fs.existsSync(localFfmpeg)) return path.dirname(localFfmpeg);
        return null;
    });


    // Settings window IPC
    ipcMain.on('get-discord-config', async (event) => {
        const config = await getDiscordConfig();
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('discord-config', config);
        }
    });
    ipcMain.on('set-discord-config', async (event, config) => {
        // Merge with existing config to prevent data loss
        const existingConfig = await getDiscordConfig();
        const mergedConfig = { ...existingConfig, ...config };
        await setDiscordConfig(mergedConfig);

        // --- Update the live configuration ---
        // The in-memory config needs to be updated to reflect the newly saved settings.
        const oldShowMediaControl = discordConfig ? discordConfig.showMediaControl : true;
        discordConfig = mergedConfig;
        invalidateMusicCache();
        if (oldShowMediaControl !== mergedConfig.showMediaControl) {
            updateDiscordMediaControl();
        }

        // The music player instance also needs to be told about the new path.
        if (musicPlayer) {
            musicPlayer.musicFolder = mergedConfig.defaultMusicPath;
            musicPlayer.ffmpegBinFolder = mergedConfig.ffmpegPath; // Note: config key remains ffmpegPath for compatibility
            logToRenderer(`[IPC] Updated music player's default folder to: ${musicPlayer.musicFolder}`);
        }
        // --- End of update ---

        // Only show dialog and close if it was sent from the settings window
        if (event.sender === (settingsWindow && settingsWindow.webContents)) {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('discord-config', mergedConfig);
            }
            if (settingsWindow) {
                settingsWindow.close();
            }
        }
    });
    ipcMain.on('open-settings-window', createSettingsWindow);
    ipcMain.on('open-walkthrough', () => {
        let walkthroughWindow = new BrowserWindow({
            width: 600,
            height: 700,
            alwaysOnTop: true,
            frame: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false // Simplified for this walkthrough window
            }
        });
        walkthroughWindow.loadFile(path.join(__dirname, '../../ui/walkthrough/walkthrough.html'));
    });
    ipcMain.handle('register-slash-commands', async () => {
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        try {
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);
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
            const guildIds = new Set();
            const channelsToTry = [discordConfig.textChannel, discordConfig.voiceChannel].filter(id => !!id);
            for (const id of channelsToTry) {
                let chan = client.channels.cache.get(id);
                if (!chan) {
                    try { chan = await client.channels.fetch(id); } catch(e) {}
                }
                if (chan && chan.guild) guildIds.add(chan.guild.id);
            }
            if (guildIds.size === 0) {
                // Fallback to global if no channels configured
                await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            } else {
                for (const guildId of guildIds) {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
                }
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
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
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            for (const guildId of guildIds) {
                await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
            }
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // logToRenderer('ipcloader() called.');
    musicPlayer.on('status-change', (status) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('music-player-status', status);
        }
    });
    musicPlayer.on('sound-finished', (slotId) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('sound-finished', slotId);
        }
    });
    initiativeTracker = new InitiativeTracker(logToRenderer, logDiceRollToRenderer, sendInitiativeUpdate, autosavePath);
    // --- All core IPC listeners should be registered after the app is ready ---

    // The 'request-initial-load' signal is sent by the UI once it has finished its
    // internal DOM setup and is ready to receive state data.
    ipcMain.on('request-initial-load', () => {
        // Sync the initiative tracker state (combatants, turns, etc.)
        if (initiativeTracker) {
            initiativeTracker.sendFullState();
        }

        // Restore the last active playlist if autosave is enabled.
        autoloadMusic();

        // Push the current connection status of the Discord bot so the UI indicators match.
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

    // Music Player IPC Handlers
    const autoloadMusic = async () => {
        if (discordConfig && discordConfig.musicAutosave && fs.existsSync(musicAutosavePath)) {
            try {
                const data = await fs.promises.readFile(musicAutosavePath, 'utf-8');
                const stack = JSON.parse(data);
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
    ipcMain.on('load-music-file', (event, filePaths) => {
        if (filePaths) {
            musicPlayer.addToStack(filePaths);
        }
    });
    ipcMain.on('play-music', async () => {
        // Intercept play requests to ensure we are connected to voice before streaming starts.
        if (voiceStatus !== 'connected') await joinVoiceChannelAction();
        musicPlayer.play();
    });
    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });
    ipcMain.on('play-next', (event) => {
        if (musicPlayer) musicPlayer.next(false, false);
    });
    ipcMain.on('play-prev', (event) => {
        if (musicPlayer) musicPlayer.prev(false);
    });
    ipcMain.on('set-loop-mode', (event, { mode }) => {
        if (musicPlayer) musicPlayer.setLoopMode(mode);
    });
    ipcMain.on('set-shuffle', (event, { enabled }) => {
        if (musicPlayer) musicPlayer.setShuffle(enabled);
    });
    ipcMain.on('remove-from-stack', (event, { index }) => {
        if (musicPlayer) musicPlayer.removeFromStack(index);
    });
    ipcMain.on('clear-stack', (event) => {
        if (musicPlayer) musicPlayer.clearStack();
    });
    ipcMain.on('jump-to-track', async (event, { index }) => {
        if (musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            musicPlayer.jumpTo(index, true);
        }
    });
    ipcMain.on('play-now', async (event, { index }) => {
        if (musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            musicPlayer.jumpTo(index, true);
        }
    });
    ipcMain.on('seek-music', (event, { time }) => {
        if (musicPlayer) {
            musicPlayer.seek(time);
        }
    });
    ipcMain.handle('save-music-preset', async (event, stack, isManual = true) => {
        // Handle background autosave requests which don't require user interaction.
        if ((!event || isManual === false || isManual === 'false') && stack) {
            try {
                await fs.promises.writeFile(musicAutosavePath, JSON.stringify(stack, null, 2));
                return { success: true };
            } catch (e) {
                console.error("Autosave failed:", e);
                return { success: false, error: e.message };
            }
        }

        // Handle manual user requests via a standard system Save dialog.
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Music Stack Preset',
            defaultPath: 'music-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (!canceled && filePath) {
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(stack, null, 2));
                // Also update autosave file if enabled
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
    ipcMain.handle('load-music-preset', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Music Stack Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });
        if (!canceled && filePaths.length > 0) {
            try {
                const data = await fs.promises.readFile(filePaths[0], 'utf-8');
                const stack = JSON.parse(data);
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
    ipcMain.handle('get-preview-audio-data', async (event, { index = -1 } = {}) => {
        let filePath;
        if (index >= 0 && index < musicPlayer.stack.length) {
            filePath = musicPlayer.stack[index];
        } else {
            filePath = musicPlayer.getPreviewFilePath();
        }
        if (!filePath) {
            return { success: false, error: 'No file available for preview.' };
        }
        // Use a more standard URL format with search params for better parsing
        const safeUrl = `safe-media://local/?path=${encodeURIComponent(filePath)}`;
        return { success: true, url: safeUrl };
    });
    ipcMain.handle('show-confirm-dialog', async (event, options) => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (!focusedWindow) return { response: options.cancelId || 1 }; // Default to cancel if no window
        return await dialog.showMessageBox(focusedWindow, options);
    });
    ipcMain.on('voice-toggle', async () => {
        if (voiceStatus === 'connected') {
            leaveVoiceChannelAction();
        } else {
            joinVoiceChannelAction();
        }
    });
    ipcMain.on('request-bot-status', () => {
        broadcastBotStatus();
    });
    ipcMain.handle('get-music-library', async () => {
        return getMusicLibrary();
    });
    ipcMain.handle('rescan-music-library', async () => {
        scanMusicLibrary();
        return { success: true };
    });
    ipcMain.handle('get-licenses', async () => {
        try {
            const licensesPath = path.join(__dirname, '../data/licenses.json');
            if (fs.existsSync(licensesPath)) {
                const licenses = JSON.parse(await fs.promises.readFile(licensesPath, 'utf8'));
                return { success: true, licenses };
            }

            // Fallback if licenses.json doesn't exist yet
            return { success: false, error: "License data not generated. Please run build." };
        } catch (e) {
            console.error("Error getting licenses:", e);
            return { success: false, error: e.message };
        }
    });
    const resolveLibraryPaths = (paths) => {
        return paths.map(p => {
            if (path.extname(p).toLowerCase() === '.lnk') {
                try {
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
    ipcMain.on('library-action', async (event, { action, paths }) => {
        if (!musicPlayer) return;
        const resolvedPaths = resolveLibraryPaths(paths);
        switch (action) {
            case 'play-now':
                // For 'play now' from library, we insert at the very top (index 0) and play.
                const currentStack = [...musicPlayer.stack];
                musicPlayer.stack = [...resolvedPaths, ...currentStack];
                if (voiceStatus !== 'connected') await joinVoiceChannelAction();
                musicPlayer.jumpTo(0, true);
                break;
            case 'add-top':
                if (musicPlayer.currentIndex === -1) {
                    // Nothing playing, add to the very top
                    musicPlayer.stack = [...resolvedPaths, ...musicPlayer.stack];
                } else {
                    // Add below the currently playing track
                    musicPlayer.stack.splice(musicPlayer.currentIndex + 1, 0, ...resolvedPaths);
                }
                musicPlayer._emitStatusUpdate();
                break;
            case 'add-bottom':
                musicPlayer.addToStack(resolvedPaths);
                break;
            case 'add-loose':
                if (!discordConfig.looseFiles) discordConfig.looseFiles = [];
                for (const p of paths) {
                    if (!discordConfig.looseFiles.includes(p)) {
                        discordConfig.looseFiles.push(p);
                    }
                }
                await setDiscordConfig(discordConfig);
                const updatedLibrary = getMusicLibrary();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('music-library-update', { library: updatedLibrary, diff: null });
                }
                break;
        }
    });
    ipcMain.handle('read-combat-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (canceled || filePaths.length === 0) {
            return null;
        }
        try {
            const content = fs.readFileSync(filePaths[0], 'utf8');
            const data = JSON.parse(content);

            // Detect Falindrith D&D Monster Maker format
            if (data.saveVersion && data.stats && data.HP) {
                const monster = data;
                const calculateModifier = (score) => Math.floor(((score || 10) - 10) / 2);
                const formatModifier = (mod) => (mod >= 0 ? `+${mod}` : `${mod}`);
                const dexMod = calculateModifier(monster.stats.DEX);
                const hpFormula = `${monster.HP.HD}d${monster.HP.type}${monster.HP.modifier >= 0 ? '+' : ''}${monster.HP.modifier}`;

                // Map Falindrith saves to TavernTones saves
                const ttSaves = {};
                const stats = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
                stats.forEach(s => {
                    const save = monster.saves[s];
                    let mod;
                    if (save.override) {
                        mod = save.overrideValue;
                    } else {
                        mod = calculateModifier(monster.stats[s]);
                        if (save.proficient) {
                            mod += (monster.proficiency || 0);
                        }
                    }
                    ttSaves[s.toLowerCase()] = formatModifier(mod);
                });
                const ttScores = {};
                stats.forEach(s => {
                    ttScores[s.toLowerCase()] = monster.stats[s];
                });
                const parseSpeed = (speedObj) => {
                    if (!speedObj) return '30ft';
                    if (typeof speedObj === 'string') {
                        const matches = speedObj.match(/(\d+)\s*ft/g);
                        if (matches) {
                            const speeds = matches.map(m => parseInt(m, 10));
                            return Math.max(...speeds) + 'ft';
                        }
                        return speedObj;
                    }
                    if (typeof speedObj === 'object') {
                        const speeds = Object.values(speedObj).filter(s => typeof s === 'number');
                        if (speeds.length > 0) return Math.max(...speeds) + 'ft';
                    }
                    return '30ft';
                };
                const ttCombatant = {
                    name: monster.name,
                    hp: hpFormula,
                    maxHp: null, // Will be rolled/parsed by addCreature
                    ac: monster.AC,
                    speed: parseSpeed(monster.speed),
                    initiative: formatModifier(dexMod),
                    scores: ttScores,
                    saves: ttSaves,
                    rawData: JSON.stringify(monster), // For the stat block view
                    conditions: [], // Falindrith 'conditions' might be immunities, safer to leave empty or parse carefully
                    deathSaves: { successes: 0, failures: 0 },
                    noDeathSaves: false
                };
                return [ttCombatant];
            }

            // Support both full save state (with initiativeOrder) or simple array
            const combatants = Array.isArray(data) ? data : (data.initiativeOrder || []);
            return combatants;
        } catch (e) {
            logToRenderer(`Error reading combat file: ${e.message}`);
            return null;
        }
    });
    const getAudioFilesRecursive = async (paths) => {
        let results = [];
        const extensions = ['.mp3', '.wav', '.ogg', '.lnk'];
        for (const p of paths) {
            try {
                const stats = await fs.promises.stat(p);
                if (stats.isDirectory()) {
                    const files = await fs.promises.readdir(p);
                    const subResults = await getAudioFilesRecursive(files.map(f => path.join(p, f)));
                    results = results.concat(subResults);
                } else {
                    if (extensions.includes(path.extname(p).toLowerCase())) {
                        results.push(p);
                    }
                }
            } catch (e) {
                console.error(`Error processing path ${p}:`, e);
            }
        }
        return results;
    };
    ipcMain.handle('open-file-dialog', async (event, options = {}) => {
        const properties = options.folders ? ['openDirectory'] : ['openFile'];
        if (options.multi) properties.push('multiSelections');
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: options.folders ? 'Select Music Folder(s)' : 'Select Music File(s)',
            defaultPath: discordConfig.defaultMusicPath,
            properties,
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });
        if (filePaths && filePaths.length > 0) {
            return await getAudioFilesRecursive(filePaths);
        }
        return [];
    });

    // --- Soundboard IPC ---
    ipcMain.handle('load-sound', async (event, { slotId, multi = false, folders = false } = {}) => {
        const properties = folders ? ['openDirectory'] : ['openFile'];
        if (multi) properties.push('multiSelections');
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: folders ? `Select Folder(s) for Slot ${slotId + 1}` : `Select Sound(s) for Slot ${slotId + 1}`,
            defaultPath: discordConfig.defaultMusicPath,
            properties,
            filters: [
                { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }
            ]
        });
        if (filePaths && filePaths.length > 0) {
            const allFiles = await getAudioFilesRecursive(filePaths);
            return allFiles.map(p => ({ path: p, name: path.basename(p) }));
        }
        return [];
    });
    ipcMain.on('play-sound', async (event, { slotId, filePath }) => {
        logToRenderer(`IPC 'play-sound' slot ${slotId}, file: ${filePath}`);
        if (filePath && musicPlayer) {
            if (voiceStatus !== 'connected') await joinVoiceChannelAction();
            musicPlayer.playSound(filePath, slotId);
            // Notify renderer of state change? 
            // The renderer usually updates its own UI state, but if we want valid feedback:
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: true });
        }
    });
    ipcMain.on('stop-sound', (event, { slotId }) => {
        logToRenderer(`IPC 'stop-sound' slot ${slotId}`);
        if (musicPlayer) {
            musicPlayer.stopSound(slotId);
            mainWindow.webContents.send('soundboard-state-change', { slotId, isPlaying: false });
        }
    });
    ipcMain.on('set-soundboard-volume', (event, { volume }) => {
        if (musicPlayer) {
            musicPlayer.setSoundboardVolume(volume);
        }
    });

    // --- Soundboard Persistence ---
    const soundboardConfigPath = path.join(app.getPath('userData'), 'soundboard.json');
    ipcMain.handle('get-soundboard-state', async () => {
        try {
            if (fs.existsSync(soundboardConfigPath)) {
                // Using promises for reading
                const data = await fs.promises.readFile(soundboardConfigPath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading soundboard config:', error);
        }
        return null;
    });
    ipcMain.on('save-soundboard-state', (event, state) => {
        try {
            fs.promises.writeFile(soundboardConfigPath, JSON.stringify(state, null, 2))
                .catch(err => console.error("Error saving soundboard:", err));
        } catch (error) {
            console.error('Error initiating save soundboard:', error);
        }
    });
    ipcMain.handle('save-soundboard-preset', async (event, state) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Soundboard Preset',
            defaultPath: 'soundboard-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (!canceled && filePath) {
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2));
                return { success: true, filePath };
            } catch (error) {
                console.error('Error saving preset:', error);
                return { success: false, error: error.message };
            }
        }
        return { canceled: true };
    });
    ipcMain.handle('get-help-content', async () => {
        const paths = [
            path.join(__dirname, '../../../docs/HELP.md'),
            path.join(app.getAppPath(), 'docs/HELP.md'),
            path.join(process.resourcesPath, 'docs/HELP.md')
        ];
        for (const helpPath of paths) {
            try {
                if (fs.existsSync(helpPath)) {
                    return await fs.promises.readFile(helpPath, 'utf-8');
                }
            } catch (e) {}
        }
        return "Help file not found. Checked: " + paths.join(', ');
    });
    ipcMain.handle('load-soundboard-preset', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Soundboard Preset',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });
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
    ipcMain.on('update-initiative', (event, { creatureId, initiative }) => {
        initiativeTracker.updateInitiative(creatureId, initiative);
    });
    ipcMain.on('push-initiative', async () => {
        const initiativeOrder = initiativeTracker.getInitiativeOrder();
        const currentTurnIndex = initiativeTracker.currentTurnIndex;

        // Guard against empty combat lists or unconfigured channels.
        if (initiativeOrder.length === 0) {
            logToRenderer('[push-initiative] Cannot push, initiative is empty.');
            return;
        }
        if (!discordConfig.textChannel) {
            logToRenderer('[push-initiative] No text channel configured.');
            return;
        }

        // Attempt to resolve the configured text channel from the Discord cache.
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-initiative] FAILED to find channel with ID: ${discordConfig.textChannel}`);
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
                // Convert numeric HP into a visual emoji-based health bar.
                const hpBar = createEmojiHpBar(creature);

                // Harvest condition emojis, capping at 3 to prevent message clutter.
                let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
                let conditionStr;
                if (conditionEmojis.length > 3) {
                    conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
                } else {
                    conditionStr = conditionEmojis.join('');
                }

                // Use a marker to highlight whose turn it currently is.
                const activeMarker = index === currentTurnIndex ? '`➤`' : '` `';

                // Handle Mob names by calculating the surviving count from remaining total HP.
                let nameStr = creature.name || '';
                if (creature.isMob) {
                    const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                    nameStr = `Mob of ${currentCount} ${creature.name}`;
                }

                // Format each line for the Discord embed.
                const line = `${activeMarker}${hpBar}${conditionStr} ${nameStr}`;
                description += line + '\n';
            });
            embed.setDescription(description);
            logToRenderer(`[push-initiative] Attempting to send embed...`);
            await channel.send({ embeds: [embed] });
            logToRenderer('[push-initiative] Successfully pushed initiative to chat.');
        } catch (error) {
            logToRenderer(`[push-initiative] FAILED to send embed: ${error}`);
        }
    });
    ipcMain.on('next-turn', async () => {
        const turnInfo = initiativeTracker.nextTurn();
        if (turnInfo) {
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            await checkAndShowReminders(turnInfo.newCreature, 'start');
        }
    });
    ipcMain.on('save-encounter', async () => {
        try {
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Encounter',
                defaultPath: app.getPath('userData'),
                filters: [{ name: 'JSON Files', extensions: ['json'] }]
            });
            if (!canceled && filePath) {
                initiativeTracker.saveEncounterToFile(filePath);
            }
        } catch (error) {
            logToRenderer(`Error saving encounter: ${error.message}`);
        }
    });
    ipcMain.handle('load-encounter-dialog', async () => {
        const confirmResult = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Confirm Load',
            message: 'Are you sure you want to load a new encounter?',
            detail: 'This will overwrite the current encounter. You may want to save your current progress first.',
            buttons: ['Load Encounter', 'Cancel'],
            defaultId: 0,
            cancelId: 1
        });
        if (confirmResult.response === 1) { // User clicked 'Cancel'
            return;
        }
        const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
            title: 'Load Encounter',
            defaultPath: app.getPath('userData'),
            properties: ['openFile'],
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        if (!canceled && filePaths && filePaths.length > 0) {
            const filePath = filePaths[0];
            initiativeTracker.loadEncounterFromFile(filePath);
        }
    });
    ipcMain.on('add-creature', (event, creature) => {
        initiativeTracker.addCreature(creature);
    });
    ipcMain.on('update-creature', (event, creature) => {
        initiativeTracker.updateCreature(creature);
    });
    ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
        initiativeTracker.updateReminders(creatureId, reminders);
    });
    ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
        const result = initiativeTracker.rollStat(creatureId, rollType, stat, type);
        if (result) {
            const { message, embed } = result;
            mainWindow.webContents.send('dice-log', message);
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
                }
            }
        }
    });
    ipcMain.on('roll-attack', (event, { creatureId, rollType, modIndex }) => {
        const result = initiativeTracker.rollAttack(creatureId, rollType, modIndex);
        if (result) {
            const { message, embed } = result;
            mainWindow.webContents.send('dice-log', message);
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) {
                    channel.send({ embeds: [embed] });
                }
            }
        }
    });
    ipcMain.on('reset-encounter', () => {
        initiativeTracker.resetEncounter();
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
            initiativeTracker.clearEncounter();
        }
    });
    ipcMain.on('edit-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.editCreature(creatureId);
        if (creature) {
            mainWindow.webContents.send('populate-edit-form', creature);
        }
    });
    ipcMain.on('remove-creature', (event, { creatureId }) => {
        initiativeTracker.removeCreature(creatureId);
    });
    ipcMain.on('copy-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
            mainWindow.webContents.send('populate-add-form', creature);
        }
    });
    ipcMain.on('previous-turn', async () => {
        const turnInfo = initiativeTracker.previousTurn();
        if (turnInfo) {
            await checkAndShowReminders(turnInfo.oldCreature, 'end');
            await checkAndShowReminders(turnInfo.newCreature, 'start');
        }
    });
    ipcMain.on('add-temp-hp', (event, { creatureId, amount }) => {
        initiativeTracker.addTempHp(creatureId, amount);
    });
    ipcMain.on('update-hp', (event, { creatureId, amount }) => {
        const result = initiativeTracker.updateHp(creatureId, amount);
        // If the creature was concentrating and took damage, trigger a UI popup reminder
        // for the Dungeon Master to roll a Concentration Check.
        if (result && result.concentrationCheckDC) {
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Concentration Check',
                message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`,
                buttons: ['OK']
            });
        }
    });
    ipcMain.on('add-condition', (event, { creatureId, condition }) => {
        logToRenderer(`Adding condition ${condition} to creature ${creatureId}`);
        initiativeTracker.addCondition(creatureId, condition);
    });
    ipcMain.on('remove-condition', (event, { creatureId, condition }) => {
        initiativeTracker.removeCondition(creatureId, condition);
    });
    ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
        initiativeTracker.updateCreatureFlag(creatureId, flag, value);
    });
    ipcMain.on('update-death-saves', (event, { creatureId, deathSaves }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
            const oldSaves = creature.deathSaves || { successes: 0, failures: 0 };
            creature.deathSaves = deathSaves;

            // Trigger popups if 3 is reached manually
            if (deathSaves.successes >= 3 && oldSaves.successes < 3) {
                dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized!`, buttons: ['OK'] });
            } else if (deathSaves.failures >= 3 && oldSaves.failures < 3) {
                dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died.`, buttons: ['OK'] });
            }
            initiativeTracker._updateFrontend();
            initiativeTracker._saveState();
        }
    });
    ipcMain.on('roll-death-save', (event, { creatureId, rollType }) => {
        // Automation for D&D 5e Death Saving Throws.
        const creature = initiativeTracker.getCreature(creatureId);
        if (!creature) return;
        if (!creature.deathSaves) creature.deathSaves = { successes: 0, failures: 0 };

        // Determine dice notation based on advantage/disadvantage toggles.
        let notation = '1d20';
        if (rollType === 'adv') notation = '2d20kh1';
        if (rollType === 'dis') notation = '2d20kl1';

        const roll = new DiceRoller().roll(notation);
        const result = roll.total;
        let outcome = null;
        let message = `${creature.name} rolled a Death Saving Throw (${rollType}): **${result}**`;

        // Apply rules for criticals, successes, and failures.
        if (result === 20) {
            message += " - **Critical Success!** (Regains 1 HP)";
            outcome = 'crit-success';
            initiativeTracker.updateHp(creatureId, 1);
        } else if (result >= 10) {
            message += " - Success";
            creature.deathSaves.successes = Math.min(3, (creature.deathSaves.successes || 0) + 1);
            if (creature.deathSaves.successes >= 3) outcome = 'stabilized';
        } else if (result === 1) {
            message += " - **Critical Failure!** (2 failures)";
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 2);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
        } else {
            message += " - Failure";
            creature.deathSaves.failures = Math.min(3, (creature.deathSaves.failures || 0) + 1);
            if (creature.deathSaves.failures >= 3) outcome = 'dead';
        }

        // Log result to UI and trigger blocking alerts for terminal states (stabilized/dead).
        logDiceRollToRenderer(message);
        if (outcome === 'crit-success') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Critical Success!', message: `${creature.name} rolled a natural 20 and regained 1 HP!`, buttons: ['OK'] });
        } else if (outcome === 'stabilized') {
            dialog.showMessageBox(mainWindow, { type: 'info', title: 'Creature Stabilized', message: `${creature.name} has stabilized with 3 successes.`, buttons: ['OK'] });
        } else if (outcome === 'dead') {
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Creature Deceased', message: `${creature.name} has died with 3 failures.`, buttons: ['OK'] });
        }

        initiativeTracker._updateFrontend();
        initiativeTracker._saveState();
    });
    ipcMain.on('show-emoji-panel', () => {
        app.showEmojiPanel();
    });
    ipcMain.handle('search-monsters', async (event, query) => {
        // Expose the 5eTools bestiary search to the UI.
        if (!fiveEToolsParser) {
            logToRenderer('[IPC] Parser not available.');
            return [];
        }
        const results = await fiveEToolsParser.searchByName('bestiary', query);
        return results;
    });
    ipcMain.handle('get-monster-details', async (event, { name, source }) => {
        logToRenderer(`[IPC] Received "get-monster-details" for: ${name} (${source})`);
        if (!fiveEToolsParser) {
            logToRenderer('[IPC] Parser not available.');
            return null;
        }
        const monster = await fiveEToolsParser.getExact('bestiary', name, source);
        logToRenderer(`[IPC] Found monster details, returning to renderer.`);
        return monster;
    });
    ipcMain.on('push-dicelog-to-discord', async (event, logContent) => {
        if (!discordConfig.textChannel) {
            logToRenderer('[push-dicelog] No text channel configured.');
            return;
        }
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) {
            logToRenderer(`[push-dicelog] FAILED to find channel with ID: ${discordConfig.textChannel}`);
            return;
        }
        try {
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Dice Rolls')
                .setDescription(logContent)
                .setTimestamp();
            await channel.send({ embeds: [embed] });
            logToRenderer('[push-dicelog] Successfully pushed dice log to chat.');
        } catch (error) {
            logToRenderer(`[push-dicelog] FAILED to send embed: ${error}`);
        }
    });
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
            const monster = JSON.parse(rawDataString);
            const { mainEmbed, longFields } = formatStatBlockForDiscord(monster);

            // Send the main embed
            const mainMessage = await channel.send({ embeds: [mainEmbed] });
            logToRenderer('[push-statblock] Successfully pushed main stat block embed.');

            // If there are long fields, create a thread and post them
            if (longFields.length > 0) {
                const thread = await mainMessage.startThread({
                    name: `${monster.name} - Details`,
                    autoArchiveDuration: 60,
                });
                for (const field of longFields) {
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
    ipcMain.on('push-mob-rules-to-discord', async (event, { creatureName, absoluteImagePath }) => {
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
            const imageBuffer = await fs.readFile(absoluteImagePath);
            logToRenderer(`[push-mob-rules] Successfully read image into buffer (${imageBuffer.length} bytes).`);
            const { mainEmbed } = formatMobRulesForDiscord(creatureName);
            await channel.send({
                embeds: [mainEmbed],
                files: [{
                    attachment: imageBuffer, // Send the buffer directly
                    name: path.basename(absoluteImagePath)
                }]
            });
            logToRenderer('[push-mob-rules] Successfully pushed mob rules embed with image buffer.');
        } catch (error) {
            logToRenderer(`[push-mob-rules] FAILED to send embed: ${error.message}`);
            logToRenderer(`[push-mob-rules] Error stack: ${error.stack}`);
            dialog.showErrorBox('Discord Error', `Failed to read image file or send to Discord. Please check the file at: ${absoluteImagePath}\n\n${error.message}`);
        }
    });
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
    const message = args.map(arg => {
        if (arg instanceof Error) return arg.stack || arg.message;
        if (typeof arg === 'object') return JSON.stringify(arg);
        return arg;
    }).join(' ');
    if (isAppReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('log-message', message);
    }
    else if (!isAppReady) {
        await sleep(100);
        logToRenderer(message);
    }
}

/*
client.on('error', error => {
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
function initializeDiscordBot() {
    if (!discordConfig || !discordConfig.token) {
        logToRenderer('Discord token not found. Bot not started.');
        return;
    }
    client.login(discordConfig.token).catch(error => {
        logToRenderer(`Discord login failed: ${error.message}`);
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
        broadcastBotStatus();
    });
}

/**
 * Broadcasts the current bot status to the renderer process.
 */
function broadcastBotStatus() {
    const status = client.isReady() ? (isSoftLocked ? 'soft-locked' : 'online') : 'offline';
    const message = isSoftLocked ? 'Busy (Occupied)' : (client.isReady() ? 'Connected' : (discordConfig.token ? 'Connecting...' : 'Not Configured'));
    const payload = {
        status,
        message,
        voiceStatus,
        isSoftLocked
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('discord-bot-status', payload);
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('discord-bot-status', payload);
    }
}
let isShuttingDown = false;
const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
        console.log('Cleaning up and exiting.');


        // Delete media control message gracefully
        if (client && client.lastMediaMessage) {
            try {
                await client.lastMediaMessage.delete().catch(() => {});
                client.lastMediaMessage = null;
            } catch (e) {
                console.error("Error deleting media control on shutdown:", e);
            }
        }

        // Remove all event listeners
        if (client) {
            client.removeAllListeners();
        }
        if (musicPlayer) {
            if (musicPlayer.player) musicPlayer.player.removeAllListeners();
            musicPlayer.destroy();
        }
        if (connection) {
            connection.removeAllListeners();
            connection.destroy();
        }

        // Optionally logout with a timeout to prevent hanging the shutdown
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
        app.exit(0);
    }
    catch (error) {
        console.log('Error during shutdown:', error);
        process.exit(1);
    }
};
app.on('before-quit', (e) => {
    if (!isShuttingDown) {
        e.preventDefault();
        shutdown();
    }
});
app.on('window-all-closed', () => {
    // Standard behavior: quit when all windows are closed,
    // unless on macOS where apps typically stay active.
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Joins a voice channel based on the configuration.
 * Implements a "knock" protocol to prevent multiple instances from joining the same channel.
 */
async function joinVoiceChannelAction() {
    if (isJoiningVoice) return;

    // Wait for client readiness if necessary
    if (!client.isReady()) {
        logToRenderer("[Discord] Client not ready for voice join.");
        return;
    }
    const isActive = connection && (
        connection.state.status !== VoiceConnectionStatus.Disconnected &&
        connection.state.status !== VoiceConnectionStatus.Destroyed
    );
    if (isActive) return;
    isJoiningVoice = true;
    isSoftLocked = false;
    const voiceChannelId = discordConfig.voiceChannel;
    if (voiceChannelId && discordConfig.textChannel) {
        let textChannel = client.channels.cache.get(discordConfig.textChannel);
        if (!textChannel) {
            try { textChannel = await client.channels.fetch(discordConfig.textChannel); } catch (e) {}
        }
        if (textChannel && textChannel.isTextBased()) {
            logToRenderer(`[Anti-Collision] Knocking on voice channel ${voiceChannelId}...`);
            const knockMsg = await textChannel.send(`||~~TT_KNOCK:${voiceChannelId}~~||`);
            setTimeout(() => knockMsg.delete().catch(() => {}), 500);

            // Wait 1 second for occupancy response
            let isOccupied = false;
            const collector = textChannel.createMessageCollector({
                filter: m => m.content.includes(`TT_OCCUPIED:${voiceChannelId}`) && m.author.id === client.user.id,
                time: 1000
            });
            await new Promise(resolve => {
                collector.on('collect', () => {
                    isOccupied = true;
                    collector.stop();
                });
                collector.on('end', resolve);
            });
            if (isOccupied) {
                logToRenderer(`[Anti-Collision] Voice channel ${voiceChannelId} is occupied. Join cancelled.`);
                isSoftLocked = true;
                isJoiningVoice = false;
                broadcastBotStatus();
                return;
            }
        }
    }
    const voiceChannel = client.channels.cache.get(voiceChannelId);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            voiceStatus = 'connecting';
            broadcastBotStatus();
            const existingConnection = getVoiceConnection(voiceChannel.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });
            connection.on(VoiceConnectionStatus.Ready, () => {
                voiceStatus = 'connected';
                broadcastBotStatus();
                logToRenderer('The bot has connected to the channel!');
                musicPlayer.setConnection(connection);
            });
            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                voiceStatus = 'connecting';
                broadcastBotStatus();
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    leaveVoiceChannelAction();
                }
            });
            connection.on(VoiceConnectionStatus.Destroyed, () => {
                voiceStatus = 'disconnected';
                broadcastBotStatus();
            });
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
 * Leaves the current voice channel and destroys the connection.
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

    /**
     * Updates the media control message in the Discord text channel.
     * @param {boolean} [disabled=false] - Whether to show the controls as disabled.
     */
    async function updateDiscordMediaControl(disabled = false) {
        if (isShuttingDown) return;

        // Delete the message if media controls are disabled in settings
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

        // Validate text channel configuration
        if (!discordConfig.textChannel) {
            logToRenderer('[Discord] No text channel configured for media controls.');
            return;
        }

        // Handle concurrent update requests
        if (isUpdatingMediaControl) {
            pendingMediaUpdate = true;
            return;
        }

        // Fetch the target Discord channel
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

        // Compile current playback status for the embed
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

        /**
         * Generates a visual progress bar string.
         */
        function createProgressString(current, total) {
            const size = 10;
            if (total <= 0) return '⬛'.repeat(size);
            const progress = Math.round((current / total) * size);
            return '🟩'.repeat(Math.min(size, progress)) + '⬛'.repeat(Math.max(0, size - progress));
        }

        /**
         * Formats seconds into MM:SS.
         */
        const formatTime = (s) => {
            const mins = Math.floor(s / 60);
            const secs = Math.floor(s % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Construct the media control embed
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
        // Cache song options for performance
        if (!cachedDiscordSongOptions) {
            cachedDiscordSongOptions = getFlatMusicList().map(p => ({
                label: path.basename(p).substring(0, 100),
                value: getSongId(p)
            }));
        }
        const songs = cachedDiscordSongOptions;

        // Calculate pagination for the song selector
        const totalPages = Math.ceil(songs.length / PAGE_SIZE);
        const start = currentDropdownPage * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageSongs = songs.slice(start, end);

        // Map song paths to selection options
        const songOptions = pageSongs.map(s => ({
            label: s.label,
            value: s.value,
            default: selectedSongInDropdown === idToSongPathMap.get(s.value)
        }));

        // Inject pagination controls into the dropdown
        if (totalPages > 1) {
            if (currentDropdownPage > 0) {
                songOptions.unshift({ label: '⬅️ Previous Page', value: 'prev_page' });
            }
            if (currentDropdownPage < totalPages - 1) {
                songOptions.push({ label: '➡️ Next Page', value: 'next_page' });
            }
        }

        // Handle empty library state
        if (songOptions.length === 0) {
            songOptions.push({ label: 'No music found', value: 'none' });
        }

        // Create the selection menu row
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
            // Edit existing message or send a new one
            if (client.lastMediaMessage) {
                await client.lastMediaMessage.edit({ embeds: [embed], components });
            } else {
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            }
        } catch (e) {
            try {
                // If edit fails (e.g. message deleted), resend
                client.lastMediaMessage = await targetChannel.send({ embeds: [embed], components });
            } catch (err) {
                logToRenderer(`Failed to send Discord media control: ${err.message}`);
            }
        } finally {
            isUpdatingMediaControl = false;
            // Execute any pending updates that arrived during processing
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


/**
 * Calculates a hex color for the HP bar based on the current health percentage.
 */
function getHpColor(current, max) {
    if (current <= 0) return '#6c757d'; // Dead
    if (current > max) return '#007bff'; // Overhealed
    const percentage = (current / max) * 100;
    if (percentage >= 100) return '#007bff'; // Blue
    if (percentage >= 50) return '#28a745'; // Green
    if (percentage >= 25) return '#ffc107'; // Yellow
    return '#dc3545'; // Red (< 25%)
}

/**
 * Dispatches a music library scan to a background worker.
 */
function scanMusicLibrary() {
    if (!discordConfig.defaultMusicPath || !fs.existsSync(discordConfig.defaultMusicPath)) {
        logToRenderer("[Library] No music folder configured or path invalid.");
        return;
    }
    logToRenderer("[Library] Scanning music folder...");
    // Spawn worker thread for disk scanning
    const worker = new Worker(path.join(__dirname, 'MusicScannerWorker.js'), {
        workerData: {
            musicFolder: discordConfig.defaultMusicPath,
            extensions: ['.mp3', '.wav', '.ogg', '.lnk']
        }
    });

    // Handle scan results
    worker.on('message', async (result) => {
        if (result.success) {
            const oldLibrary = discordConfig.musicLibrary || { children: [] };
            const newLibrary = result.library;

            // --- Calculate Diffs for UI notification ---
            const oldFiles = new Set(), newFiles = new Set(), oldFolders = new Set(), newFolders = new Set();
            const collect = (node, fileSet, folderSet) => {
                if (node.type === 'file') fileSet.add(node.path);
                else {
                    folderSet.add(node.path);
                    if (node.children) node.children.forEach(c => collect(c, fileSet, folderSet));
                }
            };
            collect(oldLibrary, oldFiles, oldFolders);
            collect(newLibrary, newFiles, newFolders);
            const addedSongs = [...newFiles].filter(f => !oldFiles.has(f)).length;
            const removedSongs = [...oldFiles].filter(f => !newFiles.has(f)).length;
            const addedFolders = [...newFolders].filter(f => !oldFolders.has(f)).length;
            const removedFolders = [...oldFolders].filter(f => !newFolders.has(f)).length;

            // Report changes to UI
            if (addedSongs > 0 || removedSongs > 0 || addedFolders > 0 || removedFolders > 0) {
                logToRenderer(`[Library] Scan complete with changes.`);
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

            // Save new library state
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
