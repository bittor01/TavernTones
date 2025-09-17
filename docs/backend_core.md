# Backend Core Documentation

This document describes the core backend architecture of the TavernTones application.

---

## Architecture

The application is built on two main pillars: an **Electron App** for the DM-facing user interface and a **Discord.js Bot** for interacting with players in a Discord server.

- **Electron App**: This provides the main window that the DM interacts with. It's responsible for the initiative tracker, soundboard, and logging UI. It runs a Node.js backend (`main.js`) and a Chromium-based frontend (`renderer.js`).
- **Discord.js Bot**: This runs within the Electron main process and connects to the Discord API. It listens for chat commands and interactions (buttons, modals, etc.) to trigger its various features.

These two pillars communicate via Electron's Inter-Process Communication (IPC) mechanism.

### Key Files

- **`main.js`**: The heart of the application. It serves as the Electron main process. Its responsibilities include:
    - Creating and managing the Electron `BrowserWindow`.
    - Initializing the Discord.js client and logging into Discord.
    - Setting up all `ipcMain` listeners to handle requests from the UI (renderer process).
    - Initializing and holding instances of all major backend modules (`CommandHandler`, `InitiativeTracker`, `BackendAudioPlayer`, etc.).
    - Handling all Discord events (`messageCreate`, `interactionCreate`).

- **`renderer.js`**: The brain of the user interface. This script runs in the Electron window (the "renderer process") and is responsible for:
    - Building and dynamically updating the DOM (the HTML).
    - Handling all user interactions within the window (button clicks, form submissions).
    - Sending messages to the main process via IPC to trigger backend logic (e.g., "next turn", "add creature").
    - Listening for messages from the main process via IPC to update the UI with new state (e.g., an updated initiative order).

- **`preload.js`**: The secure bridge between the backend and frontend. It uses Electron's `contextBridge` to expose a specific, limited set of `ipcRenderer` functions to `renderer.js`. **Any new communication channel between the UI and the backend must be explicitly defined in this file.**

- **`CommandHandler.js`**: The primary command processor for the Discord bot. It parses messages that mention the bot and routes commands (`!ping`, `!5e`, `!play`, etc.) to the correct logic and modules.

### IPC Communication

Communication between the backend (`main.js`) and the frontend (`renderer.js`) is critical. Because they run in separate processes, they cannot directly call each other's functions. Instead, they use IPC.

- **Frontend to Backend (`renderer.js` -> `main.js`):**
    - **`ipcRenderer.send(channel, data)`**: Used for "fire-and-forget" messages where the frontend doesn't need a direct response. Example: `window.electron.ipcRenderer.send('next-turn');`
    - **`ipcRenderer.invoke(channel, data)`**: Used when the frontend needs to trigger a function in the backend and wait for a result. Example: `window.electron.ipcRenderer.invoke('search-monsters', query);`

- **Backend to Frontend (`main.js` -> `renderer.js`):**
    - **`mainWindow.webContents.send(channel, data)`**: Used by the backend to push updates to the frontend. Example: `mainWindow.webContents.send('update-initiative-list', ...);`

As mentioned, all channels used for this communication must be whitelisted in `preload.js` for security.
