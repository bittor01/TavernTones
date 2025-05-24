require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const { Lame } = require('node-lame');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates] });
const axios = require('axios');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Use the token from environment variables
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
const BOT_ROLE_ID = process.env.BOT_ROLE_ID;
const DEFAULT_LOCAL_FOLDER = process.env.DEFAULT_LOCAL_FOLDER;
let connection;
let lastResponse = null; // Variable to store the last response

let pendingAudioResource = null;
let currentAudioResource = null;
let pendingFilePath = null;
let currentPlayingFilePath = null;

let mp3Cache = new Map(); // Cache for decoded MP3 buffers

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Begin UI
// Electron Setup
let mainWindow;
async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true
        }
    });
    await mainWindow.loadFile('index.html');
}

async function apploader() {
    await app.whenReady().then(() => {
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

    // let currentTrack = null; // Replaced by currentPlayingFilePath
    // let filePath = null; // This global filePath is being removed. Local variables will be used in open-file-dialog.

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

                        const encounterTablesFolder = path.join(__dirname, 'encountertables'); // Folder for encounter tables

                        // Parse weights and table names
                        const tableEntries = [];
                        for (let i = 0; i < args.length; i += 2) {
                            const weight = parseInt(args[i], 10);
                            const tableName = args[i + 1];

                            if (isNaN(weight) || weight <= 0 || !tableName) {
                                await message.reply('Invalid format. Please ensure weights are positive integers and table names are valid.');
                                break;
                            }

                            tableEntries.push({ weight, tableName });
                        }

                        // Check if all JSON files exist
                        const missingTables = tableEntries.filter(entry => {
                            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
                            return !fs.existsSync(filePath);
                        });

                        if (missingTables.length > 0) {
                            await message.reply(`The following tables were not found: ${missingTables.map(entry => entry.tableName).join(', ')}`);
                            break;
                        }

                        // Load all tables and calculate total weight
                        const tables = tableEntries.map(entry => {
                            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
                            const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                            return { ...entry, data: tableData };
                        });

                        const totalWeight = tables.reduce((sum, entry) => sum + entry.weight, 0);

                        // Roll to select a table based on weights
                        const roller = new DiceRoller();
                        const tableRoll = roller.roll(`1d${totalWeight}`).total;
                        let cumulativeWeight = 0;
                        let selectedTable = null;

                        for (const entry of tables) {
                            cumulativeWeight += entry.weight;
                            if (tableRoll <= cumulativeWeight) {
                                selectedTable = entry;
                                break;
                            }
                        }

                        if (!selectedTable) {
                            await message.reply('An error occurred while selecting a table.');
                            break;
                        }

                        // Roll to select an effect from the selected table
                        const availableEffects = selectedTable.data.filter(effect => !effect.unique || !effect.used.includes(message.channel.id));

                        if (availableEffects.length === 0) {
                            await message.reply('No available effects in the selected table.');
                            break;
                        }

                        const effect = availableEffects[Math.floor(Math.random() * availableEffects.length)];

                        // Mark the effect as used if it is unique
                        if (effect.unique) {
                            if (!Array.isArray(effect.used)) {
                                effect.used = [];
                            }
                            effect.used.push(message.channel.id);

                            // Save the updated table
                            const filePath = path.join(encounterTablesFolder, `${selectedTable.tableName}.json`);
                            fs.writeFileSync(filePath, JSON.stringify(selectedTable.data, null, 2), 'utf8');
                        }

                        // Compose the final message
                        const finalMessage = `Effect: ||${effect.text}||`;
                        await message.reply(finalMessage);
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
                        
                    case content.includes('!h'):
                        logToRenderer('Help command detected');
                        await message.reply('Commands:\n!su (surge)\n!sh (shield)\n!ll (Llama model)\n!re (Reasoner model)\n!in (inspect referenced material from last response)\n!h (returns this help message)\nany other message will return the currently playing track and album, if any.');
                        break;

                    default:
                        logToRenderer('No recognized command found.');
                        if (player && player.state.status == AudioPlayerStatus.Playing) {
                            // Get the file path of the currently playing track
                            
                            if (currentPlayingFilePath) {
                                // Extract album and track name
                                const albumName = path.basename(path.dirname(currentPlayingFilePath)); // Last subfolder
                                const trackName = path.basename(currentPlayingFilePath, path.extname(currentPlayingFilePath)); // Filename without extension
                                
                                logToRenderer('Reply sent successfully with track and album name: ' + currentPlayingFilePath);
                                await message.reply(`I'm currently playing: **${trackName}** from the album **${albumName}**`);
                            }
                            else {
                                logToRenderer('Reply sent successfully, but no currentPlayingFilePath was found.');
                                await message.reply('Sorry, no track information available.');
                            }
                        }
                        else {
                            logToRenderer('Reply sent successfully, not playing music.');
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

    ipcMain.on('play-music', async (event, filePathFromRenderer) => {
        logToRenderer('Play command received. Pending: ' + !!pendingAudioResource + ', Current: ' + !!currentAudioResource + ', Renderer Path: ' + filePathFromRenderer);

        if (pendingAudioResource && pendingFilePath) {
            logToRenderer(`Switching to new track: ${pendingFilePath}`);
            if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused) {
                player.stop(true); // Stop current playback if any
                logToRenderer('Stopped current track to play new one.');
            }
            await startPlaybackFromResource(pendingAudioResource, pendingFilePath);
            pendingAudioResource = null;
            pendingFilePath = null;
        } else if (currentAudioResource && player.state.status === AudioPlayerStatus.Paused) {
            logToRenderer('Resuming current track: ' + currentPlayingFilePath);
            player.unpause();
        } else if (currentAudioResource && player.state.status === AudioPlayerStatus.Playing) {
            logToRenderer('Current track is already playing: ' + currentPlayingFilePath);
            // Optional: Implement restart if filePathFromRenderer matches currentPlayingFilePath
            // For now, do nothing if already playing.
        } else if (filePathFromRenderer) {
            logToRenderer('Play command: No pending resource, not paused. Attempting to play from renderer path: ' + filePathFromRenderer);
            const readableStream = await createReadableStream(filePathFromRenderer);
            if (readableStream) {
                const resourceToPlay = createAudioResource(readableStream);
                await startPlaybackFromResource(resourceToPlay, filePathFromRenderer);
            } else {
                logToRenderer('Failed to create stream for: ' + filePathFromRenderer);
            }
        } else {
            logToRenderer('Play command: Nothing to play and no pending track or renderer path.');
        }
    });

    ipcMain.on('pause-music', () => {
        logToRenderer('Pause command received. Current player status: ' + player.state.status);
        pauseAudio();
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

    ipcMain.handle('open-file-dialog', async () => {
        const defaultFolder = process.env.DEFAULT_LOCAL_FOLDER
        const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        defaultPath: defaultFolder,
        filters: [
            { name: 'Audio Files', extensions: ['wav', 'mp3', 'lnk'] },
            { name: 'All Files', extensions: ['*'] }
        ]
        });

        let selectedPath = result.filePaths[0] || null;
        let resolvedPathAfterLinkCheck = selectedPath; // Assume it's the same unless it's a link

        if (resolvedPathAfterLinkCheck) {
            if (path.extname(resolvedPathAfterLinkCheck).toLowerCase() === '.lnk') {
                try {
                    const shortcut = shell.readShortcutLink(resolvedPathAfterLinkCheck);
                    const targetPath = shortcut.target || null;

                    if (targetPath && fs.existsSync(targetPath)) {
                        resolvedPathAfterLinkCheck = targetPath;
                        logToRenderer('Resolved .lnk to: ' + resolvedPathAfterLinkCheck);
                    } else {
                        logToRenderer('Resolved shortcut target does not exist or is invalid: ' + targetPath);
                        resolvedPathAfterLinkCheck = null; 
                    }
                }
                catch (error) {
                    logToRenderer('Error resolving shortcut: ' + error);
                    resolvedPathAfterLinkCheck = null; 
                }
            }

            if (resolvedPathAfterLinkCheck) { 
                const readableStream = await createReadableStream(resolvedPathAfterLinkCheck);
                if (readableStream) {
                    pendingAudioResource = createAudioResource(readableStream);
                    pendingFilePath = resolvedPathAfterLinkCheck;
                    logToRenderer(`Audio resource for ${resolvedPathAfterLinkCheck} created and ready.`);
                } else {
                    pendingAudioResource = null;
                    pendingFilePath = null; // Clear pending if resource creation fails
                    logToRenderer(`Failed to create audio resource for ${resolvedPathAfterLinkCheck}.`);
                    resolvedPathAfterLinkCheck = null; // Reflect failure in returned path
                }
            } else { 
                pendingAudioResource = null;
                pendingFilePath = null;
                logToRenderer(`File path is null after link check, cannot create audio resource.`);
            }
        } else { 
            pendingAudioResource = null;
            pendingFilePath = null;
            logToRenderer('No file selected.');
        }
        return resolvedPathAfterLinkCheck; // Return the path that was processed (or null)
    });


    //Begin audio proccessing
    async function createReadableStream(filePath) {
        if (!filePath) { // Ensure filePath is not null or undefined
            logToRenderer('createReadableStream: filePath is null or undefined.');
            return null;
        }
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.mp3') {
            if (mp3Cache.has(filePath)) {
                logToRenderer('Creating stream from cached MP3 buffer: ' + filePath);
                const cachedBuffer = mp3Cache.get(filePath);
                const readableStream = new stream.PassThrough();
                readableStream.end(cachedBuffer);
                return readableStream;
            }
            try {
                // Create a Lame decoder instance
                const lame = new Lame({
                    output: 'buffer',
                    bitrate: 64,          // Optional: Set bitrate for quality control (adjust as needed)
                    sfreq: 44.1,          // Set sample frequency to 44.1kHz
                    mode: 's',            // 'm' for mono, 's' for stereo (Discord supports both)
                    bitwidth: 16          // Set bit width to 16-bit for compatibility
                }).setFile(filePath);

                await lame.decode();
                const buffer = lame.getBuffer();
                mp3Cache.set(filePath, buffer); // Cache the buffer
                logToRenderer('MP3 decoded and cached: ' + filePath);

                const readableStream = new stream.PassThrough();
                readableStream.end(buffer);
                return readableStream;
            } catch (error) {
                logToRenderer('Error processing MP3 file in createReadableStream: ' + error.message);
                return null;
            }
        } else if (ext === '.wav') {
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

    //player status enums
    //AudioPlayerStatus.Buffering
    //AudioPlayerStatus.Playing
    //AudioPlayerStatus.Paused
    //AudioPlayerStatus.Idle
    //AudioPlayerStatus.AutoPaused

    let player = createAudioPlayer();
    connection.subscribe(player);

    async function startPlaybackFromResource(audioResourceToPlay, filePathOfResource) {
        currentPlayingFilePath = filePathOfResource;
        currentAudioResource = audioResourceToPlay;
        // playing = false; // Reset playing flag, to be set true after buffering

        logToRenderer('Attempting to play resource for: ' + currentPlayingFilePath + '. Player state: ' + player.state.status);
        
        player.removeAllListeners(AudioPlayerStatus.Idle); // Clear specific listeners to avoid duplicates
        player.removeAllListeners(AudioPlayerStatus.AutoPaused);
        player.removeAllListeners('error');

        player.on(AudioPlayerStatus.Idle, async () => {
            logToRenderer('Player entered Idle state. Current track: ' + currentPlayingFilePath);
            if (currentPlayingFilePath) { // Check if there's a track to loop
                logToRenderer('Playback finished, restarting loop for: ' + currentPlayingFilePath);
                const newReadableStream = await createReadableStream(currentPlayingFilePath);
                if (newReadableStream) {
                    const newAudioResourceForLoop = createAudioResource(newReadableStream);
                    currentAudioResource = newAudioResourceForLoop; // Update current resource
                    player.play(newAudioResourceForLoop); // Play the new resource for the loop
                    // playing = true; // Set playing to true again after loop starts
                } else {
                    logToRenderer('Failed to create stream for looping: ' + currentPlayingFilePath);
                    // playing = false;
                    currentPlayingFilePath = null; // Clear current playing path if looping fails
                    currentAudioResource = null;
                }
            } else {
                logToRenderer('Player Idle and no currentPlayingFilePath, so not looping.');
                // playing = false;
                currentAudioResource = null;
            }
        });
    
        player.on(AudioPlayerStatus.AutoPaused, () => {
            // if (playing && currentPlayingFilePath) { // Consider if 'playing' flag is still needed
            if (currentPlayingFilePath) {
                logToRenderer('Autopaused, check connection... Track: ' + currentPlayingFilePath);
            }
        });
    
        player.on('error', (error) => {
            logToRenderer(`Error playing audio for ${currentPlayingFilePath}: ${error.message}`);
            // playing = false;
            currentPlayingFilePath = null;
            currentAudioResource = null;
        });

        player.play(audioResourceToPlay);
        logToRenderer('Player.play called. Player state: ' + player.state.status);
        
        try {
            await entersState(player, AudioPlayerStatus.Playing, 5000); // Wait for playing state
            logToRenderer('Player is now Playing. Player state: ' + player.state.status);
            // playing = true;
        } catch (error) {
            logToRenderer(`Player did not enter Playing state for ${currentPlayingFilePath}: ${error.message}. Current state: ${player.state.status}`);
            // playing = false;
            // If it fails to enter playing, it might go to Idle or stay Buffering/Paused. The Idle handler should then take over or it might be an error.
        }
    }

    function pauseAudio() {
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause(true); // Pass true to pause even if resource is still buffering
            logToRenderer('Audio paused. Player state: ' + player.state.status);
        } else {
            logToRenderer('Audio is not playing or player unavailable. Player state: ' + player.state.status);
        }
    }

    function resumeAudio() {
        if (player && player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
            logToRenderer('Audio resumed. Player state: ' + player.state.status);
        } else {
            logToRenderer('Audio is not paused or player unavailable. Player state: ' + player.state.status);
        }
    }
});

client.login(DISCORD_TOKEN);

let memoryUsage = process.memoryUsage().rss; // Get the initial memory usage
const startingMemUse = memoryUsage;
setInterval(() => {
    memoryUsage = process.memoryUsage().rss;
    logToRenderer(`Memory usage is ${((memoryUsage - startingMemUse) / 1024 / 1024).toFixed(2)} MB higher than at launch (${(memoryUsage / 1024 / 1024).toFixed(2)} MB total)`);
}, 60000);

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