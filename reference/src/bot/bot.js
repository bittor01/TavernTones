/**
 * @file The main entry point for the Discord bot.
 * This file initializes the Discord client, loads all slash commands,
 * and sets up event listeners to handle interactions.
 * @author jules
 */

const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { addToQueue } = require('./utils/rateLimiter');

/**
 * The main Discord client instance.
 * Configured with intents required for guild and message operations.
 * @type {Client}
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

/**
 * A collection that holds all of the bot's slash commands.
 * The key is the command name, and the value is the command's exported module.
 * @type {Collection<string, object>}
 */
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Dynamically load all command files from the 'commands' directory.
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  // Ensure the command has the required 'data' and 'execute' properties before loading.
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}

/**
 * Event listener for when the client is ready.
 * This event is fired once after the bot successfully logs in.
 */
client.once('clientReady', () => {
  console.log('Discord bot is ready!');
});

/**
 * Event listener for interactions.
 * This is the main router for all slash command executions.
 * It finds the appropriate command and executes it, with error handling.
 * All interactions are passed through a rate limiter queue.
 */
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    // Add the command execution to the rate-limited queue.
    await addToQueue(() => command.execute(interaction));
  } catch (error) {
    console.error(error);
    const errorReply = { content: 'There was an error while executing this command!', flags: [MessageFlags.Ephemeral] };
    // Handle cases where the interaction has already been replied to or deferred.
    if (interaction.replied || interaction.deferred) {
      await addToQueue(() => interaction.followUp(errorReply));
    } else {
      await addToQueue(() => interaction.reply(errorReply));
    }
  }
});

// Log in to Discord using the token from environment variables.
client.login(process.env.DISCORD_TOKEN);