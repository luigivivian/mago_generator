"""Contract tests for align_srt_with_script.

These tests encode the contract that align_srt_with_script:
1. Returns the input SRT byte-for-byte (no rebucketing, no rewrap).
2. Emits scene_timings with index/start/end/duration/narracao per cena.
3. Maps each cena.narracao to a contiguous span of Gemini chunks via
   text similarity, with monotonic spans and full audio coverage.
4. Snaps span boundaries to sentence end when possible.
5. Returns a tuple even when cenas list is empty (no bare-str return).
"""

from src.reels_pipeline.transcriber import align_srt_with_script


# Fixture: 8 Gemini-style chunks (~4-5 words each), real-looking timestamps,
# total span ~20s. Three cenas concatenate exactly to the SRT text.
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

FIXTURE_SCRIPT = {
    "cenas": [
        {
            "narracao": "no principio era o verbo e o verbo estava com deus e o verbo era deus.",
        },
        {
            "narracao": "todas as coisas foram feitas por intermedio dele e sem ele nada do que foi feito se fez.",
        },
        {
            "narracao": "nele estava a vida e a vida era a luz dos homens.",
        },
    ]
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


def test_full_audio_coverage():
    """First cena starts at first chunk's start, last cena claims tail."""
    _, scene_timings = _run()
    assert scene_timings[0]["start"] == 0.0, "first scene must start at first chunk start"
    assert scene_timings[-1]["end"] == 20.0, "last scene must claim through last chunk end"


def test_sentence_snap():
    """If a cena's text matches chunks 1-3 but chunk 3 ends mid-sentence
    while chunk 4 ends with '.', the span extends to chunk 4."""
    srt = """1
00:00:00,000 --> 00:00:02,000
hello world this is

2
00:00:02,000 --> 00:00:04,000
the first part of

3
00:00:04,000 --> 00:00:06,000
the sentence and it

4
00:00:06,000 --> 00:00:08,000
keeps going until here.

5
00:00:08,000 --> 00:00:10,000
second sentence starts now.
"""
    script = {
        "cenas": [
            {"narracao": "hello world this is the first part of the sentence and it keeps going"},
            {"narracao": "second sentence starts now."},
        ]
    }
    _, scene_timings = align_srt_with_script(srt, script)
    # First cena should extend to chunk 4 (the one ending in '.')
    assert scene_timings[0]["end"] == 8.0, (
        f"first cena should snap to sentence end at 8.0s, got {scene_timings[0]['end']}"
    )


def test_empty_cenas_returns_raw_tuple():
    srt = "1\n00:00:00,000 --> 00:00:01,000\nhello\n"
    result = align_srt_with_script(srt, {"cenas": []})
    # Must be a tuple, not a bare string — guards the latent type-hint bug
    assert isinstance(result, tuple), f"expected tuple, got {type(result).__name__}"
    assert result == (srt, [])
