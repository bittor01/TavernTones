const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Registers the bot's slash commands with the Discord API.
 * @param {string} token - The bot's token.
 * @param {string} clientId - The bot's client ID.
 * @param {string} guildId - The ID of the guild to register commands in.
 * @param {function} logToRenderer - The logging function.
 */
async function deployCommands(token, clientId, guildId, logToRenderer) {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command) {
            commands.push(command.data.toJSON());
        } else {
            logToRenderer(`[WARNING] The command at ${filePath} is missing a "data" property.`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        logToRenderer(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        logToRenderer(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logToRenderer(`[ERROR] Failed to deploy slash commands: ${error.message}`);
        console.error('Failed to deploy commands:', error);
    }
}

module.exports = deployCommands;