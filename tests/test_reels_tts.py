"""Phase 22: Per-cena TTS anchoring -- validation suite.

This file is the binding contract between PLAN.md task verifications
and the actual test runner. Each test below maps 1:1 to a row in
.planning/phases/22-per-cena-tts-anchoring/22-VALIDATION.md.

Wave 0 (this plan, 22-01) creates all 11 tests as xfail stubs so the
suite stays GREEN. Each implementation wave (22-02..22-04) flips its
owned tests from xfail -> active by removing the xfail marker AND
filling in the test body.

DO NOT rename a test in this file without also updating 22-VALIDATION.md.
"""

from __future__ import annotations

import asyncio
import os
import wave
from pathlib import Path
from unittest.mock import patch

import pytest


# ---------------------------------------------------------------------------
# TTS-01 -- `run_step_tts` produces one Gemini TTS file per cena
# Bound to: 22-02 Plan, generate_narration_per_cena helper
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 1 (22-02) pending -- generates_one_file_per_cena")
@pytest.mark.asyncio
async def test_generates_one_file_per_cena(tmp_path, fake_gemini_tts_client):
    """TTS-01: After run_step_tts, exactly N files exist at audio/cena_{i:03d}.wav."""
    pytest.fail("Stub -- implement when 22-02 lands")


# ---------------------------------------------------------------------------
# TTS-02 -- Each per-cena file has duration measured by ffprobe
# Bound to: 22-03 Plan, run_step_tts ffprobe loop
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- ffprobe_duration_measured_per_cena")
@pytest.mark.asyncio
async def test_ffprobe_duration_measured_per_cena(tmp_path, fake_gemini_tts_client, make_fake_tts_wavs):
    """TTS-02: Every cenas[i].duration is a float > 0 set by get_video_duration()."""
    pytest.fail("Stub -- implement when 22-03 lands")


# ---------------------------------------------------------------------------
# TTS-03 -- Durations persisted in step_state.tts.cenas[i].duration
# Bound to: 22-03 Plan, on_cena_update + flag_modified
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- step_state_cenas_persisted")
@pytest.mark.asyncio
async def test_step_state_cenas_persisted(tmp_path, fake_gemini_tts_client):
    """TTS-03: step_state['tts']['cenas'][i] has dict with index/path/duration/status keys."""
    pytest.fail("Stub -- implement when 22-03 lands")


# ---------------------------------------------------------------------------
# TTS-04 -- narracao_completa is concatenated, not generated as a single call
# Bound to: 22-03 Plan, _concat_cena_wavs ffmpeg helper
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- concat_not_single_call")
@pytest.mark.asyncio
async def test_concat_not_single_call(tmp_path, fake_gemini_tts_client):
    """TTS-04: ffmpeg subprocess is called with `-f concat -c copy`; Gemini is called N times for N cenas (not N+1)."""
    pytest.fail("Stub -- implement when 22-03 lands")


@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- sum_matches_concat_within_tolerance")
def test_sum_matches_concat_within_tolerance(tmp_path, make_fake_tts_wavs):
    """TTS-04 tolerance: |sum(per_cena_durations) - get_video_duration(audio.wav)| < 0.050s."""
    pytest.fail("Stub -- implement when 22-03 lands")


# ---------------------------------------------------------------------------
# TTS-05 -- Biblical tone forces speaking_rate = 1.0 inside generate_narration
# Bound to: 22-02 Plan, biblical clamp at top of generate_narration
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 1 (22-02) pending -- biblical_clamps_speed_to_1")
@pytest.mark.asyncio
async def test_biblical_clamps_speed_to_1(tmp_path, fake_gemini_tts_client):
    """TTS-05: Calling generate_narration(tone='biblical', speed=1.35) results in speaking_rate=1.0 in the prompt."""
    pytest.fail("Stub -- implement when 22-02 lands")


@pytest.mark.xfail(strict=False, reason="Wave 1 (22-02) pending -- biblical_clamp_logged")
@pytest.mark.asyncio
async def test_biblical_clamp_logged(tmp_path, fake_gemini_tts_client, caplog):
    """TTS-05 log (D-12): The override emits an INFO log line containing 'forcing speaking_rate=1.0'."""
    pytest.fail("Stub -- implement when 22-02 lands")


# ---------------------------------------------------------------------------
# TTS-06 -- Single-cena failure does not abort; cena marked failed=True
# Bound to: 22-02 Plan, retry/classifier; 22-03 Plan, isolation in run_step_tts
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- single_cena_failure_isolated")
@pytest.mark.asyncio
async def test_single_cena_failure_isolated(tmp_path, fake_gemini_tts_client):
    """TTS-06: When cena 3 of 5 raises persistently, cenas 0/1/2/4 still succeed; cena 3 has failed=True."""
    pytest.fail("Stub -- implement when 22-03 lands")


@pytest.mark.xfail(strict=False, reason="Wave 1 (22-02) pending -- error_classification")
@pytest.mark.asyncio
async def test_error_classification(tmp_path, fake_gemini_tts_client):
    """TTS-06 classifier: ClientError(400) is NOT retried; ClientError(429) IS retried 3x with exponential backoff."""
    pytest.fail("Stub -- implement when 22-02 lands")


# ---------------------------------------------------------------------------
# Success #4 -- Selective retry via cena_indices preserves untouched cenas
# Bound to: 22-04 Plan, route handler cena_indices param
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-04) pending -- selective_retry_preserves_others")
@pytest.mark.asyncio
async def test_selective_retry_preserves_others(tmp_path, fake_gemini_tts_client):
    """Success #4: Calling /step/tts with cena_indices=[2] regenerates only cena 2; other cenas' paths/durations unchanged."""
    pytest.fail("Stub -- implement when 22-04 lands")


# ---------------------------------------------------------------------------
# Success #5 -- Editor compat: tts.path and tts.duration still written
# Bound to: 22-05 Plan, integration test
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 3 (22-05) pending -- editor_compat_tts_path_and_duration_still_written")
@pytest.mark.asyncio
async def test_editor_compat_tts_path_and_duration_still_written(tmp_path, fake_gemini_tts_client):
    """Success #5: After run_step_tts, step_state['tts']['path'] endswith 'audio.wav' and step_state['tts']['duration'] is float in [0.5, 600]."""
    pytest.fail("Stub -- implement when 22-05 lands")
