# TavernTones Development Guide

This document provides a technical overview of the TavernTones application, its features, and its architecture. It is intended for developers working on the project.

## Project Overview

TavernTones is a hybrid application combining an Electron-based desktop UI with a Discord.js bot. Its primary purpose is to serve as a comprehensive tool for Dungeon Masters (DMs) running remote Dungeons & Dragons sessions on Discord.

The application provides:
- A rich user interface for **Initiative Tracking** and combat management.
- A **Soundboard** for playing sound effects.
- A **Discord bot** that offers a wide array of commands for players and DMs, including music playback, game playing, content generation, and data lookups.

## Architecture

The application is built on two main pillars: an **Electron App** for the DM-facing user interface and a **Discord.js Bot** for interacting with players in a Discord server.

- **Electron App**: This provides the main window that the DM interacts with. It's responsible for the initiative tracker, soundboard, and logging UI. It runs a Node.js backend (`main.js`) and a Chromium-based frontend (`renderer.js`).
- **Discord.js Bot**: This runs within the Electron main process and connects to the Discord API. It listens for chat commands and interactions (buttons, modals, etc.) to trigger its various features.

These two pillars communicate via Electron's Inter-Process Communication (IPC) mechanism.

### Key Files

- **`main.js`**: The heart of the application. It serves as the Electron main process. Its responsibilities include:
    - Creating and managing the Electron `BrowserWindow`.
    - Initializing the Discord.js client and logging into Discord.
    - Setting up all `ipcMain` listeners to handle requests from the UI (renderer process).
    - Initializing and holding instances of all major backend modules (`CommandHandler`, `InitiativeTracker`, `BackendAudioPlayer`, etc.).
    - Handling all Discord events (`messageCreate`, `interactionCreate`).

- **`renderer.js`**: The brain of the user interface. This script runs in the Electron window (the "renderer process") and is responsible for:
    - Building and dynamically updating the DOM (the HTML).
    - Handling all user interactions within the window (button clicks, form submissions).
    - Sending messages to the main process via IPC to trigger backend logic (e.g., "next turn", "add creature").
    - Listening for messages from the main process via IPC to update the UI with new state (e.g., an updated initiative order).

- **`preload.js`**: The secure bridge between the backend and frontend. It uses Electron's `contextBridge` to expose a specific, limited set of `ipcRenderer` functions to `renderer.js`. **Any new communication channel between the UI and the backend must be explicitly defined in this file.**

- **`CommandHandler.js`**: The primary command processor for the Discord bot. It parses messages that mention the bot and routes commands (`!ping`, `!5e`, `!play`, etc.) to the correct logic and modules.

### IPC Communication

Communication between the backend (`main.js`) and the frontend (`renderer.js`) is critical. Because they run in separate processes, they cannot directly call each other's functions. Instead, they use IPC.

- **Frontend to Backend (`renderer.js` -> `main.js`):**
    - **`ipcRenderer.send(channel, data)`**: Used for "fire-and-forget" messages where the frontend doesn't need a direct response. Example: `window.electron.ipcRenderer.send('next-turn');`
    - **`ipcRenderer.invoke(channel, data)`**: Used when the frontend needs to trigger a function in the backend and wait for a result. Example: `window.electron.ipcRenderer.invoke('search-monsters', query);`

- **Backend to Frontend (`main.js` -> `renderer.js`):**
    - **`mainWindow.webContents.send(channel, data)`**: Used by the backend to push updates to the frontend. Example: `mainWindow.webContents.send('update-initiative-list', ...);`

As mentioned, all channels used for this communication must be whitelisted in `preload.js` for security.

## Implemented Features

This section details the major features of the application.

### Initiative Tracker (UI)

This is the core feature of the Electron UI. It provides a comprehensive interface for managing combat encounters.

- **Functionality**:
    - Add/Edit/Remove combatants.
    - Automatically roll initiative and HP from dice notation (e.g., `+2`, `2d8+4`).
    - Track HP, temporary HP, AC, and conditions.
    - Manage turn order (`next-turn`, `previous-turn`).
    - Roll attacks, stat checks, and saving throws for any combatant.
    - Push the current initiative order to a Discord channel as an embed.
    - Save/Load the entire encounter state to/from a file.
    - Automatically saves the current encounter to `autosave.json` on any change and reloads it on startup.
    - Import monster stat blocks from the 5eTools data.

- **Key Files**:
    - **`InitiativeTracker.js`**: The backend class that manages all encounter state and logic. It's the "engine" of the tracker.
    - **`renderer.js`**: Handles all UI rendering and user input. It calls IPC channels to interact with `InitiativeTracker.js`.
    - **`main.js`**: Instantiates `InitiativeTracker` and wires up all the IPC listeners that connect it to `renderer.js`.
    - **`preload.js`**: Defines the list of allowed IPC channels for the initiative tracker.

### Audio Player & Soundboard

The application includes a music player for ambient background music and a soundboard for short sound effects.

- **Functionality**:
    - **Music Player**:
        - Plays music files (`.wav`) in a specified Discord voice channel.
        - Can resolve `.lnk` (Windows shortcut) files to their target.
        - Can search for music in subfolders of a main music directory.
        - Supports play, pause, and looping.
        - The bot can be controlled via chat commands (`!pl`, `!pa`) or the Electron UI.
    - **Soundboard (UI Only)**:
        - A 3x3 grid of buttons in the UI.
        - Each slot can be loaded with a sound effect.
        - Supports playing, stopping, and looping individual sounds.

- **Key Files**:
    - **`BackendAudioPlayer.js`**: A dedicated class that manages the `@discordjs/voice` player, file caching, and playback state (playing, paused, looping).
    - **`CommandHandler.js`**: Handles the `!pl` and `!pa` chat commands to control the music player.
    - **`renderer.js`**: Renders the music player controls and the soundboard grid. It sends IPC messages to control the audio.
    - **`main.js`**: Instantiates `BackendAudioPlayer` and sets up the IPC channels for UI control.

### Three-Dragon Ante (Card Game)

This is a complex, fully-featured implementation of the Three-Dragon Ante card game, played entirely through Discord chat commands and interactive components (buttons, modals, dropdowns).

- **Functionality**:
    - **Lobby System**: A player can start a game with `!3da` or `!tda`. Other players can join/leave via buttons. Players can optionally select a D&D special ability via a dropdown menu.
    - **Game Setup**: The game host uses a modal to set the initial ante (starting gold). The game then proceeds to a drafting phase where players take turns removing optional cards from the deck via their DMs.
    - **Core Gameplay**: The game correctly follows the gambit/round structure. Players ante cards, pay stakes, and play cards in turn. All player actions are handled in DMs to keep their hands private.
    - **Card Powers**: A significant number of card powers are implemented, including complex ones that require player choices.
    - **Special Flights**: The logic for triggering and rewarding Color and Strength flights is implemented.
    - **Game State**: The game state is displayed to players in their DMs, and public actions are announced in the channel. The game correctly identifies the winner of a gambit and the end of the game.

- **Key Files**:
    - **`ThreeDragonAnte.js`**: A large, self-contained manager class that handles all game state, logic, and player interaction.
    - **`CommandHandler.js`**: The entry point that receives the `!3da` command and delegates control to the `ThreeDragonAnteManager`.
    - **`main.js`**: Handles the `interactionCreate` events for buttons and modals submitted by players during the game.

- **Current Status & To-Do (from `TDA_STATUS.md`)**:
    - **Known Bugs**:
        1.  **Image Display Failure**: Card images sometimes fail to appear for players. This may be an environment-specific issue with file path resolution.
        2.  **Gold Scaling Not Working**: Gold values from card effects do not seem to be scaling with the initial ante as intended.
    - **Not Yet Implemented**:
        - **Remaining Card Powers**: The powers for Legendary Dragons (`Black Raider`, `Blue Overlord`, etc.) and some other mortals/special dragons (`The Princess`, `The Kobold`, etc.) are not yet implemented.
        - **D&D Special Abilities**: The mechanical effects of the special abilities (Bluff, Concentration, etc.) are not hooked into the game logic, even though they can be selected in the UI.
        - **Minor Rule Simplifications**: Special Flights are checked at the end of a turn, not at the exact moment the third card is played. The `startRound` function is recursive, which could be an issue in very long gambits.

### 5eTools Data Search (`!5e`, `!spell`, etc.)

This feature allows users to search the vast database of D&D 5e content from the `5etools` project.

- **Functionality**:
    - Provides a generic `!5e` command to search all categories by name.
    - Provides specific commands (`!spell`, `!item`, `!monster`, etc.) to search within a single category.
    - Provides a `!deep` command to search by content, not just by name.
    - Presents results in a dropdown menu. Selecting an option displays the full details of the selected item in an embed.

- **Key Files**:
    - **`5eParser.js`**: The core data access layer. It handles loading, caching, and searching the JSON data files.
    - **`CommandHandler.js`**: Defines the search commands and uses `5eParser.js` to get results. It also builds the interactive dropdown menu.
    - **`5eEmbedFormatter.js`**: A helper module to format the raw JSON data of an item into a user-friendly Discord embed.

### Encounter Builder (`!create en`)

This feature procedurally generates a themed D&D encounter based on user parameters.

- **Functionality**:
    - Can be initiated with a specific "main creature" (e.g., `!create en hobgoblin`) or a creature type (e.g., `!create en undead`).
    - Presents the user with interactive dropdowns and buttons to select the main creature and difficulty.
    - Uses a modal to get party level and size from the user.
    - Generates a list of thematically appropriate monsters to fill an XP budget.
    - Posts the results in a thread, with full stat blocks for each creature in the encounter.

- **Key Files**:
    - **`EncounterBuilder.js`**: Contains the core algorithm for encounter generation, including XP budget calculation, candidate scoring, and the unit pool system.
    - **`CommandHandler.js`**: Handles the `!create en` command, the initial search for the main creature/type, and the interactive UI flow.
    - **`5eParser.js`**: Used by the `EncounterBuilder` to get the list of all available monsters.

### Magic Item Generator (`!ma`)

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

### Random Table Roller (`!ro`, `!su`, `!sh`)

This feature provides a generic way to roll on custom random tables.

- **Functionality**:
    - `!su` (surge) and `!sh` (shield) are simple commands that roll on the `surge.json` and `shield.json` tables, respectively. They support unique, per-user results.
    - `!ro` is a powerful, generic command that can roll on any table from any subfolder within `randomtables`. It supports weighted tables and multiple rolls. For example: `!ro spells 3 8 lvl1 4 lvl2` will roll 3 times on a weighted table of spells from `lvl1.json` (weight 8) and `lvl2.json` (weight 4).

- **Key Files**:
    - **`CommandHandler.js`**: Implements the logic for all three commands, including parsing the complex arguments for the `!ro` command.
    - **`/randomtables` directory**: Contains all the JSON files that are used as random tables.

### LLM Integration (`!ll`, `!re`)

The bot can connect to a locally running Large Language Model (LLM) service to answer user prompts.

- **Functionality**:
    - The `!ll` (Llama) and `!re` (Reasoner) commands send a prompt to an LLM API endpoint (defaulting to `http://localhost:4891/v1/chat/completions`).
    - It can use two different models depending on the command.
    - The `!in` (inspect) command shows the source documents the LLM used for its last response (if the RAG is working).

- **Key Files**:
    - **`CommandHandler.js`**: Contains the `askGPT4All` function that uses `axios` to make the HTTP POST request to the LLM service. It also handles the command parsing.

## Data Sources

The application's data-driven features rely on two key directories:

-   **`reference/5etoolsdata`**: This directory contains a vast collection of JSON files sourced from the `5etools` project. It includes data for nearly every aspect of D&D 5e, such as spells, items, monsters, feats, and backgrounds. This data is primarily accessed and searched by the `5eParser.js` module.

-   **`randomtables`**: This directory contains custom JSON files that are used as weighted tables for random generation.
    -   Files in the root of this directory (e.g., `surge.json`, `shield.json`) are used for simple, one-off rolls.
    -   Subdirectories (e.g., `/spells`, `/items`) contain collections of tables that can be rolled on using the generic `!ro` command. The JSON files in the `/spells` subdirectory are also used by the Magic Item Generator.

## To-Do List

This is a list of potential future features and tasks.

1.  **Gamified JSON-Parsing Tool**:
    -   **Goal**: Create a tool to motivate the manual work of combing through JSON files and adding metadata (e.g., adding `itemtypes` to spells).
    -   **Concept**: An Electron window that presents the user with a specific task (e.g., "Go through `lvl1.json` and tag all spells compatible with Potions"). The user would perform the task, and the tool would track their progress, award points, and provide visual feedback (like filling a progress bar).
    -   **Technical Requirements**:
        -   Needs a way to pass data to the Electron window.
        -   Will require a "to-do list" JSON file to define the tasks.
        -   Will need a settings folder (e.g., in `/resources`) to store the configuration for each task and track progress.

2.  **Investigate New Generators from 5eTools Data**:
    -   **Goal**: Explore the `5etoolsdata` directory, specifically files like `loot.json` and `life.json`, to find opportunities for new generators or bot features.
    -   **Task**: Manually inspect these and other potentially useful JSON files to understand their structure and content. Reverse-engineer the data format to see if it can be used to build new features like a random loot generator or a character background generator.
