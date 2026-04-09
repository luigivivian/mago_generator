"""Phase 26: Mood-Driven Ken Burns -- validation suite.

Wave 0 (plan 26-01) creates all 5 tests as xfail stubs, then flips 4 to active.
Wave 1 (plan 26-02) flips test_03 from xfail -> active after concat wiring.

DO NOT rename a test without updating 26-VALIDATION.md.
"""

from __future__ import annotations

import pytest


# ---------------------------------------------------------------------------
# MOTION-01 -- mood preset map has all 7 moods with correct fields
# Bound to: 26-01 Plan (Wave 0), ken_burns.py MOOD_PRESETS dict
# ---------------------------------------------------------------------------

def test_01_mood_preset_map():
    """MOTION-01: MOOD_PRESETS has 7 keys, each with float start_zoom/end_zoom/pan_x/pan_y."""
    from src.reels_pipeline.ken_burns import MOOD_PRESETS
    expected_moods = {"mysterious", "dramatic", "hopeful", "tense", "calm", "sad", "epic"}
    assert set(MOOD_PRESETS.keys()) == expected_moods
    for mood, preset in MOOD_PRESETS.items():
        assert isinstance(preset["start_zoom"], float), f"{mood} start_zoom not float"
        assert isinstance(preset["end_zoom"], float), f"{mood} end_zoom not float"
        assert isinstance(preset["pan_x"], float), f"{mood} pan_x not float"
        assert isinstance(preset["pan_y"], float), f"{mood} pan_y not float"


# ---------------------------------------------------------------------------
# MOTION-02 -- zoompan filter string contains expected params
# Bound to: 26-01 Plan (Wave 0), get_kb_filter function
# ---------------------------------------------------------------------------

def test_02_preset_zoompan_params():
    """MOTION-02: get_kb_filter returns zoompan filter with correct d= and pan expressions."""
    from src.reels_pipeline.ken_burns import get_kb_filter
    result = get_kb_filter("dramatic", 8.0, 30)
    assert "zoompan" in result
    assert "d=240" in result  # 8.0s * 30fps = 240 frames
    # dramatic has non-zero pan_x and pan_y
    assert "iw/2-(iw/zoom/2)" in result  # base x pan expression present


# ---------------------------------------------------------------------------
# MOTION-03 -- concat path applies KB to static clips
# Bound to: 26-02 Plan (Wave 1), concat_clips_with_audio wiring
# ---------------------------------------------------------------------------

def test_03_concat_path_applies_kb():
    """MOTION-03: static clips in economic mode get KB via _make_static, verified by source inspection."""
    import inspect
    from src.reels_pipeline.ken_burns import get_kb_filter
    from src.reels_pipeline import main

    # Verify get_kb_filter produces zoompan for long dramatic scenes
    result = get_kb_filter("dramatic", 8.0, 30)
    assert "zoompan" in result

    # Verify wiring: main.py source contains get_kb_filter and MOOD_CAMERA_MAP
    source = inspect.getsource(main)
    assert "get_kb_filter" in source, "_make_static must call get_kb_filter"
    assert "MOOD_CAMERA_MAP" in source, "_build_scene_motion_prompt must use MOOD_CAMERA_MAP"


# ---------------------------------------------------------------------------
# MOTION-04 -- easing config produces different expressions
# Bound to: 26-01 Plan (Wave 0), _zoom_expr easing parameter
# ---------------------------------------------------------------------------

def test_04_easing_config():
    """MOTION-04: linear easing vs ease-in-out produce different zoom expressions."""
    from src.reels_pipeline.ken_burns import get_kb_filter
    linear = get_kb_filter("mysterious", 8.0, 30, easing="linear")
    smooth = get_kb_filter("mysterious", 8.0, 30, easing="ease-in-out")
    assert "on/" in linear  # linear ramp uses on/frames
    assert "ld(0)" in smooth  # smoothstep uses stored variable


# ---------------------------------------------------------------------------
# MOTION-05 -- duration gate returns empty for short scenes
# Bound to: 26-01 Plan (Wave 0), REELS_KENBURNS_MIN_DURATION gate
# ---------------------------------------------------------------------------

def test_05_duration_gate():
    """MOTION-05: duration <= 6.0 returns empty, > 6.0 returns zoompan filter."""
    from src.reels_pipeline.ken_burns import get_kb_filter
    short = get_kb_filter("dramatic", 5.0, 30)
    assert short == ""
    long = get_kb_filter("dramatic", 7.0, 30)
    assert "zoompan" in long
