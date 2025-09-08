# Three-Dragon Ante Bot - Feature Status

This document outlines the current implementation status of the Three-Dragon Ante game feature.

## Implemented Features

The core game loop is functional. You can start a game, play through multiple gambits, and a winner will be declared at the end.

- **Lobby System:**
  - Game creation via `@botname !3da` or `!tda`.
  - Interactive lobby embed with Join/Leave buttons.
  - Dropdown menu for selecting optional D&D Special Abilities (Note: The mechanical effects of these abilities are not yet implemented).
- **Pre-Game Phase:**
  - Game starts via a modal pop-up to set the initial ante.
  - A full card drafting phase where players take turns removing 10 of the 20 optional cards.
- **Core Gameplay:**
  - Full gambit and round structure is implemented.
  - Ante phase (choosing a card, paying stakes) is functional.
  - Turn-based play is functional.
  - Game state is displayed to players in their DMs.
  - Game correctly determines the winner of a gambit and the end of the game.
- **Card Powers:**
  - A significant number of standard card powers are implemented, including complex ones with player choices (e.g., Blue Dragon, Green Dragon, Sorcerer, Copper Dragon, The Druid).
  - The logic for Special Flights (Color and Strength) is implemented.

## Known Bugs & Issues

1.  **Image Display Failure:** Card images are not appearing for players. This seems to be an environment-specific issue with how the bot is resolving file paths. The command to start the game may still crash because of this.
2.  **Gold Scaling Not Working:** The user reported that gold values from card effects are not scaling with the initial ante as intended. This is a critical bug in the game's economy.

## Not Yet Implemented

- **Remaining Card Powers:** The powers for the following optional/expansion cards have not been implemented yet:
    - **Legendary Dragons:** `Black Raider`, `Blue Overlord`, `Brass Sultan`, `Bronze Warlord`, `Copper Trickster`, `Gold Monarch`, `Green Schemer`, `Red Destroyer`, `Silver Seer`, `White Hunter`.
    - **Other Mortals/Special Dragons:** `The Princess`, `The Kobold`, `The Wyrmpriest`, `Dracolich`, `Bahamut`, and the two Wyrmlings.
- **D&D Special Abilities:** While selectable in the UI, the mechanical effects of the 8 special abilities (Bluff, Concentration, etc.) are not yet hooked into the game logic. This is the largest missing feature.
- **Minor Rule Simplifications:**
    - Special Flights are checked at the end of a player's turn, not the exact moment the third card is played.
    - The `startRound` function is recursive, which could be an issue in extremely long gambits.

## Next Steps

1.  Awaiting user feedback to diagnose the **Gold Scaling** and **Image Path** bugs.
2.  Once bugs are fixed, proceed with implementing the remaining card powers.
3.  Implement the mechanical effects of the D&D Special Abilities.
