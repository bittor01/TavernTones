const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { shell } = require('electron');
const axios = require('axios');
const EncounterBuilder = require('./EncounterBuilder.js');

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
        this.encounterBuilder = new EncounterBuilder(this.fiveEToolsParser);
        this.initializationPromise = this.encounterBuilder.initialize();
        this.lastResponse = null;
        BOT_ROLE_ID = config.BOT_ROLE_ID;
        DEFAULT_LOCAL_FOLDER = config.DEFAULT_LOCAL_FOLDER;
    }

    async _sendHelpEmbed(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            .addFields(
                { name: '!ping', value: 'Test to see if the bot is working.' },
                { name: '!create en <creature>', value: 'Starts the interactive encounter builder.' },
                { name: '!5e <query>', value: 'Search all 5etools data by name.' },
                { name: '!spell <query>', value: 'Search for a spell by name.' },
                { name: '!item <query>', value: 'Search for an item by name.' },
                { name: '!monster <query>', value: 'Search for a monster by name.' },
                { name: '!feat <query>', value: 'Search for a feat by name.' },
                { name: '!race <query>', value: 'Search for a race by name.' },
                { name: '!background <query>', value: 'Search for a background by name.' },
                { name: '!deep <query>', value: 'Search all 5etools data by name and content.' },
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

    async _handleEncounterCreatureSearch(message, results, query) {
        if (!results || results.length === 0) {
            await message.reply(`I couldn't find any creatures matching "${query}".`);
            return;
        }

        if (results.length > 25) {
            await message.reply(`I found over 25 results for "${query}". Please be more specific.`);
            return;
        }

        const options = results.map(item => ({
            label: item.name,
            description: `CR: ${item.cr} | Source: ${item.source}`,
            value: `${item.category}|${item.source}|${item.name}`.substring(0, 100)
        }));

        const creatureSelectMenu = new StringSelectMenuBuilder()
            .setCustomId('encounter-creature-select')
            .setPlaceholder('Select the main creature')
            .addOptions(options);

        const difficultySelectMenu = new StringSelectMenuBuilder()
            .setCustomId('encounter-difficulty-select')
            .setPlaceholder('Select encounter difficulty')
            .addOptions([
                { label: 'Low', value: 'low' },
                { label: 'Moderate', value: 'moderate' },
                { label: 'High', value: 'high' },
            ]);

        const proceedButton = new ButtonBuilder()
            .setCustomId('encounter-proceed-button')
            .setLabel('Proceed')
            .setStyle(ButtonStyle.Success);

        const row1 = new ActionRowBuilder().addComponents(creatureSelectMenu);
        const row2 = new ActionRowBuilder().addComponents(difficultySelectMenu);
        const row3 = new ActionRowBuilder().addComponents(proceedButton);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Encounter Builder`)
            .setDescription(`Found ${results.length} creatures matching "${query}".\nPlease select a creature and a difficulty, then click "Proceed".`);

        await message.reply({ embeds: [embed], components: [row1, row2, row3] });
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

                    case content.startsWith('!5e'): {
                        logToRenderer('5e command detected');
                        const query = content.substring('!5e'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !5e <search term>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchAllByName(query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!spell'): {
                        logToRenderer('Spell command detected');
                        const query = content.substring('!spell'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !spell <spell name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('spells', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!item'): {
                        logToRenderer('Item command detected');
                        const query = content.substring('!item'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !item <item name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('items', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

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

                    case content.startsWith('!feat'): {
                        logToRenderer('Feat command detected');
                        const query = content.substring('!feat'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !feat <feat name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('feats', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!background'): {
                        logToRenderer('Background command detected');
                        const query = content.substring('!background'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !background <background name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('backgrounds', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!race'): {
                        logToRenderer('Race command detected');
                        const query = content.substring('!race'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !race <race name>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByName('races', query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!deep'): {
                        logToRenderer('Deep search command detected');
                        const query = content.substring('!deep'.length).trim();
                        if (!query) {
                            await message.reply('Please provide a search term. Usage: `@Bot !deep <search term>`');
                            break;
                        }
                        const results = await this.fiveEToolsParser.searchByContent(query);
                        await this._handle5eSearch(message, results, query);
                        break;
                    }

                    case content.startsWith('!create en') || content.startsWith('!create enc') || content.startsWith('!create encounter'): {
                        logToRenderer('Create Encounter command detected');
                        await this.initializationPromise; // Ensure monster data is loaded
                        const commandMatch = content.match(/!create\s+(?:en|enc|encounter)\s+(.+)/i);
                        if (!commandMatch || !commandMatch[1]) {
                            await message.reply('Usage: `@Bot !create en <creature name>`');
                            break;
                        }

                        const creatureName = commandMatch[1].trim().replace(/_/g, ' ');
                        const results = await this.fiveEToolsParser.searchByName('bestiary', creatureName);
                        await this._handleEncounterCreatureSearch(message, results, creatureName);
                        break;
                    }

                    case content.startsWith('!en'): {
                        logToRenderer('Encounter table command detected');
                        const invalidCharsRegex = /[.,:;\/\\?*"<>|&]+/g;
                        const commandBody = content.substring('!en'.length).trim();
                        const args = commandBody.replace(invalidCharsRegex, "").trim().split(/\s+/);

                        // Parse weights and table names
                        const tableEntries = [];
                        let validArgs = true;
                        for (let i = 0; i < args.length; i += 2) {
                            const weight = parseInt(args[i], 10);
                            const tableName = args[i + 1];

                            if (isNaN(weight) || weight <= 0 || !tableName) {
                                await message.reply('Invalid format. Please ensure weights are positive integers and table names are valid.');
                                validArgs = false;
                                break;
                            }
                            tableEntries.push({ weight, tableName });
                        }

                        if (!validArgs) {
                            break;
                        }
                        if (tableEntries.length === 0) {
                             await message.reply('No table arguments provided. Please specify weights and table names.');
                             break;
                        }

                        const result = await rollFromTable("encountertables", tableEntries, message.channel.id);

                        if (result.success) {
                            const finalMessage = `Effect: ||${result.text}||`;
                            await message.reply(finalMessage);
                        } else {
                            await message.reply(result.message);
                        }
                        break;
                    }

                    case content.startsWith('!su'):
                        logToRenderer('Surge command detected');
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
                        logToRenderer('Shield command detected');
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

                    case content.includes('!ma'):
                        logToRenderer('Magic Item command detected');
                        const maEmbed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle('Magic Item Generator')
                            .setDescription('Configure your magic item generation using the components below.');

                        const modeSelect = new StringSelectMenuBuilder()
                            .setCustomId('ma-mode-select')
                            .setPlaceholder('Select Mode')
                            .addOptions([
                                { label: 'Loot', value: 'loot', default: true },
                                { label: 'Shop', value: 'shop' }
                            ]);

                        const sizeSelect = new StringSelectMenuBuilder()
                            .setCustomId('ma-size-select')
                            .setPlaceholder('Select Size')
                            .addOptions([
                                { label: 'Huge', value: 'Huge' },
                                { label: 'Large', value: 'Large' },
                                { label: 'Average', value: 'Average', default: true },
                                { label: 'Small', value: 'Small' },
                                { label: 'Tiny', value: 'Tiny' }
                            ]);

                        const configureButton = new ButtonBuilder()
                            .setCustomId('ma-configure-button')
                            .setLabel('Configure & Generate')
                            .setStyle(ButtonStyle.Primary);

                        const cancelButton = new ButtonBuilder()
                            .setCustomId('ma-cancel-button')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary);

                        const row1 = new ActionRowBuilder().addComponents(modeSelect);
                        const row2 = new ActionRowBuilder().addComponents(sizeSelect);
                        const row3 = new ActionRowBuilder().addComponents(configureButton, cancelButton);

                        await message.reply({ embeds: [maEmbed], components: [row1, row2, row3] });
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
}

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
        return { success: false, message: `Error loading or parsing tables: ${erroredTableNames}` };
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
        logToRenderer(`Error selecting table. Roll: ${tableRoll}, TotalWeight: ${totalWeight}, Tables: ${JSON.stringify(validTables.map(t => ({ tn: t.tableName, w: t.weight })))}`);
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
            "messages": [{ "role": "user", "content": sanitizedPromptTail }],
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


module.exports = CommandHandler;
