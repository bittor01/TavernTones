# Tavern Tones Help Guide

## 🎵 Music Player
- **Playlist Management**: Add files with ➕ or entire folders with 📁.
- **Controls**: Standard Play, Pause, Prev, and Next buttons.
- **Loop Modes**: Cycle through No Loop, Loop All, and Loop Single.
- **Shuffle**: Randomize your current playlist.
- **Progress Bar**: Track the current song's progress in real-time.

## 📢 Soundboard
- **Quick SFX**: Load sounds into slots for immediate playback.
- **Ducking**: Music volume automatically lowers when a soundboard effect is playing.
- **Customization**: Change the emoji for each slot to easily identify your sounds.

## ⚔️ Combat Tracker
- **Initiative**: Add combatants manually or search the 5e bestiary.
- **Conditions**: Track D&D 5e conditions with automatic descriptions and emojis.
- **Mob Rules**: Handle large groups of enemies easily with integrated mob calculation rules.
- **Discord Sync**: Push the current initiative order or creature stat blocks directly to your Discord channel.

## 🤖 Discord Bot
- **Setup**: Enter your Bot Token and Channel IDs in the Settings menu.
- **Interaction Methods**:
  - **Slash Commands**: Type `/` in Discord to see available commands like `/roll`, `/play-song`, and `/surge`. These are the recommended way to interact.
  - **Text Commands**: You can use traditional prefix commands (e.g., `!pl`, `!ro`, `!dr`).
    - ⚠️ **Important**: You MUST **@mention** the bot in your message for it to respond to text commands (e.g., `@TavernTones !pl chill`).
- **Key Commands**:
  - `!pl <folder>`: Play music from a specific folder.
  - `!ro <folder> <count> <weight> <table...>`: Roll on random tables.
  - `!dr <notation>`: Roll arbitrary dice (e.g., `2d20kh1`).
- **Collision Detection**: The bot will notify you if another instance is already using the same token to prevent chaos.

## ⚙️ Settings
- **Paths**: Configure where your bestiary, music, and random tables are stored.
- **GitHub Sync**: Fetch the latest bestiary data directly from official repositories.
- **FFmpeg**: Ensure the folder containing both `ffmpeg` and `ffprobe` is correctly selected in settings for audio streaming and duration detection.
