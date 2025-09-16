# UI Documentation

This document describes the user interface of the TavernTones application.

---

## Initiative Tracker (UI)

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

## Audio Player & Soundboard

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
