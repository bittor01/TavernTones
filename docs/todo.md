# Project TODO List and Development Plan

This document consolidates all known bugs, planned features, and active development tasks for the TavernTones project.

---
## Completed Tasks
- **Project Reorganization**: Moved all source code into a `src` directory, created a `scripts` directory, and restructured the `docs` folder.
- **Interaction Model Refactor**:
    - Made all interactive command prompts public instead of ephemeral.
    - Implemented a "Thinking/Done" UX flow where the original public message is edited to show the bot's status, and components are removed after use.
    - Updated discord.js syntax for ephemeral messages from the deprecated `{ ephemeral: true }` to `{ flags: [MessageFlags.Ephemeral] }`.
- **Bug Fix**: Corrected all file paths in the codebase after the reorganization, including the critical path to `5etoolsdata` in `5eParser.js`.

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
3.  **Remember Window Positions**: Save the position and size of the main and secondary windows on graceful close and restore them on the next launch.
4.  **Single Instance Lock**: Prevent more than one instance of the application from running at the same time.

### Three-Dragon Ante - Not Yet Implemented
- **Remaining Card Powers**: The powers for the following optional/expansion cards have not been implemented yet:
    - **Legendary Dragons:** `Black Raider`, `Blue Overlord`, `Brass Sultan`, `Bronze Warlord`, `Copper Trickster`, `Gold Monarch`, `Green Schemer`, `Red Destroyer`, `Silver Seer`, `White Hunter`.
    - **Other Mortals/Special Dragons:** `The Princess`, `The Kobold`, `The Wyrmpriest`, `Dracolich`, `Bahamut`, and the two Wyrmlings.
- **D&D Special Abilities**: While selectable in the UI, the mechanical effects of the 8 special abilities (Bluff, Concentration, etc.) are not yet hooked into the game logic. This is the largest missing feature.

### Three-Dragon Ante - UI/UX Improvements (Backlog)
- **Current Action Embed**: Create a new, temporary embed in each player's DM that only appears when they need to take an action. This embed should flash with different colors to draw attention (e.g., green for a normal turn, yellow for an off-turn choice, red for low time) and contain text describing the exact choice required.
- **Full Text Display**: Instead of just showing card names, the embeds for a player's Hand and Flight should show the full, unabbreviated rules text for each card. This is an important accessibility feature.
- **5x4 Draft Grid**: Rework the draft UI to display the pool of 20 optional cards in a 5x4 grid of images. As cards are removed, the grid should collapse to fill the empty space. The background of the image should be transparent.
