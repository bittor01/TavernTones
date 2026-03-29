const { DiceRoller } = require('@dice-roller/rpg-dice-roller');
const roller = new DiceRoller();
const notation = '2d20kh1 + 5';
const roll = roller.roll(notation);
console.log('Notation:', notation);
console.log('Result Total:', roll.total);
console.log('Result String:', roll.toString());
