# Three-Dragon Ante Feature: Status Report

This document outlines the current status of the Three-Dragon Ante feature implementation, including the architecture, completed features, outstanding bugs, and a plan for moving forward.

## I. Current Architecture

The feature has been refactored into a robust, state-driven system with a clear separation of concerns.

-   **`src/backend/features/ThreeDragonAnte.js`**: This is the core **game engine**. It manages the game state, players, rules, and the overall flow of the game (drafting, ante, rounds, scoring, game over). It contains no Discord-specific UI code.

-   **`src/backend/features/TdaUiManager.js`**: This is the **UI manager**. Its sole responsibility is to render the game state provided by the game engine into Discord embeds and components. It creates and updates the persistent "game boards" for each player in their DMs.

-   **`src/discord/CommandHandler.js`**: This is the **entry point**. It instantiates both the game engine and the UI manager and links them using setter injection to resolve a circular dependency.

-   **`src/backend/core/main.js`**: This is the main **interaction handler**. All button, select menu, and modal interactions from the TDA UI are routed through this file, which then calls the appropriate methods in the `ThreeDragonAnteManager`.

## II. Implemented Features

A significant portion of the game loop and card powers has been implemented.

-   **Full Game Loop:**
    -   Lobby creation and management.
    -   Interactive, paginated drafting phase for optional cards.
    -   Scalable buy-in via a modal.
    -   Ante phase.
    -   Turn-based card playing rounds.
    -   End-of-gambit "Ready/Leave" flow.
    -   Game over detection (players leaving or running out of gold).

-   **Implemented Card Powers:**
    -   **Good Dragons:** Brass, Bronze, Copper, Gold, Silver.
    -   **Evil Dragons:** Blue, Green, White, Red.
    -   **Mortals:** Kobold, Sorcerer.
    -   Interactive prompts for powers that require player choice (Blue, Green, Brass, Red, White).

-   **Special Flights:**
    -   Logic to detect and reward flights of 3 cards of the same color (steal from stakes).
    -   Logic to detect and reward flights of 3 cards of the same strength (draw a card).

## III. Critical Unresolved Bug: Modal Timeout

There is a persistent bug where submitting the buy-in modal results in a "something went wrong" error from Discord, indicating a 3-second interaction timeout.

-   **Symptom:** The user who submits the modal sees a generic error. No error is logged in the application console.
-   **Diagnosis:** The application is not acknowledging the `ModalSubmitInteraction` within the 3-second window required by the Discord API.
-   **Attempted Fixes:**
    1.  **`interaction.update()`:** This was incorrect as it's for component messages, not modals.
    2.  **`interaction.reply({ ephemeral: true })`:** This is the generally correct method, but it failed, suggesting a deeper issue.
    3.  **`interaction.deferUpdate()`:** Also incorrect for modals.
    4.  **`interaction.deferReply({ ephemeral: true })`:** This is the most robust method and is the current implementation. The fact that it is *still* failing is the core of the problem.

-   **Theories:**
    -   **Possibility A:** The logic inside the main `interactionCreate` event handler in `main.js` is causing a delay *before* the code even reaches the `if (interaction.customId.startsWith('tda_buy_in_modal'))` check.
    -   **Possibility B:** There is a fundamental misunderstanding on my part about the state of the interaction object or the context in which `handleBuyInModalSubmit` is being called.

## IV. Path Forward

As agreed, the next step is to reset the environment to a clean state. This report will serve as the starting point for a fresh attempt.

-   **Immediate Next Step:** After the reset, the first task should be to solve the modal timeout bug. This might involve temporarily adding logging directly into `main.js` (with user assistance) to trace the interaction's path and timing.
-   **Continue Implementation:** Once the startup bug is fixed, we can resume implementing the remaining features based on the code reviews, such as the remaining card powers and any UI enhancements.
