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
                        // Regex to capture: !ro <folderName> <iterationCount> <tableArgsStr>
                        // folderName: alphanumeric, underscores, hyphens
                        // iterationCount: digits
                        // tableArgsStr: the rest
                        const roRegex = /^!ro\s+([a-zA-Z0-9_-]+)\s+(\d+)\s+(.*)/;
                        // We use message.content here, not the lowercased 'content', to preserve case for folderName if needed.
                        const roMatch = message.content.match(roRegex); 

                        if (!roMatch) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <numberOfIterations> <weight1> <tableName1> <weight2> <tableName2> ...');
                            break;
                        }

                        const [, folderName, iterationCountStr, tableArgsStr] = roMatch;

                        // Validate folderName
                        const validFolders = getValidTableFolders(); 
                        if (!validFolders.includes(folderName)) {
                            await message.reply(`Folder '${folderName}' not found. Valid folders are: ${validFolders.join(', ')}.`);
                            break;
                        }

                        // Parse and validate iterationCount
                        const iterationCount = parseInt(iterationCountStr, 10);
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 50) {
                            await message.reply('Invalid number of iterations. Please use a number between 1 and 50.');
                            break;
                        }

                        // Parse tableArgsStr for tableEntries
                        const tableArgs = tableArgsStr.trim().split(/\s+/);
                        const roTableEntries = [];
                        if (tableArgs.length === 0 || tableArgs.length % 2 !== 0) {
                            await message.reply('Invalid weight or table name format in table arguments. Ensure you have pairs of weight and table names, and at least one pair.');
                            break;
                        }

                        let validRoTableArgs = true;
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            const weightStr = tableArgs[i];
                            const tableName = tableArgs[i + 1]; // This could be undefined if tableArgs has an odd length, handled by the check above.
                            const weight = parseInt(weightStr, 10);

                            if (isNaN(weight) || weight <= 0 || !tableName) { // Check !tableName as well
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
                            // This check is technically redundant due to earlier checks (tableArgs.length === 0 or length % 2 !==0)
                            // but kept for safety. The main scenario for this would be if validRoTableArgs became false.
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
                                // This else block will be reached if .lnk resolution set songFilePath to null.
                                // The original "song not found" logic below will handle the reply.
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
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath });
            }
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

        // Send GUI update after file dialog processing
        if (mainWindow && mainWindow.webContents) {
            if (pendingFilePath) { // Successfully loaded a file
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: pendingFilePath, isPending: true });
            } else { // File selection failed or was cancelled, or processing failed
                // Check if a track was already playing/paused and maintain its state, or send a general non-playing state
                const status = player.state.status;
                const wasPlaying = status === AudioPlayerStatus.Playing;
                const wasPaused = status === AudioPlayerStatus.Paused; 
                if (wasPlaying || wasPaused) { 
                     mainWindow.webContents.send('update-gui-state', { isPlaying: wasPlaying, filePath: currentPlayingFilePath });
                } else {
                     mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath }); // Or null if nothing was there
                }
            }
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
            logToRenderer('Player entered Idle state. Current track: ' + currentPlayingFilePath + '. Pending track: ' + pendingFilePath);
            if (pendingAudioResource && pendingFilePath) {
                logToRenderer('Idle: Pending resource found. Starting playback for: ' + pendingFilePath);
                const resourceToPlay = pendingAudioResource;
                const pathForResource = pendingFilePath;

                // Clear pending resources *before* starting new playback to avoid race conditions or re-queueing issues.
                pendingAudioResource = null;
                pendingFilePath = null;

                // Update current track info
                // currentPlayingFilePath = pathForResource; // This will be set by startPlaybackFromResource
                // currentAudioResource = resourceToPlay; // This will be set by startPlaybackFromResource
                
                await startPlaybackFromResource(resourceToPlay, pathForResource);
                // The "Now playing..." message to Discord should be handled by the command that initiated the pending track,
                // or we can add a generic message here if preferred. For now, startPlaybackFromResource will update GUI.
                // If a Discord message is needed:
                // const textChannel = client.channels.cache.get(TEXT_CHANNEL_ID); // Assuming TEXT_CHANNEL_ID is defined
                // if (textChannel) {
                //     textChannel.send(`Now playing: **${path.parse(pathForResource).name}** from **${path.basename(path.dirname(pathForResource))}**.`);
                // }
            } else if (currentPlayingFilePath) { // Existing loop logic
                logToRenderer('Idle: No pending resource. Attempting to loop current track: ' + currentPlayingFilePath);
                const newReadableStream = await createReadableStream(currentPlayingFilePath);
                if (newReadableStream) {
                    const newAudioResourceForLoop = createAudioResource(newReadableStream);
                    // currentAudioResource = newAudioResourceForLoop; // This will be set by startPlaybackFromResource
                    await startPlaybackFromResource(newAudioResourceForLoop, currentPlayingFilePath); // Play the new resource for the loop
                } else {
                    logToRenderer('Idle: Failed to create stream for looping: ' + currentPlayingFilePath);
                    currentPlayingFilePath = null; 
                    currentAudioResource = null;
                    if (mainWindow && mainWindow.webContents) {
                        mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                    }
                }
            } else {
                logToRenderer('Player Idle and no currentPlayingFilePath or pendingFilePath, so not looping or starting new track.');
                // Ensure GUI reflects that nothing is playing
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
                }
                currentAudioResource = null; // Ensure this is also cleared
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
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: null });
            }
        });

        player.play(audioResourceToPlay);
        logToRenderer('Player.play called. Player state: ' + player.state.status);
        
        try {
            await entersState(player, AudioPlayerStatus.Playing, 5000); // Wait for playing state
            logToRenderer('Player is now Playing. Player state: ' + player.state.status);
            // playing = true;
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: true, filePath: currentPlayingFilePath });
            }
        } catch (error) {
            logToRenderer(`Player did not enter Playing state for ${currentPlayingFilePath}: ${error.message}. Current state: ${player.state.status}`);
            // playing = false;
            // If it fails to enter playing, it might go to Idle or stay Buffering/Paused. The Idle handler should then take over or it might be an error.
            // Ensure GUI is updated if playback fails to start
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('update-gui-state', { isPlaying: false, filePath: currentPlayingFilePath });
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
            return ext === '.mp3' || ext === '.wav'|| ext === '.lnk';
        });

        if (audioFiles.length === 0) {
            logToRenderer(`findMusic: No audio files (.mp3 or .wav) found in the folder '${foundFolderOriginalName}'.`);
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