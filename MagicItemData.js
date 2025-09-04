const itemTypes = [
    "Reusable Item (Gizmo)",
    "Single-use Scroll/Tablet",
    "Glyph/Ward/Trap",
    "Enchanted Ammunition",
    "Potion",
    "Poison, Ingested",
    "Poison, Inhaled",
    "Poison, Contact",
    "Poison, Injury"
];

// Probabilities are stored as percentages (e.g., 80 for 80%)
const probabilities = {
    "Reusable Item (Gizmo)":      [80, 70, 60, 50, 40, 30, 20, 15, 10, 3],
    "Single-use Scroll/Tablet": [90, 85, 75, 65, 55, 45, 35, 25, 15, 5],
    "Glyph/Ward/Trap":          [70, 60, 50, 40, 30, 25, 20, 15, 10, 5],
    "Enchanted Ammunition":     [75, 65, 55, 45, 35, 30, 25, 20, 15, 5],
    "Potion":                   [85, 75, 65, 55, 45, 35, 30, 20, 15, 5],
    "Poison, Ingested":         [50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
    "Poison, Inhaled":          [45, 40, 35, 30, 25, 20, 15, 10, 7, 3],
    "Poison, Contact":          [40, 35, 30, 25, 20, 15, 10, 7, 5, 2],
    "Poison, Injury":           [35, 30, 25, 20, 15, 10, 7, 5, 3, 1]
};

// Prices are stored in GP.
const prices = {
    "Reusable Item (Gizmo)":      [1000, 3000, 10000, 20000, 50000, 100000, 200000, 400000, 750000, 1000000],
    "Single-use Scroll/Tablet": [10, 50, 150, 300, 750, 1500, 3000, 6000, 12500, 25000],
    "Glyph/Ward/Trap":          [50, 150, 300, 600, 1500, 3000, 6000, 12000, 25000, 50000],
    "Enchanted Ammunition":     [8, 35, 100, 240, 600, 1200, 2500, 5000, 10000, 20000],
    "Potion":                   [20, 80, 200, 400, 1000, 2500, 5000, 10000, 20000, 40000],
    "Poison, Ingested":         [30, 120, 250, 500, 1200, 3000, 6000, 12500, 25000, 50000],
    "Poison, Inhaled":          [35, 150, 300, 600, 1500, 3500, 7500, 15000, 30000, 60000],
    "Poison, Contact":          [40, 180, 350, 700, 1700, 4000, 8000, 16000, 32000, 65000],
    "Poison, Injury":           [50, 200, 400, 800, 2000, 5000, 10000, 20000, 40000, 80000]
};

const sizeModifiers = {
    "Huge":    { probability: 1.2, price: 0.8 },
    "Large":   { probability: 1.1, price: 0.9 },
    "Average": { probability: 1.0, price: 1.0 },
    "Small":   { probability: 0.9, price: 1.1 },
    "Tiny":    { probability: 0.8, price: 1.2 }
};

module.exports = {
    itemTypes,
    probabilities,
    prices,
    sizeModifiers
};
