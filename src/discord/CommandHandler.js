const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { shell } = require('electron');
const axios = require('axios');
const DropdownHandler = require('./DropdownHandler.js');

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
        this.config = config;
        BOT_ROLE_ID = this.config.botRoleId;
        DEFAULT_LOCAL_FOLDER = this.config.defaultMusicPath;
        this.randomTablesPath = this.config.randomTablesPath;
    }

    /**
     * Lists all songs in a given folder.
     * @param {string} folderPath
     * @returns {string[]}
     */
    getFolderSongs(folderPath) {
        if (!musicPlayer) return [];
        const allFiles = musicPlayer.getMusicFiles();
        const normalizedFolder = path.normalize(folderPath).toLowerCase();
        return allFiles.filter(f => path.normalize(path.dirname(f)).toLowerCase() === normalizedFolder);
    }

    /**
     * Finds a song by partial name.
     * @param {string} query
     * @returns {string|null}
     */
    findSong(query) {
        if (!musicPlayer) return null;
        const allFiles = musicPlayer.getMusicFiles();
        return allFiles.find(f => path.parse(f).name.toLowerCase().includes(query.toLowerCase()));
    }

    /**
     * Finds a folder by partial name.
     * @param {string} query
     * @returns {string|null}
     */
    findFolder(query) {
        if (!musicPlayer) return null;
        const allFiles = musicPlayer.getMusicFiles();

        const allDirs = [...new Set(allFiles.map(f => path.dirname(f)))];

        // 1. Exact match
        const exact = allDirs.find(d => path.basename(d).toLowerCase() === query.toLowerCase());
        if (exact) return exact;

        // 2. Partial match
        const partial = allDirs.find(d => path.basename(d).toLowerCase().includes(query.toLowerCase()));
        if (partial) return partial;

        return null;
    }

    async _sendHelpEmbed(message) {
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

        if (musicPlayer.isPlaying && musicPlayer.stack.length > 0 && musicPlayer.currentIndex >= 0) {
            const currentTrack = musicPlayer.stack[musicPlayer.currentIndex];
            const albumName = path.basename(path.dirname(currentTrack));
            const trackName = path.basename(currentTrack, path.extname(currentTrack));
            helpEmbed.setFooter({ text: `🎵 Now Playing: ${trackName} from ${albumName}` });
        }

        await message.reply({ embeds: [helpEmbed] });
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        logToRenderer(`Message received: ${message.content}`);

        if (message.mentions.has(this.client.user) || message.mentions.roles.has(BOT_ROLE_ID)) {
            const commandBody = message.content.replace(/<@.?[0-9]+>/, '').trim();
            const content = commandBody.toLowerCase();

            try {
                let typingInterval;
                switch (true) {
                    case content.startsWith('!ping'):
                        await message.reply('Pong!');
                        break;

                    case content.startsWith('!su'):
                        const surgeFilePath = path.join(this.randomTablesPath, 'surge.json');
                        if (!fs.existsSync(surgeFilePath)) {
                            await message.reply("❌ **Surge table not found.** Please ensure 'surge.json' exists in your random tables folder.");
                            break;
                        }
                        const surgeData = JSON.parse(fs.readFileSync(surgeFilePath, 'utf8'));
                        const surgeEffect = getRandomEffect(surgeData, message.author.id);
                        if (surgeEffect) {
                            const evaluatedText = evaluateDiceRolls(surgeEffect.text);
                            await message.reply(evaluatedText + (surgeEffect.unique ? '  - 🥳Unique!🎊' : ''));
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

                    case content.includes('!ro'):
                        const roIndex = message.content.toLowerCase().indexOf('!ro');
                        const roArgsStr = message.content.slice(roIndex + 3).trim();
                        const roArgs = roArgsStr.split(/\s+/);
                        if (roArgs.length < 3) {
                            await message.reply('Invalid command format. Usage: @TT !ro <folderName> <count> <w1> <t1> ...');
                            break;
                        }
                        const folderName = roArgs[0];
                        const iterationCount = parseInt(roArgs[1], 10);
                        const tableArgs = roArgs.slice(2);
                        const validFolders = this.getValidTableFolders();
                        if (!validFolders.includes(folderName)) {
                            const suggestion = validFolders.length > 0 ? `Available folders: ${validFolders.join(', ')}` : "No random table folders found in configuration.";
                            await message.reply(`❌ **Folder '${folderName}' not found.**\n${suggestion}`);
                            break;
                        }
                        if (isNaN(iterationCount) || iterationCount <= 0 || iterationCount > 999) {
                            await message.reply('Invalid iteration count.');
                            break;
                        }
                        const roTableEntries = [];
                        const missingTables = [];
                        const encounterTablesFolder = path.join(this.randomTablesPath, folderName);

                        for (let i = 0; i < tableArgs.length; i += 2) {
                            const weight = parseInt(tableArgs[i], 10);
                            const tableName = tableArgs[i + 1];
                            if (!tableName) continue;

                            const filePath = path.join(encounterTablesFolder, `${tableName}.json`);
                            if (!fs.existsSync(filePath)) {
                                missingTables.push(tableName);
                            } else {
                                roTableEntries.push({ weight, tableName });
                            }
                        }

                        if (missingTables.length > 0) {
                            const available = fs.readdirSync(encounterTablesFolder)
                                .filter(f => f.endsWith('.json'))
                                .map(f => f.replace('.json', ''));
                            await message.reply(`❌ **Missing tables in '${folderName}':** ${missingTables.join(', ')}\nAvailable: ${available.join(', ')}`);
                            if (roTableEntries.length === 0) break;
                        }

                        await message.reply(`Rolling ${iterationCount} times from '${folderName}'...`);
                        const thread = await message.startThread({ name: `Rolls from ${folderName}` });
                        for (let i = 0; i < iterationCount; i++) {
                            const result = await this.rollFromTable(folderName, roTableEntries, message.channel.id);
                            await thread.send(`Roll ${i + 1}: ${result.success ? result.text : result.message}`);
                            await new Promise(r => setTimeout(r, 100));
                        }
                        break;

                    case content.includes('!dr'): {
                        const drMatch = content.match(/!dr\s+(.*)/);
                        if (drMatch && drMatch[1]) {
                            const notation = drMatch[1];
                            try {
                                const roller = new DiceRoller();
                                const roll = roller.roll(notation);
                                await message.reply(`🎲 **Roll Result:** ${roll.total}\n\`${roll.toString()}\``);
                            } catch (e) {
                                await message.reply("Invalid dice notation. Use `!dh` for help.");
                            }
                        } else {
                            await message.reply("Usage: `!dr 2d20kh1 + 5` (RPG dice notation)");
                        }
                        break;
                    }

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

                    case content.includes('!pl'): {
                        const parts = content.substring(content.indexOf('!pl')).trim().split(/\s+/);
                        const commandArgs = parts.slice(1);
                        const arg1 = commandArgs[0] || "chill";
                        const arg2 = commandArgs[1];

                        let songFilePath = await this.findMusic(arg1, arg2);
                        if (songFilePath) {
                            await message.reply(`Playing: **${path.parse(songFilePath).name}**`);
                            musicPlayer.clearStack();
                            await musicPlayer.addToStack(songFilePath);
                            if (this.config.joinVoiceCallback) await this.config.joinVoiceCallback();
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

    getValidTableFolders() {
        try {
            return fs.readdirSync(this.randomTablesPath, { withFileTypes: true })
                .filter(d => d.isDirectory()).map(d => d.name);
        } catch (e) { return []; }
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
        const totalWeight = validTables.reduce((s, e) => s + e.weight, 0);
        if (totalWeight <= 0) return { success: false, message: "No valid tables." };
        const roll = Math.floor(Math.random() * totalWeight) + 1;
        let cum = 0;
        let selected = null;
        for (const e of validTables) {
            cum += e.weight;
            if (roll <= cum) { selected = e; break; }
        }
        const available = selected.data.filter(e => !e.unique || !e.used?.includes(channelId));
        if (available.length === 0) return { success: false, message: "No effects available." };
        const effect = available[Math.floor(Math.random() * available.length)];
        if (effect.unique) {
            if (!effect.used) effect.used = [];
            effect.used.push(channelId);
            fs.writeFileSync(selected.filePath, JSON.stringify(selected.data, null, 2));
        }
        return { success: true, text: effect.text };
    }

    async findMusic(term1, term2) {
        if (!musicPlayer) return null;
        const allFiles = musicPlayer.getMusicFiles();

        // 1. Exact Folder
        // We can simulate folder search by checking path components
        if (term1) {
            const folderMatch = allFiles.filter(f => {
                const parts = path.dirname(f).split(path.sep);
                return parts.some(p => p.toLowerCase() === term1.toLowerCase());
            });
            if (folderMatch.length > 0) {
                if (term2) {
                    const match = folderMatch.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                    if (match) return match;
                }
                return folderMatch[Math.floor(Math.random() * folderMatch.length)];
            }
        }

        // 2. Partial Folder
        if (term1) {
            const partialFolderMatch = allFiles.filter(f => {
                const parts = path.dirname(f).split(path.sep);
                return parts.some(p => p.toLowerCase().includes(term1.toLowerCase()));
            });
            if (partialFolderMatch.length > 0) {
                if (term2) {
                    const match = partialFolderMatch.find(f => path.parse(f).name.toLowerCase().includes(term2.toLowerCase()));
                    if (match) return match;
                }
                return partialFolderMatch[Math.floor(Math.random() * partialFolderMatch.length)];
            }
        }

        // 3. Exact File Name
        const exactFile = allFiles.find(f => path.parse(f).name.toLowerCase() === term1.toLowerCase());
        if (exactFile) return exactFile;

        // 4. Partial File Name (Deep search)
        const partialFile = allFiles.find(f => path.parse(f).name.toLowerCase().includes(term1.toLowerCase()));
        if (partialFile) return partialFile;

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
