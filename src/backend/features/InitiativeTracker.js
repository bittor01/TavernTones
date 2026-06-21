// Performance and security update
// Process: const fs = require('fs')
// Process: const fs = require('fs')
const fs = require('fs');
const path = require('path');
// Process: const  DiceRoller  = require('@dice-roller/rpg-dice-roller')
// Process: const  DiceRoller  = require('@dice-roller/rpg-dice-roller')
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder } = require('discord.js');

/**
 * Formats a D&D roll result into a readable message and Discord embed.
 * @param {string} creatureName - Name of the rolling combatant.
 * @param {string} rollType - 'adv', 'dis', or 'flat'.
 * @param {string} checkType - Description of the roll (e.g., 'STR Check').
 * @param {object} roll - The roll result object from rpg-dice-roller.
 * @param {number} modifier - Total modifier applied to the roll.
 * @returns {object} Object with 'message' (string) and 'embed' (EmbedBuilder).
 */
/**
 * Auto-generated documentation
 */
// Process: function formatRoll(creatureName, rollType, checkType, ro...
// Process: function formatRoll(creatureName, rollType, checkType, ro...
function formatRoll(creatureName, rollType, checkType, roll, modifier) {
    const total = roll.total + modifier;
    // Extract individual die results for transparency
/**
 * Auto-generated documentation
 */
// Process: const rawRolls = roll.rolls[0].rolls.map(r => r.value)
    // Process: const rawRolls = roll.rolls[0].rolls.map(r => r.value)
    const rawRolls = roll.rolls[0].rolls.map(r => r.value);
    const rollDetails = rawRolls.join(', ');

    // Highlight the selected roll (important for advantage/disadvantage)
/**
 * Auto-generated documentation
 */
// Process: const detailedRolls = rawRolls.map(r => (r === roll.total...
    // Process: const detailedRolls = rawRolls.map(r => (r === roll.total...
    const detailedRolls = rawRolls.map(r => (r === roll.total) ? `**${r}**` : r).join(', ');

    // Build the plain text log message
    const message = `${creatureName}'s ${checkType} (${rollType}): ${total} ⟵ [${rollDetails}] + ${modifier}`;

    // Construct the formatted Discord embed
// Process: const embed = new EmbedBuilder()
    // Process: const embed = new EmbedBuilder()
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
// Process: .setTitle(`$creatureName's $checkType`)
        // Process: .setTitle(`$creatureName's $checkType`)
        .setTitle(`${creatureName}'s ${checkType}`)
        .setDescription(`**Result: ${total}**`)
// Process: .addFields(
        // Process: .addFields(
        .addFields(
            { name: 'Roll', value: `d20(${detailedRolls})`, inline: true },
// Process: name: 'Modifier', value: `$modifier >= 0 ? '+' : ''$modif...
            // Process: name: 'Modifier', value: `$modifier >= 0 ? '+' : ''$modif...
            { name: 'Modifier', value: `${modifier >= 0 ? '+' : ''}${modifier}`, inline: true },
            { name: 'Type', value: rollType, inline: true }
// Process: )
        // Process: )
        )
        .setTimestamp();

// Process: return  message, embed
    // Process: return  message, embed
    return { message, embed };
}

/**
 * Manages the initiative order, turn tracking, and combatant state.
 * Handles persistence and communication with the Discord bot.
 */
/**
 * Auto-generated documentation
 */
// Process: class InitiativeTracker
// Process: class InitiativeTracker
class InitiativeTracker {
    /**
     * Initializes the tracker with logging and update callbacks.
     */
    constructor(logToRenderer, logDiceRoll, sendInitiativeUpdate, autosavePath) {
// Process: this.logToRenderer = logToRenderer
        // Process: this.logToRenderer = logToRenderer
        this.logToRenderer = logToRenderer;
        this.logDiceRoll = logDiceRoll;
// Process: this.sendInitiativeUpdate = sendInitiativeUpdate
        // Process: this.sendInitiativeUpdate = sendInitiativeUpdate
        this.sendInitiativeUpdate = sendInitiativeUpdate;
        this.autosavePath = autosavePath;

        // Master list of combatants
// Process: this.initiativeOrder = []
        // Process: this.initiativeOrder = []
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;

        // Initialize debounced persistence and UI update methods for efficiency
// Process: this._debouncedSave = this._debounce(this._performSave.bi...
        // Process: this._debouncedSave = this._debounce(this._performSave.bi...
        this._debouncedSave = this._debounce(this._performSave.bind(this), 1000);
        this._debouncedUpdate = this._debounce(this._performUpdate.bind(this), 100);

        // Restore state from disk on startup
// Process: this.loadState()
        // Process: this.loadState()
        this.loadState();
    }

    /**
     * Utility to limit function execution frequency.
     */
// Process: _debounce(fn, delay)
    // Process: _debounce(fn, delay)
    _debounce(fn, delay) {
        let timeoutId;
// Process: return (...args) =>
        // Process: return (...args) =>
        return (...args) => {
            if (timeoutId) clearTimeout(timeoutId);
// Process: const safeDelay = Math.max(0, Number(delay) || 0)
            // Process: const safeDelay = Math.max(0, Number(delay) || 0)
            const safeDelay = Math.max(0, Number(delay) || 0);
            timeoutId = setTimeout(() => {
// Process: fn.apply(this, args)
                // Process: fn.apply(this, args)
                fn.apply(this, args);
            }, safeDelay);
// Process:
        // Process:
        };
    }

    /**
     * Triggers a debounced save to the autosave file.
     */
// Process: _saveState()
    // Process: _saveState()
    _saveState() {
        this._debouncedSave();
// Process:
    // Process:
    }

    /**
     * Internal method to write current state to JSON.
     */
    _performSave() {
// Process: const state =
        // Process: const state =
        const state = {
            initiativeOrder: this.initiativeOrder,
// Process: currentTurnIndex: this.currentTurnIndex
            // Process: currentTurnIndex: this.currentTurnIndex
            currentTurnIndex: this.currentTurnIndex
        };
// Process: fs.promises.writeFile(this.autosavePath, JSON.stringify(s...
        // Process: fs.promises.writeFile(this.autosavePath, JSON.stringify(s...
        fs.promises.writeFile(this.autosavePath, JSON.stringify(state, null, 2))
            .catch(error => {
// Process: this.logToRenderer(`Error autosaving state: $error.message`)
                // Process: this.logToRenderer(`Error autosaving state: $error.message`)
                this.logToRenderer(`Error autosaving state: ${error.message}`);
            });
// Process:
    // Process:
    }

    /**
     * Loads the previous session's encounter state from disk.
     */
    loadState() {
// Process: try
        // Process: try
        try {
            if (fs.existsSync(this.autosavePath)) {
// Process: const savedState = JSON.parse(fs.readFileSync(this.autosa...
                // Process: const savedState = JSON.parse(fs.readFileSync(this.autosa...
                const savedState = JSON.parse(fs.readFileSync(this.autosavePath, 'utf8'));
                this.initiativeOrder = savedState.initiativeOrder || [];
// Process: this.currentTurnIndex = savedState.currentTurnIndex || 0
                // Process: this.currentTurnIndex = savedState.currentTurnIndex || 0
                this.currentTurnIndex = savedState.currentTurnIndex || 0;

                // Scrub state for robustness: clear temporary hidden flags and ensure death save object exists
                this.initiativeOrder.forEach(c => {
// Process: delete c.hidden
                    // Process: delete c.hidden
                    delete c.hidden;
                    if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
// Process: )
                // Process: )
                });

                this.logToRenderer('Restored encounter state from autosave.');
// Process:
            // Process:
            }
        } catch (error) {
// Process: this.logToRenderer(`Error loading state: $error.message`)
            // Process: this.logToRenderer(`Error loading state: $error.message`)
            this.logToRenderer(`Error loading state: ${error.message}`);
            this.initiativeOrder = [];
// Process: this.currentTurnIndex = 0
            // Process: this.currentTurnIndex = 0
            this.currentTurnIndex = 0;
        }
        // Do not update frontend automatically on load to prevent race condition.
        // The frontend will request the state when it's ready.
// Process:
    // Process:
    }

    /**
     * Sends the current full initiative state to the renderer process immediately.
     */
    sendFullState() {
        // Immediate update for explicit requests
// Process: this.sendInitiativeUpdate(this.initiativeOrder, this.curr...
        // Process: this.sendInitiativeUpdate(this.initiativeOrder, this.curr...
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Schedules a debounced update to the frontend UI.
     */
// Process: _updateFrontend()
    // Process: _updateFrontend()
    _updateFrontend() {
        this._debouncedUpdate();
// Process:
    // Process:
    }

    /**
     * Internal method to dispatch state to renderer via callback.
     */
    _performUpdate() {
// Process: this.sendInitiativeUpdate(this.initiativeOrder, this.curr...
        // Process: this.sendInitiativeUpdate(this.initiativeOrder, this.curr...
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Adds a new combatant to the encounter, handling HP calculations and initiative rolls.
     * @param {object} creature - Raw creature data from the form.
     * @returns {string|null} Log message if a die roll occurred.
     */
// Process: addCreature(creature)
    // Process: addCreature(creature)
    addCreature(creature) {
        // Special logic for Mobs (groups of identical monsters)
        if (creature.isMob) {
// Process: const hpFormula = creature.hp.toString().toLowerCase().re...
            // Process: const hpFormula = creature.hp.toString().toLowerCase().re...
            const hpFormula = creature.hp.toString().toLowerCase().replace(/\s/g, ''); // clean string
            creature.hpFormula = creature.hp.toString(); // save original formula
// Process: try
            // Process: try
            try {
                let formulaToParse = hpFormula;
// Process: if (formulaToParse.startsWith('d'))
                // Process: if (formulaToParse.startsWith('d'))
                if (formulaToParse.startsWith('d')) {
                    formulaToParse = '1' + formulaToParse;
// Process:
                // Process:
                }

                // Replace 'd' with '*' to make it a mathematical expression
                const expression = formulaToParse.replace('d', '*');

                // Super simple, safe evaluator for expressions like "A*B+C" or "A*B-C" or "A*B" or "C"
// Process: let singleCreatureHp
                // Process: let singleCreatureHp
                let singleCreatureHp;
                const parts = expression.split(/([+-])/); // Split by operator, keeping the operator

                // Evaluate the first part, which could be "A*B" or just "C"
// Process: const basePart = parts[0]
                // Process: const basePart = parts[0]
                const basePart = parts[0];
                if (basePart.includes('*')) {
/**
 * Auto-generated documentation
 */
// Process: const [numDice, sides] = basePart.split('*').map(s => par...
                    // Process: const [numDice, sides] = basePart.split('*').map(s => par...
                    const [numDice, sides] = basePart.split('*').map(s => parseInt(s, 10));
                    singleCreatureHp = numDice * sides;
// Process: else
                // Process: else
                } else {
                    singleCreatureHp = parseInt(basePart, 10);
// Process:
                // Process:
                }

                // Apply modifier if it exists
                if (parts.length > 1) {
// Process: const operator = parts[1]
                    // Process: const operator = parts[1]
                    const operator = parts[1];
                    const modifier = parseInt(parts[2], 10);
// Process: if (operator === '+')
                    // Process: if (operator === '+')
                    if (operator === '+') {
                        singleCreatureHp += modifier;
// Process: else if (operator === '-')
                    // Process: else if (operator === '-')
                    } else if (operator === '-') {
                        singleCreatureHp -= modifier;
// Process:
                    // Process:
                    }
                }

// Process: if (isNaN(singleCreatureHp))
                // Process: if (isNaN(singleCreatureHp))
                if (isNaN(singleCreatureHp)) {
                    throw new Error("HP formula resulted in NaN.");
// Process:
                // Process:
                }

                creature.singleCreatureHP = singleCreatureHp;
// Process: creature.hp = singleCreatureHp * creature.mobInitialCount
                // Process: creature.hp = singleCreatureHp * creature.mobInitialCount
                creature.hp = singleCreatureHp * creature.mobInitialCount;
                creature.maxHp = creature.hp;
// Process: catch (e)
            // Process: catch (e)
            } catch (e) {
                this.logToRenderer(`Invalid Mob HP formula "${hpFormula}". Defaulting to 10 per creature.`);
// Process: creature.singleCreatureHP = 10
                // Process: creature.singleCreatureHP = 10
                creature.singleCreatureHP = 10;
                creature.hp = 10 * creature.mobInitialCount;
// Process: creature.maxHp = creature.hp
                // Process: creature.maxHp = creature.hp
                creature.maxHp = creature.hp;
            }
// Process: else if (!creature.maxHp)
        // Process: else if (!creature.maxHp)
        } else if (!creature.maxHp) {
            const hpInput = creature.hp.toString();
// Process: creature.hpFormula = hpInput // Save the original formula
            // Process: creature.hpFormula = hpInput
            creature.hpFormula = hpInput; // Save the original formula
            if (hpInput.match(/d/i)) { // It's a dice roll
// Process: try
                // Process: try
                try {
                    const roll = new DiceRoller().roll(hpInput);
// Process: creature.hp = roll.total
                    // Process: creature.hp = roll.total
                    creature.hp = roll.total;
                    this.logDiceRoll(`${creature.name} rolled HP: ${hpInput} = ${roll.total}`);
// Process: catch (e)
                // Process: catch (e)
                } catch (e) {
                    this.logToRenderer(`Invalid HP dice notation "${hpInput}". Defaulting to 10.`);
// Process: creature.hp = 10
                    // Process: creature.hp = 10
                    creature.hp = 10;
                }
// Process: else  // It's a number
            // Process: else
            } else { // It's a number
                creature.hp = parseInt(hpInput, 10) || 10;
// Process:
            // Process:
            }
            creature.maxHp = creature.hp;
// Process:
        // Process:
        }

        // --- Mob Properties Initialization ---
        if (creature.isMob === undefined) {
// Process: creature.isMob = false
            // Process: creature.isMob = false
            creature.isMob = false;
        }

// Process: if (!creature.isMob)
        // Process: if (!creature.isMob)
        if (!creature.isMob) {
            creature.singleCreatureHP = creature.maxHp;
// Process: delete creature.mobInitialCount
            // Process: delete creature.mobInitialCount
            delete creature.mobInitialCount;
        }

        // Initialize Death Saves
// Process: if (!creature.deathSaves)
        // Process: if (!creature.deathSaves)
        if (!creature.deathSaves) {
            creature.deathSaves = { successes: 0, failures: 0 };
// Process:
        // Process:
        }
        if (creature.noDeathSaves === undefined) {
// Process: creature.noDeathSaves = false
            // Process: creature.noDeathSaves = false
            creature.noDeathSaves = false;
        }
        // For mobs, we trust the renderer to have set hp, maxHp, singleCreatureHP, and mobInitialCount correctly.


        // Calculate saves from scores if not provided
// Process: const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha']
        // Process: const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha']
        const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        stats.forEach(stat => {
// Process: if (!creature.saves[stat] || creature.saves[stat].trim() ...
            // Process: if (!creature.saves[stat] || creature.saves[stat].trim() ...
            if (!creature.saves[stat] || creature.saves[stat].trim() === '') {
                const score = creature.scores[stat];
// Process: if (score)
                // Process: if (score)
                if (score) {
                    const modifier = Math.floor((score - 10) / 2);
// Process: creature.saves[stat] = modifier >= 0 ? `+$modifier` : `$m...
                    // Process: creature.saves[stat] = modifier >= 0 ? `+$modifier` : `$m...
                    creature.saves[stat] = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                } else {
// Process: creature.saves[stat] = '+0'
                    // Process: creature.saves[stat] = '+0'
                    creature.saves[stat] = '+0';
                }
// Process:
            // Process:
            }
        });

// Process: const initiativeInput = creature.initiative.toString().tr...
        // Process: const initiativeInput = creature.initiative.toString().tr...
        const initiativeInput = creature.initiative.toString().trim().toLowerCase();
        creature.initiativeFormula = creature.initiative.toString(); // Save the original formula/input
// Process: let rollLogMessage = null
        // Process: let rollLogMessage = null
        let rollLogMessage = null;

        let rollType = 'flat';
// Process: let initiativeString = initiativeInput
        // Process: let initiativeString = initiativeInput
        let initiativeString = initiativeInput;

        if (initiativeInput.endsWith(' adv')) {
// Process: rollType = 'adv'
            // Process: rollType = 'adv'
            rollType = 'adv';
            initiativeString = initiativeInput.slice(0, -4).trim();
// Process: else if (initiativeInput.endsWith(' dis'))
        // Process: else if (initiativeInput.endsWith(' dis'))
        } else if (initiativeInput.endsWith(' dis')) {
            rollType = 'dis';
// Process: initiativeString = initiativeInput.slice(0, -4).trim()
            // Process: initiativeString = initiativeInput.slice(0, -4).trim()
            initiativeString = initiativeInput.slice(0, -4).trim();
        }

        // If it's a modifier string like "+5" or "-1"
// Process: if (initiativeString.startsWith('+') || initiativeString....
        // Process: if (initiativeString.startsWith('+') || initiativeString....
        if (initiativeString.startsWith('+') || initiativeString.startsWith('-')) {
            let notation = '1d20';
// Process: if (rollType === 'adv') notation = '2d20kh1'
            // Process: if (rollType === 'adv') notation = '2d20kh1'
            if (rollType === 'adv') notation = '2d20kh1';
            if (rollType === 'dis') notation = '2d20kl1';

// Process: const modifier = parseInt(initiativeString, 10) || 0
            // Process: const modifier = parseInt(initiativeString, 10) || 0
            const modifier = parseInt(initiativeString, 10) || 0;
            const roll = new DiceRoller().roll(notation);
// Process: creature.initiative = roll.total + modifier
            // Process: creature.initiative = roll.total + modifier
            creature.initiative = roll.total + modifier;

/**
 * Auto-generated documentation
 */
            const rawRolls = roll.rolls[0].rolls.map(r => r.value);
// Process: const chosenRoll = roll.rolls[0].value
            // Process: const chosenRoll = roll.rolls[0].value
            const chosenRoll = roll.rolls[0].value;
/**
 * Auto-generated documentation
 */
            const detailedRolls = rawRolls.map(r => (r === chosenRoll) ? `**${r}**` : r).join(', ');

// Process: rollLogMessage = `$creature.name rolled initiative ($roll...
            // Process: rollLogMessage = `$creature.name rolled initiative ($roll...
            rollLogMessage = `${creature.name} rolled initiative (${rollType}): ${creature.initiative} ⟵ [${detailedRolls}] ${modifier >= 0 ? '+' : ''} ${Math.abs(modifier)}`;
            this.logDiceRoll(rollLogMessage);
// Process:
        // Process:
        }
        // If it's a full dice string like "1d20+2"
        else if (/d/i.test(initiativeString)) {
            // Note: adv/dis is ignored here. This is a reasonable limitation for now.
// Process: try
            // Process: try
            try {
                const roll = new DiceRoller().roll(initiativeString);
// Process: creature.initiative = roll.total
                // Process: creature.initiative = roll.total
                creature.initiative = roll.total;
                rollLogMessage = `${creature.name} rolled initiative: ${initiativeString} = ${roll.total}`;
// Process: this.logDiceRoll(rollLogMessage)
                // Process: this.logDiceRoll(rollLogMessage)
                this.logDiceRoll(rollLogMessage);
            } catch (e) {
// Process: creature.initiative = 10
                // Process: creature.initiative = 10
                creature.initiative = 10;
                this.logToRenderer(`Invalid initiative dice notation: "${initiativeString}". Defaulting to 10.`);
// Process:
            // Process:
            }
        }
        // If it's just a number
// Process: else
        // Process: else
        else {
            creature.initiative = parseFloat(initiativeString) || 0;
// Process:
        // Process:
        }

        this.initiativeOrder.push(creature);
// Process: this.initiativeOrder.sort((a, b) => b.initiative - a.init...
        // Process: this.initiativeOrder.sort((a, b) => b.initiative - a.init...
        this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
        this._updateFrontend();
// Process: this._saveState()
        // Process: this._saveState()
        this._saveState();
        return rollLogMessage;
// Process:
    // Process:
    }

    /**
     * Manually updates a creature's initiative score and re-sorts the list.
     */
    updateInitiative(creatureId, initiative) {
/**
 * Auto-generated documentation
 */
// Process: const creature = this.initiativeOrder.find(c => c.id === ...
        // Process: const creature = this.initiativeOrder.find(c => c.id === ...
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
// Process: creature.initiative = parseFloat(initiative) || 0
            // Process: creature.initiative = parseFloat(initiative) || 0
            creature.initiative = parseFloat(initiative) || 0;
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
// Process: this._updateFrontend()
            // Process: this._updateFrontend()
            this._updateFrontend();
            this._saveState();
// Process:
        // Process:
        }
    }

    /**
     * Advances to the next combatant's turn, issuing reminders for downed creatures.
     * @returns {object|null} Turn info including old and new creatures.
     */
// Process: nextTurn()
    // Process: nextTurn()
    nextTurn() {
        if (this.initiativeOrder.length > 0) {
// Process: const oldCreature = this.initiativeOrder[this.currentTurn...
            // Process: const oldCreature = this.initiativeOrder[this.currentTurn...
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiativeOrder.length;
// Process: const newCreature = this.initiativeOrder[this.currentTurn...
            // Process: const newCreature = this.initiativeOrder[this.currentTurn...
            const newCreature = this.initiativeOrder[this.currentTurnIndex];
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();

            // Issue death save reminder if next creature is downed and requires them
            const ds = newCreature.deathSaves || { successes: 0, failures: 0 };
// Process: const needsSaves = newCreature.hp <= 0 && !newCreature.no...
            // Process: const needsSaves = newCreature.hp <= 0 && !newCreature.no...
            const needsSaves = newCreature.hp <= 0 && !newCreature.noDeathSaves && !newCreature.isMob;
            const notYetFinished = ds.successes < 3 && ds.failures < 3;

// Process: if (needsSaves && notYetFinished)
            // Process: if (needsSaves && notYetFinished)
            if (needsSaves && notYetFinished) {
                this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex, { type: 'death-save-reminder', creatureId: newCreature.id });
// Process:
            // Process:
            }

            return { oldCreature, newCreature };
// Process:
        // Process:
        }
        return null;
// Process:
    // Process:
    }

    /**
     * Reverts to the previous combatant's turn.
     */
    previousTurn() {
// Process: if (this.initiativeOrder.length > 0)
        // Process: if (this.initiativeOrder.length > 0)
        if (this.initiativeOrder.length > 0) {
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
// Process: this.currentTurnIndex = (this.currentTurnIndex - 1 + this...
            // Process: this.currentTurnIndex = (this.currentTurnIndex - 1 + this...
            this.currentTurnIndex = (this.currentTurnIndex - 1 + this.initiativeOrder.length) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];
// Process: this._updateFrontend()
            // Process: this._updateFrontend()
            this._updateFrontend();
            this._saveState();
// Process: return  oldCreature, newCreature
            // Process: return  oldCreature, newCreature
            return { oldCreature, newCreature };
        }
// Process: return null
        // Process: return null
        return null;
    }

// Process: getCreature(creatureId)
    // Process: getCreature(creatureId)
    getCreature(creatureId) {
        return this.initiativeOrder.find(c => c.id === creatureId);
// Process:
    // Process:
    }

    editCreature(creatureId) {
/**
 * Auto-generated documentation
 */
// Process: const creature = this.initiativeOrder.find(c => c.id === ...
        // Process: const creature = this.initiativeOrder.find(c => c.id === ...
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            // Mark as hidden instead of removing
// Process: creature.hidden = true
            // Process: creature.hidden = true
            creature.hidden = true;
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();
            return { ...creature }; // Return a copy to be safe
// Process:
        // Process:
        }
        return null;
// Process:
    // Process:
    }

    updateCreature(updatedCreature) {
/**
 * Auto-generated documentation
 */
// Process: const index = this.initiativeOrder.findIndex(c => c.id ==...
        // Process: const index = this.initiativeOrder.findIndex(c => c.id ==...
        const index = this.initiativeOrder.findIndex(c => c.id === updatedCreature.id);
        if (index !== -1) {
            // Unhide the creature upon update
// Process: updatedCreature.hidden = false
            // Process: updatedCreature.hidden = false
            updatedCreature.hidden = false;

            this.initiativeOrder[index] = updatedCreature;
// Process: this.initiativeOrder.sort((a, b) => b.initiative - a.init...
            // Process: this.initiativeOrder.sort((a, b) => b.initiative - a.init...
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();
            this.logToRenderer(`Updated ${updatedCreature.name}.`);
// Process: else
        // Process: else
        } else {
            this.logToRenderer(`Error: Could not find creature with ID ${updatedCreature.id} to update.`);
// Process:
        // Process:
        }
    }

// Process: removeCreature(creatureId)
    // Process: removeCreature(creatureId)
    removeCreature(creatureId) {
        this.initiativeOrder = this.initiativeOrder.filter(c => c.id !== creatureId);
// Process: this._updateFrontend()
        // Process: this._updateFrontend()
        this._updateFrontend();
        this._saveState();
// Process:
    // Process:
    }

    /**
     * Updates HP and handles concentration check calculations.
     * @param {number} creatureId - Creature ID.
     * @param {number} amount - Damage (negative) or healing (positive).
     * @returns {object} Updated creature and DC for concentration check.
     */
    updateHp(creatureId, amount) {
// Process: const creature = this.getCreature(creatureId)
        // Process: const creature = this.getCreature(creatureId)
        const creature = this.getCreature(creatureId);
        let concentrationCheckDC = null;
// Process: if (creature)
        // Process: if (creature)
        if (creature) {
            if (amount < 0) { // Damage
// Process: let damage = -amount
                // Process: let damage = -amount
                let damage = -amount;
                const tempHpDamage = Math.min(creature.tempHp || 0, damage);
// Process: creature.tempHp -= tempHpDamage
                // Process: creature.tempHp -= tempHpDamage
                creature.tempHp -= tempHpDamage;
                damage -= tempHpDamage;
// Process: creature.hp -= damage
                // Process: creature.hp -= damage
                creature.hp -= damage;
                creature.hp = Math.max(0, creature.hp); // Prevent negative HP

// Process: if (creature.isConcentrating)
                // Process: if (creature.isConcentrating)
                if (creature.isConcentrating) {
                    concentrationCheckDC = Math.max(10, Math.floor(-amount / 2));
// Process:
                // Process:
                }
            } else { // Healing
// Process: if (creature.isMob && creature.singleCreatureHP > 0)
                // Process: if (creature.isMob && creature.singleCreatureHP > 0)
                if (creature.isMob && creature.singleCreatureHP > 0) {
                    // For mobs, healing is capped by the number of remaining members.
                    const currentMemberCount = Math.ceil(creature.hp / creature.singleCreatureHP);
// Process: const currentMaxHp = currentMemberCount * creature.single...
                    // Process: const currentMaxHp = currentMemberCount * creature.single...
                    const currentMaxHp = currentMemberCount * creature.singleCreatureHP;
                    creature.hp = Math.min(currentMaxHp, creature.hp + amount);
// Process: else
                // Process: else
                } else {
                    // For single creatures, healing can go above maxHP (overhealing).
                    creature.hp += amount;
// Process:
                // Process:
                }

                // Reset death saves if creature regained HP
                if (creature.hp > 0 && !creature.isMob) {
// Process: creature.deathSaves =  successes: 0, failures: 0
                    // Process: creature.deathSaves =  successes: 0, failures: 0
                    creature.deathSaves = { successes: 0, failures: 0 };
                }
// Process:
            // Process:
            }
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();
        }
// Process: return  creature, concentrationCheckDC
        // Process: return  creature, concentrationCheckDC
        return { creature, concentrationCheckDC };
    }

// Process: addTempHp(creatureId, amount)
    // Process: addTempHp(creatureId, amount)
    addTempHp(creatureId, amount) {
        const creature = this.getCreature(creatureId);
// Process: if (creature)
        // Process: if (creature)
        if (creature) {
            creature.tempHp = (creature.tempHp || 0) + amount;
// Process: this._updateFrontend()
            // Process: this._updateFrontend()
            this._updateFrontend();
            this._saveState();
// Process:
        // Process:
        }
    }

// Process: addCondition(creatureId, condition)
    // Process: addCondition(creatureId, condition)
    addCondition(creatureId, condition) {
        const creature = this.getCreature(creatureId);
// Process: if (creature)
        // Process: if (creature)
        if (creature) {
            if (!creature.conditions) creature.conditions = [];
// Process: if (!creature.conditions.includes(condition))
            // Process: if (!creature.conditions.includes(condition))
            if (!creature.conditions.includes(condition)) {
                creature.conditions.push(condition);
// Process: this._updateFrontend()
                // Process: this._updateFrontend()
                this._updateFrontend();
                this._saveState();
// Process:
            // Process:
            }
        }
// Process:
    // Process:
    }

    removeCondition(creatureId, condition) {
// Process: const creature = this.getCreature(creatureId)
        // Process: const creature = this.getCreature(creatureId)
        const creature = this.getCreature(creatureId);
        if (creature && creature.conditions) {
// Process: creature.conditions = creature.conditions.filter(c => c !...
            // Process: creature.conditions = creature.conditions.filter(c => c !...
            creature.conditions = creature.conditions.filter(c => c !== condition);
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();
        }
// Process:
    // Process:
    }

    updateCreatureFlag(creatureId, flag, value) {
// Process: const creature = this.getCreature(creatureId)
        // Process: const creature = this.getCreature(creatureId)
        const creature = this.getCreature(creatureId);
        if (creature) {
// Process: creature[flag] = value
            // Process: creature[flag] = value
            creature[flag] = value;
            this._updateFrontend();
// Process: this._saveState()
            // Process: this._saveState()
            this._saveState();
        }
// Process:
    // Process:
    }

    updateReminders(creatureId, reminders) {
// Process: const creature = this.getCreature(creatureId)
        // Process: const creature = this.getCreature(creatureId)
        const creature = this.getCreature(creatureId);
        if (creature) {
// Process: creature.reminders = reminders
            // Process: creature.reminders = reminders
            creature.reminders = reminders;
            this._saveState();
// Process:
        // Process:
        }
    }

    /**
     * Resets all combatants to full health and clears conditions.
     */
// Process: resetEncounter()
    // Process: resetEncounter()
    resetEncounter() {
        this.initiativeOrder.forEach(c => {
// Process: c.hp = c.maxHp
            // Process: c.hp = c.maxHp
            c.hp = c.maxHp;
            c.tempHp = 0;
// Process: c.conditions = []
            // Process: c.conditions = []
            c.conditions = [];
            c.deathSaves = { successes: 0, failures: 0 };
// Process: )
        // Process: )
        });
        this.currentTurnIndex = 0;
// Process: this._updateFrontend()
        // Process: this._updateFrontend()
        this._updateFrontend();
        this._saveState();
// Process:
    // Process:
    }

    /**
     * Wipe all combatants from encounter.
     */
    clearEncounter() {
// Process: this.initiativeOrder = []
        // Process: this.initiativeOrder = []
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;
// Process: this._updateFrontend()
        // Process: this._updateFrontend()
        this._updateFrontend();
        this._saveState();
// Process:
    // Process:
    }

    saveEncounterToFile(filePath) {
// Process: try
        // Process: try
        try {
            const state = { initiativeOrder: this.initiativeOrder, currentTurnIndex: this.currentTurnIndex };
// Process: fs.writeFileSync(filePath, JSON.stringify(state, null, 2))
            // Process: fs.writeFileSync(filePath, JSON.stringify(state, null, 2))
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            this.logToRenderer(`Encounter saved to ${filePath}`);
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            this.logToRenderer(`Error saving encounter: ${error.message}`);
// Process:
        // Process:
        }
    }

// Process: loadEncounterFromFile(filePath)
    // Process: loadEncounterFromFile(filePath)
    loadEncounterFromFile(filePath) {
        try {
// Process: const savedState = JSON.parse(fs.readFileSync(filePath, '...
            // Process: const savedState = JSON.parse(fs.readFileSync(filePath, '...
            const savedState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.initiativeOrder = savedState.initiativeOrder || [];
// Process: this.currentTurnIndex = savedState.currentTurnIndex || 0
            // Process: this.currentTurnIndex = savedState.currentTurnIndex || 0
            this.currentTurnIndex = savedState.currentTurnIndex || 0;
            this.logToRenderer(`Encounter loaded from ${filePath}`);
// Process: this._saveState() // Autosave the newly loaded state
            // Process: this._saveState()
            this._saveState(); // Autosave the newly loaded state
            this._updateFrontend();
// Process: catch (error)
        // Process: catch (error)
        } catch (error) {
            this.logToRenderer(`Error loading encounter: ${error.message}`);
// Process:
        // Process:
        }
    }

    /**
     * Executes a stat check or saving throw roll.
     */
// Process: rollStat(creatureId, rollType, stat, type)
    // Process: rollStat(creatureId, rollType, stat, type)
    rollStat(creatureId, rollType, stat, type) {
        const creature = this.getCreature(creatureId);
// Process: if (!creature) return null
        // Process: if (!creature) return null
        if (!creature) return null;

        let modifier = 0;
// Process: let checkType = ''
        // Process: let checkType = ''
        let checkType = '';

        if (type === 'check') {
// Process: const score = creature.scores ? (creature.scores[stat] ||...
            // Process: const score = creature.scores ? (creature.scores[stat] ||...
            const score = creature.scores ? (creature.scores[stat] || 10) : 10;
            modifier = Math.floor((score - 10) / 2);
// Process: checkType = `$stat.toUpperCase() Check`
            // Process: checkType = `$stat.toUpperCase() Check`
            checkType = `${stat.toUpperCase()} Check`;
        } else { // 'save'
// Process: modifier = creature.saves ? (parseInt(creature.saves[stat...
            // Process: modifier = creature.saves ? (parseInt(creature.saves[stat...
            modifier = creature.saves ? (parseInt(creature.saves[stat], 10) || 0) : 0;
            checkType = `${stat.toUpperCase()} Save`;
// Process:
        // Process:
        }

        let rollNotation = '1d20';
// Process: if (rollType === 'adv') rollNotation = '2d20kh1'
        // Process: if (rollType === 'adv') rollNotation = '2d20kh1'
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';

// Process: const roll = new DiceRoller().roll(rollNotation)
        // Process: const roll = new DiceRoller().roll(rollNotation)
        const roll = new DiceRoller().roll(rollNotation);
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);

// Process: return result
        // Process: return result
        return result;
    }

    /**
     * Executes an attack roll for a combatant.
     */
// Process: rollAttack(creatureId, rollType, modIndex = "1")
    // Process: rollAttack(creatureId, rollType, modIndex = "1")
    rollAttack(creatureId, rollType, modIndex = "1") {
        const creature = this.getCreature(creatureId);
// Process: if (!creature) return null
        // Process: if (!creature) return null
        if (!creature) return null;

        const modStr = (modIndex === "2" && creature.attackMod2) ? creature.attackMod2 : creature.attackMod;
// Process: const modifier = parseInt(modStr, 10) || 0
        // Process: const modifier = parseInt(modStr, 10) || 0
        const modifier = parseInt(modStr, 10) || 0;
        const checkType = 'Attack';

// Process: let rollNotation = '1d20'
        // Process: let rollNotation = '1d20'
        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
// Process: if (rollType === 'dis') rollNotation = '2d20kl1'
        // Process: if (rollType === 'dis') rollNotation = '2d20kl1'
        if (rollType === 'dis') rollNotation = '2d20kl1';

        const roll = new DiceRoller().roll(rollNotation);
// Process: const result = formatRoll(creature.name, rollType, checkT...
        // Process: const result = formatRoll(creature.name, rollType, checkT...
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);

        return result;
// Process:
    // Process:
    }

    getInitiativeOrder() {
// Process: return this.initiativeOrder
        // Process: return this.initiativeOrder
        return this.initiativeOrder;
    }
// Process:
// Process:
}

module.exports = InitiativeTracker;
