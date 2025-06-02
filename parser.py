import json
import re

def standardize_level(level_str):
    level_str = level_str.lower().strip()
    if level_str == "cantrip":
        return "0th level"
    # Handle cases like "1st (rit.)" or "1st"
    match = re.match(r"(\d+)(?:st|nd|rd|th)?(?:\s*\(rit\.\))?", level_str)
    if match:
        return f"{match.group(1)}{get_suffix(int(match.group(1)))} level"
    return level_str # Should not happen with good input

def get_suffix(level_num):
    if 10 <= level_num % 100 <= 20:
        return 'th'
    else:
        return {1: 'st', 2: 'nd', 3: 'rd'}.get(level_num % 10, 'th')

def standardize_school(school_str):
    school_str = school_str.strip()
    # Remove parenthetical additions like (chr.) or (grav.)
    school_str = re.sub(r"\s*\([^)]*\)", "", school_str)
    schools = {
        "Abj.": "Abjuration",
        "Conj.": "Conjuration",
        "Divin.": "Divination",
        "Ench.": "Enchantment",
        "Evoc.": "Evocation",
        "Illu.": "Illusion",
        "Necro.": "Necromancy",
        "Trans.": "Transmutation"
    }
    return schools.get(school_str, school_str) # Return original if not in map (should be an error or logged)

def is_level_line(line):
    return bool(re.match(r"^(Cantrip|\d+(?:st|nd|rd|th)?(?:\s*\(rit\.\))?)$", line.strip(), re.IGNORECASE))

def is_school_line(line):
    # Checks for abbreviated school names, possibly with parentheticals
    return bool(re.match(r"^(Abj\.|Conj\.|Divin\.|Ench\.|Evoc\.|Illu\.|Necro\.|Trans\.)(?: \([^)]*\))?$", line.strip()))

def parse_spells(filepath="reference/spells.txt"):
    spells = []
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line: # Skip empty lines
            i += 1
            continue

        current_spell_lines = []
        # Accumulate lines until a level line is found
        while i < len(lines) and not is_level_line(lines[i].strip()):
            if lines[i].strip(): # Add non-empty lines
                 current_spell_lines.append(lines[i].strip())
            i += 1
        
        if not current_spell_lines: # Should not happen if file is not starting with a level
             if is_level_line(lines[i].strip()): # If current line is level, previous line was name
                 # This case can happen if a spell name is just one line and previous spell ended.
                 # Or, if the very first spell starts with its name on line 0, then level on line 1.
                 # This should be caught by the logic that adds current_spell_lines.
                 # However, if the spell name was consumed by a previous mis-parse, this could be an issue.
                 # For now, let's assume spell names are correctly captured before level.
                 pass # This path should ideally not be hit frequently with correct parsing
             else: # Truly unexpected scenario
                i+=1
                continue


        spell_name = " ".join(current_spell_lines).strip()
        
        if i >= len(lines): break # End of file

        spell_level_raw = lines[i].strip()
        spell_level = standardize_level(spell_level_raw)
        i += 1 # Move past level line

        # Skip next line (casting time)
        i += 1
        if i >= len(lines): break 

        spell_school_raw = lines[i].strip()
        spell_school = standardize_school(spell_school_raw)
        i += 1 # Move past school line

        # Skip range and source lines
        i += 1 # Range
        if i >= len(lines): break
        i += 1 # Source
        if i >= len(lines): break
        
        # Sometimes there's an extra line with '×' or just an empty line
        # before the next spell name or end of file.
        if i < len(lines) and (lines[i].strip() == '×' or not lines[i].strip()):
            i += 1
            
        # Additional check for empty lines after source before next spell name
        while i < len(lines) and not lines[i].strip():
            i +=1


        if spell_name: # Ensure we have a name before adding
            spells.append({
                "name": spell_name,
                "level": spell_level,
                "school": spell_school
            })
        # No explicit increment for i here, the outer while loop handles it or the inner loops do.

    return spells

if __name__ == "__main__":
    parsed_data = parse_spells()
    with open("parsed_spells.json", "w", encoding='utf-8') as outfile:
        json.dump(parsed_data, outfile, indent=2)
    print("parsed_spells.json created successfully.")
