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

    let currentTrack = null;
    let filePath = null;

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
                            
                            if (filePath) {
                                // Extract album and track name
                                const albumName = path.basename(path.dirname(filePath)); // Last subfolder
                                const trackName = path.basename(filePath, path.extname(filePath)); // Filename without extension
                                
                                logToRenderer('Reply sent successfully with track and album name.');
                                await message.reply(`I'm currently playing: **${trackName}** from the album **${albumName}**`);
                            }
                            else {
                                logToRenderer('Reply sent successfully, but no filename was found.');
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

    ipcMain.on('play-music', async (event, filePath) => {
        if (filePath) {
            try {
                logToRenderer('Starting or resuming music: ', player.state.status);
                await checkStartResume(filePath);
            }
            catch (error) {
                logToRenderer('Error in checkStartResume: ', error);
            }
        }
        else {
            logToRenderer('Received null or invalid filePath.');
        }
    });

    ipcMain.on('pause-music', () => {
        logToRenderer('Pausing music: ' + player.state.status);
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

        filePath = result.filePaths[0] || null;
        if (filePath) {
            if (path.extname(filePath).toLowerCase() === '.lnk') {
                try {
                    const shortcut = shell.readShortcutLink(filePath);
                    const targetPath = shortcut.target || null;

                    // Check if the resolved target path exists
                    if (targetPath && fs.existsSync(targetPath)) {
                        filePath = targetPath;
                        return targetPath; // Return the resolved target path
                    } else {
                        logToRenderer('Resolved shortcut target does not exist: ', targetPath);
                        return null; // Target path doesn't exist, return null
                    }
                }
                catch (error) {
                    logToRenderer('Error resolving shortcut: ', error);
                    return null; // Return null in case of error
                }
            }
        }
        return filePath; // Return the selected file path
    });


    //Begin audio proccessing
    async function createReadableStream(filePath) {
        if (filePath) {
            const ext = path.extname(filePath).toLowerCase();
    
            if (ext === '.mp3') {
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
    
                    // Get the decoded PCM buffer
                    const buffer = lame.getBuffer();
    
                    // Create a readable stream from the buffer
                    const readableStream = new stream.PassThrough();
                    readableStream.end(buffer);
    
                    logToRenderer('Successfully created readable stream from MP3 file.');
                    return readableStream;
                } catch (error) {
                    logToRenderer('Error processing MP3 file: ' + error.message);
                    return null;
                }
            } else if (ext === '.wav') {
                try {
                    // Create a readable stream from the WAV file
                    const wavStream = fs.createReadStream(filePath);
                    logToRenderer('Successfully created readable stream from WAV file.');
                    return wavStream;
                } catch (error) {
                    logToRenderer('Error processing WAV file: ' + error.message);
                    return null;
                }
            } else {
                logToRenderer('Unsupported file type: ' + ext);
                return null;
            }
        } else {
            logToRenderer('No path passed: ' + filePath);
            return null;
        }
    }

    //player status enums
    //AudioPlayerStatus.Buffering
    //AudioPlayerStatus.Playing
    //AudioPlayerStatus.Paused
    //AudioPlayerStatus.Idle
    //AudioPlayerStatus.AutoPaused

    let playing;
    let audioResource;
    let player = createAudioPlayer();
    connection.subscribe(player);
    async function playAudioInVoiceChannel(filePath) {
        playing = false;
        
        logToRenderer('Player state: ' + player.state.status);
        async function playResource() {
            const readableStream = await createReadableStream(filePath);
            if (readableStream) {
                player.removeAllListeners();
                
                player.on(AudioPlayerStatus.Idle, async () => {
                    if (playing && filePath) {
                        logToRenderer('Playback finished, restarting loop...');
                        await playResource(); // Restart playback if looping is enabled
                    }
                });
            
                player.on(AudioPlayerStatus.AutoPaused, () => {
                    if (playing && filePath) {
                        logToRenderer('Autopaused, check connection...');
                    }
                });
            
                player.on('error', (error) => {
                    logToRenderer('Error playing audio: ', error);
                });

                audioResource = createAudioResource(readableStream);
                player.play(audioResource);
                logToRenderer('Player state: ' + player.state.status);
                while (player.state.status == AudioPlayerStatus.Buffering) {
                    await sleep(10);
                }
                logToRenderer('Player state: ' + player.state.status);
                playing = true;
            }
            else {
                logToRenderer('Failed to create readable stream');
            }
        }

        await playResource();
    }

    function pauseAudio() {
        if (player && player.state.status != AudioPlayerStatus.Paused) {
            player.pause(true);
            logToRenderer('Audio paused: ' + player.state.status);
        }
        else {
            logToRenderer('No audio is currently playing: ' + player.state.status);
        }
    }

    function resumeAudio() {
        if (player && player.state.status != AudioPlayerStatus.Playing) {
            player.unpause();
            logToRenderer('Audio resumed: ' + player.state.status);
        }
        else {
            logToRenderer('Audio is not paused: ' + player.state.status);
        }
    }

    async function checkStartResume(filePath) {
        if (filePath && currentTrack && filePath == currentTrack) {
            if (player.state.status != AudioPlayerStatus.Playing) {
                logToRenderer('Resuming audio: ' + player.state.status);
                resumeAudio();
            }
            else {
                logToRenderer('Track is already playing: ' + player.state.status);
            }
        }
        else {
            logToRenderer('Playing new track: ' + player.state.status + ' ' + filePath);
            await playAudioInVoiceChannel(filePath);
        }
        currentTrack = filePath;
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