"""Contract tests for align_srt_with_script.

These tests encode the contract that align_srt_with_script:
1. Returns the input SRT byte-for-byte (no rebucketing, no rewrap).
2. Emits scene_timings with index/start/end/duration/narracao per cena.
3. Maps each cena.narracao via character offset in narracao_completa,
   then snaps the proportional time to nearest SRT chunk boundaries.
4. Handles preamble/lesson/CTA text that exists in narracao_completa
   but not in any individual cena (the "42% gap" — see project memory
   project_narracao_completa_structure.md).
5. Falls back to uniform distribution when narracao_completa is missing.
6. Returns a tuple even when cenas list is empty (no bare-str return).
"""

from src.reels_pipeline.transcriber import align_srt_with_script


# ── Fixture A: simple case where cenas cover the entire audio ────────────
# Three cenas concatenate exactly to the SRT text — no preamble/suffix.
FIXTURE_SRT = """1
00:00:00,000 --> 00:00:02,400
no principio era o verbo

2
00:00:02,400 --> 00:00:04,800
e o verbo estava com deus

3
00:00:04,800 --> 00:00:07,200
e o verbo era deus.

4
00:00:07,200 --> 00:00:09,600
todas as coisas foram feitas

5
00:00:09,600 --> 00:00:12,000
por intermedio dele e sem ele

6
00:00:12,000 --> 00:00:14,400
nada do que foi feito se fez.

7
00:00:14,400 --> 00:00:17,200
nele estava a vida e a vida

8
00:00:17,200 --> 00:00:20,000
era a luz dos homens.
"""

CENA_0 = "no principio era o verbo e o verbo estava com deus e o verbo era deus."
CENA_1 = "todas as coisas foram feitas por intermedio dele e sem ele nada do que foi feito se fez."
CENA_2 = "nele estava a vida e a vida era a luz dos homens."

FIXTURE_SCRIPT = {
    "narracao_completa": f"{CENA_0} {CENA_1} {CENA_2}",
    "cenas": [
        {"narracao": CENA_0},
        {"narracao": CENA_1},
        {"narracao": CENA_2},
    ],
}


def _run():
    return align_srt_with_script(FIXTURE_SRT, FIXTURE_SCRIPT)


def test_returns_raw_srt_unchanged():
    aligned, _ = _run()
    assert aligned == FIXTURE_SRT, "aligned SRT must be byte-for-byte equal to input"


def test_scene_timings_length_matches_cenas():
    _, scene_timings = _run()
    assert len(scene_timings) == 3


def test_scene_timings_have_index_field():
    _, scene_timings = _run()
    for i, st in enumerate(scene_timings):
        assert st["index"] == i, f"scene_timings[{i}].index should be {i}, got {st.get('index')}"


def test_scene_timings_have_narracao_field():
    _, scene_timings = _run()
    for i, st in enumerate(scene_timings):
        assert st["narracao"] == FIXTURE_SCRIPT["cenas"][i]["narracao"], (
            f"scene_timings[{i}].narracao does not match cena {i} narracao"
        )


def test_monotonic_spans():
    _, scene_timings = _run()
    for i in range(len(scene_timings) - 1):
        assert scene_timings[i + 1]["start"] >= scene_timings[i]["end"], (
            f"span {i + 1} starts before span {i} ends"
        )


def test_duration_consistency():
    _, scene_timings = _run()
    for st in scene_timings:
        assert st["duration"] == round(st["end"] - st["start"], 3)


def test_no_cena_claims_entire_audio():
    """Regression: previous difflib version had cena 0 claim everything when
    narracao_completa contained preamble. Each cena should get a fair slice."""
    _, scene_timings = _run()
    audio_total = 20.0
    for i, st in enumerate(scene_timings):
        assert st["duration"] < audio_total * 0.7, (
            f"cena {i} claimed {st['duration']}s of {audio_total}s "
            f"audio — likely the greedy-match regression"
        )


def test_empty_cenas_returns_raw_tuple():
    srt = "1\n00:00:00,000 --> 00:00:01,000\nhello\n"
    result = align_srt_with_script(srt, {"cenas": []})
    # Must be a tuple, not a bare string — guards the latent type-hint bug
    assert isinstance(result, tuple), f"expected tuple, got {type(result).__name__}"
    assert result == (srt, [])


# ── Fixture B: realistic case with preamble + cenas + lesson + CTA ───────
# Models the actual reel 034 shape: narracao_completa includes hook/cenário
# at the start and lesson/CTA at the end. Cenas occupy the middle ~58%.
FIXTURE_REAL_SRT = """1
00:00:00,000 --> 00:00:02,000
hook line one here

2
00:00:02,000 --> 00:00:04,000
hook line two now

3
00:00:04,000 --> 00:00:06,000
setting description begins

4
00:00:06,000 --> 00:00:08,000
sobre o abismo trevas.

5
00:00:08,000 --> 00:00:10,000
deus disse haja luz.

6
00:00:10,000 --> 00:00:12,000
deus separou as aguas.

7
00:00:12,000 --> 00:00:14,000
lesson learned today

8
00:00:14,000 --> 00:00:16,000
share with a friend
"""

FIXTURE_REAL_SCRIPT = {
    "narracao_completa": (
        "Hook line one here. Hook line two now. Setting description begins. "
        "Sobre o abismo trevas. "
        "Deus disse haja luz. "
        "Deus separou as aguas. "
        "Lesson learned today. Share with a friend."
    ),
    "cenas": [
        {"narracao": "Sobre o abismo trevas."},
        {"narracao": "Deus disse haja luz."},
        {"narracao": "Deus separou as aguas."},
    ],
}


def test_realistic_three_cenas_get_three_entries():
    """Job 8303e35e26e9411b regression — when narracao_completa has hook+lesson
    around 3 cenas, scene_timings must have exactly 3 entries (not 1, not 0)."""
    _, scene_timings = align_srt_with_script(FIXTURE_REAL_SRT, FIXTURE_REAL_SCRIPT)
    assert len(scene_timings) == 3, (
        f"expected 3 scene_timings entries, got {len(scene_timings)}"
    )


def test_realistic_first_cena_absorbs_preamble():
    """First cena MUST start at audio_start (0.0), absorbing the hook+setting
    chunks. Without this the editor timeline has a gap at the beginning where
    audio plays but no clip is shown — desyncs the entire reel."""
    _, scene_timings = align_srt_with_script(FIXTURE_REAL_SRT, FIXTURE_REAL_SCRIPT)
    assert scene_timings[0]["start"] == 0.0, (
        f"first cena must absorb preamble and start at 0.0, got {scene_timings[0]['start']}"
    )


def test_realistic_last_cena_absorbs_suffix():
    """Last cena MUST end at audio_end, absorbing the lesson/CTA chunks.
    Without this the audio keeps playing after the last clip ends and the
    editor freezes the last frame for several seconds."""
    _, scene_timings = align_srt_with_script(FIXTURE_REAL_SRT, FIXTURE_REAL_SCRIPT)
    assert scene_timings[-1]["end"] == 16.0, (
        f"last cena must absorb suffix and end at 16.0 (audio_end), "
        f"got {scene_timings[-1]['end']}"
    )


def test_realistic_no_gaps_between_cenas():
    """Spans must be contiguous: cena[i+1].start == cena[i].end. Any gap
    between cenas creates a moment where the editor has no clip to display."""
    _, scene_timings = align_srt_with_script(FIXTURE_REAL_SRT, FIXTURE_REAL_SCRIPT)
    for i in range(len(scene_timings) - 1):
        assert scene_timings[i + 1]["start"] == scene_timings[i]["end"], (
            f"gap between cena {i} (ends {scene_timings[i]['end']}) and "
            f"cena {i+1} (starts {scene_timings[i+1]['start']})"
        )


def test_realistic_total_duration_equals_audio_duration():
    """Sum of cena durations must equal the audio duration (no gaps, no
    overlaps). This is the contract the editor depends on for sync."""
    _, scene_timings = align_srt_with_script(FIXTURE_REAL_SRT, FIXTURE_REAL_SCRIPT)
    total = sum(st["duration"] for st in scene_timings)
    audio_duration = 16.0  # Fixture B audio: 0.0 → 16.0
    assert abs(total - audio_duration) < 0.01, (
        f"sum of cena durations ({total}s) does not equal audio duration ({audio_duration}s)"
    )


def test_no_narracao_completa_uniform_fallback():
    """When script lacks narracao_completa, fall back to uniform distribution
    so the editor doesn't crash. All cenas get roughly equal time."""
    script_no_full = {
        "cenas": [
            {"narracao": "first scene"},
            {"narracao": "second scene"},
            {"narracao": "third scene"},
        ]
    }
    _, scene_timings = align_srt_with_script(FIXTURE_SRT, script_no_full)
    assert len(scene_timings) == 3
    # 20s audio / 3 cenas ≈ 6.67s each — but boundaries snap to chunks so
    # accept any reasonably balanced split.
    durations = [st["duration"] for st in scene_timings]
    assert max(durations) < 12.0, "no cena should hog the timeline in fallback mode"
