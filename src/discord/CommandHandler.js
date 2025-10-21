const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { shell } = require('electron');
const axios = require('axios');
const DropdownHandler = require('./DropdownHandler.js');

// These will be initialized in the constructor
let logToRenderer;
let musicPlayer;
let lastResponse;
let BOT_ROLE_ID;
let DEFAULT_LOCAL_FOLDER;


class CommandHandler {
    constructor(client, logToRendererInstance, musicPlayerInstance, config, fiveEToolsParserInstance) {
        this.client = client;
        logToRenderer = logToRendererInstance;
        musicPlayer = musicPlayerInstance;
        this.fiveEToolsParser = fiveEToolsParserInstance;
        this.lastResponse = null;

        // Store the entire config object
        this.config = config;

        // Destructure for convenience where applicable, but prefer this.config for clarity
        BOT_ROLE_ID = this.config.botRoleId;
        DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath; // Use the new granular path
        this.randomTablesPath = this.config.randomTablesPath;
    }

    async _sendHelpEmbed(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            .addFields(
                { name: '!ping', value: 'Test to see if the bot is working.' },
                { name: '!monster <query>', value: 'Search for a monster by name to add to the initiative tracker.' },
                { name: '!su (!surge)', value: 'Roll on the Wild Magic Surge table.' },
                { name: '!sh (!shield)', value: 'Roll on the Wild Magic Shield table.' },
                { name: '!ro (!roll)', value: 'Roll on random tables. Provide the folder name, then the number of rolls you want to make, then an arbitrary number of weights and tables in pairs. Can be used for things like random weather, random loot, random spells, etc. Example usage: `!ro spells 3 8 lvl1 4 lvl2 2 lvl3 1 lvl4`' },
                { name: '!pl (!play)', value: 'Will play music. You can specify a folder, or specify a folder and a song. Example usages are `!pl`, `!pl chill`, `!pl chill humblewood`.' },
                { name: '!pa (!pause)', value: 'Pauses the current audio.' },
            )
            .setTimestamp();

        if (musicPlayer.isPlaying && musicPlayer.activeFilePath) {
            const albumName = path.basename(path.dirname(musicPlayer.activeFilePath));
            const trackName = path.basename(musicPlayer.activeFilePath, path.extname(musicPlayer.activeFilePath));
            helpEmbed.setFooter({ text: `🎵 Now Playing: ${trackName} from ${albumName}` });
        }

        await message.reply({ embeds: [helpEmbed] });
    }

    async _handle5eSearch(message, results, query) {
        if (!results || results.length === 0) {
            await message.reply(`I couldn't find anything matching "${query}".`);
            return;
        }

        if (results.length > 25) {
            await message.reply(`I found over 25 results for "${query}". Please be more specific.`);
            return;
        }

        const options = results.map(item => ({
            label: item.name,
            description: `Category: ${item.category.charAt(0).toUpperCase() + item.category.slice(1)} | Source: ${item.source}`,
            value: `${item.category}__${item.source}__${item.name}`.substring(0, 100)
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('5e-result-select')
            .setPlaceholder('Select an item to view details')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Search Results for "${query}"`)
            .setDescription(`I found ${results.length} results. Please select one from the dropdown below.`);

        await message.reply({ embeds: [embed], components: [row] });
    }

    async handleMessage(message) {
        // Ignore messages from the bot itself
        if (message.author.bot) {
            logToRenderer('Ignoring my own message.');
            return;
        }

        logToRenderer(`Message received: ${message.content}`); // Log received messages

        if (message.mentions.has(this.client.user) || message.mentions.roles.has(BOT_ROLE_ID)) { // Check if the bot is mentioned
            const userId = message.author.id;

            // Strip the mention from the message content
            const commandBody = message.content.replace(/<@.?[0-9]+>/, '').trim();
            const content = commandBody.toLowerCase();

            try {
                let typingInterval;
                switch (true) {
                    case content.startsWith('!ping'):
                        logToRenderer('Ping command detected'); // Log when ping command is detected
                        await message.reply('Pong!');
                        logToRenderer('Ping successfully ponged.');
                        break;

                    case content.startsWith('!monster'): {
                        logToRenderer('Monster command detected');
                        const query = content.substring('!monster'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !monster <monster name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('bestiary', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!su'):
                        logToRenderer('Surge command detected');
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');
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
                        logToRenderer('Shield command detected');
                        const shieldFilePath = path.join(this.randomTablesPath, 'shield.json');
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


                    case content.includes('!ro'):
                        logToRenderer('Roll command detected');
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

                        // Validate folderName and prevent path traversal
                        const folderPath = path.join(this.randomTablesPath, folderName);
                        const resolvedPath = path.resolve(folderPath);
                        const resolvedBasePath = path.resolve(this.randomTablesPath);

                        if (!resolvedPath.startsWith(resolvedBasePath)) {
                            await message.reply(`'${folderName}' is not a valid folder.`);
                            break;
                        }

                        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
                            await message.reply(`Folder '${folderName}' not found or is not a directory.`);
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
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
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
                        logToRenderer('Inspect command detected');
                        if (this.lastResponse && this.lastResponse.choices && this.lastResponse.choices[0].references) {
                            const thread = await message.startThread({
                                name: 'References',
                                autoArchiveDuration: 15,
                                reason: 'References from the last query'
                            });
                            for (const ref of this.lastResponse.choices[0].references) {
                                await thread.send(`${ref.file}\n\`\`\`${ref.text}\`\`\``);
                                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before sending the next message
                            }
                        } else {
                            await message.reply('No references available from the last response.');
                        }
                        break;

                    case content.includes('!pl'):
                        logToRenderer('Play command detected');

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

                        let songFilePath = await this.findMusic(parsedFolder, parsedSong);

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
                                const songNameForMessage = path.parse(songFilePath).name;
                                await message.reply(`Okay, playing: **${songNameForMessage}**.`);
                                await musicPlayer.playFile(songFilePath);
                            } else {
                                await message.reply("Sorry, I couldn't find the music you were looking for.");
                            }
                        } else {
                            await message.reply("Sorry, I couldn't find the music you were looking for.");
                        }
                        break;

                    case content.includes('!pa'):
                        logToRenderer('Pause command detected');
                        if (musicPlayer.isPlaying) {
                            musicPlayer.pause();
                            await message.reply('Playback paused.');
                        } else {
                            await message.reply('Nothing is currently playing to pause.');
                        }
                        break;

                    case content.includes('!h'):
                        logToRenderer('Help command detected');
                        await this._sendHelpEmbed(message);
                        break;

                    default:
                        logToRenderer('No recognized command found.');
                        await this._sendHelpEmbed(message);
                        break;
                }
            } catch (error) {
                logToRenderer('Error processing command: ' + error.message);
            }
        }
    }

    getValidTableFolders() {
        const randomTablesPath = this.randomTablesPath;
        try {
            const allEntries = fs.readdirSync(randomTablesPath, { withFileTypes: true });
            const directories = allEntries
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            return directories;
        } catch (error) {
            logToRenderer(`Error reading '${randomTablesPath}': ${error.message}`);
            return [];
        }
    }

    async rollFromTable(folderName, tablesConfig, channelId) {
        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);
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

        const tables = tablesConfig.map(entry => {
            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
            try {
                const tableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return { ...entry, data: tableData, filePath: filePath };
            } catch (error) {
                logToRenderer(`Error loading table ${entry.tableName}: ${error.message}`);
                return { ...entry, data: null, filePath: filePath, error: true };
            }
        });

        const validTables = tables.filter(table => !table.error && table.data);
        if (validTables.length !== tablesConfig.length) {
            const erroredTableNames = tables.filter(t => t.error).map(t => t.tableName).join(', ');
            return { success: false, message: `Error loading or parsing tables: ${erroredTableNames}` };
        }

        const totalWeight = validTables.reduce((sum, entry) => sum + entry.weight, 0);
        if (totalWeight <= 0) {
            return { success: false, message: "Total weight of tables must be positive." };
        }

        const roller = new DiceRoller();
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
            logToRenderer(`Error selecting table. Roll: ${tableRoll}, TotalWeight: ${totalWeight}, Tables: ${JSON.stringify(validTables.map(t => ({ tn: t.tableName, w: t.weight })))}`);
            return { success: false, message: "Error selecting table." };
        }

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

        if (effect.unique) {
            if (!Array.isArray(effect.used)) {
                effect.used = [];
            }
            effect.used.push(channelId);

            const effectIndexInOriginalTable = selectedTableEntry.data.findIndex(e => e.text === effect.text);
            if (effectIndexInOriginalTable !== -1) {
                selectedTableEntry.data[effectIndexInOriginalTable] = effect;
                try {
                    fs.writeFileSync(selectedTableEntry.filePath, JSON.stringify(selectedTableEntry.data, null, 2), 'utf8');
                    logToRenderer(`Updated unique effect usage in ${selectedTableEntry.filePath}`);
                } catch (error) {
                    logToRenderer(`Error writing updated table ${selectedTableEntry.filePath}: ${error.message}`);
                }
            } else {
                logToRenderer(`Could not find effect in original table data to update 'used' status. This is unexpected. Effect: ${effect.text}`);
            }
        }

        return { success: true, text: effect.text };
    }

    async findMusic(folderSearchTerm, songSearchTerm) {
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
            const musicPath = this.config.defaultMusicPath;
            if (!musicPath || !fs.existsSync(musicPath)) {
                logToRenderer(`findMusic: Error - Default Music Path ('${musicPath}') is not defined or does not exist.`);
                return null;
            }

            // Get all directory names from the configured music path
            const allEntities = fs.readdirSync(musicPath, { withFileTypes: true });
            const subDirectories = allEntities.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);

            if (subDirectories.length === 0) {
                logToRenderer(`findMusic: No sub-folders found within the configured music path ('${musicPath}').`);
                return null;
            }

            // Attempt to match the targetFolderToSearch with a directory name (substring match, case-insensitive)
            const targetFolderLower = targetFolderToSearch.toLowerCase();
            for (const dirName of subDirectories) {
                if (dirName.toLowerCase().includes(targetFolderLower)) {
                    actualFolderPath = path.join(musicPath, dirName);
                    foundFolderOriginalName = dirName; // Store the actual name of the matched folder
                    logToRenderer(`findMusic: Successfully matched folder: name='${foundFolderOriginalName}', path='${actualFolderPath}'.`);
                    break; // Use the first match
                }
            }

            if (!actualFolderPath) {
                logToRenderer(`findMusic: No folder found containing '${targetFolderToSearch}' within '${musicPath}'.`);
                return null; // Folder not found
            }

        } catch (error) {
            logToRenderer(`findMusic: Exception while accessing or reading the configured music path: ${error.message}`);
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
                logToRenderer(`findMusic: No audio files (.wav, .lnk) found in the folder '${foundFolderOriginalName}'.`);
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

async function askGPT4All(prompt, model, addSuffix = true) {
    let chatmodel = 'Meta-Llama-3-8B-Instruct.Q4_0.gguf'; // Default to ll model
    if (model === 're') {
        chatmodel = 'qwen2.5-coder-7b-instruct-q4_0.gguf';
    }

    // Sanitize the prompt to prevent command injection
    const sanitizedPrompt = prompt.replace(/"/g, '\\"');
    let finalPrompt = sanitizedPrompt;

    if (addSuffix) {
        const tailPrompt = '\n - Thanks for the help!';
        finalPrompt += tailPrompt;
    }

    try {
        const response = await axios.post('http://localhost:4891/v1/chat/completions', {
            "model": chatmodel,
            "messages": [{ "role": "user", "content": finalPrompt }],
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
module.exports = CommandHandler;