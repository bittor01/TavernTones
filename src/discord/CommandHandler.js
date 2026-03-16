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

/**
 * Handles incoming messages from Discord, parsing them for commands and executing
 * the appropriate actions.
 */
class CommandHandler {
    /**
     * Creates an instance of CommandHandler.
     * @param {Client} client - The Discord client instance.
     * @param {function(string):void} logToRendererInstance - Function to log messages to the renderer.
     * @param {BackendAudioPlayer} musicPlayerInstance - The music player instance.
     * @param {object} config - The application configuration object.
     * @param {FiveEToolsParser} fiveEToolsParserInstance - The 5eTools data parser instance.
     */
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

    /**
     * Sends a formatted help message to the Discord channel, listing available commands.
     * @param {Message} message - The Discord message object that triggered the command.
     * @private
     */
    async _sendHelpEmbed(message) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('TavernTones Bot Commands')
            .setDescription('To use any command, be sure to @me!')
            .addFields(
                { name: '!ping', value: 'Test to see if the bot is working.' },
                { name: '!su (!surge)', value: 'Roll on the Wild Magic Surge table.' },
                { name: '!sh (!shield)', value: 'Roll on the Wild Magic Shield table.' },
                { name: '!ro (!roll)', value: 'Roll on random tables. Example: `!ro spells 3 8 lvl1 4 lvl2`' },
                { name: '!pl (!play)', value: 'Play music. Folder, song, or search. Example: `!pl`, `!pl chill`, `!pl chill humblewood`, `!pl humblewood`.' },
                { name: '!pa (!pause)', value: 'Pauses the current audio.' },
                { name: '!dr (!dice)', value: 'Roll arbitrary dice. Example: `!dr 2d20kh1 + 5`' },
                { name: '!dh (!dicehelp)', value: 'Get help with dice notation.' }
            )
            .setTimestamp();

        if (musicPlayer.isPlaying && musicPlayer.stack.length > 0) {
            const track = musicPlayer.stack[musicPlayer.currentTrackIndex];
            if (track) {
                helpEmbed.setFooter({ text: `🎵 Now Playing: ${track.name}` });
            }
        }

        await message.reply({ embeds: [helpEmbed] });
    }

    async _sendDiceHelpEmbed(message) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Dice Rolling Help')
            .setDescription('TavernTones uses standard RPG dice notation.')
            .addFields(
                { name: 'Basic Rolls', value: '`1d20`, `3d6 + 2`, `4d10 - 5`', inline: true },
                { name: 'Keep/Drop', value: '`2d20kh1` (Advantage), `2d20kl1` (Disadvantage), `4d6kh3` (Roll stats)', inline: true },
                { name: 'Criticals', value: '`1d20cs>=19` (Crit on 19 or 20)', inline: true },
                { name: 'Rerolls', value: '`1d8r<3` (Reroll 1s and 2s)', inline: true },
                { name: 'Exploding', value: '`4d6!` (Explode on max)', inline: true },
                { name: 'Math Functions', value: '`floor(1d20 / 2)`, `abs(-1d6)`', inline: true }
            )
            .setFooter({ text: 'Powered by @dice-roller/rpg-dice-roller' });

        await message.reply({ embeds: [embed] });
    }

    /**
     * Processes an incoming Discord message, checking for mentions and command triggers.
     * @param {Message} message - The Discord message object to process.
     */
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
                        await message.reply('Pong!');
                        break;

                    case content.startsWith('!su'):
                    case content.startsWith('!surge'):
                        logToRenderer('Surge command detected');
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        const surgeEffect = getRandomEffect(surgeData, userId);
                        if (surgeEffect) {
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            await message.reply(evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : ''));

                            if (surgeEffect.unique) {
                                if (!Array.isArray(surgeEffect.used)) surgeEffect.used = [];
                                surgeEffect.used.push(userId);
                                fs.writeFileSync(surgeFilePath, JSON.stringify(surgeData, null, 2), 'utf8');
                            }
                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;

                    case content.startsWith('!sh'):
                    case content.startsWith('!shield'):
                        logToRenderer('Shield command detected');
                        const shieldFilePath = path.join(this.randomTablesPath, 'shield.json');
                        const shieldData = JSON.parse(fs.readFileSync(shieldFilePath, 'utf8'));
                        const shieldEffect = getRandomEffect(shieldData, userId);
                        if (shieldEffect) {
                            const evaluatedText = evaluateDiceRolls(shieldEffect.text);
                            await message.reply(evaluatedText + (shieldEffect.unique ? '  - 🥳Unique!🎊' : ''));

                            if (shieldEffect.unique) {
                                if (!Array.isArray(shieldEffect.used)) shieldEffect.used = [];
                                shieldEffect.used.push(userId);
                                fs.writeFileSync(shieldFilePath, JSON.stringify(shieldData, null, 2), 'utf8');
                            }
                        } else {
                            await message.reply('No available effects for you.');
                        }
                        break;

                    case content.startsWith('!ro'):
                    case content.startsWith('!roll'):
                        logToRenderer('Roll command detected');
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        const roArgs = roArgsStr.split(/\s+/);

                        if (roArgs.length < 3) {
                            await message.reply('Invalid format. Usage: @TT !ro <folder> <count> <w1> <t1> ...');
                            break;
                        }

                        const folderName = roArgs[0];
                        const iterationCount = parseInt(roArgs[1], 10);
                        const tableArgs = roArgs.slice(2);

                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 100) {
                            await message.reply('Please use a count between 1 and 100.');
                            break;
                        }

                        const roTableEntries = [];
                        for (let i = 0; i < tableArgs.length; i += 2) {
                            roTableEntries.push({ weight: parseInt(tableArgs[i]), tableName: tableArgs[i + 1] });
                        }

                        await message.reply(`Rolling ${iterationCount} times...`);
                        const thread = await message.startThread({ name: `Rolls from ${folderName}` });
                        for (let i = 0; i < iterationCount; i++) {
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
                            await thread.send(`Roll ${i + 1}: ${result.success ? result.text : result.message}`);
                            await new Promise(r => setTimeout(r, 100));
                        }
                        break;

                    case content.startsWith('!dr'):
                    case content.startsWith('!dice'): {
                        const notation = commandBody.replace(/^!dr\w*/i, '').trim();
                        if (!notation) {
                            await message.reply("Please provide a dice notation. Use `!dh` for help.");
                            break;
                        }
                        try {
                            const roller = new DiceRoller();
                            const roll = roller.roll(notation);
                            await message.reply(`🎲 **${roll.total}**\n\`${roll.toString()}\``);
                        } catch (e) {
                            await message.reply(`Error rolling dice: ${e.message}`);
                        }
                        break;
                    }

                    case content.startsWith('!dh'):
                    case content.startsWith('!dicehelp'):
                        await this._sendDiceHelpEmbed(message);
                        break;

                    case content.startsWith('!pl'):
                    case content.startsWith('!play'):
                        logToRenderer('Play command detected');
                        const plParts = commandBody.split(/\s+/);
                        const plArgs = plParts.slice(1).filter(a => a.length > 0);

                        let parsedFolder = plArgs[0] || null;
                        let parsedSong = plArgs[1] || null;

                        let songFilePath = await this.findMusic(parsedFolder, parsedSong);

                        if (songFilePath) {
                            const songName = path.parse(songFilePath).name;
                            await message.reply(`Okay, playing: **${songName}**.`);
                            musicPlayer.clearStack();
                            musicPlayer.addToStack(songFilePath);
                            musicPlayer.play();
                        } else {
                            await message.reply("Sorry, I couldn't find the music you were looking for.");
                        }
                        break;

                    case content.startsWith('!pa'):
                    case content.startsWith('!pause'):
                        if (musicPlayer.isPlaying) {
                            musicPlayer.pause();
                            await message.reply('Paused.');
                        } else {
                            await message.reply('Nothing is playing.');
                        }
                        break;

                    case content.startsWith('!h'):
                    case content.startsWith('!help'):
                        await this._sendHelpEmbed(message);
                        break;

                    default:
                        if (content.length > 0) {
                            await this._sendHelpEmbed(message);
                        }
                        break;
                }
            } catch (error) {
                logToRenderer('Error processing command: ' + error.message);
            }
        }
    }

    getValidTableFolders() {
        try {
            return fs.readdirSync(this.randomTablesPath, { withFileTypes: true })
                .filter(d => d.isDirectory()).map(d => d.name);
        } catch (error) {
            return [];
        }
    }

    async rollFromTable(folderName, tablesConfig, channelId) {
        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);
        const validTables = [];
        for (const entry of tablesConfig) {
            const filePath = path.join(encounterTablesFolder, `${entry.tableName}.json`);
            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    validTables.push({ ...entry, data, filePath });
                } catch (e) {}
            }
        }

        if (validTables.length === 0) return { success: false, message: "No valid tables found." };

        const totalWeight = validTables.reduce((sum, entry) => sum + entry.weight, 0);
        const roll = Math.floor(Math.random() * totalWeight) + 1;
        let cumulative = 0;
        let selected = null;

        for (const entry of validTables) {
            cumulative += entry.weight;
            if (roll <= cumulative) {
                selected = entry;
                break;
            }
        }

        const available = selected.data.filter(e => !e.unique || !e.used?.includes(channelId));
        if (available.length === 0) return { success: false, message: "No available effects." };

        const effect = available[Math.floor(Math.random() * available.length)];
        if (effect.unique) {
            if (!effect.used) effect.used = [];
            effect.used.push(channelId);
            fs.writeFileSync(selected.filePath, JSON.stringify(selected.data, null, 2));
        }

        return { success: true, text: evaluateDiceRolls(effect.text) };
    }

    async findMusic(folderSearchTerm, songSearchTerm) {
        logToRenderer(`findMusic: Search f='${folderSearchTerm}', s='${songSearchTerm}'`);
        const musicPath = this.config.defaultMusicPath;
        if (!musicPath || !fs.existsSync(musicPath)) return null;

        const getAllFiles = (dir, filter) => {
            let results = [];
            const list = fs.readdirSync(dir, { withFileTypes: true });
            list.forEach(file => {
                const fullPath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    results = results.concat(getAllFiles(fullPath, filter));
                } else if (filter(file.name)) {
                    results.push(fullPath);
                }
            });
            return results;
        };

        const isAudio = (name) => {
            const ext = path.extname(name).toLowerCase();
            return ['.mp3', '.wav', '.ogg', '.lnk'].includes(ext);
        };

        // 1. Exact or partial folder match
        if (folderSearchTerm) {
            const subdirs = fs.readdirSync(musicPath, { withFileTypes: true }).filter(d => d.isDirectory());
            const matchedDir = subdirs.find(d => d.name.toLowerCase().includes(folderSearchTerm.toLowerCase()));

            if (matchedDir) {
                const dirPath = path.join(musicPath, matchedDir.name);
                const audioFiles = fs.readdirSync(dirPath).filter(isAudio);

                if (audioFiles.length > 0) {
                    if (songSearchTerm) {
                        const matchedSong = audioFiles.find(f => f.toLowerCase().includes(songSearchTerm.toLowerCase()));
                        if (matchedSong) return path.join(dirPath, matchedSong);
                    } else {
                        return path.join(dirPath, audioFiles[Math.floor(Math.random() * audioFiles.length)]);
                    }
                }
            }
        }

        // 2. Loose file in root
        const rootTerm = folderSearchTerm || songSearchTerm;
        if (rootTerm) {
            const rootFiles = fs.readdirSync(musicPath, { withFileTypes: true }).filter(f => f.isFile() && isAudio(f.name));
            const matchedRoot = rootFiles.find(f => f.name.toLowerCase().includes(rootTerm.toLowerCase()));
            if (matchedRoot) return path.join(musicPath, matchedRoot.name);
        }

        // 3. Deep search anywhere
        const allAudio = getAllFiles(musicPath, isAudio);
        const deepMatch = allAudio.find(f => path.basename(f).toLowerCase().includes(rootTerm.toLowerCase()));
        if (deepMatch) return deepMatch;

        return null;
    }
}

function getRandomEffect(table, userId) {
    const available = table.filter(e => !e.unique || !e.used?.includes(userId));
    return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
}

function evaluateDiceRolls(text) {
    const roller = new DiceRoller();
    return text.replace(/\[\[([^\[\]]+)\]\]/g, (m, expr) => roller.roll(expr).total);
}

module.exports = CommandHandler;
