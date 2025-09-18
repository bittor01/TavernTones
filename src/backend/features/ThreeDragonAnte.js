const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const path = require('path');

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

class ThreeDragonAnteManager {
    constructor(client) {
        this.client = client;
        this.ui = null; // Will be set by CommandHandler
        this.activeGames = new Map();
        this.updateQueues = new Map(); // gameId -> { queue: [], isProcessing: false }
        this.SPECIAL_ABILITIES = SPECIAL_ABILITIES;
        this.CARD_EFFECTS = CARD_EFFECTS;
    }

    queueRender(gameId, type, priority, details = {}) {
        if (!this.activeGames.has(gameId)) return;
        if (!this.updateQueues.has(gameId)) {
            this.updateQueues.set(gameId, { isProcessing: false, queue: [] });
        }

        const queueData = this.updateQueues.get(gameId);
        queueData.queue.push({ type, priority, ...details });
        this._processUpdateQueue(gameId);
    }

    async _processUpdateQueue(gameId) {
        const queueData = this.updateQueues.get(gameId);
        if (!queueData || queueData.isProcessing) return;

        queueData.isProcessing = true;
        queueData.queue.sort((a, b) => a.priority - b.priority);

        while (queueData.queue.length > 0) {
            const task = queueData.queue.shift();
            const game = this.activeGames.get(gameId);
            if (!game) continue;

            try {
                switch (task.type) {
                    case 'render_all':
                        await this.ui.renderBoard(game);
                        await this.ui.updateScoreboard(game);
                        break;
                    case 'render_player':
                        const player = game.players.find(p => p.id === task.playerId);
                        if (player) await this.ui.renderPlayer(game, player);
                        break;
                    case 'render_scoreboard':
                        await this.ui.updateScoreboard(game);
                        break;
                }
            } catch (e) {
                console.error(`Error processing update task ${task.type} for ${gameId}`, e);
            }
        }
        queueData.isProcessing = false;
    }

    setUiManager(uiManager) {
        this.ui = uiManager;
    }

    isPlayerTurn(game, player) {
        if (!game || !player) return false;
        switch(game.state) {
            case 'drafting': return game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
            case 'ante': return !player.anteCard;
            case 'playing_round': return game.gambit.turnOrder[game.gambit.currentPlayerIndex]?.id === player.id;
            case 'continue': return player.continueStatus === 'pending';
            default: return false;
        }
    }

    _getCardAlignment(card) {
        const effect = CARD_EFFECTS.find(e => e.name === card.effect);
        return effect ? effect.alignment : 'mortal';
    }

    _sortHand(hand) {
        const alignmentOrder = { 'good': 1, 'evil': 2, 'mortal': 3 };
        hand.sort((a, b) => {
            const alignA = this._getCardAlignment(a);
            const alignB = this._getCardAlignment(b);
            if (alignmentOrder[alignA] !== alignmentOrder[alignB]) {
                return alignmentOrder[alignA] - alignmentOrder[alignB];
            }
            return b.value - a.value;
        });
    }

    async handleCommand(message) {
        if (this.activeGames.has(message.channel.id)) {
            return message.channel.send({ content: 'A game is already in progress in this channel.' });
        }
        const game = {
            hostId: null,
            channelId: message.channel.id,
            players: [],
            state: 'pre-lobby',
            client: this.client,
            turnTimer: 300,
        };
        this.activeGames.set(message.channel.id, game);

        const preLobbyEmbed = new EmbedBuilder().setTitle('A Game of Three-Dragon Ante is Starting!').setColor(0x5539cc).setDescription('Be the first to join and set the stakes for the game!');
        const preLobbyRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tda-join-set-stakes').setLabel('Join and Set Stakes').setStyle(ButtonStyle.Success));
        const lobbyMessage = await message.channel.send({ embeds: [preLobbyEmbed], components: [preLobbyRow] });
        game.lobbyMessageId = lobbyMessage.id;

        game.preLobbyCollector = lobbyMessage.createMessageComponentCollector({ time: 900000 });
        game.preLobbyCollector.on('collect', i => this.handleLobbyInteraction(i, game));
        game.preLobbyCollector.on('end', (collected, reason) => {
            if (reason !== 'game_started' && reason !== 'ante_set' && game.state === 'pre-lobby') {
                this._expireLobby(game.channelId);
            }
        });
    }

    async handleLobbyInteraction(interaction, game) {
        const user = interaction.user;
        if (game.state === 'pre-lobby' && interaction.customId === 'tda-join-set-stakes') {
            game.state = 'setting_ante';
            game.hostId = user.id;
            await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('tda-join-set-stakes').setLabel('Stakes being set...').setStyle(ButtonStyle.Success).setDisabled(true))] });
            const modal = new ModalBuilder().setCustomId(`tda-buy-in-modal_${game.channelId}`).setTitle('Set Game Buy-in');
            const anteInput = new TextInputBuilder().setCustomId('buy_in_amount').setLabel("Game Buy-in (e.g. 5000)").setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Enter a positive number, will be rounded down to nearest 50');
            const timerInput = new TextInputBuilder().setCustomId('turn_timer_minutes').setLabel("Turn Timer in Minutes (0 for none)").setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('e.g., 1, 5, 10. Default: 5');
            modal.addComponents(new ActionRowBuilder().addComponents(anteInput), new ActionRowBuilder().addComponents(timerInput));
            await interaction.showModal(modal);
        } else if (game.state === 'lobby') {
            const isPlayerInGame = game.players.some(p => p.id === user.id);
            if (interaction.customId === 'tda-join') {
                if (isPlayerInGame) return interaction.reply({ content: 'You are already in the game.', ephemeral: true });
                game.players.push({ id: user.id, user: user, hoard: game.buyIn, specialAbility: null, flight: [], hand: [], anteCard: null, handPage: 0, draftPage: 0 });
            } else if (interaction.customId === 'tda-leave') {
                if (!isPlayerInGame) return interaction.reply({ content: 'You are not in this game.', ephemeral: true });
                game.players = game.players.filter(p => p.id !== user.id);
            } else if (interaction.customId === 'tda-ability-select') {
                if (!isPlayerInGame) return interaction.reply({ content: 'You must join the game before selecting an ability.', ephemeral: true });
                game.players.find(p => p.id === user.id).specialAbility = interaction.values[0];
            } else if (interaction.customId === 'tda-start') {
                if (game.players.length < 2) return interaction.reply({ content: 'You need at least 2 players to start.', ephemeral: true });
                if (game.lobbyTimeoutId) clearTimeout(game.lobbyTimeoutId);
                if (game.lobbyIntervalId) clearInterval(game.lobbyIntervalId);
                const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
                if(lobbyMessage) lobbyMessage.createMessageComponentCollector({ time: 1 }).stop('game_started');
                const optionalCards = DECK_DEFINITION.filter(c => c.optional);
                if (optionalCards.length > 10) await this._startDraft(game);
                else {
                    game.players.sort(() => Math.random() - 0.5);
                    await this._startGameplay(game, optionalCards);
                }
                return;
            }
            await this.ui.updateLobbyEmbed(game);
            await interaction.deferUpdate();
        }
    }

    _clearTurnTimer(game) {
        if (game.turnTimerId) clearTimeout(game.turnTimerId);
        if (game.turnIntervalId) clearInterval(game.turnIntervalId);
        if (game.flashIntervalId) clearInterval(game.flashIntervalId);
        game.turnTimerId = null;
        game.turnIntervalId = null;
        game.flashIntervalId = null;
        game.turnExpiresAt = null;
        game.flashColor = null;
    }

    _startTurnTimer(game, player) {
        this._clearTurnTimer(game);
        if (game.turnTimer === 0) return;
        game.turnExpiresAt = Date.now() + game.turnTimer * 1000;
        game.turnTimerId = setTimeout(() => this._handlePlayerForfeit(game, player), game.turnTimer * 1000);

        const flashColors = ['#E9D502', '#15633D'];
        let flashIndex = 0;
        game.flashIntervalId = setInterval(() => {
            game.flashColor = flashColors[flashIndex];
            flashIndex = (flashIndex + 1) % flashColors.length;
        }, 1000);

        game.turnIntervalId = setInterval(() => this.queueRender(game.channelId, 'render_all', 3), 15000);
    }

    async _handlePlayerForfeit(game, player) {
        this._clearTurnTimer(game);
        game.gambit.log.push(`**${player.user.username} ran out of time and has been removed from the game!**`);
        game.discardPile.push(...(player.hand || []), ...(player.flight || []));
        const playerIndex = game.players.findIndex(p => p.id === player.id);
        if (playerIndex > -1) game.players.splice(playerIndex, 1);
        if (player.dmChannel) await this.ui.closeGameBoard(player, 'You ran out of time and were removed from the game.');
        if (game.players.length < 2) await this._endGame(game);
        else await this._continueGameFlow(game);
    }

    async handleBuyInModalSubmit(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const channelId = interaction.customId.split('_')[4];
        const game = this.activeGames.get(channelId);
        if (!game || game.state !== 'setting_ante') return interaction.editReply({ content: "Error: Could not find an active game or it's not time to set the ante." });

        const rawBuyIn = parseInt(interaction.fields.getTextInputValue('buy_in_amount'));
        const timerValue = interaction.fields.getTextInputValue('turn_timer_minutes');
        if (isNaN(rawBuyIn) || rawBuyIn <= 0) return interaction.editReply({ content: 'Error: Please enter a valid, positive number for the buy-in.' });
        const buyIn = Math.floor(rawBuyIn / 50) * 50;
        if (buyIn === 0) return interaction.editReply({ content: 'Error: Buy-in must be at least 50.' });

        game.buyIn = buyIn;
        game.scalingFactor = buyIn / 50;
        if (timerValue) {
            const timerMinutes = parseInt(timerValue, 10);
            if (!isNaN(timerMinutes) && timerMinutes >= 0) game.turnTimer = timerMinutes * 60;
        }
        game.state = 'lobby';
        const hostUser = await this.client.users.fetch(game.hostId);
        game.players.push({ id: game.hostId, user: hostUser, hoard: game.buyIn, specialAbility: null, flight: [], hand: [], anteCard: null, handPage: 0, draftPage: 0 });
        await interaction.editReply({ content: 'Ante set! The lobby is now open.' });

        if (game.preLobbyCollector) game.preLobbyCollector.stop('ante_set');
        game.lobbyExpiresAt = Date.now() + 900000;
        game.lobbyTimeoutId = setTimeout(() => this._expireLobby(game.channelId), 900000);
        game.lobbyIntervalId = setInterval(() => this.ui.updateLobbyEmbed(game), 60000);
        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId);
        game.lobbyCollector = lobbyMessage.createMessageComponentCollector({ time: 900000 });
        game.lobbyCollector.on('collect', i => this.handleLobbyInteraction(i, game));
        game.lobbyCollector.on('end', (c, r) => { if (r !== 'game_started') this._expireLobby(game.channelId); });
        await this.ui.updateLobbyEmbed(game);
    }

    async _expireLobby(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game || game.state === 'playing') return;
        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if(lobbyMessage) lobbyMessage.edit({ content: 'This game lobby has expired.', embeds: [], components: [] }).catch(() => {});
        if (game.lobbyTimeoutId) clearTimeout(game.lobbyTimeoutId);
        if (game.lobbyIntervalId) clearInterval(game.lobbyIntervalId);
        this.activeGames.delete(gameId);
        this.updateQueues.delete(gameId);
    }

    async _startDraft(game) {
        game.state = 'drafting';
        game.players.sort(() => Math.random() - 0.5);
        const optionalCards = DECK_DEFINITION.filter(c => c.optional);
        game.players.forEach(p => { p.draftPage = 0; });
        game.draft = {
            options: optionalCards,
            removedCount: 0,
            turnOrder: game.players.map(p => p.id),
            currentPlayerIndex: 0,
        };
        game.gambit = { log: ['The game has started. Players will now take turns removing optional cards from the deck.'], stakes: 0 };
        await this.ui.updateScoreboard(game);
        const currentPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
        this._startTurnTimer(game, currentPlayer);
        this.queueRender(game.channelId, 'render_all', 1);
    }

    async handleDraftCardRemoval(game, player, cardImage) {
        if (game.state !== 'drafting' || game.draft.turnOrder[game.draft.currentPlayerIndex] !== player.id) return;
        this._clearTurnTimer(game);
        const cardIndex = game.draft.options.findIndex(c => c.image === cardImage);
        if (cardIndex === -1) return;
        const removedCard = game.draft.options.splice(cardIndex, 1)[0];
        game.draft.removedCount++;
        game.gambit.log.push(`${player.user.username} removed the ${removedCard.name}.`);
        if (game.draft.removedCount >= 10) {
            await this._finalizeDraft(game);
        } else {
            game.draft.currentPlayerIndex = (game.draft.currentPlayerIndex + 1) % game.players.length;
            const nextPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
            if(nextPlayer) {
                nextPlayer.draftPage = 0;
                this._startTurnTimer(game, nextPlayer);
            }
            this.queueRender(game.channelId, 'render_all', 1);
        }
    }

    async handleAnte(game, player, cardIndex) {
        if (game.state !== 'ante' || player.anteCard) return;

        const card = player.hand[cardIndex];
        if (!card) return;

        player.anteCard = player.hand.splice(cardIndex, 1)[0];
        player.hoard -= (this._getCardAlignment(card) === 'good' ? 0 : 1);
        game.gambit.stakes++;

        game.gambit.log.push(`${player.user.username} antes a card.`);
        this.queueRender(game.channelId, 'render_player', 1, { playerId: player.id });
        this.queueRender(game.channelId, 'render_scoreboard', 2);

        const allAnted = game.players.every(p => p.anteCard);
        if (allAnted) {
            await this._startGambit(game);
        }
    }

    async handlePlayCard(game, player, cardIndex) {
        const isPlayerTurn = this.isPlayerTurn(game, player);
         if (game.state !== 'playing_round' || !isPlayerTurn) return;

        const card = player.hand[cardIndex];
        if (!card) return;

        this._clearTurnTimer(game);
        player.flight.push(player.hand.splice(cardIndex, 1)[0]);
        this._sortHand(player.hand);
        player.handPage = 0; // Reset hand page after playing
        game.gambit.log.push(`${player.user.username} plays the ${card.name}.`);

        this.queueRender(game.channelId, 'render_player', 1, { playerId: player.id });
        this.queueRender(game.channelId, 'render_scoreboard', 2);

        await this._resolveCardPower(game, player, card);
        await this._continueGameFlow(game);
    }

    async handlePagination(game, player, context, direction) {
        const pageProp = context === 'draft' ? 'draftPage' : 'handPage';
        const list = (context === 'draft') ? game.draft.options : player.hand;
        if (!list || list.length <= 5) return;
        const totalPages = Math.ceil(list.length / 5);
        player[pageProp] = (player[pageProp] || 0);
        if (direction === 'next') player[pageProp] = (player[pageProp] + 1) % totalPages;
        else if (direction === 'prev') player[pageProp] = (player[pageProp] - 1 + totalPages) % totalPages;
        this.queueRender(game.channelId, 'render_player', 1, { playerId: player.id });
    }

    async _finalizeDraft(game) {
        const includedOptionalCards = game.draft.options;
        game.gambit.log.push('Drafting complete!');
        game.gambit.log.push(includedOptionalCards.length > 0 ? `Included cards: ${includedOptionalCards.map(c => c.name).join(', ')}` : 'No optional cards were included.');
        delete game.draft;
        await this._startGameplay(game, includedOptionalCards);
    }
}

module.exports = ThreeDragonAnteManager;
