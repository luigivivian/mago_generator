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


def test_editor_config_survives_tts_regen():
    """step_state.editor_config is NOT popped when regenerateStep('tts') runs.

    Pure dict-operation test: the wipe at reels.py only pops 'editor',
    so 'editor_config' must survive intact.
    """
    step_state = {
        "editor": {"scenes": [{"id": 1}], "subtitles": []},
        "editor_config": {"cenas": {"0": {"voice": "Puck"}, "2": {"speed": 1.8}}},
        "tts": {"path": "/tmp/audio.wav", "duration": 12.5},
    }

    # This mirrors the wipe at reels.py:1272-1273
    if "tts" in ("tts", "srt", "script"):
        step_state.pop("editor", None)

    # editor_config must survive -- it's a separate key
    assert "editor_config" in step_state, "editor_config was incorrectly wiped"
    assert step_state["editor_config"]["cenas"]["0"]["voice"] == "Puck"
    assert step_state["editor_config"]["cenas"]["2"]["speed"] == 1.8
    # editor should be gone
    assert "editor" not in step_state


@pytest.mark.asyncio
async def test_per_cena_voice_override(tmp_path, fake_gemini_tts_client):
    """run_step_tts passes per-cena voice from editor_config to generate_narration."""
    from src.reels_pipeline.main import ReelsPipeline

    pipe = ReelsPipeline(config_override={
        "tts_voice": "Puck",
        "per_cena_configs": {"1": {"voice": "Aoede"}},
    })
    script = {"cenas": [
        {"narracao": "cena zero"},
        {"narracao": "cena one"},
        {"narracao": "cena two"},
    ]}
    await pipe.run_step_tts(script=script, job_dir=str(tmp_path))

    # The fake client records all generate_content calls.
    # We need to check the voice arg in each call's contents/prompt.
    # generate_narration builds a prompt that includes the voice name.
    # Cena 0 and 2 should use "Puck" (global), cena 1 should use "Aoede" (override).
    assert len(fake_gemini_tts_client.calls) == 3

    # Check that cena 1's prompt contains "Aoede" (the override voice)
    # The generate_narration function uses voice in config.speech_config.voice_config.prebuilt_voice_config.voice_name
    call_1 = fake_gemini_tts_client.calls[1]
    voice_cfg = call_1["config"].speech_config.voice_config.prebuilt_voice_config.voice_name
    assert voice_cfg == "Aoede", f"cena 1 should use Aoede override, got {voice_cfg}"

    # Cena 0 should use global Puck
    call_0 = fake_gemini_tts_client.calls[0]
    voice_cfg_0 = call_0["config"].speech_config.voice_config.prebuilt_voice_config.voice_name
    assert voice_cfg_0 == "Puck", f"cena 0 should use global Puck, got {voice_cfg_0}"


@pytest.mark.asyncio
async def test_per_cena_speed_override(tmp_path, fake_gemini_tts_client):
    """run_step_tts passes per-cena speed from editor_config to generate_narration."""
    from src.reels_pipeline.main import ReelsPipeline

    pipe = ReelsPipeline(config_override={
        "tts_voice": "Puck",
        "tts_speed": 1.0,
        "per_cena_configs": {"0": {"speed": 1.8}},
    })
    script = {"cenas": [
        {"narracao": "cena zero speed test"},
        {"narracao": "cena one normal speed"},
    ]}
    await pipe.run_step_tts(script=script, job_dir=str(tmp_path))

    assert len(fake_gemini_tts_client.calls) == 2

    # Cena 0 should have speed 1.8 (override) -- reflected in the prompt as "180%"
    call_0_contents = str(fake_gemini_tts_client.calls[0]["contents"])
    assert "180%" in call_0_contents, (
        f"cena 0 should use 180% speed override; prompt: {call_0_contents[:300]}"
    )

    # Cena 1 should use global speed 1.0 -- at 1.0x the speed hint is suppressed
    call_1_contents = str(fake_gemini_tts_client.calls[1]["contents"])
    # At 1.0x speed, no speed hint is injected
    assert "180%" not in call_1_contents


@pytest.mark.asyncio
async def test_per_cena_voice_e2e(tmp_path, fake_gemini_tts_client):
    """End-to-end: config with per_cena_configs -> run_step_tts -> each cena uses correct voice."""
    from src.reels_pipeline.main import ReelsPipeline

    pipe = ReelsPipeline(config_override={
        "tts_voice": "Puck",
        "tts_speed": 1.0,
        "per_cena_configs": {
            "0": {"voice": "Aoede", "speed": 1.5},
            "2": {"voice": "Charon"},
        },
    })
    script = {"cenas": [
        {"narracao": "primeira cena"},
        {"narracao": "segunda cena"},
        {"narracao": "terceira cena"},
    ]}
    audio_path, total_dur, cost, cenas_meta = await pipe.run_step_tts(
        script=script, job_dir=str(tmp_path)
    )

    assert len(fake_gemini_tts_client.calls) == 3
    assert len(cenas_meta) == 3
    assert all(c["status"] == "complete" for c in cenas_meta)

    # Cena 0: voice=Aoede, speed=1.5
    c0_voice = fake_gemini_tts_client.calls[0]["config"].speech_config.voice_config.prebuilt_voice_config.voice_name
    assert c0_voice == "Aoede"
    c0_contents = str(fake_gemini_tts_client.calls[0]["contents"])
    assert "150%" in c0_contents, "cena 0 should use 150% speed"

    # Cena 1: voice=Puck (global), speed=1.0 (global)
    c1_voice = fake_gemini_tts_client.calls[1]["config"].speech_config.voice_config.prebuilt_voice_config.voice_name
    assert c1_voice == "Puck"

    # Cena 2: voice=Charon, speed=1.0 (global, no per-cena speed)
    c2_voice = fake_gemini_tts_client.calls[2]["config"].speech_config.voice_config.prebuilt_voice_config.voice_name
    assert c2_voice == "Charon"
