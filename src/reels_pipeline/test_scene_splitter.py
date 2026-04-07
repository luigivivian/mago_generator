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
    """An 18s cena with sufficient word density should split into sub-cenas.

    LONG_SCRIPT cena 1 has 13 words in 18s = 0.72 w/s (above the 0.5 w/s
    word-starved threshold), so it splits. Number of splits is capped by
    word budget: 13 words / 3 min words-per-sub = 4 sub-cenas max (even
    though ideal by duration would be 6).
    """
    new_script, new_timings = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    # Original 3 cenas, middle one (18s, 13 words) splits into 4 sub-cenas
    assert len(new_script["cenas"]) == 6
    assert len(new_timings) == 6


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
    # Middle 4 sub-cenas (indices 1-4) all came from original cena 1
    parent_overlay = LONG_SCRIPT["cenas"][1]["legenda_overlay"]
    for i in range(1, 5):
        assert new_script["cenas"][i]["legenda_overlay"] == parent_overlay
        assert new_script["cenas"][i]["_split_parent_idx"] == 1
        assert new_script["cenas"][i]["_split_total"] == 4


def test_split_narration_proportional():
    """Each sub-cena gets a slice of the parent narration."""
    new_script, _ = split_long_scenes_in_script(LONG_SCRIPT, LONG_TIMINGS)
    # Sub-cenas 1-4 (middle cena split into 4) should each have non-empty narration
    for i in range(1, 5):
        assert new_script["cenas"][i]["narracao"], (
            f"sub-cena {i} has empty narration"
        )


def test_no_split_when_under_cap():
    """If max_duration is set high enough, nothing splits."""
    _, new_timings = split_long_scenes_in_script(
        LONG_SCRIPT, LONG_TIMINGS, max_duration=30.0,
    )
    assert len(new_timings) == 3  # No splits


# ── Word-starved regression (reel 034 cena 0 / cena 11) ─────────────────

WORD_STARVED_SCRIPT = {
    "narracao_completa": (
        "Hook that absorbed preamble here. "
        "Sobre o abismo, trevas. Espirito de Deus pairava. "
        "Middle cena with enough words to be split normally if it were long. "
        "No sétimo dia, Deus abençoou e descansou."
    ),
    "cenas": [
        {"imagem_index": 0, "duracao_segundos": 3.0,
         "narracao": "Sobre o abismo, trevas. Espirito de Deus pairava.",
         "legenda_overlay": "cosmic void"},
        {"imagem_index": 1, "duracao_segundos": 3.0,
         "narracao": "Middle cena.",
         "legenda_overlay": "mid scene"},
        {"imagem_index": 2, "duracao_segundos": 3.0,
         "narracao": "No sétimo dia, Deus abençoou e descansou.",
         "legenda_overlay": "rest day"},
    ],
}

WORD_STARVED_TIMINGS = [
    # Cena 0 spans 19s (absorbed hook preamble) but has only 7 words.
    # Should NOT be split into 1-word chunks.
    {"index": 0, "start": 0.0, "end": 19.0, "duration": 19.0,
     "narracao": "Sobre o abismo, trevas. Espirito de Deus pairava."},
    {"index": 1, "start": 19.0, "end": 22.0, "duration": 3.0,
     "narracao": "Middle cena."},
    # Cena 2 spans 22s (absorbed lesson/CTA suffix) but has only 7 words.
    # Should NOT be split.
    {"index": 2, "start": 22.0, "end": 44.0, "duration": 22.0,
     "narracao": "No sétimo dia, Deus abençoou e descansou."},
]


def test_word_starved_long_cena_is_not_split():
    """Regression (reel 034): cena with long duration but few words (hook/CTA
    that absorbed preamble) must NOT be split into 1-word sub-cenas."""
    new_script, new_timings = split_long_scenes_in_script(
        WORD_STARVED_SCRIPT, WORD_STARVED_TIMINGS,
    )
    # All 3 original cenas should pass through — none should be split
    assert len(new_script["cenas"]) == 3, (
        f"word-starved cenas should not split, got {len(new_script['cenas'])} cenas"
    )
    # Cena 0 (19s hook) and cena 2 (22s CTA) are the word-starved cases;
    # both must retain their original narration verbatim (no splitting).
    assert new_script["cenas"][0]["narracao"] == (
        "Sobre o abismo, trevas. Espirito de Deus pairava."
    )
    assert new_script["cenas"][2]["narracao"] == (
        "No sétimo dia, Deus abençoou e descansou."
    )
    # The long duration is preserved (not shrunk)
    assert new_timings[0]["duration"] == 19.0
    assert new_timings[2]["duration"] == 22.0


def test_long_cena_with_enough_words_still_splits():
    """Sanity check: word-count gate should NOT prevent splitting cenas
    that legitimately have enough text."""
    script = {
        "cenas": [{
            "imagem_index": 0, "duracao_segundos": 18.0,
            "narracao": (
                "one two three four five six seven eight nine ten "
                "eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen"
            ),
            "legenda_overlay": "wide shot",
        }],
    }
    timings = [{
        "index": 0, "start": 0.0, "end": 18.0, "duration": 18.0,
        "narracao": (
            "one two three four five six seven eight nine ten "
            "eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen"
        ),
    }]
    new_script, new_timings = split_long_scenes_in_script(script, timings)
    # 18s / 3s target = 6 splits, 18 words / 6 = 3 words each ≥ 3 min → OK
    assert len(new_script["cenas"]) == 6
    for c in new_script["cenas"]:
        assert len(c["narracao"].split()) >= 3


def test_partial_split_when_words_limit():
    """When word budget caps the ideal split count, use fewer splits.

    15 words in 12s = 1.25 w/s (above word-starved threshold). Ideal
    splits by duration = ceil(12/3) = 4. Word budget = 15/3 = 5. Limit
    is 4 (duration-driven). Each sub-cena gets ~3s and ~4 words.
    """
    script = {
        "cenas": [{
            "imagem_index": 0, "duracao_segundos": 12.0,
            "narracao": (
                "one two three four five six seven eight "
                "nine ten eleven twelve thirteen fourteen fifteen"
            ),
            "legenda_overlay": "whatever",
        }],
    }
    timings = [{
        "index": 0, "start": 0.0, "end": 12.0, "duration": 12.0,
        "narracao": (
            "one two three four five six seven eight "
            "nine ten eleven twelve thirteen fourteen fifteen"
        ),
    }]
    new_script, _ = split_long_scenes_in_script(script, timings)
    # 15 words / 12s = 1.25 w/s (not starved). ideal splits = 4, word
    # budget = 5, min = 4. Each sub-cena gets ~3 words.
    assert len(new_script["cenas"]) == 4
    for c in new_script["cenas"]:
        assert len(c["narracao"].split()) >= 3


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
