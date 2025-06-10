require('dotenv').config({ path: 'environmentvars.env' }); // Load environment variables from .env file
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { PassThrough, Readable } = require('stream'); // Updated stream import
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
//adding a comment so i can flipping commit this
let pendingAudioResource = null;
let currentAudioResource = null;
let pendingFilePath = null;
let currentPlayingFilePath = null;

let mp3Cache = new Map(); // Cache for decoded MP3 buffers
let oggPcmCache = new Map();

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
                        const commandArgs = parts.slice(2).filter(arg => arg.length > 2); // Filter out empty strings that might result from multiple spaces

                        let parsedFolder = null;
                        let parsedSong = null;

                        if (commandArgs.length == 1) {
                            // A single argument is provided.
                            // For now, we will assign the single argument to parsedFolder, and findMusic will check if it's a folder.
                            // If not, findMusic will then try it as a song with "chill" as the folder.
                            parsedFolder = commandArgs[0];
                            logToRenderer(`!pl: Single argument received: '${parsedFolder}'. This will be interpreted by findMusic either as a folder name or a song name (from 'chill' folder).`);
                        } else if (commandArgs.length >= 2) {
                            // Two or more arguments. Assume the first is the folder and the second is the song.
                            parsedFolder = commandArgs[0];
                            parsedSong = commandArgs[1];
                            if (commandArgs.length > 2) {
                                logToRenderer(`!pl: More than two arguments received. Using first as folder ('${parsedFolder}') and second as song ('${parsedSong}'). Additional arguments are ignored.`);
                            } else {
                                logToRenderer(`!pl: Two arguments received: Folder='${parsedFolder}', Song='${parsedSong}'.`);
                            }
                        } else {
                            // No arguments (only "!pl"). Both parsedFolder and parsedSong remain null.
                            // findMusic will use the default "chill" folder and pick a random song.
                            logToRenderer("!pl: No arguments received after command. Default 'chill' folder and random song will be used by findMusic.");
                        }

                        let songFilePath = null;
                        let finalFolderUsed = parsedFolder; // Keep track of what folder was effectively used for messages
                        let finalSongUsed = parsedSong; // Keep track of what song was effectively used

                        // Initial attempt to find music
                        if (parsedFolder || parsedSong) { // If any specific search terms were given
                            songFilePath = await findMusic(parsedFolder, parsedSong);
                        } else { // Case: just "!pl" - implies chill and random
                            songFilePath = await findMusic(null, null); // findMusic defaults to "chill" and random
                            finalFolderUsed = "chill"; // For messaging
                        }

                        // Handle ambiguity: if a single argument was given (parsedFolder has a value, parsedSong is null)
                        // and it wasn't found as a folder, try it as a song in the "chill" folder.
                        if (!songFilePath && parsedFolder && !parsedSong) {
                            logToRenderer(`!pl: Initial search for folder '${parsedFolder}' (with random song) failed. Attempting to find '${parsedFolder}' as a song in 'chill' folder.`);
                            songFilePath = await findMusic("chill", parsedFolder); // Treat original parsedFolder as song, in "chill"
                            if (songFilePath) {
                                finalFolderUsed = "chill";
                                finalSongUsed = parsedFolder; // The original single argument is now considered the song
                            }
                        }
                        
                        // If still no song path after all attempts, and it was just "!pl" (no args)
                        // This case should have been handled by findMusic(null,null) -> "chill", random.
                        // If it's still null here, it means "chill" folder or random song selection failed.
                        if (!songFilePath && !parsedFolder && !parsedSong) {
                             logToRenderer(`!pl: Default search for random song in 'chill' folder failed.`);
                        }

                        if (songFilePath) {
                            // Resolve .lnk file if necessary
                            if (path.extname(songFilePath).toLowerCase() === '.lnk') {
                                try {
                                    const shortcut = shell.readShortcutLink(songFilePath);
                                    const targetPath = shortcut.target || null;

                                    if (targetPath && fs.existsSync(targetPath)) {
                                        songFilePath = targetPath;
                                        logToRenderer('!pl: Resolved .lnk to: ' + songFilePath);
                                    } else {
                                        logToRenderer('!pl: Resolved shortcut target does not exist or is invalid: ' + targetPath);
                                        await message.reply(`Sorry, the shortcut for '${path.parse(songFilePath).name}' is broken or points to a missing file.`);
                                        songFilePath = null; 
                                    }
                                } catch (error) {
                                    logToRenderer('!pl: Error resolving shortcut: ' + error);
                                    await message.reply(`Sorry, I encountered an error trying to open the shortcut for '${path.parse(songFilePath).name}'.`);
                                    songFilePath = null;
                                }
                            }

                            if (songFilePath) { // Check again if songFilePath is still valid after .lnk resolution
                                const readableStream = await createReadableStream(songFilePath);
                                if (!readableStream) {
                                    logToRenderer(`!pl: Failed to create readable stream for ${songFilePath}.`);
                                    await message.reply(`Sorry, I found the song '${path.parse(songFilePath).name}' but encountered an error trying to prepare it.`);
                                    // return; // Exit if stream creation fails - removed to allow falling through to "song not found" logic if needed, though this path implies song was found but stream failed.
                                } else {
                                    const newResource = createAudioResource(readableStream);
                                    const songNameForMessage = path.parse(songFilePath).name;
                                    const folderNameForMessage = path.basename(path.dirname(songFilePath));

                                    if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused) {
                                        pendingAudioResource = newResource;
                                        pendingFilePath = songFilePath;
                                        logToRenderer(`!pl: Current track is playing/paused. Pending ${songFilePath}`);
                                        await message.reply(`Okay, queuing up: **${songNameForMessage}**. It will play when ready.`);
                                        player.stop(true); // Stop current to trigger Idle, which should then play pending.
                                        await startPlaybackFromResource(pendingAudioResource, pendingFilePath);
                                    } else {
                                        currentPlayingFilePath = songFilePath;
                                        currentAudioResource = newResource;
                                        await startPlaybackFromResource(newResource, songFilePath);
                                        await message.reply(`Now playing: **${songNameForMessage}** from folder **${folderNameForMessage}**.`);
                                        logToRenderer(`!pl: Playback started immediately for ${songNameForMessage} from ${folderNameForMessage}.`);
                                    }
                                }
                            } else {
                                // This 'else' corresponds to the 'if (songFilePath)' block before .lnk processing.
                                // If songFilePath was initially null (findMusic failed) OR if .lnk processing made it null AND readableStream creation failed/wasn't attempted
                                // then this block will execute to inform the user.
                                logToRenderer(`!pl: songFilePath became null after .lnk processing, likely due to a broken link.`);
                            }
                        }
                        
                        // This 'else' corresponds to the 'if (songFilePath)' block before .lnk processing.
                        // If songFilePath was initially null (findMusic failed) OR if .lnk processing made it null AND readableStream creation failed/wasn't attempted
                        // then this block will execute to inform the user.
                        if (!songFilePath) { // Re-check songFilePath as it might have been nulled by .lnk processing or stream failure
                            logToRenderer(`!pl: No valid song path to play. parsedFolder='${parsedFolder}', parsedSong='${parsedSong}'.`);
                            let replyMessage = "Sorry, I couldn't find the music you were looking for. ";
                            if (parsedFolder && parsedSong) {
                                replyMessage += `I looked for folder containing '${parsedFolder}' and song containing '${parsedSong}'.`;
                            } else if (parsedFolder) { // Only parsedFolder was initially given
                                replyMessage += `I tried finding a folder containing '${parsedFolder}' (for a random song), and also tried finding a song named '${parsedFolder}' in the 'chill' folder.`;
                            } else if (parsedSong) { // Only parsedSong was initially given (parsedFolder was null)
                                 replyMessage += `I looked for a song containing '${parsedSong}' in the 'chill' folder.`;
                            } else { // Only "!pl"
                                replyMessage += `I tried to play a random song from the 'chill' folder but couldn't.`;
                            }
                            replyMessage += "\nPlease check your terms or ensure the 'chill' folder exists and has music (and that any shortcuts are valid!).";
                            await message.reply(replyMessage);
                        }
                        break;
                    
                    case content.includes('!pa'):
                        logToRenderer('!pa command detected');
                        if (player.state.status === AudioPlayerStatus.Playing) {
                            pauseAudio(); // This function already exists in main.js
                            await message.reply('Playback paused.');
                            // GUI update via IPC will be handled in a later step.
                        } else if (player.state.status === AudioPlayerStatus.Paused) {
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
        logToRenderer(`Play command received. pendingFilePath: ${pendingFilePath}, filePathFromRenderer: ${filePathFromRenderer}`);
        pendingAudioResource = null; // Ensure this is always null at the start of this handler

        if (pendingFilePath && (!filePathFromRenderer || filePathFromRenderer === pendingFilePath)) {
            logToRenderer(`Play command received for pending file: ${pendingFilePath}`);

            const stream = await createReadableStream(pendingFilePath);
            if (stream) {
                const resourceToPlay = createAudioResource(stream);

                if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused) {
                    if (currentPlayingFilePath === pendingFilePath && player.state.status === AudioPlayerStatus.Paused) {
                        logToRenderer('Pending file is the same as current and paused. Resuming.');
                        player.unpause();
                        mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath, isPending: false });
                        pendingFilePath = null; // Clear pending file path
                        return; // Early exit
                    }
                    logToRenderer('Stopping current track to play pending file.');
                    player.stop(true);
                }

                currentPlayingFilePath = pendingFilePath;
                currentAudioResource = resourceToPlay;

                await startPlaybackFromResource(resourceToPlay, pendingFilePath);
                logToRenderer(`Playback started for pending file: ${pendingFilePath}`);
                mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath, isPending: false });

                pendingFilePath = null;
            } else {
                logToRenderer(`Failed to create stream for pending file: ${pendingFilePath}`);
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath, isPending: !!pendingFilePath });
                pendingFilePath = null;
            }
        } else if (filePathFromRenderer) {
            logToRenderer('Play command: Direct play from renderer path: ' + filePathFromRenderer);

            const stream = await createReadableStream(filePathFromRenderer);
            if (stream) {
                const resourceToPlay = createAudioResource(stream);
                if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused) {
                   if (currentPlayingFilePath === filePathFromRenderer) {
                       if (player.state.status === AudioPlayerStatus.Paused) {
                           logToRenderer('Direct play for current paused file. Resuming.');
                           player.unpause();
                           mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath, isPending: false });
                           return;
                       }
                       logToRenderer('Direct play for current playing file. Restarting.');
                   }
                   player.stop(true);
                }
                currentPlayingFilePath = filePathFromRenderer;
                currentAudioResource = resourceToPlay;
                await startPlaybackFromResource(resourceToPlay, filePathFromRenderer);
                mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath, isPending: false });
            } else {
                logToRenderer('Failed to create stream for: ' + filePathFromRenderer);
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath, isPending: false });
            }
        } else if (currentAudioResource && player.state.status === AudioPlayerStatus.Paused) {
           logToRenderer('Resuming current track: ' + currentPlayingFilePath);
           player.unpause();
           if (mainWindow && mainWindow.webContents) {
               mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath, isPending: false });
           }
        } else {
            logToRenderer('Play command: Nothing to play.');
            if (mainWindow && mainWindow.webContents) { // Ensure GUI reflects non-playing state if nothing happens
                mainWindow.webContents.send('update-gui-state', {
                    isPlaying: false,
                    filePath: currentPlayingFilePath, // Keep showing current file if paused or idle
                    isPending: !!pendingFilePath
                });
            }
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
            { name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'lnk'] },
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

            // Simplified logic: only validate path and set pendingFilePath.
            // Stream and resource creation moved to 'play-music' handler.
            if (resolvedPathAfterLinkCheck && fs.existsSync(resolvedPathAfterLinkCheck) && fs.statSync(resolvedPathAfterLinkCheck).isFile()) {
                pendingFilePath = resolvedPathAfterLinkCheck;
                logToRenderer(`File selected and pending: ${pendingFilePath}`);
                pendingAudioResource = null; // Ensure pendingAudioResource is null
            } else {
                if (resolvedPathAfterLinkCheck) { // Only log if there was a path to check
                    logToRenderer(`Invalid file or file does not exist: ${resolvedPathAfterLinkCheck}`);
                } else {
                    logToRenderer('No file selected or link resolution failed.');
                }
                pendingFilePath = null;
                pendingAudioResource = null;
                resolvedPathAfterLinkCheck = null; // Ensure this is null if no valid file
            }
        } else { 
            pendingFilePath = null;
            pendingAudioResource = null;
            logToRenderer('No file selected from dialog.');
        }

        // Send GUI update after file dialog processing
        if (mainWindow && mainWindow.webContents) {
            // Update GUI based on whether a file is pending
            mainWindow.webContents.send('update-gui-state', {
                isPlaying: player.state.status === AudioPlayerStatus.Playing, // Reflect current playing state
                filePath: pendingFilePath || currentPlayingFilePath, // Show pending if available, else current
                isPending: !!pendingFilePath  // True if a file is pending, false otherwise
            });
        }
        return resolvedPathAfterLinkCheck; // Return the path that was processed (or null)
    });


    //Begin audio processing
    async function createReadableStream(filePath) {
        if (!filePath) { // Ensure filePath is not null or undefined
            logToRenderer('createReadableStream: filePath is null or undefined.');
            return null;
        }
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.ogg') {
            if (oggPcmCache.has(filePath)) {
                logToRenderer('Creating stream from cached OGG PCM buffer: ' + filePath);
                const cachedPcmBuffer = oggPcmCache.get(filePath);
                const readableStream = new PassThrough();
                readableStream.push(cachedPcmBuffer);
                readableStream.push(null);
                logToRenderer('Successfully created stream from cached OGG PCM.');
                return readableStream;
            }
            try {
                logToRenderer('Processing OGG file: ' + filePath);
                const { OggVorbisDecoder } = await import('@wasm-audio-decoders/ogg-vorbis');
                if (!OggVorbisDecoder) {
                    logToRenderer('OggVorbisDecoder could not be imported.');
                    return null;
                }
                const uint8ArrayContent = fs.readFileSync(filePath);
                const decoder = new OggVorbisDecoder();
                await decoder.ready;
                const { channelData, sampleRate } = await decoder.decodeFile(uint8ArrayContent);
                decoder.free(); // Corrected: no await

                logToRenderer('OGG Decoder Output: sampleRate=' + sampleRate + ', numberOfChannels=' + (channelData ? channelData.length : 'null') + (channelData && channelData.length > 0 ? (', samplesPerChannel=' + channelData[0].length) : ''));

                if (!channelData || channelData.length === 0) {
                    logToRenderer('OGG decoding resulted in no channel data for ' + filePath);
                    return null;
                }

                logToRenderer(`OGG decoded: ${filePath}, Sample Rate: ${sampleRate}, Channels: ${channelData.length}`);

                let pcmBuffer = null;
                try { // Inner try specifically for PCM conversion
                    // Convert Float32Array to 16-bit signed PCM Node.js Buffer
                    const numChannels = channelData.length;
                    const numSamples = channelData[0].length;
                    // Assign to the outer scope pcmBuffer
                    pcmBuffer = Buffer.alloc(numSamples * numChannels * 2); // 2 bytes per sample (Int16)

                    let minSampleInt = 32767;
                    let maxSampleInt = -32768;
                    const logFrequency = numSamples > 0 ? Math.floor(numSamples / 4) : 1; // Log roughly 4 samples + first/last, avoid division by zero

                    if (numChannels === 1) { // Mono
                        for (let i = 0; i < numSamples; i++) {
                            const sampleFloat = Math.max(-1, Math.min(1, channelData[0][i])); // Clamp to [-1.0, 1.0]
                            const sampleInt = Math.round(sampleFloat * 32767);
                            pcmBuffer.writeInt16LE(sampleInt, i * 2);

                            if (sampleInt < minSampleInt) minSampleInt = sampleInt;
                            if (sampleInt > maxSampleInt) maxSampleInt = sampleInt;

                            if (i === 0) { // Log first sample details
                                logToRenderer(`OGG PCM Conv: First sample[0][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                            } else if (i === numSamples - 1) { // Log last sample details
                                logToRenderer(`OGG PCM Conv: Last sample[0][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                            } else if (i % logFrequency === 0) { // Log some intermediate samples
                                logToRenderer(`OGG PCM Conv: Sample[0][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                            }
                        }
                    } else { // Stereo (or more channels, interleave)
                        for (let i = 0; i < numSamples; i++) {
                            for (let ch = 0; ch < numChannels; ch++) {
                                const sampleFloat = Math.max(-1, Math.min(1, channelData[ch][i])); // Clamp
                                const sampleInt = Math.round(sampleFloat * 32767);
                                pcmBuffer.writeInt16LE(sampleInt, (i * numChannels + ch) * 2);

                                if (sampleInt < minSampleInt) minSampleInt = sampleInt;
                                if (sampleInt > maxSampleInt) maxSampleInt = sampleInt;

                                if (i === 0 && ch === 0) { // Log first sample details
                                    logToRenderer(`OGG PCM Conv: First sample[${ch}][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                                } else if (i === numSamples - 1 && ch === numChannels -1 ) { // Log last sample details
                                     logToRenderer(`OGG PCM Conv: Last sample[${ch}][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                                } else if (i % logFrequency === 0 && ch === 0) { // Log some intermediate samples (only for first channel to avoid too many logs)
                                    logToRenderer(`OGG PCM Conv: Sample[${ch}][${i}] Float=${sampleFloat.toFixed(4)}, Int=${sampleInt}`);
                                }
                            }
                        }
                    }
                    logToRenderer(`OGG PCM Conv: MinIntSample=${minSampleInt}, MaxIntSample=${maxSampleInt}`);
                    logToRenderer('OGG PCM Buffer: length=' + (pcmBuffer ? pcmBuffer.length : 'null') + ', content (first 20 bytes): ' + (pcmBuffer ? pcmBuffer.slice(0, 20).toString('hex') : 'N/A'));
                } catch (pcmError) {
                    logToRenderer('ERROR during OGG PCM conversion: ' + pcmError.message + (pcmError.stack ? '\nStack: ' + pcmError.stack : ''));
                    throw pcmError; // Re-throw to be caught by the outer catch
                }

                if (pcmBuffer && pcmBuffer.length > 0) {
                    logToRenderer('Caching OGG PCM buffer for: ' + filePath);
                    oggPcmCache.set(filePath, pcmBuffer);
                    const readableStream = new PassThrough();
                    readableStream.push(pcmBuffer); // Push the buffer
                    readableStream.push(null);      // Signal EOF
                    logToRenderer('OGG PCM stream created using PassThrough.');
                    logToRenderer('Successfully created readable stream from OGG file: ' + filePath);
                    return readableStream;
                } else {
                    logToRenderer('ERROR: OGG PCM buffer is null or empty before creating custom Readable. path: ' + filePath);
                    return null; // Or handle error as appropriate
                }
            } catch (error) {
                logToRenderer('Error processing OGG file in createReadableStream: ' + error.message + (error.stack ? '\nStack: ' + error.stack : '') + ' for ' + filePath);
                return null;
            }
        } else if (ext === '.mp3') {
            if (mp3Cache.has(filePath)) {
                logToRenderer('Creating stream from cached MP3 buffer: ' + filePath);
                const cachedBuffer = mp3Cache.get(filePath);
                const readableStream = new PassThrough(); // Use destructured PassThrough
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

                const readableStream = new PassThrough(); // Use destructured PassThrough
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

    let player = createAudioPlayer(); // This is the main player
    connection.subscribe(player);

    // Setup main player's event listeners once
    player.on(AudioPlayerStatus.Idle, async () => {
        logToRenderer('Main player entered Idle state. Current track: ' + currentPlayingFilePath + '. Pending track: ' + pendingFilePath);
        // This Idle handler is primarily for looping non-OGG files or playing the next track if a queue system were implemented.
        // OGG files are handled by a temporary player and should not trigger this main player's looping logic for themselves.

        if (pendingAudioResource && pendingFilePath) { // This condition might need review if pendingAudioResource is removed
            logToRenderer('Main player Idle: Pending resource found. Starting playback for: ' + pendingFilePath);
            const resourceToPlay = pendingAudioResource;
            const pathForResource = pendingFilePath;
            pendingAudioResource = null;
            pendingFilePath = null;
            await startPlaybackFromResource(resourceToPlay, pathForResource);
        } else if (currentPlayingFilePath) {
            const isOggLoop = path.extname(currentPlayingFilePath).toLowerCase() === '.ogg';
            if (isOggLoop) {
                logToRenderer('Main player Idle: OGG file finished (expected to be played by temporary player), not looping with main player.');
                currentPlayingFilePath = null;
                currentAudioResource = null; // Clear resource tied to main player
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
                logToRenderer('Main player Idle: No pending resource. Attempting to loop current (non-OGG) track: ' + currentPlayingFilePath);
                const newReadableStream = await createReadableStream(currentPlayingFilePath);
                if (newReadableStream) {
                    const newAudioResourceForLoop = createAudioResource(newReadableStream);
                    // currentAudioResource is already set for non-OGG, startPlaybackFromResource will use it.
                    await startPlaybackFromResource(newAudioResourceForLoop, currentPlayingFilePath);
                } else {
                    logToRenderer('Main player Idle: Failed to create stream for looping non-OGG: ' + currentPlayingFilePath);
                    currentPlayingFilePath = null; 
                    currentAudioResource = null;
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                    }
                }
            }
        } else {
            logToRenderer('Main player Idle and no currentPlayingFilePath or pendingFilePath, so not looping or starting new track.');
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
            }
            currentAudioResource = null;
        }
    });

    player.on(AudioPlayerStatus.AutoPaused, () => {
        if (currentPlayingFilePath) { // Check if a track was supposed to be playing
            logToRenderer('Main player Autopaused, check connection... Track: ' + currentPlayingFilePath);
        }
    });

    player.on('error', (error) => {
        logToRenderer(`Error in main player for ${currentPlayingFilePath}: ${error.message}`);
        currentPlayingFilePath = null;
        currentAudioResource = null;
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null, error: true });
        }
    });


    async function startPlaybackFromResource(audioResourceToPlay, filePathOfResource) {
        const isOgg = path.extname(filePathOfResource).toLowerCase() === '.ogg';

        if (isOgg) {
            logToRenderer('Using temporary AudioPlayer for OGG: ' + filePathOfResource);

            if (player.state.status === AudioPlayerStatus.Playing || player.state.status === AudioPlayerStatus.Paused) {
                logToRenderer('Stopping main player for temporary OGG playback.');
                player.stop(true);
            }

            const tempOggPlayer = createAudioPlayer();

            if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
                logToRenderer('ERROR: Voice connection not available or not ready for temporary OGG player.');
                if (mainWindow && mainWindow.webContents) {
                     mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: filePathOfResource, error: true });
                }
                return;
            }
            try {
                connection.subscribe(tempOggPlayer);
            } catch (subError) {
                logToRenderer('ERROR: Failed to subscribe temporary OGG player: ' + subError.message);
                if (mainWindow && mainWindow.webContents) {
                     mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: filePathOfResource, error: true });
                }
                return;
            }

            currentPlayingFilePath = filePathOfResource;
            // Do NOT set global currentAudioResource for temp player to avoid main player's Idle confusion

            tempOggPlayer.play(audioResourceToPlay);

            try {
                await entersState(tempOggPlayer, AudioPlayerStatus.Playing, 5000);
                logToRenderer('Temporary OGG player is now Playing: ' + filePathOfResource);
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: filePathOfResource });
                }
            } catch (error) {
                logToRenderer(`Temporary OGG player did not enter Playing state for ${filePathOfResource}: ${error.message}. Current state: ${tempOggPlayer.state.status}`);
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: filePathOfResource, error: true });
                }
                tempOggPlayer.stop();
                if (connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player === tempOggPlayer) {
                     connection.subscribe(player);
                }
                return;
            }

            tempOggPlayer.once(AudioPlayerStatus.Idle, () => {
                logToRenderer('Temporary OGG player Idle for: ' + filePathOfResource);
                tempOggPlayer.stop();
                if (currentPlayingFilePath === filePathOfResource) {
                    currentPlayingFilePath = null;
                }
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                }
                if (connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player === tempOggPlayer) {
                    logToRenderer('Resubscribing main player after temporary OGG player session (Idle).');
                    connection.subscribe(player);
                }
            });
            tempOggPlayer.once('error', (error) => {
                logToRenderer(`ERROR in temporary OGG player for ${filePathOfResource}: ${error.message}`);
                tempOggPlayer.stop();
                if (currentPlayingFilePath === filePathOfResource) {
                    currentPlayingFilePath = null;
                }
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null, error: true });
                }
                if (connection.state.status === VoiceConnectionStatus.Ready && connection.state.subscription?.player === tempOggPlayer) {
                    logToRenderer('Resubscribing main player after temporary OGG player error.');
                    connection.subscribe(player);
                }
            });

        } else { // Not OGG - use main player
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

            currentPlayingFilePath = filePathOfResource;
            currentAudioResource = audioResourceToPlay; // Main player uses this for looping

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
                logToRenderer('Main player is now Playing: ' + currentPlayingFilePath);
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath });
                }
            } catch (error) {
                logToRenderer(`Main player did not enter Playing state for ${currentPlayingFilePath}: ${error.message}. Current state: ${player.state.status}`);
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath, error: true });
                }
                // Don't nullify currentPlayingFilePath here if we want Idle handler to potentially retry/log
            }
        }
    }

    function pauseAudio() {
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause(true); // Pass true to pause even if resource is still buffering
            logToRenderer('Audio paused. Player state: ' + player.state.status);
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath });
            }
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
            return ext === '.mp3' || ext === '.wav' || ext === '.ogg' || ext === '.lnk';
        });

        if (audioFiles.length === 0) {
            logToRenderer(`findMusic: No audio files (.mp3, .wav or .ogg) found in the folder '${foundFolderOriginalName}'.`);
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