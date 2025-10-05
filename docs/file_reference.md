# File Reference

<<<<<<< HEAD
This document provides a reference for the key files and directories in the TavernTones repository, describing their purpose and how they connect to other parts of the application.

---

## `src` Directory

This directory contains all the source code for the application, organized into subdirectories by feature area.

### `src/ui`
Contains all files related to the Electron-based user interface.

- **`Index.html`**: The main HTML file for the UI. It defines the three-column layout and contains all container elements.
- **`renderer.js`**: The main script for the UI. It is responsible for all DOM manipulation, rendering the initiative list, handling user interactions, and sending messages to the backend via IPC.
- **`preload.js`**: Acts as the secure bridge between the frontend (`renderer.js`) and the backend (`main.js`), exposing a limited set of IPC functions.
- **`styles.css`**: The main stylesheet for the application.

### `src/discord`
Contains modules related to the Discord bot's functionality.

- **`CommandHandler.js`**: The central command processor for the Discord bot. Its `handleMessage` method is triggered for any message mentioning the bot, routing commands to the appropriate logic.
- **`DropdownHandler.js`**: A utility class to simplify the creation of paginated Discord dropdown menus.
- **`5eEmbedFormatter.js`**: A helper module that transforms raw `5etools` JSON data objects into nicely formatted `EmbedBuilder` objects for display in Discord.

### `src/backend`
Contains the core backend logic and feature modules.

#### `core/`
- **`main.js`**: The heart of the application and the Electron main process entry point. It creates and manages the application windows, initializes the `discord.js` client, creates instances of all core backend modules, and orchestrates the application by routing IPC events and Discord client events.
- **`5eParser.js`**: A class that serves as the data access layer for the `5etools` dataset. It handles loading, caching, and searching the JSON data files in `resources/5etoolsdata/`.
- **`BackendAudioPlayer.js`**: A class that manages all audio playback in Discord voice channels, handling the `@discordjs/voice` player and playback state.

#### `features/`
- **`InitiativeTracker.js`**: A class that manages the entire state and logic of a combat encounter, including turn order, HP, conditions, and dice rolling.
- **`EncounterBuilder.js`**: A class containing the logic to procedurally generate D&D encounters based on parameters like party size, level, and a chosen creature/type.
- **`ThreeDragonAnte.js`**: A large, self-contained class that manages the state, logic, and player interaction for the Three-Dragon Ante card game.
- **`MagicItemGenerator.js`**: A class that procedurally generates magic items based on a weighted system.
- **`MagicItemData.js`**: Contains the raw data tables, probabilities, and configuration used by the `MagicItemGenerator.js`.
- **`NpcGenerator.js`**: A class for procedurally generating character and NPC concepts.
- **`VehicleEncounterBuilder.js`**: A class for generating vehicle-based encounters.

#### Other Scripts
- **`deprep.js`**: A simple script used for debugging. It generates and prints a dependency report for the `@discordjs/voice` library to help diagnose audio-related issues.
- **`extract_background_data.js`**: A utility script to extract character origin data (traits, ideals, etc.) from `backgrounds.json` and save them into separate files in `randomtables/origin`.

### `src/jsontool`
Contains all files for the standalone JSON Gamify Tool.
- **`json-gamify.html`**: The HTML structure for the tool.
- **`json-gamify.js`**: The frontend logic for the tool.
- **`json-gamify.css`**: The stylesheet for the tool.

---

## Data & Configuration

### Root Directory
- **`package.json`**: The standard Node.js project file, defining dependencies and scripts.
- **`TavernTones.code-workspace`**: The VS Code workspace configuration file.
- **`gamify-settings.json`**, **`deck-editing-task.json`**, **`spell-item-types-task.json`**: Configuration and task files for the JSON Gamify tool.

### `resources/`
- **`5etoolsdata/`**: Contains a vast collection of JSON files from the `5etools` project. This is the primary data source for most search and generation commands.
- **`threedragonanteimages/`**: Contains the card images for the Three-Dragon Ante game.

### `randomtables/`
This directory contains custom JSON files that are used as weighted tables for various random generation features like `!ro`, `!su`, `!sh`, and the `MagicItemGenerator`.
=======
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
>>>>>>> master
