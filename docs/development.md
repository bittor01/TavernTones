# TavernTones Development Guide

<<<<<<< HEAD
This document provides a high-level overview of the TavernTones application and its new documentation structure. For detailed information on specific parts of the application, please refer to the other documents in this folder.

- **[Project TODO List](./todo.md)**: A consolidated list of all known bugs, planned features, and active development tasks.

- **[Backend Core Documentation](./backend_core.md)**: An overview of the application's architecture, key core files, and the IPC communication system.

- **[Backend Features Documentation](./backend_features.md)**: Detailed descriptions of the major backend features and modules, such as the Encounter Builder, Magic Item Generator, and LLM integration.

- **[UI Documentation](./ui.md)**: Documentation for the Electron-based user interface, including the Initiative Tracker and Soundboard.

- **[Discord Bot Documentation](./discord.md)**: Documentation for the Discord bot features, including command handlers and data search functionality.

- **[JSON Gamify Tool Documentation](./jsontool.md)**: Instructions on how to use and configure the JSON Gamify Tool.

- **[File Reference](./file_reference.md)**: A reference guide to the purpose of important files and directories in the project (will be updated at the end of this reorganization).
=======
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
    - **Soundboard (UI Only) (Needs Repair)**:
        - A 3x3 grid of buttons in the UI.
        - Each slot can be loaded with a sound effect.
        - Supports playing, stopping, and looping individual sounds.

- **Key Files**:
    - **`BackendAudioPlayer.js`**: A dedicated class that manages the `@discordjs/voice` player, file caching, and playback state (playing, paused, looping).
    - **`CommandHandler.js`**: Handles the `!pl` and `!pa` chat commands to control the music player.
    - **`renderer.js`**: Renders the music player controls and the soundboard grid. It sends IPC messages to control the audio.
    - **`main.js`**: Instantiates `BackendAudioPlayer` and sets up the IPC channels for UI control.

### Three-Dragon Ante (Card Game) - *Needs Repair*

This is a complex implementation of the Three-Dragon Ante card game. It is **partially functional but currently unplayable** due to critical bugs.

- **Current State**:
    - The lobby system (`!3da`), player joining/leaving, and the pre-game card drafting phase are functional.
    - The game breaks down during the first "ante" phase. The cause is unclear, partly because card images are not displaying in Discord embeds, making the game state very difficult to parse.
    - It requires a dedicated work session to debug and fix. A good first step would be to fix the card image display issue.

- **Original Implemented Features (For reference during debugging)**:
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

- **Known Issues & Missing Features**:
    - **Bugs**:
        1.  **Image Display Failure**: Card images do not appear in embeds.
        2.  **Gold Scaling Not Working**: Gold values from card effects do not scale with the initial ante as intended.
        3.  **Ante Phase Failure**: The game stalls or enters a confusing state during the first ante.
    - **Not Yet Implemented**:
        - **Remaining Card Powers**: The powers for Legendary Dragons (`Black Raider`, `Blue Overlord`, etc.) and some other mortals/special dragons (`The Princess`, `The Kobold`, etc.) are not yet implemented.
        - **D&D Special Abilities**: The mechanical effects of the special abilities (Bluff, Concentration, etc.) are not hooked into the game logic.

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

### Gamified JSON-Parsing Tool

This is a standalone tool designed to make the repetitive work of editing and tagging large sets of JSON files faster and more engaging.

- **Functionality**:
    -   Launches in a separate window from the main application.
    -   Loads a "task file" that defines a queue of JSON files to process.
    -   Displays one JSON object at a time with a custom UI for editing.
    -   Features gamification elements like a score, session high score, and a progress bar.
    -   Includes "Next" and "Undo" buttons for quick navigation and correction.
    -   Saves progress automatically, allowing the user to stop and resume tasks.
    -   The initial implemented task allows for tagging `itemtypes` for all spells in the `randomtables/spells/lvl*.json` files.

- **Key Files**:
    -   **`json-gamify.html`**, **`json-gamify.js`**, **`json-gamify.css`**: The frontend UI and logic for the tool.
    -   **`main.js`**: Contains the backend IPC handlers for file I/O and data processing for the tool.
    -   **`spell-item-types-task.json`**: The default task file for the spell tagging task.
    -   For instructions on creating new tasks, see the **[Gamify Tool README](GAMIFY_TOOL_README.md)**.

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

-   **`resources/5etoolsdata`**: This directory contains a vast collection of JSON files sourced from the `5etools` project. It includes data for nearly every aspect of D&D 5e, such as spells, items, monsters, feats, and backgrounds. This data is primarily accessed and searched by the `5eParser.js` module.

-   **`randomtables`**: This directory contains custom JSON files that are used as weighted tables for random generation.
    -   Files in the root of this directory (e.g., `surge.json`, `shield.json`) are used for simple, one-off rolls.
    -   Subdirectories (e.g., `/spells`, `/items`) contain collections of tables that can be rolled on using the generic `!ro` command. The JSON files in the `/spells` subdirectory are also used by the Magic Item Generator.

## Known Bugs

1.  **Encounter Builder (`!create en`)**: When building an encounter with a high-CR creature (e.g., CR 21 Lich), the XP calculation is incorrect. The final encounter has a total XP value that is far too low.
2.  **Soundboard (UI)**: The soundboard UI is blank and does not display the control buttons. It is completely non-functional.
3.  **Three-Dragon Ante**: See the "Known Issues" listed in the TDA feature description above.

## To-Do List

This is a list of potential future features, fixes, and improvements.

### High Priority Fixes
1.  **Fix Soundboard**: The soundboard is currently non-functional. It needs to be re-wired to use the `BackendAudioPlayer` and the UI needs to be fixed to display the buttons correctly.
2.  **Fix Gamify Tool Launch**: Implement the separate command-line launch for the Gamify Tool (e.g., `npm run json`).
3.  **Fix Gamify Tool Data Lookup**: Debug and resolve the issue where the tool fails to fetch spell details from the 5eTools data on launch.
4.  **Fix Initiative Tracker UI**: The "Attack" button in the combatant details panel should have its color changed to match the stat/save roll buttons below it, not the header buttons next to it.
5.  **Investigate Encounter Builder Bug**: Debug the `!create en` command to understand why the XP calculation fails for high-CR creatures.

### New Features & Major Improvements
4.  **Advanced Loot Generator**:
    -   **Goal**: Create a new, more powerful loot generator.
    -   **Concept**: This generator would use the existing `!ma` probability engine as a base, but instead of just generating spell-based items, it would also query the `5etools` item database to include standard and unique magic items in the results, creating more diverse and interesting loot hoards.
5.  **LLM Agent (`!ask` command)**:
    -   **Goal**: Evolve the LLM integration into a "Master Control Program" that can use the bot's other features as tools.
    -   **Concept**: A user could make a natural language request like `!ask generate a moderate encounter for 4 level 5 players in a swamp`. The LLM would parse this, identify the correct tool (`EncounterBuilder`), determine the parameters (`partyLevel: 5`, `partySize: 4`, `difficulty: moderate`, `creatureType: ?`), and execute the command. This is a major architectural feature.
6.  **Generic Fallback Data System**:
    -   **Goal**: Generalize the fallback system created for background characteristics.
    -   **Concept**: The `!generate-character` command required a system to pull from a generic pool of traits, ideals, etc., when a chosen background didn't have its own. This involved creating a script to extract this data from `backgrounds.json` into separate files. This concept could be expanded. A generic "data extractor" script and a corresponding "fallback loader" could be created to handle similar situations for other data types (e.g., providing generic actions for monsters that lack them).

### Quality of Life Improvements
7.  **Refactor `!ro` Command**: Improve the user experience of the `!ro` command by replacing the clunky text-based input with an interactive Discord Modal.
8.  **Investigate New Generators from 5eTools Data**: Explore the `5etoolsdata` directory, specifically files like `loot.json` and `life.json`, to find opportunities for new generators or bot features.
9.  **Remember Window Positions**: Save the position and size of the main and secondary windows on close and restore them on the next launch.

---
## Active Development Plan

This section outlines the plan for the features currently under active development.

### Part 1: Cleanup
1.  Delete the obsolete `hp.html` and `hp.js` files.
2.  Update `FILE_REFERENCE.md` to remove the "HP Tracker (Legacy)" section.

### Part 2: Vehicle Encounter Generator (`!vehicle-encounter`)
1.  **Data Analysis**: Analyze `resources/5etoolsdata/vehicles.json` to map vehicle tags to the requested environment categories (`Land`, `Air`, `Naval`, `Space`, `Underground`).
2.  **Command & UI**: Implement a new `!vehicle-encounter` command in `CommandHandler.js` that triggers a message with dropdowns for `Environment` and `Encounter Style` (`Flagship`/`Balanced`).
3.  **Modal Input**: Upon proceeding, display a modal to collect `Total HP` and (for "Balanced" style) `Number of Vehicles` from the user.
4.  **Backend Logic (`Flagship`)**: Implement the logic to find the largest single vehicle that fits the HP budget, then use the remaining HP to add smaller escort vehicles.
5.  **Backend Logic (`Balanced`)**: Implement the logic to calculate the target HP per vehicle, then find several vehicle options within a +/- 15% range of that target.
6.  **Output Formatting**: Create a new helper function to format the generated vehicle encounter into a summary embed and a detailed thread, similar to the existing encounter generator.

### Part 3: Trap & Hazard Generator (`!generate-trap`)
1.  **Command & UI**: Implement a new `!generate-trap` command in `CommandHandler.js` that prompts the user with optional dropdowns for `Party Tier`, `Threat Level`, `Trap Type`, and a text input for `Environment`.
2.  **Backend Logic**: Implement the filtering logic based on user selections. If a filter is left blank, it will not be applied. The `Environment` filter will perform a case-insensitive text search on the trap's description.
3.  **Random Selection**: After filtering, randomly select one trap from the remaining pool.
4.  **Output Formatting**: Create a function to format the selected trap's details into a comprehensive embed, showing its trigger, effects, and countermeasures.
>>>>>>> master
