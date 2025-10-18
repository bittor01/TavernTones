const mobRules = {
    imagePath: "resources/MobRules/MobRules.png",
    ui: {
        text: `
    <p>
        **Mobs**. This section helps you speed up play when resolving outcomes with large groups of monsters, also known as **mobs**.
        **🎲 Tips for Smooth Mob Combat**: Use **average damage** from a stat block. If an attack reduces a monster to a handful of Hit Points, **assume the monster is killed**. **Divide a large number** of identical monsters into smaller mobs (5 to 8 creatures works well) and spread their turns out between character turns; **don't have more mobs than there are characters.**
        **📊 Average Mob Results**: To determine successful D20 Tests without rolling, use the **Mob Results table** by following these steps:
    </p>

    <ol>
        <li>
            **Determine the Roll Needed**: Calculate the minimum d20 roll for success:
            $$Roll\ Needed = Target\ Number - Monster's\ Bonus$$
        </li>
        <li>
            **Find the Column**: Locate the *Roll Needed* on the table. Use **With Advantage**, **With Disadvantage**, or **Normal** (otherwise) columns.
        </li>
        <li>
            **Determine Successes**: Read across to find the **fractional number of successes**. That fraction of monsters succeeds on the D20 Test.
        </li>
    </ol>
        `
    },
    discord: {
        title: "Mob Rules",
        description: "**Mobs**\nThis section can help you speed up play when resolving outcomes with large groups of monsters, also known as mobs.",
        fields: [
            {
                name: "Tips",
                value: "Follow these tips to smooth a combat encounter with a large number of monsters:\n\n- **Damage.** Use the average damage specified in a monster's stat block.\n- **Hit Points.** If a spell or attack reduces a monster to a handful of Hit Points, assume the monster is killed or otherwise taken out of the fight.\n- **Monster Mobs.** Divide a large number of identical monsters into smaller mobs and spread their turns out between the characters' turns. Mobs of five to eight identical creatures work well, but don't have more mobs than there are characters."
            },
            {
                name: "Average Results",
                value: "Whenever you would otherwise make a number of D20 Tests for identical monsters, the Mob Results table can help you determine the number of successful D20 Tests the monsters get without having to roll dice. Follow these steps:"
            },
            {
                name: "Step 1: Determine Roll Needed",
                value: "Determine the minimum d20 roll the monsters need to succeed on the D20 Test using the following formula:\n*Roll needed = target number − monster's bonus*"
            },
            {
                name: "Step 2: Find Roll on Table",
                value: "Find the roll needed on the Mob Results table. If all the monsters have Advantage on the roll (e.g., Pack Tactics, Magic Resistance), find the roll needed in the With Advantage column. If all the monsters have Disadvantage (e.g., attacking a creature protected by Blur), use the With Disadvantage column. Otherwise, use the Normal column."
            },
            {
                name: "Step 3: Find Success Fraction",
                value: "Read across the table to find a fractional number of successes you can easily apply to the group of monsters. That's the fraction of monsters that succeed on the D20 Test."
            }
        ]
    }
};

module.exports = { mobRules };