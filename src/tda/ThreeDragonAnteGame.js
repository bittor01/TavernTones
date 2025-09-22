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

    // ... (rest of the class methods) ...

    // HELPER FUNCTIONS
    _getCardAlignmentEmoji(card) {
        switch (card.alignment) {
            case 'good': return '😇';
            case 'evil': return '😈';
            case 'mortal': return '🧑‍🎤';
            default: return '❓';
        }
    }

    _formatCardName(card) {
        return `${this._getCardAlignmentEmoji(card)} (Str ${card.value}) ${card.name}`;
    }

    _sortHand(hand) {
        const alignmentOrder = { 'good': 1, 'evil': 2, 'mortal': 3 };
        hand.sort((a, b) => {
            const alignA = alignmentOrder[a.alignment] || 4;
            const alignB = alignmentOrder[b.alignment] || 4;
            if (alignA !== alignB) {
                return alignA - alignB;
            }
            return b.value - a.value; // Sort by strength descending within the same alignment
        });
    }

    // ... (rest of the class methods, updated to use helpers) ...

    async _createPlayerEmbed(player) {
        this._sortHand(player.hand); // Sort the hand before displaying
        const cardTexts = player.hand.map(card => {
            const effect = CARD_EFFECTS.find(e => e.name === card.effect);
            return `**${this._formatCardName(card)}**: ${effect ? effect.text : 'No special effect.'}`;
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

    async _requestAnte(game, player) {
        const embed = new EmbedBuilder().setTitle('Choose Your Ante Card').setDescription('Select one card from your hand to play as your ante.').setColor(0x3498db);
        const rows = [];
        let currentRow = new ActionRowBuilder();

        this._sortHand(player.hand); // Sort hand before creating buttons
        for (const card of player.hand) {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
            const stake = card.value * game.scaleFactor;
            currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_action_${game.channelId}_ante_${card.name.replace(/ /g, '_')}`).setLabel(`${this._formatCardName(card)} - Stakes: ${stake}gp`).setStyle(ButtonStyle.Secondary));
        }
        rows.push(currentRow);
        try {
            await player.dmChannel.send({ embeds: [embed], components: rows });
        } catch (e) { console.error(`Failed to send ante request to ${player.user.tag}`, e); }
    }

    // ... (and so on for all other methods that display card names)
}

module.exports = ThreeDragonAnteGame;
