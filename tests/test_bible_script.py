"""Tests for Phase 1001: Biblical reels pipeline.

Covers:
- BIBLE_STORIES data integrity (count, testament split, required fields, unique keys)
- BIBLE_VERSIONS and BIBLE_HASHTAGS constants
- get_story_by_key() lookup
- parse_manual_script() parsing and schema compliance
- Verse reference regex detection
- _BIBLE_SYSTEM_PROMPTS and _get_bible_system_prompt (requires Plan 02)
"""

import re

import pytest

from src.reels_pipeline.bible_stories import (
    BIBLE_STORIES,
    BIBLE_VERSIONS,
    BIBLE_HASHTAGS,
    parse_manual_script,
    get_story_by_key,
)
from src.reels_pipeline.script_gen import ROTEIRO_SCHEMA


# ── BIBLE_STORIES data integrity ─────────────────────────────────────────────


def test_bible_stories_count():
    assert len(BIBLE_STORIES) == 25


def test_bible_stories_testament_split():
    ot = [s for s in BIBLE_STORIES.values() if s["testament"] == "OT"]
    nt = [s for s in BIBLE_STORIES.values() if s["testament"] == "NT"]
    assert len(ot) == 14
    assert len(nt) == 11


def test_bible_stories_required_fields():
    required = {"ref", "title_pt", "title_en", "title_es", "testament"}
    for key, story in BIBLE_STORIES.items():
        for field in required:
            assert field in story, f"Story '{key}' missing field '{field}'"


def test_bible_stories_keys_unique():
    keys = list(BIBLE_STORIES.keys())
    assert len(keys) == len(set(keys)), "Duplicate keys found in BIBLE_STORIES"


# ── BIBLE_VERSIONS and BIBLE_HASHTAGS ────────────────────────────────────────


def test_bible_versions():
    assert BIBLE_VERSIONS["pt-BR"] == "NVI"
    assert BIBLE_VERSIONS["en-US"] == "NIV"
    assert BIBLE_VERSIONS["es-ES"] == "NVI"


def test_bible_hashtags():
    assert len(BIBLE_HASHTAGS) >= 6
    for tag in BIBLE_HASHTAGS:
        assert tag.startswith("#"), f"Hashtag '{tag}' does not start with #"


# ── get_story_by_key ─────────────────────────────────────────────────────────


def test_get_story_by_key_found():
    story = get_story_by_key("david-goliath")
    assert story is not None
    assert isinstance(story, dict)
    assert story["ref"] == "1 Samuel 17"


def test_get_story_by_key_not_found():
    assert get_story_by_key("nonexistent") is None


# ── parse_manual_script ──────────────────────────────────────────────────────


def test_parse_manual_script_basic():
    text = "Davi saiu ao campo.\n\nGolias o desafiou.\n\nDavi lancou a pedra."
    result = parse_manual_script(text, 30)
    assert len(result["cenas"]) == 3
    assert result["cenas"][0]["imagem_index"] == 0
    assert result["cenas"][1]["imagem_index"] == 1
    assert result["cenas"][2]["imagem_index"] == 2
    assert abs(result["cenas"][0]["duracao_segundos"] - 10.0) < 0.1


def test_parse_manual_script_dashes():
    text = "Parte um.---Parte dois.---Parte tres."
    result = parse_manual_script(text, 60)
    assert len(result["cenas"]) == 3
    assert abs(result["cenas"][0]["duracao_segundos"] - 20.0) < 0.1


def test_parse_manual_script_empty():
    result = parse_manual_script("", 30)
    # Empty text produces no paragraphs, so cenas is empty list
    assert isinstance(result["cenas"], list)
    assert result["titulo"] == "Historia Biblica"


def test_parse_manual_script_schema_completeness():
    result = parse_manual_script("Test paragraph", 30)
    required = ROTEIRO_SCHEMA["required"]
    for field in required:
        assert field in result, f"Missing required field: {field}"


def test_parse_manual_script_cena_fields():
    result = parse_manual_script("Scene one.\n\nScene two.", 20)
    cena_required = {"imagem_index", "duracao_segundos", "narracao", "legenda_overlay"}
    for cena in result["cenas"]:
        for field in cena_required:
            assert field in cena, f"Cena missing field: {field}"


# ── Verse reference regex ────────────────────────────────────────────────────

VERSE_PATTERN = re.compile(r'\d?\s*[A-Z][a-zA-Z\u00e1\u00e0\u00e3\u00e9\u00ea\u00ed\u00f3\u00f4\u00fa]+\s+\d+:\d+(?:-\d+)?')


def test_verse_regex_1samuel():
    assert VERSE_PATTERN.search("1 Samuel 17:40")


def test_verse_regex_genesis_range():
    assert VERSE_PATTERN.search("Genesis 22:1-19")


def test_verse_regex_john():
    assert VERSE_PATTERN.search("John 3:16")


def test_verse_regex_2reis():
    assert VERSE_PATTERN.search("2 Reis 5:14")


def test_verse_regex_no_match_text():
    assert VERSE_PATTERN.search("hello world") is None


def test_verse_regex_no_match_numbers():
    assert VERSE_PATTERN.search("123") is None


# ── _BIBLE_SYSTEM_PROMPTS and _get_bible_system_prompt (Plan 02 dependency) ─


def _try_import_bible_prompts():
    """Try to import Plan 02 additions. Returns (prompts_dict, func) or None."""
    try:
        from src.reels_pipeline.script_gen import _BIBLE_SYSTEM_PROMPTS, _get_bible_system_prompt
        return _BIBLE_SYSTEM_PROMPTS, _get_bible_system_prompt
    except ImportError:
        return None


_bible_prompt_imports = _try_import_bible_prompts()
_skip_plan02 = pytest.mark.skipif(
    _bible_prompt_imports is None,
    reason="Requires Plan 02 (_BIBLE_SYSTEM_PROMPTS not yet in script_gen.py)"
)


@_skip_plan02
def test_bible_system_prompts_exist():
    prompts, _ = _bible_prompt_imports
    assert "pt-BR" in prompts
    assert "en-US" in prompts
    assert "es-ES" in prompts


@_skip_plan02
def test_bible_system_prompt_guardrails_pt():
    prompts, _ = _bible_prompt_imports
    pt_prompt = prompts["pt-BR"]
    assert "NAO invente fatos" in pt_prompt or "nao invente" in pt_prompt.lower()


@_skip_plan02
def test_bible_system_prompt_guardrails_en():
    prompts, _ = _bible_prompt_imports
    en_prompt = prompts["en-US"]
    assert "Do NOT invent" in en_prompt or "do not invent" in en_prompt.lower()


@_skip_plan02
def test_get_bible_system_prompt_basic():
    _, get_prompt = _bible_prompt_imports
    cfg = {
        "bible_config": {"story_ref": "1 Samuel 17", "include_reflection": True, "bible_version": "NVI"},
        "script_language": "pt-BR",
        "target_duration": 60,
    }
    prompt = get_prompt(cfg)
    assert "1 Samuel 17" in prompt
    assert "NVI" in prompt
    assert isinstance(prompt, str)
    assert len(prompt) > 100


@_skip_plan02
def test_get_bible_system_prompt_reflection_on():
    _, get_prompt = _bible_prompt_imports
    cfg = {
        "bible_config": {"story_ref": "Genesis 1-2", "include_reflection": True, "bible_version": "NVI"},
        "script_language": "pt-BR",
        "target_duration": 60,
    }
    prompt = get_prompt(cfg)
    assert "reflexao" in prompt.lower() or "reflection" in prompt.lower()


@_skip_plan02
def test_get_bible_system_prompt_reflection_off():
    _, get_prompt = _bible_prompt_imports
    cfg = {
        "bible_config": {"story_ref": "Genesis 1-2", "include_reflection": False, "bible_version": "NVI"},
        "script_language": "pt-BR",
        "target_duration": 60,
    }
    prompt = get_prompt(cfg)
    assert "NAO inclua reflexao" in prompt or "do not include" in prompt.lower() or "sem reflexao" in prompt.lower()


@_skip_plan02
def test_get_bible_system_prompt_defaults():
    _, get_prompt = _bible_prompt_imports
    cfg = {
        "bible_config": {"story_ref": "John 3:16"},
    }
    prompt = get_prompt(cfg)
    assert isinstance(prompt, str)
    assert len(prompt) > 50
