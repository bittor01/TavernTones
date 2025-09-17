# Application Test Checklist

This document provides a checklist of core features to test after making significant changes to the application, to ensure that nothing has broken.

---

## UI (Electron App)

### Initiative Tracker
- [ ] **Add Combatant**: Can you add a new combatant with dice notation for HP and initiative (e.g., `2d8+4`, `+3`)?
- [ ] **Import Monster**: Does the "Import Combatant" button correctly search for and populate the form with a monster's stat block?
- [ ] **Turn Management**: Do the "Next Turn" and "Previous Turn" buttons correctly cycle through the initiative order?
- [ ] **HP/Conditions**: Can you apply damage, healing, temporary HP, and conditions to a combatant?
- [ ] **Dice Rolling**: Can you roll stat checks, saves, and attacks from a combatant's detail panel?
- [ ] **Push to Discord**: Does the "Push to Chat" button correctly send the initiative order to the specified Discord channel?
- [ ] **Save/Load**: Can you save the current encounter to a file and successfully load it back?
- [ ] **Auto-Save**: Does the application correctly reload the `autosave.json` file on startup?

### Audio
- [ ] **Music Player**: Can you select a local `.wav` file and have it play in the designated voice channel?
- [ ] **Pause/Play**: Do the pause/play controls in the UI work correctly?
- [ ] **Soundboard**: (Currently known to be broken) Verify if the UI loads.

### Gamify Tool
- [ ] **Launch**: Can the tool be launched successfully (e.g., via `npm run json`)?
- [ ] **Load Task**: Does the tool correctly load the default task file (`deck-editing-task.json`)?
- [ ] **Data Display**: Does the tool correctly display the data for the first item in the task?
- [ ] **Save & Next**: Does the "Next" button correctly save changes and load the next item?
- [ ] **Undo**: Does the "Undo" button correctly revert to the previous item state?

---

## Discord Bot Commands

_(All commands should be tested by mentioning the bot, e.g., `@TavernTones !ping`)_

### Core Commands
- [ ] **`!ping`**: Does the bot respond with "Pong!"?
- [ ] **`!h` (help)**: Does the bot respond with the help embed?

### 5eTools Search
- [ ] **`!5e <query>`**: Does a generic search return a dropdown of results?
- [ ] **`!spell <query>`**: Does a spell-specific search work?
- [ ] **`!item <query>`**: Does an item-specific search work?
- [ ] **`!monster <query>`**: Does a monster-specific search work?
- [ ] **Result Display**: Does selecting an option from the search results dropdown display the correct embed?

### Generators
- [ ] **`!create en <creature>`**: Does the encounter builder start correctly and present the interactive UI?
- [ ] **`!ma` (magic item)**: Does the magic item generator start correctly and present the interactive UI?
- [ ] **`!generate-character`**: Does the character generator start correctly?
- [ ] **`!generate-trap`**: Does the trap generator start correctly?
- [ ] **`!vehicle-encounter`**: Does the vehicle encounter generator start correctly?

### Random Tables
- [ ] **`!su` (surge)**: Does the bot roll on the wild magic surge table?
- [ ] **`!sh` (shield)**: Does the bot roll on the wild magic shield table?
- [ ] **`!ro <folder> ...`**: Does the generic roll command work with a simple table?

### Audio Commands
- [ ] **`!pl <folder>`**: Does the bot play a random track from the specified folder?
- [ ] **`!pa`**: Does the bot pause the currently playing music?

### Other
- [ ] **`!3da` (Three-Dragon Ante)**: (Currently known to be broken) Does the command successfully start a lobby?
