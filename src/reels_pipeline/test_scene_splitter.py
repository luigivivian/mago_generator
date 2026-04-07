"""Tests for scene_splitter.split_long_scenes_in_script.

LLM variation generation (regenerate_split_legenda_overlays) is NOT tested
here — it requires a live Gemini call. Pure splitter logic is fully covered.
"""

from src.reels_pipeline.scene_splitter import (
    SCENE_MAX_DURATION,
    _split_narration,
    split_long_scenes_in_script,
)


# ── Fixtures ─────────────────────────────────────────────────────────────

SHORT_SCRIPT = {
    "narracao_completa": "Cena um. Cena dois. Cena tres.",
    "cenas": [
        {"imagem_index": 0, "duracao_segundos": 3.0, "narracao": "Cena um.",
         "legenda_overlay": "wide shot of forest at dawn"},
        {"imagem_index": 1, "duracao_segundos": 3.0, "narracao": "Cena dois.",
         "legenda_overlay": "close-up of dewdrop on leaf"},
        {"imagem_index": 2, "duracao_segundos": 3.0, "narracao": "Cena tres.",
         "legenda_overlay": "wizard walking through trees"},
    ],
}

SHORT_TIMINGS = [
    {"index": 0, "start": 0.0, "end": 3.0, "duration": 3.0, "narracao": "Cena um."},
    {"index": 1, "start": 3.0, "end": 6.0, "duration": 3.0, "narracao": "Cena dois."},
    {"index": 2, "start": 6.0, "end": 9.0, "duration": 3.0, "narracao": "Cena tres."},
]


def test_short_scenes_are_passthrough():
    """Cenas under SCENE_MAX_DURATION should not be split."""
    new_script, new_timings = split_long_scenes_in_script(SHORT_SCRIPT, SHORT_TIMINGS)
    assert len(new_script["cenas"]) == 3
    assert len(new_timings) == 3
    # Indices reindexed sequentially (already were 0/1/2 here, so unchanged)
    for i, c in enumerate(new_script["cenas"]):
        assert c["imagem_index"] == i


# ── Splitting a long cena ────────────────────────────────────────────────

LONG_SCRIPT = {
    "narracao_completa": (
        "Sobre o abismo trevas. Espirito de Deus pairava. "
        "Imagine voce ali. Vazio profundo, vento gelado, escuridao total, "
        "silencio absoluto, presenca divina. Entao, surgiu a luz."
    ),
    "cenas": [
        {"imagem_index": 0, "duracao_segundos": 3.0,
         "narracao": "Sobre o abismo trevas. Espirito de Deus pairava.",
         "legenda_overlay": "cosmic void with faint divine light"},
        {"imagem_index": 1, "duracao_segundos": 18.0,
         "narracao": (
             "Imagine voce ali. Vazio profundo, vento gelado, "
             "escuridao total, silencio absoluto, presenca divina."
         ),
         "legenda_overlay": "wide shot of darkness with hints of divine presence"},
        {"imagem_index": 2, "duracao_segundos": 3.0,
         "narracao": "Entao, surgiu a luz.",
         "legenda_overlay": "explosion of golden light dispersing the void"},
    ],
}

LONG_TIMINGS = [
    {"index": 0, "start": 0.0, "end": 3.0, "duration": 3.0,
     "narracao": "Sobre o abismo trevas. Espirito de Deus pairava."},
    {"index": 1, "start": 3.0, "end": 21.0, "duration": 18.0,
     "narracao": (
         "Imagine voce ali. Vazio profundo, vento gelado, "
         "escuridao total, silencio absoluto, presenca divina."
     )},
    {"index": 2, "start": 21.0, "end": 24.0, "duration": 3.0,
     "narracao": "Entao, surgiu a luz."},
]


def test_long_cena_gets_split():
    """An 18s cena should split into multiple ~3s sub-cenas."""
    new_script, new_timings = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    # Original 3 cenas, middle one (18s) becomes 6 sub-cenas (18/3 = 6)
    assert len(new_script["cenas"]) == 8
    assert len(new_timings) == 8


def test_split_cenas_have_sequential_indices():
    """imagem_index must be reindexed 0..N-1 after splitting."""
    new_script, _ = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    for i, c in enumerate(new_script["cenas"]):
        assert c["imagem_index"] == i, (
            f"cena {i} has imagem_index={c['imagem_index']}"
        )


def test_split_timings_are_monotonic_and_contiguous():
    """No gaps, no overlaps in the new timings."""
    _, new_timings = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    for i in range(len(new_timings) - 1):
        assert new_timings[i]["end"] == new_timings[i + 1]["start"], (
            f"gap between {i} and {i+1}"
        )


def test_split_total_duration_preserved():
    """Sum of split sub-cena durations must equal the original cena duration."""
    _, new_timings = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    total_after = sum(t["duration"] for t in new_timings)
    total_before = sum(t["duration"] for t in LONG_TIMINGS)
    assert abs(total_after - total_before) < 0.01


def test_split_inherits_legenda_overlay():
    """Sub-cenas inherit the parent's legenda_overlay (caller can replace via LLM)."""
    new_script, _ = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    # Middle 6 sub-cenas (indices 1-6) all came from original cena 1
    parent_overlay = LONG_SCRIPT["cenas"][1]["legenda_overlay"]
    for i in range(1, 7):
        assert new_script["cenas"][i]["legenda_overlay"] == parent_overlay
        assert new_script["cenas"][i]["_split_parent_idx"] == 1
        assert new_script["cenas"][i]["_split_total"] == 6


def test_split_narration_proportional():
    """Each sub-cena gets a slice of the parent narration."""
    new_script, _ = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    # Sub-cenas 1-6 should each have non-empty narration
    for i in range(1, 7):
        assert new_script["cenas"][i]["narracao"], (
            f"sub-cena {i} has empty narration"
        )


def test_no_split_when_under_cap():
    """If max_duration is set high enough, nothing splits."""
    _, new_timings = split_long_scenes_in_script(
        LONG_SCRIPT, LONG_TIMINGS, max_duration=30.0,
    )
    assert len(new_timings) == 3  # No splits


# ── Narration text splitter ──────────────────────────────────────────────

def test_split_narration_by_sentences():
    """When there are enough sentences, split on sentence boundaries."""
    text = "First. Second. Third. Fourth."
    parts = _split_narration(text, 2)
    assert len(parts) == 2
    # All parts non-empty
    assert all(p for p in parts)
    # Reassembled should contain all sentences
    rejoined = " ".join(parts)
    for word in ["First", "Second", "Third", "Fourth"]:
        assert word in rejoined


def test_split_narration_by_words_when_few_sentences():
    """When there are fewer sentences than parts, split on word boundaries."""
    text = "one two three four five six seven eight nine ten"
    parts = _split_narration(text, 5)
    assert len(parts) == 5
    # Each part non-empty
    assert all(p for p in parts)


def test_split_narration_empty_input():
    """Empty input gives N empty strings."""
    parts = _split_narration("", 3)
    assert parts == ["", "", ""]


def test_split_narration_single_part():
    """n_parts=1 returns the input unchanged."""
    parts = _split_narration("hello world", 1)
    assert parts == ["hello world"]
