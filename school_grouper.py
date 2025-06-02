import json
import re
import os

SCHOOL_DATA_MAP = {
    "Abjuration": {"emoji": "🛡️", "file": "abj.json"},
    "Conjuration": {"emoji": "📦", "file": "conj.json"},
    "Divination": {"emoji": "🔮", "file": "divin.json"},
    "Enchantment": {"emoji": "🤯", "file": "ench.json"},
    "Evocation": {"emoji": "💥", "file": "evoc.json"},
    "Illusion": {"emoji": "🥸", "file": "illu.json"},
    "Necromancy": {"emoji": "💀", "file": "necro.json"},
    "Transmutation": {"emoji": "⚗️", "file": "trans.json"}
}

# Regex to remove known source prefixes from spell names (consistent with previous script)
KNOWN_PREFIXES = [
    "PHB'24", "XGE", "FTD", "AI", "BoET", "SCC", "GGR", "IDRotF", 
    "SatO", "HWCS", "AAG", "BMT", "O:TTG", "VSS:PP", "GH:PP", 
    "EGW", "TCE", "DC", "LLK", "MOT", "VRGR", "SLW", "WBtW", "CM"
]
SPELL_NAME_PREFIX_REGEX = r"^(?:{})\s+".format("|".join(re.escape(p) for p in KNOWN_PREFIXES))

def clean_spell_name(name):
    cleaned_name = re.sub(SPELL_NAME_PREFIX_REGEX, "", name)
    return cleaned_name.strip()

def process_spells_by_school(input_filepath="parsed_spells.json", output_dir="randomtables/spells"):
    try:
        with open(input_filepath, 'r', encoding='utf-8') as f:
            spells_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file '{input_filepath}' not found.")
        return []
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from '{input_filepath}'.")
        return []

    spells_by_school = {school: [] for school in SCHOOL_DATA_MAP.keys()}

    for spell in spells_data:
        original_name = spell.get("name", "Unknown Spell")
        name = clean_spell_name(original_name)
        level_str = spell.get("level", "")
        school = spell.get("school", "")

        if not school or not level_str: # Basic validation
            print(f"Warning: Skipping spell '{original_name}' due to missing school/level information.")
            continue

        if school in SCHOOL_DATA_MAP:
            school_info = SCHOOL_DATA_MAP[school]
            emoji = school_info["emoji"]
            
            formatted_text = f"{name} - {level_str} {school} {emoji}"

            spell_entry = {
                "text": formatted_text,
                "unique": False,
                "used": []
            }
            
            # Prevent duplicates within the same school file
            is_duplicate = any(e["text"] == spell_entry["text"] for e in spells_by_school[school])
            if not is_duplicate:
                spells_by_school[school].append(spell_entry)
            #else:
            #    print(f"Debug: Duplicate spell entry skipped for school {school}: {spell_entry['text']}")
        # Spells from schools not in SCHOOL_DATA_MAP are ignored

    if not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir)
            print(f"Created directory: {output_dir}")
        except OSError as e:
            print(f"Error creating directory {output_dir}: {e}")
            return []

    created_files_list = []
    for school_name, spells_list in spells_by_school.items():
        if not spells_list: # Don't create empty files if no spells for that school
            continue

        # Sort spells alphabetically by their "text" field
        spells_list.sort(key=lambda x: x["text"])
        
        output_filename = os.path.join(output_dir, SCHOOL_DATA_MAP[school_name]["file"])
        try:
            with open(output_filename, 'w', encoding='utf-8') as outfile:
                json.dump(spells_list, outfile, indent=2, ensure_ascii=False)
            created_files_list.append(output_filename)
        except IOError as e:
            print(f"Error writing file {output_filename}: {e}")
            
    return created_files_list

if __name__ == "__main__":
    # Assumes script is run from project root
    generated_files = process_spells_by_school()
    if generated_files:
        print("Successfully created JSON files by school:")
        for file_path in generated_files:
            print(file_path)
    else:
        print("No files were created or an error occurred. This might be normal if no spells match the criteria.")

# Example Test:
# Spell: "Alter Self", Level: "2nd level", School: "Transmutation"
# Expected output in trans.json:
# { "text": "Alter Self - 2nd level Transmutation ⚗️", "unique": false, "used": [] }
# My code should produce this.

# If a spell has a school like "Graviturgy" (and it's not in SCHOOL_DATA_MAP), it will be skipped.
# This is the desired behavior as per: "Spells belonging to schools not in the predefined list ... should be ignored"
# The parser.py already standardized schools like "Trans. (chr.)" to "Transmutation",
# so such cases will be correctly mapped if "Transmutation" is in SCHOOL_DATA_MAP.
# Any truly distinct schools not in the map will be filtered out by the `if school in SCHOOL_DATA_MAP:` check.
