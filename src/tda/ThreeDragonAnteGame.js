const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { renderHand } = require('./CanvasHelper.js');

const DECK_DEFINITION = [
  { name: "Black Dragon", optional: false, value: 1, image: "1 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 1, image: "1 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 1, image: "1 brass.jpg", effect: "Brass" },
  { name: "Bronze Dragon", optional: false, value: 1, image: "1 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 1, image: "1 copper.jpg", effect: "Copper" },
  { name: "Green Dragon", optional: false, value: 1, image: "1 green.jpg", effect: "Green" },
  { name: "White Dragon", optional: false, value: 1, image: "1 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 2, image: "2 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 2, image: "2 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 2, image: "2 brass.jpg", effect: "Brass" },
  { name: "Gold Dragon", optional: false, value: 2, image: "2 gold.jpg", effect: "Gold" },
  { name: "Green Dragon", optional: false, value: 2, image: "2 green.jpg", effect: "Green" },
  { name: "Red Dragon", optional: false, value: 2, image: "2 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 2, image: "2 silver.jpg", effect: "Silver" },
  { name: "White Dragon", optional: false, value: 2, image: "2 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 3, image: "3 black.jpg", effect: "Black" },
  { name: "Brass Dragon", optional: false, value: 3, image: "3 brass.jpg", effect: "Brass" },
  { name: "Bronze Dragon", optional: false, value: 3, image: "3 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 3, image: "3 copper.jpg", effect: "Copper" },
  { name: "Red Dragon", optional: false, value: 3, image: "3 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 3, image: "3 silver.jpg", effect: "Silver" },
  { name: "White Dragon", optional: false, value: 3, image: "3 white.jpg", effect: "White" },
  { name: "Blue Dragon", optional: false, value: 4, image: "4 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 4, image: "4 brass.jpg", effect: "Brass" },
  { name: "Gold Dragon", optional: false, value: 4, image: "4 gold.jpg", effect: "Gold " },
  { name: "Green Dragon", optional: false, value: 4, image: "4 green.jpg", effect: "Green" },
  { name: "White Dragon", optional: false, value: 4, image: "4 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 5, image: "5 black.jpg", effect: "Black" },
  { name: "Brass Dragon", optional: false, value: 5, image: "5 brass.jpg", effect: "Brass" },
  { name: "Copper Dragon", optional: false, value: 5, image: "5 copper.jpg", effect: "Copper" },
  { name: "Green Dragon", optional: false, value: 5, image: "5 green.jpg", effect: "Green" },
  { name: "Red Dragon", optional: false, value: 5, image: "5 red.jpg", effect: "Red" },
  { name: "White Dragon", optional: false, value: 5, image: "5 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 6, image: "6 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 6, image: "6 blue.jpg", effect: "Blue" },
  { name: "Bronze Dragon", optional: false, value: 6, image: "6 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 6, image: "6 copper.jpg", effect: "Copper" },
  { name: "Gold Dragon", optional: false, value: 6, image: "6 gold.jpg", effect: "Gold" },
  { name: "Green Dragon", optional: false, value: 6, image: "6 green.jpg", effect: "Green" },
  { name: "Silver Dragon", optional: false, value: 6, image: "6 silver.jpg", effect: "Silver" },
  { name: "White Dragon", optional: false, value: 6, image: "6 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 7, image: "7 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 7, image: "7 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 7, image: "7 brass.jpg", effect: "Brass" },
  { name: "Bronze Dragon", optional: false, value: 7, image: "7 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 7, image: "7 copper.jpg", effect: "Copper" },
  { name: "Red Dragon", optional: false, value: 7, image: "7 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 7, image: "7 silver.jpg", effect: "Silver" },
  { name: "Bronze Dragon", optional: false, value: 8, image: "8 bronze.jpg", effect: "Bronze" },
  { name: "Copper Dragon", optional: false, value: 8, image: "8 copper.jpg", effect: "Copper" },
  { name: "Gold Dragon", optional: false, value: 8, image: "8 gold.jpg", effect: "Gold" },
  { name: "Green Dragon", optional: false, value: 8, image: "8 green.jpg", effect: "Green" },
  { name: "Red Dragon", optional: false, value: 8, image: "8 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 8, image: "8 silver.jpg", effect: "Silver" },
  { name: "White Dragon", optional: false, value: 8, image: "8 white.jpg", effect: "White" },
  { name: "Black Dragon", optional: false, value: 9, image: "9 black.jpg", effect: "Black" },
  { name: "Blue Dragon", optional: false, value: 9, image: "9 blue.jpg", effect: "Blue" },
  { name: "Brass Dragon", optional: false, value: 9, image: "9 brass.jpg", effect: "Brass" },
  { name: "Bronze Dragon", optional: false, value: 9, image: "9 bronze.jpg", effect: "Bronze" },
  { name: "Gold Dragon", optional: false, value: 9, image: "9 gold.jpg", effect: "Gold" },
  { name: "Copper Dragon", optional: false, value: 10, image: "10 copper.jpg", effect: "Copper" },
  { name: "Green Dragon", optional: false, value: 10, image: "10 green.jpg", effect: "Green" },
  { name: "Red Dragon", optional: false, value: 10, image: "10 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 10, image: "10 silver.jpg", effect: "Silver" },
  { name: "Blue Dragon", optional: false, value: 11, image: "11 blue.jpg", effect: "Blue" },
  { name: "Bronze Dragon", optional: false, value: 11, image: "11 bronze.jpg", effect: "Bronze" },
  { name: "Gold Dragon", optional: false, value: 11, image: "11 gold.jpg", effect: "Gold" },
  { name: "Red Dragon", optional: false, value: 12, image: "12 red.jpg", effect: "Red" },
  { name: "Silver Dragon", optional: false, value: 12, image: "12 silver.jpg", effect: "Silver" },
  { name: "Gold Dragon", optional: false, value: 13, image: "13 gold.jpg", effect: "Gold" },
  { name: "Black Raider", optional: true, value: 8, image: "Black Raider.jpg", effect: "BlackRaider" },
  { name: "Blue Overlord", optional: true, value: 10, image: "Blue Overlord.jpg", effect: "BlueOverlord" },
  { name: "Brass Sultan", optional: true, value: 8, image: "Brass Sultan.jpg", effect: "BrassSultan" },
  { name: "Bronze Warlord", optional: true, value: 10, image: "Bronze Warlord.jpg", effect: "BronzeWarlord" },
  { name: "Copper Trickster", optional: true, value: 6, image: "Copper Trickster.jpg", effect: "CopperTrickster" },
  { name: "Gold Monarch", optional: true, value: 12, image: "Gold Monarch.jpg", effect: "GoldMonarch" },
  { name: "Green Schemer", optional: true, value: 5, image: "Green Schemer.jpg", effect: "GreenSchemer" },
  { name: "Red Destroyer", optional: true, value: 11, image: "Red Destroyer.jpg", effect: "RedDestroyer" },
  { name: "Silver Seer", optional: true, value: 11, image: "Silver Seer.jpg", effect: "SilverSeer" },
  { name: "White Hunter", optional: true, value: 7, image: "White Hunter.jpg", effect: "WhiteHunter" },
  { name: "Chromatic Wyrmling", optional: true, value: 1, image: "Chromatic Wyrmling.jpg", effect: "ChromWyrm" },
  { name: "Metallic Wyrmling", optional: true, value: 1, image: "Metallic Wyrmling.jpg", effect: "MetalWyrm" },
  { name: "Dracolich", optional: true, value: 10, image: "Dracolich.jpg", effect: "Dracolich" },
  { name: "Bahamut", optional: true, value: 13, image: "Bahamut.jpg", effect: "Bahamut" },
  { name: "Tiamat", optional: true, value: 13, image: "Tiamat.jpg", effect: "Tiamat" },
  { name: "The Wyrmpriest", optional: true, value: 5, image: "Wyrmpriest.jpg", effect: "Wyrmpriest" },
  { name: "The Druid", optional: true, value: 6, image: "Druid.jpg", effect: "Druid" },
  { name: "The Kobold", optional: true, value: 2, image: "kobold.jpg", effect: "Kobold" },
  { name: "The Princess", optional: true, value: 4, image: "Princess.jpg", effect: "Princess" },
  { name: "The Sorcerer", optional: true, value: 8, image: "Sorcerer.jpg", effect: "Sorcerer" },
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
  { name: "BlackRaider", alignment: "evil", text: "Steal 1 gold from the stakes, then take 2 gold from the next player, then 3 gold from the player after that and so on until you have taken gold from everyone" },
  { name: "BlueOverlord", alignment: "evil", text: "Choose one: Each opponent gives you 2 gold; OR each opponent adds 2 gold to the stakes for each card in your flight" },
  { name: "BrassSultan", alignment: "good", text: "The player who played last and the next opponent each choose to give you a stronger good dragon from their hand or pay you 5 gold" },
  { name: "BronzeWarlord", alignment: "good", text: "Put the two weakest ante cards into your hand. Then if you do not win the gambit after the third round, play a fourth round" },
  { name: "CopperTrickster", alignment: "good", text: "Discard a different card in your flight and replace it with the top card of the deck. You can trigger the new card's power if you wish" },
  { name: "GoldMonarch", alignment: "good", text: "Draw a card for each good dragon in your flight. Then if you win this gambit, gift each opponent 3 gold" },
  { name: "GreenSchemer", alignment: "evil", text: "The opponent who played last and the next opponent each choose to give you a weaker evil dragon from their hand or pay you 5 gold" },
  { name: "RedDestroyer", alignment: "evil", text: "The opponent with the strongest flight pays you 10 gold. Take a random card from that player's hand" },
  { name: "SilverSeer", alignment: "good", text: "Each player with at least one good dragon in their flight draws a card. Then you look at the top 3 cards in the deck, choose one to draw, and discard the others" },
  { name: "WhiteHunter", alignment: "evil", text: "Each weaker opponent pays you 3 gold" },
  { name: "ChromWyrm", alignment: "evil", text: "You may discard this card and replace it with an evil dragon from your hand. The new card's power triggers regardless of its strength" },
  { name: "MetalWyrm", alignment: "good", text: "You may discard this card and replace it with a good dragon from your hand. The new card's power triggers regardless of its strength" },
  { name: "Dracolich", alignment: "evil", text: "When the gambit is scored, you get +2 Strength for each evil dragon in your flight" },
  { name: "Bahamut", alignment: "good", text: "Dragon God: As long as you have Bahamut and an evil dragon in your flight, you can't win the gambit. Power: Each other player with both good and evil dragons in the same flight pays you 10 gold" },
  { name: "Tiamat", alignment: "evil", text: "Dragon God: Tiamat counts as a Black, Blue, Green, Red, and White Dragon. As long as you have Tiamat and a good dragon in your flight, you can't win the gambit" },
  { name: "Wyrmpriest", alignment: "mortal", text: "for the rest of the gambit, this card also counts as a dragon of any color for completing a color flight" },
  { name: "Druid", alignment: "mortal", text: "The player with the weakest flight wins the gambit instead of the player with the strongest flight" },
  { name: "Kobold", alignment: "mortal", text: "Discard as many cards as you wish from your hand. Then draw that many cards" },
  { name: "Princess", alignment: "mortal", text: "The power of each good dragon in your flight triggers" },
  { name: "Sorcerer", alignment: "mortal", text: "Reveal the top three cards of the deck. Discard this card and replace it with one of the revealed cards. that card's power triggers. Put the other two revealed cards into the ante" },
];

const SPECIAL_ABILITIES = [
    { label: 'Bluff (Deception)', value: 'bluff', description: 'Pay 1 fewer gold when paying 2+ to a player.' },
    { label: 'Concentration', value: 'concentration', description: 'Pay 1 fewer gold to the stakes when you ante.' },
    { label: 'Diplomacy (Persuasion)', value: 'diplomacy', description: 'You may choose another player to be the leader instead of you.' },
    { label: 'Intimidate (Intimidation)', value: 'intimidate', description: 'You can\'t be chosen as strongest flight if tied.' },
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
            antePile: [],
            leader: null,
            draftPool: [],
            draftOrder: [],
            turnOrder: [],
        };
        game.players.push({ id: message.author.id, user: message.author, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: {}, draftedCards: [], isReady: false });
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
            game.players.push({ id: i.user.id, user: i.user, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: {}, draftedCards: [], isReady: false });
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
        const cardIdentifier = params.slice(1).join('_').replace(/_/g, ' ');

        if (actionType === 'ante') {
            await this.handleAnte(interaction, game, cardIdentifier);
        } else if (actionType === 'draft') {
            await this.handleDraftPick(interaction, game, cardIdentifier);
        } else if (actionType === 'play') {
            await this.handleCardPlay(interaction, game, cardIdentifier);
        } else if (actionType === 'ready') {
            await this.handleReadyCheck(interaction, game);
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

        if (game.state === 'starting' || game.state === 'drafting') {
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
        game.state = 'starting';
        await this.dealInitialEmptyGameBoard(game);
        await this.startDraftPhase(game);
    }

    _shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    async dealInitialEmptyGameBoard(game) {
        for (const player of game.players) {
            try {
                player.dmChannel = await player.user.createDM();
                const logMessage = await player.dmChannel.send({ embeds: [this._createLogEmbed(game)] });
                player.dmMessages.log = logMessage.id;
                const draftMessage = await player.dmChannel.send({ embeds: [this._createDraftEmbed(game)] });
                player.dmMessages.draft = draftMessage.id;
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

    async _updateAllBoards(game, options = {}) {
        const { revealAntes = false, updateDraft = false } = options;
        for (const player of game.players) {
            if (!player.dmChannel || !player.dmMessages) continue;
            try {
                const logMessage = await player.dmChannel.messages.fetch(player.dmMessages.log).catch(() => null);
                if (logMessage) await logMessage.edit({ embeds: [this._createLogEmbed(game)] });

                if (updateDraft) {
                    const draftMessage = await player.dmChannel.messages.fetch(player.dmMessages.draft).catch(() => null);
                    if (draftMessage) await draftMessage.edit({ embeds: [this._createDraftEmbed(game)] });
                }

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

    // DRAFT PHASE
    async startDraftPhase(game) {
        game.state = 'drafting';
        const optionalCards = DECK_DEFINITION.filter(card => card.optional);
        this._shuffle(optionalCards);
        game.draftPool = optionalCards.slice(0, 10);

        const reversedPlayers = [...game.players].reverse();
        game.draftOrder = [...game.players, ...reversedPlayers];

        game.log.push('**DRAFT PHASE:** The draft for special cards has begun! Check your DMs to pick a card.');
        await this._updateAllBoards(game, { updateDraft: true });

        await this._requestDraftPick(game);
    }

    async _requestDraftPick(game) {
        if (game.draftOrder.length === 0) {
            await this.postDraftSetup(game);
            return;
        }

        const currentPlayer = game.draftOrder[0];
        const embed = new EmbedBuilder()
            .setTitle('Choose a Card to Draft')
            .setDescription(`It's your turn to pick a card from the draft pool. This card will be added to the deck for this game.`)
            .setColor(0x1abc9c);

        const rows = [];
        let currentRow = new ActionRowBuilder();
        for (const card of game.draftPool) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_action_${game.channelId}_draft_${card.name.replace(/ /g, '_')}`).setLabel(`${card.name} (Str ${card.value})`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(currentRow);

        try {
            await currentPlayer.dmChannel.send({ embeds: [embed], components: rows });
        } catch (e) {
            console.error(`Failed to send draft request to ${currentPlayer.user.tag}`, e);
            game.draftOrder.shift();
            await this._requestDraftPick(game);
        }
    }

    async handleDraftPick(interaction, game, cardName) {
        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: "You're not in this game.", ephemeral: true });

        const currentPlayer = game.draftOrder[0];
        if (player.id !== currentPlayer.id) return interaction.reply({ content: "It's not your turn to draft.", ephemeral: true });

        const cardIndex = game.draftPool.findIndex(c => c.name === cardName);
        if (cardIndex === -1) return interaction.reply({ content: "That card is no longer available.", ephemeral: true });

        await interaction.message.delete().catch(e => console.error("Failed to delete draft message:", e));

        const card = game.draftPool.splice(cardIndex, 1)[0];
        player.draftedCards.push(card);
        game.log.push(`${player.user.username} drafted **${card.name}**.`);

        game.draftOrder.shift();

        await this._updateAllBoards(game, { updateDraft: true });
        await this._requestDraftPick(game);
    }

    async postDraftSetup(game) {
        game.log.push('**DRAFT COMPLETE:** All special cards have been drafted.');
        const standardCards = DECK_DEFINITION.filter(card => !card.optional);
        const allDraftedCards = game.players.flatMap(p => p.draftedCards);
        game.deck = [...standardCards, ...allDraftedCards];
        this._shuffle(game.deck);

        for (let i = 0; i < 6; i++) {
            for (const player of game.players) {
                if (game.deck.length > 0) player.hand.push(game.deck.pop());
            }
        }
        game.log.push('Initial hands have been dealt. The first gambit begins.');

        game.draftPool = [];
        await this._updateAllBoards(game, { updateDraft: true });
        await this.startAntePhase(game);
    }

    // ANTE PHASE
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

        await this._updateAllBoards(game, { revealAntes: true });
        await this.startGambitPhase(game);
    }

    // GAMBIT PHASE
    async startGambitPhase(game) {
        game.state = 'gambit';
        game.log.push('**GAMBIT PHASE:** The gambit begins!');

        for(const ante of game.antePile) {
            ante.player.flight.push(ante.card);
        }
        game.antePile = [];

        const leaderIndex = game.players.findIndex(p => p.id === game.leader.id);
        game.turnOrder = [...game.players.slice(leaderIndex), ...game.players.slice(0, leaderIndex)];

        await this._updateAllBoards(game);
        await this._requestCardPlay(game);
    }

    async _requestCardPlay(game) {
        if (game.turnOrder.length === 0) {
            await this.scoreGambit(game);
            return;
        }

        const currentPlayer = game.turnOrder[0];
        const embed = new EmbedBuilder()
            .setTitle('Your Turn to Play')
            .setDescription('Select a card from your hand to play.')
            .setColor(0x9b59b6)
            .setFooter({text: `It's ${currentPlayer.user.username}'s turn.`});

        const rows = [];
        let currentRow = new ActionRowBuilder();
        for (const card of currentPlayer.hand) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_action_${game.channelId}_play_${card.name.replace(/ /g, '_')}`).setLabel(`${card.name} (Str ${card.value})`).setStyle(ButtonStyle.Primary));
        }
        rows.push(currentRow);

        try {
            await currentPlayer.dmChannel.send({ embeds: [embed], components: rows });
        } catch (e) {
            console.error(`Failed to send play request to ${currentPlayer.user.tag}`, e);
            game.turnOrder.shift();
            await this._requestCardPlay(game);
        }
    }

    async handleCardPlay(interaction, game, cardName) {
        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: "You're not in this game.", ephemeral: true });

        const currentPlayer = game.turnOrder[0];
        if (player.id !== currentPlayer.id) return interaction.reply({ content: "It's not your turn to play.", ephemeral: true });

        const cardIndex = player.hand.findIndex(c => c.name === cardName);
        if (cardIndex === -1) return interaction.reply({ content: "You don't have that card.", ephemeral: true });

        await interaction.message.delete().catch(e => console.error("Failed to delete play message:", e));

        const card = player.hand.splice(cardIndex, 1)[0];
        player.flight.push(card);
        game.log.push(`${player.user.username} played **${card.name}**.`);

        const lastPlayedCard = player.flight.length > 1 ? player.flight[player.flight.length - 2] : null;
        if (!lastPlayedCard || card.value >= lastPlayedCard.value) {
            await this._triggerCardPower(game, player, card);
        } else {
            game.log.push(`The power of **${card.name}** did not trigger because it was weaker than the previous card.`);
        }

        game.turnOrder.shift();
        await this._updateAllBoards(game);
        await this._requestCardPlay(game);
    }

    async _triggerCardPower(game, player, card) {
        game.log.push(`The power of **${card.name}** triggers!`);
        switch(card.effect) {
            case 'Black': {
                const amount = Math.min(3 * game.scaleFactor, game.pot);
                player.hoard += amount;
                game.pot -= amount;
                game.log.push(`${player.user.username} steals ${amount}gp from the pot.`);
                break;
            }
            case 'Gold': {
                const goodDragonsInFlight = player.flight.filter(c => CARD_EFFECTS.find(e => e.name === c.effect)?.alignment === 'good').length;
                game.log.push(`${player.user.username} has ${goodDragonsInFlight} good dragons in their flight.`);
                for (let i = 0; i < goodDragonsInFlight; i++) {
                    if (game.deck.length > 0) {
                        const drawnCard = game.deck.pop();
                        player.hand.push(drawnCard);
                        game.log.push(`${player.user.username} draws a card (${drawnCard.name}).`);
                    } else {
                        game.log.push('The deck is empty!');
                        break;
                    }
                }
                break;
            }
             case 'Silver': {
                for (const p of game.players) {
                    const hasGoodDragon = p.flight.some(c => CARD_EFFECTS.find(e => e.name === c.effect)?.alignment === 'good');
                    if (hasGoodDragon) {
                         if (game.deck.length > 0) {
                            const drawnCard = game.deck.pop();
                            p.hand.push(drawnCard);
                            game.log.push(`${p.user.username} has a good dragon and draws a card (${drawnCard.name}).`);
                        } else {
                            game.log.push('The deck is empty!');
                            break;
                        }
                    }
                }
                break;
            }
            default:
                game.log.push(`...but the effect for **${card.effect}** is not implemented yet.`);
        }
    }

    // END OF GAMBIT
    _calculateFlightStrength(flight) {
        return flight.reduce((sum, card) => sum + card.value, 0);
    }

    async scoreGambit(game) {
        game.state = 'scoring';
        game.log.push('**SCORING PHASE:** The gambit has ended. Calculating results...');

        let winner = null;
        let highestStrength = -1;

        for (const player of game.players) {
            const strength = this._calculateFlightStrength(player.flight);
            game.log.push(`${player.user.username}'s flight strength: ${strength}`);
            if (strength > highestStrength) {
                highestStrength = strength;
                winner = player;
            }
        }

        if (winner) {
            winner.hoard += game.pot;
            game.log.push(`**${winner.user.username}** wins the gambit with a strength of ${highestStrength} and takes the pot of ${game.pot}gp!`);
            game.pot = 0;
        } else {
            game.log.push('There was no winner. The pot rolls over to the next gambit.');
        }

        await this._updateAllBoards(game);
        await this._sendReadyCheck(game);
    }

    async _sendReadyCheck(game) {
        game.players.forEach(p => p.isReady = false);
        const embed = new EmbedBuilder()
            .setTitle('Gambit Over')
            .setDescription('The gambit has concluded. Are you ready for the next one?')
            .setColor(0xf1c40f);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tda_action_${game.channelId}_ready`).setLabel('Ready for Next Gambit').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tda_leave`).setLabel('Leave Table').setStyle(ButtonStyle.Danger) // Using the lobby leave ID
        );

        for (const player of game.players) {
            try {
                const msg = await player.dmChannel.send({ embeds: [embed], components: [row] });
                player.dmMessages.readyCheck = msg.id;
            } catch(e) { console.error(`Failed to send ready check to ${player.user.tag}`, e); }
        }
    }

    async handleReadyCheck(interaction, game) {
        const player = game.players.find(p => p.id === interaction.user.id);
        if (!player) return interaction.reply({ content: "You're not in this game.", ephemeral: true });

        player.isReady = true;
        game.log.push(`${player.user.username} is ready for the next gambit.`);
        await interaction.update({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tda_ready_confirmed').setLabel('Ready').setStyle(ButtonStyle.Success).setDisabled(true))] });

        const allReady = game.players.every(p => p.isReady);
        if (allReady) {
            await this.startNextGambit(game);
        }
    }

    async startNextGambit(game) {
        game.log.push('All players are ready. Starting the next gambit...');

        for (const player of game.players) {
            try {
                const readyMessage = await player.dmChannel.messages.fetch(player.dmMessages.readyCheck).catch(() => null);
                if (readyMessage) await readyMessage.delete();
            } catch(e) { console.error(`Failed to delete ready message for ${player.user.tag}`, e); }

            player.flight = [];
            for(let i=0; i<2; i++) {
                if (game.deck.length > 0) player.hand.push(game.deck.pop());
            }
        }

        await this.startAntePhase(game);
    }


    // EMBED CREATION
    _createLogEmbed(game) {
        return new EmbedBuilder().setTitle('Gameplay Log').setDescription(game.log.slice(-15).join('\n')).setColor(0x992d22);
    }

    _createDraftEmbed(game) {
        const embed = new EmbedBuilder().setTitle('Draft Pool').setColor(0x1abc9c);
        if (game.state === 'drafting' && game.draftPool.length > 0) {
            const remainingCards = game.draftPool.map(c => `**${c.name}** (Str ${c.value})`).join('\n');
            const nextPlayer = game.draftOrder[0];
            embed.setDescription(`Cards remaining in the pool. It is **${nextPlayer.user.username}**'s turn to pick.`);
            embed.addFields({ name: 'Available Cards', value: remainingCards });
        } else {
            embed.setDescription('The draft has concluded.');
        }
        return embed;
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
        const flightValue = opponent.flight.length > 0 ? opponent.flight.map(c => {
            const lastPlayedCard = opponent.flight.length > 1 ? opponent.flight[opponent.flight.length - 2] : null;
            // The first card in the flight (the ante) always triggers.
            const isAnte = opponent.flight.indexOf(c) === 0;
            const triggered = isAnte || !lastPlayedCard || c.value >= lastPlayedCard.value;
            return triggered ? c.name : `~~${c.name}~~`;
        }).join('\n') : 'None';

        return new EmbedBuilder()
            .setTitle(`${opponent.user.username}'s Board`)
            .addFields(
                { name: 'Hand', value: `${handRepresentation} (${opponent.hand.length}/10)` },
                { name: 'Hoard', value: `${opponent.hoard}gp`, inline: true },
                { name: 'Flight', value: flightValue, inline: true }
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
