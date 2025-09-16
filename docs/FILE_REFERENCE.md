# Top-Level File Reference

This document provides a reference for each of the top-level files in the TavernTones repository. It describes the purpose of each file and how it connects to other parts of the application.

---

### Core Application Files

These are the primary files that make up the TavernTones application.

#### `main.js`
-   **Purpose**: This is the main process and the heart of the entire application, serving as the entry point for Electron. Its primary responsibilities include creating and managing the application windows (`BrowserWindow`), initializing the `discord.js` client, and logging into Discord. It creates instances of all core backend modules (`FiveEToolsParser`, `BackendAudioPlayer`, `InitiativeTracker`, `CommandHandler`) and orchestrates the entire application by listening for and routing both Electron IPC events from the UI and `discord.js` client events from the bot.
-   **Dependencies**: It `require`s and utilizes almost every other major backend module in the application.
-   **Used By**: This file is the entry point specified in `package.json` and is executed when the application starts (e.g., via `npm start`). It is not used by any other module.

#### `renderer.js`
-   **Purpose**: The main script for the frontend user interface, running inside the `Index.html` window. It is responsible for all DOM manipulation, rendering the initiative list and combatant details, handling all user interactions within the window (button clicks, form submissions), and sending messages to the backend (`main.js`) via the secure IPC channels exposed in `preload.js`.
-   **Dependencies**: `preload.js` (to access backend IPC channels).
-   **Used By**: `Index.html`.

#### `preload.js`
-   **Purpose**: Acts as the secure bridge between the frontend (`renderer.js`) and the backend (`main.js`). It uses Electron's `contextBridge` to selectively expose a limited, secure set of `ipcRenderer` functions to the frontend. **Any new communication channel between the UI and the backend must be explicitly defined in this file.**
-   **Dependencies**: `electron`.
-   **Used By**: `main.js` (when creating the `BrowserWindow`).

#### `Index.html`
-   **Purpose**: The main and only HTML file for the application's primary user interface. It defines the three-column layout and contains all the container elements for the initiative tracker, combatant details, logs, music player, and soundboard.
-   **Dependencies**: `styles.css`, `renderer.js`.
-   **Used By**: `main.js` (loaded into the main `BrowserWindow`).

#### `styles.css`
-   **Purpose**: The main stylesheet for the application. It contains all CSS rules that define the layout, appearance, and styling for `Index.html` and `json-gamify.html`.
-   **Used By**: `Index.html`, `json-gamify.html`.

---

### Backend Modules

These modules encapsulate the core logic for the application's features. They are typically instantiated in `main.js`.

#### `CommandHandler.js`
-   **Purpose**: The central command processor for the Discord bot. Its `handleMessage` method is triggered for any message mentioning the bot, routing commands like `!5e`, `!create en`, `!ro`, `!pl`, etc., to the appropriate logic.
-   **Dependencies**: `5eParser.js`, `EncounterBuilder.js`, `ThreeDragonAnte.js`, `BackendAudioPlayer.js`.
-   **Used By**: `main.js`.

#### `InitiativeTracker.js`
-   **Purpose**: A class that manages the entire state and logic of a combat encounter. It handles the list of combatants, turn order, HP and condition tracking, and dice rolling. It also manages saving and loading the encounter state to and from files.
-   **Dependencies**: `@dice-roller/rpg-dice-roller`.
-   **Used By**: `main.js`.

#### `5eParser.js`
-   **Purpose**: A class that serves as the data access layer for the `5etools` dataset. It handles loading, caching, and searching the JSON data files in `reference/5etoolsdata/`.
-   **Used By**: `main.js`, `CommandHandler.js`, `EncounterBuilder.js`.

#### `5eEmbedFormatter.js`
-   **Purpose**: A helper module that transforms raw `5etools` JSON data objects into nicely formatted `EmbedBuilder` objects for display in Discord.
-   **Used By**: `main.js`.

#### `BackendAudioPlayer.js`
-   **Purpose**: A class that manages all audio playback in Discord voice channels. It handles the `@discordjs/voice` player, file caching, and playback state (playing, paused, looping).
-   **Used By**: `main.js`.

#### `EncounterBuilder.js`
-   **Purpose**: A class containing the logic to procedurally generate D&D encounters based on parameters like party size, level, and a chosen creature/type.
-   **Dependencies**: `5eParser.js`.
-   **Used By**: `CommandHandler.js`.

#### `ThreeDragonAnte.js`
-   **Purpose**: A large, self-contained class that manages the state, logic, and player interaction for the Three-Dragon Ante card game.
-   **Used By**: `CommandHandler.js`.

#### `MagicItemGenerator.js`
-   **Purpose**: A class that procedurally generates magic items based on a weighted system.
-   **Dependencies**: `MagicItemData.js`.
-   **Used By**: `CommandHandler.js`.

#### `MagicItemData.js`
-   **Purpose**: Contains the raw data tables, probabilities, and configuration used by the `MagicItemGenerator.js`.
-   **Used By**: `MagicItemGenerator.js`.

---

### Data & Reference Directories

These directories contain the JSON data that powers many of the bot's features.

#### `reference/5etoolsdata/`
-   **Purpose**: This directory contains a vast collection of JSON files sourced from the `5etools` project. It includes data for nearly every aspect of D&D 5e, such as spells, items, monsters, feats, and backgrounds.
-   **Used By**: `5eParser.js` is the primary module that reads from this directory.

#### `randomtables/`
-   **Purpose**: This directory contains custom JSON files that are used as weighted tables for various random generation features.
-   **Subdirectories**:
    -   **`/origin`**: Contains generic character origin data (traits, ideals, bonds, flaws) extracted from `backgrounds.json`. This is used as a fallback by the `!generate-character` command.
    -   Other subdirectories contain data for the `!ro` command and `MagicItemGenerator`.
-   **Used By**: `CommandHandler.js` (for the `!ro` command), `MagicItemGenerator.js`, and `5eParser.js` (for the character generator).

---

### Standalone Tools & Other Files

#### JSON Gamify Tool
-   **`json-gamify.html`**: The HTML structure for the standalone JSON Gamify Tool.
-   **`json-gamify.js`**: The frontend logic for the Gamify Tool, handling its UI and IPC communication.
-   **`json-gamify.css`**: The stylesheet for the Gamify Tool.
-   **Used By**: Loaded into a separate `BrowserWindow` by `main.js`.

#### Debugging & Configuration
-   **`package.json`**: The standard Node.js project file. Defines project metadata, dependencies (`discord.js`, `electron`, etc.), and scripts (`start`).
-   **`deprep.js`**: A simple script used for debugging. It generates and prints a dependency report for the `@discordjs/voice` library to help diagnose audio-related issues.

#### Documentation
-   **`DEVELOPMENT.md`**: The main development guide. Provides a high-level technical overview of the application's architecture, features, and known issues.
-   **`GAMIFY_TOOL_README.md`**: A supplementary README file providing specific instructions on how to create new tasks for the JSON Gamify Tool.
-   **`TDA_STATUS.md`**: A status document outlining the current state, known bugs, and unimplemented features for the Three-Dragon Ante module.
