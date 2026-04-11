"""SFX library for Product Studio v2 cinematic ads.

Static catalog of royalty-free sound effects bundled in assets/sfx/.
Categories: asmr (crunch, sizzle, pour), epic (hits, risers, whoosh), ambient (warmth, nature, urban).

Each SFX entry maps to a file in assets/sfx/{category}/{filename}. Files are
NOT committed via this plan — operator must add them per assets/sfx/README.md.
"""

import os
from typing import Optional

# Path to bundled SFX assets relative to project root
SFX_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets", "sfx")


SFX_CATALOG: list[dict] = [
    # ASMR — food/beauty close-ups
    {"id": "asmr_crunch_01", "name": "Cookie Crunch", "category": "asmr", "subcategory": "crunch",
     "duration": 1.2, "file_path": "asmr/crunch_cookie.mp3",
     "suggested_product_categories": ["food_cookies"]},
    {"id": "asmr_sizzle_01", "name": "Burger Sizzle", "category": "asmr", "subcategory": "sizzle",
     "duration": 2.0, "file_path": "asmr/sizzle_burger.mp3",
     "suggested_product_categories": ["food_burger"]},
    {"id": "asmr_pour_01", "name": "Chocolate Pour", "category": "asmr", "subcategory": "pour",
     "duration": 2.5, "file_path": "asmr/pour_chocolate.mp3",
     "suggested_product_categories": ["food_chocolate", "beverage"]},
    {"id": "asmr_drop_01", "name": "Serum Drop", "category": "asmr", "subcategory": "drop",
     "duration": 0.8, "file_path": "asmr/drop_serum.mp3",
     "suggested_product_categories": ["beauty_skincare"]},
    {"id": "asmr_ice_01", "name": "Ice Cubes", "category": "asmr", "subcategory": "pour",
     "duration": 1.5, "file_path": "asmr/ice_cubes.mp3",
     "suggested_product_categories": ["beverage"]},

    # Epic — tech/fashion dramatic hits
    {"id": "epic_hit_01", "name": "Impact Hit", "category": "epic", "subcategory": "hit",
     "duration": 0.7, "file_path": "epic/hit_impact.mp3",
     "suggested_product_categories": ["tech_electronics", "fashion_shoes"]},
    {"id": "epic_riser_01", "name": "Build-up Riser", "category": "epic", "subcategory": "riser",
     "duration": 3.0, "file_path": "epic/riser_buildup.mp3",
     "suggested_product_categories": ["tech_electronics", "fashion_shoes"]},
    {"id": "epic_whoosh_01", "name": "Whoosh Pass", "category": "epic", "subcategory": "whoosh",
     "duration": 0.9, "file_path": "epic/whoosh_pass.mp3",
     "suggested_product_categories": ["fashion_shoes", "tech_electronics"]},
    {"id": "epic_boom_01", "name": "Bass Boom", "category": "epic", "subcategory": "hit",
     "duration": 1.1, "file_path": "epic/boom_bass.mp3",
     "suggested_product_categories": ["tech_electronics"]},

    # Ambient — lifestyle warmth
    {"id": "ambient_warmth_01", "name": "Warm Ambient Pad", "category": "ambient", "subcategory": "warmth",
     "duration": 30.0, "file_path": "ambient/warmth_pad.mp3",
     "suggested_product_categories": ["food_cookies", "food_chocolate", "beauty_skincare"]},
    {"id": "ambient_nature_01", "name": "Nature Breeze", "category": "ambient", "subcategory": "nature",
     "duration": 30.0, "file_path": "ambient/nature_breeze.mp3",
     "suggested_product_categories": ["beauty_skincare", "beverage"]},
    {"id": "ambient_urban_01", "name": "Urban Cafe", "category": "ambient", "subcategory": "urban",
     "duration": 30.0, "file_path": "ambient/urban_cafe.mp3",
     "suggested_product_categories": ["beverage", "food_burger"]},
]


def get_sfx_by_id(sfx_id: str) -> Optional[dict]:
    """Return SFX entry by id, or None if not found."""
    for entry in SFX_CATALOG:
        if entry["id"] == sfx_id:
            return entry
    return None


def get_sfx_by_category(category: str, product_category: Optional[str] = None) -> list[dict]:
    """Return all SFX in a category, optionally filtered by product category."""
    results = [e for e in SFX_CATALOG if e["category"] == category]
    if product_category:
        results = [e for e in results if product_category in e["suggested_product_categories"]]
    return results


def auto_select_sfx_for_product(product_category: str) -> dict:
    """Return default SFX selection for a product category.

    Returns dict with keys: ambient_id, hit_ids (list of hit SFX ids suitable for takes).
    """
    # Pick first ambient SFX matching the product category
    ambient_candidates = get_sfx_by_category("ambient", product_category)
    ambient_id = ambient_candidates[0]["id"] if ambient_candidates else SFX_CATALOG[9]["id"]

    # Pick ASMR hits for food/beauty, epic hits for tech/fashion
    if product_category.startswith("food_") or product_category == "beauty_skincare" or product_category == "beverage":
        hit_candidates = get_sfx_by_category("asmr", product_category)
    else:
        hit_candidates = get_sfx_by_category("epic", product_category)

    hit_ids = [h["id"] for h in hit_candidates[:3]]
    return {"ambient_id": ambient_id, "hit_ids": hit_ids}


def resolve_sfx_path(sfx_id: str) -> Optional[str]:
    """Return absolute path to SFX file, or None if not found on disk."""
    entry = get_sfx_by_id(sfx_id)
    if not entry:
        return None
    path = os.path.join(SFX_ROOT, entry["file_path"])
    return path if os.path.exists(path) else None
