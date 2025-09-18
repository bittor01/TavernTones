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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class ThreeDragonAnteManager {
    constructor(client) {
        this.client = client;
        this.ui = null; // Will be set by CommandHandler
        this.activeGames = new Map();
        this.updateQueues = new Map(); // gameId -> { queue: [], isProcessing: false }
        this.SPECIAL_ABILITIES = SPECIAL_ABILITIES;
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

        // Sort by priority (lower number is higher priority)
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

            // Wait after every task to respect rate limits
            await sleep(1100);
        }

        queueData.isProcessing = false;
    }

    setUiManager(uiManager) {
        this.ui = uiManager;
    }

    isPlayerTurn(game, player) {
        if (!game || !player) return false;

        switch(game.state) {
            case 'drafting':
                return game.draft.turnOrder[game.draft.currentPlayerIndex] === player.id;
            case 'ante':
                return !player.anteCard;
            case 'playing_round':
                const currentPlayer = game.gambit.turnOrder[game.gambit.currentPlayerIndex];
                return currentPlayer && currentPlayer.id === player.id;
            case 'continue':
                return player.continueStatus === 'pending';
            default:
                return false;
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
            hostId: null, // Will be set by the first player to join
            channelId: message.channel.id,
            players: [],
            state: 'pre-lobby',
            client: this.client,
            turnTimer: 300, // Default to 5 minutes (300 seconds)
        };
        this.activeGames.set(message.channel.id, game);

        const preLobbyEmbed = new EmbedBuilder()
            .setTitle('A Game of Three-Dragon Ante is Starting!')
            .setColor(0x5539cc)
            .setDescription('Be the first to join and set the stakes for the game!');

        const preLobbyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tda_join_set_stakes')
                .setLabel('Join and Set Stakes')
                .setStyle(ButtonStyle.Success)
        );

        const lobbyMessage = await message.channel.send({ embeds: [preLobbyEmbed], components: [preLobbyRow] });
        game.lobbyMessageId = lobbyMessage.id;

        // The main collector will be attached in handleBuyInModalSubmit after the lobby is officially formed.
        game.preLobbyCollector = lobbyMessage.createMessageComponentCollector({ time: 900000 }); // 15 minute timeout for pre-lobby
        game.preLobbyCollector.on('collect', i => this.handleLobbyInteraction(i, game));
        game.preLobbyCollector.on('end', (collected, reason) => {
            if (reason !== 'game_started' && reason !== 'ante_set' && game.state === 'pre-lobby') {
                this._expireLobby(game.channelId);
            }
        });
    }

    async handleLobbyInteraction(interaction, game) {
        const user = interaction.user;

        if (game.state === 'pre-lobby' && interaction.customId === 'tda_join_set_stakes') {
            game.state = 'setting_ante'; // Lock the state
            game.hostId = user.id; // The first joiner is the host

            await interaction.message.edit({
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tda_join_set_stakes')
                        .setLabel('Stakes being set...')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true)
                )]
            });

            const modal = new ModalBuilder()
                .setCustomId(`tda_buy_in_modal_${game.channelId}`)
                .setTitle('Set Game Buy-in');
            const anteInput = new TextInputBuilder()
                .setCustomId('buy_in_amount')
                .setLabel("Game Buy-in (e.g. 5000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Enter a positive number, will be rounded down to nearest 50');
            const timerInput = new TextInputBuilder()
                .setCustomId('turn_timer_seconds')
                .setLabel("Turn Timer in Seconds (0 for none)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder('e.g., 60, 300. Default: 300');

            const buyInRow = new ActionRowBuilder().addComponents(anteInput);
            const timerRow = new ActionRowBuilder().addComponents(timerInput);
            modal.addComponents(buyInRow, timerRow);
            await interaction.showModal(modal);

        } else if (game.state === 'lobby') {
            const isPlayerInGame = game.players.some(p => p.id === user.id);

            if (interaction.customId === 'tda_join') {
                if (isPlayerInGame) return interaction.reply({ content: 'You are already in the game.', ephemeral: true });
                game.players.push({ id: user.id, user: user, hoard: game.buyIn, specialAbility: null, flight: [], hand: [], anteCard: null, handPage: 0, draftPage: 0 });
            } else if (interaction.customId === 'tda_leave') {
                if (!isPlayerInGame) return interaction.reply({ content: 'You are not in this game.', ephemeral: true });
                game.players = game.players.filter(p => p.id !== user.id);
            } else if (interaction.customId === 'tda_ability_select') {
                if (!isPlayerInGame) return interaction.reply({ content: 'You must join the game before selecting an ability.', ephemeral: true });
                const player = game.players.find(p => p.id === user.id);
                player.specialAbility = interaction.values[0];
            } else if (interaction.customId === 'tda_timer_select') {
                 game.turnTimer = parseInt(interaction.values[0], 10);
            } else if (interaction.customId === 'tda_start') {
                if (game.players.length < 2) return interaction.reply({ content: 'You need at least 2 players to start.', ephemeral: true });

                if (game.lobbyTimeoutId) clearTimeout(game.lobbyTimeoutId);
                if (game.lobbyIntervalId) clearInterval(game.lobbyIntervalId);

                const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
                if(lobbyMessage) lobbyMessage.createMessageComponentCollector({ time: 1 }).stop('game_started');

                const optionalCards = DECK_DEFINITION.filter(c => c.optional);
                // The draft is to remove 10 cards. If there are 10 or fewer, there's nothing to draft.
                if (optionalCards.length > 10) {
                    await this._startDraft(game);
                } else {
                    // If no draft, just start the game with whatever optional cards are available.
                    game.players.sort(() => Math.random() - 0.5); // Still randomize order even if no draft
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
        game.turnTimerId = null;
        game.turnIntervalId = null;
        game.turnExpiresAt = null;
    }

    _startTurnTimer(game, player) {
        this._clearTurnTimer(game);
        if (game.turnTimer === 0) return;

        game.turnExpiresAt = Date.now() + game.turnTimer * 1000;

        game.turnTimerId = setTimeout(() => {
            this._handlePlayerForfeit(game, player);
        }, game.turnTimer * 1000);

        game.turnIntervalId = setInterval(() => {
            // Low priority for timer updates
            this.queueRender(game.channelId, 'render_all', 3);
        }, 15000); // Update every 15 seconds
    }

    async _handlePlayerForfeit(game, player) {
        this._clearTurnTimer(game);
        game.gambit.log.push(`**${player.user.username} ran out of time and has been removed from the game!**`);

        // Reclaim cards
        const allPlayerCards = [...(player.hand || []), ...(player.flight || [])];
        game.discardPile.push(...allPlayerCards);

        // Remove player
        const playerIndex = game.players.findIndex(p => p.id === player.id);
        if (playerIndex > -1) {
            game.players.splice(playerIndex, 1);
        }

        // Close their DM board
        if (player.dmChannel) {
            await this.ui.closeGameBoard(player, 'You ran out of time and were removed from the game.');
        }

        // Check for game over
        if (game.players.length < 2) {
            await this._endGame(game);
        } else {
            // If it was their turn, advance the game flow
            await this._continueGameFlow(game);
        }
    }

    async handleBuyInModalSubmit(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channelId = interaction.customId.split('_')[4];
        const game = this.activeGames.get(channelId);
        if (!game || game.state !== 'setting_ante') return interaction.editReply({ content: "Error: Could not find an active game or it's not time to set the ante." });

        const rawBuyIn = parseInt(interaction.fields.getTextInputValue('buy_in_amount'));
        const timerValue = interaction.fields.getTextInputValue('turn_timer_seconds');

        if (isNaN(rawBuyIn) || rawBuyIn <= 0) return interaction.editReply({ content: 'Error: Please enter a valid, positive number for the buy-in.' });

        const buyIn = Math.floor(rawBuyIn / 50) * 50;
        if (buyIn === 0) return interaction.editReply({ content: 'Error: Buy-in must be at least 50.' });

        game.buyIn = buyIn;
        game.scalingFactor = buyIn / 50;

        if (timerValue) {
            const timerSeconds = parseInt(timerValue, 10);
            if (!isNaN(timerSeconds) && timerSeconds >= 0) {
                game.turnTimer = timerSeconds;
            }
        }
        game.state = 'lobby';

        const hostUser = await this.client.users.fetch(game.hostId);
        game.players.push({ id: game.hostId, user: hostUser, hoard: game.buyIn, specialAbility: null, flight: [], hand: [], anteCard: null, handPage: 0, draftPage: 0 });

        await interaction.editReply({ content: 'Ante set! The lobby is now open.' });

        // Stop the pre-lobby collector
        if (game.preLobbyCollector) {
            game.preLobbyCollector.stop('ante_set');
        }

        game.lobbyExpiresAt = Date.now() + 15 * 60 * 1000;
        game.lobbyTimeoutId = setTimeout(() => this._expireLobby(game.channelId), 15 * 60 * 1000);
        game.lobbyIntervalId = setInterval(() => this.ui.updateLobbyEmbed(game), 60 * 1000);

        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId);
        game.lobbyCollector = lobbyMessage.createMessageComponentCollector({ time: 15 * 60 * 1000 });
        game.lobbyCollector.on('collect', i => this.handleLobbyInteraction(i, game));
        game.lobbyCollector.on('end', (collected, reason) => {
            if (reason !== 'game_started') {
                 this._expireLobby(game.channelId);
            }
        });

        await this.ui.updateLobbyEmbed(game);
    }

    async _expireLobby(gameId) {
        const game = this.activeGames.get(gameId);
        if (!game || game.state === 'playing') return;

        const lobbyMessage = await this.client.channels.cache.get(game.channelId).messages.fetch(game.lobbyMessageId).catch(() => null);
        if(lobbyMessage) {
            lobbyMessage.edit({ content: 'This game lobby has expired.', embeds: [], components: [] }).catch(() => {});
        }

        if (game.lobbyTimeoutId) clearTimeout(game.lobbyTimeoutId);
        if (game.lobbyIntervalId) clearInterval(game.lobbyIntervalId);

        this.activeGames.delete(gameId);
        this.updateQueues.delete(gameId);
    }

    async _startDraft(game) {
        game.state = 'drafting';
        // Shuffle players for random turn order at the start of the game
        game.players.sort(() => Math.random() - 0.5);

        const optionalCards = DECK_DEFINITION.filter(c => c.optional);

        game.players.forEach(p => {
            p.draftPage = 0;
        });

        game.draft = {
            options: optionalCards,
            removedCount: 0,
            turnOrder: game.players.map(p => p.id), // Will now use the shuffled order
            currentPlayerIndex: 0,
        };

        game.gambit = { log: ['The game has started. Players will now take turns removing optional cards from the deck.'], stakes: 0 };

        await this.ui.updateScoreboard(game); // Initial scoreboard render
        await this.ui.createGameBoard(game); // Create the initial DM boards

        const currentPlayer = game.players.find(p => p.id === game.draft.turnOrder[game.draft.currentPlayerIndex]);
        this._startTurnTimer(game, currentPlayer);

        this.queueRender(game.channelId, 'render_all', 1);
    }

    async handleDraftCardRemoval(game, player, cardImage) {
        if (game.state !== 'drafting' || game.draft.turnOrder[game.draft.currentPlayerIndex] !== player.id) {
            return; // Not their turn
        }
        this._clearTurnTimer(game);

        const cardIndex = game.draft.options.findIndex(c => c.image === cardImage);
        if (cardIndex === -1) return; // Card not found

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

    async handlePagination(game, player, context, direction) {
        const pageProp = context === 'draft' ? 'draftPage' : 'handPage';
        const cardsPerPage = 5;

        const list = (context === 'draft')
            ? game.draft.options
            : player.hand;

        if (!list || list.length <= cardsPerPage) return; // No need for pagination

        const totalPages = Math.ceil(list.length / cardsPerPage);
        if (player[pageProp] === undefined) player[pageProp] = 0;

        if (direction === 'next') {
            player[pageProp] = (player[pageProp] + 1) % totalPages;
        } else if (direction === 'prev') {
            player[pageProp] = (player[pageProp] - 1 + totalPages) % totalPages;
        }

        this.queueRender(game.channelId, 'render_player', 1, { playerId: player.id });
    }

    async _finalizeDraft(game) {
        const includedOptionalCards = game.draft.options;

        game.gambit.log.push('Drafting complete!');
        if (includedOptionalCards.length > 0) {
            game.gambit.log.push(`Included cards: ${includedOptionalCards.map(c => c.name).join(', ')}`);
        } else {
            game.gambit.log.push('No optional cards were included.');
        }

        delete game.draft;
        await this._startGameplay(game, includedOptionalCards);
    }

    async _startGameplay(game, includedOptionalCards = []) {
        game.state = 'playing';

        await this.ui.updateScoreboard(game); // Initial scoreboard render
        await this.ui.createGameBoard(game); // Create the initial DM boards

        const standardCards = DECK_DEFINITION.filter(c => !c.optional);
        game.deck = [...standardCards, ...includedOptionalCards];

        for (let i = game.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.deck[i], game.deck[j]] = [game.deck[j], game.deck[i]];
        }

        game.discardPile = [];
        game.players.forEach(player => {
            player.hand = game.deck.splice(0, 6);
            this._sortHand(player.hand);
            player.flight = [];
        });

        await this._startGambit(game);
    }

    async _drawCards(game, player, numToDraw) {
        for (let i = 0; i < numToDraw; i++) {
            if (game.deck.length === 0) {
                if (game.discardPile.length === 0) {
                    game.gambit.log.push('The deck and discard pile are empty. No more cards can be drawn.');
                    break;
                }
                game.gambit.log.push('The deck is empty. Shuffling the discard pile to create a new deck.');
                game.deck = [...game.discardPile];
                game.discardPile = [];
                for (let j = game.deck.length - 1; j > 0; j--) {
                    const k = Math.floor(Math.random() * (j + 1));
                    [game.deck[j], game.deck[k]] = [game.deck[k], game.deck[j]];
                }
            }
            player.hand.push(game.deck.shift());
        }
        this._sortHand(player.hand);
    }

    async _startGambit(game) {
        game.state = 'ante';
        const existingLog = game.gambit?.log || [];
        game.gambit = {
            number: (game.gambit?.number || 0) + 1,
            antedByPlayer: [],
            antePile: [],
            stakes: 0,
            rounds: [],
            log: existingLog,
            leader: game.gambit?.leader
        };
        game.players.forEach(p => {
            p.triggeredStrengthFlights = [];
            p.triggeredColorFlights = [];
            p.anteCard = null;
        });
        this.queueRender(game.channelId, 'render_all', 1);
    }

    async _startRound(game) {
        const roundNumber = (game.gambit.rounds.length || 0) + 1;
        const round = { number: roundNumber, turns: [] };
        game.gambit.rounds.push(round);
        game.state = 'playing_round';

        const leaderIndex = game.players.findIndex(p => p.id === game.gambit.leader.id);
        game.gambit.turnOrder = game.players.map((_, i) => game.players[(leaderIndex + i) % game.players.length]);
        game.gambit.currentPlayerIndex = 0;

        const currentPlayer = game.gambit.turnOrder[game.gambit.currentPlayerIndex];
        this._startTurnTimer(game, currentPlayer);

        this.queueRender(game.channelId, 'render_all', 1);
    }

    _findOpponentsByStrength(game, player, findHighest = true) {
        const opponents = game.players.filter(p => p.id !== player.id);
        if (opponents.length === 0) return [];

        const opponentStrengths = opponents.map(p => ({ player: p, strength: p.flight.reduce((sum, card) => sum + card.value, 0) }));

        let targetStrength;
        if (findHighest) {
            targetStrength = Math.max(...opponentStrengths.map(os => os.strength));
        } else {
            targetStrength = Math.min(...opponentStrengths.map(os => os.strength));
        }

        return opponentStrengths.filter(os => os.strength === targetStrength).map(os => os.player);
    }

    async _checkSpecialFlights(game, player) {
        if (player.flight.length < 3) return;

        // Check for Color Flights
        const colors = {};
        player.flight.forEach(card => {
            if (!colors[card.effect]) colors[card.effect] = 0;
            colors[card.effect]++;
        });

        for (const color in colors) {
            if (colors[color] >= 3 && !player.triggeredColorFlights.includes(color)) {
                const stealAmount = Math.min(game.gambit.stakes, 5 * game.scalingFactor);
                player.hoard += stealAmount;
                game.gambit.stakes -= stealAmount;
                player.triggeredColorFlights.push(color);
                game.gambit.log.push(`**FLIGHT BONUS!** ${player.user.username} completed a flight of ${color} dragons and stole ${stealAmount} gold from the stakes!`);
            }
        }

        // Check for Strength Flights
        const strengths = {};
        player.flight.forEach(card => {
            if (!strengths[card.value]) strengths[card.value] = 0;
            strengths[card.value]++;
        });

        for (const strength in strengths) {
            if (strengths[strength] >= 3 && !player.triggeredStrengthFlights.includes(strength)) {
                await this._drawCards(game, player, 1);
                player.triggeredStrengthFlights.push(strength);
                game.gambit.log.push(`**FLIGHT BONUS!** ${player.user.username} completed a flight of strength ${strength} dragons and drew a card!`);
            }
        }
    }

    async _endGambit(game) {
        game.state = 'scoring';
        let winner = null;
        const flightStrengths = game.players.map(p => p.flight.reduce((sum, card) => sum + card.value, 0));

        const potentialWinners = [];
        if (game.gambit.weakestWins) {
            const minStrength = Math.min(...flightStrengths);
            game.players.forEach((p, i) => {
                if (flightStrengths[i] === minStrength) potentialWinners.push(p);
            });
        } else {
            const maxStrength = Math.max(...flightStrengths);
            game.players.forEach((p, i) => {
                if (flightStrengths[i] === maxStrength) potentialWinners.push(p);
            });
        }

        const qualifiedWinners = potentialWinners.filter(p => {
            const hasTiamat = p.flight.some(c => c.effect === 'Tiamat');
            const hasBahamut = p.flight.some(c => c.effect === 'Bahamut');
            const hasGood = p.flight.some(c => CARD_EFFECTS.find(e => e.name === c.effect)?.alignment === 'good');
            const hasEvil = p.flight.some(c => CARD_EFFECTS.find(e => e.name === c.effect)?.alignment === 'evil');

            if ((hasTiamat && hasGood) || (hasBahamut && hasEvil)) {
                return false;
            }
            return true;
        });

        if (qualifiedWinners.length === 1) {
            winner = qualifiedWinners[0];
        }

        if (winner) {
            winner.hoard += game.gambit.stakes;
            game.gambit.log.push(`${winner.user.username} wins the gambit and takes ${game.gambit.stakes} gold!`);
            game.gambit.stakes = 0;

            if (winner.mustGiftGold) {
                const giftAmount = 3 * game.scalingFactor;
                for (const opponent of game.players) {
                    if (opponent.id === winner.id) continue;
                    const gift = Math.min(winner.hoard, giftAmount);
                    winner.hoard -= gift;
                    opponent.hoard += gift;
                    game.gambit.log.push(`${winner.user.username} gifts ${gift} gold to ${opponent.user.username}.`);
                }
                winner.mustGiftGold = false;
            }
        } else {
            game.gambit.log.push('There was no winner. The stakes carry over to the next gambit.');
        }

        game.players.forEach(p => {
            game.discardPile.push(...p.flight);
            p.flight = [];
            p.continueStatus = 'pending';
        });
        game.discardPile.push(...game.gambit.antePile);
        game.gambit.antePile = [];
        game.gambit.antedByPlayer = [];

        // Remove players with no gold
        const playersToRemove = game.players.filter(p => p.hoard <= 0);
        if (playersToRemove.length > 0) {
            game.gambit.log.push(playersToRemove.map(p => `${p.user.username} is out of gold and has been removed from the game.`).join('\n'));

            for (const p of playersToRemove) {
                await this.ui.closeGameBoard(p, 'You ran out of gold and have been removed from the game.');
                // Track players who left/were removed
                if (!game.gambit.playersWhoLeft) game.gambit.playersWhoLeft = [];
                game.gambit.playersWhoLeft.push(p);
            }

            game.players = game.players.filter(p => p.hoard > 0);
        }

        // Check for game over condition
        if (game.players.length < 2) {
            await this._endGame(game);
            return { gameOver: true, game, gambitWinner: winner };
        }

        for (const p of game.players) {
            await this._drawCards(game, p, 2);
        }

        game.state = 'continue';
        this.queueRender(game.channelId, 'render_all', 1);
        return { gameOver: false, game, gambitWinner: winner };
    }

    async _resolveCardPower(game, player, card, forceTrigger = false) {
        const round = game.gambit.rounds[game.gambit.rounds.length - 1];
        const turnIndex = round.turns.length - 1;
        let trigger = false;
        if (forceTrigger || player.id === game.gambit.leader.id || (turnIndex > 0 && card.value <= round.turns[turnIndex - 1].card.value)) {
            trigger = true;
        }
        if (!trigger) {
            return;
        }
        const effect = CARD_EFFECTS.find(e => e.name === card.effect);
        if (!effect) return;

        game.gambit.log.push(`The power of the ${card.name} triggers!`);

        switch (effect.name) {
            case 'Brass': {
                const currentRound = game.gambit.rounds[game.gambit.rounds.length - 1];
                if (currentRound.turns.length < 1) break;

                const lastTurnPlayerId = currentRound.turns[currentRound.turns.length - 1].player.id;
                const lastPlayerInTurnOrder = game.gambit.turnOrder.find(p => p.id === lastTurnPlayerId);
                const lastPlayerIndex = game.gambit.turnOrder.indexOf(lastPlayerInTurnOrder);
                const previousPlayerIndex = (lastPlayerIndex - 1 + game.players.length) % game.players.length;
                const lastPlayer = game.gambit.turnOrder[previousPlayerIndex];

                if (lastPlayer.id === player.id) break;

                const strongerGoodDragons = lastPlayer.hand.filter(c => {
                    const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                    return cEffect && cEffect.alignment === 'good' && c.value > card.value;
                });

                await this.ui.promptBrassDragonChoice(game, player, lastPlayer, strongerGoodDragons);
                return true;
            }
            case 'Blue': {
                await this.ui.promptBlueDragonChoice(game, player);
                return true;
            }
            case 'Green': {
                const currentPlayerIndex = game.gambit.turnOrder.findIndex(p => p.id === player.id);
                const nextPlayer = game.gambit.turnOrder[(currentPlayerIndex + 1) % game.players.length];

                const weakerEvilDragons = nextPlayer.hand.filter(c => {
                    const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                    return cEffect && cEffect.alignment === 'evil' && c.value < card.value;
                });

                await this.ui.promptGreenDragonChoice(game, player, nextPlayer, weakerEvilDragons);
                return true;
            }
            case 'Gold': {
                const goodDragons = player.flight.filter(c => {
                    const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                    return cEffect && cEffect.alignment === 'good';
                });
                const numToDraw = goodDragons.length;
                if (numToDraw > 0) {
                    game.gambit.log.push(`${player.user.username}'s Gold Dragon power lets them draw ${numToDraw} card(s).`);
                    await this._drawCards(game, player, numToDraw);
                }
                break;
            }
            case 'Silver': {
                let playersWhoDraw = [];
                for (const p of game.players) {
                    const hasGoodDragon = p.flight.some(c => {
                        const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                        return cEffect && cEffect.alignment === 'good';
                    });
                    if (hasGoodDragon) {
                        playersWhoDraw.push(p);
                    }
                }

                if (playersWhoDraw.length > 0) {
                    game.gambit.log.push(`A Silver Dragon's power is triggered! ${playersWhoDraw.map(p => p.user.username).join(', ')} will draw a card.`);
                    for (const p of playersWhoDraw) {
                        await this._drawCards(game, p, 1);
                    }
                }
                break;
            }
            case 'Bronze': {
                if (game.gambit.antePile.length < 2) {
                    game.gambit.log.push('Not enough cards in the ante pile for the Bronze Dragon\'s power.');
                    break;
                }
                // Sort ante pile by strength ascending
                game.gambit.antePile.sort((a, b) => a.value - b.value);
                const weakestTwo = game.gambit.antePile.splice(0, 2);
                player.hand.push(...weakestTwo);
                game.gambit.log.push(`${player.user.username} uses the Bronze Dragon's power to take the ${weakestTwo.map(c => c.name).join(' and ')} from the ante pile.`);
                break;
            }
            case 'White': {
                const weakestOpponents = this._findOpponentsByStrength(game, player, false);
                if (weakestOpponents.length === 0) break;

                if (weakestOpponents.length === 1) {
                    const target = weakestOpponents[0];
                    const payment = Math.min(target.hoard, 2 * game.scalingFactor);
                    target.hoard -= payment;
                    player.hoard += payment;
                    game.gambit.log.push(`${player.user.username}'s White Dragon forces ${target.user.username} to pay ${payment} gold.`);
                } else {
                    game.pendingPlayerChoice = {
                        type: 'WhiteDragonTarget',
                        player,
                        options: weakestOpponents
                    };
                    await this.ui.promptTargetPlayer(game, player, weakestOpponents, "Choose weakest opponent to take 2 gold from:");
                    return true;
                }
                break;
            }
            case 'Red': {
                const strongestOpponents = this._findOpponentsByStrength(game, player, true);
                if (strongestOpponents.length === 0) break;

                if (strongestOpponents.length === 1) {
                    const target = strongestOpponents[0];
                    const payment = Math.min(target.hoard, 1 * game.scalingFactor);
                    target.hoard -= payment;
                    player.hoard += payment;
                    game.gambit.log.push(`${player.user.username}'s Red Dragon forces ${target.user.username} to pay ${payment} gold.`);

                    if (target.hand.length > 0) {
                        const randomIndex = Math.floor(Math.random() * target.hand.length);
                        const stolenCard = target.hand.splice(randomIndex, 1)[0];
                        player.hand.push(stolenCard);
                        game.gambit.log.push(`${player.user.username} also steals a random card from ${target.user.username}'s hand.`);
                    }
                } else {
                    game.pendingPlayerChoice = {
                        type: 'RedDragonTarget',
                        player,
                        options: strongestOpponents
                    };
                    await this.ui.promptTargetPlayer(game, player, strongestOpponents, "Choose strongest opponent to take 1 gold and a card from:");
                    return true;
                }
                break;
            }
            case 'Copper': {
                const copperCardIndex = player.flight.findIndex(c => c.effect === 'Copper');
                if (copperCardIndex === -1) break;

                if (game.deck.length === 0) {
                    game.gambit.log.push('The deck is empty, the Copper Dragon\'s power fails.');
                    break;
                }

                const copperCard = player.flight.splice(copperCardIndex, 1)[0];
                game.discardPile.push(copperCard);

                const newCard = game.deck.shift();
                player.flight.splice(copperCardIndex, 0, newCard);
                game.gambit.log.push(`${player.user.username}'s Copper Dragon is discarded and replaced with the ${newCard.name}.`);

                const waitingForInput = await this._resolveCardPower(game, player, newCard, true);
                // If the new card also requires input, we need to return true up the chain
                if (waitingForInput) return true;

                break;
            }
            case 'Kobold': {
                if (player.hand.length === 0) {
                    game.gambit.log.push('Your hand is empty, the Kobold has no effect.');
                    break;
                }
                await this.ui.promptKoboldChoice(game, player);
                return true; // Pauses game flow
            }
            case 'Sorcerer': {
                if (game.deck.length < 3) {
                    game.gambit.log.push('Not enough cards in the deck for the Sorcerer\'s power.');
                    break;
                }
                const revealedCards = game.deck.splice(0, 3);

                const sorcererInFlight = player.flight.find(c => c.effect === 'Sorcerer' && !c.markedForReplacement);
                if (sorcererInFlight) {
                    sorcererInFlight.markedForReplacement = true;
                } else {
                    game.gambit.log.push('Error: Could not find the Sorcerer card to replace.');
                    game.deck.unshift(...revealedCards); // Return cards to deck
                    break;
                }

                const revealedCardData = revealedCards.map(card => {
                    const effect = CARD_EFFECTS.find(e => e.name === card.effect);
                    return {
                        name: card.name,
                        value: card.value,
                        text: effect ? effect.text : 'None',
                        image: card.image
                    };
                });

                game.pendingSorcererChoice = {
                    playerId: player.id,
                    revealedCards: revealedCards // Still store the full card object for later logic
                };

                await this.ui.promptSorcererChoice(game, player, revealedCardData);
                return true; // Pauses game flow
            }
        }
    }

    async _continueGameFlow(game) {
        game.gambit.currentPlayerIndex++;

        if (game.gambit.currentPlayerIndex >= game.players.length) {
            const roundNumber = game.gambit.rounds.length;
            let gambitOver = false;
            if (roundNumber >= 4) {
                gambitOver = true;
            } else if (roundNumber === 3 && !game.gambit.playedBronzeWarlord) {
                gambitOver = true;
            }

            if (gambitOver) {
                const { winner } = await this._endGambit(game);
                game.gambit.log.push(`Gambit ends. ${winner ? winner.user.username + ' wins the stakes!' : 'The stakes are added to the next gambit.'}`);
                return;
            } else {
                if (game.gambit.playedBronzeWarlord && game.gambit.rounds.length === 3) {
                     game.gambit.log.push(`${game.gambit.playedBronzeWarlord.user.username} played the Bronze Warlord! A fourth round begins.`);
                }
                game.gambit.log.push(`Round ${game.gambit.rounds.length} ends. Starting a new round.`);
                await this._startRound(game);
                return;
            }
        }

        this.queueRender(game.channelId, 'render_all', 2);
    }

    async handleAnte(game, player, cardIndex) {
        if (player.anteCard) {
            return;
        }
        this._clearTurnTimer(game);
        if (!player.hand[cardIndex]) {
            console.error(`TDA Error: Player ${player.user.username} tried to ante with invalid card index ${cardIndex}`);
            return;
        }

        const card = player.hand.splice(cardIndex, 1)[0];
        player.anteCard = card;
        game.gambit.antePile.push(card);
        game.gambit.antedByPlayer.push({ player, card });

        const anteAmount = card.value * game.scalingFactor;
        player.hoard -= anteAmount;
        game.gambit.stakes += anteAmount;

        game.gambit.log.push(`${player.user.username} antes with their ${card.name} and pays ${anteAmount} to the stakes.`);

        const allAnted = game.players.every(p => p.anteCard);

        if (allAnted) {
            this._determineLeader(game);
            game.gambit.log.push(`The new leader is ${game.gambit.leader.user.username}.`);
            await this._startRound(game);
        } else {
            this.queueRender(game.channelId, 'render_all', 2);
        }
    }

    _determineLeader(game) {
        let highestAnte = -1;
        let potentialLeaders = [];

        for (const p of game.players) {
            if (p.anteCard.value > highestAnte) {
                highestAnte = p.anteCard.value;
                potentialLeaders = [p];
            } else if (p.anteCard.value === highestAnte) {
                potentialLeaders.push(p);
            }
        }

        if (potentialLeaders.length === 1) {
            game.gambit.leader = potentialLeaders[0];
        } else {
            const previousLeader = game.gambit.leader;
            if (previousLeader && potentialLeaders.some(p => p.id === previousLeader.id)) {
                game.gambit.leader = previousLeader;
            } else {
                game.gambit.leader = potentialLeaders[Math.floor(Math.random() * potentialLeaders.length)];
            }
        }
    }

    async handlePlayCard(game, player, cardIndex) {
        this._clearTurnTimer(game);
        if (!player.hand[cardIndex]) {
            console.error(`TDA Error: Player ${player.user.username} tried to play with invalid card index ${cardIndex}`);
            return;
        }

        const card = player.hand.splice(cardIndex, 1)[0];
        player.flight.push(card);

        // After playing a card, check if the current hand page is now empty and adjust.
        const cardsPerPage = 5;
        const handPage = player.handPage || 0;
        const startIndex = handPage * cardsPerPage;
        if (startIndex >= player.hand.length && player.hand.length > 0) {
            player.handPage = Math.floor((player.hand.length - 1) / cardsPerPage);
        }

        const currentRound = game.gambit.rounds[game.gambit.rounds.length - 1];
        currentRound.turns.push({ player, card });

        game.gambit.log.push(`${player.user.username} plays the ${card.name} (Strength ${card.value}).`);

        const waitingForInput = await this._resolveCardPower(game, player, card);

        // This needs to be called after the card power, as powers can alter the flight
        await this._checkSpecialFlights(game, player);

        if (!waitingForInput) {
            await this._continueGameFlow(game);
        }
    }

    async resolveBlueDragonChoice(game, player, choice) {
        this._clearTurnTimer(game);
        const goldAmount = 1 * game.scalingFactor;
        const flightCount = player.flight.length;

        if (choice === 'take') {
            game.gambit.log.push(`${player.user.username} chose to take gold from opponents.`);
            for (const opponent of game.players) {
                if (opponent.id === player.id) continue;
                const payment = Math.min(opponent.hoard, goldAmount);
                opponent.hoard -= payment;
                player.hoard += payment;
                game.gambit.log.push(`  - ${opponent.user.username} pays ${payment} gold.`);
            }
        } else { // choice === 'stakes'
            const stakeAmount = goldAmount * flightCount;
            game.gambit.log.push(`${player.user.username} chose to have opponents add to the stakes.`);
            for (const opponent of game.players) {
                if (opponent.id === player.id) continue;
                const payment = Math.min(opponent.hoard, stakeAmount);
                opponent.hoard -= payment;
                game.gambit.stakes += payment;
                game.gambit.log.push(`  - ${opponent.user.username} pays ${payment} gold to the stakes.`);
            }
        }

        await this._continueGameFlow(game);
    }

    async resolveGreenDragonChoice(game, originalPlayer, nextPlayer, choice, cardIndex = null) {
        this._clearTurnTimer(game);
        if (choice === 'pay') {
            const goldAmount = 5 * game.scalingFactor;
            const payment = Math.min(nextPlayer.hoard, goldAmount);
            nextPlayer.hoard -= payment;
            originalPlayer.hoard += payment;
            game.gambit.log.push(`${nextPlayer.user.username} chooses to pay ${originalPlayer.user.username} ${payment} gold.`);
        } else { // choice === 'give'
            if (cardIndex === null || !nextPlayer.hand[cardIndex]) {
                console.error(`TDA Error: Invalid card index ${cardIndex} for Green Dragon choice.`);
                game.gambit.log.push(`An error occurred with Green Dragon choice. No action taken.`);
            } else {
                const card = nextPlayer.hand.splice(cardIndex, 1)[0];
                originalPlayer.hand.push(card);
                game.gambit.log.push(`${nextPlayer.user.username} gives the ${card.name} to ${originalPlayer.user.username}.`);
            }
        }

        await this._continueGameFlow(game);
    }

    async resolveBrassDragonChoice(game, originalPlayer, lastPlayer, choice, cardIndex = null) {
        this._clearTurnTimer(game);
        if (choice === 'pay') {
            const goldAmount = 5 * game.scalingFactor;
            const payment = Math.min(lastPlayer.hoard, goldAmount);
            lastPlayer.hoard -= payment;
            originalPlayer.hoard += payment;
            game.gambit.log.push(`${lastPlayer.user.username} chooses to pay ${originalPlayer.user.username} ${payment} gold.`);
        } else { // choice === 'give'
            if (cardIndex === null || !lastPlayer.hand[cardIndex]) {
                console.error(`TDA Error: Invalid card index ${cardIndex} for Brass Dragon choice.`);
                game.gambit.log.push(`An error occurred with Brass Dragon choice. No action taken.`);
            } else {
                const card = lastPlayer.hand.splice(cardIndex, 1)[0];
                originalPlayer.hand.push(card);
                game.gambit.log.push(`${lastPlayer.user.username} gives the ${card.name} to ${originalPlayer.user.username}.`);
            }
        }

        await this._continueGameFlow(game);
    }

    async resolveKoboldChoice(game, player, cardIndicesToDiscard) {
        this._clearTurnTimer(game);
        const numToDiscard = cardIndicesToDiscard.length;
        if (numToDiscard === 0) {
            game.gambit.log.push(`${player.user.username} uses the Kobold's power but chooses not to discard any cards.`);
            await this._continueGameFlow(game);
            return;
        }

        cardIndicesToDiscard.sort((a, b) => parseInt(b) - parseInt(a));

        const discardedCards = [];
        for (const index of cardIndicesToDiscard) {
            if (player.hand[index]) {
                discardedCards.push(player.hand.splice(index, 1)[0]);
            }
        }

        if (discardedCards.length > 0) {
            game.discardPile.push(...discardedCards);
            game.gambit.log.push(`${player.user.username} uses the Kobold's power to discard ${discardedCards.length} card(s).`);

            await this._drawCards(game, player, discardedCards.length);
            game.gambit.log.push(`${player.user.username} draws ${discardedCards.length} new card(s).`);
        }

        await this._continueGameFlow(game);
    }

    async resolveSorcererChoice(game, player, chosenCardImage) {
        this._clearTurnTimer(game);
        if (!game.pendingSorcererChoice || game.pendingSorcererChoice.playerId !== player.id) {
            console.error('TDA Error: Mismatched sorcerer choice resolution.');
            // It's possible for a user to click an old button. Just ignore it.
            return;
        }
        const { revealedCards } = game.pendingSorcererChoice;
        delete game.pendingSorcererChoice;

        const chosenCard = revealedCards.find(c => c.image === chosenCardImage);
        const otherCards = revealedCards.filter(c => c.image !== chosenCardImage);

        if (!chosenCard) {
            console.error(`TDA Error: Could not find chosen card with image ${chosenCardImage}`);
            game.gambit.log.push('An error occurred with the Sorcerer\'s power.');
            game.deck.unshift(...revealedCards);
            await this._continueGameFlow(game);
            return;
        }

        const sorcererIndex = player.flight.findIndex(c => c.markedForReplacement);
        if (sorcererIndex !== -1) {
            const sorcererCard = player.flight[sorcererIndex];
            player.flight.splice(sorcererIndex, 1, chosenCard);
            game.discardPile.push(sorcererCard);
            delete sorcererCard.markedForReplacement;
        } else {
             console.error(`TDA Error: Could not find marked Sorcerer to replace.`);
             game.gambit.log.push('An error occurred replacing the Sorcerer card.');
        }

        game.gambit.antePile.push(...otherCards);
        game.gambit.log.push(`${player.user.username} uses the Sorcerer's power, chooses the ${chosenCard.name}, and adds ${otherCards.length} cards to the ante pile.`);

        const waitingForInput = await this._resolveCardPower(game, player, chosenCard, true);

        if (!waitingForInput) {
            await this._continueGameFlow(game);
        }
    }

    async resolvePlayerTargetChoice(game, choosingPlayer, targetPlayerId) {
        this._clearTurnTimer(game);
        if (!game.pendingPlayerChoice || game.pendingPlayerChoice.player.id !== choosingPlayer.id) {
            return; // Invalid state or not the right player
        }

        const choiceType = game.pendingPlayerChoice.type;
        const target = game.players.find(p => p.id === targetPlayerId);
        if (!target) return; // Target not found

        delete game.pendingPlayerChoice;

        if (choiceType === 'WhiteDragonTarget') {
            const payment = Math.min(target.hoard, 2 * game.scalingFactor);
            target.hoard -= payment;
            choosingPlayer.hoard += payment;
            game.gambit.log.push(`${choosingPlayer.user.username}'s White Dragon forces ${target.user.username} to pay ${payment} gold.`);
        } else if (choiceType === 'RedDragonTarget') {
            const payment = Math.min(target.hoard, 1 * game.scalingFactor);
            target.hoard -= payment;
            choosingPlayer.hoard += payment;
            game.gambit.log.push(`${choosingPlayer.user.username}'s Red Dragon forces ${target.user.username} to pay ${payment} gold.`);

            if (target.hand.length > 0) {
                const randomIndex = Math.floor(Math.random() * target.hand.length);
                const stolenCard = target.hand.splice(randomIndex, 1)[0];
                choosingPlayer.hand.push(stolenCard);
                game.gambit.log.push(`${choosingPlayer.user.username} also steals a random card from ${target.user.username}'s hand.`);
            }
        }

        await this._continueGameFlow(game);
    }

    async handleContinueChoice(game, player, choice) {
        if (player.continueStatus !== 'pending') {
            return; // Player has already made a choice
        }
        this._clearTurnTimer(game);

        if (choice === 'leave') {
            player.continueStatus = 'left';
            game.gambit.log.push(`${player.user.username} has left the game.`);
            const allPlayerCards = [...(player.hand || []), ...(player.flight || [])];
            game.discardPile.push(...allPlayerCards);

            const playerIndex = game.players.findIndex(p => p.id === player.id);
            if (playerIndex > -1) {
                game.players.splice(playerIndex, 1);
            }
            if (player.dmChannel) {
                await this.ui.closeGameBoard(player, 'You have left the game.');
            }
        } else {
            player.continueStatus = choice; // 'same_deck' or 'new_deck'
            game.gambit.log.push(`${player.user.username} is ready to play again.`);
        }

        if (game.players.length < 2) {
            await this._endGame(game);
            return;
        }

        const allReady = game.players.every(p => p.continueStatus !== 'pending');

        if (allReady) {
            const wantsNewDeck = game.players.some(p => p.continueStatus === 'new_deck');
            if (wantsNewDeck) {
                game.gambit.log.push('At least one player wants a new deck. Starting a new draft!');
                await this._startDraft(game);
            } else {
                game.gambit.log.push('All players are ready. Starting the next gambit with the same deck!');
                game.players.forEach(p => p.continueStatus = 'pending');
                await this._startGambit(game);
            }
        } else {
            this.queueRender(game.channelId, 'render_all', 2);
        }
    }

    async handleCardDetailsButton(interaction, game, player, context) {
        let cardsToShow = [];
        if (context === 'hand') {
            const page = player.handPage || 0;
            const cardsPerPage = 5;
            const startIndex = page * cardsPerPage;
            cardsToShow = (player.hand || []).slice(startIndex, startIndex + cardsPerPage);
        }
        // Could add other contexts like 'flight' later if needed

        if (cardsToShow.length === 0) {
            return interaction.reply({ content: 'There are no cards to show details for.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0xabcdef)
            .setTitle('Card Details');

        cardsToShow.forEach(card => {
            const effect = CARD_EFFECTS.find(e => e.name === card.effect);
            embed.addFields({
                name: `${card.name} (Str ${card.value})`,
                value: effect ? effect.text : 'No special power.'
            });
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async _endGame(game) {
        // This is a simplified end game function.
        // A more robust version would declare a winner if one exists.
        const winner = game.players.length === 1 ? game.players[0] : null;
        const gameOverMessage = winner
            ? `${winner.user.username} is the last player remaining and wins the game!`
            : 'Not enough players to continue. The game has ended.';

        game.gambit.log.push(gameOverMessage);

        // Notify all original players and close their boards
        const allOriginalPlayers = [...game.players];
        const playersWhoLeft = game.gambit.playersWhoLeft || []; // Assuming we track this
        allOriginalPlayers.push(...playersWhoLeft);

        for(const p of allOriginalPlayers) {
            if (p.dmChannel) {
                await this.ui.closeGameBoard(p, `The game has ended. ${gameOverMessage}`);
            }
        }

        // Clean up the active game
        this.activeGames.delete(game.channelId);
        this.updateQueues.delete(game.channelId);

        // Send a final message to the main channel
        const channel = await this.client.channels.fetch(game.channelId);
        if (channel) {
            await channel.send(`The game of Three-Dragon Ante has concluded. ${gameOverMessage}`);
        }
    }
}

module.exports = ThreeDragonAnteManager;
