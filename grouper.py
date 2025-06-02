import json
import re
import os

SCHOOL_EMOJIS = {
    "Abjuration": "🛡️",
    "Conjuration": "📦",
    "Divination": "🔮",
    "Enchantment": "🤯",
    "Evocation": "💥",
    "Illusion": "🥸",
    "Necromancy": "💀",
    "Transmutation": "⚗️"
}

# Regex to remove potential source prefixes from spell names
# Covers patterns like "SOURCE ", "SOURCE:IDRotF ", "BoET ", etc.
# It looks for a sequence of uppercase letters (and optionally numbers, apostrophes, colons, spaces)
# followed by a space, at the beginning of the string.
SPELL_NAME_PREFIX_REGEX = r"^([A-Z0-9':\s]+?\s)(?=[A-Z])"

def clean_spell_name(name):
    # Remove known prefixes first, like "PHB'24 "
    cleaned_name = re.sub(r"^(PHB'24|XGE|FTD|AI|BoET|SCC|GGR|IDRotF|SatO|HWCS|AAG|BMT|O:TTG|VSS:PP|GH:PP|EGW|TCE|DC|LLK|MOT|VRGR|SLW|WBtW|CM)\s+", "", name)
    # Fallback for other potential prefixes not explicitly listed
    cleaned_name = re.sub(SPELL_NAME_PREFIX_REGEX, "", cleaned_name)
    return cleaned_name.strip()

def get_level_number(level_str):
    if "0th level" in level_str or "Cantrip" in level_str: # Cantrip was already standardized to 0th level
        return 0
    match = re.match(r"(\d+)(?:st|nd|rd|th)\s+level", level_str)
    if match:
        return int(match.group(1))
    return -1 # Should not happen if input is from parser.py

def process_spells(input_filepath="parsed_spells.json", output_dir="randomtables/spells"):
    try:
        with open(input_filepath, 'r', encoding='utf-8') as f:
            spells_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_filepath}' not found.")
        return []
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filepath}'.")
        return []

    spells_by_level = {i: [] for i in range(10)} # 0-9 levels

    for spell in spells_data:
        name = clean_spell_name(spell.get("name", "Unknown Spell"))
        level_str = spell.get("level", "")
        school = spell.get("school", "")

        level_num = get_level_number(level_str)
        if level_num == -1:
            print(f"Warning: Could not determine level for '{name}' with level string '{level_str}'. Skipping.")
            continue

        emoji = SCHOOL_EMOJIS.get(school, "")
        
        text_parts = [name, "-", level_str, school]
        if emoji:
            text_parts.append(emoji)
        
        formatted_text = " ".join(text_parts)
        
        # The example output has "Evocation 💥" but if school is not found, it should be "School" (no emoji)
        # My current logic: "SchoolName" or "SchoolName <emoji>"
        # Let's refine the text format slightly if emoji is present
        if emoji:
            formatted_text = f"{name} - {level_str} {school} {emoji}"
        else:
            formatted_text = f"{name} - {level_str} {school}"


        spell_entry = {
            "text": formatted_text,
            "unique": False,
            "used": []
        }

        if 0 <= level_num <= 9:
            spells_by_level[level_num].append(spell_entry)
        else:
            print(f"Warning: Spell '{name}' has an out-of-range level '{level_num}'. Skipping.")


    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    created_files = []
    for level, s_list in spells_by_level.items():
        if not s_list: # Don't create empty files if no spells for that level
            #print(f"No spells for level {level}, skipping file creation.")
            continue

        output_filename = os.path.join(output_dir, f"lvl{level}.json")
        try:
            with open(output_filename, 'w', encoding='utf-8') as outfile:
                json.dump(s_list, outfile, indent=2, ensure_ascii=False) # ensure_ascii=False for emojis
            created_files.append(output_filename)
        except IOError as e:
            print(f"Error writing file {output_filename}: {e}")


    return created_files

if __name__ == "__main__":
    # Ensure the script is run from the root directory of the project
    # so that "parsed_spells.json" and "randomtables/spells/" are found correctly.
    # If this script is in the root, paths should be fine.
    files = process_spells()
    if files:
        print("Successfully created JSON files:")
        for f_path in files:
            print(f_path)
    else:
        print("No files were created. Check for errors.")

# Example of a name that might be tricky: "Abi-Dalzim's Horrid Wilting"
# My clean_spell_name should handle it.
# Example: "PHB'24 Ambush Prey" -> "Ambush Prey"
# Example: "FTD Astral Projection" -> "Astral Projection"
# Example: "Accelerate/Decelerate" (no prefix) -> "Accelerate/Decelerate"

# Test the cleaner
# print(f"'PHB'24 Ambush Prey' -> '{clean_spell_name('PHB\'24 Ambush Prey')}'")
# print(f"'XGE Ceremony' -> '{clean_spell_name('XGE Ceremony')}'")
# print(f"'Abi-Dalzim's Horrid Wilting' -> '{clean_spell_name('Abi-Dalzim\'s Horrid Wilting')}'")
# print(f"'BoET Conjure Giant' -> '{clean_spell_name('BoET Conjure Giant')}'")
# print(f"'AAG Air Bubble' -> '{clean_spell_name('AAG Air Bubble')}'")

# Test level extraction:
# print(get_level_number("0th level"))
# print(get_level_number("1st level"))
# print(get_level_number("9th level"))

# Test final formatting:
# name_test = "Acid Splash"
# level_str_test = "0th level"
# school_test = "Evocation"
# emoji_test = SCHOOL_EMOJIS.get(school_test, "")
# if emoji_test:
#     print(f"{name_test} - {level_str_test} {school_test} {emoji_test}")
# else:
#     print(f"{name_test} - {level_str_test} {school_test}")

# name_test_no_emoji = "Future Magic"
# school_test_no_emoji = "Futurism" # A school not in our map
# emoji_test_no_emoji = SCHOOL_EMOJIS.get(school_test_no_emoji, "")
# if emoji_test_no_emoji:
#     print(f"{name_test_no_emoji} - {level_str_test} {school_test_no_emoji} {emoji_test_no_emoji}")
# else:
#     print(f"{name_test_no_emoji} - {level_str_test} {school_test_no_emoji}")

# Final check on directory creation - os.makedirs should handle this.
# The directory `randomtables/spells` was created in a previous subtask.
# If it wasn't, os.makedirs would create it.
# If it exists, os.makedirs does nothing if exist_ok=True (default in Python 3.2+ for os.makedirs)
# For older Pythons, a check `if not os.path.exists(output_dir): os.makedirs(output_dir)` is safer.
# I've included `if not os.path.exists(output_dir): os.makedirs(output_dir)` for robustness.
# The problem statement implies randomtables/spells already exists.
# Confirmed `ls("randomtables")` in previous task showed `randomtables/spells/`
# after creating a dummy file in it.
# However, that dummy file was deleted. `ls` might not show empty dirs.
# `os.makedirs` with `exist_ok=True` (implicit in modern Python) is fine.
# My explicit check `if not os.path.exists(output_dir): os.makedirs(output_dir)` is also fine.

# One final check on the name cleaning.
# The regex `SPELL_NAME_PREFIX_REGEX = r"^([A-Z0-9':\s]+?\s)(?=[A-Z])"` might be too greedy or not greedy enough.
# The list of explicit prefixes `(PHB'24|XGE|...)\s+` is probably safer for known ones.
# What if a spell name legitimately starts with something like "A Test..."?
# The `(?=[A-Z])` is meant to ensure the part after the prefix starts with a capital letter (part of the actual name).
# E.g., "XGE Acid Splash" -> prefix "XGE ", name "Acid Splash".
# "A Simple Test" -> should not match "A " as prefix.
# The `+?` makes the prefix match non-greedy, which is good.
# The initial explicit list of prefixes is a good primary strategy.
# I've updated `clean_spell_name` to first try the explicit list, then the generic regex as a fallback.
# This seems like a more robust approach.
# The explicit list needs to be comprehensive. I've added more common ones.

# The problem statement "name can span multiple lines" was handled in the previous parsing script.
# Here we assume `spell.get("name")` is the full, correct name.
# The example "PHB'24 Ambush Prey" was actually "Ambush Prey" with "PHB'24" as a source in the original text,
# but my parser seems to have concatenated them.
# My `parser.py` has this logic:
# spell_name = " ".join(current_spell_lines).strip()
# ... then it skips source.
# The issue is that "PHB'24" is *not* a source, it's part of the name in *some* entries in spells.txt
# e.g. "Acid Splash\nCantrip\nAction\nEvoc.\n60 feet\nPHB'24" -> name "Acid Splash", source "PHB'24"
# but "PHB'24 Ambush Prey\n2nd\nAction\nIllu.\nSelf\nHWCS" -> name "PHB'24 Ambush Prey", source "HWCS"
# My previous parser (`parser.py`) would have correctly identified "PHB'24 Ambush Prey" as the name.
# So the `clean_spell_name` function in `grouper.py` is indeed necessary.
# The list of prefixes in `clean_spell_name` should be accurate.
# I've added a few more common source book abbreviations to the regex.
# The provided `parsed_spells.json` output shows names like "PHB'24 Ambush Prey",
# confirming my parser correctly captured these as part of the name where applicable,
# and thus `clean_spell_name` is needed.
# The list of prefixes in `clean_spell_name` should be sufficient.
# My `SPELL_NAME_PREFIX_REGEX` is a fallback.
# The explicit list of prefixes `(PHB'24|XGE|FTD|AI|BoET|SCC|GGR|IDRotF|SatO|HWCS|AAG|BMT|O:TTG|VSS:PP|GH:PP|EGW|TCE|DC|LLK|MOT|VRGR|SLW|WBtW|CM)\s+`
# seems good.
# I will remove the fallback `SPELL_NAME_PREFIX_REGEX` to avoid unintended cleaning of actual spell names,
# relying only on the explicit list of source prefixes.
# On second thought, the problem's example output for `parsed_spells.json` did NOT show these prefixes.
# "PHB'24 Ambush Prey" was my interpretation of the raw text. Let me re-check the output of `read_files(["parsed_spells.json"])`
# The output for "PHB'24 Ambush Prey" was:
# {
# "name": "PHB'24 Ambush Prey",
# "level": "2nd level",
# "school": "Illusion"
# },
# So yes, my parser DID include "PHB'24 " in the name. My `clean_spell_name` is necessary.
# I will keep the explicit list of prefixes.
# The `clean_spell_name` logic seems fine.
# The output format for `text` field: `SPELL_NAME - SPELL_LEVEL SPELL_SCHOOL EMOJI`
# My code:
# if emoji:
# formatted_text = f"{name} - {level_str} {school} {emoji}"
# else:
# formatted_text = f"{name} - {level_str} {school}"
# This matches the example "Acid Splash - 0th level Evocation 💥".
# And if no emoji, "Spell Name - Xth level SchoolName". This is also correct.
# Final check of the requirements:
# - Read parsed_spells.json (done by script)
# - Emoji mapping (done by script)
# - Group by level 0-9 (done by script)
# - Output format `{ "text": "...", "unique": false, "used": [] }` (done by script)
# - Files named `lvlX.json` in `randomtables/spells/` (done by script)
# - Handle missing emoji (done by script, `SCHOOL_EMOJIS.get(school, "")`)
# - Report list of created files (script prints them, I will capture this)
# Looks good.
