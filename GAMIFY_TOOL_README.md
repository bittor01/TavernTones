# Gamified JSON Editing Tool

This document explains how to configure and create new tasks for the Gamified JSON Editing Tool.

## Task File Structure

The tool is driven by a JSON "task file". This file tells the tool which source files to process and keeps track of your progress. To create a new task, you need to create a JSON file with the following structure:

```json
{
  "taskName": "Your Task Name",
  "files": [
    "path/to/your/first_file.json",
    "path/to/your/second_file.json"
  ],
  "progress": {
    "fileIndex": 0,
    "itemIndex": 0
  }
}
```

### Key Explanations

*   `taskName` (String): A descriptive name for your task. This is currently not displayed in the UI but is good for identifying the file's purpose.
*   `files` (Array of Strings): An ordered list of file paths to the JSON files you want to edit. The paths should be relative to the application's root directory. The tool will process the files in the order they appear in this array.
*   `progress` (Object): This object stores the current position of the user in the task.
    *   `fileIndex` (Number): The index of the file currently being processed from the `files` array. `0` is the first file.
    *   `itemIndex` (Number): The index of the item (or object) currently being processed within the current file. `0` is the first item in that file.

The tool automatically updates the `fileIndex` and `itemIndex` in this file as you click the "Next" button, so you can close the tool and resume your work later.

## Example: Spell Item Type Tagging Task

The task file used for tagging item types on spells (`spell-item-types-task.json`) looks like this. You can use it as a template for creating your own tasks.

```json
{
  "taskName": "Spell Item Type Tagging",
  "files": [
    "randomtables/spells/lvl0.json",
    "randomtables/spells/lvl1.json",
    "randomtables/spells/lvl2.json",
    "randomtables/spells/lvl3.json",
    "randomtables/spells/lvl4.json",
    "randomtables/spells/lvl5.json",
    "randomtables/spells/lvl6.json",
    "randomtables/spells/lvl7.json",
    "randomtables/spells/lvl8.json",
    "randomtables/spells/lvl9.json"
  ],
  "progress": {
    "fileIndex": 0,
    "itemIndex": 0
  }
}
```

To create a new task, simply copy this structure, change the `taskName`, and replace the contents of the `files` array with the paths to your target JSON files.
