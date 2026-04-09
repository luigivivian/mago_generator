"""Phase 24: Script Schema v2 -- validation suite.

Wave 0 (plan 24-01) creates all 10 tests as xfail stubs.
Waves 1-3 (plans 24-02..24-04) flip owned tests from xfail -> active.

DO NOT rename a test without updating 24-VALIDATION.md.
"""

from __future__ import annotations

import pytest

from src.reels_pipeline.script_gen import ROTEIRO_SCHEMA


# ---------------------------------------------------------------------------
# SCRIPT-01 -- character_card present in ROTEIRO_SCHEMA
# Bound to: 24-02 Plan (Wave 1), ROTEIRO_SCHEMA extension
# ---------------------------------------------------------------------------

def test_01_character_card_in_schema():
    """SCRIPT-01: character_card present in schema with description and style_seed."""
    props = ROTEIRO_SCHEMA["properties"]
    assert "character_card" in props
    cc_props = props["character_card"]["properties"]
    assert "description" in cc_props
    assert "style_seed" in cc_props
    assert "character_card" not in ROTEIRO_SCHEMA["required"]


# ---------------------------------------------------------------------------
# SCRIPT-02 -- image_prompt field per cena
# Bound to: 24-02 Plan (Wave 1), ROTEIRO_SCHEMA cenas.items extension
# ---------------------------------------------------------------------------

def test_02_image_prompt_per_cena():
    """SCRIPT-02: image_prompt of type STRING in cenas.items and required."""
    cena_props = ROTEIRO_SCHEMA["properties"]["cenas"]["items"]["properties"]
    assert "image_prompt" in cena_props
    assert cena_props["image_prompt"]["type"] == "STRING"
    assert "image_prompt" in ROTEIRO_SCHEMA["properties"]["cenas"]["items"]["required"]


# ---------------------------------------------------------------------------
# SCRIPT-03 -- mood enum field per cena (7 values)
# Bound to: 24-02 Plan (Wave 1), ROTEIRO_SCHEMA cenas.items extension
# ---------------------------------------------------------------------------

def test_03_mood_enum():
    """SCRIPT-03: mood enum with exactly 7 values in cenas.items."""
    cena_props = ROTEIRO_SCHEMA["properties"]["cenas"]["items"]["properties"]
    assert "mood" in cena_props
    assert cena_props["mood"]["type"] == "STRING"
    assert cena_props["mood"]["enum"] == ["mysterious", "dramatic", "hopeful", "tense", "calm", "sad", "epic"]


# ---------------------------------------------------------------------------
# SCRIPT-04 -- transition_in / transition_out enum per cena (4 values)
# Bound to: 24-02 Plan (Wave 1), ROTEIRO_SCHEMA cenas.items extension
# ---------------------------------------------------------------------------

def test_04_transitions_enum():
    """SCRIPT-04: transition_in and transition_out enums with 4 values each, both required."""
    cena_props = ROTEIRO_SCHEMA["properties"]["cenas"]["items"]["properties"]
    cena_required = ROTEIRO_SCHEMA["properties"]["cenas"]["items"]["required"]
    assert cena_props["transition_in"]["enum"] == ["fade", "cut", "dissolve", "slide"]
    assert cena_props["transition_out"]["enum"] == ["fade", "cut", "dissolve", "slide"]
    assert "transition_in" in cena_required
    assert "transition_out" in cena_required


# ---------------------------------------------------------------------------
# SCRIPT-05 -- System prompts updated with v2 field instructions
# Bound to: 24-03 Plan (Wave 2), prompt template updates
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Wave 2 stub", strict=True)
def test_05_system_prompts_updated():
    """SCRIPT-05: all 7 prompt templates contain image_prompt and mood instructions."""
    pytest.fail("Wave 2 will implement")


# ---------------------------------------------------------------------------
# SCRIPT-06 -- Legacy migration fills defaults
# Bound to: 24-04 Plan (Wave 3), migrate_legacy_roteiro()
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Wave 3 stub", strict=True)
def test_06_legacy_migration():
    """SCRIPT-06: migrate_legacy_roteiro adds mood, transitions, and image_prompt defaults."""
    pytest.fail("Wave 3 will implement")


# ---------------------------------------------------------------------------
# Extra -- Migration idempotency
# Bound to: 24-04 Plan (Wave 3), migrate_legacy_roteiro()
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Wave 3 stub", strict=True)
def test_07_migration_idempotent():
    """Extra: running migrate_legacy_roteiro twice produces same result."""
    pytest.fail("Wave 3 will implement")


# ---------------------------------------------------------------------------
# Extra -- Manual bible script includes v2 fields
# Bound to: 24-04 Plan (Wave 3), parse_manual_script() update
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Wave 3 stub", strict=True)
def test_08_manual_bible_script_has_v2_fields():
    """Extra: parse_manual_script output cenas contain v2 fields."""
    pytest.fail("Wave 3 will implement")


# ---------------------------------------------------------------------------
# Extra -- character_card is optional (not in required list)
# Bound to: 24-02 Plan (Wave 1), ROTEIRO_SCHEMA extension
# ---------------------------------------------------------------------------

def test_09_schema_character_card_optional():
    """Extra: character_card is NOT in ROTEIRO_SCHEMA required list."""
    assert "character_card" not in ROTEIRO_SCHEMA["required"]
    assert "character_card" in ROTEIRO_SCHEMA["properties"]


# ---------------------------------------------------------------------------
# Extra -- image_prompt distinct from legenda_overlay in prompts
# Bound to: 24-03 Plan (Wave 2), prompt template updates
# ---------------------------------------------------------------------------

@pytest.mark.xfail(reason="Wave 2 stub", strict=True)
def test_10_image_prompt_distinct_from_overlay():
    """Extra: system prompts distinguish image_prompt from legenda_overlay."""
    pytest.fail("Wave 2 will implement")
