# 5eTools Data Overview

This document provides an overview of the JSON data files located in the `reference/5etoolsdata/` directory. It describes the purpose of each major file and explores potential new features and tools that could be built using this data.

---

## Data File Descriptions

This section describes the content and structure of the key top-level JSON data files.

-   **`actions.json`**: Contains a list of generic actions available to players and creatures, such as "Dash", "Dodge", and "Help".
-   **`adventures.json`**: An index of all the official D&D 5e adventure modules. Each entry contains metadata about the adventure, including its name, source, and a brief description.
-   **`backgrounds.json`**: Lists all official character backgrounds, with details on skill proficiencies, languages, and equipment granted.
-   **`charcreationoptions.json`**: Provides data for various character creation options, such as starting equipment and class features.
-   **`conditionsdiseases.json`**: Details all standard conditions (e.g., "Blinded", "Prone") and various diseases, explaining their mechanical effects.
-   **`cultsboons.json`**: Describes various cults and supernatural boons that characters might encounter or receive, including their goals, secrets, and mechanical benefits.
-   **`feats.json`**: A list of all official feats, including their prerequisites and the benefits they provide.
-   **`items.json`**: A massive list of all non-magical and magical items. This file is already used by the `!item` command.
-   **`languages.json`**: Contains information on the various languages in the D&D universe, including which races typically speak them and what scripts they use.
-   **`loot.json`**: This file contains detailed tables for generating treasure. It includes tables for "Individual Treasure" and "Treasure Hoards" for every challenge rating tier, with dice formulas for coins, goods, and magic items.
-   **`magicvariants.json`**: Describes variants for magic items, such as a "+1" weapon or a "Shield of Missile Attraction".
-   **`rewards.json`**: Contains data on other forms of rewards, such as blessings, charms, and other supernatural gifts.
-   **`trapshazards.json`**: A collection of traps and environmental hazards. Each entry includes a detailed description, trigger mechanism, effects, and countermeasures, often including different versions for various party tiers.
-   **`vehicles.json`**: Lists various types of vehicles, from sailing ships to spelljamming vessels, including their stats, action options, and crew requirements.

---

## Potential New Features & Tool Ideas

This data provides a rich foundation for many new tools and bot commands.

### 1. Advanced Loot Generator (`!hoard` or `!loot`)

-   **Concept**: A command to generate a full treasure hoard based on a Challenge Rating.
-   **Data Used**: `loot.json`, `items.json`.
-   **Functionality**:
    -   User provides a CR (e.g., `!hoard 5` or `!hoard 11-16`).
    -   The bot rolls on the appropriate "Treasure Hoard" table from `loot.json`.
    -   It would roll for all coin types (CP, SP, EP, GP, PP).
    -   It would roll for the number and type of gems and art objects.
    -   Most importantly, it would roll on the magic item tables specified in the hoard data. It could then look up the rolled items in `items.json` and present them as a list, perhaps with links to their full descriptions.
-   **Example Command**: `!hoard 12` -> "Your treasure hoard contains: 5,000 GP, 12,000 SP, 3x 500gp Gems, 1x Potion of Superior Healing, 1x +2 Longsword, 1x Spellguard Shield".

### 2. Trap & Hazard Generator (`!trap` or `!hazard`)

-   **Concept**: A command to quickly generate a random trap or environmental hazard appropriate for the party's level.
-   **Data Used**: `trapshazards.json`.
-   **Functionality**:
    -   User provides a party tier (e.g., `!trap tier2` or `!trap level 8`).
    -   The bot filters `trapshazards.json` for traps that have a rating for that tier.
    -   It randomly selects a trap/hazard and displays its full description, trigger, effect, and countermeasures in a formatted embed.
-   **Example Command**: `!hazard tier3` -> Displays the full description for the "Path of Blades" trap, scaled for a tier 3 party.

### 3. Character Concept Generator (`!character-idea`)

-   **Concept**: A tool to help players break writer's block by generating a random character concept.
-   **Data Used**: `races.json`, `backgrounds.json`, `class/*.json`.
-   **Functionality**:
    -   The bot randomly selects a race from `races.json`, a class from the `class` directory, and a background from `backgrounds.json`.
    -   It could present this as a simple "You are a [Dragonborn] [Paladin] who used to be a [Sailor]."
    -   **Advanced Version**: It could pull the "suggested characteristics" (traits, ideals, bonds, flaws) from the chosen background and present a set of those as well.

### 4. NPC Generator (`!npc`)

-   **Concept**: Similar to the character concept generator, but for creating quick Non-Player Characters for the DM.
-   **Data Used**: `races.json`, `backgrounds.json`, `bestiary/*.json` (for humanoid stat blocks).
-   **Functionality**:
    -   Randomly selects a race and background.
    -   Randomly selects a low-CR humanoid stat block (e.g., "Guard", "Commoner", "Acolyte", "Thug").
    -   Presents the combination: "You meet **Elara**, a **Half-Elf Spy** who was once an **Acolyte**. She has the following personality trait: ...".

### 5. Adventure Hook Generator (`!adventure-hook`)

-   **Concept**: A tool to generate plot hooks and adventure ideas by combining different data sources.
-   **Data Used**: `adventures.json`, `cultsboons.json`, `deities.json`, `bestiary/*.json`.
-   **Functionality**:
    -   The bot could combine elements in a Mad Libs style.
    -   It could pick a villain (a creature from `bestiary`), a location (from an adventure in `adventures.json`), and a motive (related to a cult from `cultsboons.json` or a deity from `deities.json`).
-   **Example Output**: "The **Cult of the Dragon** is trying to resurrect an **Adult Blue Dragon** in the ruins of **Thundertree** (from Lost Mine of Phandelver). The party must stop them before they complete the ritual."

### 6. Vehicle Encounter Generator (`!ship-battle`)

-   **Concept**: Generate a random enemy ship or fleet for naval or spelljamming combat.
-   **Data Used**: `vehicles.json`, `bestiary/*.json`.
-   **Functionality**:
    -   User specifies a type of vehicle (e.g., `!ship-battle galleon` or `!ship-battle spelljammer`).
    -   The bot selects a matching vehicle from `vehicles.json`.
    -   It then populates the crew by selecting appropriate humanoid creatures from the `bestiary` files (e.g., "Bandit Captain", "Githyanki Warrior", "Pirate Deck Wizard").
    -   It presents the enemy ship's stat block along with its crew roster.
