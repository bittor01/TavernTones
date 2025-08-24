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

// Function to send log messages to the renderer
function logToRenderer(message) {
    mainWindow.webContents.send('log-message', message);
}

client.on('error', error => {
    logToRenderer('An error occurred: ', error);
});

client.once('ready', async () => {
    //Define a nice clean shutdown function
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

    logToRenderer('TavernTones is online!');
    logToRenderer(`Logged in as ${client.user.tag}`);
    /* startup message
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

    // --- Load initial state and send to UI ---
    loadState();
    // Small delay to ensure window is ready before sending
    setTimeout(() => {
        if (mainWindow) {
            sendInitiativeUpdate();
        }
    }, 1000);

    //Connect to the voice channel

    //connection status enums
    //VoiceConnectionStatus.Signalling
    //VoiceConnectionStatus.Connecting
    //VoiceConnectionStatus.Ready
    //VoiceConnectionStatus.Disconnected
    //VoiceConnectionStatus.Destroyed

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
        }
        catch (error) {
            logToRenderer('Error joining voice channel: ', error);
        }
    }
    else {
        logToRenderer('Voice channel not found or is not a voice channel!');
    }

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

    //Begin IPC Handling
    function logToRenderer(message) {
        mainWindow.webContents.send('log-message', message);
    }

    // --- Music System ---
    function sendGuiUpdate() {
        if (mainWindow) {
            mainWindow.webContents.send('update-gui-state', {
                isPlaying: audioState.playerStatus === AudioPlayerStatus.Playing,
                isCaching: audioState.isCaching,
                filePath: audioState.activeFile || audioState.pendingFile
            });
        }
    }

    const player = createAudioPlayer();
    if(connection) {
        connection.subscribe(player);
    }

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

    ipcMain.on('exit-app', async () => {
        await shutdown();
    });

    app.on('window-all-closed', async () => {
        await shutdown();
    });

    ipcMain.handle('get-default-local-folder', () => {
        return DEFAULT_LOCAL_FOLDER;
    });


    ipcMain.on('roll-dice', (event, { name, type, bonus }) => {
        const roller = new DiceRoller();
        const roll = roller.roll('1d20').total;
        const result = roll + bonus;
        const message = `${name} ${type}: ${result} (${roll} + ${bonus})`;
        mainWindow.webContents.send('log-message', message);
        mainWindow.webContents.send('dice-log', message);
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
                saveState(); // Autosave the newly loaded state
                sendInitiativeUpdate();
            }
        } catch (error) {
            logToRenderer(`Error loading encounter: ${error.message}`);
        }
    });

    // --- Initiative Tracker Handlers ---
    function sendInitiativeUpdate() {
        if (mainWindow) {
            mainWindow.webContents.send('update-initiative-list', { initiativeOrder, currentTurnIndex });
        }
    }

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

    ipcMain.on('next-turn', () => {
        if (initiativeOrder.length > 0) {
            const endingTurnCreature = initiativeOrder[currentTurnIndex];
            if (endingTurnCreature && endingTurnCreature.isFriendly) {
                dialog.showMessageBox(mainWindow, { type: 'question', title: 'Legendary Action', message: `End of ${endingTurnCreature.name}'s turn. Do you take a legendary action?`, buttons: ['Yes', 'No']});
            }
            currentTurnIndex = (currentTurnIndex + 1) % initiativeOrder.length;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('previous-turn', () => {
        if (initiativeOrder.length > 0) {
            currentTurnIndex = (currentTurnIndex - 1 + initiativeOrder.length) % initiativeOrder.length;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.on('update-hp', (event, { creatureId, amount }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.hp += amount;
            if (creature.isConcentrating && amount < 0) {
                const dc = Math.max(10, Math.floor(-amount / 2));
                dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Concentration Check', message: `${creature.name} must make a DC ${dc} Constitution saving throw.`, buttons: ['OK']});
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

    ipcMain.on('update-creature-flag', (event, { creatureId, flag, value }) => {
        const creature = initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature[flag] = value;
            sendInitiativeUpdate();
            saveState();
        }
    });

    ipcMain.handle('open-file-dialog', async () => {
        const defaultFolder = process.env.DEFAULT_LOCAL_FOLDER;
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            defaultPath: defaultFolder,
            filters: [
                { name: 'Audio Files', extensions: ['wav', 'lnk'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) {
            logToRenderer('File selection cancelled.');
            return null;
        }

        let selectedPath = result.filePaths[0];
        let resolvedPath = selectedPath;

        if (path.extname(resolvedPath).toLowerCase() === '.lnk') {
            try {
                const shortcut = shell.readShortcutLink(resolvedPath);
                if (shortcut.target && fs.existsSync(shortcut.target)) {
                    resolvedPath = shortcut.target;
                    logToRenderer(`Resolved .lnk to: ${resolvedPath}`);
                } else {
                    logToRenderer(`Resolved shortcut target does not exist: ${shortcut.target}`);
                    return null;
                }
            } catch (error) {
                logToRenderer(`Error resolving shortcut: ${error}`);
                return null;
            }
        }

        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
            logToRenderer(`Invalid file or file does not exist: ${resolvedPath}`);
            return null;
        }

        audioState.pendingFile = resolvedPath;
        audioState.isCaching = true;
        logToRenderer(`File selected, caching: ${audioState.pendingFile}`);
        sendGuiUpdate();

        await new Promise(resolve => setTimeout(resolve, 100));

        audioState.isCaching = false;
        logToRenderer(`Caching complete for: ${audioState.pendingFile}`);

        if (audioState.playerStatus === AudioPlayerStatus.Idle) {
            player.stop();
            audioState.activeFile = audioState.pendingFile;
            audioState.pendingFile = null;
            logToRenderer(`Set new active file: ${audioState.activeFile}`);
        } else {
            player.stop();
            audioState.activeFile = audioState.pendingFile;
            audioState.pendingFile = null;
        }

        sendGuiUpdate();
        return audioState.activeFile;
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