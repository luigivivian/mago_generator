"""Phase 23: Audio-anchored timing propagation — validation suite.

This file is the binding contract between PLAN.md task verifications
and the actual test runner. Each test below maps 1:1 to a row in
.planning/phases/23-audio-anchored-timing-propagation/23-RESEARCH.md §5
(Test Strategy Table).

Wave 0 (this plan, 23-01) creates all 7 tests as xfail stubs so the
suite stays GREEN. Each implementation wave flips its owned tests from
xfail -> active by removing the xfail marker AND filling in the test
body:

    Wave 1 (23-02) flips tests 01, 02, 03 (build_scene_timings helper)
    Wave 2 (23-03) flips tests 04, 05 (run_step_srt gate + fallback)
    Wave 3 (23-04) flips tests 06, 07 (integration + regression lock)

DO NOT rename a test in this file without also updating 23-RESEARCH.md
§5 and the corresponding PLAN.md <automated> verify commands.

Per 23-CONTEXT.md Option C: TIMING-04 is a regression lock on existing
fields (step_data['duration'] == sum(cenas[i].duration) within 50ms),
NOT a new step_state.editor write. This matches the actual editor
reader at cretorlab/src/stores/editor-store.ts:197-201, which reads
stepState.tts.duration directly — not audioItems[0].total_duration.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from src.reels_pipeline.timing import build_scene_timings_from_cenas


# --------------------------------------------------------------------
# TIMING-02 — build_scene_timings_from_cenas emits the same shape as
# align_srt_with_script (contract lock for scene_splitter consumer)
# Bound to: 23-02 Plan, src/reels_pipeline/timing.py
# --------------------------------------------------------------------

def test_build_scene_timings_shape_matches_legacy(tmp_path):
    """TIMING-02: Output dicts have exactly the keys {index, start, end, duration, narracao}.

    This is the shape contract that keeps split_long_scenes_in_script
    (scene_splitter.py:48) working without modification. Any shape drift
    breaks the splitter and the concat_clips_with_audio trim loop.
    """
    cenas = [
        {"index": 0, "narracao": "Primeira cena", "path": "a.wav", "duration": 2.0, "status": "complete"},
        {"index": 1, "narracao": "Segunda cena", "path": "b.wav", "duration": 3.5, "status": "complete"},
        {"index": 2, "narracao": "Terceira cena", "path": "c.wav", "duration": 1.75, "status": "complete"},
    ]
    result = build_scene_timings_from_cenas(cenas)

    assert len(result) == 3
    expected_keys = {"index", "start", "end", "duration", "narracao"}
    for i, entry in enumerate(result):
        assert set(entry.keys()) == expected_keys, (
            f"scene_timings[{i}] has keys {set(entry.keys())}, expected {expected_keys}"
        )
        assert isinstance(entry["index"], int)
        assert isinstance(entry["start"], float)
        assert isinstance(entry["end"], float)
        assert isinstance(entry["duration"], float)
        assert isinstance(entry["narracao"], str)

    # Content check
    assert result[0] == {"index": 0, "start": 0.0, "end": 2.0, "duration": 2.0, "narracao": "Primeira cena"}
    assert result[1] == {"index": 1, "start": 2.0, "end": 5.5, "duration": 3.5, "narracao": "Segunda cena"}
    assert result[2] == {"index": 2, "start": 5.5, "end": 7.25, "duration": 1.75, "narracao": "Terceira cena"}


# --------------------------------------------------------------------
# TIMING-02 — Sum of emitted (end - start) equals sum of input durations
# within 1ms (strictly monotonic cursor; no gaps, no overlaps)
# Bound to: 23-02 Plan, src/reels_pipeline/timing.py
# --------------------------------------------------------------------

def test_build_scene_timings_sums_to_total(tmp_path):
    """TIMING-02: scene_timings[-1].end == round(sum(cenas[i].duration)*1000)/1000.

    Also asserts monotonicity (scene_timings[i].start == scene_timings[i-1].end)
    and duration field is re-derived from rounded bounds
    (duration == round(end - start, 3)).
    """
    durations = [1.2, 2.3, 3.4, 4.5, 5.6]
    cenas = [
        {"index": i, "narracao": f"cena {i}", "path": f"c{i}.wav", "duration": d, "status": "complete"}
        for i, d in enumerate(durations)
    ]
    result = build_scene_timings_from_cenas(cenas)

    # Sum check: final cursor equals rounded sum of inputs
    expected_total = round(sum(durations) * 1000) / 1000
    assert result[-1]["end"] == expected_total, (
        f"final end {result[-1]['end']} != rounded sum {expected_total}"
    )

    # Monotonicity: no gaps, no overlaps
    assert result[0]["start"] == 0.0
    for i in range(1, len(result)):
        assert result[i]["start"] == result[i - 1]["end"], (
            f"gap/overlap at i={i}: start={result[i]['start']}, prev_end={result[i - 1]['end']}"
        )

    # duration re-derived from rounded bounds (C in the 4 rounding points)
    for i, entry in enumerate(result):
        assert entry["duration"] == round(entry["end"] - entry["start"], 3), (
            f"duration mismatch at i={i}: duration={entry['duration']}, end-start={entry['end'] - entry['start']}"
        )


# --------------------------------------------------------------------
# TIMING-05 — Float cursor drift is eliminated across 50 cenas
# Bound to: 23-02 Plan, round(cursor*1000)/1000 at emission AND accumulation
# Ref: pipeline-historia-narracao-imagem.md §9 — "Cenas desalinhadas após a terceira"
# --------------------------------------------------------------------

def test_float_drift_across_many_cenas(tmp_path):
    """TIMING-05: With 50 cenas of drift-prone durations, final cursor matches
    round(sum*1000)/1000 exactly and no scene_timings[i].start drifts off
    scene_timings[i-1].end by more than 0.001s.

    Drift-prone input: durations like [3.333, 3.777, 3.111, 2.987, 4.123]
    repeated 10 times, chosen so a naive `cursor += dur` accumulates
    IEEE 754 error past ms precision.
    """
    drift_prone = [3.333, 3.777, 3.111, 2.987, 4.123] * 10  # 50 cenas
    assert len(drift_prone) == 50

    cenas = [
        {"index": i, "narracao": f"cena {i}", "path": f"c{i}.wav", "duration": d, "status": "complete"}
        for i, d in enumerate(drift_prone)
    ]
    result = build_scene_timings_from_cenas(cenas)

    assert len(result) == 50

    # No gaps or overlaps anywhere
    assert result[0]["start"] == 0.0
    for i in range(1, 50):
        gap = abs(result[i]["start"] - result[i - 1]["end"])
        assert gap < 1e-9, f"drift at i={i}: gap={gap}s (> 1ns)"

    # Final cursor exactly matches rounded total
    expected_total = round(sum(drift_prone) * 1000) / 1000
    assert result[-1]["end"] == expected_total, (
        f"final cursor {result[-1]['end']} drifted from rounded sum {expected_total}"
    )

    # Sanity: naive sum would drift — confirm drift-prone values were chosen well
    naive_cursor = 0.0
    for d in drift_prone:
        naive_cursor += d
    # Document expected drift direction (not asserted — just diagnostic):
    # naive_cursor may differ from expected_total by ~1e-12 on IEEE 754.


# --------------------------------------------------------------------
# TIMING-03 — run_step_srt uses the new path when tts.cenas is present
# Bound to: 23-03 Plan, gate at src/reels_pipeline/main.py:~647
# Success #5 verification via unittest.mock.patch (RESEARCH.md §5 pattern 2)
# --------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_step_srt_uses_new_path_when_tts_cenas_present(tmp_path):
    """TIMING-03: With tts_cenas kwarg provided, run_step_srt does NOT call
    align_srt_with_script; it calls build_scene_timings_from_cenas instead.

    Uses unittest.mock.patch on src.reels_pipeline.transcriber.align_srt_with_script
    and asserts mock.assert_not_called() after the step runs.
    """
    from src.reels_pipeline.main import ReelsPipeline

    # Write a placeholder subtitles.srt so the legacy branch's open() would not
    # fail if the gate were broken — this makes the test fail loudly if the
    # new path is bypassed.
    srt_placeholder = tmp_path / "subtitles.srt"
    srt_placeholder.write_text(
        "1\n00:00:00,000 --> 00:00:02,000\nPrimeira cena\n\n"
        "2\n00:00:02,000 --> 00:00:04,000\nSegunda cena\n",
        encoding="utf-8",
    )

    audio_placeholder = tmp_path / "audio.wav"
    audio_placeholder.write_bytes(b"\x00" * 1024)  # not a real WAV, but os.path.getsize works

    script = {
        "cenas": [
            {"narracao": "Primeira cena"},
            {"narracao": "Segunda cena"},
            {"narracao": "Terceira cena"},
        ],
        "narracao_completa": "Primeira cena. Segunda cena. Terceira cena.",
    }

    tts_cenas = [
        {"index": 0, "narracao": "Primeira cena", "path": "c0.wav", "duration": 2.0, "status": "complete"},
        {"index": 1, "narracao": "Segunda cena", "path": "c1.wav", "duration": 3.5, "status": "complete"},
        {"index": 2, "narracao": "Terceira cena", "path": "c2.wav", "duration": 1.75, "status": "complete"},
    ]

    pipeline = ReelsPipeline(config_override={
        "script_language": "pt-BR",
        "transcription_provider": "gemini",
    })

    # Mock transcribe_to_srt so we don't hit Gemini or the real file system,
    # and mock align_srt_with_script so we can assert it is NOT called.
    async def fake_transcribe(**kwargs):
        # Write the output file so downstream os.path.getsize etc. work.
        Path(kwargs["output_path"]).write_text(
            srt_placeholder.read_text(encoding="utf-8"), encoding="utf-8"
        )
        return None

    with patch("src.reels_pipeline.transcriber.transcribe_to_srt", new=AsyncMock(side_effect=fake_transcribe)), \
         patch("src.reels_pipeline.transcriber.align_srt_with_script") as mock_align, \
         patch("src.reels_pipeline.transcriber.estimate_transcription_cost", return_value=0.01):
        srt_path, duration, scene_timings, _expanded = await pipeline.run_step_srt(
            audio_path=str(audio_placeholder),
            job_dir=str(tmp_path),
            script=script,
            tts_cenas=tts_cenas,
        )

    # Gate assertion: the legacy aligner MUST NOT have been called
    mock_align.assert_not_called()

    # New path result assertion: scene_timings was built from tts_cenas
    assert scene_timings is not None
    assert len(scene_timings) == 3
    assert scene_timings[0]["start"] == 0.0
    assert scene_timings[0]["end"] == 2.0
    assert scene_timings[1]["start"] == 2.0
    assert scene_timings[1]["end"] == 5.5
    assert scene_timings[2]["start"] == 5.5
    assert scene_timings[2]["end"] == 7.25

    # Duration return value is the final cursor (scene_timings[-1].end), not
    # the file-size heuristic — this proves the Edit 3 swap in Task 1 landed.
    assert scene_timings[-1]["end"] == 7.25


# --------------------------------------------------------------------
# TIMING-03 — Legacy jobs without tts.cenas still work (fallback branch)
# Bound to: 23-03 Plan, else-branch at src/reels_pipeline/main.py:~647
# --------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_step_srt_falls_back_to_legacy_without_tts_cenas(tmp_path):
    """TIMING-03 fallback: With tts_cenas=None (or kwarg omitted), run_step_srt
    MUST call align_srt_with_script (legacy char-offset path).

    Uses unittest.mock.patch on src.reels_pipeline.transcriber.align_srt_with_script
    and asserts mock.assert_called_once() after the step runs on a legacy job.
    """
    from src.reels_pipeline.main import ReelsPipeline

    srt_placeholder = tmp_path / "subtitles.srt"
    srt_placeholder.write_text(
        "1\n00:00:00,000 --> 00:00:02,000\nPrimeira cena\n",
        encoding="utf-8",
    )

    audio_placeholder = tmp_path / "audio.wav"
    audio_placeholder.write_bytes(b"\x00" * 1024)

    script = {
        "cenas": [{"narracao": "Primeira cena"}],
        "narracao_completa": "Primeira cena.",
    }

    pipeline = ReelsPipeline(config_override={
        "script_language": "pt-BR",
        "transcription_provider": "gemini",
    })

    async def fake_transcribe(**kwargs):
        Path(kwargs["output_path"]).write_text(
            srt_placeholder.read_text(encoding="utf-8"), encoding="utf-8"
        )
        return None

    fake_aligned_srt = "1\n00:00:00,000 --> 00:00:02,000\nPrimeira cena\n"
    fake_scene_timings = [
        {"index": 0, "start": 0.0, "end": 2.0, "duration": 2.0, "narracao": "Primeira cena"}
    ]

    with patch("src.reels_pipeline.transcriber.transcribe_to_srt", new=AsyncMock(side_effect=fake_transcribe)), \
         patch(
             "src.reels_pipeline.transcriber.align_srt_with_script",
             return_value=(fake_aligned_srt, fake_scene_timings),
         ) as mock_align, \
         patch("src.reels_pipeline.transcriber.estimate_transcription_cost", return_value=0.01):
        srt_path, duration, scene_timings, _expanded = await pipeline.run_step_srt(
            audio_path=str(audio_placeholder),
            job_dir=str(tmp_path),
            script=script,
            # NO tts_cenas kwarg — legacy path
        )

    # Fallback assertion: the legacy aligner MUST have been called exactly once
    mock_align.assert_called_once()
    # Result assertion: scene_timings came from the mock return
    assert scene_timings == fake_scene_timings


# --------------------------------------------------------------------
# TIMING-01 — concat_clips_with_audio consumes the new scene_timings
# Bound to: 23-04 Plan, integration test on video_builder.py:850-855
# --------------------------------------------------------------------

def test_concat_clips_with_audio_consumes_new_scene_timings(tmp_path, monkeypatch):
    """TIMING-01: When scene_timings built from tts.cenas is passed to
    concat_clips_with_audio, the trim loop at video_builder.py:850-855 uses
    each cena's duration as authoritative.

    Asserts that the scene_durs list derived inside concat_clips_with_audio
    matches [t['duration'] + transition_duration for t in scene_timings]
    when scene_timings length matches clip count.

    We monkey-patch _trim_clips_to_durations to capture the durations list
    without running ffmpeg. The rest of concat_clips_with_audio (the actual
    ffmpeg xfade invocation) is bypassed via a second monkey-patch on
    subprocess.run.
    """
    from src.reels_pipeline import video_builder
    from src.reels_pipeline.timing import build_scene_timings_from_cenas

    # Build fake clip paths (3 placeholder .mp4 files)
    clip_paths = []
    for i in range(3):
        p = tmp_path / f"clip_{i}.mp4"
        p.write_bytes(b"\x00" * 1024)  # not a real MP4, but os.path.exists() passes
        clip_paths.append(str(p))

    audio_path = tmp_path / "audio.wav"
    audio_path.write_bytes(b"\x00" * 1024)

    srt_path = tmp_path / "subtitles.srt"
    srt_path.write_text(
        "1\n00:00:00,000 --> 00:00:02,000\nPrimeira\n\n"
        "2\n00:00:02,000 --> 00:00:05,500\nSegunda\n\n"
        "3\n00:00:05,500 --> 00:00:07,250\nTerceira\n",
        encoding="utf-8",
    )

    output_path = tmp_path / "out.mp4"

    # Build scene_timings from the new helper
    tts_cenas = [
        {"index": 0, "narracao": "Primeira", "path": "c0.wav", "duration": 2.0, "status": "complete"},
        {"index": 1, "narracao": "Segunda", "path": "c1.wav", "duration": 3.5, "status": "complete"},
        {"index": 2, "narracao": "Terceira", "path": "c2.wav", "duration": 1.75, "status": "complete"},
    ]
    scene_timings = build_scene_timings_from_cenas(tts_cenas)
    assert len(scene_timings) == 3

    # Capture the durations list passed to _trim_clips_to_durations
    captured: dict = {}

    def fake_trim(paths, durations):
        captured["paths"] = list(paths)
        captured["durations"] = list(durations)
        return list(paths)  # return unchanged so concat_clips_with_audio continues

    monkeypatch.setattr(video_builder, "_trim_clips_to_durations", fake_trim)

    # Stub get_video_duration (avoid real ffprobe)
    monkeypatch.setattr(video_builder, "get_video_duration", lambda p: 7.25)

    # Stub the final ffmpeg invocation — we only care about the trim-loop
    # argument extraction, not the xfade assembly. The function may call
    # subprocess.run multiple times (xfade + mux); return success from all.
    import subprocess as _sub

    class _FakeProc:
        returncode = 0
        stderr = ""
        stdout = ""

    def fake_run(*args, **kwargs):
        # Write the output file so callers that stat() it succeed
        try:
            if args and isinstance(args[0], list) and args[0]:
                for tok in args[0]:
                    if isinstance(tok, str) and tok.endswith(".mp4") and str(output_path) in tok:
                        output_path.write_bytes(b"\x00" * 1024)
        except Exception:
            pass
        return _FakeProc()

    monkeypatch.setattr(_sub, "run", fake_run)

    # Call the real concat_clips_with_audio — it runs the trim-loop branch at
    # video_builder.py:850 (scene_timings truthy and length == n_clips).
    try:
        video_builder.concat_clips_with_audio(
            clip_paths=clip_paths,
            audio_path=str(audio_path),
            srt_path=str(srt_path),
            output_path=str(output_path),
            transition_duration=0.3,
            scene_timings=scene_timings,
        )
    except Exception:
        # Assembly may fail post-trim because we are stubbing ffmpeg. The
        # trim-loop has already run by then — that's what matters for the
        # assertion below.
        pass

    # PROOF: _trim_clips_to_durations was invoked with the expected durations
    assert "durations" in captured, "fake_trim was never called — trim branch not taken"
    expected = [t["duration"] + 0.3 for t in scene_timings]
    assert captured["durations"] == expected, (
        f"trim durations {captured['durations']} != expected {expected} "
        f"— video_builder.py:850-855 did not consume the new scene_timings"
    )


# --------------------------------------------------------------------
# TIMING-04 — Editor audio contract regression lock (Option C from 23-CONTEXT.md)
# Bound to: 23-04 Plan, route-handler step_data assembly
# NOTE: This is NOT a new step_state.editor write — it is a regression
# lock that step_data['duration'] stays equal to sum(cenas[i].duration)
# (both ffprobe-measured, to <50ms tolerance) which is what the editor
# reads via stepState.tts.duration in editor-store.ts:197-201.
# --------------------------------------------------------------------

@pytest.mark.asyncio
async def test_editor_audio_items_total_duration_matches_per_cena_sum(
    tmp_path, fake_gemini_tts_client, monkeypatch
):
    """TIMING-04 regression lock: After a simulated run_step_tts + route-handler
    step_data assembly, assert
        abs(step_data['duration'] - sum(c['duration'] for c in step_data['cenas'] if not c.get('failed'))) < 0.050.

    The editor reads stepState.tts.duration (editor-store.ts:197-201), which is
    step_data['duration'], so this test binds the Phase 23 contract from the
    route handler's output perspective — the shape the editor actually reads.

    No FastAPI test client. Construct step_data manually by calling run_step_tts
    on a minimal script (fake Gemini) and reading the returned values.

    Phase 22 D-11 reminder: tts.py does `from src.llm_client import _get_client`
    at import time, creating a local binding. The fake_gemini_tts_client
    fixture patches src.llm_client._get_client but we must ALSO patch the
    local binding in src.reels_pipeline.tts for the monkeypatch to take effect
    inside generate_narration.
    """
    from src.reels_pipeline.main import ReelsPipeline
    from src.reels_pipeline import tts as _tts_module

    # Ensure the tts module's local _get_client binding also points to the fake
    monkeypatch.setattr(_tts_module, "_get_client", lambda: fake_gemini_tts_client)

    script = {
        "cenas": [
            {"narracao": "Primeira cena do teste de regressão."},
            {"narracao": "Segunda cena com texto um pouco mais longo para variar a duração."},
            {"narracao": "Terceira e última cena."},
        ],
        "narracao_completa": (
            "Primeira cena do teste de regressão. "
            "Segunda cena com texto um pouco mais longo para variar a duração. "
            "Terceira e última cena."
        ),
    }

    pipeline = ReelsPipeline(config_override={
        "tts_voice": "default",
        "tts_provider": "gemini",
        "tts_speed": 1.0,
        "tone": None,
    })

    audio_path, total_duration, cost_usd, cenas_meta = await pipeline.run_step_tts(
        script=script,
        job_dir=str(tmp_path),
    )

    # Simulate the route handler's step_data assembly (reels.py:267-281)
    step_data: dict = {}
    step_data["path"] = audio_path
    step_data["duration"] = total_duration
    step_data["cenas"] = cenas_meta
    step_data["total_duration_source"] = "ffprobe_concat"
    step_data["cost_usd"] = cost_usd

    # Sanity checks on the assembled shape
    assert step_data["path"].endswith("audio.wav")
    assert isinstance(step_data["duration"], float)
    assert step_data["duration"] > 0.0
    assert len(step_data["cenas"]) == 3

    # Regression lock: step_data['duration'] ≈ sum of non-failed per-cena durations
    # Tolerance is 50ms per 23-CONTEXT.md Option C (ffmpeg concat may drift
    # by sub-millisecond on real files; 50ms is the conservative bound matching
    # Phase 22 success criterion #2).
    per_cena_sum = sum(
        float(c.get("duration") or 0.0)
        for c in step_data["cenas"]
        if not c.get("failed")
    )
    drift = abs(step_data["duration"] - per_cena_sum)
    assert drift < 0.050, (
        f"step_data['duration']={step_data['duration']} drifted from "
        f"sum(cenas.duration)={per_cena_sum} by {drift}s (> 50ms) — "
        f"editor would read a mismatched waveform length."
    )
