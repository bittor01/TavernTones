<!-- Performance and security update -->
# TavernTones

TavernTones is a powerful desktop application designed for Dungeon Masters to stream high-quality, glitch-free ambient soundscapes, music, and sound effects directly to their players on Discord. It also features a fully-featured Combat Initiative Tracker with support for 5e bestiary data and mob rules.

## Key Features

- **Discord Audio Streaming**: High-performance audio engine that mixes music and sound effects for a seamless Discord experience.
- **Combat Tracker**: Manage initiative, HP, conditions, and rolls for players and monsters.
- **Mob Rules Support**: Easily handle large groups of creatures with integrated mob calculation rules.
- **5e Bestiary Integration**: Import monster data directly and sync with official sources via GitHub.
- **Soundboard**: Trigger quick sound effects with ducking support (music volume lowers when SFX play) and multi-track playlist support for each slot.
- **Random Tables**: Roll on customizable random tables directly from the app with improved Discord feedback.
- **Bot Collision Detection**: Prevents multiple instances from using the same bot token simultaneously.
- **Enhanced Music Playlist**: Real-time progress bars, true pause/resume, and easy playlist management with folder support.

## Quick Start Guide

1.  **Launch TavernTones**: Open the application. On the first launch, it will prompt you for configuration.
2.  **Configure Folders**:
    - Go to **Settings** (⚙️).
    - Set your **Default Music Path** and **Random Tables Path**.
    - Click **Create and Use Default Data Folders** if you want the app to set up a standard structure for you.
3.  **Setup Bestiary**:
    - In Settings, ensure your **Bestiary Data Path** is set.
    - Click **Fetch/Update Bestiary Data From Git** to download the latest monster data.
4.  **Connect to Discord (Optional)**:
    - In Settings, check **Enable Discord Bot**.
    - Enter your Bot Token, Channel IDs, and Role ID.
    - Save and restart the application.
5.  **Run Combat**: Add combatants using the "Add Combatant" form or by searching the imported bestiary.

## Dependencies

TavernTones requires **FFmpeg** for audio processing. The application will attempt to auto-detect FFmpeg on your system. If not found, you can manually specify the path in the Settings menu.

---

*Note: TavernTones is not affiliated with Wizards of the Coast or Discord.*
