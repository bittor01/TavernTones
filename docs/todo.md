# Project TODO List and Development Plan

This document consolidates all known bugs, planned features, and active development tasks for the TavernTones project.

---

## High Priority Fixes & Known Bugs

### General
1.  **Encounter Builder (`!create en`)**: When building an encounter with a high-CR creature (e.g., CR 21 Lich), the XP calculation is incorrect. The final encounter has a total XP value that is far too low.
2.  **Soundboard (UI)**: The soundboard UI is blank and does not display the control buttons. It is completely non-functional.
3.  **Fix Gamify Tool Launch**: Implement the separate command-line launch for the Gamify Tool (e.g., `npm run json`).
4.  **Fix Gamify Tool Data Lookup**: Debug and resolve the issue where the tool fails to fetch spell details from the 5eTools data on launch.
5.  **Fix Initiative Tracker UI**: The "Attack" button in the combatant details panel should have its color changed to match the stat/save roll buttons below it, not the header buttons next to it.

### Three-Dragon Ante
1.  **Image Display Failure**: Card images do not appear in embeds. This seems to be an environment-specific issue with how the bot is resolving file paths. The command to start the game may still crash because of this.
2.  **Gold Scaling Not Working**: The user reported that gold values from card effects are not scaling with the initial ante as intended. This is a critical bug in the game's economy.
3.  **Ante Phase Failure**: The game stalls or enters a confusing state during the first ante.

---

## Future Features & Major Improvements

### New Bot Commands & Generators
1.  **Advanced Loot Generator (`!hoard` or `!loot`)**:
    -   **Concept**: A command to generate a full treasure hoard based on a Challenge Rating.
    -   **Data Used**: `loot.json`, `items.json`.
    -   **Functionality**: User provides a CR, and the bot rolls on the "Treasure Hoard" table from `loot.json` for coins, gems, and magic items.
2.  **Trap & Hazard Generator (`!trap` or `!hazard`)**:
    -   **Concept**: A command to quickly generate a random trap or environmental hazard appropriate for the party's level.
    -   **Data Used**: `trapshazards.json`.
    -   **Functionality**: User provides a party tier, and the bot filters `trapshazards.json` to select and display a random trap.
3.  **Character Concept Generator (`!character-idea`)**:
    -   **Concept**: A tool to help players break writer's block by generating a random character concept.
    -   **Data Used**: `races.json`, `backgrounds.json`, `class/*.json`.
    -   **Functionality**: Randomly selects a race, class, and background.
4.  **NPC Generator (`!npc`)**:
    -   **Concept**: Similar to the character concept generator, but for creating quick Non-Player Characters for the DM.
    -   **Data Used**: `races.json`, `backgrounds.json`, `bestiary/*.json`.
    -   **Functionality**: Randomly combines a race, background, and a low-CR humanoid stat block.
5.  **Adventure Hook Generator (`!adventure-hook`)**:
    -   **Concept**: A tool to generate plot hooks and adventure ideas by combining different data sources.
    -   **Data Used**: `adventures.json`, `cultsboons.json`, `deities.json`, `bestiary/*.json`.
    -   **Functionality**: Combines a villain, location, and motive in a Mad Libs style.
6.  **Vehicle Encounter Generator (`!ship-battle`)**:
    -   **Concept**: Generate a random enemy ship or fleet for naval or spelljamming combat.
    -   **Data Used**: `vehicles.json`, `bestiary/*.json`.
    -   **Functionality**: User specifies a vehicle type, and the bot selects a matching vehicle, populates it with a crew, and presents the stat block.

### Major Architectural Improvements
1.  **LLM Agent (`!ask` command)**:
    -   **Goal**: Evolve the LLM integration into a "Master Control Program" that can use the bot's other features as tools.
    -   **Concept**: A user could make a natural language request like `!ask generate a moderate encounter for 4 level 5 players in a swamp`. The LLM would parse this, identify the correct tool (`EncounterBuilder`), determine the parameters, and execute the command.
2.  **Generic Fallback Data System**:
    -   **Goal**: Generalize the fallback system created for background characteristics.
    -   **Concept**: Create a generic "data extractor" script and a corresponding "fallback loader" to handle situations where data is missing (e.g., providing generic actions for monsters that lack them).

### Quality of Life Improvements
1.  **Refactor `!ro` Command**: Improve the user experience of the `!ro` command by replacing the clunky text-based input with an interactive Discord Modal.
2.  **Investigate New Generators from 5eTools Data**: Explore the `5etoolsdata` directory, specifically files like `loot.json` and `life.json`, to find opportunities for new generators or bot features.
3.  **Remember Window Positions**: Save the position and size of the main and secondary windows on close and restore them on the next launch.

### Three-Dragon Ante - Not Yet Implemented
- **Remaining Card Powers**: The powers for the following optional/expansion cards have not been implemented yet:
    - **Legendary Dragons:** `Black Raider`, `Blue Overlord`, `Brass Sultan`, `Bronze Warlord`, `Copper Trickster`, `Gold Monarch`, `Green Schemer`, `Red Destroyer`, `Silver Seer`, `White Hunter`.
    - **Other Mortals/Special Dragons:** `The Princess`, `The Kobold`, `The Wyrmpriest`, `Dracolich`, `Bahamut`, and the two Wyrmlings.
- **D&D Special Abilities**: While selectable in the UI, the mechanical effects of the 8 special abilities (Bluff, Concentration, etc.) are not yet hooked into the game logic. This is the largest missing feature.

---

## Active Development Plan

This section outlines the plan for features that were previously under active development.

### Three-Dragon Ante
1.  Awaiting user feedback to diagnose the **Gold Scaling** and **Image Path** bugs.
2.  Once bugs are fixed, proceed with implementing the remaining card powers.
3.  Implement the mechanical effects of the D&D Special Abilities.

### General Cleanup
1.  Delete the obsolete `hp.html` and `hp.js` files.
2.  Update `FILE_REFERENCE.md` to remove the "HP Tracker (Legacy)" section.

### Vehicle Encounter Generator (`!vehicle-encounter`)
1.  **Data Analysis**: Analyze `resources/5etoolsdata/vehicles.json` to map vehicle tags to the requested environment categories (`Land`, `Air`, `Naval`, `Space`, `Underground`).
2.  **Command & UI**: Implement a new `!vehicle-encounter` command in `CommandHandler.js` that triggers a message with dropdowns for `Environment` and `Encounter Style` (`Flagship`/`Balanced`).
3.  **Modal Input**: Upon proceeding, display a modal to collect `Total HP` and (for "Balanced" style) `Number of Vehicles` from the user.
4.  **Backend Logic (`Flagship`)**: Implement the logic to find the largest single vehicle that fits the HP budget, then use the remaining HP to add smaller escort vehicles.
5.  **Backend Logic (`Balanced`)**: Implement the logic to calculate the target HP per vehicle, then find several vehicle options within a +/- 15% range of that target.
6.  **Output Formatting**: Create a new helper function to format the generated vehicle encounter into a summary embed and a detailed thread, similar to the existing encounter generator.

### Trap & Hazard Generator (`!generate-trap`)
1.  **Command & UI**: Implement a new `!generate-trap` command in `CommandHandler.js` that prompts the user with optional dropdowns for `Party Tier`, `Threat Level`, `Trap Type`, and a text input for `Environment`.
2.  **Backend Logic**: Implement the filtering logic based on user selections. If a filter is left blank, it will not be applied. The `Environment` filter will perform a case-insensitive text search on the trap's description.
3.  **Random Selection**: After filtering, randomly select one trap from the remaining pool.
4.  **Output Formatting**: Create a function to format the selected trap's details into a comprehensive embed, showing its trigger, effects, and countermeasures.
