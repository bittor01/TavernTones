const { Client, GatewayIntentBits, Events } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const config = require('./src/backend/core/config.js').getDiscordConfig();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const channel = client.channels.cache.get(config.voiceChannel);
    if (!channel) return console.log('Channel not found');

    console.log('Joining channel...');
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
    });

    connection.on('stateChange', (oldState, newState) => {
        console.log(`Connection: ${oldState.status} -> ${newState.status}`);
        const oldNetworking = Reflect.get(oldState, 'networking');
        const newNetworking = Reflect.get(newState, 'networking');
        if (newNetworking && newNetworking !== oldNetworking) {
            newNetworking.on('stateChange', (o, n) => console.log(`Networking: ${o.code} -> ${n.code}`));
            newNetworking.on('error', console.error);
        }
    });

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        console.log('Connected successfully!');
        connection.destroy();
        client.destroy();
    } catch (error) {
        console.error('Failed:', error);
        connection.destroy();
        client.destroy();
    }
});

client.login(config.token).catch(console.error);
