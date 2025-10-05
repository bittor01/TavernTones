/**
 * @file Defines the `/5e` slash command.
 * This command serves as an alias for the primary `/search` command,
 * providing a convenient shorthand for users. It reuses the execution
 * logic directly from `search.js`.
 * @author jules
 */

const { SlashCommandBuilder } = require('discord.js');
const { execute } = require('./search.js');

module.exports = {
	/**
	 * The data for the slash command, used by Discord to register it.
	 * @type {SlashCommandBuilder}
	 */
	data: new SlashCommandBuilder()
		.setName('5e')
		.setDescription('Searches all 5e content by name.')
		.addStringOption(option =>
			option.setName('query')
				.setDescription('The name of the content to search for.')
				.setRequired(true)),
	/**
	 * The function that executes the command.
	 * @type {function}
	 * @see {@link module:./search.js.execute}
	 */
	execute,
};