"""Per-scene config write-back tests — Phase 01.

Wave 0: all tests are xfail stubs. Plans 02 (backend) and 03 (frontend) flip these green.
"""
import pytest


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub — plan 02 implements")
def test_scene_config_endpoint_exists():
    """PATCH /reels/{job_id}/scene-config saves to step_state.editor_config."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub — plan 02 implements")
def test_editor_config_survives_tts_regen():
    """step_state.editor_config is NOT popped when regenerateStep('tts') runs."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub — plan 02 implements")
def test_per_cena_voice_override():
    """run_step_tts passes per-cena voice from editor_config to generate_narration."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub — plan 02 implements")
def test_per_cena_speed_override():
    """run_step_tts passes per-cena speed from editor_config to generate_narration."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub — plan 02 implements")
def test_per_cena_voice_e2e():
    """End-to-end: PATCH scene-config -> regen TTS -> per-cena WAV uses configured voice."""
    assert False, "not implemented"
