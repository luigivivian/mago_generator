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


@pytest.mark.xfail(reason="REQ-PS2-03: scene generation not yet implemented", strict=True)
def test_03_scene_generation():
    assert False, "generate_storyboard not implemented"


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


@pytest.mark.xfail(reason="REQ-PS2-06: kling multi-image not yet implemented", strict=True)
def test_06_kling_multi_image():
    assert False, "kling_v3 multi-image payload not implemented"


@pytest.mark.xfail(reason="REQ-PS2-07: sfx library not yet implemented", strict=True)
def test_07_sfx_library():
    assert False, "SFX library not implemented"


@pytest.mark.xfail(reason="REQ-PS2-08: audio mixing not yet implemented", strict=True)
def test_08_audio_mixing():
    assert False, "audio mixing not implemented"


@pytest.mark.xfail(reason="REQ-PS2-09: video composition not yet implemented", strict=True)
def test_09_video_composition():
    assert False, "video composition not implemented"


@pytest.mark.xfail(reason="REQ-PS2-10: multi-format export not yet implemented", strict=True)
def test_10_multi_format_export():
    assert False, "multi-format export not implemented"


@pytest.mark.xfail(reason="REQ-PS2-11: backward compat not yet implemented", strict=True)
def test_11_backward_compat():
    assert False, "backward compat not implemented"
