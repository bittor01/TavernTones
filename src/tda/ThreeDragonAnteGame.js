const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { renderHand, renderDraftGrid } = require('./CanvasHelper.js');

const DECK_DEFINITION = [
  { name: "Black Dragon", optional: false, value: 1, image: "1 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 1, image: "1 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 1, image: "1 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Bronze Dragon", optional: false, value: 1, image: "1 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 1, image: "1 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 1, image: "1 green.jpg", effect: "Green", alignment: "evil" },
  { name: "White Dragon", optional: false, value: 1, image: "1 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 2, image: "2 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 2, image: "2 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 2, image: "2 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 2, image: "2 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 2, image: "2 green.jpg", effect: "Green", alignment: "evil" },
  { name: "Red Dragon", optional: false, value: 2, image: "2 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 2, image: "2 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "White Dragon", optional: false, value: 2, image: "2 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 3, image: "3 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 3, image: "3 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Bronze Dragon", optional: false, value: 3, image: "3 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 3, image: "3 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Red Dragon", optional: false, value: 3, image: "3 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 3, image: "3 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "White Dragon", optional: false, value: 3, image: "3 white.jpg", effect: "White", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 4, image: "4 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 4, image: "4 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 4, image: "4 gold.jpg", effect: "Gold ", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 4, image: "4 green.jpg", effect: "Green", alignment: "evil" },
  { name: "White Dragon", optional: false, value: 4, image: "4 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 5, image: "5 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 5, image: "5 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 5, image: "5 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 5, image: "5 green.jpg", effect: "Green", alignment: "evil" },
  { name: "Red Dragon", optional: false, value: 5, image: "5 red.jpg", effect: "Red", alignment: "evil" },
  { name: "White Dragon", optional: false, value: 5, image: "5 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 6, image: "6 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 6, image: "6 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Bronze Dragon", optional: false, value: 6, image: "6 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 6, image: "6 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 6, image: "6 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 6, image: "6 green.jpg", effect: "Green", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 6, image: "6 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "White Dragon", optional: false, value: 6, image: "6 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 7, image: "7 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 7, image: "7 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 7, image: "7 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Bronze Dragon", optional: false, value: 7, image: "7 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 7, image: "7 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Red Dragon", optional: false, value: 7, image: "7 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 7, image: "7 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "Bronze Dragon", optional: false, value: 8, image: "8 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 8, image: "8 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 8, image: "8 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 8, image: "8 green.jpg", effect: "Green", alignment: "evil" },
  { name: "Red Dragon", optional: false, value: 8, image: "8 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 8, image: "8 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "White Dragon", optional: false, value: 8, image: "8 white.jpg", effect: "White", alignment: "evil" },
  { name: "Black Dragon", optional: false, value: 9, image: "9 black.jpg", effect: "Black", alignment: "evil" },
  { name: "Blue Dragon", optional: false, value: 9, image: "9 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Brass Dragon", optional: false, value: 9, image: "9 brass.jpg", effect: "Brass", alignment: "good" },
  { name: "Bronze Dragon", optional: false, value: 9, image: "9 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 9, image: "9 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Copper Dragon", optional: false, value: 10, image: "10 copper.jpg", effect: "Copper", alignment: "good" },
  { name: "Green Dragon", optional: false, value: 10, image: "10 green.jpg", effect: "Green", alignment: "evil" },
  { name: "Red Dragon", optional: false, value: 10, image: "10 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 10, image: "10 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "Blue Dragon", optional: false, value: 11, image: "11 blue.jpg", effect: "Blue", alignment: "evil" },
  { name: "Bronze Dragon", optional: false, value: 11, image: "11 bronze.jpg", effect: "Bronze", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 11, image: "11 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Red Dragon", optional: false, value: 12, image: "12 red.jpg", effect: "Red", alignment: "evil" },
  { name: "Silver Dragon", optional: false, value: 12, image: "12 silver.jpg", effect: "Silver", alignment: "good" },
  { name: "Gold Dragon", optional: false, value: 13, image: "13 gold.jpg", effect: "Gold", alignment: "good" },
  { name: "Black Raider", optional: true, value: 8, image: "Black Raider.jpg", effect: "BlackRaider", alignment: "evil" },
  { name: "Blue Overlord", optional: true, value: 10, image: "Blue Overlord.jpg", effect: "BlueOverlord", alignment: "evil" },
  { name: "Brass Sultan", optional: true, value: 8, image: "Brass Sultan.jpg", effect: "BrassSultan", alignment: "good" },
  { name: "Bronze Warlord", optional: true, value: 10, image: "Bronze Warlord.jpg", effect: "BronzeWarlord", alignment: "good" },
  { name: "Copper Trickster", optional: true, value: 6, image: "Copper Trickster.jpg", effect: "CopperTrickster", alignment: "good" },
  { name: "Gold Monarch", optional: true, value: 12, image: "Gold Monarch.jpg", effect: "GoldMonarch", alignment: "good" },
  { name: "Green Schemer", optional: true, value: 5, image: "Green Schemer.jpg", effect: "GreenSchemer", alignment: "evil" },
  { name: "Red Destroyer", optional: true, value: 11, image: "Red Destroyer.jpg", effect: "RedDestroyer", alignment: "evil" },
  { name: "Silver Seer", optional: true, value: 11, image: "Silver Seer.jpg", effect: "SilverSeer", alignment: "good" },
  { name: "White Hunter", optional: true, value: 7, image: "White Hunter.jpg", effect: "WhiteHunter", alignment: "evil" },
  { name: "Chromatic Wyrmling", optional: true, value: 1, image: "Chromatic Wyrmling.jpg", effect: "ChromWyrm", alignment: "evil" },
  { name: "Metallic Wyrmling", optional: true, value: 1, image: "Metallic Wyrmling.jpg", effect: "MetalWyrm", alignment: "good" },
  { name: "Dracolich", optional: true, value: 10, image: "Dracolich.jpg", effect: "Dracolich", alignment: "evil" },
  { name: "Bahamut", optional: true, value: 13, image: "Bahamut.jpg", effect: "Bahamut", alignment: "good" },
  { name: "Tiamat", optional: true, value: 13, image: "Tiamat.jpg", effect: "Tiamat", alignment: "evil" },
  { name: "The Wyrmpriest", optional: true, value: 5, image: "Wyrmpriest.jpg", effect: "Wyrmpriest", alignment: "mortal" },
  { name: "The Druid", optional: true, value: 6, image: "Druid.jpg", effect: "Druid", alignment: "mortal" },
  { name: "The Kobold", optional: true, value: 2, image: "kobold.jpg", effect: "Kobold", alignment: "mortal" },
  { name: "The Princess", optional: true, value: 4, image: "Princess.jpg", effect: "Princess", alignment: "mortal" },
  { name: "The Sorcerer", optional: true, value: 8, image: "Sorcerer.jpg", effect: "Sorcerer", alignment: "mortal" },
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
            draftPicks: 0,
        };
        game.players.push({ id: message.author.id, user: message.author, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: { draftPage: 0 }, draftedCards: [], isReady: false });
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
            game.players.push({ id: i.user.id, user: i.user, specialAbility: null, hand: [], flight: [], hoard: 0, dmMessages: { draftPage: 0 }, draftedCards: [], isReady: false });
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
        const restOfParams = params.slice(1).join('_');

        if (actionType === 'ante') {
            await this.handleAnte(interaction, game, restOfParams.replace(/_/g, ' '));
        } else if (actionType === 'draft') {
            await this.handleDraftRemoval(interaction, game, restOfParams.replace(/_/g, ' '));
        } else if (actionType === 'play') {
            await this.handleCardPlay(interaction, game, restOfParams.replace(/_/g, ' '));
        } else if (actionType === 'ready') {
            await this.handleReadyCheck(interaction, game);
        } else if (actionType === 'draftpage') {
            const newPage = parseInt(restOfParams, 10);
            await this.handleDraftPage(interaction, game, newPage);
        }
    }

    // ... (All other methods will go here, fully implemented)

}

module.exports = ThreeDragonAnteGame;
