# DropdownHandler Class Guide

This document provides instructions on how to use the `DropdownHandler.js` class to create and manage complex, paginated Discord select menus.

## Overview

The `DropdownHandler` is a reusable utility class designed to simplify the creation of Discord `StringSelectMenuBuilder` components that have more options than the maximum of 25 allowed by the Discord API.

### Key Features

-   **Automatic Pagination**: Automatically calculates the number of pages required to display all options.
-   **Navigation**: Automatically adds "Previous Page" and "Next Page" options as needed.
-   **Option Pinning**: Allows for certain options to be "pinned" to the top or bottom of the dropdown list, ensuring they are always visible regardless of the current page.
-   **Dynamic Slot Calculation**: Correctly handles the varying number of available slots on the first, middle, and last pages of the dropdown.

## Usage

### 1. Import the Class

First, import the class into the file where you will be building your Discord command's components.

```javascript
const DropdownHandler = require('./DropdownHandler.js'); // Adjust the path as necessary
```

### 2. Instantiate the Handler

Create a new instance of the `DropdownHandler` by passing a configuration object to its constructor.

#### Constructor Configuration

The constructor accepts a single object with the following properties:

-   `customId` (string, **required**): The base custom ID for the select menu. The handler will append page information to this ID (e.g., `my-custom-id|page1`), so your interaction handler should be prepared to parse this.
-   `options` (Array<object>, **required**): An array of option objects to be displayed. Each object **must** have a `label` (string) and `value` (string) property.
-   `placeholder` (string, optional): The placeholder text that appears in the dropdown when no option is selected. Defaults to `'Select an option'`.
-   `topPinned` (Array<object>, optional): An array of option objects to pin to the top of the list on every page.
-   `bottomPinned` (Array<object>, optional): An array of option objects to pin to the bottom of the list on every page.

#### Example Instantiation

```javascript
const allRaces = [/* ... array of 50 race objects ... */]; // { label: 'Human', value: 'human_phb' }, etc.

const raceDropdownHandler = new DropdownHandler({
    customId: 'character-race-select',
    options: allRaces,
    placeholder: 'Select a species...',
    topPinned: [
        { label: 'Any Species (Random)', value: 'random' }
    ]
});
```

### 3. Create the Action Row

Use the `createActionRow()` method to generate a Discord `ActionRowBuilder` containing the fully configured select menu. This method can then be sent in a message reply or edit.

#### `createActionRow(currentPage = 1)`

-   **`currentPage`** (number, optional): The page number you want to display. Defaults to `1`.

This method returns an `ActionRowBuilder` instance, ready to be used in a message's `components` array.

#### Example Usage

```javascript
// To show the first page of the dropdown
const actionRowPage1 = raceDropdownHandler.createActionRow(1);

await interaction.reply({
    content: 'Please make your selection:',
    components: [actionRowPage1],
    ephemeral: true
});

// To show the third page (perhaps in response to a button click)
const actionRowPage3 = raceDropdownHandler.createActionRow(3);

await interaction.editReply({
    components: [actionRowPage3]
});
```

### 4. Handling User Interactions

In your interaction handler (e.g., in `main.js` for an `interactionCreate` event), you will need to check the `customId` of the select menu interaction to see if it matches the base `customId` you provided.

You will also need to check the `interaction.values[0]` to see if the user selected a navigation option. The navigation options have a special value format: `!page_<number>`.

#### Example Interaction Handling Logic

```javascript
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    const [customIdBase] = interaction.customId.split('|');

    if (customIdBase === 'character-race-select') {
        const selectedValue = interaction.values[0];

        if (selectedValue.startsWith('!page_')) {
            const newPage = parseInt(selectedValue.split('_')[1], 10);

            // Re-create the dropdown handler with the same options
            const handler = new DropdownHandler({ /* ... same config ... */ });
            const newActionRow = handler.createActionRow(newPage);

            await interaction.update({ components: [newActionRow] });
        } else {
            // User selected an actual option, not a page
            // Handle the selection...
            const selectedRaceValue = selectedValue;
            // ...
        }
    }
});
```

This guide provides the necessary information to effectively use the `DropdownHandler` for creating complex and user-friendly dropdown menus in the application.
