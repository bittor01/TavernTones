// Performance and security update
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');

protocol.registerSchemesAsPrivileged([
    { scheme: 'safe-media', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

const path = require('path');
const { pathToFileURL } = require('url');
const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, Events } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.DirectMessages] });
client.npcDropdownHandlers = new Map();
console.log('Discord client instantiated.');
const axios = require('axios');
console.log('Axios loaded.');
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

let discordConfig;

let connection;
let voiceStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected'
let musicPlayer;
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
let fiveEToolsParser;


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

async function sendInitiativeUpdate(initiativeOrder, currentTurnIndex) {
    if (isAppReady && mainWindow.webContents) {
        mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
    }
    else {
        await sleep(100);
        sendInitiativeUpdate(initiativeOrder, currentTurnIndex);
    }
}

// Function to send dice roll log messages to the renderer
async function logDiceRollToRenderer(message) {
    if (isAppReady && mainWindow.webContents) {
        mainWindow.webContents.send('dice-log', message);
    } else {
        await sleep(100);
        logDiceRollToRenderer(message);
    }
}

/**
 * Broadcasts the Discord bot's status to all open windows (Main and Settings).
 * @param {string} status - 'online', 'offline', or 'connecting'.
 * @param {string} message - A descriptive status message.
 */
function broadcastBotStatus(status, message) {
    const statusObj = { status, message, voiceStatus };
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        mainWindow.webContents.send('discord-bot-status', statusObj);
    }
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents) {
        settingsWindow.webContents.send('discord-bot-status', statusObj);
    }
}

function sleep(ms) {
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
 * The main application loader. This function is responsible for initializing the application,
 * creating the main window, checking for necessary configurations, and setting up all
 * backend services and IPC handlers. It runs once the Electron app is ready.
 */
async function apploader() {
    await app.whenReady().then(async () => {
        discordConfig = await getDiscordConfig();
        protocol.handle('safe-media', async (request) => {
            try {
                const url = new URL(request.url);
                const absolutePath = url.searchParams.get('path');

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

                // Reading file into memory for the Response.
                // This is less efficient but avoids many issues with custom protocols and Range requests.
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

        // Initialize components
        musicPlayer = new BackendAudioPlayer(logToRenderer, shell, discordConfig.defaultMusicPath, discordConfig.ffmpegPath);
        ipcloader(); // Load all IPC handlers BEFORE creating window
        fiveEToolsParser = new FiveEToolsParser(logToRenderer, app, discordConfig);

        // Check for folder configuration first
        const { bestiaryPath, randomTablesPath } = discordConfig;
        const pathsConfigured = bestiaryPath && randomTablesPath;

        if (!pathsConfigured) {
            logToRenderer("Essential data folders are not configured.");
            await dialog.showMessageBox(null, {
                type: 'warning',
                title: 'Configuration Required',
                message: 'One or more essential data folders have not been set up. Please configure them in the settings.',
                buttons: ['Go to Settings']
            });
            createSettingsWindow();
            return; // Halt further initialization.
        }

        // If we've reached here, paths are configured, so we can show the main window.
        await createWindow(true);
        isAppReady = true;

        // Handle Discord Bot setup.
        if (discordConfig && discordConfig.enabled) {
            if (!discordConfig.token) {
                logToRenderer("Discord token not found despite bot being enabled. Bot functionality will be disabled.");
                broadcastBotStatus('offline', 'Not Configured');
            } else {
                initializeDiscordBot();
            }
        } else {
            logToRenderer("Discord bot is disabled in settings.");
            broadcastBotStatus('offline', 'Disabled');
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
    logToRenderer(`[IPC] Received 'get-image-as-data-url' request with relative path: ${relativePath}`);
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();
    logToRenderer(`[IPC] Determined base path: ${basePath} (isPackaged: ${app.isPackaged})`);

    const absoluteImagePath = app.isPackaged ? path.join(basePath, 'MobRules', 'MobRules.png') : path.join(basePath, relativePath);
    logToRenderer(`[IPC] Constructed absolute image path: ${absoluteImagePath}`);

    try {
        logToRenderer(`[IPC] Attempting to read file at: ${absoluteImagePath}`);
        const data = await fs.readFile(absoluteImagePath);
        const extension = path.extname(absoluteImagePath).substring(1);
        const dataUrl = `data:image/${extension};base64,${data.toString('base64')}`;
        logToRenderer(`[IPC] Successfully read and encoded image.`);
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



function createEmojiHpBar(creature) {
    const BAR_LENGTH = 8;
    const hp = creature.hp || 0;
    const maxHp = creature.maxHp || 1;
    const tempHp = creature.tempHp || 0;

    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(BAR_LENGTH); // All dead blocks
    }

    const hpBlocks = Math.round((hp / maxHp) * BAR_LENGTH);
    const tempHpBlocks = Math.min(BAR_LENGTH, Math.round((tempHp / maxHp) * BAR_LENGTH)); // Cap at bar length

    const hpColorEmoji = hpBarEmojiMap[getHpColor(hp, maxHp)] || hpBarEmojiMap['#007bff'];
    const tempHpEmoji = hpBarEmojiMap['#8a2be2'];
    const emptyEmoji = hpBarEmojiMap['empty'];

    let bar = '';
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

function formatStatBlockForDiscord(monster) {
    // Part 1: Create the main embed with core stats
    const mainEmbed = new EmbedBuilder()
        .setColor(0x0099FF);

    let description = `# ${monster.name}\n*${monster.size} ${typeof monster.type === 'object' ? monster.type.type : monster.type}, ${monster.alignment}*\n\n`;
    const ac = monster.ac.map(a => (a.ac || a) + (a.from ? ` (${a.from.join(', ')})` : '')).join(', ');
    description += `**Armor Class** ${ac}\n`;
    description += `**Hit Points** ${monster.hp.average} (${monster.hp.formula})\n`;
    description += `**Speed** ${Object.entries(monster.speed).map(([type, val]) => `${type} ${val.number || val} ft.`).join(', ')}\n\n`;

    const formatMod = (score) => {
        const mod = Math.floor(((score || 10) - 10) / 2);
        return mod >= 0 ? `+${mod}` : `${mod}`;
    };
    description += `**STR** ${monster.str} (${formatMod(monster.str)}) | **DEX** ${monster.dex} (${formatMod(monster.dex)}) | **CON** ${monster.con} (${formatMod(monster.con)})\n`;
    description += `**INT** ${monster.int} (${formatMod(monster.int)}) | **WIS** ${monster.wis} (${formatMod(monster.wis)}) | **CHA** ${monster.cha} (${formatMod(monster.cha)})`;

    mainEmbed.setDescription(description);

    // Part 2: Prepare long fields for separate messages
    const longFields = [];
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

function formatMobRulesForDiscord(creatureName) {
    const { discord: discordData, imagePath } = mobRules;

    const mainEmbed = new EmbedBuilder()
        .setColor(0xFFA500) // Orange for rules
        .setTitle(`${discordData.title}: ${creatureName}`)
        .setDescription(discordData.description)
        .addFields(...discordData.fields)
        .setImage(`attachment://${path.basename(imagePath)}`); // Set the image to be an attachment

    return { mainEmbed, imagePath };
}

function splitText(text, maxLength = 1024) {
    const chunks = [];
    if (!text) return chunks;

    let currentChunk = "";
    const lines = text.split('\n');

    for (const line of lines) {
        // If a single line is longer than the max length, split it forcefully
        if (line.length > maxLength) {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            const lineChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
            chunks.push(...lineChunks);
            continue;
        }

        // If adding the next line exceeds max length, push the current chunk
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = "";
        }

        // Add the line to the current chunk
        currentChunk += (currentChunk ? '\n' : '') + line;
    }

    // Push the last remaining chunk
    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

async function checkAndShowReminders(creature, turnEvent) {
    if (!creature) return;

    let reminderMessages = [];
    // Check for text reminders
    const reminderText = creature.reminders ? creature.reminders[turnEvent] : '';
    if (reminderText) {
        reminderMessages.push(reminderText);
    }

    // Check for legendary action reminder on turn end
    if (turnEvent === 'end' && creature.isFriendly) {
        reminderMessages.push(`Legendary Action Reminder: End of ${creature.name}'s turn.`);
    }

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
 * Registers all IPC (Inter-Process Communication) handlers for the application.
 * This function sets up listeners for events from the renderer process, allowing
 * the frontend to interact with the backend services like the file system,
 * music player, initiative tracker, and more.
 */
async function ipcloader() {
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
    ipcMain.handle('select-ffmpeg-file', async () => {
        const { filePaths } = await dialog.showOpenDialog(settingsWindow || mainWindow, {
            title: 'Select FFmpeg Executable',
            properties: ['openFile'],
            filters: [{ name: 'Executables', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }]
        });
        return filePaths && filePaths.length > 0 ? filePaths[0] : null;
    });

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
                    // stdout might contain multiple lines on Windows if multiple are found
                    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                    resolve(lines[0] || null);
                } else {
                    resolve(null);
                }
            });
        });

        if (foundPath && fs.existsSync(foundPath)) return foundPath;

        // Fallback to checking if "ffmpeg" just works, though we prefer the full path
        const checkFfmpeg = (cmd) => new Promise(resolve => {
            exec(`${cmd} -version`, (error) => resolve(!error));
        });

        if (await checkFfmpeg('ffmpeg')) return 'ffmpeg';

        // Check for bundled ffmpeg
        const exeName = isWin ? 'ffmpeg.exe' : 'ffmpeg';
        const bundledPath = path.join(process.resourcesPath, 'ffmpeg', exeName);
        if (fs.existsSync(bundledPath)) return bundledPath;

        const appDirFfmpeg = path.join(path.dirname(process.execPath), 'ffmpeg', exeName);
        if (fs.existsSync(appDirFfmpeg)) return appDirFfmpeg;

        // Check same directory as executable
        const sameDirFfmpeg = path.join(path.dirname(process.execPath), exeName);
        if (fs.existsSync(sameDirFfmpeg)) return sameDirFfmpeg;

        const localFfmpeg = path.join(app.getAppPath(), 'ffmpeg', exeName);
        if (fs.existsSync(localFfmpeg)) return localFfmpeg;

        return null;
    });


    // Settings window IPC
    ipcMain.on('get-discord-config', async (event) => {
        event.sender.send('discord-config', await getDiscordConfig());
    });

    ipcMain.on('set-discord-config', async (event, config) => {
        await setDiscordConfig(config);

        // --- Update the live configuration ---
        // The in-memory config needs to be updated to reflect the newly saved settings.
        discordConfig = config;
        // The music player instance also needs to be told about the new path.
        if (musicPlayer) {
            musicPlayer.musicFolder = config.defaultMusicPath;
            musicPlayer.ffmpegPath = config.ffmpegPath;
            logToRenderer(`[IPC] Updated music player's default folder to: ${musicPlayer.musicFolder}`);
        }
        // --- End of update ---

        await dialog.showMessageBox(null, {
            type: 'info',
            title: 'Settings Saved',
            message: 'Your settings have been saved. Please close and reopen the application to apply all changes.',
            buttons: ['OK']
        });
        // Close the settings window after saving
        if (settingsWindow) {
            settingsWindow.close();
        }
    });

    ipcMain.on('open-settings-window', createSettingsWindow);

    ipcMain.handle('register-slash-commands', async () => {
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        if (!client.user) return { success: false, error: 'Bot is not logged in. Please ensure the bot is online before registering commands.' };

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
                    description: 'Play music (requires loaded stack)'
                },
                {
                    name: 'play-song',
                    description: 'Search and play a specific song',
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
                },
                {
                    name: 'add-song',
                    description: 'Search and add a song to the stack',
                    options: [{ name: 'query', type: 3, description: 'Song name', required: true }]
                },
                {
                    name: 'play-folder',
                    description: 'Play a random song from a folder',
                    options: [{ name: 'query', type: 3, description: 'Folder name', required: true }]
                },
                {
                    name: 'add-folder',
                    description: 'Add all songs from a folder to the stack',
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

            let guildId = null;
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) guildId = channel.guild.id;
            }
            if (!guildId && discordConfig.voiceChannel) {
                const channel = client.channels.cache.get(discordConfig.voiceChannel);
                if (channel) guildId = channel.guild.id;
            }

            if (!guildId) {
                return { success: false, error: 'Could not determine Guild ID. Please ensure the bot is in a voice or text channel configured in settings.' };
            }

            logToRenderer(`Registering Guild Commands for Guild ID: ${guildId}`);
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('unregister-slash-commands', async () => {
        if (!discordConfig.token) return { success: false, error: 'No bot token' };
        if (!client.user) return { success: false, error: 'Bot is not logged in.' };

        try {
            const rest = new REST({ version: '10' }).setToken(discordConfig.token);

            let guildId = null;
            if (discordConfig.textChannel) {
                const channel = client.channels.cache.get(discordConfig.textChannel);
                if (channel) guildId = channel.guild.id;
            }
            if (!guildId && discordConfig.voiceChannel) {
                const channel = client.channels.cache.get(discordConfig.voiceChannel);
                if (channel) guildId = channel.guild.id;
            }

            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
            }
            // Also clear global just in case
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });

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
    ipcMain.on('request-initial-load', () => {
        if (initiativeTracker) {
            initiativeTracker.sendFullState();
        }
        if (discordConfig && discordConfig.enabled) {
            if (client && client.isReady()) {
                broadcastBotStatus('online', 'Connected');
            } else if (!discordConfig.token) {
                broadcastBotStatus('offline', 'Not Configured');
            } else {
                broadcastBotStatus('offline', 'Connecting...');
            }
        } else {
            broadcastBotStatus('offline', 'Disabled');
        }
    });

    ipcMain.on('request-bot-status', () => {
        if (discordConfig && discordConfig.enabled) {
            if (client && client.isReady()) {
                broadcastBotStatus('online', 'Connected');
            } else if (!discordConfig.token) {
                broadcastBotStatus('offline', 'Not Configured');
            } else {
                broadcastBotStatus('offline', 'Connecting...');
            }
        } else {
            broadcastBotStatus('offline', 'Disabled');
        }
    });

    // Music Player IPC Handlers
    ipcMain.on('load-music-file', (event, filePaths) => {
        if (filePaths) {
            musicPlayer.addToStack(filePaths);
        }
    });

    ipcMain.on('play-music', () => {
        logToRenderer(`IPC 'play-music' (command) received.`);
        if (!musicPlayer.ffmpegPath) {
            dialog.showErrorBox('FFmpeg Not Configured', 'Please configure the FFmpeg path in settings to play music.');
            return;
        }
        if (voiceStatus !== 'connected') {
            joinVoiceChannelAction();
        }
        musicPlayer.play();
    });

    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });

    ipcMain.on('play-next', (event) => {
        if (musicPlayer) musicPlayer.next();
    });

    ipcMain.on('play-prev', (event) => {
        if (musicPlayer) musicPlayer.prev();
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

    ipcMain.handle('save-music-preset', async (event, stack) => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Music Stack Preset',
            defaultPath: 'music-preset.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (!canceled && filePath) {
            try {
                await fs.promises.writeFile(filePath, JSON.stringify(stack, null, 2));
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
        const properties = ['openFile', 'openDirectory'];
        if (options.multi) properties.push('multiSelections');

        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Music File(s) or Folder(s)',
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
    ipcMain.handle('load-sound', async (event, { slotId, multi = false } = {}) => {
        const properties = ['openFile', 'openDirectory'];
        if (multi) properties.push('multiSelections');

        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: `Select Sound(s) or Folder(s) for Slot ${slotId + 1}`,
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

    ipcMain.on('play-sound', (event, { slotId }) => {
        // We need the renderer to tell us WHAT file to play, or we store it in backend.
        // The renderer state seems to hold the file path, so it should send it, 
        // OR the renderer sends "play slot X" and the backend looks up what slot X is.
        // But currently main.js doesn't store soundboard state. 
        // The renderer calls 'play-sound' with { slotId }... wait.
        // My implementation plan said: "Trigger BackendAudioPlayer.playSound(file)".
        // BUT the renderer's `play-sound` event in the *existing code (renderer.js)* 
        // implies it might send just ID? 
        // Let's check renderer.js again.
        // Actually I haven't written the renderer code yet, but the *existing* placeholder code in renderer.js:
        // window.electron.ipcRenderer.send('play-sound', { slotId });
        // It doesn't send the file path. Ideally the backend should know, OR the renderer should send it.
        // To keep backend stateless regarding UI config if possible, I'll update renderer to send the path always.
        // Updating `main.js` to expect `filePath` in the payload.
    });

    // Redoing the above block properly:
    ipcMain.on('play-sound', (event, { slotId, filePath }) => {
        logToRenderer(`IPC 'play-sound' slot ${slotId}, file: ${filePath}`);
        if (filePath && musicPlayer) {
            if (!musicPlayer.ffmpegPath) {
                dialog.showErrorBox('FFmpeg Not Configured', 'Please configure the FFmpeg path in settings to use the soundboard.');
                return;
            }
            if (voiceStatus !== 'connected') {
                joinVoiceChannelAction();
            }
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
        logToRenderer(`'push-initiative-to-chat' invoked.`);
        const initiativeOrder = initiativeTracker.getInitiativeOrder();
        const currentTurnIndex = initiativeTracker.currentTurnIndex;
        if (initiativeOrder.length === 0) {
            logToRenderer('[push-initiative] Cannot push, initiative is empty.');
            return;
        }

        if (!discordConfig.textChannel) {
            logToRenderer('[push-initiative] No text channel configured.');
            return;
        }

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
                const hpBar = createEmojiHpBar(creature);

                let conditionEmojis = (creature.conditions || []).map(c => DND_CONDITIONS[c]?.emoji || '');
                let conditionStr;
                if (conditionEmojis.length > 3) {
                    conditionStr = conditionEmojis.slice(0, 3).join('') + '♾️';
                } else {
                    conditionStr = conditionEmojis.join('');
                }

                const activeMarker = index === currentTurnIndex ? '`➤`' : '` `';
                const initiativeStr = creature.initiative.toString();
                let nameStr = creature.name || '';
                if (creature.isMob) {
                    const currentCount = (creature.singleCreatureHP > 0) ? Math.ceil(creature.hp / creature.singleCreatureHP) : 0;
                    nameStr = `Mob of ${currentCount} ${creature.name}`;
                }

                // New layout: Init | HP Bar | Name | Conditions
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

    ipcMain.on('copy-creature', (event, { creatureId }) => {
        const creature = initiativeTracker.getCreature(creatureId);
        if (creature) {
            // When copying, we want to populate the "Add" form, not the "Edit" form.
            // We give it a new ID to ensure it's a distinct creature.
            const newCreature = { ...creature, id: Date.now() };
            mainWindow.webContents.send('populate-add-form', newCreature);
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

    ipcMain.on('roll-attack', (event, { creatureId, rollType }) => {
        const result = initiativeTracker.rollAttack(creatureId, rollType);
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
        if (result && result.concentrationCheckDC) {
            dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`, buttons: ['OK'] });
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

    ipcMain.handle('search-monsters', async (event, query) => {
        logToRenderer(`[IPC] Received "search-monsters" with query: "${query}"`);
        if (!fiveEToolsParser) {
            logToRenderer('[IPC] Parser not available.');
            return [];
        }
        const results = await fiveEToolsParser.searchByName('bestiary', query);
        logToRenderer(`[IPC] Found ${results.length} monsters, returning to renderer.`);
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
function initializeDiscordBot() {
    if (!discordConfig || !discordConfig.token) {
        logToRenderer('Discord token not found. Bot not started.');
        return;
    }

    client.login(discordConfig.token).catch(error => {
        logToRenderer(`Discord login failed: ${error.message}`);
        broadcastBotStatus('offline', `Login Failed: ${error.message}`);
        dialog.showErrorBox('Discord Login Failed', `Could not log in to Discord. Please check your token in the settings.\n\n${error.message}`);
    });
}

let isShuttingDown = false;
const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
        console.log('Cleaning up and exiting.');
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
 * Joins the configured Discord voice channel.
 */
function joinVoiceChannelAction() {
    if (!client.isReady()) return;
    const voiceChannel = client.channels.cache.get(discordConfig.voiceChannel);
    if (voiceChannel && voiceChannel.isVoiceBased()) {
        try {
            const { getVoiceConnection } = require('@discordjs/voice');
            const existingConnection = getVoiceConnection(voiceChannel.guild.id);
            if (existingConnection) {
                existingConnection.destroy();
            }

            voiceStatus = 'connecting';
            broadcastBotStatus('online', 'Connected');

            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: voiceChannel.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                logToRenderer('The bot has connected to the channel!');
                voiceStatus = 'connected';
                broadcastBotStatus('online', 'Connected');
                musicPlayer.setConnection(connection);
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                voiceStatus = 'connecting';
                broadcastBotStatus('online', 'Connected');
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    voiceStatus = 'disconnected';
                    broadcastBotStatus('online', 'Connected');
                    connection.destroy();
                }
            });

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                voiceStatus = 'disconnected';
                broadcastBotStatus('online', 'Connected');
            });

        } catch (error) {
            logToRenderer('Error joining voice channel: ' + error.message);
            voiceStatus = 'disconnected';
            broadcastBotStatus('online', 'Connected');
        }
    }
}

/**
 * Leaves the Discord voice channel.
 */
function leaveVoiceChannelAction() {
    if (connection) {
        connection.removeAllListeners();
        connection.destroy();
        connection = null;
    }
    voiceStatus = 'disconnected';
    broadcastBotStatus('online', 'Connected');
}

ipcMain.on('voice-toggle', () => {
    if (voiceStatus === 'connected' || voiceStatus === 'connecting') {
        leaveVoiceChannelAction();
    } else {
        joinVoiceChannelAction();
    }
});

client.once(Events.ClientReady, async () => {
    logToRenderer('TavernTones is online!');
    broadcastBotStatus('online', 'Connected');

    logToRenderer(`Logged in as ${client.user.tag}`);

    const basePath = app.isPackaged
        ? path.dirname(app.getPath('exe'))
        : app.getAppPath();
    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, discordConfig, fiveEToolsParser);
    client.commandHandler = commandHandler; // Attach commandHandler to the client object
    client.on('messageCreate', message => commandHandler.handleMessage(message));

    let lastMediaMessage = null;
    let selectedSongInDropdown = null;

    async function updateDiscordMediaControl() {
        if (!discordConfig.textChannel) return;
        const channel = client.channels.cache.get(discordConfig.textChannel);
        if (!channel) return;

        const status = {
            isPlaying: musicPlayer.isPlaying,
            stack: musicPlayer.stack,
            currentIndex: musicPlayer.currentIndex,
            loopMode: musicPlayer.loopMode,
            shuffleMode: musicPlayer.shuffleMode
        };

        const currentTrack = status.currentIndex >= 0 ? status.stack[status.currentIndex] : null;
        const trackName = currentTrack ? path.basename(currentTrack, path.extname(currentTrack)) : "None";

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎵 TavernTones Media Control')
            .setDescription(`**Now Playing:** ${trackName}\n**Stack size:** ${status.stack.length}`)
            .setFooter({ text: `Loop: ${['None', 'All', 'Single'][status.loopMode]} | Shuffle: ${status.shuffleMode ? 'On' : 'Off'}` });

        const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        // Row 1: Song Selector Dropdown
        const songOptions = status.stack.slice(0, 20).map((p, i) => ({
            label: path.basename(p, path.extname(p)),
            value: i.toString(),
            default: i === status.currentIndex
        }));

        if (songOptions.length === 0) {
            songOptions.push({ label: "No songs loaded", value: "none" });
        }

        const songSelector = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('media-song-select')
                .setPlaceholder('Select a song from the stack...')
                .addOptions(songOptions)
                .setDisabled(status.stack.length === 0)
        );

        // Row 2: Selected Song Actions
        const selectionActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('media-play-next').setLabel('⬆️ Play Next').setStyle(ButtonStyle.Secondary).setDisabled(!selectedSongInDropdown),
            new ButtonBuilder().setCustomId('media-play-now').setLabel('▶️ Play Now').setStyle(ButtonStyle.Primary).setDisabled(!selectedSongInDropdown),
            new ButtonBuilder().setCustomId('media-remove').setLabel('❌ Remove').setStyle(ButtonStyle.Danger).setDisabled(!selectedSongInDropdown)
        );

        // Row 3: Playback Controls
        const playbackControls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('media-prev').setLabel('⏮️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('media-play-pause').setLabel(status.isPlaying ? '⏸️' : '▶️').setStyle(status.isPlaying ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('media-next').setLabel('⏭️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('media-loop').setLabel('🔁').setStyle(status.loopMode > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('media-shuffle').setLabel('🔀').setStyle(status.shuffleMode ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

        const components = [songSelector, selectionActions, playbackControls];

        try {
            if (lastMediaMessage) {
                await lastMediaMessage.edit({ embeds: [embed], components });
            } else {
                lastMediaMessage = await channel.send({ embeds: [embed], components });
            }
        } catch (e) {
            lastMediaMessage = null;
            updateDiscordMediaControl();
        }
    }

    musicPlayer.on('status-change', () => {
        updateDiscordMediaControl();
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
                if (musicPlayer.stack.length === 0) {
                    return await interaction.reply({ content: "No music in stack. Use /play-song or /play-folder first.", ephemeral: true });
                }
                if (voiceStatus !== 'connected') joinVoiceChannelAction();
                musicPlayer.play();
                await interaction.reply({ content: 'Playing...', ephemeral: true });
                updateDiscordMediaControl();
            } else if (commandName === 'play-song') {
                const query = options.getString('query');
                const match = await client.commandHandler.findMusic(query);
                if (match) {
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(match);
                    if (voiceStatus !== 'connected') joinVoiceChannelAction();
                    musicPlayer.play();
                    await interaction.reply({ content: `Playing: **${path.parse(match).name}**` });
                } else {
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
                }
            } else if (commandName === 'add-song') {
                const query = options.getString('query');
                const match = await client.commandHandler.findMusic(query);
                if (match) {
                    await musicPlayer.addToStack(match);
                    await interaction.reply({ content: `Added: **${path.parse(match).name}**` });
                } else {
                    await interaction.reply({ content: "Could not find that song.", ephemeral: true });
                }
            } else if (commandName === 'play-folder') {
                const query = options.getString('query');
                const match = await client.commandHandler.findMusic(query); // findMusic picks a random song if it's a folder
                if (match) {
                    musicPlayer.clearStack();
                    await musicPlayer.addToStack(match);
                    if (voiceStatus !== 'connected') joinVoiceChannelAction();
                    musicPlayer.play();
                    await interaction.reply({ content: `Playing random song from folder: **${path.parse(match).name}**` });
                } else {
                    await interaction.reply({ content: "Could not find that folder or it's empty.", ephemeral: true });
                }
            } else if (commandName === 'add-folder') {
                const query = options.getString('query');
                const folder = client.commandHandler.findFolder(query);
                if (folder) {
                    const songs = client.commandHandler.getFolderSongs(folder);
                    if (songs.length > 0) {
                        await musicPlayer.addToStack(songs);
                        await interaction.reply({ content: `Added ${songs.length} songs from folder: **${path.basename(folder)}**` });
                    } else {
                        await interaction.reply({ content: "Folder is empty.", ephemeral: true });
                    }
                } else {
                    await interaction.reply({ content: "Could not find that folder.", ephemeral: true });
                }
            } else if (commandName === 'pause') {
                musicPlayer.pause();
                await interaction.reply({ content: 'Paused.', ephemeral: true });
                updateDiscordMediaControl();
            } else if (commandName === 'stop') {
                musicPlayer.stop();
                musicPlayer.clearStack();
                await interaction.reply('Stopped and cleared stack.');
                updateDiscordMediaControl();
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

        if (interaction.isButton()) {
            const { customId } = interaction;
            await interaction.deferUpdate();

            if (customId === 'media-prev') musicPlayer.prev();
            else if (customId === 'media-next') musicPlayer.next();
            else if (customId === 'media-play-pause') {
                if (musicPlayer.isPlaying) musicPlayer.pause();
                else {
                    if (voiceStatus !== 'connected') joinVoiceChannelAction();
                    musicPlayer.play();
                }
            }
            else if (customId === 'media-loop') musicPlayer.setLoopMode((musicPlayer.loopMode + 1) % 3);
            else if (customId === 'media-shuffle') musicPlayer.setShuffle(!musicPlayer.shuffleMode);
            else if (customId === 'media-play-now') {
                if (selectedSongInDropdown !== null) {
                    musicPlayer.currentIndex = selectedSongInDropdown;
                    if (voiceStatus !== 'connected') joinVoiceChannelAction();
                    musicPlayer.play();
                }
            }
            else if (customId === 'media-play-next') {
                if (selectedSongInDropdown !== null) {
                    const song = musicPlayer.stack.splice(selectedSongInDropdown, 1)[0];
                    const insertIndex = musicPlayer.currentIndex === -1 ? 0 : musicPlayer.currentIndex + 1;
                    musicPlayer.stack.splice(insertIndex, 0, song);
                    selectedSongInDropdown = null;
                }
            }
            else if (customId === 'media-remove') {
                if (selectedSongInDropdown !== null) {
                    musicPlayer.removeFromStack(selectedSongInDropdown);
                    selectedSongInDropdown = null;
                }
            }

            updateDiscordMediaControl();
            return;
        }

        if (interaction.isStringSelectMenu()) {
            const { customId, values } = interaction;

            if (customId === 'media-song-select') {
                selectedSongInDropdown = parseInt(values[0]);
                await interaction.deferUpdate();
                updateDiscordMediaControl();
                return;
            }

            if (customId === '5e-result-select') {
                await interaction.deferUpdate();
                const [category, source, name] = values[0].split('__');

                const item = await fiveEToolsParser.getExact(category, name, source);

                if (item) {
                    const embed = format5eResult(item);
                    await interaction.editReply({ embeds: [embed], components: [] }); // Remove the dropdown
                } else {
                    await interaction.editReply({ content: 'Sorry, I couldn\'t retrieve the details for that item.', components: [] });
                }
                return; // Stop further processing for this interaction
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