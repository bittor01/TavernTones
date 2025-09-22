This document outlines the definitive, step-by-step user experience for playing Three-Dragon Ante on Discord. It incorporates a persistent UI built entirely from Discord embeds, a scalable buy-in, and all other advanced features we have discussed. The core design philosophy is to keep the number of messages low by editing existing embeds rather than sending new ones, with the exception of temporary embeds for critical player interactions.

Phase 0: Lobby & The Scalable Buy-In Game Creation
In a public channel, a player types !3da. The bot creates the standard public lobby embed with Join, Leave, Start Game, etc.

Setting the Buy-In: When the creator clicks Start Game, the bot displays an ephemeral modal only to them. The modal is titled "Set Game Stakes" and has a text input field for the "Game Buy-in (in Gold Pieces)," with placeholder text like "e.g., 50 for a standard game, 5000 for a high-stakes game."

Calculation and Confirmation: The creator enters a value (e.g., 5149) and clicks Submit. The bot rounds the value down to the nearest 50 (e.g., 5100gp) and calculates a scaling factor (

x=5100/50=102
). This factor will be applied to all in-game gold transactions. The bot sends an ephemeral message to the creator confirming the buy-in and scale factor, and it updates the public lobby embed to "Game starting... Check your DMs!"

Phase 1: The "Game Board" is Dealt (DMs)
The bot sends a series of messages to each player's DMs. These messages contain the embeds that form their personal, persistent "Game Board." These embeds will be edited throughout the game, not replaced.

The Gameplay Log: This embed is at the top of the UI. It's updated with each action as it happens, creating a chronological log of the game.

The Ante Embed: Located below the log, this embed shows the ante cards for the current gambit and provides information on the total pot.

The Opponent Embeds: A separate embed is created for each opponent. This embed shows how many cards they have in their hand using emoji and text (e.g., ����⬛⬛⬛⬛⬛⬛(4/10)). It also displays the cards in their flight, including the text of each card. The text of any cards that did not trigger when played is shown with a strikethrough. A picture of the opponent's flight is shown at the bottom of the embed.

The Player Embed: This embed shows the player's own hand, hoard, and the text of their cards. It also displays any other relevant player state information.

Phase 2: The Interactive Draft
During the draft phase, the UI is modified to include additional information and interactive elements.

Draft Information Embed: An embed is displayed below the player's information with the rules text for ten of the draftable cards.

Navigation: Previous and Next buttons are attached to this embed, allowing players to browse through the cards. A picture of all the draft cards is at the bottom of the embed.

Active Player Interaction: A temporary embed is sent to the active player (the one whose turn it is or the one forced to make a choice). This embed contains the buttons for player choices. It pings the active player and is deleted once the action is resolved.

Phase 3: The Live Ante Phase
Choose Ante Card: The active player receives a temporary embed with buttons representing their hand. The embed is titled "Choose Your Ante Card" and prompts the player to select a card to ante. Each button clearly states the scaled stake value and card name (e.g., "Red Dragon (Str 8) - Stakes: 816gp").

Live Ante Updates: When a player selects a card, the Ante Embed instantly updates for everyone. A card back image appears under their name, and the log embed is updated to reflect that they have anted.

Ante Reveal: Once all players have anted, the Ante Embed updates again, revealing all the cards. The Gameplay Log is updated with the full results, and all player embeds are updated to show their new, lower hoard values.

Phase 4: The Live Gambit
Player's Turn: The leader of the gambit gets a temporary embed with buttons to play a card from their hand. This embed shows a turn timer in the footer.

Playing a Card: When a card is played, it instantly appears in the playing player's Opponent Embed under the "Flight" field. The Gameplay Log updates with details of the card played and the resolution of its power. All relevant hoard and stake values are updated across the board. The temporary action embed is then deleted, and a new one is sent to the next player.

Phase 5: End of Gambit & Ready Check
Results Screen: After a gambit ends, a new, temporary embed is sent to all players. It provides a summary of the gambit's results, showing who won, the total stakes collected, and the new hoard standings. It includes buttons like Ready for Next Gambit and Leave Table. If a player leaves and the remaining players are ready, a 15-second grace period is given for them to decide if they also want to leave.

Starting the Next Gambit: As players click Ready, the button is disabled for them. Once all players are ready, the temporary results screen is deleted. The main game board embeds are reset, and each player's Hand & Action Embed is updated to show their two newly drawn cards. The game proceeds to the next ante phase.

Phase 6: Game End
Triggering the End: The game ends when a player's hoard reaches 0 at the end of a gambit.

Final Announcement: The bot posts a final update to the Gameplay Log in the DMs and edits the original public lobby message in the channel to show the final results and declare the winner. The DM session is then considered "archived" and the game is over.

This detailed flow creates a rich, interactive, and user-friendly experience that captures the complexity and fun of Three-Dragon Ante within the constraints of Discord's embed-based UI.