const fs = require('fs');
const path = require('path');
const { DiceRoller } = require('@dice-roller/rpg-dice-roller');

class InitiativeTracker {
    constructor(logToRenderer, sendInitiativeUpdate, autosavePath) {
        this.logToRenderer = logToRenderer;
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
                this.logToRenderer('Autosaved encounter state loaded.');
            }
        } catch (error) {
            this.logToRenderer(`Error loading state: ${error.message}`);
            this.initiativeOrder = [];
            this.currentTurnIndex = 0;
        }
        this._updateFrontend();
    }

    _updateFrontend() {
        this.sendInitiativeUpdate(this.initiativeOrder, this.currentTurnIndex);
    }

    addCreature(creature) {
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

        const initiativeInput = creature.initiative.toString(); // Ensure it's a string
        let rollLogMessage = null;
        if (initiativeInput.startsWith('+') || initiativeInput.startsWith('-')) {
            const modifier = parseInt(initiativeInput, 10);
            const roll = new DiceRoller().roll('1d20').total;
            creature.initiative = roll + modifier;
            rollLogMessage = `${creature.name} rolled initiative: ${roll} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)} = ${creature.initiative}`;
            this.logToRenderer(rollLogMessage);
        } else {
            creature.initiative = parseFloat(initiativeInput) || 0;
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
        const creature = this.getCreature(creatureId);
        if (creature) {
            this.initiativeOrder = this.initiativeOrder.filter(c => c.id !== creatureId);
            this._updateFrontend();
            this._saveState();
            return creature;
        }
        return null;
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
                if (creature.isConcentrating) {
                    concentrationCheckDC = Math.max(10, Math.floor(-amount / 2));
                }
            } else { // Healing
                creature.hp += amount;
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
        if (type === 'check') {
            const score = creature.scores ? (creature.scores[stat] || 10) : 10;
            modifier = Math.floor((score - 10) / 2);
        } else { // 'save'
            modifier = creature.saves ? (parseInt(creature.saves[stat], 10) || 0) : 0;
        }

        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';

        const roll = new DiceRoller().roll(rollNotation);
        const total = roll.total + modifier;

        const rollDetails = roll.rolls[0].rolls.map(r => r.value).join(', ');
        const message = `${creature.name} rolled a ${stat.toUpperCase()} ${type} (${rollType})\nResult: ${total} ([${rollDetails}] + ${modifier})`;

        this.logToRenderer(message);
        return message;
    }

    rollAttack(creatureId, rollType) {
        const creature = this.getCreature(creatureId);
        if (!creature) return null;

        const modifier = parseInt(creature.attackMod, 10) || 0;

        let rollNotation = '1d20';
        if (rollType === 'adv') rollNotation = '2d20kh1';
        if (rollType === 'dis') rollNotation = '2d20kl1';

        const roll = new DiceRoller().roll(rollNotation);
        const total = roll.total + modifier;

        const rollDetails = roll.rolls[0].rolls.map(r => r.value).join(', ');
        const message = `${creature.name} rolled an Attack (${rollType})\nResult: ${total} ([${rollDetails}] + ${modifier})`;

        this.logToRenderer(message);
        return message;
    }

    getInitiativeOrder() {
        return this.initiativeOrder;
    }
}

module.exports = InitiativeTracker;
