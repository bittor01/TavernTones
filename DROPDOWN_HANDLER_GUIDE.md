# DropdownHandler Guide

The `DropdownHandler` is a utility class designed to simplify the creation and management of complex Discord `StringSelectMenuBuilder` components, especially those that require pagination and pinned options to work around Discord's 25-option limit.

## Features

- **Pagination:** Automatically splits a large list of options into multiple pages.
- **Pinned Options:** Allows you to "pin" certain options to the top or bottom of the list on every page.
- **Stateful Selections:** Remembers the currently selected option and marks it as default.
- **Dynamic Labels:** Pinned items have special emoji markers (`📌` or `⬆️`) to indicate their status.

## Usage

### 1. Initialization

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

### 2. Creating the Action Row

To get a component that you can send in a message, call the `createActionRow` method, passing the desired page number.

```javascript
// To get the first page
const actionRow = myDropdownHandler.createActionRow(1);

await interaction.reply({
    content: 'Please make a selection:',
    components: [actionRow]
});
```

### 3. Handling Interactions

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

### 4. Setting a Default

If you want to pre-select an option when the dropdown is rendered, use the `setDefault` method before creating the action row.

```javascript
const previouslySelected = 'fruit_apple';
myDropdownHandler.setDefault(previouslySelected);

const actionRow = myDropdownHandler.createActionRow(1); // Apple will now be marked as the default
```
