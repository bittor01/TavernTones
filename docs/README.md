# TavernTones Documentation

Welcome to the documentation for TavernTones, a desktop application for Dungeon Masters. This documentation provides an overview of the application's features and architecture.

## Core Features

The application is built with Electron and provides the following core features:

### Initiative Tracker

A comprehensive tool for managing combat encounters.

- **Combatant Management**: Add, edit, and remove creatures and players from the initiative order.
- **Mob Support**: Group multiple creatures into a single "mob" unit with scaled HP.
- **HP Tracking**: Track hit points for all combatants, including temporary HP.
- **Status Effects**: Apply and track status effects.
- **Automated Rolling**: Roll initiative, attacks, and saving throws with dice roll logging.

### Music Player

A simple, integrated music and soundboard player.

- **Ambient Tracks**: Play background music and ambient soundscapes.
- **Sound Effects**: Trigger sound effects from a customizable soundboard.

### Random Table Roller

A flexible tool for rolling on custom random tables.

- **`!ro` Command**: A powerful, generic command that can roll on any table from any subfolder within the `randomtables` directory. It supports weighted tables and multiple rolls.
- **`!su` and `!sh` Commands**: Simple commands for rolling on the `surge.json` and `shield.json` tables, respectively, with support for unique, per-user results.

## Technical Overview

For more detailed technical information, please refer to the following documents:

- **[Backend Core Documentation](./backend_core.md)**: An overview of the application's architecture, key core files, and the IPC communication system.
- **[UI Documentation](./ui.md)**: Documentation for the Electron-based user interface.
- **[File Reference](./file_reference.md)**: A reference guide to the purpose of important files and directories in the project.
