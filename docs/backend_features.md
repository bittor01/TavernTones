# Backend Features Documentation

This document describes the specific backend features of the TavernTones application.

---

## Magic Item Generator (`!ma`)

This is a data-driven, procedural generator for creating magic items.

- **Functionality**:
    - Triggered by the `!ma` command.
    - Presents an interactive UI with dropdowns and buttons to configure the generation (mode, size).
    - Uses a modal to get the number of items to generate and the party level.
    - Generation is a two-phase process: first it determines what *can* be generated ("hits"), then it generates the items from that pool.
    - Can generate items for "Loot" (no price) or for a "Shop" (with calculated prices).
    - Posts the results in a new thread, including a "Hit/Miss Grid" showing all possible items and the final list of generated items.

- **Key Files**:
    - **`MagicItemGenerator.js`**: Contains the core generation logic.
    - **`MagicItemData.js`**: Stores all the data used by the generator (probabilities, prices, etc.).
    - **`CommandHandler.js`**: Handles the `!ma` command and the interactive configuration UI.

---

## Random Table Roller (`!ro`, `!su`, `!sh`)

This feature provides a generic way to roll on custom random tables.

- **Functionality**:
    - `!su` (surge) and `!sh` (shield) are simple commands that roll on the `surge.json` and `shield.json` tables, respectively. They support unique, per-user results.
    - `!ro` is a powerful, generic command that can roll on any table from any subfolder within `randomtables`. It supports weighted tables and multiple rolls. For example: `!ro spells 3 8 lvl1 4 lvl2` will roll 3 times on a weighted table of spells from `lvl1.json` (weight 8) and `lvl2.json` (weight 4).

- **Key Files**:
    - **`CommandHandler.js`**: Implements the logic for all three commands, including parsing the complex arguments for the `!ro` command.
    - **`/randomtables` directory**: Contains all the JSON files that are used as random tables.

---

## LLM Integration (`!ll`, `!re`)

The bot can connect to a locally running Large Language Model (LLM) service to answer user prompts.

- **Functionality**:
    - The `!ll` (Llama) and `!re` (Reasoner) commands send a prompt to an LLM API endpoint (defaulting to `http://localhost:4891/v1/chat/completions`).
    - It can use two different models depending on the command.
    - The `!in` (inspect) command shows the source documents the LLM used for its last response (if the RAG is working).

- **Key Files**:
    - **`CommandHandler.js`**: Contains the `askGPT4All` function that uses `axios` to make the HTTP POST request to the LLM service. It also handles the command parsing.

---

## Three-Dragon Ante (Card Game)

This section outlines the implementation status of the Three-Dragon Ante game feature. For known issues and future plans, please see `todo.md`.

### Implemented Features

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

- **Key Files**:
    - **`ThreeDragonAnte.js`**: A large, self-contained manager class that handles all game state, logic, and player interaction.
    - **`CommandHandler.js`**: The entry point that receives the `!3da` command and delegates control to the `ThreeDragonAnteManager`.
    - **`main.js`**: Handles the `interactionCreate` events for buttons and modals submitted by players during the game.
