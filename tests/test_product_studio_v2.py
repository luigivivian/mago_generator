"""Phase 1002 Product Studio v2 — xfail test scaffolding for 11 REQ-PS2 requirements.

Each test is marked xfail until its corresponding plan implements the feature.
As plans land, the xfail decorator is removed one at a time so tests flip to green.
"""
import os

import pytest


def test_01_multi_image_upload():
    from src.product_studio.models import AdCreateRequestV2
    import pytest as _pt
    # Valid: 3 images
    req = AdCreateRequestV2(product_name="Test", image_urls=["a.jpg", "b.jpg", "c.jpg"])
    assert len(req.image_urls) == 3
    # Valid: 1 image
    req1 = AdCreateRequestV2(product_name="Test", image_urls=["a.jpg"])
    assert len(req1.image_urls) == 1
    # Invalid: 0 images
    with _pt.raises(Exception):
        AdCreateRequestV2(product_name="Test", image_urls=[])
    # Invalid: 5 images
    with _pt.raises(Exception):
        AdCreateRequestV2(product_name="Test", image_urls=["a", "b", "c", "d", "e"])


def test_02_image_treatment(tmp_path):
    from PIL import Image

    from src.product_studio.scene_composer import normalize_for_kling

    small_img = tmp_path / "small.png"
    Image.new("RGB", (100, 100), color="red").save(str(small_img))
    out = tmp_path / "normalized.jpg"
    result = normalize_for_kling(str(small_img), str(out))
    assert os.path.exists(result)
    normalized = Image.open(result)
    assert normalized.size[0] >= 300
    assert normalized.size[1] >= 300
    assert os.path.getsize(result) <= 10 * 1024 * 1024


def test_03_scene_generation(monkeypatch, tmp_path):
    import asyncio
    import json as _json
    import sys
    import types as _types

    from PIL import Image

    # Stub google.genai so the import inside generate_storyboard succeeds
    # without the real SDK being installed in the test environment.
    class _MockResponse:
        text = _json.dumps([
            {
                "action_description": "Slow reveal of the product against a dark backdrop",
                "camera_move": "dolly",
                "duration": 4,
                "transition_type": "dissolve",
                "rationale": "opens the commercial",
            },
            {
                "action_description": "Macro detail shot showing product texture",
                "camera_move": "macro_zoom",
                "duration": 3,
                "transition_type": "cut",
                "rationale": "shows texture",
            },
            {
                "action_description": "Hero shot with orbital camera motion",
                "camera_move": "orbit",
                "duration": 5,
                "transition_type": "fade",
                "rationale": "final impact",
            },
        ])

    class _MockModels:
        async def generate_content(self, **kw):
            return _MockResponse()

    class _MockAio:
        def __init__(self):
            self.models = _MockModels()

    class _MockClient:
        def __init__(self, **kw):
            self.aio = _MockAio()

    google_mod = sys.modules.get("google") or _types.ModuleType("google")
    genai_mod = _types.ModuleType("google.genai")
    genai_mod.Client = _MockClient
    google_mod.genai = genai_mod
    monkeypatch.setitem(sys.modules, "google", google_mod)
    monkeypatch.setitem(sys.modules, "google.genai", genai_mod)

    img_path = tmp_path / "product.jpg"
    Image.new("RGB", (500, 500), color="blue").save(str(img_path))

    from src.product_studio import scene_composer
    from src.product_studio.models import StoryboardScene, TakeConfig

    storyboard = asyncio.run(
        scene_composer.generate_storyboard(
            image_paths=[str(img_path)],
            category="food_cookies",
            product_name="Test Cookie",
            num_takes=3,
        )
    )
    assert len(storyboard) == 3
    assert isinstance(storyboard[0], StoryboardScene)
    assert isinstance(storyboard[0].take_config, TakeConfig)
    assert storyboard[0].take_config.camera_move == "dolly"
    assert storyboard[0].category_defaults_applied == "food_cookies"
    assert storyboard[0].take_config.order == 0


@pytest.mark.xfail(reason="REQ-PS2-04: take editor not yet implemented", strict=True)
def test_04_take_editor():
    assert False, "TakeEditor component not implemented"


def test_05_category_templates():
    from src.product_studio.config import CATEGORY_CONFIGS
    assert "food_cookies" in CATEGORY_CONFIGS
    assert len(CATEGORY_CONFIGS) == 7
    for key, cfg in CATEGORY_CONFIGS.items():
        assert "surface" in cfg
        assert "lighting" in cfg
        assert "hero_actions" in cfg
        assert "video_camera_moves" in cfg
    from src.product_studio.prompt_builder import build_product_prompt
    prompt = build_product_prompt("food_cookies", "dolly", "cookie breaking in half")
    assert len(prompt) <= 463
    assert "@prod" in prompt


def test_06_kling_multi_image():
    from src.video_gen.kie_client import KieSora2Client

    # Pass dummy key directly — _KIE_API_KEY is frozen at module import time
    c = KieSora2Client(api_key="test-key-dummy")
    payload = c._build_payload(
        input_format="kling_v3",
        model="kling-3.0/video",
        image_url="https://example.com/a.jpg",
        prompt="fallback prompt",
        duration=12,
        extra={
            "multi_prompt": [
                {"prompt": "shot 1", "duration": 4},
                {"prompt": "shot 2", "duration": 4},
                {"prompt": "shot 3", "duration": 4},
            ],
            "kling_elements": [{
                "name": "prod",
                "description": "test",
                "element_input_urls": [
                    "https://example.com/a.jpg",
                    "https://example.com/b.jpg",
                ],
            }],
        },
    )
    assert payload["input"]["multi_shots"] is True
    assert len(payload["input"]["multi_prompt"]) == 3
    assert "kling_elements" in payload["input"]
    assert len(payload["input"]["kling_elements"][0]["element_input_urls"]) == 2


def test_07_sfx_library():
    from src.product_studio.sfx_library import (
        SFX_CATALOG,
        get_sfx_by_id,
        get_sfx_by_category,
        auto_select_sfx_for_product,
    )
    assert len(SFX_CATALOG) >= 12
    assert get_sfx_by_id("asmr_crunch_01") is not None
    assert get_sfx_by_id("nonexistent") is None
    asmr = get_sfx_by_category("asmr")
    assert len(asmr) >= 4
    asmr_food = get_sfx_by_category("asmr", "food_cookies")
    assert any(e["id"] == "asmr_crunch_01" for e in asmr_food)
    selection = auto_select_sfx_for_product("food_cookies")
    assert "ambient_id" in selection
    assert "hit_ids" in selection


def test_08_audio_mixing(tmp_path, monkeypatch):
    from src.product_studio.take_composer import compose_take_audio, calculate_sfx_offsets

    offsets = calculate_sfx_offsets([4.0, 4.0, 4.0], transition_duration=0.5)
    assert offsets[0] == 0.0
    assert offsets[1] == 3.5
    assert offsets[2] == 7.0

    calls = []
    import subprocess

    def fake_run(cmd, **kw):
        calls.append(cmd)

        class R:
            returncode = 0

        return R()

    monkeypatch.setattr(subprocess, "run", fake_run)

    out = tmp_path / "mixed.m4a"
    compose_take_audio(
        ambient_path=None,
        sfx_entries=[],
        output_path=str(out),
        total_duration=12.0,
    )
    assert len(calls) == 1
    cmd = calls[0]
    assert "ffmpeg" in cmd[0]
    assert "anullsrc" in " ".join(cmd)

    calls.clear()
    fake_sfx = tmp_path / "hit.mp3"
    fake_sfx.write_bytes(b"\x00" * 16)
    out2 = tmp_path / "mixed_with_sfx.m4a"
    compose_take_audio(
        ambient_path=None,
        sfx_entries=[
            {"path": str(fake_sfx), "offset_sec": 3.5, "volume": 0.8},
            {"path": str(fake_sfx), "offset_sec": 7.0, "volume": 0.6},
        ],
        output_path=str(out2),
        total_duration=12.0,
    )
    assert len(calls) == 1
    cmd2 = calls[0]
    cmd2_joined = " ".join(cmd2)
    assert "amix=inputs=3" in cmd2_joined
    assert "adelay=3500|3500" in cmd2_joined
    assert "adelay=7000|7000" in cmd2_joined
    assert "volume=0.8" in cmd2_joined
    assert "volume=0.6" in cmd2_joined


def test_09_video_composition(tmp_path, monkeypatch):
    from src.product_studio.take_composer import compose_takes

    calls = []

    def fake_concat(segment_paths, output_path, transition_duration, transition_type):
        calls.append({
            "paths": segment_paths,
            "duration": transition_duration,
            "type": transition_type,
        })
        open(output_path, "w").close()
        return output_path

    monkeypatch.setattr("src.reels_pipeline.video_builder.concat_segments", fake_concat)

    v1 = tmp_path / "v1.mp4"
    v1.write_text("")
    v2 = tmp_path / "v2.mp4"
    v2.write_text("")
    v3 = tmp_path / "v3.mp4"
    v3.write_text("")
    out = tmp_path / "composed.mp4"

    compose_takes(
        video_paths=[str(v1), str(v2), str(v3)],
        transition_types=["dissolve", "cut"],
        output_path=str(out),
        transition_duration=0.5,
    )
    assert len(calls) == 2
    assert calls[0]["duration"] == 0.5
    assert calls[1]["duration"] == 0.0


@pytest.mark.xfail(reason="REQ-PS2-10: multi-format export not yet implemented", strict=True)
def test_10_multi_format_export():
    assert False, "multi-format export not implemented"


@pytest.mark.xfail(reason="REQ-PS2-11: backward compat not yet implemented", strict=True)
def test_11_backward_compat():
    assert False, "backward compat not implemented"
