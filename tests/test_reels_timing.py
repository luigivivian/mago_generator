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
reader at memelab/src/stores/editor-store.ts:197-201, which reads
stepState.tts.duration directly — not audioItems[0].total_duration.
"""

from __future__ import annotations

import pytest


# --------------------------------------------------------------------
# TIMING-02 — build_scene_timings_from_cenas emits the same shape as
# align_srt_with_script (contract lock for scene_splitter consumer)
# Bound to: 23-02 Plan, src/reels_pipeline/timing.py
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 1 (23-02) pending — build_scene_timings_shape_matches_legacy")
def test_build_scene_timings_shape_matches_legacy(tmp_path):
    """TIMING-02: Output dicts have exactly the keys {index, start, end, duration, narracao}.

    This is the shape contract that keeps split_long_scenes_in_script
    (scene_splitter.py:48) working without modification. Any shape drift
    breaks the splitter and the concat_clips_with_audio trim loop.
    """
    pytest.fail("Stub — implement when 23-02 lands")


# --------------------------------------------------------------------
# TIMING-02 — Sum of emitted (end - start) equals sum of input durations
# within 1ms (strictly monotonic cursor; no gaps, no overlaps)
# Bound to: 23-02 Plan, src/reels_pipeline/timing.py
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 1 (23-02) pending — build_scene_timings_sums_to_total")
def test_build_scene_timings_sums_to_total(tmp_path):
    """TIMING-02: scene_timings[-1].end == round(sum(cenas[i].duration)*1000)/1000.

    Also asserts monotonicity (scene_timings[i].start == scene_timings[i-1].end)
    and duration field is re-derived from rounded bounds
    (duration == round(end - start, 3)).
    """
    pytest.fail("Stub — implement when 23-02 lands")


# --------------------------------------------------------------------
# TIMING-05 — Float cursor drift is eliminated across 50 cenas
# Bound to: 23-02 Plan, round(cursor*1000)/1000 at emission AND accumulation
# Ref: pipeline-historia-narracao-imagem.md §9 — "Cenas desalinhadas após a terceira"
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 1 (23-02) pending — float_drift_across_many_cenas")
def test_float_drift_across_many_cenas(tmp_path):
    """TIMING-05: With 50 cenas of drift-prone durations, final cursor matches
    round(sum*1000)/1000 exactly and no scene_timings[i].start drifts off
    scene_timings[i-1].end by more than 0.001s.

    Drift-prone input: durations like [3.333, 3.777, 3.111, 2.987, 4.123, ...]
    chosen so a naive `cursor += dur` accumulates IEEE 754 error past ms precision.
    """
    pytest.fail("Stub — implement when 23-02 lands")


# --------------------------------------------------------------------
# TIMING-03 — run_step_srt uses the new path when tts.cenas is present
# Bound to: 23-03 Plan, gate at src/reels_pipeline/main.py:~647
# Success #5 verification via unittest.mock.patch (RESEARCH.md §5 pattern 2)
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (23-03) pending — run_step_srt_uses_new_path_when_tts_cenas_present")
def test_run_step_srt_uses_new_path_when_tts_cenas_present(tmp_path):
    """TIMING-03: With tts_cenas kwarg provided, run_step_srt does NOT call
    align_srt_with_script; it calls build_scene_timings_from_cenas instead.

    Uses unittest.mock.patch on
    src.reels_pipeline.main.align_srt_with_script and asserts
    mock.assert_not_called() after the step runs.
    """
    pytest.fail("Stub — implement when 23-03 lands")


# --------------------------------------------------------------------
# TIMING-03 — Legacy jobs without tts.cenas still work (fallback branch)
# Bound to: 23-03 Plan, else-branch at src/reels_pipeline/main.py:~647
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (23-03) pending — run_step_srt_falls_back_to_legacy_without_tts_cenas")
def test_run_step_srt_falls_back_to_legacy_without_tts_cenas(tmp_path):
    """TIMING-03 fallback: With tts_cenas=None (or kwarg omitted), run_step_srt
    MUST call align_srt_with_script (legacy char-offset path).

    Uses unittest.mock.patch on
    src.reels_pipeline.main.align_srt_with_script and asserts
    mock.assert_called_once() after the step runs on a legacy job.
    """
    pytest.fail("Stub — implement when 23-03 lands")


# --------------------------------------------------------------------
# TIMING-01 — concat_clips_with_audio consumes the new scene_timings
# Bound to: 23-04 Plan, integration test on video_builder.py:850-855
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 3 (23-04) pending — concat_clips_with_audio_consumes_new_scene_timings")
def test_concat_clips_with_audio_consumes_new_scene_timings(tmp_path):
    """TIMING-01: When scene_timings built from tts.cenas is passed to
    concat_clips_with_audio via step_state.srt.scene_timings, the trim loop
    at video_builder.py:850-855 uses each cena's duration as authoritative.

    Asserts that the scene_durs list derived inside concat_clips_with_audio
    matches [t['duration'] + transition_duration for t in scene_timings]
    when scene_timings length matches clip count.
    """
    pytest.fail("Stub — implement when 23-04 lands")


# --------------------------------------------------------------------
# TIMING-04 — Editor audio contract regression lock (Option C from 23-CONTEXT.md)
# Bound to: 23-04 Plan, route-handler step_data assembly
# NOTE: This is NOT a new step_state.editor write — it is a regression
# lock that step_data['duration'] stays equal to sum(cenas[i].duration)
# (both ffprobe-measured, to <50ms tolerance) which is what the editor
# reads via stepState.tts.duration in editor-store.ts:197-201.
# --------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 3 (23-04) pending — editor_audio_items_total_duration_matches_per_cena_sum")
def test_editor_audio_items_total_duration_matches_per_cena_sum(tmp_path):
    """TIMING-04 regression lock: After a simulated run_step_tts + route-handler
    step_data assembly, assert
        abs(step_data['duration'] - sum(c['duration'] for c in step_data['cenas'] if not c.get('failed'))) < 0.050.

    The editor reads stepState.tts.duration (editor-store.ts:197-201), which is
    step_data['duration'], so this test binds the Phase 23 contract from the
    route handler's output perspective — the shape the editor actually reads.

    No FastAPI test client. Construct step_data manually by calling run_step_tts
    on a minimal script (fake Gemini) and reading the returned values.
    """
    pytest.fail("Stub — implement when 23-04 lands")
