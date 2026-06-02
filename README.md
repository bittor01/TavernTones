<!-- Performance and security update -->
# TavernTones

TavernTones is a tool for Dungeon Masters to stream ambient soundscapes, music, and sound effects directly to their players on Discord. It also features a fully-featured Combat Initiative Tracker with support for 5e bestiary data and mob rules.

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
    - *See [Discord Bot Setup Guide](#discord-bot-setup-guide) below for details.*
5.  **Run Combat**: Add combatants using the "Add Combatant" form or by searching the imported bestiary.

## Discord Bot Setup Guide

To use the audio streaming and chat integration features, you need to create a Discord Bot and add it to your server.

### 1. Create your Bot
1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **New Application** and give it a name (e.g., "TavernTones Bot").
3.  Navigate to the **Bot** tab in the sidebar.
4.  Click **Reset Token** (or **Copy Token**) to get your **Bot Token**. *Keep this secret!*
5.  Scroll down to **Privileged Gateway Intents** and enable:
    - **Message Content Intent** (Required for reading chat commands).

### 2. Permissions & Invite Link
1.  Navigate to **OAuth2** -> **URL Generator**.
2.  Select the `bot` and `applications.commands` scopes.
3.  In **Bot Permissions**, select the following (Principle of Least Privilege):
    - **General Permissions**:
        - `View Channels`
    - **Text Permissions**:
        - `Send Messages`
        - `Embed Links`
        - `Read Message History`
        - `Use External Emojis`
    - **Voice Permissions**:
        - `Connect`
        - `Speak`
        - `Use Voice Activity`
4.  **Permission Integer**: The resulting bitmask should be `37047296`.
5.  Copy the generated URL and paste it into your browser to invite the bot to your server.

### 3. Server Setup
1.  **Bot Role**: Discord automatically creates a role for your bot. Ensure this role is positioned high enough in the server settings if you want it to interact with specific users/roles.
2.  **Channel IDs**: In TavernTones Settings, you will need the IDs for your Text and Voice channels.
    - Enable **Developer Mode** in Discord (User Settings -> Advanced).
    - Right-click any channel and select **Copy Channel ID**.

## Dependencies

TavernTones requires **FFmpeg** for audio processing. The application will attempt to auto-detect FFmpeg on your system. If not found, it will provide some. You can manually specify the path in the Settings menu if you have newer or preferred ones installed.

---

*Note: TavernTones is not affiliated with Wizards of the Coast or Discord.*
