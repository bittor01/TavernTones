
Three-Dragon Ante: The Definitive Gameplay Walkthrough This document outlines the definitive, step-by-step user experience for playing Three-Dragon Ante on Discord. It incorporates the scalable buy-in, the persistent "Game Board" UI, and all other advanced features we have discussed.

Phase 0: Lobby & The Scalable Buy-In Game Creation:

In a public channel, a player types !3da. The bot creates the standard public lobby embed with Join, Leave, Start Game, etc. Setting the Buy-In:

When the creator clicks Start Game, the bot displays an ephemeral modal only to them. Modal Title: Set Game Stakes Text Input Field: Game Buy-in (in Gold Pieces) Placeholder Text: e.g., 50 for a standard game, 5000 for a high-stakes game The creator enters 5149 and clicks Submit. Calculation and Confirmation:

Bot Backend: The bot receives the value 5149. It rounds the value down to the nearest 50, resulting in a final buy-in of 5100gp. It calculates the scaling factor: x = 5100 / 50 = 102. This x value will be applied to all gold transactions. Bot Response (Ephemeral Message to Creator): "✅ Buy-in accepted. The total buy-in is 5100gp. All in-game gold values will be scaled by a factor of x102." Bot Response (Public Lobby): The lobby embed updates to "Game starting... Check your DMs!" Phase 1: The "Game Board" is Dealt (DMs) The bot now sends a series of messages to each player's DMs. These messages contain the embeds that form their personal, persistent "Game Board". These embeds will be edited throughout the game, not replaced.

The Log Embed: Title: Game Log Content: [Turn 0] Game Started. Initial buy-in: 5100gp (x102 scale). [Turn 0] The drafting phase has begun. Waiting for Player A to act. ``` * Buttons: << Top, < Prev, `Next >`, `Bottom >>` (The `Prev` and `Top` buttons are initially disabled).

The Opponent Embeds:

(A separate embed is created for each opponent. This example is for Player B's view of Player C). Title: Player C Fields: Hoard: 5100gp Hand: 🃏🃏🃏🃏🃏🃏⬛⬛⬛⬛ (6) Flight: (empty) The Ante Area Embed:

Title: Ante Area Content: The drafting phase is active. Anteing will begin shortly. The Player's Flight Embed:

Title: Your Flight Content: (Your flight is currently empty) The Player's Hand & Action Embed:

Title: Your Hand | Hoard: 5100gp Content: A list of the player's 6 cards, with both text and images. Footer: Turn: Pre-game Draft | Waiting for Player A... Phase 2: The Interactive Draft The bot now updates the Action Embed for the first player (Player A).

Player A's Turn to Draft:

Player A receives a "ghost ping". Their Action Embed updates: Title: Your Turn to Draft a Card to Remove Content: Displays Page 1 of the 20 optional cards (e.g., cards 1-5). Buttons (Row 1): << Prev Page, Next Page >> Buttons (Row 2): Remove: The Archmage, Remove: Bahamut, etc. for the cards on the current page. Footer: Turn Timer: 60s (This timer visually updates every 5 seconds). Browsing and Drafting:

Player A can click Next Page >> to view the other optional cards. The embed content updates to show the next page. Meanwhile, Players B and C can also use the Prev/Next buttons on their (inactive) embeds to browse the cards. The Remove buttons on their embeds are disabled. Player A clicks Remove: The Dracolich. Draft Resolution:

The Remove: The Dracolich button is removed from all players' embeds. The card is grayed out in the list. The Log Embed updates for everyone: ... [Turn 0] Player A removed The Dracolich. [Turn 0] Waiting for Player B to act. ``` * Player B receives a ghost ping, and their Action Embed becomes active. This process repeats until 10 cards are removed.

Phase 3: The Live Ante Phase Choose Ante Card:

The Action Embed for all players updates. Title: Choose Your Ante Card Content: "Select a card from your hand to ante. The highest strength determines the stakes for the gambit." Buttons show the player's hand. Each button clearly states the scaled stake value and card name. Red Dragon (Str 8) - Stakes: 816gp The Thief (Str 7) - Stakes: 714gp Gold Dragon (Str 2) - Stakes: 204gp Live Ante Updates:

Player A selects the Red Dragon (Str 8). Instantly, the Ante Area Embed updates for everyone: Title: Ante Area Content: An image of a card back appears under "Player A". A placeholder appears for other players. Player A: [Card Back.jpg] Player B: (Waiting...) Player C: (Waiting...) ``` * The Log Embed updates: [Gambit 1] Player A has anted.

Ante Reveal: Once Players B and C have also anted (and their card backs have appeared), the final reveal happens. The Ante Area Embed updates again, flipping all the cards: Player A: Red Dragon (Str 8) Player B: Silver Dragon (Str 8) Player C: The Fool (Str 3) * The Log Embed updates with the full result: ... [Gambit 1] All players have anted. Cards are revealed! [Gambit 1] Highest strength is 8. All players pay 816gp to the stakes. [Gambit 1] Player C anted the strongest unique card and is the leader for Round 1. ``` * All Player Embeds are updated to show their new, lower hoard values.

Phase 4: The Live Gambit Player's Turn:

Player C (the leader) gets a ghost ping. Their Action Embed updates with buttons of their hand to play a card. The footer shows the turn timer. Playing a Card:

Player C plays Green Dragon (Str 6). Instantly, for all players: The card appears in Player C's Opponent Embed under the "Flight" field. The Log Embed updates: [G1, R1] Player C (Leader) played Green Dragon (Str 6). Its power triggers... The log then details the resolution of the power. All relevant hoard/stake values are updated across the board. Next Turn:

The next player gets a ghost ping. Their Action Embed becomes active. The process repeats. The game board feels like a live, shared space. Phase 5: End of Gambit & Ready Check Results Screen:

After the gambit ends (typically after 3 rounds), the bot sends a new, temporary embed to all players asking if they want to play another or leave. if all players remaining only become ready because a player left, be sure to give them like 15 seconds after you update their ui for them to decide to leave too. Title: Gambit 1 Results Content: A summary showing who won the gambit, the total stakes they collected, and the new hoard standings for all players. Buttons: Ready for Next Gambit, Leave Table Starting the Next Gambit:

As players click the Ready button, it becomes disabled for them. Once all players are ready (or a 90-second timer expires), the temporary Results Screen embed is deleted. The main Game Board embeds are reset for the new gambit: Flights are cleared, the Ante Area is reset. Each player's Hand & Action Embed is updated to show their two newly drawn cards. The game then proceeds to the next ante phase. Phase 6: Game End Triggering the End:

The game ends when a player's hoard is 0 at the end of a gambit. Final Announcement:

The bot posts a final update to the Log Embed in the DMs. The bot edits the original public lobby message in the channel to show the final results and declare the winner. The DM session is then considered "archived" and the game is over. This detailed flow creates a rich, interactive, and user-friendly experience that captures the complexity and fun of Three-Dragon Ante within the constraints of Discord.