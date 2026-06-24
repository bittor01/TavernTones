// Import the built-in filesystem module for interacting with the local disk
const fs = require('fs');
// Import the path module to handle and transform file paths reliably across different OS
const path = require('path');
// Import the RPG dice roller library to process complex dice notation like 2d20kh1
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
// Import necessary components from discord.js for building rich message embeds and UI elements
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
// Import shell from electron to allow opening external links if needed (though mostly used in renderer)
const { shell } = require('electron');
// Import axios for making HTTP requests (e.g. to external APIs)
const axios = require('axios');
// Import the DropdownHandler to manage interaction logic for Discord select menus
const DropdownHandler = require('./DropdownHandler.js');

// Define global-to-module variables for logging and player references
let logToRenderer;
let musicPlayer;
// Tracks the last response message to allow for future edits or deletions
let lastResponse;
// Stores the Discord Role ID that the bot should respond to when mentioned
let BOT_ROLE_ID;
// The default directory where the music files are stored locally
let DEFAULT_LOCAL_FOLDER;

/**
 * The CommandHandler class processes incoming Discord messages and executes
 * associated commands like rolling dice, playing music, or rolling on random tables.
 */
class CommandHandler {
    /**
     * Initializes the command handler with necessary references and configuration.
     */
    constructor(client, logToRendererInstance, musicPlayerInstance, config, fiveEToolsParserInstance) {
        // The Discord client instance
        this.client = client;
        // Function to send log messages back to the Electron UI
        logToRenderer = logToRendererInstance;
        // The backend audio player instance for controlling playback
        musicPlayer = musicPlayerInstance;
        // Parser for D&D 5e data (monsters, spells, etc.)
        this.fiveEToolsParser = fiveEToolsParserInstance;
        // Internal tracking of the last message sent by the bot
        this.lastResponse = null;
        // The application configuration object
        this.config = config;
        // Extract the bot role ID for mention detection
        BOT_ROLE_ID = this.config.botRoleId;
        // Extract the music path for library searches
        DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath;
        // Extract the path for random table JSON files
        this.randomTablesPath = this.config.randomTablesPath;
    }

    /**
     * Scans a directory and returns an array of full paths for valid audio files.
     * @param {string} folderPath The directory to scan.
     * @returns {string[]} List of full file paths found.
     */
    getFolderSongs(folderPath) {
        // Return empty if the path doesn't exist to prevent crashes
        if (!fs.existsSync(folderPath)) return [];
        // Read the directory contents and filter for supported extensions
        return fs.readdirSync(folderPath)
            .filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()))
            // Map simple filenames back to full absolute paths
            .map(f => path.join(folderPath, f));
    }

    /**
     * Recursively searches for a song file that matches the query.
     * @param {string} query Part of the filename to look for.
     * @returns {string|null} The path to the first matching file, or null.
     */
    findSong(query) {
        // Get the base music path from config
        const musicPath = this.config.defaultMusicPath;
        // Safety check: ensure path is valid before proceeding
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        // Inner helper function to traverse directories recursively
        const getAllFiles = (dir, results = []) => {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                // If it's a folder, dive deeper
                if (stat && stat.isDirectory()) getAllFiles(file, results);
                // Otherwise, check if it's an audio file and add to results
                else {
                    const ext = path.extname(file).toLowerCase();
                    if (['.mp3', '.wav', '.ogg', '.lnk'].includes(ext)) results.push(file);
                }
            });
            return results;
        };

        // Gather all files and look for one containing the query string (case-insensitive)
        const allFiles = getAllFiles(musicPath);
        return allFiles.find(f => path.parse(f).name.toLowerCase().includes(query.toLowerCase()));
    }

    /**
     * Searches for a music folder matching the query.
     * @param {string} query Part of the folder name to look for.
     * @returns {string|null} The full path to the matching folder.
     */
    findFolder(query) {
        const musicPath = this.config.defaultMusicPath;
        // Ensure the root music directory exists
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        // Get a list of all subdirectories in the music root
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);

        // First, check for an exact name match (ignoring case)
        const exact = subDirs.find(d => d.toLowerCase() === query.toLowerCase());
        if (exact) return path.join(musicPath, exact);

        // If no exact match, look for a folder that contains the query string
        const partial = subDirs.find(d => d.toLowerCase().includes(query.toLowerCase()));
        if (partial) return path.join(musicPath, partial);

        // Return null if nothing found
        return null;
    }

    /**
     * Constructs and sends a help embed to the Discord channel.
     * @param {object} message The original Discord message to reply to.
     */
    async _sendHelpEmbed(message) {
        // Create a new embed with a blue theme
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            // Add detailed fields for each available command
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

        // If music is playing, show the current track details in the footer
        if (musicPlayer.isPlaying && musicPlayer.stack.length > 0 && musicPlayer.currentIndex >= 0) {
            const currentTrack = musicPlayer.stack[musicPlayer.currentIndex];
            // Extract folder name as album and filename as track
            const albumName = path.basename(path.dirname(currentTrack));
            const trackName = path.basename(currentTrack, path.extname(currentTrack));
            helpEmbed.setFooter({ text: `🎵 Now Playing: ${trackName} from ${albumName}` });
        }

        // Send the embed as a reply to the user
        await message.reply({ embeds: [helpEmbed] });
    }

    /**
     * The main entry point for processing any message the bot can see.
     * @param {object} message The Discord message object.
     */
    async handleMessage(message) {
        // Ignore messages from other bots to prevent infinite loops
        if (message.author.bot) return;
        // Log the message content to the UI for visibility
        logToRenderer(`Message received: ${message.content}`);

        // Check if the bot was mentioned directly or via a specific role
        if (message.mentions.has(this.client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
            // Strip the mention from the message to extract the actual command
            const commandBody = message.content.replace(/<@.?[0-9]+>/, '').trim();
            // Convert to lowercase for easier matching
            const content = commandBody.toLowerCase();

            try {
                let typingInterval;
                // Use a switch block to route the command to its logic
                switch (true) {
                    // Simple connectivity test
                    case content.startsWith('!ping'):
                        await message.reply('Pong!');
                        break;

                    // Wild Magic Surge command
                    case content.startsWith('!su'):
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');
                        // Ensure the surge table data exists before trying to roll
                        if (!fs.existsSync(surgeFilePath)) {
                            await message.reply("❌ **Surge table not found.** Please ensure 'surge.json' exists in your random tables folder.");
                            break;
                        }
                        // Read and parse the surge table
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        // Get a random effect, respecting 'unique' flags per user
                        const surgeEffect = getRandomEffect(surgeData, message.author.id);
                        if (surgeEffect) {
                            // Replace any [[dice]] notation in the effect text with actual results
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            await message.reply(evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : ''));
                            // If the effect is unique, mark it as used so it won't be rolled again for this user
                            if (surgeEffect.unique) {
                                if (!Array.isArray(surgeEffect.used)) surgeEffect.used = [];
                                surgeEffect.used.push(message.author.id);
                                // Persist the 'used' state back to the disk
                                fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData, null, 2), 'utf8');
                            }
                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;

                    // Wild Magic Shield command (similar logic to surge)
                    case content.includes('!sh'):
                        const shieldFilePath = path.join(this.randomTablesPath, 'shield.json');
                        if (!fs.existsSync(shieldFilePath)) {
                            await message.reply("❌ **Shield table not found.** Please ensure 'shield.json' exists in your random tables folder.");
                            break;
                        }
                        const shieldData = JSON.parse(fs.readFileSync(shieldFilePath, 'utf8'));
                        const shieldEffect = getRandomEffect(shieldData, message.author.id);
                        if (shieldEffect) {
                            const evaluatedText = evaluateDiceRolls(shieldEffect.text);
                            await message.reply(evaluatedText + (shieldEffect.unique ? '  - 🥳Unique!🎊' : ''));
                            if (shieldEffect.unique) {
                                if (!Array.isArray(shieldEffect.used)) shieldEffect.used = [];
                                shieldEffect.used.push(message.author.id);
                                fs.writeFileSync(shieldFilePath, JSON.stringify(shieldData, null, 2), 'utf8');
                            }
                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;

                    // Multi-table random roller command
                    case content.includes('!ro'):
                        // Find the start of the command in the message
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        // Extract arguments after the command
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        // Split by whitespace to get individual parameters
                        const roArgs = roArgsStr.split(/\s+/);
                        // Basic validation of the command structure
                        if (roArgs.length < 3) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <count> <w1> <t1> ...');
                            break;
                        }
                        // First arg is the folder within randomtables/
                        const folderName = roArgs[0];
                        // Second arg is how many times to roll
                        const iterationCount = parseInt(roArgs[1], 10);
                        // Remaining args are pairs of weight and table name
                        const tableArgs = roArgs.slice(2);
                        // Verify the requested folder exists
                        const validFolders = this.getValidTableFolders();
                        if (!validFolders.includes(folderName)) {
                            const suggestion = validFolders.length > 0 ? `Available folders: ${validFolders.join(', ')}` : "No random table folders found in configuration.";
                            await message.reply(`❌ **Folder '${folderName}' not found.**\n${suggestion}`);
                            break;
                        }
                        // Sanity check the iteration count to prevent abuse or crashes
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 999) {
                            await message.reply('Invalid iteration count.');
                            break;
                        }
                        const roTableEntries = [];
                        const missingTables = [];
                        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);

                        // Parse the weight/table pairs
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            const weight = parseInt(tableArgs[i], 10);
                            const tableName = tableArgs[i + 1];
                            if (!tableName) continue;

                            const filePath = path.join(encounterTablesFolder, `${tableName}.json`);
                            // Check if the specific JSON file for the table exists
                            if (!fs.existsSync(filePath)) {
                                missingTables.push(tableName);
                            } else {
                                roTableEntries.push({ weight, tableName });
                            }
                        }

                        // Inform the user if some requested tables were missing
                        if (missingTables.length > 0) {
                            const available = fs.readdirSync(encounterTablesFolder)
                                .filter(f => f.endsWith('.json'))
                                .map(f => f.replace('.json', ''));
                            await message.reply(`❌ **Missing tables in '${folderName}':** ${missingTables.join(', ')}\nAvailable: ${available.join(', ')}`);
                            // If NO valid tables were found, stop here
                            if (roTableEntries.length === 0) break;
                        }

                        // Confirm start of the roll process
                        await message.reply(`Rolling ${iterationCount} times from '${folderName}'...`);
                        // Create a thread to keep the main channel clean during many rolls
                        const thread = await message.startThread({ name: `Rolls from ${folderName}` });
                        for (let i = 0; i < iterationCount; i++) {
                            // Execute a weighted roll from the configured tables
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
                            // Send the result to the thread
                            await thread.send(`Roll ${i + 1}: ${result.success ? result.text : result.message}`);
                            // Small delay to respect Discord rate limits
                            await new Promise(r => setTimeout(r, 100));
                        }
                        break;

                    // RPG Dice Rolling command
                    case content.includes('!dr'): {
                        // Regex match to extract the notation after !dr
                        const drMatch = content.match(/!dr\s+(.*)/);
                        if (drMatch && drMatch[1]) {
                            const notation = drMatch[1];
                            try {
                                const roller = new DiceRoller();
                                // Parse and execute the roll
                                const roll = roller.roll(notation);
                                // Reply with both the total and the detailed breakdown of die results
                                await message.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
                            } catch (e) {
                                // Inform the user if the notation was invalid (e.g. "2d20-foo")
                                await message.reply("Invalid dice notation. Use `!dh` for help.");
                            }
                        } else {
                            await message.reply("Usage: `!dr 2d20kh1 + 5` (RPG dice notation)");
                        }
                        break;
                    }

                    // Dice Notation Help command
                    case content.includes('!dh'): {
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
                        await message.reply({ embeds: [embed] });
                        break;
                    }

                    // Music Playback command
                    case content.includes('!pl'): {
                        // Parse command arguments for folder and song names
                        const parts = content.substring(content.indexOf('!pl')).trim().split(/\s+/);
                        const commandArgs = parts.slice(1);
                        // Default to 'chill' if no folder is specified
                        const arg1 = commandArgs[0] || "chill";
                        const arg2 = commandArgs[1];

                        // Attempt to find the requested music using the hierarchy search
                        let songFilePath = await this.findMusic(arg1, arg2);
                        if (songFilePath) {
                            await message.reply(`Playing: **${path.parse(songFilePath).name}**`);
                            // Clear existing queue and add the new track
                            musicPlayer.clearStack();
                            await musicPlayer.addToStack(songFilePath);
                            // Ensure the bot is in a voice channel before starting playback
                            if (this.config.joinVoiceCallback) await this.config.joinVoiceCallback();
                            musicPlayer.play();
                        } else {
                            await message.reply("Could not find that music.");
                        }
                        break;
                    }

                    // Pause command
                    case content.includes('!pa'):
                        musicPlayer.pause();
                        await message.reply('Paused.');
                        break;

                    // Stop command
                    case content.includes('!st'):
                        musicPlayer.stop();
                        musicPlayer.clearStack();
                        await message.reply('Stopped and cleared stack.');
                        break;

                    // Default to help embed if command is unrecognized
                    case content.includes('!h'):
                        await this._sendHelpEmbed(message);
                        break;

                    default:
                        await this._sendHelpEmbed(message);
                        break;
                }
            } catch (error) {
                // Log any errors during command execution to the renderer UI
                logToRenderer('Error: ' + error.message);
            }
        }
    }

    /**
     * Retrieves all folder names within the configured random tables directory.
     * @returns {string[]} List of directory names.
     */
    getValidTableFolders() {
        try {
            // Read directory entries and filter for directories only
            return fs.readdirSync(this.randomTablesPath, { withFileTypes: true })
                .filter(d => d.isDirectory()).map(d => d.name);
        } catch (e) { return []; }
    }

    /**
     * Performs a weighted roll across multiple JSON tables.
     * @param {string} folderName Subfolder to look in.
     * @param {object[]} tablesConfig Array of {weight, tableName} objects.
     * @param {string} channelId The Discord ID to track unique usage against.
     * @returns {object} Result containing success status and text/error message.
     */
    async rollFromTable(folderName, tablesConfig, channelId) {
        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);
        const validTables = [];
        // Load and validate each table specified in the config
        for (const entry of tablesConfig) {
            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    validTables.push({ ...entry, data, filePath });
                } catch (e) {
                    // Ignore malformed JSON files
                }
            }
        }
        // Calculate the sum of all weights for the random roll
        const totalWeight = validTables.reduce((s, e) => s + e.weight, 0);
        if (totalWeight <= 0) return { success: false, message: "No valid tables." };
        // Determine which table was selected based on its weight
        const roll = Math.floor(Math.random() * totalWeight) + 1;
        let cum = 0;
        let selected = null;
        for (const e of validTables) {
            cum += e.weight;
            if (roll <= cum) { selected = e; break; }
        }
        // Filter effects in the selected table that are either not unique or haven't been used by this ID
        const available = selected.data.filter(e => !e.unique || !e.used?.includes(channelId));
        if (available.length === 0) return { success: false, message: "No effects available." };
        // Pick a random effect from the available list
        const effect = available[Math.floor(Math.random() * available.length)];
        // If unique, record the usage and save back to disk
        if (effect.unique) {
            if (!effect.used) effect.used = [];
            effect.used.push(channelId);
            fs.writeFileSync(selected.filePath, JSON.stringify(selected.data, null, 2));
        }
        return { success: true, text: effect.text };
    }

    /**
     * High-level search for music files based on folder and track terms.
     * @param {string} term1 First search term (usually folder or root file).
     * @param {string} term2 Second search term (usually specific file within folder).
     * @returns {string|null} The path to the found music file.
     */
    async findMusic(term1, term2) {
        const musicPath = this.config.defaultMusicPath;
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        // Recursive helper to gather all audio files
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

        // List subdirectories for folder matching
        const subDirs = fs.readdirSync(musicPath, { withFileTypes: true })
            .filter(d => d.isDirectory()).map(d => d.name);

        // 1. Check for Exact Folder Match
        const exactFolder = subDirs.find(d => d.toLowerCase() === term1.toLowerCase());
        if (exactFolder) {
            const folderPath = path.join(musicPath, exactFolder);
            const files = fs.readdirSync(folderPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
            // If second term provided, look for matching track within this folder
            if (term2) {
                const match = files.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                if (match) return path.join(folderPath, match);
            }
            // Otherwise pick a random track from the folder
            if (files.length > 0) return path.join(folderPath, files[Math.floor(Math.random() * files.length)]);
        }

        // 2. Check for Partial Folder Match
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

        // 3. Check for Exact Root File Match (files sitting in the base music folder)
        const rootFiles = fs.readdirSync(musicPath).filter(f => ['.mp3', '.wav', '.ogg', '.lnk'].includes(path.extname(f).toLowerCase()));
        const exactRoot = rootFiles.find(f => path.parse(f).name.toLowerCase() === term1.toLowerCase());
        if (exactRoot) return path.join(musicPath, exactRoot);

        // 4. Check for Partial Root File Match
        const partialRoot = rootFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (partialRoot) return path.join(musicPath, partialRoot);

        // 5. Fallback: Deep Recursive Search through all subfolders
        const allFiles = getAllFiles(musicPath);
        const deepMatch = allFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (deepMatch) return deepMatch;

        // Give up if no matches found
        return null;
    }
}

/**
 * Helper to pick a random entry from an array, filtering by 'unique' usage.
 * @param {object[]} table Array of effect objects.
 * @param {string} userId The ID to check usage against.
 */
function getRandomEffect(table, userId) {
    const available = table.filter(e => !e.unique || !e.used?.includes(userId));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

/**
 * Parses a string for [[dice]] notation and replaces them with numeric results.
 * Supports nested rolling by using a while loop.
 * @param {string} text The string to parse.
 */
function evaluateDiceRolls(text) {
    const roller = new DiceRoller();
    // Continue searching for double brackets as long as they exist
    while (text.includes("[[")) {
        // Use regex to find and replace content inside [[ ]]
        text = text.replace(/\[\[([^\[\]]+)\]\]/g, (m, expr) => {
            try { return roller.roll(expr).total; } catch (e) { return m; }
        });
    }
    return text;
}

// Export the class for use in main.js
module.exports = CommandHandler;
