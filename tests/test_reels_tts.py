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


def _make_fake_pipeline(config: dict | None = None):
    """Build a minimal ReelsPipeline instance with config_override dict."""
    from src.reels_pipeline.main import ReelsPipeline
    return ReelsPipeline(config_override=config or {})


# ---------------------------------------------------------------------------
# TTS-01 -- `run_step_tts` produces one Gemini TTS file per cena
# Bound to: 22-02 Plan, generate_narration_per_cena helper
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generates_one_file_per_cena(tmp_path, fake_gemini_tts_client):
    """TTS-01: Exactly N files at audio/cena_{i:03d}.wav for N cenas in script."""
    pipe = _make_fake_pipeline()
    script = {"cenas": [
        {"narracao": "primeira cena"},
        {"narracao": "segunda cena"},
        {"narracao": "terceira cena"},
    ]}
    audio_path, total_dur, cost, cenas_meta = await pipe.run_step_tts(
        script=script, job_dir=str(tmp_path)
    )
    # Assert per-cena files exist
    for i in range(3):
        p = tmp_path / "audio" / f"cena_{i:03d}.wav"
        assert p.exists(), f"cena_{i:03d}.wav missing"
    # Assert audio.wav (concat) exists
    assert (tmp_path / "audio.wav").exists()
    # Assert the fake client saw exactly 3 generate_content calls (one per cena)
    assert len(fake_gemini_tts_client.calls) == 3
    # Assert cenas_meta has 3 entries, all status complete
    assert len(cenas_meta) == 3
    assert all(c["status"] == "complete" for c in cenas_meta)


# ---------------------------------------------------------------------------
# TTS-02 -- Each per-cena file has duration measured by ffprobe
# Bound to: 22-03 Plan, run_step_tts ffprobe loop
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ffprobe_duration_measured_per_cena(tmp_path, fake_gemini_tts_client):
    """TTS-02: cenas_meta[i].duration is a float > 0 for every successful cena."""
    pipe = _make_fake_pipeline()
    script = {"cenas": [
        {"narracao": "uma"},
        {"narracao": "duas"},
    ]}
    _, _, _, cenas_meta = await pipe.run_step_tts(
        script=script, job_dir=str(tmp_path)
    )
    for c in cenas_meta:
        assert isinstance(c["duration"], float), f"cena {c['index']} duration not float: {c['duration']!r}"
        assert c["duration"] > 0, f"cena {c['index']} duration not positive: {c['duration']}"


# ---------------------------------------------------------------------------
# TTS-03 -- Durations persisted in step_state.tts.cenas[i].duration
# Bound to: 22-03 Plan, on_cena_update + flag_modified
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_step_state_cenas_persisted(tmp_path, fake_gemini_tts_client):
    """TTS-03: cenas_meta shape matches the step_state.tts.cenas[] contract."""
    pipe = _make_fake_pipeline()
    script = {"cenas": [
        {"narracao": "alfa"},
        {"narracao": "beta"},
        {"narracao": "gama"},
    ]}
    # Also capture on_cena_update callback
    updates: list[list[dict]] = []
    _, _, _, cenas_meta = await pipe.run_step_tts(
        script=script,
        job_dir=str(tmp_path),
        on_cena_update=lambda lst: updates.append(lst),
    )
    # Assert required keys on every entry
    for c in cenas_meta:
        assert set(c.keys()) >= {"index", "narracao", "path", "duration", "status"}
        assert c["status"] == "complete"
        assert c["path"] is not None
        assert c["duration"] is not None
    # Callback fired at least once per cena
    assert len(updates) >= 3


# ---------------------------------------------------------------------------
# TTS-04 -- narracao_completa is concatenated, not generated as a single call
# Bound to: 22-03 Plan, _concat_cena_wavs ffmpeg helper
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concat_not_single_call(tmp_path, fake_gemini_tts_client):
    """TTS-04: ffmpeg concat path is used -- Gemini is called N times for N cenas, not N+1.

    If the concat were done as a single additional Gemini call, the fake
    client would see 4 calls for a 3-cena script. We assert exactly 3.
    """
    pipe = _make_fake_pipeline()
    script = {"cenas": [
        {"narracao": "um"},
        {"narracao": "dois"},
        {"narracao": "tres"},
    ]}
    await pipe.run_step_tts(script=script, job_dir=str(tmp_path))
    # Exactly N Gemini calls -- concat is ffmpeg, not Gemini
    assert len(fake_gemini_tts_client.calls) == 3, (
        f"expected 3 Gemini calls (one per cena); got {len(fake_gemini_tts_client.calls)}"
    )
    # audio.wav still exists (proves concat ran)
    assert (tmp_path / "audio.wav").exists()


def test_sum_matches_concat_within_tolerance(tmp_path, make_fake_tts_wavs):
    """TTS-04 tolerance: |sum(per_cena_durations) - concat_duration| < 0.050s.

    Uses real PCM WAV files (via make_fake_tts_wavs fixture) so ffprobe
    reads real format metadata. Verified bit-exact locally.
    """
    from src.reels_pipeline.tts import _concat_cena_wavs
    from src.reels_pipeline.video_builder import get_video_duration

    # 3 WAV files with distinct frame counts
    per_cena_paths = make_fake_tts_wavs([73_123, 89_451, 105_903])
    out_path = str(tmp_path / "audio.wav")
    _concat_cena_wavs(per_cena_paths, out_path)

    per_cena_durs = [get_video_duration(p) for p in per_cena_paths]
    concat_dur = get_video_duration(out_path)

    # Success criterion #2 tolerance
    assert abs(sum(per_cena_durs) - concat_dur) < 0.050
    # Stronger: sub-millisecond (bit-exact concat)
    assert abs(sum(per_cena_durs) - concat_dur) < 0.001


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

@pytest.mark.asyncio
async def test_single_cena_failure_isolated(tmp_path, fake_gemini_tts_client):
    """TTS-06: Cena 3 of 5 fails persistently -- cenas 0/1/2/4 succeed; cena 3 marked failed."""
    from google.genai import errors as genai_errors

    # Build a non-retryable error (400 -> classifier "fail" -> single attempt)
    def make_400():
        e = genai_errors.ClientError.__new__(genai_errors.ClientError)
        e.code = 400
        e.status = "INVALID_ARGUMENT"
        e.message = "simulated content-safety block"
        return e

    # Monkeypatch generate_content to raise only for the specific cena's text.
    # With Semaphore(3) + gather(), call order is non-deterministic, so we
    # match on contents rather than call index.
    failing_text = "cena tres narracao"
    original_gen = fake_gemini_tts_client.generate_content

    def selective_gen(*, model, contents, config):
        if failing_text in contents:
            raise make_400()
        return original_gen(model=model, contents=contents, config=config)

    fake_gemini_tts_client.generate_content = selective_gen
    fake_gemini_tts_client.models = fake_gemini_tts_client  # re-bind

    pipe = _make_fake_pipeline()
    script = {"cenas": [
        {"narracao": "cena zero narracao"},
        {"narracao": "cena um narracao"},
        {"narracao": "cena dois narracao"},
        {"narracao": failing_text},
        {"narracao": "cena quatro narracao"},
    ]}
    audio_path, total_dur, cost, cenas_meta = await pipe.run_step_tts(
        script=script, job_dir=str(tmp_path)
    )
    # Pipeline did not abort
    assert os.path.isfile(audio_path)
    # Cena 3 is failed
    assert cenas_meta[3]["status"] == "failed"
    assert cenas_meta[3].get("failed") is True
    # Cenas 0, 1, 2, 4 are complete
    for i in (0, 1, 2, 4):
        assert cenas_meta[i]["status"] == "complete", f"cena {i} should be complete: {cenas_meta[i]}"
    # audio.wav concat ran over the 4 survivors
    assert total_dur > 0


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
