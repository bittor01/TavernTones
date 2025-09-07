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
//{ name: "", value: , image: ".jpg", effect: "" },
//{ name: "", alignment: "", text: "" },
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

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

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

/**
 * Initializes the Three-Dragon Ante game command listeners.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
function initializeThreeDragonAnte(client) {
    const activeGames = new Map();

    const generateLobbyEmbed = (game) => {
        const embed = new EmbedBuilder()
            .setTitle('Three-Dragon Ante Lobby')
            .setColor(0x5539cc)
            .setDescription('Players are gathering to play Three-Dragon Ante. Click "Join" to enter the game!')
            .setFooter({ text: 'The game will begin once the "Start Game" button is pressed.' });

        let playerList = game.players.map(p => {
            const ability = SPECIAL_ABILITIES.find(a => a.value === p.specialAbility);
            return `- ${p.user.username}` + (ability ? ` (${ability.label})` : '');
        }).join('\n');

        if (!playerList) {
            playerList = 'No players have joined yet.';
        }

        embed.addFields({ name: `Players (${game.players.length})`, value: playerList });
        return embed;
    };

    const buildLobbyComponents = (game, disabled = false) => {
        const joinButton = new ButtonBuilder().setCustomId('tda_join').setLabel('Join Game').setStyle(ButtonStyle.Success).setDisabled(disabled);
        const leaveButton = new ButtonBuilder().setCustomId('tda_leave').setLabel('Leave Game').setStyle(ButtonStyle.Danger).setDisabled(disabled);
        const startButton = new ButtonBuilder().setCustomId('tda_start').setLabel('Start Game').setStyle(ButtonStyle.Primary).setDisabled(disabled || game.players.length < 2);
        const abilityMenu = new StringSelectMenuBuilder().setCustomId('tda_ability_select').setPlaceholder('Choose a special ability (optional)').addOptions(SPECIAL_ABILITIES).setDisabled(disabled);

        const row1 = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);
        const row2 = new ActionRowBuilder().addComponents(abilityMenu);
        return [row1, row2];
    };

    const startGame = async (game, channel) => {
        try {
            const host = game.players[0];
            if (!host) {
                channel.send({ content: "The host has left! Game cancelled." });
                return activeGames.delete(channel.id);
            }

            const dmChannel = await host.user.createDM();
            await dmChannel.send({ content: "You are the host! Please set the initial ante for the game in GP. Enter a whole number (e.g., 1000). You have 60 seconds." });

            const filter = m => !m.author.bot && !isNaN(parseInt(m.content)) && parseInt(m.content) > 0;
            const collector = dmChannel.createMessageCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async m => {
                const ante = parseInt(m.content);
                game.initialAnte = ante;
                game.players.forEach(p => { p.hoard = ante; });

                await dmChannel.send({ content: `The ante is set to ${ante} GP. Each player starts with ${ante} GP.` });
                await channel.send({ content: `The ante has been set by the host. The card draft will now begin in your DMs.` });

                startDrafting(game, channel);
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    channel.send({ content: `The host did not set the ante in time. The game has been cancelled.` });
                    activeGames.delete(game.channelId);
                }
            });
        } catch (error) {
            console.error("Error starting game:", error);
            channel.send({ content: "There was an error starting the game. Please try again." });
            activeGames.delete(game.channelId);
        }
        // After any power resolves, check if the new card in the flight completed a special flight
        await checkSpecialFlights(game, player, channel);
    };

    const startDrafting = async (game, channel) => {
        game.state = 'drafting';
        game.removedCards = [];
        const optionalCards = DECK_DEFINITION.filter(c => c.optional);

        let draftTurnIndex = 1; // Start with player 2
        let removedCount = 0;

        const nextDraftTurn = async () => {
            if (removedCount >= 10) {
                await channel.send({ content: "The card draft is complete! The final deck is being prepared. Dealing hands now..." });
                startGameplay(game, channel);
                return;
            }

            const currentPlayerIndex = draftTurnIndex % game.players.length;
            const currentPlayer = game.players[currentPlayerIndex];

            await channel.send({ content: `It's ${currentPlayer.user.username}'s turn to remove a card.` });

            const availableToDraft = optionalCards.filter(c => !game.removedCards.includes(c));
            const dmChannel = await currentPlayer.user.createDM();

            const rows = [];
            let currentRow = new ActionRowBuilder();
            availableToDraft.forEach((card, index) => {
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
                currentRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`tda_draft_remove_${index}`)
                        .setLabel(card.name)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
            if (currentRow.components.length > 0) {
                rows.push(currentRow);
            }

            const draftMessage = await dmChannel.send({
                content: 'It\'s your turn to draft. Please choose one card to **remove** from the deck for this game. You have 2 minutes.',
                components: rows,
            });

            const collector = draftMessage.createMessageComponentCollector({ filter: i => i.user.id === currentPlayer.id, time: 120000, max: 1 });

            collector.on('collect', async i => {
                const cardIndex = parseInt(i.customId.split('_')[3]);
                const removedCard = availableToDraft[cardIndex];
                game.removedCards.push(removedCard);
                removedCount++;

                await i.update({ content: `You have removed **${removedCard.name}**. The draft continues.`, components: [] });
                await channel.send({ content: `**${currentPlayer.user.username}** has removed the **${removedCard.name}**.` });

                draftTurnIndex++;
                nextDraftTurn();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    const removedCard = availableToDraft[0];
                    game.removedCards.push(removedCard);
                    removedCount++;

                    dmChannel.send({ content: `You did not make a selection in time. The **${removedCard.name}** has been removed for you.` });
                    channel.send({ content: `**${currentPlayer.user.username}** did not choose in time. The **${removedCard.name}** has been removed automatically. The draft continues.` });

                    draftTurnIndex++;
                    nextDraftTurn();
                }
            });
        };

        await nextDraftTurn();
    };

    const startGameplay = async (game, channel) => {
        game.state = 'playing';

        // 1. Construct final deck
        const standardCards = DECK_DEFINITION.filter(c => !c.optional);
        const optionalCards = DECK_DEFINITION.filter(c => c.optional && !game.removedCards.includes(c));
        game.deck = [...standardCards, ...optionalCards];

        // 2. Shuffle the deck (Fisher-Yates shuffle)
        for (let i = game.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.deck[i], game.deck[j]] = [game.deck[j], game.deck[i]];
        }

        game.discardPile = [];

        // 3. Deal initial hands
        game.players.forEach(player => {
            player.hand = game.deck.splice(0, 6); // Takes the first 6 cards from the deck
            player.flight = []; // Initialize empty flight
        });

        await channel.send({ content: "Hands have been dealt. The first gambit will now begin!"});

        // 4. Start the first gambit
        startGambit(game, channel);
    };

    const startGambit = async (game, channel) => {
        game.state = 'ante';
        game.gambit = {
            number: (game.gambit?.number || 0) + 1,
            antedByPlayer: [], // Store {card, player} for processing
            antePile: [],      // Store raw cards in the ante
            stakes: 0,
            rounds: [],
        };
        game.players.forEach(p => {
            p.triggeredStrengthFlights = [];
            p.triggeredColorFlights = [];
        });

        await channel.send(`--- **Gambit ${game.gambit.number} begins!** ---\nPlayers are now choosing their ante cards in their DMs.`);

        const antePromises = game.players.map(player => {
            return new Promise(async (resolve) => {
                try {
                    const dmChannel = await player.user.createDM();

                    const rows = [];
                    let currentRow = new ActionRowBuilder();
                    player.hand.forEach((card, index) => {
                        if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                        currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_ante_${index}`).setLabel(card.name).setStyle(ButtonStyle.Secondary));
                    });
                    if (currentRow.components.length > 0) { rows.push(currentRow); }

                    const anteMessage = await dmChannel.send({ content: 'Choose a card from your hand to ante for this gambit. You have 2 minutes.', components: rows });
                    const collector = anteMessage.createMessageComponentCollector({ filter: i => i.user.id === player.id, time: 120000, max: 1 });

                    collector.on('collect', async i => {
                        const cardIndex = parseInt(i.customId.split('_')[2]);
                        const card = player.hand[cardIndex];
                        player.hand.splice(cardIndex, 1);
                        game.gambit.antedByPlayer.push({ card, player });
                        await i.update({ content: `You have anted the **${card.name}**. Waiting for other players.`, components: [] });
                        resolve();
                    });

                    collector.on('end', (collected, reason) => {
                        if (reason === 'time') {
                            const card = player.hand[0];
                            player.hand.splice(0, 1);
                            game.gambit.antedByPlayer.push({ card, player });
                            dmChannel.send({ content: `You ran out of time! The **${card.name}** was anted for you.` });
                            resolve();
                        }
                    });
                } catch (e) {
                    console.error(`Failed to DM player ${player.user.username}`, e);
                    channel.send(`Could not DM ${player.user.username}. Auto-anteing their first card.`);
                    const card = player.hand[0];
                    player.hand.splice(0, 1);
                    game.gambit.anteCards.push({ card, player });
                    resolve();
                }
            });
        });

        await Promise.all(antePromises);

        // Populate the antePile from the player antes
        game.gambit.antePile.push(...game.gambit.antedByPlayer.map(a => a.card));

        // All players have anted. Now, process the results using antedByPlayer
        const anteCardText = game.gambit.antedByPlayer.map(ac => `**${ac.player.user.username}** anted a **${ac.card.name}** (Strength ${ac.card.value})`).join('\n');
        await channel.send({ content: `**Ante Results**\n${anteCardText}` });

        const highestStrength = Math.max(...game.gambit.antedByPlayer.map(ac => ac.card.value));
        const anteAmount = highestStrength;
        game.gambit.stakes = 0;

        let paymentText = `The highest ante card has strength ${anteAmount}. All players pay ${anteAmount} gold to the stakes.\n`;
        game.players.forEach(p => {
            const payment = Math.min(p.hoard, anteAmount);
            p.hoard -= payment;
            game.gambit.stakes += payment;
            paymentText += `- **${p.user.username}** pays ${payment} gold. (Hoard: ${p.hoard})\n`;
        });
        await channel.send({ content: paymentText });

        const strengthCounts = {};
        game.gambit.antedByPlayer.forEach(ac => {
            strengthCounts[ac.card.value] = (strengthCounts[ac.card.value] || 0) + 1;
        });

        let uniqueHighStrength = 0;
        let leader = null;
        game.gambit.antedByPlayer.forEach(ac => {
            if (strengthCounts[ac.card.value] === 1 && ac.card.value > uniqueHighStrength) {
                uniqueHighStrength = ac.card.value;
                leader = ac.player;
            }
        });

        if (!leader) {
            await channel.send({ content: "All ante cards were tied! Discarding antes and re-anteing." });
            game.discardPile.push(...game.gambit.antePile);
            game.gambit.antePile = [];
            game.gambit.antedByPlayer = [];
            game.players.forEach(p => { if (game.deck.length > 0) p.hand.push(game.deck.pop()); });
            startGambit(game, channel); // Recursive call to re-ante
            return;
        }

        game.gambit.leader = leader;
        game.gambit.currentPlayerId = leader.id;

        await channel.send({ content: `The leader for the first round is **${leader.user.username}**.` });
        startRound(game, channel);
    };

    const startRound = async (game, channel) => {
        const roundNumber = game.gambit.rounds.length + 1;
        const round = { number: roundNumber, turns: [] };
        game.gambit.rounds.push(round);
        game.state = 'playing_round';

        await channel.send(`-- Round ${roundNumber} --`);

        const leaderIndex = game.players.findIndex(p => p.id === game.gambit.leader.id);

        for (let i = 0; i < game.players.length; i++) {
            const currentPlayerIndex = (leaderIndex + i) % game.players.length;
            const currentPlayer = game.players[currentPlayerIndex];
            game.gambit.currentPlayerId = currentPlayer.id;

            await channel.send({ content: `It's **${currentPlayer.user.username}**'s turn to play.` });

            const playedCard = await getPlayerMove(game, currentPlayer);
            if (!playedCard) {
                // Player failed to move, maybe the DM failed. The game should probably end.
                await channel.send({ content: `Could not get a move from ${currentPlayer.user.username}. The game cannot continue.`});
                activeGames.delete(game.channelId);
                return;
            }

            currentPlayer.flight.push(playedCard);
            round.turns.push({ player: currentPlayer, card: playedCard });

            await channel.send({ content: `**${currentPlayer.user.username}** played the **${playedCard.name}** (Strength ${playedCard.value}).` });

            await resolveCardPower(game, currentPlayer, playedCard, channel);
        }

        await channel.send({ content: `-- End of Round ${roundNumber} --` });

        // 1. Determine next leader
        const roundTurns = round.turns;
        const strengthCounts = {};
        roundTurns.forEach(t => { strengthCounts[t.card.value] = (strengthCounts[t.card.value] || 0) + 1; });

        let uniqueHighStrength = -1;
        let nextLeader = null;
        roundTurns.forEach(t => {
            if (strengthCounts[t.card.value] === 1 && t.card.value > uniqueHighStrength) {
                uniqueHighStrength = t.card.value;
                nextLeader = t.player;
            }
        });

        if (nextLeader) {
            game.gambit.leader = nextLeader;
            await channel.send({ content: `**${nextLeader.user.username}** will be the leader for the next round.` });
        } else {
            await channel.send({ content: `**${game.gambit.leader.user.username}** remains the leader.` });
        }

        // 2. Check for gambit end condition
        let gambitOver = false;
        if (roundNumber >= 3) {
            const flightStrengths = game.players.map(p => p.flight.reduce((sum, c) => sum + c.value, 0));
            if (game.gambit.weakestWins) {
                const minStrength = Math.min(...flightStrengths);
                const weakestPlayers = game.players.filter((p, i) => flightStrengths[i] === minStrength);
                if (weakestPlayers.length === 1) gambitOver = true;
            } else {
                const maxStrength = Math.max(...flightStrengths);
                const strongestPlayers = game.players.filter((p, i) => flightStrengths[i] === maxStrength);
                if (strongestPlayers.length === 1) gambitOver = true;
            }
        }

        if (game.gambit.stakes <= 0 && roundNumber > 0) {
            gambitOver = true;
            await channel.send({ content: "The stakes are empty! The gambit ends." });
        }

        if (gambitOver) {
            endGambit(game, channel);
        } else {
            startRound(game, channel);
        }
    };

    const endGambit = async (game, channel) => {
        game.state = 'scoring';
        await channel.send({ content: `--- **Gambit ${game.gambit.number} Over** ---` });

        // 1. Determine winner
        let winner = null;
        const flightStrengths = game.players.map(p => p.flight.reduce((sum, card) => sum + card.value, 0));

        if (game.gambit.weakestWins) {
            await channel.send({ content: "The Druid was played, so the weakest flight wins!" });
            const minStrength = Math.min(...flightStrengths);
            const weakestPlayers = game.players.filter((p, i) => flightStrengths[i] === minStrength);
            if (weakestPlayers.length === 1) {
                winner = weakestPlayers[0];
            }
        } else {
            const maxStrength = Math.max(...flightStrengths);
            const strongestPlayers = game.players.filter((p, i) => flightStrengths[i] === maxStrength);
            if (strongestPlayers.length === 1) {
                winner = strongestPlayers[0];
            }
        }

        // 2. Award stakes
        if (winner) {
            await channel.send({ content: `**${winner.user.username}** has the strongest flight and wins the stakes of ${game.gambit.stakes} GP!` });
            winner.hoard += game.gambit.stakes;
            game.gambit.stakes = 0;
        } else {
            await channel.send({ content: "There was no winner. The stakes are lost." });
        }

        // TODO: Step 5/7 - Check for special flights (color/strength) during the round, not just at the end.

        // 4. Clear flights and ante cards
        game.players.forEach(p => {
            game.discardPile.push(...p.flight);
            p.flight = [];
        });
        game.discardPile.push(...game.gambit.antePile);
        game.gambit.antePile = [];
        game.gambit.antedByPlayer = [];

        // 5. Check for game end condition
        const playersWithGold = game.players.filter(p => p.hoard > 0);
        if (playersWithGold.length < game.players.length) {
            await channel.send({ content: "A player has run out of gold! The game is over!" });

            let finalWinner = null;
            let maxHoard = -1;
            game.players.forEach(p => {
                if (p.hoard > maxHoard) {
                    maxHoard = p.hoard;
                    finalWinner = p;
                }
            });

            if (finalWinner) {
                await channel.send({ content: `The winner is **${finalWinner.user.username}** with ${finalWinner.hoard} GP! Congratulations!` });
            } else {
                 await channel.send({ content: `The game ended in a draw!` });
            }
            activeGames.delete(game.channelId);
            return; // End the game
        }

        // 7. If game continues, deal cards and start next gambit
        await channel.send({ content: "All players draw two cards." });
        for (const p of game.players) {
            await drawCards(game, p, 2, channel);
        }

        await channel.send({ content: "Preparing the next gambit..." });
        setTimeout(() => {
            startGambit(game, channel);
        }, 5000);
    };

    const generateGameStateEmbed = (game) => {
        const embed = new EmbedBuilder()
            .setTitle(`Gambit ${game.gambit.number} - Round ${game.gambit.rounds.length}`)
            .setColor(0x3498db)
            .setDescription(`The current stakes are **${game.gambit.stakes} GP**.`);

        game.players.forEach(p => {
            const flightStrength = p.flight.reduce((sum, card) => sum + card.value, 0);
            const flightText = p.flight.map(c => c.name).join(', ') || 'No cards yet.';
            embed.addFields({
                name: `${p.user.username}'s Flight (Strength: ${flightStrength}) | Hoard: ${p.hoard} GP`,
                value: flightText,
            });
        });
        return embed;
    };

    const drawCards = async (game, player, amount, channel) => {
        let drawnCards = [];
        for (let i = 0; i < amount; i++) {
            if (player.hand.length >= 10) {
                try { await player.user.createDM().send("Your hand is full (10 cards). You cannot draw any more cards."); } catch (e) {}
                break;
            }

            if (game.deck.length === 0) {
                if (game.discardPile.length === 0) {
                    await channel.send({ content: "The deck and discard pile are empty! No more cards can be drawn." });
                    break;
                }
                game.deck = [...game.discardPile];
                game.discardPile = [];
                for (let k = game.deck.length - 1; k > 0; k--) {
                    const l = Math.floor(Math.random() * (k + 1));
                    [game.deck[k], game.deck[l]] = [game.deck[l], game.deck[k]];
                }
                await channel.send({ content: "The discard pile has been shuffled to form a new deck." });
            }

            const card = game.deck.pop();
            player.hand.push(card);
            drawnCards.push(card);
        }
        if (drawnCards.length > 0) {
           try { await player.user.createDM().send({ content: `You drew: ${drawnCards.map(c => `**${c.name}**`).join(', ')}.` }); } catch(e) {}
        }
        return drawnCards.length;
    };

    const checkSpecialFlights = async (game, player, channel) => {
        // Strength Flight
        const strengthCounts = {};
        player.flight.forEach(c => { strengthCounts[c.value] = (strengthCounts[c.value] || 0) + 1; });

        for (const strengthStr in strengthCounts) {
            const strength = parseInt(strengthStr);
            if (strengthCounts[strength] >= 3 && !player.triggeredStrengthFlights.includes(strength)) {
                player.triggeredStrengthFlights.push(strength);
                const goldAmount = strength * (game.initialAnte / 50);
                const finalAmount = Math.min(game.gambit.stakes, goldAmount);
                if (finalAmount > 0) {
                    game.gambit.stakes -= finalAmount;
                    player.hoard += finalAmount;
                    await channel.send({ content: `**${player.user.username}** completed a Strength Flight of ${strength}s! They steal ${finalAmount} GP from the stakes.` });
                }

                const cardsTaken = [];
                while (game.gambit.antePile.length > 0 && player.hand.length < 10) {
                    cardsTaken.push(game.gambit.antePile.pop());
                }
                if (cardsTaken.length > 0) {
                    player.hand.push(...cardsTaken);
                    await channel.send({ content: `They also take ${cardsTaken.length} card(s) from the ante pile.` });
                    try { await player.user.createDM().send({ content: `From your Strength Flight, you took the following from the ante: ${cardsTaken.map(c => c.name).join(', ')}`}); } catch(e){}
                }
            }
        }

        // Color Flight
        const colorCounts = {};
        player.flight.forEach(c => {
            const colors = c.effect === 'Tiamat' ? ['Black', 'Blue', 'Green', 'Red', 'White'] : [c.effect];
            colors.forEach(color => {
                const effect = CARD_EFFECTS.find(e => e.name === color);
                if (effect && (effect.alignment === 'good' || effect.alignment === 'evil')) {
                    colorCounts[color] = (colorCounts[color] || 0) + 1;
                }
            });
        });

        for (const color in colorCounts) {
            if (colorCounts[color] >= 3 && !player.triggeredColorFlights.includes(color)) {
                player.triggeredColorFlights.push(color);
                const dragonsOfColor = player.flight.filter(c => c.effect === color || (c.effect === 'Tiamat' && ['Black', 'Blue', 'Green', 'Red', 'White'].includes(color)));
                dragonsOfColor.sort((a, b) => a.value - b.value);
                const secondStrongest = dragonsOfColor[dragonsOfColor.length - 2];

                if (secondStrongest) {
                    const goldAmount = secondStrongest.value * (game.initialAnte / 50);
                    if (goldAmount > 0) {
                        await channel.send({ content: `**${player.user.username}** completed a Color Flight of ${color}s! Each opponent pays them ${goldAmount} GP.` });
                        for (const opponent of game.players) {
                            if (opponent.id === player.id) continue;
                            const payment = Math.min(opponent.hoard, goldAmount);
                            if (payment > 0) {
                                opponent.hoard -= payment;
                                player.hoard += payment;
                            }
                        }
                    }
                }
            }
        }
    };

    const resolveCardPower = async (game, player, card, channel, forceTrigger = false) => {
        const round = game.gambit.rounds[game.gambit.rounds.length - 1];
        const turnIndex = round.turns.length - 1;
        let trigger = false;

        if (forceTrigger || player.id === game.gambit.leader.id || (turnIndex > 0 && card.value <= round.turns[turnIndex - 1].card.value)) {
            trigger = true;
        }

        if (!trigger) {
            await channel.send({ content: `The power of **${card.name}** does not trigger.` });
            return;
        }

        await channel.send({ content: `The power of **${card.name}** triggers!` });
        const effect = CARD_EFFECTS.find(e => e.name === card.effect);
        if (!effect) return;

        switch (effect.name) {
            case 'Copper': {
                const copperIndex = player.flight.findIndex(c => c === card);
                if (copperIndex > -1) player.flight.splice(copperIndex, 1);

                const turnRecord = round.turns.find(t => t.card === card);
                game.discardPile.push(card);

                if (game.deck.length === 0) {
                    if (game.discardPile.length === 0) {
                        await channel.send({ content: "The deck is empty, so the Copper Dragon has no card to draw."});
                        break;
                    }
                    game.deck = [...game.discardPile];
                    game.discardPile = [];
                    for (let k = game.deck.length - 1; k > 0; k--) {
                        const l = Math.floor(Math.random() * (k + 1));
                        [game.deck[k], game.deck[l]] = [game.deck[l], game.deck[k]];
                    }
                    await channel.send({ content: "The discard pile has been shuffled to form a new deck." });
                }
                const newCard = game.deck.pop();
                player.flight.push(newCard);
                if (turnRecord) turnRecord.card = newCard;

                await channel.send({ content: `The Copper Dragon is replaced by a **${newCard.name}**!` });
                await resolveCardPower(game, player, newCard, channel, true); // Force the new card's power to trigger
                break;
            }
            case 'Bronze': {
                if (game.gambit.antePile.length === 0) {
                    await channel.send({ content: "There are no ante cards to take." });
                    break;
                }
                const sortedAntes = [...game.gambit.antePile].sort((a, b) => a.value - b.value);
                const cardsToTake = [];
                for (let i = 0; i < 2; i++) {
                    if (sortedAntes.length > 0) {
                        const weakestAnteCard = sortedAntes.shift();
                        const originalIndex = game.gambit.antePile.findIndex(c => c === weakestAnteCard);
                        if (originalIndex > -1) {
                            const [takenCard] = game.gambit.antePile.splice(originalIndex, 1);
                            cardsToTake.push(takenCard);
                        }
                    }
                }
                if (cardsToTake.length > 0) {
                    let takenNames = [];
                    for (const c of cardsToTake) {
                        if (player.hand.length < 10) {
                            player.hand.push(c);
                            takenNames.push(c.name);
                        } else {
                            game.discardPile.push(c);
                            try { await player.user.createDM().send(`Your hand was full, so the **${c.name}** from the ante was discarded.`); } catch(e){}
                        }
                    }
                    if (takenNames.length > 0) {
                        await channel.send({ content: `**${player.user.username}** takes the weakest ante card(s): **${takenNames.join(', ')}**.` });
                        try { await player.user.createDM().send(`You took the **${takenNames.join(', ')}** from the ante.`); } catch(e){}
                    }
                }
                break;
            }
            case 'Black': { // "Steal 3 gold from the stakes"
                const baseAmount = 3;
                const scaledAmount = baseAmount * (game.initialAnte / 50);
                const finalAmount = Math.min(game.gambit.stakes, scaledAmount);
                game.gambit.stakes -= finalAmount;
                player.hoard += finalAmount;
                await channel.send({ content: `**${player.user.username}** steals ${finalAmount} GP from the stakes!` });
                break;
            }
            case 'White': { // "The weakest opponent pays you 2 gold"
                let weakestOpponents = [];
                let lowestStrength = Infinity;

                // Find the lowest flight strength among opponents
                game.players.forEach(p => {
                    if (p.id === player.id) return;
                    const pStrength = p.flight.reduce((sum, c) => sum + c.value, 0);
                    if (pStrength < lowestStrength) {
                        lowestStrength = pStrength;
                        weakestOpponents = [p];
                    } else if (pStrength === lowestStrength) {
                        weakestOpponents.push(p);
                    }
                });

                if (weakestOpponents.length > 0) {
                    const baseAmount = 2;
                    const scaledAmount = baseAmount * (game.initialAnte / 50);
                    let totalPaid = 0;
                    for (const weakPlayer of weakestOpponents) {
                        const payment = Math.min(weakPlayer.hoard, scaledAmount);
                        weakPlayer.hoard -= payment;
                        player.hoard += payment;
                        totalPaid += payment;
                        await channel.send({ content: `**${weakPlayer.user.username}** is a weakest opponent and pays ${payment} GP to **${player.user.username}**.` });
                    }
                } else {
                    await channel.send({ content: "There are no opponents to target." });
                }
                break;
            }
            case 'Gold': { // "Draw a card for each good dragon in your flight"
                const goodDragonsInFlight = player.flight.filter(c => {
                    const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                    return cEffect && cEffect.alignment === 'good';
                }).length;

                if (goodDragonsInFlight > 0) {
                    await channel.send({ content: `**${player.user.username}** will draw ${goodDragonsInFlight} card(s) for the good dragons in their flight.` });
                    await drawCards(game, player, goodDragonsInFlight, channel);
                }
                break;
            }
            case 'Silver': { // "Each player with at least one good dragon in their flight draws a card."
                const playersToDraw = game.players.filter(p => {
                    return p.flight.some(c => {
                        const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                        return cEffect && cEffect.alignment === 'good';
                    });
                });

                if (playersToDraw.length > 0) {
                    await channel.send({ content: `${playersToDraw.map(p => `**${p.user.username}**`).join(', ')} will draw a card for having good dragons in their flight.` });
                    for (const p of playersToDraw) {
                        await drawCards(game, p, 1, channel);
                    }
                }
                break;
            }
            case 'Druid': {
                game.gambit.weakestWins = true;
                await channel.send({ content: `**The Druid** has been played! The player with the WEAKEST flight will win this gambit.` });
                break;
            }
            case 'Blue': {
                const dmChannel = await player.user.createDM();
                const goldAmount = 1 * (game.initialAnte / 50);
                const flightSize = player.flight.length;
                const stakesAmount = flightSize * (game.initialAnte / 50);

                const takeGoldButton = new ButtonBuilder().setCustomId('tda_blue_take').setLabel(`Take ${goldAmount} GP from each opponent`).setStyle(ButtonStyle.Primary);
                const addToStakesButton = new ButtonBuilder().setCustomId('tda_blue_stakes').setLabel(`Opponents add ${stakesAmount} GP to stakes`).setStyle(ButtonStyle.Secondary);
                const choiceRow = new ActionRowBuilder().addComponents(takeGoldButton, addToStakesButton);

                const choiceMsg = await dmChannel.send({ content: `Your Blue Dragon's power triggers. Choose an effect:`, components: [choiceRow] });
                const choiceCollector = choiceMsg.createMessageComponentCollector({ filter: i => i.user.id === player.id, time: 120000, max: 1 });

                const handleChoice = async (choice) => {
                    if (choice === 'take') {
                        let totalTaken = 0;
                        for (const opponent of game.players) {
                            if (opponent.id === player.id) continue;
                            const payment = Math.min(opponent.hoard, goldAmount);
                            opponent.hoard -= payment;
                            player.hoard += payment;
                            totalTaken += payment;
                        }
                        await channel.send({ content: `**${player.user.username}** uses the Blue Dragon to take a total of ${totalTaken} GP from all opponents.` });
                    } else { // stakes
                        let totalAdded = 0;
                        for (const opponent of game.players) {
                            if (opponent.id === player.id) continue;
                            const payment = Math.min(opponent.hoard, stakesAmount);
                            opponent.hoard -= payment;
                            game.gambit.stakes += payment;
                            totalAdded += payment;
                        }
                        await channel.send({ content: `**${player.user.username}** uses the Blue Dragon to force opponents to add a total of ${totalAdded} GP to the stakes.` });
                    }
                };

                choiceCollector.on('collect', async i => {
                    if (i.customId === 'tda_blue_take') {
                        await i.update({ content: "You chose to take gold from each opponent.", components: [] });
                        await handleChoice('take');
                    } else {
                        await i.update({ content: "You chose to have opponents add to the stakes.", components: [] });
                        await handleChoice('stakes');
                    }
                });

                choiceCollector.on('end', async (collected, reason) => {
                    if (reason === 'time') {
                        await dmChannel.send({ content: "You ran out of time. Defaulting to taking gold from opponents." });
                        await handleChoice('take');
                    }
                });
                break;
            }
            case 'Sorcerer': {
                const sorcererIndex = player.flight.findIndex(c => c === card);
                if (sorcererIndex > -1) player.flight.splice(sorcererIndex, 1);
                const turnRecord = round.turns.find(t => t.card === card);
                game.discardPile.push(card);

                const revealedCards = [];
                for (let i = 0; i < 3; i++) {
                    if (game.deck.length === 0) {
                        if (game.discardPile.length === 0) break;
                        game.deck = [...game.discardPile];
                        game.discardPile = [];
                        for (let k = game.deck.length - 1; k > 0; k--) {
                            const l = Math.floor(Math.random() * (k + 1));
                            [game.deck[k], game.deck[l]] = [game.deck[l], game.deck[k]];
                        }
                    }
                    if (game.deck.length > 0) revealedCards.push(game.deck.pop());
                }

                if (revealedCards.length === 0) {
                    await channel.send({ content: "Not enough cards to reveal for the Sorcerer's power." });
                    break;
                }

                const dmChannel = await player.user.createDM();
                if (revealedCards.length === 1) {
                    const chosenCard = revealedCards[0];
                    player.flight.push(chosenCard);
                    if (turnRecord) turnRecord.card = chosenCard;
                    await channel.send({ content: `The Sorcerer reveals one card: **${chosenCard.name}**, which replaces it.` });
                    await resolveCardPower(game, player, chosenCard, channel, true);
                    break;
                }

                const rows = [new ActionRowBuilder()];
                revealedCards.forEach((c, index) => {
                    rows[0].addComponents(new ButtonBuilder().setCustomId(`tda_sorc_choice_${index}`).setLabel(c.name).setStyle(ButtonStyle.Secondary));
                });

                const choiceMsg = await dmChannel.send({ content: "Your Sorcerer reveals three cards. Choose one to replace it. The other two will be added to the ante.", components: rows });
                const choiceCollector = choiceMsg.createMessageComponentCollector({ filter: i => i.user.id === player.id, time: 120000, max: 1 });

                const handleSorcererChoice = async (choiceIndex) => {
                    const chosenCard = revealedCards[choiceIndex];
                    player.flight.push(chosenCard);
                    if (turnRecord) turnRecord.card = chosenCard;
                    const others = revealedCards.filter((c, i) => i !== choiceIndex);
                    game.gambit.antePile.push(...others);
                    await channel.send({ content: `The Sorcerer is replaced by a **${chosenCard.name}**! The other revealed cards (${others.map(c=>c.name).join(', ')}) are added to the ante.` });
                    await resolveCardPower(game, player, chosenCard, channel, true);
                };

                choiceCollector.on('collect', async i => {
                    const choiceIndex = parseInt(i.customId.split('_')[3]);
                    await i.update({ content: `You chose the **${revealedCards[choiceIndex].name}**.`, components: [] });
                    await handleSorcererChoice(choiceIndex);
                });

                choiceCollector.on('end', async (collected, reason) => {
                    if (reason === 'time') {
                        await dmChannel.send({ content: `You ran out of time. The **${revealedCards[0].name}** was chosen for you.` });
                        await handleSorcererChoice(0);
                    }
                });
                break;
            }
            // Other card effects will be added here in subsequent steps.
            case 'Red': { // "The strongest opponent pays you 1 gold. Take a random card from that player's hand"
                let strongestOpponents = [];
                let highestStrength = -1;

                game.players.forEach(p => {
                    if (p.id === player.id) return;
                    const pStrength = p.flight.reduce((sum, c) => sum + c.value, 0);
                    if (pStrength > highestStrength) {
                        highestStrength = pStrength;
                        strongestOpponents = [p];
                    } else if (pStrength === highestStrength) {
                        strongestOpponents.push(p);
                    }
                });

                const target = strongestOpponents.length > 0 ? strongestOpponents[Math.floor(Math.random() * strongestOpponents.length)] : null;

                if (target) {
                    const goldAmount = 1 * (game.initialAnte / 50);
                    const goldPayment = Math.min(target.hoard, goldAmount);
                    target.hoard -= goldPayment;
                    player.hoard += goldPayment;
                    await channel.send({ content: `**${target.user.username}** is a strongest opponent and pays ${goldPayment} GP to **${player.user.username}**.` });

                    if (target.hand.length > 0) {
                        const randomIndex = Math.floor(Math.random() * target.hand.length);
                        const stolenCard = target.hand.splice(randomIndex, 1)[0];
                        player.hand.push(stolenCard);
                        await channel.send({ content: `**${player.user.username}** also steals a random card from their hand!` });
                        try {
                            await player.user.createDM().send({ content: `You stole the **${stolenCard.name}**.` });
                            await target.user.createDM().send({ content: `The **${stolenCard.name}** was stolen from your hand!` });
                        } catch (e) { console.error("Failed to send steal notification DM", e); }
                    }
                } else {
                    await channel.send({ content: "There are no opponents to target." });
                }
                break;
            }
            case 'Green': { // "The player who plays next chooses to either give you a weaker evil dragon or to pay you 5 gold"
                const currentPlayerIndex = game.players.findIndex(p => p.id === player.id);
                const nextPlayer = game.players[(currentPlayerIndex + 1) % game.players.length];

                await channel.send({ content: `**${player.user.username}**'s Green Dragon targets **${nextPlayer.user.username}**! They must now make a choice in their DMs.` });

                const weakerEvilDragons = nextPlayer.hand.filter(c => {
                    const cEffect = CARD_EFFECTS.find(e => e.name === c.effect);
                    return cEffect && cEffect.alignment === 'evil' && c.value < card.value;
                });

                const dmChannel = await nextPlayer.user.createDM();
                const goldAmount = 5 * (game.initialAnte / 50);

                if (weakerEvilDragons.length === 0) {
                    const payment = Math.min(nextPlayer.hoard, goldAmount);
                    nextPlayer.hoard -= payment;
                    player.hoard += payment;
                    await dmChannel.send({ content: `You have no weaker evil dragons to give away. You automatically pay ${payment} GP.` });
                    await channel.send({ content: `**${nextPlayer.user.username}** had no weaker evil dragons and was forced to pay **${player.user.username}** ${payment} GP.` });
                    break;
                }

                const giveCardButton = new ButtonBuilder().setCustomId('tda_green_give').setLabel('Give a Card').setStyle(ButtonStyle.Secondary);
                const payGoldButton = new ButtonBuilder().setCustomId('tda_green_pay').setLabel(`Pay ${goldAmount} GP`).setStyle(ButtonStyle.Primary);
                const choiceRow = new ActionRowBuilder().addComponents(giveCardButton, payGoldButton);

                const choiceMsg = await dmChannel.send({ content: `The Green Dragon's power forces you to choose: give a weaker evil dragon to **${player.user.username}**, or pay them ${goldAmount} GP.`, components: [choiceRow] });
                const choiceCollector = choiceMsg.createMessageComponentCollector({ filter: i => i.user.id === nextPlayer.id, time: 120000, max: 1 });

                choiceCollector.on('collect', async i => {
                    if (i.customId === 'tda_green_pay') {
                        const payment = Math.min(nextPlayer.hoard, goldAmount);
                        nextPlayer.hoard -= payment;
                        player.hoard += payment;
                        await i.update({ content: `You chose to pay ${payment} GP.`, components: [] });
                        await channel.send({ content: `**${nextPlayer.user.username}** chose to pay ${payment} GP.` });
                    } else { // Chose to give a card
                        if (weakerEvilDragons.length === 1) {
                            const cardToGive = weakerEvilDragons[0];
                            const cardIndexInHand = nextPlayer.hand.findIndex(c => c === cardToGive);
                            if (cardIndexInHand > -1) nextPlayer.hand.splice(cardIndexInHand, 1);
                            player.hand.push(cardToGive);
                            await i.update({ content: `You gave the **${cardToGive.name}**.`, components: [] });
                            await channel.send({ content: `**${nextPlayer.user.username}** gave the **${cardToGive.name}** to **${player.user.username}**.` });
                        } else {
                            await i.update({ content: `You chose to give a card. Now, please select which card to give.`, components: [] });

                            const cardChoiceRows = [];
                            let currentRow = new ActionRowBuilder();
                            weakerEvilDragons.forEach((c, index) => {
                                if (currentRow.components.length >= 5) { cardChoiceRows.push(currentRow); currentRow = new ActionRowBuilder(); }
                                currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_green_give_${index}`).setLabel(c.name).setStyle(ButtonStyle.Danger));
                            });
                            if (currentRow.components.length > 0) { cardChoiceRows.push(currentRow); }

                            const cardChoiceMsg = await dmChannel.send({ content: "Select the card you wish to give:", components: cardChoiceRows });
                            const cardChoiceCollector = cardChoiceMsg.createMessageComponentCollector({ filter: i2 => i2.user.id === nextPlayer.id, time: 120000, max: 1 });

                            const handleCardGive = async (cardToGive) => {
                                const cardIndexInHand = nextPlayer.hand.findIndex(c => c === cardToGive);
                                if (cardIndexInHand > -1) nextPlayer.hand.splice(cardIndexInHand, 1);
                                player.hand.push(cardToGive);
                                await channel.send({ content: `**${nextPlayer.user.username}** gave the **${cardToGive.name}** to **${player.user.username}**.` });
                            };

                            cardChoiceCollector.on('collect', async i2 => {
                                const cardIndex = parseInt(i2.customId.split('_')[3]);
                                const cardToGive = weakerEvilDragons[cardIndex];
                                await i2.update({ content: `You gave the **${cardToGive.name}**.`, components: [] });
                                await handleCardGive(cardToGive);
                            });

                            cardChoiceCollector.on('end', async (collected, reason) => {
                                if (reason === 'time') {
                                    const cardToGive = weakerEvilDragons[0];
                                    await dmChannel.send({ content: `You ran out of time. The **${cardToGive.name}** was given automatically.` });
                                    await handleCardGive(cardToGive);
                                }
                            });
                        }
                    }
                });

                choiceCollector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        const payment = Math.min(nextPlayer.hoard, goldAmount);
                        nextPlayer.hoard -= payment;
                        player.hoard += payment;
                        dmChannel.send({ content: `You ran out of time and automatically paid ${payment} GP.` });
                        channel.send({ content: `**${nextPlayer.user.username}** ran out of time and paid ${payment} GP.` });
                    }
                });
                break;
            }
        }
    };

    const getPlayerMove = (game, player) => {
        return new Promise(async (resolve) => {
            try {
                const dmChannel = await player.user.createDM();

                const embed = generateGameStateEmbed(game);
                await dmChannel.send({ embeds: [embed] });

                const rows = [];
                let currentRow = new ActionRowBuilder();
                player.hand.forEach((card, index) => {
                    if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                    currentRow.addComponents(new ButtonBuilder().setCustomId(`tda_play_${index}`).setLabel(card.name).setStyle(ButtonStyle.Primary));
                });
                if (currentRow.components.length > 0) { rows.push(currentRow); }

                const moveMessage = await dmChannel.send({ content: 'It is your turn. Choose a card to play. You have 3 minutes.', components: rows });
                const collector = moveMessage.createMessageComponentCollector({ filter: i => i.user.id === player.id, time: 180000, max: 1 });

                collector.on('collect', async i => {
                    const cardIndex = parseInt(i.customId.split('_')[2]);
                    const card = player.hand[cardIndex];
                    player.hand.splice(cardIndex, 1);
                    await i.update({ content: `You played the **${card.name}**.`, components: [] });
                    resolve(card);
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        const card = player.hand[0];
                        player.hand.splice(0, 1);
                        dmChannel.send({ content: `You ran out of time! The **${card.name}** was played for you.` });
                        resolve(card);
                    }
                });
            } catch (e) {
                console.error(`Failed to get move from ${player.user.username}`, e);
                resolve(null);
            }
        });
    };

    client.on('messageCreate', async message => {
        if (message.author.bot || !client.user) return;

        const prefix = '!';
        const mentionRegex = new RegExp(`^<@!?${client.user.id}>\\s+`);
        if (!mentionRegex.test(message.content)) return;

        const contentWithoutMention = message.content.replace(mentionRegex, '');
        if (!contentWithoutMention.startsWith(prefix)) return;

        const args = contentWithoutMention.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === '3da' || command === 'tda') {
            if (activeGames.has(message.channel.id)) {
                return message.channel.send({ content: 'A game is already in progress in this channel.' });
            }

            const game = { hostId: message.author.id, channelId: message.channel.id, players: [], state: 'lobby' };
            activeGames.set(message.channel.id, game);

            const lobbyMessage = await message.channel.send({ embeds: [generateLobbyEmbed(game)], components: buildLobbyComponents(game) });
            game.lobbyMessageId = lobbyMessage.id;

            const collector = lobbyMessage.createMessageComponentCollector({ time: 3_600_000 });

            collector.on('collect', async i => {
                const game = activeGames.get(i.channelId);
                if (!game) return i.reply({ content: 'This game lobby is no longer active.', ephemeral: true });

                const isPlayerInGame = game.players.some(p => p.id === i.user.id);

                if (i.customId === 'tda_join') {
                    if (isPlayerInGame) return i.reply({ content: 'You are already in the game.', ephemeral: true });
                    game.players.push({ id: i.user.id, user: i.user, specialAbility: null });
                } else if (i.customId === 'tda_leave') {
                    if (!isPlayerInGame) return i.reply({ content: 'You are not in this game.', ephemeral: true });
                    game.players = game.players.filter(p => p.id !== i.user.id);
                } else if (i.customId === 'tda_ability_select') {
                    if (!isPlayerInGame) return i.reply({ content: 'You must join the game before selecting an ability.', ephemeral: true });
                    const player = game.players.find(p => p.id === i.user.id);
                    player.specialAbility = i.values[0];
                } else if (i.customId === 'tda_start') {
                    if (!isPlayerInGame) return i.reply({ content: 'You must be in the game to start it.', ephemeral: true });
                    if (game.players.length < 2) return i.reply({ content: 'You need at least 2 players to start.', ephemeral: true });

                    collector.stop('game_started');
                    game.state = 'starting';
                    await i.update({ embeds: [generateLobbyEmbed(game)], components: buildLobbyComponents(game, true) });

                    // --- Begin Game Start Flow ---
                    startGame(game, message.channel);
                    return; // Return to prevent trying to update the interaction again
                }

                await i.update({ embeds: [generateLobbyEmbed(game)], components: buildLobbyComponents(game) });
            });

            collector.on('end', (collected, reason) => {
                if (reason !== 'game_started') {
                    activeGames.delete(message.channel.id);
                    lobbyMessage.edit({ content: 'This game lobby has expired.', embeds: [], components: [] }).catch(() => {});
                }
            });
        }
    });
}

module.exports = {
    DECK_DEFINITION,
    CARD_EFFECTS,
    initializeThreeDragonAnte,
};

// --- Bot Initialization ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ]
});

const token = process.env.DISCORD_TOKEN;

if (token) {
    client.once('ready', () => {
        console.log(`Bot is ready! Logged in as ${client.user.tag}`);
        initializeThreeDragonAnte(client);
    });

    client.login(token).catch(err => {
        console.error("Failed to login:", err);
    });
} else {
    console.error("Error: DISCORD_TOKEN environment variable not set. Bot cannot start.");
}
