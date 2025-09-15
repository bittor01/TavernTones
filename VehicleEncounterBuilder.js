class VehicleEncounterBuilder {
    constructor(fiveEToolsParser) {
        this.fiveEToolsParser = fiveEToolsParser;
    }

    async generateEncounter({ environment, style, totalHp, numVehicles }) {
        const allVehicles = await this._getVehiclesByEnvironment(environment);
        if (!allVehicles || allVehicles.length === 0) {
            return { error: `No vehicles found for the "${environment}" environment.` };
        }

        if (style === 'flagship') {
            return this._generateFlagshipEncounter(allVehicles, totalHp);
        } else if (style === 'balanced') {
            return this._generateBalancedEncounter(allVehicles, totalHp, numVehicles);
        } else {
            return { error: 'Invalid encounter style specified.' };
        }
    }

    async _getVehiclesByEnvironment(environment) {
        const vehicles = await this.fiveEToolsParser._loadCategoryData('vehicles');

        return vehicles.filter(v => {
            if (environment === 'burrow') {
                return v.speed && v.speed.burrow;
            }
            return v.terrain && v.terrain.includes(environment);
        });
    }

    _generateFlagshipEncounter(allVehicles, totalHp) {
        const encounter = [];
        let remainingHp = totalHp;

        // 1. Find the flagship
        const possibleFlagships = allVehicles
            .filter(v => (v.hp || v.hull?.hp) <= totalHp)
            .sort((a, b) => (b.hp || b.hull?.hp) - (a.hp || a.hull?.hp));

        if (possibleFlagships.length === 0) {
            return { error: 'No possible flagship found within the specified HP budget.' };
        }

        const flagship = { ...possibleFlagships[0], hp: possibleFlagships[0].hp || possibleFlagships[0].hull?.hp };
        encounter.push(flagship);
        remainingHp -= flagship.hp;

        // 2. Find escorts
        const possibleEscorts = allVehicles
            .filter(v => (v.hp || v.hull?.hp) > 0) // Ensure vehicle has HP
            .sort((a, b) => (b.hp || b.hull?.hp) - (a.hp || a.hull?.hp)); // Sort descending

        while (remainingHp > 0 && possibleEscorts.length > 0) {
            const escort = possibleEscorts.find(e => (e.hp || e.hull?.hp) <= remainingHp);
            if (escort) {
                const escortHp = escort.hp || escort.hull?.hp;
                encounter.push({ ...escort, hp: escortHp });
                remainingHp -= escortHp;
            } else {
                // No more affordable escorts
                break;
            }
        }

        const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
        return { encounter, totalValue, budget: totalHp };
    }

    _generateBalancedEncounter(allVehicles, totalHp, numVehicles) {
        if (numVehicles <= 0) {
            return { error: 'Number of vehicles must be positive for a balanced fight.' };
        }

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

        const encounter = [];
        for (let i = 0; i < numVehicles; i++) {
            const randomVehicle = candidates[Math.floor(Math.random() * candidates.length)];
            encounter.push({ ...randomVehicle, hp: randomVehicle.hp || randomVehicle.hull?.hp });
        }

        const totalValue = encounter.reduce((sum, v) => sum + v.hp, 0);
        return { encounter, totalValue, budget: totalHp };
    }
}

module.exports = VehicleEncounterBuilder;
