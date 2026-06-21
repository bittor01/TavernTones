// Performance and security update
const fs = require('fs');
const path = require('path');
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
 * Transforms a raw dice roll result into a standardized log message and Discord embed.
 * This ensures that players can see both the total and the math behind the roll.
 */
function formatRoll(creatureName, rollType, checkType, roll, modifier) {
    // Calculate the final sum including any modifiers.
    const total = roll.total + modifier;

    // Extract each individual d20 result for transparency (critical for adv/dis verification).
    const rawRolls = roll.rolls[0].rolls.map(r => r.value);
    const rollDetails = rawRolls.join(', ');

    // In advantage/disadvantage rolls, bold the value that was actually used.
    const detailedRolls = rawRolls.map(r => (r === roll.total) ? `**${r}**` : r).join(', ');

    // Construct a human-readable text string for the Electron app's internal log.
    const message = `${creatureName}'s ${checkType} (${rollType}): ${total} ⟵ [${rollDetails}] + ${modifier}`;

    // Build a rich embed for Discord, using color themes to make combat results easy to spot.
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
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
 * Manages the initiative order, turn tracking, and combatant state.
 * Handles persistence and communication with the Discord bot.
 */
class InitiativeTracker {
    /**
     * Initializes the tracker with logging and update callbacks.
     */
    constructor(logToRenderer, logDiceRoll, sendInitiativeUpdate, autosavePath) {
        this.logToRenderer = logToRenderer;
        this.logDiceRoll = logDiceRoll;
        this.sendInitiativeUpdate = sendInitiativeUpdate;
        this.autosavePath = autosavePath;

        // Master list of combatants
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;

        // Initialize debounced persistence and UI update methods for efficiency
        this._debouncedSave = this._debounce(this._performSave.bind(this), 1000);
        this._debouncedUpdate = this._debounce(this._performUpdate.bind(this), 100);

        // Restore state from disk on startup
        this.loadState();
    }

    /**
     * Utility to limit function execution frequency.
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
     * Internal method to write current state to JSON.
     */
    _performSave() {
        const state = {
            initiativeOrder: this.initiativeOrder,
            currentTurnIndex: this.currentTurnIndex
        };
        fs.promises.writeFile(this.autosavePath, JSON.stringify(state, null, 2))
            .catch(error => {
                this.logToRenderer(`Error autosaving state: ${error.message}`);
            });
    }

    /**
     * Loads the previous session's encounter state from disk.
     */
    loadState() {
        try {
            if (fs.existsSync(this.autosavePath)) {
                const savedState = JSON.parse(fs.readFileSync(this.autosavePath, 'utf8'));
                this.initiativeOrder = savedState.initiativeOrder || [];
                this.currentTurnIndex = savedState.currentTurnIndex || 0;

                // Scrub state for robustness: clear temporary hidden flags and ensure death save object exists
                this.initiativeOrder.forEach(c => {
                    delete c.hidden;
                    if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
                });
                this.logToRenderer('Restored encounter state from autosave.');
            }
        } catch (error) {
            this.logToRenderer(`Error loading state: ${error.message}`);
            this.initiativeOrder = [];
            this.currentTurnIndex = 0;
        }
        // Do not update frontend automatically on load to prevent race condition.
        // The frontend will request the state when it's ready.
    }

    /**
     * Sends the current full initiative state to the renderer process immediately.
     */
    sendFullState() {
        // Immediate update for explicit requests
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Schedules a debounced update to the frontend UI.
     */
    _updateFrontend() {
        this._debouncedUpdate();
    }

    /**
     * Internal method to dispatch state to renderer via callback.
     */
    _performUpdate() {
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    /**
     * Adds a new combatant to the encounter, handling HP calculations and initiative rolls.
     * @param {object} creature - Raw creature data from the form.
     * @returns {string|null} Log message if a die roll occurred.
     */
    /**
     * Integrates a new combatant into the initiative order.
     * This handles HP parsing (including dice rolling), mob initialization, and initiative rolls.
     */
    addCreature(creature) {
        // TavernTones uses a 'Mob' system to track groups of identical enemies (like a swarm of goblins).
        if (creature.isMob) {
            // Cleanup the formula string for parsing.
            const hpFormula = creature.hp.toString().toLowerCase().replace(/\s/g, '');
            creature.hpFormula = creature.hp.toString();

            try {
                let formulaToParse = hpFormula;
                if (formulaToParse.startsWith('d')) {
                    formulaToParse = '1' + formulaToParse;
                }

                // Convert 'd' notation to '*' to facilitate a basic mathematical evaluation.
                const expression = formulaToParse.replace('d', '*');

                // We use a safe, regex-based evaluator to avoid 'eval' and protect against RCE.
                let singleCreatureHp;
                const parts = expression.split(/([+-])/);

                // Determine the base health of a single member of the mob.
                const basePart = parts[0];
                if (basePart.includes('*')) {
                    const [numDice, sides] = basePart.split('*').map(s => parseInt(s, 10));
                    singleCreatureHp = numDice * sides;
                } else {
                    singleCreatureHp = parseInt(basePart, 10);
                }

                // Add or subtract static modifiers (e.g., 2d6 + 4).
                if (parts.length > 1) {
                    const operator = parts[1];
                    const modifier = parseInt(parts[2], 10);
                    if (operator === '+') {
                        singleCreatureHp += modifier;
                    } else if (operator === '-') {
                        singleCreatureHp -= modifier;
                    }
                }
                if (isNaN(singleCreatureHp)) {
                    throw new Error("HP formula resulted in NaN.");
                }
                creature.singleCreatureHP = singleCreatureHp;
                creature.hp = singleCreatureHp * creature.mobInitialCount;
                creature.maxHp = creature.hp;
            } catch (e) {
                this.logToRenderer(`Invalid Mob HP formula "${hpFormula}". Defaulting to 10 per creature.`);
                creature.singleCreatureHP = 10;
                creature.hp = 10 * creature.mobInitialCount;
                creature.maxHp = creature.hp;
            }
        } else if (!creature.maxHp) {
            // For standard single creatures, we evaluate the HP formula using the dice roller.
            const hpInput = creature.hp.toString();
            creature.hpFormula = hpInput;

            if (hpInput.match(/d/i)) {
                try {
                    const roll = new DiceRoller().roll(hpInput);
                    creature.hp = roll.total;
                    this.logDiceRoll(`${creature.name} rolled HP: ${hpInput} = ${roll.total}`);
                } catch (e) {
                    // Fallback to a sensible default if the user provided an invalid dice string.
                    this.logToRenderer(`Invalid HP dice notation "${hpInput}". Defaulting to 10.`);
                    creature.hp = 10;
                }
            } else {
                // If it's a plain integer, use it directly.
                creature.hp = parseInt(hpInput, 10) || 10;
            }
            creature.maxHp = creature.hp;
        }

        // --- Mob Properties Initialization ---
        if (creature.isMob === undefined) {
            creature.isMob = false;
        }
        if (!creature.isMob) {
            creature.singleCreatureHP = creature.maxHp;
            delete creature.mobInitialCount;
        }

        // Initialize Death Saves
        if (!creature.deathSaves) {
            creature.deathSaves = { successes: 0, failures: 0 };
        }
        if (creature.noDeathSaves === undefined) {
            creature.noDeathSaves = false;
        }
        // For mobs, we trust the renderer to have set hp, maxHp, singleCreatureHP, and mobInitialCount correctly.


        // Populate missing saving throw modifiers based on raw ability scores.
        const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        stats.forEach(stat => {
            if (!creature.saves[stat] || creature.saves[stat].trim() === '') {
                const score = creature.scores[stat];
                if (score) {
                    // Apply standard D&D 5e modifier calculation: floor((score - 10) / 2)
                    const modifier = Math.floor((score - 10) / 2);
                    creature.saves[stat] = modifier >= 0 ? `+${modifier}` : `${modifier}`;
                } else {
                    creature.saves[stat] = '+0';
                }
            }
        });
        const initiativeInput = creature.initiative.toString().trim().toLowerCase();
        creature.initiativeFormula = creature.initiative.toString(); // Save the original formula/input
        let rollLogMessage = null;
        let rollType = 'flat';
        let initiativeString = initiativeInput;
        if (initiativeInput.endsWith(' adv')) {
            rollType = 'adv';
            initiativeString = initiativeInput.slice(0, -4).trim();
        } else if (initiativeInput.endsWith(' dis')) {
            rollType = 'dis';
            initiativeString = initiativeInput.slice(0, -4).trim();
        }

        // If it's a modifier string like "+5" or "-1"
        if (initiativeString.startsWith('+') || initiativeString.startsWith('-')) {
            let notation = '1d20';
            if (rollType === 'adv') notation = '2d20kh1';
            if (rollType === 'dis') notation = '2d20kl1';
            const modifier = parseInt(initiativeString, 10) || 0;
            const roll = new DiceRoller().roll(notation);
            creature.initiative = roll.total + modifier;
            const rawRolls = roll.rolls[0].rolls.map(r => r.value);
            const chosenRoll = roll.rolls[0].value;
            const detailedRolls = rawRolls.map(r => (r === chosenRoll) ? `**${r}**` : r).join(', ');
            rollLogMessage = `${creature.name} rolled initiative (${rollType}): ${creature.initiative} ⟵ [${detailedRolls}] ${modifier >= 0 ? '+' : ''} ${Math.abs(modifier)}`;
            this.logDiceRoll(rollLogMessage);
        }
        // If it's a full dice string like "1d20+2"
        else if (/d/i.test(initiativeString)) {
            // Note: adv/dis is ignored here. This is a reasonable limitation for now.
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
        // If it's just a number
        else {
            creature.initiative = parseFloat(initiativeString) || 0;
        }
        this.initiativeOrder.push(creature);
        this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
        this._updateFrontend();
        this._saveState();
        return rollLogMessage;
    }

    /**
     * Manually updates a creature's initiative score and re-sorts the list.
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
     * Advances to the next combatant's turn, issuing reminders for downed creatures.
     * @returns {object|null} Turn info including old and new creatures.
     */
    nextTurn() {
        if (this.initiativeOrder.length > 0) {
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];
            this._updateFrontend();
            this._saveState();

            // Issue death save reminder if next creature is downed and requires them
            const ds = newCreature.deathSaves || { successes: 0, failures: 0 };
            const needsSaves = newCreature.hp <= 0 && !newCreature.noDeathSaves && !newCreature.isMob;
            const notYetFinished = ds.successes < 3 && ds.failures < 3;
            if (needsSaves && notYetFinished) {
                this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex, { type: 'death-save-reminder', creatureId: newCreature.id });
            }
            return { oldCreature, newCreature };
        }
        return null;
    }

    /**
     * Reverts to the previous combatant's turn.
     */
    previousTurn() {
        if (this.initiativeOrder.length > 0) {
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            this.currentTurnIndex = (this.currentTurnIndex - 1 + this.initiativeOrder.length) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];
            this._updateFrontend();
            this._saveState();
            return { oldCreature, newCreature };
        }
        return null;
    }
    getCreature(creatureId) {
        return this.initiativeOrder.find(c => c.id === creatureId);
    }
    editCreature(creatureId) {
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            // Mark as hidden instead of removing
            creature.hidden = true;
            this._updateFrontend();
            this._saveState();
            return { ...creature }; // Return a copy to be safe
        }
        return null;
    }
    updateCreature(updatedCreature) {
        const index = this.initiativeOrder.findIndex(c => c.id === updatedCreature.id);
        if (index !== -1) {
            // Unhide the creature upon update
            updatedCreature.hidden = false;
            this.initiativeOrder[index] = updatedCreature;
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
            this._updateFrontend();
            this._saveState();
            this.logToRenderer(`Updated ${updatedCreature.name}.`);
        } else {
            this.logToRenderer(`Error: Could not find creature with ID ${updatedCreature.id} to update.`);
        }
    }
    removeCreature(creatureId) {
        this.initiativeOrder = this.initiativeOrder.filter(c => c.id !== creatureId);
        this._updateFrontend();
        this._saveState();
    }

    /**
     * Updates HP and handles concentration check calculations.
     * @param {number} creatureId - Creature ID.
     * @param {number} amount - Damage (negative) or healing (positive).
     * @returns {object} Updated creature and DC for concentration check.
     */
    updateHp(creatureId, amount) {
        const creature = this.getCreature(creatureId);
        let concentrationCheckDC = null;
        if (creature) {
            if (amount < 0) { // Damage
                let damage = -amount;
                const tempHpDamage = Math.min(creature.tempHp || 0, damage);
                creature.tempHp -= tempHpDamage;
                damage -= tempHpDamage;
                creature.hp -= damage;
                creature.hp = Math.max(0, creature.hp); // Prevent negative HP
                if (creature.isConcentrating) {
                    concentrationCheckDC = Math.max(10, Math.floor(-amount / 2));
                }
            } else { // Healing
                if (creature.isMob && creature.singleCreatureHP > 0) {
                    // For mobs, healing is capped by the number of remaining members.
                    const currentMemberCount = Math.ceil(creature.hp / creature.singleCreatureHP);
                    const currentMaxHp = currentMemberCount * creature.singleCreatureHP;
                    creature.hp = Math.min(currentMaxHp, creature.hp + amount);
                } else {
                    // For single creatures, healing can go above maxHP (overhealing).
                    creature.hp += amount;
                }

                // Reset death saves if creature regained HP
                if (creature.hp > 0 && !creature.isMob) {
                    creature.deathSaves = { successes: 0, failures: 0 };
                }
            }
            this._updateFrontend();
            this._saveState();
        }
        return { creature, concentrationCheckDC };
    }
    addTempHp(creatureId, amount) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            creature.tempHp = (creature.tempHp || 0) + amount;
            this._updateFrontend();
            this._saveState();
        }
    }
    addCondition(creatureId, condition) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            if (!creature.conditions) creature.conditions = [];
            if (!creature.conditions.includes(condition)) {
                creature.conditions.push(condition);
                this._updateFrontend();
                this._saveState();
            }
        }
    }
    removeCondition(creatureId, condition) {
        const creature = this.getCreature(creatureId);
        if (creature && creature.conditions) {
            creature.conditions = creature.conditions.filter(c => c !== condition);
            this._updateFrontend();
            this._saveState();
        }
    }
    updateCreatureFlag(creatureId, flag, value) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            creature[flag] = value;
            this._updateFrontend();
            this._saveState();
        }
    }
    updateReminders(creatureId, reminders) {
        const creature = this.getCreature(creatureId);
        if (creature) {
            creature.reminders = reminders;
            this._saveState();
        }
    }

    /**
     * Resets all combatants to full health and clears conditions.
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
     * Wipe all combatants from encounter.
     */
    clearEncounter() {
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;
        this._updateFrontend();
        this._saveState();
    }
    saveEncounterToFile(filePath) {
        try {
            const state = { initiativeOrder: this.initiativeOrder, currentTurnIndex: this.currentTurnIndex };
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            this.logToRenderer(`Encounter saved to ${filePath}`);
        } catch (error) {
            this.logToRenderer(`Error saving encounter: ${error.message}`);
        }
    }
    loadEncounterFromFile(filePath) {
        try {
            const savedState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.initiativeOrder = savedState.initiativeOrder || [];
            this.currentTurnIndex = savedState.currentTurnIndex || 0;
            this.logToRenderer(`Encounter loaded from ${filePath}`);
            this._saveState(); // Autosave the newly loaded state
            this._updateFrontend();
        } catch (error) {
            this.logToRenderer(`Error loading encounter: ${error.message}`);
        }
    }

    /**
     * Executes a stat check or saving throw roll.
     */
    rollStat(creatureId, rollType, stat, type) {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;
        let modifier = 0;
        let checkType = '';
        if (type === 'check') {
            const score = creature.scores ? (creature.scores[stat] || 10) : 10;
            modifier = Math.floor((score - 10) / 2);
            checkType = `${stat.toUpperCase()} Check`;
        } else { // 'save'
            modifier = creature.saves ? (parseInt(creature.saves[stat], 10) || 0) : 0;
            checkType = `${stat.toUpperCase()} Save`;
        }
        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';
        const roll = new DiceRoller().roll(rollNotation);
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);
        return result;
    }

    /**
     * Executes an attack roll for a combatant.
     */
    rollAttack(creatureId, rollType, modIndex = "1") {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;
        const modStr = (modIndex === "2" && creature.attackMod2) ? creature.attackMod2 : creature.attackMod;
        const modifier = parseInt(modStr, 10) || 0;
        const checkType = 'Attack';
        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';
        const roll = new DiceRoller().roll(rollNotation);
        const result = formatRoll(creature.name, rollType, checkType, roll, modifier);
        return result;
    }
    getInitiativeOrder() {
        return this.initiativeOrder;
    }
}
module.exports = InitiativeTracker;
