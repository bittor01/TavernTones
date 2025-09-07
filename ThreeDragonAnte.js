
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


client.once('ready', async () => {
    //Define a nice clean shutdown function
    const shutdown = async () => {
        try {
            console.log('Cleaning up and exiting.');
            // Remove all event listeners
            client.removeAllListeners();
    
            // Logout
            await client.destroy();
        }
        catch (error) {
            console.log('Error during shutdown:', error);
        }
    };

    process.stdin.setRawMode(true); // Enable raw mode to capture single keypress
    process.stdin.resume(); // Start reading from stdin
    process.stdin.on('data', (key) => {
        if (key.toString() === 'q') { // Check if the pressed key is "q"
            shutdown();
        }
    });

    const activeRooms = {}; // Map of room codes to room data
    const playerRoomMap = {}; // Map of player IDs to room codes

    client.on('messageCreate', async (message) => {
        // Ignore messages from the bot itself
        if (message.author.bot) return;

        const userId = message.author.id;

        // Check if the player is in a room
        if (!playerRoomMap[userId]) {
            return message.reply("You are not in a game room. Please join or create a room to play.");
        }

        const roomCode = playerRoomMap[userId];
        const room = activeRooms[roomCode];
        if (!room) {
            return message.reply("Your game room is no longer active. Please start a new game.");
        }

        const player = room.players.find(p => p.id === userId);
        if (!player) {
            return message.reply("You are not part of this game.");
        }

        // Check if it's the player's turn
        if (room.activePlayer !== userId) {
            const activePlayer = room.players.find(p => p.id === room.activePlayer);
            return message.reply(`It's not your turn. It's ${activePlayer.alias}'s turn.`);
        }

        // Parse the move
        const move = message.content.trim();
        const cardAlias = move.match(/\b[0-9]\b/); // Match card aliases (1-9, 0)
        const targetAlias = move.match(/\b[A-F]\b/); // Match target aliases (A-F)

        if (!cardAlias) {
            return message.reply("Invalid move. Please specify a card to play (1-9, 0).");
        }

        const cardIndex = parseInt(cardAlias[0], 10) - 1; // Convert card alias to array index
        if (cardIndex < 0 || cardIndex >= player.hand.length) {
            return message.reply("Invalid card selection. Please choose a card from your hand.");
        }

        const card = player.hand[cardIndex];
        if (card.requiresTarget && !targetAlias) {
            return message.reply("This card requires a target. Please specify a target (A-F).");
        }

        if (card.requiresTarget && targetAlias) {
            const targetPlayer = room.players.find(p => p.alias === targetAlias[0]);
            if (!targetPlayer) {
                return message.reply("Invalid target. Please specify a valid player (A-F).");
            }
            card.target = targetPlayer.id; // Attach target ID to the card
        }

        // Execute the turn
        executeTurn(room, player, card);
    });

    // Execute turn logic
    function executeTurn(room, player, card) {
        // Remove the card from the player's hand
        player.hand = player.hand.filter(c => c !== card);

        // Apply card effects
        applyCardEffects(room, player, card);

        // Advance turn
        room.activePlayer = getNextPlayer(room);

        // Update all players
        updatePlayers(room);
    }

    // Example card effects handler
    function applyCardEffects(room, player, card) {
        // Implement card-specific effects here
        console.log(`${player.alias} played ${card.name}`);
    }

    // Get the next player's ID
    function getNextPlayer(room) {
        const currentIndex = room.players.findIndex(p => p.id === room.activePlayer);
        return room.players[(currentIndex + 1) % room.players.length].id;
    }

    // Update players with the current game state
    function updatePlayers(room) {
        room.players.forEach(player => {
            const gameState = `Players:\n` +
                room.players.map(p => `${p.alias}: ${p.points} points, ${p.hand.length} cards`).join('\n');
            const handImages = player.hand.map((card, index) => `${DEFAULT_LOCAL_FOLDER}/${card.image}`);
            player.user.send({
                content: `${gameState}\nYour hand:`,
                files: handImages,
            });
        });
    }
});

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


class Game {
  constructor(playerCount = 0) {
      this.deck = [...DECK_DEFINITION]; // Create a copy of the card definitions
      this.discardPile = [];
      this.ante = [];
      this.players = Array.from({ length: playerCount }, () => ({ hand: [] })); // Each player starts with an empty hand
      this.deckReshuffled = false; // Flag to alert players of reshuffle
      this.shuffleDeck();
  }

  shuffleDeck() {
      for (let i = this.deck.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
      this.deckReshuffled = true;
  }

  drawCard() {
      if (this.deck.length === 0) {
          this.reshuffleDiscardIntoDeck();
          if (this.deck.length === 0) {
              throw new Error("No cards left in the deck or discard pile.");
          }
      }
      return this.deck.pop(); // Remove the top card
  }

  discardCard(card) {
      this.discardPile.push(card);
  }

  reshuffleDiscardIntoDeck() {
      if (this.discardPile.length > 0) {
          this.deck = [...this.discardPile];
          this.discardPile = [];
          this.shuffleDeck();
      }
  }

  addToAnte(card) {
      this.ante.push(card);
  }

  bronze(playerIndex) {
      for (let i = 0; i < 2; i++) {
        if (this.ante.length === 0) {
            throw new Error("No cards in the ante to return.");
        }
        // Find the weakest card in the ante
        const weakestCardIndex = this.ante.reduce((weakestIdx, card, idx) => 
            card.value < this.ante[weakestIdx].value ? idx : weakestIdx, 
            0
        );
        const [weakestCard] = this.ante.splice(weakestCardIndex, 1); // Remove the weakest card from the ante
        this.players[playerIndex].hand.push(weakestCard); // Add it to the player's hand
      }
  }

  getPlayerHand(playerIndex) {
      return this.players[playerIndex].hand;
  }

  dealInitialHands(cardsPerPlayer) {
      for (let i = 0; i < cardsPerPlayer; i++) {
          for (let player of this.players) {
              player.hand.push(this.drawCard());
          }
      }
  }
}


function drawCardForPlayer(player, room) {
  try {
      const card = room.deck.drawCard();
      player.hand.push(card);
      return card;
  } catch (error) {
      console.error(error.message);
      return null; // Handle empty deck gracefully
  }
}

function discardCardFromPlayer(player, room, card) {
  const cardIndex = player.hand.indexOf(card);
  if (cardIndex > -1) {
      player.hand.splice(cardIndex, 1); // Remove card from hand
      room.discardPile.push(card);
  } else {
      console.error("Card not found in player's hand.");
  }
}

function createRoom(roomCode) {
  activeRooms[roomCode] = {
      players: [], // List of players
      deck: new Deck(), // New shuffled deck
      discardPile: [], // Separate discard pile
      activePlayer: null, // The current player's ID
  };
}

function addPlayerToRoom(roomCode, user) {
  if (!activeRooms[roomCode]) {
      throw new Error(`Room ${roomCode} does not exist.`);
  }

  const room = activeRooms[roomCode];
  const playerAlias = String.fromCharCode(65 + room.players.length); // Assign alias (A-F)
  room.players.push({
      id: user.id,
      alias: playerAlias,
      user: user,
      hand: [], // Player's hand
      points: 0, // Initial points or gold
  });

  // Draw an initial hand
  for (let i = 0; i < 5; i++) {
      drawCardForPlayer(room.players[room.players.length - 1], room);
  }
}
    
