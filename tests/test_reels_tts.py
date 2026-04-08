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

@pytest.mark.asyncio
async def test_biblical_clamps_speed_to_1(tmp_path, fake_gemini_tts_client):
    """TTS-05: Calling generate_narration(tone='biblical', speed=1.35) emits a TTS prompt
    that reflects 1.0x (100%) speaking rate, not 1.35x (135%)."""
    from src.reels_pipeline.tts import generate_narration

    out = tmp_path / "out.wav"
    await generate_narration(
        text="Em verdade vos digo",
        output_path=str(out),
        speed=1.35,
        tone="biblical",
    )
    assert len(fake_gemini_tts_client.calls) == 1
    contents = fake_gemini_tts_client.calls[0]["contents"]
    # The clamp converts speed=1.35 -> 1.0 BEFORE the speed_hint is computed.
    # speed_hint at tts.py:120 is empty when speaking_rate == 1.0.
    # So NONE of the speed-related phrases may appear in the prompt.
    prompt_text = str(contents)
    speed_hint_phrases = ["135%", "100%", "Speak at", "% of normal speed"]
    for phrase in speed_hint_phrases:
        assert phrase not in prompt_text, (
            f"clamp failed -- speed_hint phrase {phrase!r} found in prompt; "
            f"speed_hint at tts.py:120 should be suppressed when speaking_rate == 1.0. "
            f"Prompt head: {prompt_text[:200]}"
        )


@pytest.mark.asyncio
async def test_biblical_clamp_logged(tmp_path, fake_gemini_tts_client, caplog):
    """TTS-05 (D-12): The clamp emits an INFO log on the 'clip-flow.reels.tts' logger."""
    import logging

    from src.reels_pipeline.tts import generate_narration

    caplog.set_level(logging.INFO, logger="clip-flow.reels.tts")
    out = tmp_path / "out.wav"
    await generate_narration(
        text="E Deus disse",
        output_path=str(out),
        speed=1.35,
        tone="biblical",
    )
    matched = [r for r in caplog.records if "forcing speaking_rate=1.0" in r.getMessage()]
    assert len(matched) >= 1, (
        f"expected an INFO log with 'forcing speaking_rate=1.0'; got: "
        f"{[r.getMessage() for r in caplog.records]}"
    )
    assert matched[0].levelno == logging.INFO


# ---------------------------------------------------------------------------
# TTS-06 -- Single-cena failure does not abort; cena marked failed=True
# Bound to: 22-02 Plan, retry/classifier; 22-03 Plan, isolation in run_step_tts
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=False, reason="Wave 2 (22-03) pending -- single_cena_failure_isolated")
@pytest.mark.asyncio
async def test_single_cena_failure_isolated(tmp_path, fake_gemini_tts_client):
    """TTS-06: When cena 3 of 5 raises persistently, cenas 0/1/2/4 still succeed; cena 3 has failed=True."""
    pytest.fail("Stub -- implement when 22-03 lands")


def test_error_classification():
    """TTS-06 classifier: ClientError(400/403) -> 'fail'; ClientError(429) + ServerError -> 'retry'."""
    from src.reels_pipeline.tts import classify_tts_error

    # Build minimal error instances using google-genai's typed exception classes.
    # The constructor accepts (code, response_json, response) -- we forge a
    # minimal shape compatible with .code attribute access.
    from google.genai import errors as genai_errors

    def make_client_err(code: int):
        e = genai_errors.ClientError.__new__(genai_errors.ClientError)
        e.code = code
        e.status = "FORGED"
        e.message = "test"
        return e

    def make_server_err(code: int):
        e = genai_errors.ServerError.__new__(genai_errors.ServerError)
        e.code = code
        e.status = "FORGED"
        e.message = "test"
        return e

    assert classify_tts_error(make_client_err(429)) == "retry"
    assert classify_tts_error(make_client_err(400)) == "fail"
    assert classify_tts_error(make_client_err(403)) == "fail"
    assert classify_tts_error(make_server_err(500)) == "retry"
    assert classify_tts_error(make_server_err(503)) == "retry"
    assert classify_tts_error(ValueError("unknown")) == "retry"


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
