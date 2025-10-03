/**
 * @file A script to register or update the bot's slash commands with the Discord API.
 * This script should be run once whenever commands are added, removed, or changed.
 * It reads all command files, extracts their JSON representation, and sends them to Discord.
 *
 * @requires discord.js - For REST and Routes to interact with the Discord API.
 * @requires dotenv - To load environment variables from a .env file.
 * @see {@link https://discordjs.guide/creating-your-bot/command-deployment.html}
 * @author jules
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Iterate over each command file and extract its JSON data for deployment.
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	if ('data' in command) {
		commands.push(command.data.toJSON());
	} else {
		console.warn(`[Deploy] The command at ./commands/${file} is missing a "data" property and was not deployed.`);
	}
}

/**
 * An instance of the Discord REST client, configured with the bot's token.
 * This is used to send requests to the Discord API.
 * @type {REST}
 */
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/**
 * An immediately-invoked function expression (IIFE) to asynchronously
 * register the commands with Discord.
 */
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The 'put' method is used to fully refresh all commands in the specified guild.
		// It overwrites the existing commands with the new set.
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error('Failed to deploy commands:', error);
	}
})();