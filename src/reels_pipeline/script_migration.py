"""Script schema v2 migration -- backfill defaults for legacy roteiros.

Phase 24: Every roteiro loaded from DB or generated pre-v2 gets v2 fields
filled with safe defaults so downstream consumers never see missing fields.
"""

MOOD_DEFAULT = "calm"
TRANSITION_DEFAULT = "fade"


def migrate_legacy_roteiro(script: dict) -> dict:
    """Backfill v2 fields on legacy roteiros. Idempotent and pure.

    Fields added per cena (if missing):
    - image_prompt: copied from legenda_overlay (best available default)
    - mood: "calm"
    - transition_in: "fade"
    - transition_out: "fade"

    character_card: left absent for legacy (downstream uses .get()).
    """
    if not script or not script.get("cenas"):
        return script
    for cena in script["cenas"]:
        if "image_prompt" not in cena:
            cena["image_prompt"] = cena.get("legenda_overlay", "")
        if "mood" not in cena:
            cena["mood"] = MOOD_DEFAULT
        if "transition_in" not in cena:
            cena["transition_in"] = TRANSITION_DEFAULT
        if "transition_out" not in cena:
            cena["transition_out"] = TRANSITION_DEFAULT
    return script
