import json
import re
import os

# --- Configuration based on user feedback ---

# Directory for output files
OUTPUT_DIR = 'randomtables/items/'

# Mundane "adventuring goods" rarity tiers (in copper pieces)
MUNDANE_RARITY_TIERS = {
    'common': (0, 99),          # < 1 gp
    'uncommon': (100, 5000),    # 1 gp to 50 gp
    'rare': (5001, float('inf')) # > 50 gp
}

# "Treasure" item rarity tiers (in copper pieces)
TREASURE_RARITY_TIERS = {
    'common': (0, 50000),         # <= 500 gp
    'uncommon': (50001, 500000),  # 501 gp to 5,000 gp
    'rare': (500001, float('inf')) # > 5,000 gp
}

# Item category substrings to be classified as "Treasure"
TREASURE_CATEGORY_KEYWORDS = [
    'Gemstone',
    'Art Object',
    'Trade Good',
    'Trade Bar'
]

# Consolidated types for mundane items. Order matters: more specific keywords first.
MUNDANE_TYPE_MAP = {
    'Simple Weapon': 'weapons',
    'Martial Weapon': 'weapons',
    'Weapon': 'weapons',
    'Light Armor': 'armor',
    'Medium Armor': 'armor',
    'Heavy Armor': 'armor',
    'Shield': 'shields',
    'Artisan\'s Tools': 'tools',
    'Gaming Set': 'tools',
    'Instrument': 'tools',
    'Tool': 'tools',
    'Vehicle': 'vehicles',
    'Mount': 'mounts',
    'Food and Drink': 'food_and_drink',
    'Tack and Harness': 'tack_and_harness',
    'Ammunition': 'ammunition',
    'Explosive': 'explosives',
    'Poison': 'poisons',
    'Gemstone': 'gems',
    'Art Object': 'art_objects',
    'Trade Good': 'trade_goods',
    'Trade Bar': 'trade_bars',
    'Adventuring Gear': 'adventuring_gear', # Should be near the end as it's broad
    'Other': 'other_mundane' # Catch-all
}

# Map for magic item rarity abbreviations to full names
MAGIC_RARITY_MAP = {
    'Com.': 'common',
    'Unc.': 'uncommon',
    'Rare': 'rare',
    'V.Rare': 'very_rare',
    'Leg.': 'legendary',
    'Art.': 'artifact',
    'Unk.': 'unknown',
    'Var.': 'variable'
}

# Consolidated types for magic items.
MAGIC_TYPE_MAP = {
    'Wondrous Item': 'wondrous_items',
    'Weapon': 'weapons',
    'Armor': 'armor',
    'Ring': 'rings',
    'Staff': 'staves',
    'Rod': 'rods',
    'Potion': 'potions',
    'Scroll': 'scrolls',
    'Wand': 'wands',
    'Ammunition': 'ammunition',
    'Shield': 'shields'
}

# --- File Writing Logic ---

def write_json_file(filepath, data):
    """Writes a list of item objects to a JSON file in the specified format."""
    output_data = [{'text': item['name'], 'unique': False, 'used': []} for item in data]
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    print(f"Successfully wrote {len(output_data)} items to {filepath}")

def generate_rarity_files(items, tiers, prefix, output_dir):
    """Sorts items into rarity buckets and writes them to files."""
    rarity_buckets = {rarity: [] for rarity in tiers.keys()}

    for item in items:
        price = item.get('price_cp')
        if price is None:
            continue  # Skip items without a price for rarity sorting

        for rarity, (min_val, max_val) in tiers.items():
            if min_val <= price <= max_val:
                rarity_buckets[rarity].append(item)
                break

    for rarity, bucket_items in rarity_buckets.items():
        if not bucket_items:
            print(f"Skipping empty rarity file: {prefix}_{rarity}.json")
            continue
        filename = f"{prefix}_{rarity}.json"
        filepath = os.path.join(output_dir, filename)
        write_json_file(filepath, bucket_items)

def generate_type_files(items, type_map, prefix, output_dir):
    """Sorts items into type buckets and writes them to files."""
    type_buckets = {v: [] for v in type_map.values()}

    unmatched_items = []

    for item in items:
        matched = False
        # Use the ordered map to find the first, most specific match
        for keyword, type_name in type_map.items():
            if keyword in item['category']:
                type_buckets[type_name].append(item)
                matched = True
                break
        if not matched:
            # Fallback for items that don't match any primary keyword
            if 'other_mundane' in type_buckets:
                 type_buckets['other_mundane'].append(item)
            unmatched_items.append(item)

    if unmatched_items:
        print(f"Warning: {len(unmatched_items)} mundane items did not match a primary type category and were placed in 'other'.")

    for type_name, bucket_items in type_buckets.items():
        if not bucket_items:
            continue # Don't create empty files

        filename = f"{prefix}_{type_name}.json"
        filepath = os.path.join(output_dir, filename)
        write_json_file(filepath, bucket_items)

def generate_magic_rarity_files(items, output_dir):
    """Sorts magic items into rarity buckets and writes them to files."""
    rarity_buckets = {v: [] for v in MAGIC_RARITY_MAP.values()}

    for item in items:
        rarity_abbr = item.get('rarity')
        if rarity_abbr in MAGIC_RARITY_MAP:
            rarity_name = MAGIC_RARITY_MAP[rarity_abbr]
            rarity_buckets[rarity_name].append(item)
        else:
            print(f"Warning: Unknown rarity '{rarity_abbr}' for item '{item['name']}'.")

    for rarity_name, bucket_items in rarity_buckets.items():
        if not bucket_items:
            continue
        filename = f"magic_{rarity_name}.json"
        filepath = os.path.join(output_dir, filename)
        write_json_file(filepath, bucket_items)


# --- Parsing Logic ---

def parse_price_to_copper(price_str):
    """Converts a price string (e.g., '10 gp') to copper pieces."""
    price_str = price_str.strip().replace(',', '')
    if price_str == '—':
        return None

    try:
        value_str, unit = price_str.split()
        value = int(value_str)
    except ValueError:
        return None # Cannot parse

    if 'gp' in unit:
        return value * 100
    if 'sp' in unit:
        return value * 10
    if 'cp' in unit:
        return value
    return None

def parse_mundane_items():
    """
    Parses the mundaneitems.txt file. This file has an inconsistent structure,
    so we use heuristics to determine item boundaries. An item is assumed to be
    a block of text ending with a line containing a price (gp, sp, or cp).
    """
    try:
        with open('reference/mundaneitems.txt', 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines()]
    except FileNotFoundError:
        print("Error: reference/mundaneitems.txt not found.")
        return [], []

    all_items = []
    current_item_lines = []
    for line in lines:
        if not line:
            continue

        current_item_lines.append(line)

        # Heuristic: A price line indicates the end of an item's core data
        is_price_line = re.search(r'\d+\s+(gp|sp|cp)', line) or line == '—'

        if is_price_line and len(current_item_lines) >= 3:
            name = current_item_lines[0]
            # If the name is very long, it might have wrapped.
            # This is a simple implementation and doesn't handle that.
            category = ' '.join(current_item_lines[1:-1])
            price_str = current_item_lines[-1]

            # This is a flawed heuristic. Let's try another way.
            # New Heuristic: Assume Name is line 1, Category is line 2, Price is line 3.
            # This will be wrong for multi-line categories but might be more stable.
            name = current_item_lines[0]
            category = current_item_lines[1]
            price_str = current_item_lines[2]

            price_cp = parse_price_to_copper(price_str)

            all_items.append({
                'name': name,
                'category': category,
                'price_cp': price_cp
            })
            # We are done with this block. The rest of the lines in current_item_lines are weight/source.
            current_item_lines = []

    # Let's try a block-based approach again, it seems more reliable.
    # The previous attempt was abandoned too early.
    all_items = []
    i = 0
    while i < len(lines):
        if not lines[i]:
            i += 1
            continue

        # We need at least 4 lines for a valid item block
        if i + 3 >= len(lines):
            break

        name = lines[i]
        category = lines[i+1]
        price_str = lines[i+2]
        weight_str = lines[i+3] # We use this to check the block integrity

        # Basic validation of the block
        is_price = re.search(r'(gp|sp|cp)', price_str) or price_str == '—'
        is_weight = 'lb.' in weight_str or 'oz.' in weight_str or weight_str == '—'

        if is_price and is_weight:
            price_cp = parse_price_to_copper(price_str)
            all_items.append({
                'name': name,
                'category': category,
                'price_cp': price_cp,
            })
            # Assume the 5th line is always source, so we always skip it.
            # This means we advance by 5 if the source is present.
            # Let's check if the 5th line exists and is not a new item name.
            if i + 5 < len(lines) and not (re.search(r'(gp|sp|cp)', lines[i+5]) or lines[i+5] == '—'):
                 i += 5 # Skip source line, as it's not a price for the next item
            else:
                 i += 4
        else:
            # The block is not what we expect, skip a line and try again to resync.
            i += 1

    treasure_items = []
    adventuring_goods = []
    for item in all_items:
        if item.get('price_cp') is None:
            # Items without a price are considered adventuring goods
            adventuring_goods.append(item)
            continue

        is_treasure = any(keyword in item['category'] for keyword in TREASURE_CATEGORY_KEYWORDS)
        if is_treasure:
            treasure_items.append(item)
        else:
            adventuring_goods.append(item)

    return adventuring_goods, treasure_items


def parse_magic_items():
    """
    Parses magicitems.txt using the user-provided logic:
    1. Line 1 is Name.
    2. Line 2 is Category.
    3. Find the next Rarity string.
    4. Skip 1 line (source).
    5. The next line is the start of the next item.
    """
    try:
        with open('reference/magicitems.txt', 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
    except FileNotFoundError:
        print("Error: reference/magicitems.txt not found.")
        return []

    items = []
    i = 0
    rarity_anchors = {'Com.', 'Unc.', 'Rare', 'V.Rare', 'Leg.', 'Art.', 'Unk.', 'Var.'}

    while i < len(lines):
        # Step 1 & 2: Get name and category
        if i + 1 >= len(lines): break
        name = lines[i]
        category = lines[i+1]

        # Step 3: Find the next rarity line
        rarity = None
        rarity_index = -1
        search_index = i + 2

        while search_index < len(lines):
            potential_rarity = lines[search_index]
            if potential_rarity in rarity_anchors:
                rarity = potential_rarity
                rarity_index = search_index
                break
            search_index += 1

        if rarity:
            # Found a valid item
            items.append({
                'name': name,
                'category': category,
                'rarity': rarity
            })
            # Step 4 & 5: The next item starts 2 lines after the rarity
            i = rarity_index + 2
        else:
            # No rarity found for this block, assume malformed and advance
            i += 1

    return items


def main():
    """Main function to run the parsing and file writing."""
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("--- Parsing Mundane Items ---")
    adventuring_goods, treasure_items = parse_mundane_items()
    print(f"Found {len(adventuring_goods)} adventuring goods and {len(treasure_items)} treasure items.")

    print("\n--- Generating Mundane Item JSON Files by Rarity ---")
    generate_rarity_files(adventuring_goods, MUNDANE_RARITY_TIERS, 'mundane', OUTPUT_DIR)
    generate_rarity_files(treasure_items, TREASURE_RARITY_TIERS, 'treasure', OUTPUT_DIR)

    print("\n--- Generating Mundane Item JSON Files by Type ---")
    all_mundane_items = adventuring_goods + treasure_items
    generate_type_files(all_mundane_items, MUNDANE_TYPE_MAP, 'mundane', OUTPUT_DIR)

    print("\n--- Parsing Magic Items ---")
    magic_items = parse_magic_items()
    print(f"Found {len(magic_items)} magic items.")

    print("\n--- Generating Magic Item JSON Files by Rarity ---")
    generate_magic_rarity_files(magic_items, OUTPUT_DIR)

    print("\n--- Generating Magic Item JSON Files by Type ---")
    generate_type_files(magic_items, MAGIC_TYPE_MAP, 'magic', OUTPUT_DIR)

    print("\nProcessing complete.")


if __name__ == "__main__":
    main()
