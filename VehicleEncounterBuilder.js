class VehicleEncounterBuilder {
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
    }

    async generateEncounter({ tag, style, totalHp, numVehicles }) {
        const allVehicles = await this._getVehiclesByTag(tag);
        if (!allVehicles || allVehicles.length === 0) {
            return { error: `No vehicles found for the "${tag}" tag.` };
        }

        if (style === 'flagship') {
            return this._generateFlagshipEncounter(allVehicles, totalHp, numVehicles);
        } else if (style === 'balanced') {
            return this._generateBalancedEncounter(allVehicles, totalHp, numVehicles);
        } else {
            return { error: 'Invalid encounter style specified.' };
        }
    }

    async _getVehiclesByTag(tag) {
        const vehicles = await this.fiveEToolsParser._loadCategoryData('vehicles');
        if (tag === 'random') {
            return vehicles;
        }

        return vehicles.filter(v => {
            if (tag === 'burrow') {
                return v.speed?.burrow;
            }
            if (v.vehicleType === tag) {
                return true;
            }
            return v.terrain && v.terrain.includes(tag);
        });
    }

    _generateFlagshipEncounter(allVehicles, totalHp, numVehicles) {
        const encounter = [];
        let remainingHp = totalHp;

        if (numVehicles <= 0) return { error: "Number of vehicles must be positive." };
        if (numVehicles === 1) {
             const possibleFlagships = allVehicles
                .filter(v => (v.hp || v.hull?.hp) <= totalHp)
                .sort((a, b) => (b.hp || b.hull?.hp) - (a.hp || a.hull?.hp));
            if (possibleFlagships.length === 0) return { error: 'No vehicle found within the HP budget.' };
            const flagship = { ...possibleFlagships[0], hp: possibleFlagships[0].hp || possibleFlagships[0].hull?.hp };
            return { encounter: [flagship], totalValue: flagship.hp, budget: totalHp };
        }

        const numEscortTypes = Math.floor(Math.log2(numVehicles - 1)) + 1;
        const escortTypeHpBudget = Math.floor(totalHp / (numVehicles - 1) / 2);

        const escortCandidates = allVehicles.filter(v => (v.hp || v.hull?.hp) <= escortTypeHpBudget * 1.15 && (v.hp || v.hull?.hp) >= escortTypeHpBudget * 0.85);

        if (escortCandidates.length === 0) {
            return { error: `Could not find suitable escorts with HP around ${escortTypeHpBudget}.` };
        }

        const selectedEscortTypes = [];
        for(let i = 0; i < numEscortTypes; i++) {
            selectedEscortTypes.push(escortCandidates[Math.floor(Math.random() * escortCandidates.length)]);
        }

        for (let i = 0; i < numVehicles - 1; i++) {
            const escort = selectedEscortTypes[Math.floor(Math.random() * selectedEscortTypes.length)];
            const escortHp = escort.hp || escort.hull?.hp;
            if (remainingHp >= escortHp) {
                encounter.push({ ...escort, hp: escortHp });
                remainingHp -= escortHp;
            }
        }

        const possibleFlagships = allVehicles
            .filter(v => (v.hp || v.hull?.hp) <= remainingHp)
            .sort((a, b) => (b.hp || b.hull?.hp) - (a.hp || a.hull?.hp));

        if (possibleFlagships.length > 0) {
            const flagship = { ...possibleFlagships[0], hp: possibleFlagships[0].hp || possibleFlagships[0].hull?.hp };
            encounter.push(flagship);
        }

        const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
        return { encounter, totalValue, budget: totalHp };
    }

    _generateBalancedEncounter(allVehicles, totalHp, numVehicles) {
        if (numVehicles <= 0) {
            return { error: 'Number of vehicles must be positive for a balanced fight.' };
        }

        const numVehicleTypes = Math.floor(Math.log2(numVehicles)) + 1;
        const targetHp = totalHp / numVehicles;
        const minHp = targetHp * 0.85;
        const maxHp = targetHp * 1.15;

        const candidates = allVehicles.filter(v => {
            const vehicleHp = v.hp || v.hull?.hp;
            return vehicleHp >= minHp && vehicleHp <= maxHp;
        });

        if (candidates.length === 0) {
            return { error: `Could not find any vehicles between ${Math.round(minHp)} and ${Math.round(maxHp)} HP to build a balanced encounter.` };
        }

        const selectedTypes = [];
        for(let i = 0; i < numVehicleTypes; i++) {
            selectedTypes.push(candidates[Math.floor(Math.random() * candidates.length)]);
        }

        const encounter = [];
        for (let i = 0; i < numVehicles; i++) {
            const vehicle = selectedTypes[Math.floor(Math.random() * selectedTypes.length)];
            encounter.push({ ...vehicle, hp: vehicle.hp || vehicle.hull?.hp });
        }

        const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
        return { encounter, totalValue, budget: totalHp };
    }
}

module.exports = VehicleEncounterBuilder;
