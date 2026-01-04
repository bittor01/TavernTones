const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const { EmbedBuilder } = require('discord.js');

function formatRoll(creatureName, rollType, checkType, roll, modifier) {
    const total = roll.total + modifier;
    const rawRolls = roll.rolls[0].rolls.map(r => r.value);
    const rollDetails = rawRolls.join(', ');

    // Bold the chosen roll for advantage/disadvantage
    const detailedRolls = rawRolls.map(r => (r === roll.total) ? `**${r}**` : r).join(', ');

    const message = `${creatureName}'s ${checkType} (${rollType}): ${total} ⟵ [${rollDetails}] + ${modifier}`;

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

class InitiativeTracker {
    constructor(logToRenderer, logDiceRoll, sendInitiativeUpdate, autosavePath) {
        this.logToRenderer = logToRenderer;
        this.logDiceRoll = logDiceRoll;
        this.sendInitiativeUpdate = sendInitiativeUpdate;
        this.autosavePath = autosavePath;
        this.initiativeOrder = [];
        this.currentTurnIndex = 0;
        this.loadState();
    }

    _saveState() {
        try {
            const state = {
                initiativeOrder: this.initiativeOrder,
                currentTurnIndex: this.currentTurnIndex
            };
            fs.writeFileSync(this.autosavePath, JSON.stringify(state, null, 2));
            this.logToRenderer(`Encounter state autosaved with ${this.initiativeOrder.length} creatures.`);
        } catch (error) {
            this.logToRenderer(`Error autosaving state: ${error.message}`);
        }
    }

    loadState() {
        try {
            if (fs.existsSync(this.autosavePath)) {
                const savedState = JSON.parse(fs.readFileSync(this.autosavePath, 'utf8'));
                this.initiativeOrder = savedState.initiativeOrder || [];
                this.currentTurnIndex = savedState.currentTurnIndex || 0;

                // Reset hidden state on load, in case app crashed during edit
                this.initiativeOrder.forEach(c => delete c.hidden);

                this.logToRenderer('Autosaved encounter state loaded.');
            }
        } catch (error) {
            this.logToRenderer(`Error loading state: ${error.message}`);
            this.initiativeOrder = [];
            this.currentTurnIndex = 0;
        }
        // Do not update frontend automatically on load to prevent race condition.
        // The frontend will request the state when it's ready.
    }

    sendFullState() {
        this._updateFrontend();
    }

    _updateFrontend() {
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    addCreature(creature) {
        if (creature.isMob) {
            const hpFormula = creature.hp.toString().toLowerCase().replace(/\s/g, ''); // clean string
            creature.hpFormula = creature.hp.toString(); // save original formula
            try {
                let formulaToParse = hpFormula;
                if (formulaToParse.startsWith('d')) {
                    formulaToParse = '1' + formulaToParse;
                }

                // Replace 'd' with '*' to make it a mathematical expression
                const expression = formulaToParse.replace('d', '*');

                // Super simple, safe evaluator for expressions like "A*B+C" or "A*B-C" or "A*B" or "C"
                let singleCreatureHp;
                const parts = expression.split(/([+-])/); // Split by operator, keeping the operator

                // Evaluate the first part, which could be "A*B" or just "C"
                const basePart = parts[0];
                if (basePart.includes('*')) {
                    const [numDice, sides] = basePart.split('*').map(s => parseInt(s, 10));
                    singleCreatureHp = numDice * sides;
                } else {
                    singleCreatureHp = parseInt(basePart, 10);
                }

                // Apply modifier if it exists
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
            const hpInput = creature.hp.toString();
            creature.hpFormula = hpInput; // Save the original formula
            if (hpInput.match(/d/i)) { // It's a dice roll
                try {
                    const roll = new DiceRoller().roll(hpInput);
                    creature.hp = roll.total;
                    this.logDiceRoll(`${creature.name} rolled HP: ${hpInput} = ${roll.total}`);
                } catch (e) {
                    this.logToRenderer(`Invalid HP dice notation "${hpInput}". Defaulting to 10.`);
                    creature.hp = 10;
                }
            } else { // It's a number
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
        // For mobs, we trust the renderer to have set hp, maxHp, singleCreatureHP, and mobInitialCount correctly.


        // Calculate saves from scores if not provided
        const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        stats.forEach(stat => {
            if (!creature.saves[stat] || creature.saves[stat].trim() === '') {
                const score = creature.scores[stat];
                if (score) {
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

    updateInitiative(creatureId, initiative) {
        const creature = this.initiativeOrder.find(c => c.id === creatureId);
        if (creature) {
            creature.initiative = parseFloat(initiative) || 0;
            this.initiativeOrder.sort((a, b) => b.initiative - a.initiative);
            this._updateFrontend();
            this._saveState();
        }
    }

    nextTurn() {
        if (this.initiativeOrder.length > 0) {
            const oldCreature = this.initiativeOrder[this.currentTurnIndex];
            this.currentTurnIndex = (this.currentTurnIndex + 1) % this.initiativeOrder.length;
            const newCreature = this.initiativeOrder[this.currentTurnIndex];
            this._updateFrontend();
            this._saveState();
            return { oldCreature, newCreature };
        }
        return null;
    }

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

    resetEncounter() {
        this.initiativeOrder.forEach(c => {
            c.hp = c.maxHp;
            c.tempHp = 0;
            c.conditions = [];
        });
        this.currentTurnIndex = 0;
        this._updateFrontend();
        this._saveState();
    }

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

    rollAttack(creatureId, rollType) {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;

        const modifier = parseInt(creature.attackMod, 10) || 0;
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
