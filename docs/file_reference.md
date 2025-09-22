# File Reference

This document provides a reference for the files and directories in the TavernTones repository. It describes the purpose of each major component and how it connects to other parts of the application.

---

## Project Structure

The repository is organized into the following main directories:

-   **`src/`**: Contains all the source code for the application. This is where all the application logic, UI code, and backend modules reside.
-   **`docs/`**: Contains all documentation files, including this one.
-   **`resources/`**: Contains static assets and data files, such as the `5etools` data.
-   **`randomtables/`**: Contains custom JSON files used for random generation features.
-   **Root Directory**: Contains configuration files (`package.json`, `.env`), HTML files for the UI (`Index.html`, `json-gamify.html`), and the main stylesheet (`styles.css`).

---

## `src/` - Source Code

This directory contains all the JavaScript source code for the application.

### `src/main.js`
-   **Purpose**: This is the main process and the heart of the entire application, serving as the entry point for Electron. Its primary responsibilities include creating and managing the application windows (`BrowserWindow`), initializing the `discord.js` client, and logging into Discord. It creates instances of all core backend modules and orchestrates the entire application.
-   **Dependencies**: It `require`s and utilizes almost every other major module in the application.

### `src/core/`
This directory contains the core application logic, data parsers, and generators that are not specific to Discord or the UI.

-   **`5eParser.js`**: A class that serves as the data access layer for the `5etools` dataset. It handles loading, caching, and searching the JSON data files in `resources/5etoolsdata/`.
-   **`5eEmbedFormatter.js`**: A helper module that transforms raw `5etools` JSON data objects into nicely formatted `EmbedBuilder` objects for display in Discord.
-   **`EncounterBuilder.js`**: A class containing the logic to procedurally generate D&D encounters.
-   **`VehicleEncounterBuilder.js`**: A class containing the logic to procedurally generate vehicle encounters.
-   **`InitiativeTracker.js`**: A class that manages the entire state and logic of a combat encounter.
-   **`MagicItemGenerator.js`**: A class that procedurally generates magic items.
-   **`MagicItemData.js`**: Contains the raw data tables and configuration used by the `MagicItemGenerator.js`.
-   **`NpcGenerator.js`**: A class for procedurally generating character ideas and NPC statblocks.

### `src/discord/`
This directory contains modules that are specifically related to the Discord bot's functionality.

-   **`CommandHandler.js`**: The central command processor for the Discord bot. It routes commands like `!5e`, `!create en`, `!ro`, etc., to the appropriate logic.
-   **`BackendAudioPlayer.js`**: A class that manages all audio playback in Discord voice channels.

### `src/tda/`
This directory contains all the code for the Three-Dragon Ante card game.

-   **`ThreeDragonAnte.js`**: A large, self-contained class that manages the state, logic, and player interaction for the game.

### `src/ui/`
This directory contains files related to the Electron user interface.

-   **`renderer.js`**: The main script for the frontend UI, responsible for all DOM manipulation and handling user interactions.
-   **`preload.js`**: Acts as the secure bridge between the frontend (`renderer.js`) and the backend (`main.js`).
-   **`DropdownHandler.js`**: A helper class to manage complex, paginated dropdown menus in Discord interactions.

### `src/tools/`
This directory contains standalone scripts for data processing and other development tasks.

-   **`extract_background_data.js`**: A script to extract personality traits, ideals, bonds, and flaws from the `backgrounds.json` file into separate files for the NPC generator.

---

## Data & Asset Directories

### `resources/`
-   **Purpose**: This directory holds static assets and large data files.
-   **`resources/5etoolsdata/`**: Contains a vast collection of JSON files sourced from the `5etools` project. It includes data for nearly every aspect of D&D 5e.

### `randomtables/`
-   **Purpose**: This directory contains custom JSON files that are used as weighted tables for various random generation features, such as the `!ro` command and the `MagicItemGenerator`.

---

## Documentation

### `docs/`
This directory contains all documentation for the project.

-   **`development.md`**: The main development guide. Provides a high-level technical overview of the application's architecture and features.
-   **`file_reference.md`**: This file. A reference for the files and directories in the repository.
-   **`5etools_data_overview.md`**: An overview of the JSON data files located in `resources/5etoolsdata/`.
-   **`dropdown_handler_guide.md`**: A guide explaining how to use the `DropdownHandler` class.
-   **`gamify_tool_readme.md`**: Instructions on how to create new tasks for the JSON Gamify Tool.
-   **`tda_status.md`**: A status document for the Three-Dragon Ante module.
