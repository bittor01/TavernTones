const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { shell } = require('electron');
const axios = require('axios');
const DropdownHandler = require('./DropdownHandler.js');
const { sanitizePath, splitMessage } = require('../backend/core/utils.js');
let logToRenderer;
let musicPlayer;
let lastResponse;
let BOT_ROLE_ID;
let DEFAULT_LOCAL_FOLDER;
/**
 * CommandHandler manages all incoming Discord message interactions.
 * It parses mentions, routes commands to their respective logic, and handles
 * external integrations like the dice roller and music player.
 */
class CommandHandler {
    constructor(client, logToRendererInstance, musicPlayerInstance, config, fiveEToolsParserInstance) {
        // Core Discord client for responding to messages
        this.client = client;
        // Global logger to pipe bot activity back to the Electron UI
        logToRenderer = logToRendererInstance;
        // Reference to the shared music player backend
        musicPlayer = musicPlayerInstance;
        // Parser for D&D 5e tools JSON data
        this.fiveEToolsParser = fiveEToolsParserInstance;
        this.lastResponse = null;
        // Configuration object containing folder paths and bot IDs
        this.config = config;
        BOT_ROLE_ID = this.config.botRoleId;
        DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath;
        this.randomTablesPath = this.config.randomTablesPath;
    }

    /**
     * Scans a directory and lists all supported audio files.
     * @param {string} folderPath - The directory path to scan.
     * @returns {string[]} An array of full paths to audio files.
     */
    getFolderSongs(folderPath) {
        // Return empty if the path doesn't exist to avoid errors
        if (!fs.existsSync(folderPath)) return [];
        // Read the directory contents
        return fs.readdirSync(folderPath)
            // Filter for supported audio extensions and Windows shortcuts
            .filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()))
            // Map relative filenames to full absolute paths
            .map(f => path.join(folderPath, f));
    }

    /**
     * Searches recursively for a song file matching a partial query name.
     * @param {string} query - The partial name of the song to find.
     * @returns {string|null} The full path to the song, or null if not found.
     */
    findSong(query) {
        // Retrieve the root music path from configuration
        const musicPath = this.config.defaultMusicPath;
        // Return null if path is invalid or missing
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        /**
         * Helper to recursively find all files in a directory tree.
         */
        const getAllFiles = (dir, results = []) => {
            // List all files and folders in current directory
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                // Construct full path for current item
                file = path.join(dir, file);
                // Get filesystem status for item
                const stat = fs.statSync(file);
                // If it's a directory, recurse into it
                if (stat && stat.isDirectory()) getAllFiles(file, results);
                else {
                    // Check if file has a supported audio extension
                    const ext = path.extname(file).toLowerCase();
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(file);
                }
            });
            return results;
        };

        // Gather all audio files from the music directory
        const allFiles = getAllFiles(musicPath);
        // Search for a file where the name includes the user's query (case-insensitive)
        return allFiles.find(f => path.parse(f).name.toLowerCase().includes(query.toLowerCase()));
    }

    /**
     * Finds a directory within the music root matching a partial name.
     * @param {string} query - The partial name of the folder.
     * @returns {string|null} The full path to the folder, or null.
     */
    findFolder(query) {
        // Retrieve the base music path
        const musicPath = this.config.defaultMusicPath;
        // Return null if base path is inaccessible
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        // List all subdirectories in the music root
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);

        // First attempt: Check for an exact match (case-insensitive)
        const exact = subDirs.find(d => d.toLowerCase() === query.toLowerCase());
        // Return full path if exact match is found
        if (exact) return path.join(musicPath, exact);

        // Second attempt: Check for a partial match
        const partial = subDirs.find(d => d.toLowerCase().includes(query.toLowerCase()));
        // Return full path if partial match is found
        if (partial) return path.join(musicPath, partial);

        // Return null if no matches were found
        return null;
    }

    /**
     * Sends a help embed to the message channel.
     * @param {object} message - The original Discord message that triggered the help.
     * @private
     */
    async _sendHelpEmbed(message) {
        // Construct a new formatted embed with command descriptions
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            .addFields(
                { name: '!ping', value: 'Test to see if the bot is working.' },
                { name: '!su (!surge)', value: 'Roll on the Wild Magic Surge table.' },
                { name: '!sh (!shield)', value: 'Roll on the Wild Magic Shield table.' },
                { name: '!ro (!roll)', value: 'Roll on random tables. Usage: `!ro spells 3 8 lvl1 4 lvl2`' },
                { name: '!dr (!dice)', value: 'Roll arbitrary dice using RPG notation. Example: `!dr 2d20kh1 + 5`' },
                { name: '!dh (!dicehelp)', value: 'Explains how to use the RPG dice notation.' },
                { name: '!pl (!play)', value: 'Play music. Usage: `!pl`, `!pl chill`, `!pl chill humblewood`. Search hierarchy: Exact folder > Partial folder > Exact root file > Partial root file > Deep recursive search.' },
                { name: '!pa (!pause)', value: 'Pauses the current audio.' },
                { name: '!st (!stop)', value: 'Stops the current audio and clears the stack.' },
            )
            .setTimestamp();

        // If music is currently playing, append "Now Playing" info to footer
        if (musicPlayer.isPlaying && musicPlayer.stack.length > 0 && musicPlayer.currentIndex >= 0) {
            // Get the current track from the player stack
            const currentTrack = musicPlayer.stack[musicPlayer.currentIndex];
            // Extract the parent folder name as the "album"
            const albumName = path.basename(path.dirname(currentTrack));
            // Extract the filename without extension as the track name
            const trackName = path.basename(currentTrack, path.extname(currentTrack));
            // Set the footer text to show what's playing
            helpEmbed.setFooter({ text: `🎵 Now Playing: ${trackName} from ${albumName}` });
        }

        // Reply to the user with the help embed
        await message.reply({ embeds: [helpEmbed] });
    }

    /**
     * Main entry point for processing incoming Discord messages.
     * Filters for mentions and routes to specific command logic.
     * @param {object} message - The Discord message object.
     */
    async handleMessage(message) {
        // Prevent recursive loops by ignoring all bot-authored messages
        if (message.author.bot) return;

        // Update the Electron UI log with the raw incoming message
        logToRenderer(`Message received: ${message.content}`);

        // Only respond if the bot user or the designated bot role is explicitly mentioned
        if (message.mentions.has(this.client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
            // Strip the mention tag from the start of the message to get the raw command
            const commandBody = message.content.replace(/<@.?[0-9]+>/, '').trim();
            // Normalize content for easier matching; commands are case-insensitive
            const content = commandBody.toLowerCase();

            try {
                // Dispatch logic based on command prefixes or keywords
                switch (true) {
                    case content.startsWith('!ping'):
                        // Reply with "Pong!" to indicate the bot is alive
                        await message.reply('Pong!');
                        break;
                    case content.startsWith('!su'):
                        // Load the Wild Magic Surge table from the configured data directory
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');

                        // Fail gracefully if the surge data file is missing
                        if (!fs.existsSync(surgeFilePath)) {
                            await message.reply("❌ **Surge table not found.** Please ensure 'surge.json' exists in your random tables folder.");
                            break;
                        }

                        // Load data and pick an effect, respecting 'unique' flags per user
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        const surgeEffect = getRandomEffect(surgeData, message.author.id);

                        if (surgeEffect) {
                            // Process embedded dice rolls like [[1d6]] into actual numbers
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            const responseText = evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : '');

                            // Send chunks to stay under Discord's 2000 character limit
                            const chunks = splitMessage(responseText);
                            await message.reply(chunks[0]);
                            for (let i = 1; i < chunks.length; i++) {
                                await message.channel.send(chunks[i]);
                            }

                            // If unique, update the JSON file to mark this effect as 'used' for the user
                            if (surgeEffect.unique) {
                                if (!Array.isArray(surgeEffect.used)) surgeEffect.used = [];
                                surgeEffect.used.push(message.author.id);
                                fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData, null, 2), 'utf8');
                            }
                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;
                    case content.includes('!sh'):
                        // Construct the full path to the shield table JSON file
                        const shieldFilePath = path.join(this.randomTablesPath, 'shield.json');
                        // Verify if the shield file exists before attempting to read it
                        if (!fs.existsSync(shieldFilePath)) {
                            // Inform the user that the file is missing
                            await message.reply("❌ **Shield table not found.** Please ensure 'shield.json' exists in your random tables folder.");
                            // Exit the switch case for shield
                            break;
                        }
                        // Read and parse the shield table data from the JSON file
                        const shieldData = JSON.parse(fs.readFileSync(shieldFilePath, 'utf8'));
                        // Select a random effect from the table for the user
                        const shieldEffect = getRandomEffect(shieldData, message.author.id);
                        // If an effect was found, proceed to process it
                        if (shieldEffect) {
                            // Evaluate any dice expressions within the effect text
                            const evaluatedText = evaluateDiceRolls(shieldEffect.text);
                            // Prepare the final message, including a unique indicator if applicable
                            const shieldResponseText = evaluatedText + (shieldEffect.unique ? '  - 🥳Unique!🎊' : '');
                            // Split the response if it exceeds Discord's character limit
                            const shieldChunks = splitMessage(shieldResponseText);
                            // Reply with the first chunk
                            await message.reply(shieldChunks[0]);
                            // If there are more chunks, send them in the same channel
                            for (let i = 1; i < shieldChunks.length; i++) {
                                await message.channel.send(shieldChunks[i]);
                            }
                            // If the effect was unique, mark it as used by this user
                            if (shieldEffect.unique) {
                                // Initialize the used array if it doesn't exist
                                if (!Array.isArray(shieldEffect.used)) shieldEffect.used = [];
                                // Add the user's ID to the list of people who have used this effect
                                shieldEffect.used.push(message.author.id);
                                // Save the updated shield table back to disk
                                fs.writeFileSync(shieldFilePath, JSON.stringify(shieldData, null, 2), 'utf8');
                            }
                        } else {
                            // Notify the user if no unique effects are left for them
                            await message.reply('No available effects for you.');
                        }
                        // Finish processing the shield command
                        break;
                    case content.includes('!ro'):
                        // Custom rolling logic for complex multi-table encounters
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        const roArgs = roArgsStr.split(/\s+/);

                        // Basic format check: !ro <folder> <count> <weight> <table_name>...
                        if (roArgs.length < 3) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <count> <w1> <t1> ...');
                            break;
                        }

                        // Sanitize inputs to prevent path traversal attacks via directory matching
                        const folderName = sanitizePath(roArgs[0]);
                        const iterationCount = parseInt(roArgs[1], 10);
                        const tableArgs = roArgs.slice(2);

                        // Ensure the requested table directory actually exists within our data root
                        const validFolders = this.getValidTableFolders();
                        if (!validFolders.includes(folderName)) {
                            const suggestion = validFolders.length > 0 ? `Available folders: ${validFolders.join(', ')}` : "No random table folders found in configuration.";
                            await message.reply(`❌ **Folder '${folderName}' not found.**\n${suggestion}`);
                            break;
                        }
                        // Validate iteration count bounds (1-999)
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 999) {
                            await message.reply('Invalid iteration count.');
                            break;
                        }
                        // Arrays to hold prepared table configs and errors
                        const roTableEntries = [];
                        const missingTables = [];
                        // Construct the path to the specific encounter folder
                        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);

                        // Loop through pairs of weight and table name
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            // Parse the weight for the table
                            const weight = parseInt(tableArgs[i], 10);
                            // Sanitize the table name input
                            const tableName = sanitizePath(tableArgs[i + 1]);
                            // Skip if no table name was provided in this pair
                            if (!tableName) continue;

                            // Check if the table JSON file exists
                            const filePath = path.join(encounterTablesFolder, `${tableName}.json`);
                            if (!fs.existsSync(filePath)) {
                                // Add to missing list if not found
                                missingTables.push(tableName);
                            } else {
                                // Save the valid weight and table name for rolling
                                roTableEntries.push({ weight, tableName });
                            }
                        }

                        // Report any missing tables to the user
                        if (missingTables.length > 0) {
                            // Get a list of actual files in the folder for suggestions
                            const available = fs.readdirSync(encounterTablesFolder)
                                .filter(f => f.endsWith('.json'))
                                .map(f => f.replace('.json', ''));
                            await message.reply(`❌ **Missing tables in '${folderName}':** ${missingTables.join(', ')}\nAvailable: ${available.join(', ')}`);
                            // If no valid tables were found at all, stop here
                            if (roTableEntries.length === 0) break;
                        }

                        // Start the rolling process
                        await message.reply(`Rolling ${iterationCount} times from '${folderName}'...`);
                        // Create a thread to keep the channel clean from multiple roll results
                        const thread = await message.startThread({ name: `Rolls from ${folderName}` });
                        // Perform the requested number of rolls
                        for (let i = 0; i < iterationCount; i++) {
                            // Roll from the configured tables
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
                            // Prepare the result text
                            const rollText = `Roll ${i + 1}: ${result.success ? result.text : result.message}`;
                            // Split the result if it's too long for a single message
                            const rollChunks = splitMessage(rollText);
                            // Send all chunks to the thread
                            for (const chunk of rollChunks) {
                                await thread.send(chunk);
                            }
                            // Small delay to prevent hitting Discord rate limits
                            await new Promise(r => setTimeout(r, 100));
                        }
                        // Finish processing the roll command
                        break;
                    case content.includes('!dr'): {
                        // Extract the dice notation from the command string
                        const drMatch = content.match(/!dr\s+(.*)/);
                        if (drMatch && drMatch[1]) {
                            // Capture the notation after !dr
                            const notation = drMatch[1];
                            try {
                                // Initialize the dice roller
                                const roller = new DiceRoller();
                                // Perform the roll based on user notation
                                const roll = roller.roll(notation);
                                // Reply with the total and a detailed breakdown
                                await message.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
                            } catch (e) {
                                // Handle invalid dice notation errors
                                await message.reply("Invalid dice notation. Use `!dh` for help.");
                            }
                        } else {
                            // Prompt user for correct usage if no notation provided
                            await message.reply("Usage: `!dr 2d20kh1 + 5` (RPG dice notation)");
                        }
                        break;
                    }
                    case content.includes('!dh'): {
                        // Create a help embed explaining dice syntax
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
                        // Send the dice help embed
                        await message.reply({ embeds: [embed] });
                        break;
                    }
                    case content.includes('!pl'): {
                        // Music playback command with fuzzy search
                        const parts = content.substring(content.indexOf('!pl')).trim().split(/\s+/);
                        const commandArgs = parts.slice(1);

                        // Sanitize search terms to prevent navigation outside music directory
                        const arg1 = sanitizePath(commandArgs[0] || "chill");
                        const arg2 = sanitizePath(commandArgs[1] || "");

                        // Search recursively for a matching audio file (folder match or file match)
                        let songFilePath = await this.findMusic(arg1, arg2);

                        if (songFilePath) {
                            await message.reply(`Playing: **${path.parse(songFilePath).name}**`);

                            // Reset the playlist stack and load the new track
                            musicPlayer.clearStack();
                            await musicPlayer.addToStack(songFilePath);

                            // Auto-join the user's voice channel if not already connected
                            if (this.config.joinVoiceCallback) await this.config.joinVoiceCallback();

                            // Trigger the actual audio stream start
                            musicPlayer.play();
                        } else {
                            await message.reply("Could not find that music.");
                        }
                        break;
                    }
                    case content.includes('!pa'):
                        musicPlayer.pause();
                        await message.reply('Paused.');
                        break;
                    case content.includes('!st'):
                        musicPlayer.stop();
                        musicPlayer.clearStack();
                        await message.reply('Stopped and cleared stack.');
                        break;
                    case content.includes('!h'):
                        await this._sendHelpEmbed(message);
                        break;
                    default:
                        await this._sendHelpEmbed(message);
                        break;
                }
            } catch (error) {
                logToRenderer('Error: ' + error.message);
            }
        }
    }

    /**
     * Retrieves all valid subdirectory names in the random tables path.
     * @returns {string[]} List of directory names.
     */
    getValidTableFolders() {
        try {
            // Read directory items with type metadata
            return fs.readdirSync(this.randomTablesPath, { withFileTypes: true })
                // Filter only for directories
                .filter(d => d.isDirectory()).map(d => d.name);
        } catch (e) {
            // Return empty list if directory read fails
            return [];
        }
    }

    /**
     * Executes a weighted roll from a set of tables and returns an effect.
     * @param {string} folderName - The parent folder of the tables.
     * @param {object[]} tablesConfig - Array of objects with weight and tableName.
     * @param {string} channelId - The ID of the channel (used for unique tracking).
     * @returns {object} Result object with success status and text/message.
     */
    async rollFromTable(folderName, tablesConfig, channelId) {
        // Construct the base folder path for the encounter type
        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);
        // List to hold validated table data
        const validTables = [];
        // Iterate through requested tables to load their contents
        for (const entry of tablesConfig) {
            // Build full path to specific table JSON
            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
            // Check if file exists before reading
            if (fs.existsSync(filePath)) {
                try {
                    // Parse the JSON data from the table file
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    // Store the table config along with its loaded data
                    validTables.push({ ...entry, data, filePath });
                } catch (e) {} // Silently ignore parse errors
            }
        }
        // Calculate total weight of all valid tables
        const totalWeight = validTables.reduce((s, e) => s + e.weight, 0);
        // Fail if no tables were valid or weights are zero
        if (totalWeight <= 0) return { success: false, message: "No valid tables." };
        // Generate a random number within the total weight range
        const roll = Math.floor(Math.random() * totalWeight) + 1;
        // Iterate to find which table the roll landed on
        let cum = 0;
        let selected = null;
        for (const e of validTables) {
            cum += e.weight;
            if (roll <= cum) { selected = e; break; }
        }
        // Filter effects from selected table that are either not unique or not yet used in this channel
        const available = selected.data.filter(e => !e.unique || !e.used?.includes(channelId));
        // Fail if no effects are left to draw
        if (available.length === 0) return { success: false, message: "No effects available." };
        // Select a random effect from the remaining pool
        const effect = available[Math.floor(Math.random() * available.length)];
        // If the effect is marked unique, record that it has been used
        if (effect.unique) {
            // Initialize usage tracking if it doesn't exist
            if (!effect.used) effect.used = [];
            // Add current channel ID to used list
            effect.used.push(channelId);
            // Write updated table data back to disk
            fs.writeFileSync(selected.filePath, JSON.stringify(selected.data, null, 2));
        }
        // Return the final effect text
        return { success: true, text: effect.text };
    }

    /**
     * Comprehensive music search across folders and root files.
     * @param {string} term1 - Primary search term (folder or filename).
     * @param {string} term2 - Secondary search term (filename within folder).
     * @returns {string|null} Path to the matched music file.
     */
    async findMusic(term1, term2) {
        // Get the base music path from config
        const musicPath = this.config.defaultMusicPath;
        // Validate that the music path exists
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        /**
         * Helper to recursively gather all audio files.
         */
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) getAllFiles(file, results);
                else {
                    const ext = path.extname(file).toLowerCase();
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(file);
                }
            });
            return results;
        };

        // List subdirectories for folder-based matching
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);

        // 1. Search for Exact Folder Match
        const exactFolder = subDirs.find(d => d.toLowerCase() === term1.toLowerCase());
        if (exactFolder) {
            // Construct full folder path
            const folderPath = path.join(musicPath, exactFolder);
            // List all audio files within the matched folder
            const files = fs.readdirSync(folderPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
            // If a second term was provided, try to find a specific file in the folder
            if (term2) {
                const match = files.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                if (match) return path.join(folderPath, match);
            }
            // If no specific file requested or found, pick a random file from the folder
            if (files.length > 0) return path.join(folderPath, files[Math.floor(Math.random() * files.length)]);
        }

        // 2. Search for Partial Folder Match
        const partialFolder = subDirs.find(d => d.toLowerCase().includes(term1.toLowerCase()));
        if (partialFolder) {
            const folderPath = path.join(musicPath, partialFolder);
            const files = fs.readdirSync(folderPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
            if (term2) {
                const match = files.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                if (match) return path.join(folderPath, match);
            }
            if (files.length > 0) return path.join(folderPath, files[Math.floor(Math.random() * files.length)]);
        }

        // 3. Search for Exact Root File Match
        const rootFiles = fs.readdirSync(musicPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
        const exactRoot = rootFiles.find(f => path.parse(f).name.toLowerCase() === term1.toLowerCase());
        if (exactRoot) return path.join(musicPath, exactRoot);

        // 4. Search for Partial Root File Match
        const partialRoot = rootFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (partialRoot) return path.join(musicPath, partialRoot);

        // 5. Fallback: Deep Recursive Search through all subfolders
        const allFiles = getAllFiles(musicPath);
        const deepMatch = allFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (deepMatch) return deepMatch;

        // Return null if search exhausted all levels with no match
        return null;
    }
}
function getRandomEffect(table, userId) {
    const available = table.filter(e => !e.unique || !e.used?.includes(userId));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}
function evaluateDiceRolls(text) {
    const roller = new DiceRoller();
    while (text.includes("[[")) {
        text = text.replace(/\[\[([^\[\]]+)\]\]/g, (m, expr) => {
            try { return roller.roll(expr).total; } catch (e) { return m; }
        });
    }
    return text;
}
module.exports = CommandHandler;
