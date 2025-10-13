const mobRules = {
    description: `
**Using Mobs**
This section can help you speed up play when resolving outcomes with large groups of monsters, also known as mobs.

**Tips**
Follow these tips to smooth a combat encounter with a large number of monsters:
- **Damage:** Use the average damage specified in a monster's stat block.
- **Hit Points:** If a spell or attack reduces a monster to a handful of Hit Points, assume the monster is killed or otherwise taken out of the fight.
- **Monster Mobs:** Divide a large number of identical monsters into smaller mobs and spread their turns out between the characters' turns. Mobs of five to eight identical creatures work well, but don't have more mobs than there are characters.

**Average Results**
Whenever you would otherwise make a number of D20 Tests for identical monsters, the Mob Results table can help you determine the number of successful D20 Tests the monsters get without having to roll dice. Follow these steps:

**Step 1.** Determine the minimum d20 roll the monsters need to succeed on the D20 Test using the following formula:
*Roll needed = target number − monster's bonus*

**Step 2.** Find the roll needed on the Mob Results table. If all the monsters have Advantage on the roll (for example, if they're attacking and have the Pack Tactics trait, or if they're making a saving throw against a spell and have the Magic Resistance trait), find the roll needed in the With Advantage column. If all the monsters have Disadvantage (for example, if they're attacking a creature protected by the Blur spell), use the With Disadvantage column. Otherwise, use the Normal column.

**Step 3.** Read across the table to find a fractional number of successes you can easily apply to the group of monsters. That's the fraction of monsters that succeed on the D20 Test.
    `,
    resultsTable: [
        { rollNeeded: '1', normal: '1–4', withAdvantage: '1', withDisadvantage: '1', outOf4: '4/4', outOf5: '5/5', outOf6: '6/6', outOf8: '8/8', outOf10: '10/10' },
        { rollNeeded: '2', normal: '5–6', withAdvantage: '—', withDisadvantage: '2', outOf4: '4/4', outOf5: '5/5', outOf6: '6/6', outOf8: '8/8', outOf10: '10/10' },
        { rollNeeded: '3', normal: '7–8', withAdvantage: '2', withDisadvantage: '3', outOf4: '4/4', outOf5: '5/5', outOf6: '5/6', outOf8: '7/8', outOf10: '9/10' },
        { rollNeeded: '4', normal: '9', withAdvantage: '—', withDisadvantage: '4', outOf4: '3/4', outOf5: '4/5', outOf6: '5/6', outOf8: '7/8', outOf10: '9/10' },
        { rollNeeded: '5', normal: '10', withAdvantage: '3', withDisadvantage: '5', outOf4: '3/4', outOf5: '4/5', outOf6: '5/6', outOf8: '6/8', outOf10: '8/10' },
        { rollNeeded: '6', normal: '11', withAdvantage: '—', withDisadvantage: '—', outOf4: '3/4', outOf5: '4/5', outOf6: '5/6', outOf8: '6/8', outOf10: '8/10' },
        { rollNeeded: '7', normal: '12', withAdvantage: '4', withDisadvantage: '6', outOf4: '3/4', outOf5: '4/5', outOf6: '4/6', outOf8: '6/8', outOf10: '7/10' },
        { rollNeeded: '8', normal: '13', withAdvantage: '5', withDisadvantage: '7', outOf4: '3/4', outOf5: '3/5', outOf6: '4/6', outOf8: '5/8', outOf10: '7/10' },
        { rollNeeded: '9', normal: '14', withAdvantage: '—', withDisadvantage: '8', outOf4: '2/4', outOf5: '3/5', outOf6: '4/6', outOf8: '5/8', outOf10: '6/10' },
        { rollNeeded: '10', normal: '—', withAdvantage: '6', withDisadvantage: '—', outOf4: '2/4', outOf5: '3/5', outOf6: '3/6', outOf8: '4/8', outOf10: '6/10' },
        { rollNeeded: '11', normal: '15', withAdvantage: '7', withDisadvantage: '9', outOf4: '2/4', outOf5: '3/5', outOf6: '3/6', outOf8: '4/8', outOf10: '5/10' },
        { rollNeeded: '12', normal: '16', withAdvantage: '—', withDisadvantage: '10', outOf4: '2/4', outOf5: '2/5', outOf6: '3/6', outOf8: '4/8', outOf10: '5/10' },
        { rollNeeded: '13', normal: '—', withAdvantage: '8', withDisadvantage: '11', outOf4: '2/4', outOf5: '2/5', outOf6: '2/6', outOf8: '3/8', outOf10: '4/10' },
        { rollNeeded: '14', normal: '17', withAdvantage: '9', withDisadvantage: '12', outOf4: '1/4', outOf5: '2/5', outOf6: '2/6', outOf8: '3/8', outOf10: '4/10' },
        { rollNeeded: '15', normal: '18', withAdvantage: '10', withDisadvantage: '13', outOf4: '1/4', outOf5: '2/5', outOf6: '2/6', outOf8: '2/8', outOf10: '3/10' },
        { rollNeeded: '16', normal: '—', withAdvantage: '11', withDisadvantage: '—', outOf4: '1/4', outOf5: '1/5', outOf6: '2/6', outOf8: '2/8', outOf10: '3/10' },
        { rollNeeded: '17', normal: '19', withAdvantage: '12', withDisadvantage: '14–15', outOf4: '1/4', outOf5: '1/5', outOf6: '1/6', outOf8: '2/8', outOf10: '2/10' },
        { rollNeeded: '18', normal: '—', withAdvantage: '13', withDisadvantage: '—', outOf4: '1/4', outOf5: '1/5', outOf6: '1/6', outOf8: '1/8', outOf10: '2/10' },
        { rollNeeded: '19', normal: '20', withAdvantage: '14–15', withDisadvantage: '16–17', outOf4: '0', outOf5: '1/5', outOf6: '1/6', outOf8: '1/8', outOf10: '1/10' },
        { rollNeeded: '20', normal: '—', withAdvantage: '16–17', withDisadvantage: '—', outOf4: '0', outOf5: '0', outOf6: '0', outOf8: '0', outOf10: '1/10' }
    ]
};

module.exports = { mobRules };