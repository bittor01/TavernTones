// Performance and security update
// Import filesystem module for state persistence
const fs = require('fs');
// Import path module for cross-platform file handling
const path = require('path');
// Import the RPG dice roller to handle monster HP rolls and stat checks
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
// Import EmbedBuilder for constructing Discord messages
const { EmbedBuilder } = require('discord.js');

/**
 * Utility to format a dice roll result into both a plain-text message and a Discord embed.
 * @param {string} creatureName - Name of the rolling creature.
 * @param {string} rollType - 'flat', 'adv', or 'dis'.
 * @param {string} checkType - e.g., 'STR Check', 'Attack'.
 * @param {object} roll - The roll result object from rpg-dice-roller.
 * @param {number} modifier - The numeric bonus added to the roll.
 */
function formatRoll(creatureName, rollType, checkType, roll, modifier) {
    // Calculate final total including modifiers
    const total = roll.total + modifier;
    // Map individual die results to an array of numbers
    const rawRolls = roll.rolls[0].rolls.map(r => r.value);
    // Join results with commas for the simple text log
    const rollDetails = rawRolls.join(', ');

    // Bold the chosen roll for advantage/disadvantage scenarios in the detailed breakdown
    const detailedRolls = rawRolls.map(r => (r === roll.total) ? `**${r}**` : r).join(', ');

    // Construct the plain text message for the local UI log
    const message = `${creatureName}'s ${checkType} (${rollType}): ${total} ⟵ [${rollDetails}] + ${modifier}`;

    // Build the rich embed for Discord
    const embed = new EmbedBuilder()
        .setColor(0x0099FF) // Blue theme
        .setTitle(`${creatureName}'s ${checkType}`)
        .setDescription(`**Result: ${total}**`)
        .addFields(
            { name: 'Roll', value: `d20(${detailedRolls})`, inline: true },
            { name: 'Modifier', value: `${modifier >= 0 ? '+' : ''}${modifier}`, inline: true },
            { name: 'Type', value: rollType, inline: true }
        )
        .setTimestamp();

    return { message, embed };
}

/**
 * InitiativeTracker manages the lifecycle of a combat encounter, including
 * turn order, health tracking, and dice rolling.
 */
class InitiativeTracker {
    /**
     * Initializes the tracker with logging hooks and persistence paths.
     */
    constructor(logToRenderer, logDiceRoll, sendInitiativeUpdate, autosavePath) {
        // Store callbacks for UI communication
        this.logToRenderer = logToRenderer;
        this.logDiceRoll = logDiceRoll;
        this.sendInitiativeUpdate = sendInitiativeUpdate;
        // Path where encounter state is periodically saved
        this.autosavePath = autosavePath;
        // Master list of creatures in combat
        this.initiativeOrder = [];
        // Tracks whose turn it is currently
        this.currentTurnIndex = 0;

        // Initialize debounced persistence to avoid thrashing the disk during rapid updates
        this._debouncedSave = this._debounce(this._performSave.bind(this), 1000);
        // Initialize debounced UI updates to maintain 60fps responsiveness
        this._debouncedUpdate = this._debounce(this._performUpdate.bind(this), 100);

        // Load existing session data if available
        this.loadState();
    }

    /**
     * Simple debounce wrapper to limit function execution frequency.
     */
    _debounce(fn, delay) {
        let timeoutId;
        return (...args) => {
            if (timeoutId) clearTimeout(timeoutId);
            const safeDelay = Math.max(0, Number(delay) || 0);
            timeoutId = setTimeout(() => {
                fn.apply(this, args);
            }, safeDelay);
        };
    }

    /**
     * Triggers a debounced save to the autosave file.
     */
    _saveState() {
        this._debouncedSave();
    }

    /**
     * Internal method that performs the actual filesystem write.
     */
    _performSave() {
        const state = {
            initiativeOrder: this.initiativeOrder,
            currentTurnIndex: this.currentTurnIndex
        };
        // Use promise-based write to avoid blocking the main thread
        fs.promises.writeFile(this.autosavePath, JSON.stringify(state, null, 2))
            .catch(error => {
                this.logToRenderer(`Error autosaving state: ${error.message}`);
            });
    }

    /**
     * Synchronously loads the encounter state from the autosave file on startup.
     */
    loadState() {
        try {
            if (fs.existsSync(this.autosavePath)) {
                // Read and parse the JSON file
                const savedState = JSON.parse(fs.readFileSync(this.autosavePath, 'utf8'));
                this.initiativeOrder = savedState.initiativeOrder || [];
                this.currentTurnIndex = savedState.currentTurnIndex || 0;

                // Data sanitization: ensure all creatures have required objects and flags
                this.initiativeOrder.forEach(c => {
                    // Reset 'hidden' flag which is used during active edits
                    delete c.hidden;
                    // Ensure death saves object exists for non-mob creatures
                    if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
                });

                this.logToRenderer('Autosaved encounter state loaded.');
            }
        } catch (error) {
            // Log and fallback to empty state if load fails
            this.logToRenderer(`Error loading state: ${error.message}`);
            this.initiativeOrder = [];
            this.currentTurnIndex = 0;
        }
    }

    /**
     * Forces an immediate full state update to the renderer.
     */
    sendFullState() {
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Triggers a debounced UI update.
     */
    _updateFrontend() {
        this._debouncedUpdate();
    }

    /**
     * Internal method that performs the actual IPC transmission to the UI.
     */
    _performUpdate() {
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Adds a new creature to the combat. Handles HP calculation and initiative rolls.
     * @param {object} creature - The creature data from the UI form.
     */
    addCreature(creature) {
        // --- Mob HP Calculation ---
        // Mobs use a special formula: (Single Creature HP * Count)
        if (creature.isMob) {
            // Sanitize the input formula string
            const hpFormula = creature.hp.toString().toLowerCase().replace(/\s/g, '');
            creature.hpFormula = creature.hp.toString(); // Keep original for display
            try {
                let formulaToParse = hpFormula;
                // Default to 1 die if only "d20" provided
                if (formulaToParse.startsWith('d')) {
                    formulaToParse = '1' + formulaToParse;
                }

                // Simple parser that converts "AdB+C" to math and evaluates it
                const expression = formulaToParse.replace('d', '*');
                let singleCreatureHp;
                // Split into the base roll and the flat modifier
                const parts = expression.split(/([+-])/);

                // Resolve the base roll (e.g. 2 * 8)
                const basePart = parts[0];
                if (basePart.includes('*')) {
                    const [numDice, sides] = basePart.split('*').map(s => parseInt(s, 10));
                    singleCreatureHp = numDice * sides;
                } else {
                    singleCreatureHp = parseInt(basePart, 10);
                }

                // Apply the flat modifier (e.g. +4)
                if (parts.length > 1) {
                    const operator = parts[1];
                    const modifier = parseInt(parts[2], 10);
                    if (operator === '+') {
                        singleCreatureHp += modifier;
                    } else if (operator === '-') {
                        singleCreatureHp -= modifier;
                    }
                }

                // Guard against bad math
                if (isNaN(singleCreatureHp)) {
                    throw new Error("HP formula resulted in NaN.");
                }

                // Set final calculated HP stats
                creature.singleCreatureHP = singleCreatureHp;
                creature.hp = singleCreatureHp * creature.mobInitialCount;
                creature.maxHp = creature.hp;
            } catch (e) {
                // Fallback to safe default if formula is invalid
                this.logToRenderer(`Invalid Mob HP formula "${hpFormula}". Defaulting to 10 per creature.`);
                creature.singleCreatureHP = 10;
                creature.hp = 10 * creature.mobInitialCount;
                creature.maxHp = creature.hp;
            }
        }
        // --- Standard Creature HP Calculation ---
        else if (!creature.maxHp) {
            const hpInput = creature.hp.toString();
            creature.hpFormula = hpInput;
            // If the HP input contains 'd', it's a dice roll (e.g. "2d8 + 4")
            if (hpInput.match(/d/i)) {
                try {
                    const roll = new DiceRoller().roll(hpInput);
                    creature.hp = roll.total;
                    this.logDiceRoll(`${creature.name} rolled HP: ${hpInput} = ${roll.total}`);
                } catch (e) {
                    this.logToRenderer(`Invalid HP dice notation "${hpInput}". Defaulting to 10.`);
                    creature.hp = 10;
                }
            } else {
                // Otherwise treat as a raw integer
                creature.hp = parseInt(hpInput, 10) || 10;
            }
            creature.maxHp = creature.hp;
        }

        // --- State Sanitization ---
        if (creature.isMob === undefined) {
            creature.isMob = false;
        }

        // Mobs don't use 'initial count' after initialization; they just use current vs single HP
        if (!creature.isMob) {
            creature.singleCreatureHP = creature.maxHp;
            delete creature.mobInitialCount;
        }

        // Initialize death saving throw state
        if (!creature.deathSaves) {
            creature.deathSaves = { successes: 0, failures: 0 };
        }
        if (creature.noDeathSaves === undefined) {
            creature.noDeathSaves = false;
        }

        // Calculate saving throw modifiers from ability scores if not explicitly provided
        const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        stats.forEach(stat => {
            if (!creature.saves[stat] || creature.saves[stat].trim() === '') {
                const score = creature.scores[stat];
                if (score) {
                    // Standard 5e modifier formula: (Score - 10) / 2 rounded down
                    const modifier = Math.floor((score - 10) / 2);
                    creature.saves[stat] = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                } else {
                    creature.saves[stat] = '+0';
                }
            }
        });

        // --- Initiative Roll Logic ---
        const initiativeInput = creature.initiative.toString().trim().toLowerCase();
        creature.initiativeFormula = creature.initiative.toString();
        let rollLogMessage = null;

        let rollType = 'flat';
        let initiativeString = initiativeInput;

        // Check for 'adv' or 'dis' keywords in the initiative string
        if (initiativeInput.endsWith(' adv')) {
            rollType = 'adv';
            initiativeString = initiativeInput.slice(0, -4).trim();
        } else if (initiativeInput.endsWith(' dis')) {
            rollType = 'dis';
            initiativeString = initiativeInput.slice(0, -4).trim();
        }

        // Scenario 1: Input is a modifier like "+5" or "-1"
        if (initiativeString.startsWith('+') || initiativeString.startsWith('-')) {
            let notation = '1d20';
            if (rollType === 'adv') notation = '2d20kh1';
            if (rollType === 'dis') notation = '2d20kl1';

            const modifier = parseInt(initiativeString, 10) || 0;
            const roll = new DiceRoller().roll(notation);
            creature.initiative = roll.total + modifier;

            // Prepare a detailed log entry with individual die results
            const rawRolls = roll.rolls[0].rolls.map(r => r.value);
            const chosenRoll = roll.rolls[0].value;
            const detailedRolls = rawRolls.map(r => (r === chosenRoll) ? `**${r}**` : r).join(', ');

            rollLogMessage = `${creature.name} rolled initiative (${rollType}): ${creature.initiative} ⟵ [${detailedRolls}] ${modifier >= 0 ? '+' : ''} ${Math.abs(modifier)}`;
            this.logDiceRoll(rollLogMessage);
        }
        // Scenario 2: Input is a full dice string like "1d20+2"
        else if (/d/i.test(initiativeString)) {
            try {
                const roll = new DiceRoller().roll(initiativeString);
                creature.initiative = roll.total;
                rollLogMessage = `${creature.name} rolled initiative: ${initiativeString} = ${roll.total}`;
                this.logDiceRoll(rollLogMessage);
            } catch (e) {
                creature.initiative = 10;
                this.logToRenderer(`Invalid initiative dice notation: "${initiativeString}". Defaulting to 10.`);
            }
        }
        // Scenario 3: Input is just a pre-rolled number
        else {
            creature.initiative = parseFloat(initiativeString) || 0;
        }

        // Add to list and sort by initiative (highest first)
        this.initiativeOrder.push(creature);
        this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);

        // Notify UI and persist
        this._updateFrontend();
        this._saveState();
        return rollLogMessage;
    }

    /**
     * Updates a creature's initiative score and re-sorts the list.
     */
    updateInitiative(creatureId, initiative) {
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.initiative = parseFloat(initiative) || 0;
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
            this._updateFrontend();
            this._saveState();
        }
    }

    /**
     * Advances the turn counter and returns turn transition data.
     * @returns {object|null} Transition info for reminders.
     */
    nextTurn() {
        if (this.initiativeOrder.length > 0) {
            // Identify who just finished and who is next
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];

            // Persist state
            this._updateFrontend();
            this._saveState();

            // Check if the new creature needs to make death saves (HP <= 0)
            const ds = newCreature.deathSaves || { successes: 0, failures: 0 };
            const needsSaves = newCreature.hp <= 0 && !newCreature.noDeathSaves && !newCreature.isMob;
            const notYetFinished = ds.successes < 3 && ds.failures < 3;

            // Trigger a reminder in the UI if death saves are required
            if (needsSaves && notYetFinished) {
                this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex, { type: 'death-save-reminder', creatureId: newCreature.id });
            }

            return { oldCreature, newCreature };
        }
        return null;
    }

    /**
     * Moves the turn counter back by one.
     */
    previousTurn() {
        if (this.initiativeOrder.length > 0) {
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            // Safe modulo subtraction
            this.currentTurnIndex = (this.currentTurnIndex - 1 + this.initiativeOrder.length) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];

            this._updateFrontend();
            this._saveState();
            return { oldCreature, newCreature };
        }
        return null;
    }

    /**
     * Returns a creature object by its unique ID.
     */
    getCreature(creatureId) {
        return this.initiativeOrder.find(c => c.id === creatureId);
    }

    /**
     * Marks a creature as hidden during an active edit to prevent UI flickering,
     * then returns a copy of the creature for the edit form.
     */
    editCreature(creatureId) {
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            // Flag as hidden in the dashboard while editing modal is open
            creature.hidden = true;
            this._updateFrontend();
            this._saveState();
            return { ...creature };
        }
        return null;
    }

    /**
     * Replaces an existing creature's data with updated values.
     */
    updateCreature(updatedCreature) {
        const index = this.initiativeOrder.findIndex(c => c.id === updatedCreature.id);
        if (index !== -1) {
            // Restore visibility
            updatedCreature.hidden = false;

            // Replace and re-sort in case initiative changed
            this.initiativeOrder[index] = updatedCreature;
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);

            this._updateFrontend();
            this._saveState();
            this.logToRenderer(`Updated ${updatedCreature.name}.`);
        } else {
            this.logToRenderer(`Error: Could not find creature with ID ${updatedCreature.id} to update.`);
        }
    }

    /**
     * Removes a creature from the encounter.
     */
    removeCreature(creatureId) {
        this.initiativeOrder = this.initiativeOrder.filter(c => c.id !== creatureId);
        this._updateFrontend();
        this._saveState();
    }

    /**
     * Adjusts current HP, handles temporary HP, and calculates concentration DCs.
     * @param {string} creatureId - Target ID.
     * @param {number} amount - Positive for healing, negative for damage.
     * @returns {object} { creature, concentrationCheckDC }
     */
    updateHp(creatureId, amount) {
        const creature = this.getCreature(creatureId);
        let concentrationCheckDC = null;
        if (creature) {
            // --- Damage Logic ---
            if (amount < 0) {
                let damage = -amount;
                // Consume temporary HP first
                const tempHpDamage = Math.min(creature.tempHp || 0, damage);
                creature.tempHp -= tempHpDamage;
                damage -= tempHpDamage;
                // Subtract remaining damage from actual HP
                creature.hp -= damage;
                // Minimum HP is 0
                creature.hp = Math.max(0, creature.hp);

                // If damage taken while concentrating, calculate the save DC
                if (creature.isConcentrating) {
                    // DC is 10 or half damage, whichever is higher
                    concentrationCheckDC = Math.max(10, Math.floor(-amount / 2));
                }
            }
            // --- Healing Logic ---
            else {
                if (creature.isMob && creature.singleCreatureHP > 0) {
                    // For mobs, healing cannot bring back already-dead members.
                    // Max HP for a mob is (living members * hp per member).
                    const currentMemberCount = Math.ceil(creature.hp / creature.singleCreatureHP);
                    const currentMaxHp = currentMemberCount * creature.singleCreatureHP;
                    creature.hp = Math.min(currentMaxHp, creature.hp + amount);
                } else {
                    // Single creatures can heal above their maxHP (overhealing allowed by TT)
                    creature.hp += amount;
                }

                // Auto-reset death saves if the creature is no longer at 0 HP
                if (creature.hp > 0 && !creature.isMob) {
                    creature.deathSaves = { successes: 0, failures: 0 };
                }
            }
            this._updateFrontend();
            this._saveState();
        }
        return { creature, concentrationCheckDC };
    }

    /**
     * Increases a creature's temporary hit points.
     */
    addTempHp(creatureId, amount) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            // Note: In standard 5e, temp HP doesn't stack, but TT allows it for flexibility.
            creature.tempHp = (creature.tempHp || 0) + amount;
            this._updateFrontend();
            this._saveState();
        }
    }

    /**
     * Adds a unique condition to a creature's list.
     */
    addCondition(creatureId, condition) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            if (!creature.conditions) creature.conditions = [];
            // Prevent duplicate conditions
            if (!creature.conditions.includes(condition)) {
                creature.conditions.push(condition);
                this._updateFrontend();
                this._saveState();
            }
        }
    }

    /**
     * Removes a condition from a creature.
     */
    removeCondition(creatureId, condition) {
        const creature = this.getCreature(creatureId);
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c !== condition);
            this._updateFrontend();
            this._saveState();
        }
    }

    /**
     * Sets a generic flag or value on a creature object.
     */
    updateCreatureFlag(creatureId, flag, value) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            creature[flag] = value;
            this._updateFrontend();
            this._saveState();
        }
    }

    /**
     * Updates the set of turn start/end reminders for a creature.
     */
    updateReminders(creatureId, reminders) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            creature.reminders = reminders;
            this._saveState();
        }
    }

    /**
     * Resets the entire encounter: restores health and clears conditions for all participants.
     */
    resetEncounter() {
        this.initiativeOrder.forEach(c => {
            c.hp = c.maxHp;
            c.tempHp = 0;
            c.conditions = [];
            c.deathSaves = { successes: 0, failures: 0 };
        });
        this.currentTurnIndex = 0;
        this._updateFrontend();
        this._saveState();
    }

    /**
     * Wipes the initiative list and resets the turn counter.
     */
    clearEncounter() {
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;
        this._updateFrontend();
        this._saveState();
    }

    /**
     * Saves the combat state to a specific JSON file path.
     */
    saveEncounterToFile(filePath) {
        try {
            const state = { initiativeOrder: this.initiativeOrder, currentTurnIndex: this.currentTurnIndex };
            // Use synchronous write for manual save-as requests
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            this.logToRenderer(`Encounter saved to ${filePath}`);
        } catch (error) {
            this.logToRenderer(`Error saving encounter: ${error.message}`);
        }
    }

    /**
     * Loads a combat state from a JSON file and refreshes the tracker.
     */
    loadEncounterFromFile(filePath) {
        try {
            const savedState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.initiativeOrder = savedState.initiativeOrder || [];
            this.currentTurnIndex = savedState.currentTurnIndex || 0;
            this.logToRenderer(`Encounter loaded from ${filePath}`);
            // Perform an immediate autosave to sync the session file
            this._saveState();
            this._updateFrontend();
        } catch (error) {
            this.logToRenderer(`Error loading encounter: ${error.message}`);
        }
    }

    /**
     * Executes a stat check or saving throw.
     * @param {string} creatureId - Target ID.
     * @param {string} rollType - 'flat', 'adv', or 'dis'.
     * @param {string} stat - The stat name (e.g. 'str').
     * @param {string} type - 'check' or 'save'.
     */
    rollStat(creatureId, rollType, stat, type) {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;

        let modifier = 0;
        let checkType = '';

        // Calculate modifier based on request type
        if (type === 'check') {
            const score = creature.scores ? (creature.scores[stat] || 10) : 10;
            modifier = Math.floor((score - 10) / 2);
            checkType = `${stat.toUpperCase()} Check`;
        } else { // 'save'
            modifier = creature.saves ? (parseInt(creature.saves[stat], 10) || 0) : 0;
            checkType = `${stat.toUpperCase()} Save`;
        }

        // Determine notation for the roller
        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';

        // Execute and format the roll
        const roll = new DiceRoller().roll(rollNotation);
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);

        return result;
    }

    /**
     * Executes an attack roll for a creature.
     * @param {string} creatureId - Target ID.
     * @param {string} rollType - 'flat', 'adv', or 'dis'.
     * @param {string} modIndex - "1" for primary bonus, "2" for secondary.
     */
    rollAttack(creatureId, rollType, modIndex = "1") {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;

        // Select the appropriate attack bonus
        const modStr = (modIndex === "2" && creature.attackMod2) ? creature.attackMod2 : creature.attackMod;
        const modifier = parseInt(modStr, 10) || 0;
        const checkType = 'Attack';

        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';

        // Execute and format
        const roll = new DiceRoller().roll(rollNotation);
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);

        return result;
    }

    /**
     * Simple getter for the initiative list.
     */
    getInitiativeOrder() {
        return this.initiativeOrder;
    }
}

// Export for use in main.js
module.exports = InitiativeTracker;
