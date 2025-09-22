const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { renderHand } = require('./CanvasHelper.js');

// Corrected Deck Definition from design documents
const DECK_DEFINITION = [
  { name: "Black Dragon", optional: false, value: 1, image: "1 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 2, image: "2 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 3, image: "3 brass.jpg", effect: "Brass" },
  { name: "Bronze Dragon", optional: false, value: 4, image: "4 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 5, image: "5 copper.jpg", effect: "Copper" },
  { name: "Gold Dragon", optional: false, value: 6, image: "6 gold.jpg", effect: "Gold" },
  { name: "Green Dragon", optional: false, value: 7, image: "7 green.jpg", effect: "Green" },
  { name: "Red Dragon", optional: false, value: 8, image: "8 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 9, image: "9 silver.jpg", effect: "Silver" },
  { name: "White Dragon", optional: false, value: 10, image: "10 white.jpg", effect: "White" },
  { name: "The Tarrasque", optional: true, value: 13, image: "13 tarrasque.jpg", effect: "The Tarrasque" },
  { name: "Dracolich", optional: true, value: 12, image: "12 dracolich.jpg", effect: "Dracolich" },
  { name: "Bahamut", optional: true, value: 11, image: "11 bahamut.jpg", effect: "Bahamut" },
  { name: "Tiamat", optional: true, value: 11, image: "11 tiamat.jpg", effect: "Tiamat" },
  { name: "Aspect of Tiamat", optional: true, value: 10, image: "10 aspect of tiamat.jpg", effect: "Aspect of Tiamat" },
  { name: "Aspect of Bahamut", optional: true, value: 9, image: "9 aspect of bahamut.jpg", effect: "Aspect of Bahamut" },
  { name: "Good Dragon", optional: true, value: 8, image: "8 good dragon.jpg", effect: "Good Dragon" },
  { name: "Evil Dragon", optional: true, value: 7, image: "7 evil dragon.jpg", effect: "Evil Dragon" },
  { name: "The Fool", optional: true, value: 0, image: "0 the fool.jpg", effect: "The Fool" },
  { name: "The Druid", optional: true, value: 1, image: "1 the druid.jpg", effect: "The Druid" },
  { name: "The Priest", optional: true, value: 2, image: "2 the priest.jpg", effect: "The Priest" },
  { name: "The Thief", optional: true, value: 3, image: "3 the thief.jpg", effect: "The Thief" },
  { name: "The Wizard", optional: true, value: 4, image: "4 the wizard.jpg", effect: "The Wizard" },
  { name: "The Ranger", optional: true, value: 5, image: "5 the ranger.jpg", effect: "The Ranger" },
  { name: "The Paladin", optional: true, value: 6, image: "6 the paladin.jpg", effect: "The Paladin" },
  { name: "The Knight", optional: true, value: 7, image: "7 the knight.jpg", effect: "The Knight" },
  { name: "The Barbarian", optional: true, value: 8, image: "8 the barbarian.jpg", effect: "The Barbarian" },
  { name: "The Archmage", optional: true, value: 9, image: "9 the archmage.jpg", effect: "The Archmage" }
];

const CARD_EFFECTS = [
  { name: "Black", alignment: "evil", text: "Steal 3 gold from the stakes" },
  { name: "Blue", alignment: "evil", text: "Choose one: Each opponent gives you 1 gold; OR each opponent adds 1 gold to the stakes for each card in your flight" },
  { name: "Green", alignment: "evil", text: "The player who plays next chooses to either give you a weaker evil dragon or to pay you 5 gold" },
  { name: "White", alignment: "evil", text: "The weakest opponent pays you 2 gold" },
  { name: "Red", alignment: "evil", text: "The strongest opponent pays you 1 gold. Take a random card from that player's hand" },
  { name: "Brass", alignment: "good", text: "The opponent who played last chooses either to give you a stronger good dragon from their hand or to pay you 5 gold" },
  { name: "Bronze", alignment: "good", text: "Put the two weakest ante cards into your hand" },
  { name: "Copper", alignment: "good", text: "Discard this card and replace it with the top card of the deck. That card's power triggers regardless of its strength" },
  { name: "Gold", alignment: "good", text: "Draw a card for each good dragon in your flight" },
  { name: "Silver", alignment: "good", text: "Each player with at least one good dragon in their flight draws a card" },
];

const SPECIAL_ABILITIES = [
    { label: 'Bluff (Deception)', value: 'bluff', description: 'Pay 1 fewer gold when paying 2+ to a player.' },
    { label: 'Concentration', value: 'concentration', description: 'Pay 1 fewer gold to the stakes when you ante.' },
    { label: 'Diplomacy (Persuasion)', value: 'diplomacy', description: 'You may choose another player to be the leader instead of you.' },
    { name: 'Intimidate (Intimidation)', value: 'intimidate', description: 'You can\'t be chosen as strongest flight if tied.' },
    { label: 'Gambler', value: 'gambler', description: 'When buying cards, you may discard a second card from the deck.' },
    { label: 'Sense Motive (Insight)', value: 'sense_motive', description: 'Look at an opponent\'s hand if they play two same-colored dragons.' },
    { label: 'Sleight of Hand', value: 'sleight_of_hand', description: 'After stealing from the stakes, you may steal 1 more gold.' },
    { label: 'Wild Card', value: 'wild_card', description: 'Once per game, count a mortal as a dragon for a color flight.' },
];

class ThreeDragonAnteGame {
    constructor(client) {
        this.client = client;
        this.activeGames = new Map();
    }

    async handleCommand(message) {
        if (this.activeGames.has(message.channel.id)) {
            return message.channel.send({ content: 'A game is already in progress in this channel.' });
        }

        const game = {
            hostId: message.author.id,
            channelId: message.channel.id,
            players: [],
            state: 'lobby',
            client: this.client,
            log: [],
            pot: 0,
            deck: [],
            draftCards: [],
            antePile: [],
            leader: null,
        };
        game.players.push({ id: message.author.id, user: message.author, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: {} });
        this.activeGames.set(message.channel.id, game);

        const embed = this._generateLobbyEmbed(game);
        const components = this._buildLobbyComponents(game);

        const lobbyMessage = await message.channel.send({ embeds: [embed], components });
        game.lobbyMessageId = lobbyMessage.id;

        const collector = lobbyMessage.createMessageComponentCollector({ time: 3_600_000 });

        collector.on('collect', async i => {
            const game = this.activeGames.get(i.channelId);
            if (!game) {
                await i.reply({ content: 'This game lobby is no longer active.', ephemeral: true });
                return;
            }
            await this.handleLobbyInteraction(i, game, collector);
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'game_started') {
                this.activeGames.delete(message.channel.id);
                lobbyMessage.edit({ content: 'This game lobby has expired.', embeds: [], components: [] }).catch(() => {});
            }
        });
    }

    async handleLobbyInteraction(i, game, collector) {
        const isPlayerInGame = game.players.some(p => p.id === i.user.id);

        if (i.customId === 'tda_join') {
            if (isPlayerInGame) {
                await i.reply({ content: 'You are already in the game.', ephemeral: true });
                return;
            }
            game.players.push({ id: i.user.id, user: i.user, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: {} });
        } else if (i.customId === 'tda_leave') {
            if (!isPlayerInGame) {
                await i.reply({ content: 'You are not in this game.', ephemeral: true });
                return;
            }
            game.players = game.players.filter(p => p.id !== i.user.id);
             if (i.user.id === game.hostId && game.players.length > 0) {
                game.hostId = game.players[0].id;
            } else if (game.players.length === 0) {
                collector.stop('all_left');
                return;
            }
        } else if (i.customId === 'tda_ability_select') {
            if (!isPlayerInGame) {
                await i.reply({ content: 'You must join the game before selecting an ability.', ephemeral: true });
                return;
            }
            const player = game.players.find(p => p.id === i.user.id);
            player.specialAbility = i.values[0];
        } else if (i.customId === 'tda_start') {
            if (i.user.id !== game.hostId) {
                await i.reply({ content: 'Only the host can start the game.', ephemeral: true });
                return;
            }
            if (game.players.length < 2) {
                await i.reply({ content: 'You need at least 2 players to start.', ephemeral: true });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`tda_buy_in_modal_${game.channelId}`)
                .setTitle('Set Game Stakes');
            const buyInInput = new TextInputBuilder()
                .setCustomId('buy_in_amount')
                .setLabel("Game Buy-in (in Gold Pieces)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('e.g., 50 for a standard game, 5000 for high-stakes');
            const actionRow = new ActionRowBuilder().addComponents(buyInInput);
            modal.addComponents(actionRow);
            await i.showModal(modal);
            return;
        }

        await i.update({ embeds: [this._generateLobbyEmbed(game)], components: this._buildLobbyComponents(game) });
    }

    async handleGameInteraction(interaction) {
        const customId = interaction.customId;
        const [prefix, action, channelId, ...params] = customId.split('_');

        if (prefix !== 'tda' || action !== 'action') return;

        const game = this.activeGames.get(channelId);
        if (!game) {
            await interaction.reply({ content: 'This game is no longer active.', ephemeral: true });
            return;
        }

        const actionType = params[0];
        const cardIdentifier = params.slice(1).join('_');

        if (actionType === 'ante') {
            await this.handleAnte(interaction, game, cardIdentifier.replace(/_/g, ' '));
        }
    }

    _generateLobbyEmbed(game) {
        const hostUser = game.players.find(p => p.id === game.hostId)?.user;
        const embed = new EmbedBuilder()
            .setTitle('Three-Dragon Ante Lobby')
            .setColor(0x5539cc)
            .setDescription('A new game is starting! Click "Join" to play!')
            .setFooter({ text: `The host, ${hostUser ? hostUser.username : 'The host has left'}, can start the game.` });

        let playerList = game.players.map(p => {
            const ability = SPECIAL_ABILITIES.find(a => a.value === p.specialAbility);
            const isHost = p.id === game.hostId ? ' (Host)' : '';
            return `- ${p.user.username}${isHost}` + (ability ? ` (${ability.label})` : '');
        }).join('\n');

        if (!playerList) playerList = 'No players have joined yet.';
        embed.addFields({ name: `Players (${game.players.length})`, value: playerList });

        if (game.state === 'starting') {
            embed.setDescription("Game starting... Check your DMs!");
            embed.setFields([]);
        }

        return embed;
    }

    _buildLobbyComponents(game, disabled = false) {
        const joinButton = new ButtonBuilder().setCustomId('tda_join').setLabel('Join').setStyle(ButtonStyle.Success).setDisabled(disabled);
        const leaveButton = new ButtonBuilder().setCustomId('tda_leave').setLabel('Leave').setStyle(ButtonStyle.Danger).setDisabled(disabled);
        const startButton = new ButtonBuilder().setCustomId('tda_start').setLabel('Start Game').setStyle(ButtonStyle.Primary).setDisabled(disabled || game.players.length < 2);
        const abilityMenu = new StringSelectMenuBuilder().setCustomId('tda_ability_select').setPlaceholder('Choose a special ability (optional)').addOptions(SPECIAL_ABILITIES).setDisabled(disabled);

        const row1 = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);
        const row2 = new ActionRowBuilder().addComponents(abilityMenu);
        return [row1, row2];
    }

    async handleBuyInModalSubmit(interaction) {
        const channelId = interaction.customId.split('_')[4];
        const game = this.activeGames.get(channelId);
        if (!game) return interaction.reply({ content: "Could not find an active game for this action.", ephemeral: true });
        if (interaction.user.id !== game.hostId) return interaction.reply({ content: "Only the host can set the buy-in.", ephemeral: true });

        const buyInInput = parseInt(interaction.fields.getTextInputValue('buy_in_amount'));
        if (isNaN(buyInInput) || buyInInput < 0) return interaction.reply({ content: 'Please enter a valid, non-negative number for the buy-in.', ephemeral: true });

        const finalBuyIn = Math.floor(buyInInput / 50) * 50;
        const scaleFactor = finalBuyIn === 0 ? 1 : finalBuyIn / 50;

        game.buyIn = finalBuyIn;
        game.scaleFactor = scaleFactor;
        game.players.forEach(p => { p.hoard = finalBuyIn; });
        game.log = [`[Turn 0] Game Started. Initial buy-in: ${game.buyIn}gp (x${scaleFactor} scale).`];

        try {
            const lobbyMessage = await interaction.channel.messages.fetch(game.lobbyMessageId);
            if (lobbyMessage) {
                const collector = lobbyMessage.createMessageComponentCollector({ time: 1 });
                collector.stop('game_started');
                await lobbyMessage.edit({ embeds: [this._generateLobbyEmbed(game)], components: [] });
            }
        } catch(e) { console.error("TDA: Could not find lobby message to update.", e); }

        await interaction.reply({ content: `✅ Buy-in accepted. The total buy-in is ${finalBuyIn}gp. All in-game gold values will be scaled by a factor of x${scaleFactor}.`, ephemeral: true });
        await this.startGame(game);
    }

    async startGame(game) {
        game.state = 'drafting';
        game.log.push('The draft begins!');
        this._selectDraftCards(game);
        this._buildDeck(game);
        this._dealInitialHands(game);
        await this.dealGameBoard(game);

        game.log.push('Drafting complete. The first gambit begins.');
        await this.startAntePhase(game);
    }

    _selectDraftCards(game) {
        const optionalCards = DECK_DEFINITION.filter(card => card.optional);
        this._shuffle(optionalCards);
        game.draftCards = optionalCards.slice(0, 10);
        game.log.push(`Draft cards selected: ${game.draftCards.map(c => c.name).join(', ')}.`);
    }

    _buildDeck(game) {
        const standardCards = DECK_DEFINITION.filter(card => !card.optional);
        game.deck = [...standardCards, ...game.draftCards];
        this._shuffle(game.deck);
    }

    _dealInitialHands(game) {
        for (let i = 0; i < 6; i++) {
            for (const player of game.players) {
                if (game.deck.length > 0) player.hand.push(game.deck.pop());
            }
        }
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    async dealGameBoard(game) {
        for (const player of game.players) {
            try {
                player.dmChannel = await player.user.createDM();
                const logMessage = await player.dmChannel.send({ embeds: [this._createLogEmbed(game)] });
                player.dmMessages.log = logMessage.id;
                const anteMessage = await player.dmChannel.send({ embeds: [this._createAnteEmbed(game)] });
                player.dmMessages.ante = anteMessage.id;
                player.dmMessages.opponents = {};
                for (const opponent of game.players) {
                    if (player.id !== opponent.id) {
                        const opponentMessage = await player.dmChannel.send({ embeds: [this._createOpponentEmbed(opponent)] });
                        player.dmMessages.opponents[opponent.id] = opponentMessage.id;
                    }
                }
                const playerMessagePayload = await this._createPlayerEmbed(player);
                const playerMessage = await player.dmChannel.send(playerMessagePayload);
                player.dmMessages.player = playerMessage.id;
            } catch (error) {
                console.error(`Could not send DM to ${player.user.tag}.`, error);
                const channel = await this.client.channels.fetch(game.channelId);
                if (channel) channel.send(`${player.user.tag} has DMs disabled and cannot play.`);
            }
        }
    }

    async _updateAllBoards(game, revealAntes = false) {
        for (const player of game.players) {
            if (!player.dmChannel || !player.dmMessages) continue;
            try {
                const logMessage = await player.dmChannel.messages.fetch(player.dmMessages.log).catch(() => null);
                if (logMessage) await logMessage.edit({ embeds: [this._createLogEmbed(game)] });

                const anteMessage = await player.dmChannel.messages.fetch(player.dmMessages.ante).catch(() => null);
                if (anteMessage) await anteMessage.edit({ embeds: [this._createAnteEmbed(game, revealAntes)] });

                for (const opponent of game.players) {
                    if (player.id !== opponent.id) {
                        const opponentMessage = await player.dmChannel.messages.fetch(player.dmMessages.opponents[opponent.id]).catch(() => null);
                        if (opponentMessage) await opponentMessage.edit({ embeds: [this._createOpponentEmbed(opponent)] });
                    }
                }

                const playerMessage = await player.dmChannel.messages.fetch(player.dmMessages.player).catch(() => null);
                if (playerMessage) {
                    const playerMessagePayload = await this._createPlayerEmbed(player);
                    await playerMessage.edit(playerMessagePayload);
                }
            } catch (error) {
                console.error(`Failed to update board for ${player.user.tag}:`, error);
            }
        }
    }

    async startAntePhase(game) {
        game.state = 'ante';
        game.antePile = [];
        game.log.push('**ANTE PHASE:** All players, check your DMs to choose a card to ante.');
        await this._updateAllBoards(game);
        for (const player of game.players) {
            await this._requestAnte(game, player);
        }
    }

    async _requestAnte(game, player) {
        const embed = new EmbedBuilder().setTitle('Choose Your Ante Card').setDescription('Select one card from your hand to play as your ante.').setColor(0x3498db);
        const rows = [];
        let currentRow = new ActionRowBuilder();
        for (const card of player.hand) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            const stake = card.value * game.scaleFactor;
            currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_action_${game.channelId}_ante_${card.name.replace(/ /g, '_')}`).setLabel(`${card.name} (Str ${card.value}) - Stakes: ${stake}gp`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(currentRow);
        try {
            await player.dmChannel.send({ embeds: [embed], components: rows });
        } catch (e) { console.error(`Failed to send ante request to ${player.user.tag}`, e); }
    }

    async handleAnte(interaction, game, cardName) {
        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: "You're not in this game.", ephemeral: true });

        const cardIndex = player.hand.findIndex(c => c.name === cardName);
        if (cardIndex === -1) return interaction.reply({ content: "You don't have that card.", ephemeral: true });

        if (game.antePile.some(p => p.player.id === player.id)) return interaction.reply({ content: "You have already anted.", ephemeral: true });

        await interaction.message.delete().catch(e => console.error("Failed to delete ante message:", e));

        const card = player.hand.splice(cardIndex, 1)[0];
        const stake = card.value * game.scaleFactor;

        player.hoard -= stake;
        game.pot += stake;
        game.antePile.push({ player, card });
        game.log.push(`${player.user.username} has anted.`);

        await this._updateAllBoards(game);

        if (game.antePile.length === game.players.length) {
            await this._revealAntes(game);
        }
    }

    async _revealAntes(game) {
        game.log.push('**REVEAL:** All players have anted!');
        const revealLog = game.antePile.map(p => `${p.player.user.username} anted **${p.card.name}** (Str ${p.card.value})`).join('\n');
        game.log.push(revealLog);

        const sortedAntes = [...game.antePile].sort((a, b) => b.card.value - a.card.value);
        game.leader = sortedAntes[0].player;
        game.log.push(`**${game.leader.user.username}** anted the strongest card and is the leader for this gambit.`);

        game.state = 'gambit';
        await this._updateAllBoards(game, true);
    }

    _createLogEmbed(game) {
        return new EmbedBuilder().setTitle('Gameplay Log').setDescription(game.log.slice(-15).join('\n')).setColor(0x992d22);
    }

    _createAnteEmbed(game, reveal = false) {
        const embed = new EmbedBuilder().setTitle('Current Ante').addFields({ name: 'Current Pot', value: `${game.pot}gp`, inline: false }).setColor(0xDAA520);

        if (reveal) {
            embed.setDescription('Antes have been revealed!');
            const sortedAntes = [...game.antePile].sort((a, b) => b.card.value - a.card.value);
             const anteFieldValue = sortedAntes.map(p => `${p.player.user.username}: **${p.card.name}** (Str ${p.card.value})`).join('\n');
             embed.addFields({ name: 'Revealed Cards', value: anteFieldValue });
        } else {
            let description = 'Waiting for players to ante.';
            if (game.antePile.length > 0) {
                const antedPlayers = game.antePile.map(p => p.player.user.username).join(', ');
                description = `**Anted:** ${antedPlayers}\n*Waiting for ${game.players.length - game.antePile.length} more players.*`;
            }
            embed.setDescription(description);

            for (const player of game.players) {
                const hasAnted = game.antePile.some(p => p.player.id === player.id);
                embed.addFields({ name: player.user.username, value: hasAnted ? '`Card Anted` 🃏' : '`Waiting...`', inline: true });
            }
        }
        return embed;
    }

    _createOpponentEmbed(opponent) {
        const handRepresentation = '🃏'.repeat(opponent.hand.length) + '⬛'.repeat(10 - opponent.hand.length);
        return new EmbedBuilder()
            .setTitle(`${opponent.user.username}'s Board`)
            .addFields(
                { name: 'Hand', value: `${handRepresentation} (${opponent.hand.length}/10)` },
                { name: 'Hoard', value: `${opponent.hoard}gp`, inline: true },
                { name: 'Flight', value: opponent.flight.length > 0 ? opponent.flight.map(c => c.name).join('\n') : 'None', inline: true }
            )
            .setColor(0x4f545c);
    }

    async _createPlayerEmbed(player) {
        const cardTexts = player.hand.map(card => {
            const effect = CARD_EFFECTS.find(e => e.name === card.effect);
            return `**${card.name} (Str ${card.value})**: ${effect ? effect.text : 'No special effect.'}`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('Your Hand & Hoard')
            .setColor(0x5865f2)
            .addFields(
                { name: 'Your Hoard', value: `${player.hoard}gp` },
                { name: 'Your Hand', value: player.hand.length > 0 ? cardTexts : 'Empty' }
            );

        const handImageBuffer = await renderHand(player.hand);
        const attachment = new AttachmentBuilder(handImageBuffer, { name: 'hand.png' });
        embed.setImage('attachment://hand.png');

        return { embeds: [embed], files: [attachment] };
    }
}

module.exports = ThreeDragonAnteGame;
