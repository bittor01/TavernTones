require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
console.log('Main.js script started');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
console.log('Electron loaded.');
const fs = require('fs');
const path = require('path');
console.log('FS and Path loaded.');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
console.log('DiceRoller loaded.');
const { Client, GatewayIntentBits, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
console.log('Discord.js Client loaded.');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
console.log('Discord.js Voice loaded.');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });
console.log('Discord client instantiated.');
const axios = require('axios');
console.log('Axios loaded.');
const BackendAudioPlayer = require('./BackendAudioPlayer.js');
const CommandHandler = require('./CommandHandler.js');
const MagicItemGenerator = require('./MagicItemGenerator.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Use the token from environment variables
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const BOT_ROLE_ID = process.env.BOT_ROLE_ID;
const DEFAULT_LOCAL_FOLDER = process.env.DEFAULT_LOCAL_FOLDER;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;
let connection;
let musicPlayer;
let lastResponse = null; // Variable to store the last response
let isAppReady = false; // Flag to indicate if the app is ready
let initiativeTracker;
const maSelections = new Map();


// --- State Management ---
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
    "Paralyzed": { emoji: "⚡", color: "#007bff", text: "You are Incapacitated and can't move or speak. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Petrified": { emoji: "🪨", color: "#343a40", text: "You have the Incapacitated condition. Your Speed is 0 and can't increase. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Poisoned": { emoji: "🤢", color: "#28a745", text: "You have Disadvantage on attack rolls and ability checks." },
    "Prone": { emoji: "🛌", color: "#ffc107", text: "Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage." },
    "Restrained": { emoji: "⛓️", color: "#6c757d", text: "Your speed becomes 0, and you can't benefit from any bonus to your speed. Attack rolls against you have Advantage, and your attack rolls have Disadvantage. You have Disadvantage on Dexterity saving throws." },
    "Stunned": { emoji: "😵‍💫", color: "#ffc107", text: "You are Incapacitated, can't move, and can speak only falteringly. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.)" },
    "Unconscious": { emoji: "😴", color: "#343a40", text: "You are Incapacitated, can't move or speak, and are unaware of your surroundings. You drop whatever you're holding and fall prone. You automatically fail Strength and Dexterity saving throws. Attack rolls against you have Advantage. Any attack that hits you is a critical hit if the attacker is within 5 feet of you. (Incapacitated: You can't take actions or reactions. Your Concentration in broken. You can't speak.) (Prone: Your only movement option is to crawl, unless you stand up and thereby end the condition. You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.)" }
};

const hpBarEmojiMap = {
    '#007bff': ':blue_square:',      // Blue
    '#28a745': ':green_square:',     // Green
    '#ffc107': ':yellow_square:',    // Yellow
    '#dc3545': ':red_square:',       // Red
    '#8a2be2': ':purple_square:',    // Purple
    '#6c757d': ':x:',               // Grey (Dead)
    'empty': ':black_large_square:'
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



function createEmojiHpBar(creature) {
    let hp = creature.hp || 0;
    let maxHp = creature.maxHp || 1;
    let temphp = creature.tempHp || 0;

    if (hp <= 0) {
        return hpBarEmojiMap['#6c757d'].repeat(8);
    }

    let color = getHpColor(hp, maxHp);
    if (temphp > 0 || hp > maxHp) {
        color = '#8a2be2'; // Purple for temp HP
    }

    if (hp > maxHp) {
        hp = maxHp;
    }

    const emoji = hpBarEmojiMap[color] || hpBarEmojiMap['#007bff'];
    const percentage = Math.max(0, (hp / maxHp));

    const filledBlocks = Math.round(percentage * 8);
    const emptyBlocks = 8 - filledBlocks;

    return emoji.repeat(filledBlocks) + hpBarEmojiMap['empty'].repeat(emptyBlocks);
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

const InitiativeTracker = require('./InitiativeTracker.js');

async function ipcloader() {
    if (windowloaded) {
        logToRenderer('ipcloader() called.');
        initiativeTracker = new InitiativeTracker(logToRenderer, sendInitiativeUpdate, autosavePath);
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
                mainWindow.webContents.send('populate-edit-form', creature);
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
            const rollLogMessage = initiativeTracker.addCreature(creature);
            if (rollLogMessage) {
                mainWindow.webContents.send('dice-log', rollLogMessage);
            }
        });

        ipcMain.on('update-reminders', (event, { creatureId, reminders }) => {
            initiativeTracker.updateReminders(creatureId, reminders);
        });

        ipcMain.on('roll-stat', (event, { creatureId, rollType, stat, type }) => {
            const message = initiativeTracker.rollStat(creatureId, rollType, stat, type);
            if (message) {
                mainWindow.webContents.send('dice-log', message);
                const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
                if (channel) {
                    channel.send(message);
                }
            }
        });

        ipcMain.on('roll-attack', (event, { creatureId, rollType }) => {
            const message = initiativeTracker.rollAttack(creatureId, rollType);
            if (message) {
                mainWindow.webContents.send('dice-log', message);
                const channel = client.channels.cache.get(TEXT_CHANNEL_ID);
                if (channel) {
                    channel.send(message);
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
                dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${result.creature.name} must make a DC ${result.concentrationCheckDC} Constitution saving throw.`, buttons: ['OK']});
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
musicPlayer = new BackendAudioPlayer(logToRenderer, shell);
musicPlayer.on('status-change', (status) => {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('music-player-status', status);
    }
});

/*
client.on('error', error => {
    logToRenderer('An error occurred: ', error);
});
*/

client.once('clientReady', async () => {
    const shutdown = async () => {
        try {
            console.log('Cleaning up and exiting.');
            // Remove all event listeners
            client.removeAllListeners();
            if (musicPlayer && musicPlayer.player) {
                musicPlayer.player.removeAllListeners();
            }
            if (connection) {
                connection.removeAllListeners();
            }
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
                musicPlayer.setConnection(connection); // Pass connection to the player
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                logToRenderer('The bot has been disconnected. Attempting to reconnect...');
                setTimeout(() => {
                    joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: voiceChannel.guild.id,
                        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    });
                }, 5000);
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
        }
        catch (error) {
            logToRenderer('Error joining voice channel: ', error);
        }
    }
    else {
        logToRenderer('Voice channel not found or is not a voice channel!');
    }

    // Simplified IPC Handlers
    ipcMain.on('play-music', (event, filePathFromRenderer) => {
        logToRenderer(`IPC 'play-music' received for: ${filePathFromRenderer || 'current track'}`);
        musicPlayer.playFile(filePathFromRenderer);
    });

    ipcMain.on('pause-music', () => {
        logToRenderer(`IPC 'pause-music' received.`);
        musicPlayer.pause();
    });

    logToRenderer(`Logged in as ${client.user.tag}`);

    const commandHandler = new CommandHandler(client, logToRenderer, musicPlayer, { BOT_ROLE_ID, DEFAULT_LOCAL_FOLDER });
    client.on('messageCreate', message => commandHandler.handleMessage(message));

    client.on('interactionCreate', async interaction => {
        if (interaction.isStringSelectMenu()) {
            const { customId, values, message } = interaction;
            const [prefix, selectType] = customId.split('-');

            if (prefix === 'ma') {
                const selections = maSelections.get(message.id) || { mode: 'loot', size: 'Average' };
                selections[selectType] = values[0];
                maSelections.set(message.id, selections);

                await interaction.deferUpdate();
            }
            return;
        }

        if (interaction.isButton() && interaction.customId === 'ma-configure-button') {
            const modal = new ModalBuilder()
                .setCustomId(`ma-config-modal-${interaction.message.id}`)
                .setTitle('Configure Magic Item Generation');

            const nicknameInput = new TextInputBuilder()
                .setCustomId('ma-nickname-input')
                .setLabel("Nickname (Optional)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const numRollsInput = new TextInputBuilder()
                .setCustomId('ma-numrolls-input')
                .setLabel("Number of Items (e.g., 5 or 1d4+1)")
                .setStyle(TextInputStyle.Short)
                .setValue('10')
                .setRequired(true);

            const partyLevelInput = new TextInputBuilder()
                .setCustomId('ma-partylevel-input')
                .setLabel("Average Party Level")
                .setStyle(TextInputStyle.Short)
                .setValue('20')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nicknameInput),
                new ActionRowBuilder().addComponents(numRollsInput),
                new ActionRowBuilder().addComponents(partyLevelInput)
            );

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit()) {
            const [prefix, context, messageId] = interaction.customId.split('-');

            if (prefix === 'ma' && context === 'config' && messageId) {
                await interaction.deferReply({ ephemeral: true });

                let selections = maSelections.get(messageId);
                if (!selections) {
                    try {
                        const originalMessage = await interaction.channel.messages.fetch(messageId);
                        const mode = originalMessage.components[0].components[0].options.find(o => o.default).value;
                        const size = originalMessage.components[1].components[0].options.find(o => o.default).value;
                        selections = { mode, size };
                    } catch (error) {
                        console.error("Failed to fetch original message for selections:", error);
                        selections = { mode: 'loot', size: 'Average' }; // Fallback
                    }
                }

                const nickname = interaction.fields.getTextInputValue('ma-nickname-input');
                const numRolls = interaction.fields.getTextInputValue('ma-numrolls-input');
                const partyLevel = parseInt(interaction.fields.getTextInputValue('ma-partylevel-input'), 10);

                const generator = new MagicItemGenerator({ ...selections, numRolls, partyLevel, nickname });
                const results = generator.generate();

                const threadName = nickname || `Magic Items - ${new Date().toLocaleString()}`;
                const thread = await interaction.channel.threads.create({
                    name: threadName,
                    autoArchiveDuration: 60,
                    startMessage: interaction.message,
                });

                // Hit/Miss Grid
                const { itemTypes } = require('./MagicItemData.js');
                const gridLabelMap = {
                    "Reusable Item (Gizmo)": "Giz",
                    "Single-use Scroll/Tablet": "ScT",
                    "Glyph/Ward/Trap": "GWT",
                    "Enchanted Ammunition": "Amm",
                    "Potion": "Pot",
                    "Poison, Ingested": "Ing",
                    "Poison, Inhaled": "Inh",
                    "Poison, Contact": "Con",
                    "Poison, Injury": "Inj"
                };
                let hitMissGrid = '## Hit/Miss Grid\n`Lvl:  0  1  2  3  4  5  6  7  8  9`\n';
                const hitSet = new Set(results.hits.map(h => `${h.itemType}-${h.level}`));
                itemTypes.forEach(type => {
                    let line = `**${gridLabelMap[type] || type.substring(0, 3)}**:`;
                    for (let i = 0; i < 10; i++) {
                        line += hitSet.has(`${type}-${i}`) ? ' ✅' : ' ❌';
                    }
                    hitMissGrid += line + '\n';
                });
                await thread.send(hitMissGrid);

                // Generated Items
                if (results.items.length > 0) {
                    const groupedItems = results.items.reduce((acc, item) => {
                        if (!acc[item.itemType]) {
                            acc[item.itemType] = [];
                        }
                        acc[item.itemType].push(item);
                        return acc;
                    }, {});

                    let itemsMessage = '## Generated Items\n';
                    for (const itemType in groupedItems) {
                        itemsMessage += `### ${itemType}\n`;
                        for (const item of groupedItems[itemType]) {
                            let line = `**Lvl ${item.level}**: ${item.spellName}`;
                            if (item.price !== null) {
                                line += ` - *${item.price} gp*`;
                            }

                            if ((itemsMessage + line + '\n').length > 2000) {
                                await thread.send(itemsMessage);
                                itemsMessage = '';
                            }
                            itemsMessage += line + '\n';
                        }
                    }
                    if (itemsMessage.length > '## Generated Items\n'.length) {
                        await thread.send(itemsMessage);
                    }
                } else {
                    await thread.send("No items were generated based on the rolls.");
                }

                maSelections.delete(messageId);
                await interaction.editReply({ content: `Magic items generated in thread: <#${thread.id}>`, ephemeral: true });
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