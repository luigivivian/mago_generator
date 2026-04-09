"""Per-scene config write-back tests -- Phase 01.

Wave 0 stubs flipped to real tests by plans 02 (backend) and 03-04 (frontend).
"""
import pytest


def test_scene_config_endpoint_exists():
    """PATCH /reels/{job_id}/scene-config saves to step_state.editor_config."""
    from src.api.models import EditorConfigPayload, SceneCenaConfig

    # Validate model accepts partial overrides
    payload = EditorConfigPayload(cenas={"0": SceneCenaConfig(voice="Aoede", speed=1.5)})
    dumped = payload.model_dump()
    assert dumped["cenas"]["0"]["voice"] == "Aoede"
    assert dumped["cenas"]["0"]["speed"] == 1.5

    # Partial override (only voice, no speed)
    payload2 = EditorConfigPayload(cenas={"1": SceneCenaConfig(voice="Puck")})
    d2 = payload2.model_dump()
    assert d2["cenas"]["1"]["voice"] == "Puck"
    assert d2["cenas"]["1"]["speed"] is None

    # Verify the endpoint function is importable and registered on the router
    from src.api.routes.reels import patch_scene_config
    assert callable(patch_scene_config)


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub -- plan 02 implements")
def test_editor_config_survives_tts_regen():
    """step_state.editor_config is NOT popped when regenerateStep('tts') runs."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub -- plan 02 implements")
def test_per_cena_voice_override():
    """run_step_tts passes per-cena voice from editor_config to generate_narration."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub -- plan 02 implements")
def test_per_cena_speed_override():
    """run_step_tts passes per-cena speed from editor_config to generate_narration."""
    assert False, "not implemented"


@pytest.mark.xfail(strict=True, reason="Phase 01 Wave 0 stub -- plan 02 implements")
def test_per_cena_voice_e2e():
    """End-to-end: PATCH scene-config -> regen TTS -> per-cena WAV uses configured voice."""
    assert False, "not implemented"
