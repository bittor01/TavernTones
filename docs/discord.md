# Discord Bot Documentation

This document describes the Discord bot features of the TavernTones application.

## Interaction Model

For commands that require user input via buttons or dropdowns (e.g., `!ma`, `!create en`), the bot uses the following interaction model to keep the channel clean:

1.  The initial command (`!ma`) creates a **public message** containing the interactive components (buttons, dropdowns).
2.  When the user makes their selections and submits the final action (e.g., clicks "Generate" or submits a modal), the bot immediately edits the original public message to a "Thinking..." state (e.g., `⚙️ Generating items...`) and removes all the interactive components.
3.  The bot performs the requested action (e.g., generating items) and posts the results in a new message or thread.
4.  Finally, the bot edits the original message a second time to a "Done" state (e.g., `✅ Generation complete!`), providing a clear confirmation and a clean end to the interaction flow.

---
For a guide on the DropdownHandler utility, see the bottom of this document.

---

## 5eTools Data Search (`!5e`, `!spell`, etc.)

This feature allows users to search the vast database of D&D 5e content from the `5etools` project.

- **Functionality**:
    - Provides a generic `!5e` command to search all categories by name.
    - Provides specific commands (`!spell`, `!item`, `!monster`, etc.) to search within a single category.
    - Provides a `!deep` command to search by content, not just by name.
    - Presents results in a dropdown menu. Selecting an option displays the full details of the selected item in an embed.

- **Key Files**:
    - **`5eParser.js`**: The core data access layer. It handles loading, caching, and searching the JSON data files.
    - **`CommandHandler.js`**: Defines the search commands and uses `5eParser.js` to get results. It also builds the interactive dropdown menu.
    - **`5eEmbedFormatter.js`**: A helper module to format the raw JSON data of an item into a user-friendly Discord embed.

## Encounter Builder (`!create en`)

This feature procedurally generates a themed D&D encounter based on user parameters.

- **Functionality**:
    - Can be initiated with a specific "main creature" (e.g., `!create en hobgoblin`) or a creature type (e.g., `!create en undead`).
    - Presents the user with interactive dropdowns and buttons to select the main creature and difficulty.
    - Uses a modal to get party level and size from the user.
    - Generates a list of thematically appropriate monsters to fill an XP budget.
    - Posts the results in a thread, with full stat blocks for each creature in the encounter.

- **Key Files**:
    - **`EncounterBuilder.js`**: Contains the core algorithm for encounter generation, including XP budget calculation, candidate scoring, and the unit pool system.
    - **`CommandHandler.js`**: Handles the `!create en` command, the initial search for the main creature/type, and the interactive UI flow.
    - **`5eParser.js`**: Used by the `EncounterBuilder` to get the list of all available monsters.

---
## DropdownHandler Guide

The `DropdownHandler` is a utility class designed to simplify the creation and management of complex Discord `StringSelectMenuBuilder` components, especially those that require pagination and pinned options to work around Discord's 25-option limit.

### Features

- **Pagination:** Automatically splits a large list of options into multiple pages.
- **Pinned Options:** Allows you to "pin" certain options to the top or bottom of the list on every page.
- **Stateful Selections:** Remembers the currently selected option and marks it as default.
- **Dynamic Labels:** Pinned items have special emoji markers (`📌` or `⬆️`) to indicate their status.

### Usage

#### 1. Initialization

First, require the class:
`const DropdownHandler = require('./DropdownHandler.js');`

Then, create a new instance with your options:

```javascript
const allMyOptions = [
    { label: 'Apple', value: 'fruit_apple' },
    { label: 'Banana', value: 'fruit_banana' },
    // ... more than 25 options
];

const myDropdownHandler = new DropdownHandler({
    customId: 'my-custom-dropdown',
    options: allMyOptions,
    placeholder: 'Select a fruit',
    topPinned: [
        { label: 'Any Fruit (Random)', value: 'random' }
    ]
});
```

#### 2. Creating the Action Row

To get a component that you can send in a message, call the `createActionRow` method, passing the desired page number.

```javascript
// To get the first page
const actionRow = myDropdownHandler.createActionRow(1);

await interaction.reply({
    content: 'Please make a selection:',
    components: [actionRow]
});
```

#### 3. Handling Interactions

In your `interactionCreate` event handler, you need to handle the custom ID of the dropdown. The handler appends the page number to the ID you provide, separated by a `|`.

You also need to handle the special `!prevPage` and `!nextPage` values to update the message with a new page.

```javascript
client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;

    const [customIdBase, pageStr] = interaction.customId.split('|');
    const page = parseInt(pageStr, 10);
    const selectedValue = interaction.values[0];

    if (customIdBase === 'my-custom-dropdown') {
        if (selectedValue.startsWith('!prevPage')) {
            const newPage = parseInt(selectedValue.split('|')[1], 10);
            // Re-create the handler and update the message with the new page
            const newActionRow = myDropdownHandler.createActionRow(newPage);
            await interaction.update({ components: [newActionRow] });
            return;
        }
        if (selectedValue.startsWith('!nextPage')) {
            const newPage = parseInt(selectedValue.split('|')[1], 10);
            const newActionRow = myDropdownHandler.createActionRow(newPage);
            await interaction.update({ components: [newActionRow] });
            return;
        }

        // Handle the actual selection
        console.log(`User selected: ${selectedValue}`);
        // You would typically save this selection and update the UI accordingly
    }
});
```

#### 4. Setting a Default

If you want to pre-select an option when the dropdown is rendered, use the `setDefault` method before creating the action row.

```javascript
const previouslySelected = 'fruit_apple';
myDropdownHandler.setDefault(previouslySelected);

const actionRow = myDropdownHandler.createActionRow(1); // Apple will now be marked as the default
```
