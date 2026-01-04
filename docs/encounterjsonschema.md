# TavernTones Encounter JSON Schema

This document describes the JSON structure expected by TavernTones for importing and loading encounters. External tools should follow this schema to ensure compatibility.

## Root Object

The root of the JSON file represents the entire encounter state.

```json
{
  "initiativeOrder": [ ... ],
  "currentTurnIndex": 0
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `initiativeOrder` | Array\<Object> | Yes | An array of **Creature** objects representing the combatants. |
| `currentTurnIndex` | Integer | No | The index of the creature currently taking its turn. Defaults to `0` if omitted. |

---

## Creature Object

Each item in the `initiativeOrder` array must be a creature object with the following properties.

### Core Properties

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | Number | Yes | A unique identifier (usually a timestamp, e.g., `1704326400000`). TavernTones uses this to track entities. |
| `name` | String | Yes | The display name of the combatant. |
| `initiative` | Number | No | The *current* rolled initiative value. Sort order is determined by this. |
| `initiativeFormula` | String | No | The dice formula used to roll initiative (e.g., `1d20+3`). Used for re-rolling or copying. |
| `hp` | Number | Yes | The *current* hit points of the creature. |
| `maxHp` | Number | Yes | The maximum hit points of the creature. |
| `hpFormula` | String | No | The dice formula for HP (e.g., `2d8+2`). Used for "Copy" operations to generate fresh HP. |
| `ac` | Number | No | Armor Class. |
| `speed` | String | No | Movement speed (e.g., `30ft`, `30ft, fly 60ft`). |

### Stats & Rolls

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `attackMod` | String/Number | No | The default modifier to use for "Attack" rolls (e.g., `+5`, `5`). |
| `saveDc` | Number | No | The primary Save DC for the creature's abilities. |
| `scores` | Object | No | Ability scores. Keys: `str`, `dex`, `con`, `int`, `wis`, `cha`. Values are Numbers (e.g., `16`). |
| `saves` | Object | No | Saving throw modifiers. Keys: `str`, `dex`, ... Values are Strings (e.g., `+5`). |

### State Flags & Meta

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `tempHp` | Number | No | Temporary hit points (default `0`). |
| `conditions` | Array\<String> | No | List of active condition names (e.g., `["Prone", "Poisoned"]`). Case-sensitive matching to internal dictionary. |
| `isConcentrating` | Boolean | No | Whether the creature is concentrating on a spell. |
| `isFriendly` | Boolean | No | Flags the creature as friendly/player (affects some reminders). |
| `reminders` | Object | No | Custom text reminders. Structure: `{ "start": "Text...", "end": "Text..." }`. |
| `rawData` | String | No | A JSON-stringified object containing the full 5eTools statblock data. Used for "Stat Block" display. |

### Mob Rules (Optional)

If the creature represents a Mob (a group of identical creatures acting as one), include these fields:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `isMob` | Boolean | Yes | Set to `true`. |
| `singleCreatureHP` | Number | Yes | The max HP of a *single* member of the mob. |
| `mobInitialCount` | Number | No | The initial number of creatures in the mob (informational). |

*Note: For mobs, `hp` and `maxHp` should represent the **total** HP of the entire mob (single HP * count).*

---

## Example JSON

```json
{
  "currentTurnIndex": 0,
  "initiativeOrder": [
    {
      "id": 1704326001000,
      "name": "Goblin Boss",
      "initiative": 15,
      "initiativeFormula": "1d20+2",
      "hp": 21,
      "maxHp": 21,
      "hpFormula": "6d6",
      "ac": 17,
      "speed": "30ft",
      "attackMod": "+4",
      "saveDc": 12,
      "scores": { "str": 10, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 10 },
      "saves": { "str": "+0", "dex": "+2", "con": "+0", "int": "+0", "wis": "-1", "cha": "+0" },
      "conditions": [],
      "reminders": {
        "start": "Regenerates 5 HP if not taken fire damage.",
        "end": ""
      }
    },
    {
      "id": 1704326002000,
      "name": "Goblin Minion",
      "initiative": 8,
      "initiativeFormula": "1d20+2",
      "hp": 7,
      "maxHp": 7,
      "hpFormula": "2d6",
      "ac": 15,
      "speed": "30ft",
      "scores": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 },
      "isFriendly": false
    }
  ]
}
```
