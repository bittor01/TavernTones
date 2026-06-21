// Process: const fs = require('fs')
const fs = require('fs');
const path = require('path');
// Process: const  DiceRoller  = require('@dice-roller/rpg-dice-roller')
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
// Process: const  shell  = require('electron')
const { shell } = require('electron');
const axios = require('axios');
// Process: const DropdownHandler = require('./DropdownHandler.js')
const DropdownHandler = require('./DropdownHandler.js');
const { sanitizePath, splitMessage } = require('../backend/core/utils.js');

// Process: let logToRenderer
let logToRenderer;
let musicPlayer;
// Process: let lastResponse
let lastResponse;
let BOT_ROLE_ID;
// Process: let DEFAULT_LOCAL_FOLDER
let DEFAULT_LOCAL_FOLDER;

class CommandHandler {
    // Process: constructor(client, logToRendererInstance, musicPlayerIns...
    constructor(client, logToRendererInstance, musicPlayerInstance, config, fiveEToolsParserInstance) {
        this.client = client;
        // Process: logToRenderer = logToRendererInstance
        logToRenderer = logToRendererInstance;
        musicPlayer = musicPlayerInstance;
        // Process: this.fiveEToolsParser = fiveEToolsParserInstance
        this.fiveEToolsParser = fiveEToolsParserInstance;
        this.lastResponse = null;
        // Process: this.config = config
        this.config = config;
        BOT_ROLE_ID = this.config.botRoleId;
        // Process: DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath
        DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath;
        this.randomTablesPath = this.config.randomTablesPath;
    // Process:
    }

    /**
     * Scans a directory and lists all supported audio files.
     * @param {string} folderPath - The directory path to scan.
     * @returns {string[]} An array of full paths to audio files.
     */
    getFolderSongs(folderPath) {
        // Return empty if the path doesn't exist to avoid errors
        // Process: if (!fs.existsSync(folderPath)) return []
        if (!fs.existsSync(folderPath)) return [];
        // Read the directory contents
        return fs.readdirSync(folderPath)
            // Filter for supported audio extensions and Windows shortcuts
            // Process: .filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(pa...
            .filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()))
            // Map relative filenames to full absolute paths
            .map(f => path.join(folderPath, f));
    // Process:
    }

    /**
     * Searches recursively for a song file matching a partial query name.
     * @param {string} query - The partial name of the song to find.
     * @returns {string|null} The full path to the song, or null if not found.
     */
    findSong(query) {
        // Retrieve the root music path from configuration
        // Process: const musicPath = this.config.defaultMusicPath
        const musicPath = this.config.defaultMusicPath;
        // Return null if path is invalid or missing
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        /**
         * Helper to recursively find all files in a directory tree.
         */
        // Process: const getAllFiles = (dir, results = []) =>
        const getAllFiles = (dir, results = []) => {
            // List all files and folders in current directory
            const list = fs.readdirSync(dir);
            // Process: list.forEach(file =>
            list.forEach(file => {
                // Construct full path for current item
                file = path.join(dir, file);
                // Get filesystem status for item
                // Process: const stat = fs.statSync(file)
                const stat = fs.statSync(file);
                // If it's a directory, recurse into it
                if (stat && stat.isDirectory()) getAllFiles(file, results);
                // Process: else
                else {
                    // Check if file has a supported audio extension
                    const ext = path.extname(file).toLowerCase();
                    // Process: if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) resul...
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(file);
                }
            // Process: )
            });
            return results;
        // Process:
        };

        // Gather all audio files from the music directory
        const allFiles = getAllFiles(musicPath);
        // Search for a file where the name includes the user's query (case-insensitive)
        // Process: return allFiles.find(f => path.parse(f).name.toLowerCase(...
        return allFiles.find(f => path.parse(f).name.toLowerCase().includes(query.toLowerCase()));
    }

    /**
     * Finds a directory within the music root matching a partial name.
     * @param {string} query - The partial name of the folder.
     * @returns {string|null} The full path to the folder, or null.
     */
    // Process: findFolder(query)
    findFolder(query) {
        // Retrieve the base music path
        const musicPath = this.config.defaultMusicPath;
        // Return null if base path is inaccessible
        // Process: if (!musicPath || !fs.existsSync(musicPath)) return null
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        // List all subdirectories in the music root
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            // Process: .filter(d => d.isDirectory()).map(d => d.name)
            .filter(d => d.isDirectory()).map(d => d.name);

        // First attempt: Check for an exact match (case-insensitive)
        const exact = subDirs.find(d => d.toLowerCase() === query.toLowerCase());
        // Return full path if exact match is found
        // Process: if (exact) return path.join(musicPath, exact)
        if (exact) return path.join(musicPath, exact);

        // Second attempt: Check for a partial match
        const partial = subDirs.find(d => d.toLowerCase().includes(query.toLowerCase()));
        // Return full path if partial match is found
        // Process: if (partial) return path.join(musicPath, partial)
        if (partial) return path.join(musicPath, partial);

        // Return null if no matches were found
        return null;
    // Process:
    }

    /**
     * Sends a help embed to the message channel.
     * @param {object} message - The original Discord message that triggered the help.
     * @private
     */
    async _sendHelpEmbed(message) {
        // Construct a new formatted embed with command descriptions
        // Process: const helpEmbed = new EmbedBuilder()
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            // Process: .setTitle('TavernTones Bot Commands')
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            // Process: .addFields(
            .addFields(
                { name: '!ping', value: 'Test to see if the bot is working.' },
                // Process: name: '!su (!surge)', value: 'Roll on the Wild Magic Surg...
                { name: '!su (!surge)', value: 'Roll on the Wild Magic Surge table.' },
                { name: '!sh (!shield)', value: 'Roll on the Wild Magic Shield table.' },
                // Process: name: '!ro (!roll)', value: 'Roll on random tables. Usage...
                { name: '!ro (!roll)', value: 'Roll on random tables. Usage: `!ro spells 3 8 lvl1 4 lvl2`' },
                { name: '!dr (!dice)', value: 'Roll arbitrary dice using RPG notation. Example: `!dr 2d20kh1 + 5`' },
                // Process: name: '!dh (!dicehelp)', value: 'Explains how to use the ...
                { name: '!dh (!dicehelp)', value: 'Explains how to use the RPG dice notation.' },
                { name: '!pl (!play)', value: 'Play music. Usage: `!pl`, `!pl chill`, `!pl chill humblewood`. Search hierarchy: Exact folder > Partial folder > Exact root file > Partial root file > Deep recursive search.' },
                // Process: name: '!pa (!pause)', value: 'Pauses the current audio.' ,
                { name: '!pa (!pause)', value: 'Pauses the current audio.' },
                { name: '!st (!stop)', value: 'Stops the current audio and clears the stack.' },
            // Process: )
            )
            .setTimestamp();

        // If music is currently playing, append "Now Playing" info to footer
        // Process: if (musicPlayer.isPlaying && musicPlayer.stack.length > 0...
        if (musicPlayer.isPlaying && musicPlayer.stack.length > 0 && musicPlayer.currentIndex >= 0) {
            // Get the current track from the player stack
            const currentTrack = musicPlayer.stack[musicPlayer.currentIndex];
            // Extract the parent folder name as the "album"
            // Process: const albumName = path.basename(path.dirname(currentTrack))
            const albumName = path.basename(path.dirname(currentTrack));
            // Extract the filename without extension as the track name
            const trackName = path.basename(currentTrack, path.extname(currentTrack));
            // Set the footer text to show what's playing
            // Process: helpEmbed.setFooter( text: `🎵 Now Playing: $trackName fro...
            helpEmbed.setFooter({ text: `🎵 Now Playing: ${trackName} from ${albumName}` });
        }

        // Reply to the user with the help embed
        // Process: await message.reply( embeds: [helpEmbed] )
        await message.reply({ embeds: [helpEmbed] });
    }

    /**
     * Main entry point for processing incoming Discord messages.
     * @param {object} message - The Discord message object.
     */
    // Process: async handleMessage(message)
    async handleMessage(message) {
        // Ignore messages from other bots to prevent loops
        if (message.author.bot) return;
        // Log the incoming message to the application UI
        // Process: logToRenderer(`Message received: $message.content`)
        logToRenderer(`Message received: ${message.content}`);

        // Check if the bot or its role was mentioned
        if (message.mentions.has(this.client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
            // Remove the mention from the message content to isolate the command
            // Process: const commandBody = message.content.replace(/<@.?[0-9]+>/...
            const commandBody = message.content.replace(/<@.?[0-9]+>/, '').trim();
            // Convert to lowercase for case-insensitive matching
            const content = commandBody.toLowerCase();

            // Process: try
            try {
                // Switch based on the command prefix
                switch (true) {
                    // Process: case content.startsWith('!ping'):
                    case content.startsWith('!ping'):
                        // Reply with "Pong!" to indicate the bot is alive
                        await message.reply('Pong!');
                        // Process: break
                        break;

                    case content.startsWith('!su'):
                        // Construct the full path to the surge table JSON file
                        // Process: const surgeFilePath = path.join(this.randomTablesPath, 's...
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');
                        // Verify if the surge file exists before attempting to read it
                        if (!fs.existsSync(surgeFilePath)) {
                            // Inform the user that the file is missing
                            // Process: await message.reply("❌ **Surge table not found.** Please ...
                            await message.reply("❌ **Surge table not found.** Please ensure 'surge.json' exists in your random tables folder.");
                            // Exit the switch case for surge
                            break;
                        // Process:
                        }
                        // Read and parse the surge table data from the JSON file
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        // Select a random effect from the table for the user
                        // Process: const surgeEffect = getRandomEffect(surgeData, message.au...
                        const surgeEffect = getRandomEffect(surgeData, message.author.id);
                        // If an effect was found, proceed to process it
                        if (surgeEffect) {
                            // Evaluate any dice expressions within the effect text
                            // Process: const evaluatedText = evaluateDiceRolls(surgeEffect.text)
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            // Prepare the final message, including a unique indicator if applicable
                            const responseText = evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : '');
                            // Split the response if it exceeds Discord's character limit
                            // Process: const chunks = splitMessage(responseText)
                            const chunks = splitMessage(responseText);
                            // Reply with the first chunk
                            await message.reply(chunks[0]);
                            // If there are more chunks, send them in the same channel
                            // Process: for (let i = 1 i < chunks.length i++)
                            for (let i = 1; i < chunks.length; i++) {
                                await message.channel.send(chunks[i]);
                            // Process:
                            }
                            // If the effect was unique, mark it as used by this user
                            if (surgeEffect.unique) {
                                // Initialize the used array if it doesn't exist
                                // Process: if (!Array.isArray(surgeEffect.used)) surgeEffect.used = []
                                if (!Array.isArray(surgeEffect.used)) surgeEffect.used = [];
                                // Add the user's ID to the list of people who have used this effect
                                surgeEffect.used.push(message.author.id);
                                // Save the updated surge table back to disk
                                // Process: fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData,...
                                fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData, null, 2), 'utf8');
                            }
                        // Process: else
                        } else {
                            // Notify the user if no unique effects are left for them
                            await message.reply('No available effects for you.');
                        // Process:
                        }
                        // Finish processing the surge command
                        break;

                    // Process: case content.includes('!sh'):
                    case content.includes('!sh'):
                        // Construct the full path to the shield table JSON file
                        const shieldFilePath = path.join(this.randomTablesPath, 'shield.json');
                        // Verify if the shield file exists before attempting to read it
                        // Process: if (!fs.existsSync(shieldFilePath))
                        if (!fs.existsSync(shieldFilePath)) {
                            // Inform the user that the file is missing
                            await message.reply("❌ **Shield table not found.** Please ensure 'shield.json' exists in your random tables folder.");
                            // Exit the switch case for shield
                            // Process: break
                            break;
                        }
                        // Read and parse the shield table data from the JSON file
                        // Process: const shieldData = JSON.parse(fs.readFileSync(shieldFileP...
                        const shieldData = JSON.parse(fs.readFileSync(shieldFilePath, 'utf8'));
                        // Select a random effect from the table for the user
                        const shieldEffect = getRandomEffect(shieldData, message.author.id);
                        // If an effect was found, proceed to process it
                        // Process: if (shieldEffect)
                        if (shieldEffect) {
                            // Evaluate any dice expressions within the effect text
                            const evaluatedText = evaluateDiceRolls(shieldEffect.text);
                            // Prepare the final message, including a unique indicator if applicable
                            // Process: const shieldResponseText = evaluatedText + (shieldEffect....
                            const shieldResponseText = evaluatedText + (shieldEffect.unique ? '  - 🥳Unique!🎊' : '');
                            // Split the response if it exceeds Discord's character limit
                            const shieldChunks = splitMessage(shieldResponseText);
                            // Reply with the first chunk
                            // Process: await message.reply(shieldChunks[0])
                            await message.reply(shieldChunks[0]);
                            // If there are more chunks, send them in the same channel
                            for (let i = 1; i < shieldChunks.length; i++) {
                                // Process: await message.channel.send(shieldChunks[i])
                                await message.channel.send(shieldChunks[i]);
                            }
                            // If the effect was unique, mark it as used by this user
                            // Process: if (shieldEffect.unique)
                            if (shieldEffect.unique) {
                                // Initialize the used array if it doesn't exist
                                if (!Array.isArray(shieldEffect.used)) shieldEffect.used = [];
                                // Add the user's ID to the list of people who have used this effect
                                // Process: shieldEffect.used.push(message.author.id)
                                shieldEffect.used.push(message.author.id);
                                // Save the updated shield table back to disk
                                fs.writeFileSync(shieldFilePath, JSON.stringify(shieldData, null, 2), 'utf8');
                            // Process:
                            }
                        } else {
                            // Notify the user if no unique effects are left for them
                            // Process: await message.reply('No available effects for you.')
                            await message.reply('No available effects for you.');
                        }
                        // Finish processing the shield command
                        // Process: break
                        break;

                    case content.includes('!ro'):
                        // Find the start of the roll command
                        // Process: const roIndex = message.content.toLowerCase().indexOf('!ro')
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        // Extract the arguments following the command
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        // Split the arguments by whitespace
                        // Process: const roArgs = roArgsStr.split(/\s+/)
                        const roArgs = roArgsStr.split(/\s+/);
                        // Validate that we have at least folder name, count, and one weight/table pair
                        if (roArgs.length < 3) {
                            // Process: await message.reply('Invalid command format. Usage: @TT !...
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <count> <w1> <t1> ...');
                            break;
                        // Process:
                        }
                        // Sanitize the folder name to prevent path traversal
                        const folderName = sanitizePath(roArgs[0]);
                        // Parse the number of times to roll
                        // Process: const iterationCount = parseInt(roArgs[1], 10)
                        const iterationCount = parseInt(roArgs[1], 10);
                        // Remaining arguments are the tables and their weights
                        const tableArgs = roArgs.slice(2);
                        // Get the list of folders that actually exist in the table path
                        // Process: const validFolders = this.getValidTableFolders()
                        const validFolders = this.getValidTableFolders();
                        // Check if the requested folder is in the valid list
                        if (!validFolders.includes(folderName)) {
                            // Suggest existing folders if the input was wrong
                            // Process: const suggestion = validFolders.length > 0 ? `Available f...
                            const suggestion = validFolders.length > 0 ? `Available folders: ${validFolders.join(', ')}` : "No random table folders found in configuration.";
                            await message.reply(`❌ **Folder '${folderName}' not found.**\n${suggestion}`);
                            // Process: break
                            break;
                        }
                        // Validate iteration count bounds (1-999)
                        // Process: if (isNaN(iterationCount) || iterationCount <= 0 || itera...
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 999) {
                            await message.reply('Invalid iteration count.');
                            // Process: break
                            break;
                        }
                        // Arrays to hold prepared table configs and errors
                        // Process: const roTableEntries = []
                        const roTableEntries = [];
                        const missingTables = [];
                        // Construct the path to the specific encounter folder
                        // Process: const encounterTablesFolder = path.join(this.randomTables...
                        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);

                        // Loop through pairs of weight and table name
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            // Parse the weight for the table
                            // Process: const weight = parseInt(tableArgs[i], 10)
                            const weight = parseInt(tableArgs[i], 10);
                            // Sanitize the table name input
                            const tableName = sanitizePath(tableArgs[i + 1]);
                            // Skip if no table name was provided in this pair
                            // Process: if (!tableName) continue
                            if (!tableName) continue;

                            // Check if the table JSON file exists
                            const filePath = path.join(encounterTablesFolder, `${tableName}.json`);
                            // Process: if (!fs.existsSync(filePath))
                            if (!fs.existsSync(filePath)) {
                                // Add to missing list if not found
                                missingTables.push(tableName);
                            // Process: else
                            } else {
                                // Save the valid weight and table name for rolling
                                roTableEntries.push({ weight, tableName });
                            // Process:
                            }
                        }

                        // Report any missing tables to the user
                        // Process: if (missingTables.length > 0)
                        if (missingTables.length > 0) {
                            // Get a list of actual files in the folder for suggestions
                            const available = fs.readdirSync(encounterTablesFolder)
                                // Process: .filter(f => f.endsWith('.json'))
                                .filter(f => f.endsWith('.json'))
                                .map(f => f.replace('.json', ''));
                            // Process: await message.reply(`❌ **Missing tables in '$folderName':...
                            await message.reply(`❌ **Missing tables in '${folderName}':** ${missingTables.join(', ')}\nAvailable: ${available.join(', ')}`);
                            // If no valid tables were found at all, stop here
                            if (roTableEntries.length === 0) break;
                        // Process:
                        }

                        // Start the rolling process
                        await message.reply(`Rolling ${iterationCount} times from '${folderName}'...`);
                        // Create a thread to keep the channel clean from multiple roll results
                        // Process: const thread = await message.startThread( name: `Rolls fr...
                        const thread = await message.startThread({ name: `Rolls from ${folderName}` });
                        // Perform the requested number of rolls
                        for (let i = 0; i < iterationCount; i++) {
                            // Roll from the configured tables
                            // Process: const result = await this.rollFromTable(folderName, roTab...
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
                            // Prepare the result text
                            const rollText = `Roll ${i + 1}: ${result.success ? result.text : result.message}`;
                            // Split the result if it's too long for a single message
                            // Process: const rollChunks = splitMessage(rollText)
                            const rollChunks = splitMessage(rollText);
                            // Send all chunks to the thread
                            for (const chunk of rollChunks) {
                                // Process: await thread.send(chunk)
                                await thread.send(chunk);
                            }
                            // Small delay to prevent hitting Discord rate limits
                            // Process: await new Promise(r => setTimeout(r, 100))
                            await new Promise(r => setTimeout(r, 100));
                        }
                        // Finish processing the roll command
                        // Process: break
                        break;

                    case content.includes('!dr'): {
                        // Extract the dice notation from the command string
                        // Process: const drMatch = content.match(/!dr\s+(.*)/)
                        const drMatch = content.match(/!dr\s+(.*)/);
                        if (drMatch && drMatch[1]) {
                            // Capture the notation after !dr
                            // Process: const notation = drMatch[1]
                            const notation = drMatch[1];
                            try {
                                // Initialize the dice roller
                                // Process: const roller = new DiceRoller()
                                const roller = new DiceRoller();
                                // Perform the roll based on user notation
                                const roll = roller.roll(notation);
                                // Reply with the total and a detailed breakdown
                                // Process: await message.reply(`🎲 **Roll Result:** $roll.total\n\`$r...
                                await message.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
                            } catch (e) {
                                // Handle invalid dice notation errors
                                // Process: await message.reply("Invalid dice notation. Use `!dh` for...
                                await message.reply("Invalid dice notation. Use `!dh` for help.");
                            }
                        // Process: else
                        } else {
                            // Prompt user for correct usage if no notation provided
                            await message.reply("Usage: `!dr 2d20kh1 + 5` (RPG dice notation)");
                        // Process:
                        }
                        break;
                    // Process:
                    }

                    case content.includes('!dh'): {
                        // Create a help embed explaining dice syntax
                        // Process: const embed = new EmbedBuilder()
                        const embed = new EmbedBuilder()
                            .setTitle("RPG Dice Notation Help")
                            // Process: .setColor(0x00FF00)
                            .setColor(0x00FF00)
                            .setDescription("TavernTones uses the `@dice-roller/rpg-dice-roller` library.")
                            // Process: .addFields(
                            .addFields(
                                { name: "Basic", value: "`2d20`, `1d12 + 4`, `3d6 - 2`" },
                                // Process: name: "Keep/Drop", value: "`4d6kh3` (Keep Highest 3), `2d...
                                { name: "Keep/Drop", value: "`4d6kh3` (Keep Highest 3), `2d20kl1` (Keep Lowest 1), `4d6dl1` (Drop Lowest 1)" },
                                { name: "Exploding", value: "`4d10!` (Explode on max), `4d10!>8` (Explode on 8 or higher)" },
                                // Process: name: "Reroll", value: "`1d20r1` (Reroll 1s), `1d20r<3` (...
                                { name: "Reroll", value: "`1d20r1` (Reroll 1s), `1d20r<3` (Reroll 3 or less)" },
                                { name: "Success/Failure", value: "`10d6>4` (Count dice > 4)" }
                            // Process: )
                            );
                        // Send the dice help embed
                        await message.reply({ embeds: [embed] });
                        // Process: break
                        break;
                    }

                    // Process: case content.includes('!pl'):
                    case content.includes('!pl'): {
                        // Extract the command arguments by splitting on whitespace
                        const parts = content.substring(content.indexOf('!pl')).trim().split(/\s+/);
                        // Process: const commandArgs = parts.slice(1)
                        const commandArgs = parts.slice(1);
                        // Sanitize first argument (folder or song name), defaulting to "chill"
                        const arg1 = sanitizePath(commandArgs[0] || "chill");
                        // Sanitize second argument (song name within folder)
                        // Process: const arg2 = sanitizePath(commandArgs[1])
                        const arg2 = sanitizePath(commandArgs[1]);

                        // Attempt to locate the matching music file on disk
                        let songFilePath = await this.findMusic(arg1, arg2);
                        // Process: if (songFilePath)
                        if (songFilePath) {
                            // Inform the user which track was found
                            await message.reply(`Playing: **${path.parse(songFilePath).name}**`);
                            // Stop any currently playing audio and clear the queue
                            // Process: musicPlayer.clearStack()
                            musicPlayer.clearStack();
                            // Add the new song to the player stack
                            await musicPlayer.addToStack(songFilePath);
                            // Trigger voice channel join if callback is configured
                            // Process: if (this.config.joinVoiceCallback) await this.config.join...
                            if (this.config.joinVoiceCallback) await this.config.joinVoiceCallback();
                            // Start audio playback
                            musicPlayer.play();
                        // Process: else
                        } else {
                            // Notify user if search yielded no results
                            await message.reply("Could not find that music.");
                        // Process:
                        }
                        break;
                    // Process:
                    }

                    case content.includes('!pa'):
                        // Process: musicPlayer.pause()
                        musicPlayer.pause();
                        await message.reply('Paused.');
                        // Process: break
                        break;

                    case content.includes('!st'):
                        // Process: musicPlayer.stop()
                        musicPlayer.stop();
                        musicPlayer.clearStack();
                        // Process: await message.reply('Stopped and cleared stack.')
                        await message.reply('Stopped and cleared stack.');
                        break;

                    // Process: case content.includes('!h'):
                    case content.includes('!h'):
                        await this._sendHelpEmbed(message);
                        // Process: break
                        break;

                    default:
                        // Process: await this._sendHelpEmbed(message)
                        await this._sendHelpEmbed(message);
                        break;
                // Process:
                }
            } catch (error) {
                // Process: logToRenderer('Error: ' + error.message)
                logToRenderer('Error: ' + error.message);
            }
        // Process:
        }
    }

    /**
     * Retrieves all valid subdirectory names in the random tables path.
     * @returns {string[]} List of directory names.
     */
    // Process: getValidTableFolders()
    getValidTableFolders() {
        try {
            // Read directory items with type metadata
            // Process: return fs.readdirSync(this.randomTablesPath,  withFileTyp...
            return fs.readdirSync(this.randomTablesPath, { withFileTypes: true })
                // Filter only for directories
                .filter(d => d.isDirectory()).map(d => d.name);
        // Process: catch (e)
        } catch (e) {
            // Return empty list if directory read fails
            return [];
        // Process:
        }
    }

    /**
     * Executes a weighted roll from a set of tables and returns an effect.
     * @param {string} folderName - The parent folder of the tables.
     * @param {object[]} tablesConfig - Array of objects with weight and tableName.
     * @param {string} channelId - The ID of the channel (used for unique tracking).
     * @returns {object} Result object with success status and text/message.
     */
    // Process: async rollFromTable(folderName, tablesConfig, channelId)
    async rollFromTable(folderName, tablesConfig, channelId) {
        // Construct the base folder path for the encounter type
        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);
        // List to hold validated table data
        // Process: const validTables = []
        const validTables = [];
        // Iterate through requested tables to load their contents
        for (const entry of tablesConfig) {
            // Build full path to specific table JSON
            // Process: const filePath = path.join(encounterTablesFolder, `$entry...
            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
            // Check if file exists before reading
            if (fs.existsSync(filePath)) {
                // Process: try
                try {
                    // Parse the JSON data from the table file
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    // Store the table config along with its loaded data
                    // Process: validTables.push( ...entry, data, filePath )
                    validTables.push({ ...entry, data, filePath });
                } catch (e) {} // Silently ignore parse errors
            // Process:
            }
        }
        // Calculate total weight of all valid tables
        // Process: const totalWeight = validTables.reduce((s, e) => s + e.we...
        const totalWeight = validTables.reduce((s, e) => s + e.weight, 0);
        // Fail if no tables were valid or weights are zero
        if (totalWeight <= 0) return { success: false, message: "No valid tables." };
        // Generate a random number within the total weight range
        // Process: const roll = Math.floor(Math.random() * totalWeight) + 1
        const roll = Math.floor(Math.random() * totalWeight) + 1;
        // Iterate to find which table the roll landed on
        let cum = 0;
        // Process: let selected = null
        let selected = null;
        for (const e of validTables) {
            // Process: cum += e.weight
            cum += e.weight;
            if (roll <= cum) { selected = e; break; }
        // Process:
        }
        // Filter effects from selected table that are either not unique or not yet used in this channel
        const available = selected.data.filter(e => !e.unique || !e.used?.includes(channelId));
        // Fail if no effects are left to draw
        // Process: if (available.length === 0) return  success: false, messa...
        if (available.length === 0) return { success: false, message: "No effects available." };
        // Select a random effect from the remaining pool
        const effect = available[Math.floor(Math.random() * available.length)];
        // If the effect is marked unique, record that it has been used
        // Process: if (effect.unique)
        if (effect.unique) {
            // Initialize usage tracking if it doesn't exist
            if (!effect.used) effect.used = [];
            // Add current channel ID to used list
            // Process: effect.used.push(channelId)
            effect.used.push(channelId);
            // Write updated table data back to disk
            fs.writeFileSync(selected.filePath, JSON.stringify(selected.data, null, 2));
        // Process:
        }
        // Return the final effect text
        return { success: true, text: effect.text };
    // Process:
    }

    /**
     * Comprehensive music search across folders and root files.
     * @param {string} term1 - Primary search term (folder or filename).
     * @param {string} term2 - Secondary search term (filename within folder).
     * @returns {string|null} Path to the matched music file.
     */
    async findMusic(term1, term2) {
        // Get the base music path from config
        // Process: const musicPath = this.config.defaultMusicPath
        const musicPath = this.config.defaultMusicPath;
        // Validate that the music path exists
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        /**
         * Helper to recursively gather all audio files.
         */
        // Process: const getAllFiles = (dir, results = []) =>
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            // Process: list.forEach(file =>
            list.forEach(file => {
                file = path.join(dir, file);
                // Process: const stat = fs.statSync(file)
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) getAllFiles(file, results);
                // Process: else
                else {
                    const ext = path.extname(file).toLowerCase();
                    // Process: if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) resul...
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(file);
                }
            // Process: )
            });
            return results;
        // Process:
        };

        // List subdirectories for folder-based matching
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            // Process: .filter(d => d.isDirectory()).map(d => d.name)
            .filter(d => d.isDirectory()).map(d => d.name);

        // 1. Search for Exact Folder Match
        const exactFolder = subDirs.find(d => d.toLowerCase() === term1.toLowerCase());
        // Process: if (exactFolder)
        if (exactFolder) {
            // Construct full folder path
            const folderPath = path.join(musicPath, exactFolder);
            // List all audio files within the matched folder
            // Process: const files = fs.readdirSync(folderPath).filter(f => ['.m...
            const files = fs.readdirSync(folderPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
            // If a second term was provided, try to find a specific file in the folder
            if (term2) {
                // Process: const match = files.find(f => path.parse(f).name.toLowerC...
                const match = files.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                if (match) return path.join(folderPath, match);
            // Process:
            }
            // If no specific file requested or found, pick a random file from the folder
            if (files.length > 0) return path.join(folderPath, files[Math.floor(Math.random() * files.length)]);
        // Process:
        }

        // 2. Search for Partial Folder Match
        const partialFolder = subDirs.find(d => d.toLowerCase().includes(term1.toLowerCase()));
        // Process: if (partialFolder)
        if (partialFolder) {
            const folderPath = path.join(musicPath, partialFolder);
            // Process: const files = fs.readdirSync(folderPath).filter(f => ['.m...
            const files = fs.readdirSync(folderPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
            if (term2) {
                // Process: const match = files.find(f => path.parse(f).name.toLowerC...
                const match = files.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                if (match) return path.join(folderPath, match);
            // Process:
            }
            if (files.length > 0) return path.join(folderPath, files[Math.floor(Math.random() * files.length)]);
        // Process:
        }

        // 3. Search for Exact Root File Match
        const rootFiles = fs.readdirSync(musicPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
        // Process: const exactRoot = rootFiles.find(f => path.parse(f).name....
        const exactRoot = rootFiles.find(f => path.parse(f).name.toLowerCase() === term1.toLowerCase());
        if (exactRoot) return path.join(musicPath, exactRoot);

        // 4. Search for Partial Root File Match
        // Process: const partialRoot = rootFiles.find(f => path.parse(f).nam...
        const partialRoot = rootFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (partialRoot) return path.join(musicPath, partialRoot);

        // 5. Fallback: Deep Recursive Search through all subfolders
        // Process: const allFiles = getAllFiles(musicPath)
        const allFiles = getAllFiles(musicPath);
        const deepMatch = allFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        // Process: if (deepMatch) return deepMatch
        if (deepMatch) return deepMatch;

        // Return null if search exhausted all levels with no match
        return null;
    // Process:
    }
}

// Process: function getRandomEffect(table, userId)
function getRandomEffect(table, userId) {
    const available = table.filter(e => !e.unique || !e.used?.includes(userId));
    // Process: return available.length > 0 ? available[Math.floor(Math.r...
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

// Process: function evaluateDiceRolls(text)
function evaluateDiceRolls(text) {
    const roller = new DiceRoller();
    // Process: while (text.includes("[["))
    while (text.includes("[[")) {
        text = text.replace(/\[\[([^\[\]]+)\]\]/g, (m, expr) => {
            // Process: try  return roller.roll(expr).total  catch (e)  return m
            try { return roller.roll(expr).total; } catch (e) { return m; }
        });
    // Process:
    }
    return text;
// Process:
}

module.exports = CommandHandler;
