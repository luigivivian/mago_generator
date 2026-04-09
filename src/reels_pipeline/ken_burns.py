"""Mood-driven Ken Burns engine for reels pipeline.

Maps each scene's mood to a zoompan preset (zoom direction, pan offset,
easing curve) and generates the ffmpeg zoompan filter string.

Phase 26: Replaces the even/odd alternation pattern with mood-aware presets.
"""

from __future__ import annotations

from src.reels_pipeline.config import REELS_KENBURNS_EASING, REELS_KENBURNS_MIN_DURATION

# Re-export config constants for convenience
__all__ = [
    "MOOD_PRESETS",
    "MOOD_CAMERA_MAP",
    "get_kb_filter",
    "REELS_KENBURNS_EASING",
    "REELS_KENBURNS_MIN_DURATION",
]

# 7 mood presets: start_zoom, end_zoom, pan_x (horizontal rate), pan_y (vertical rate)
# Zoom range ~15% for all directional presets (matching existing 0.0008/frame baseline).
# pan_x/pan_y are per-frame pixel offsets added to the center expression.
MOOD_PRESETS: dict[str, dict[str, float]] = {
    "mysterious": {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0.0,   "pan_y": 0.0},
    "dramatic":   {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0.02,  "pan_y": -0.02},
    "hopeful":    {"start_zoom": 1.15, "end_zoom": 1.0,  "pan_x": 0.0,   "pan_y": 0.0},
    "tense":      {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0.0,   "pan_y": -0.015},
    "calm":       {"start_zoom": 1.05, "end_zoom": 1.05, "pan_x": 0.01,  "pan_y": 0.0},
    "sad":        {"start_zoom": 1.12, "end_zoom": 1.0,  "pan_x": 0.0,   "pan_y": 0.0},
    "epic":       {"start_zoom": 1.0,  "end_zoom": 1.18, "pan_x": 0.015, "pan_y": -0.012},
}

# Kie.ai camera direction prompts per mood (used by _build_scene_motion_prompt)
MOOD_CAMERA_MAP: dict[str, str] = {
    "mysterious": "Slow push-in to medium close-up",
    "dramatic":   "Diagonal tracking shot",
    "hopeful":    "Gentle pull-back to wide establishing shot",
    "tense":      "Steady push-in with slight upward tilt",
    "calm":       "Subtle lateral drift",
    "sad":        "Slow pull-back from close-up",
    "epic":       "Dynamic wide-to-close zoom with diagonal sweep",
}


def _zoom_expr(start: float, end: float, frames: int, easing: str) -> str:
    """Build the ffmpeg zoompan z= expression string.

    Args:
        start: starting zoom level (e.g. 1.0)
        end: ending zoom level (e.g. 1.15)
        frames: total number of frames
        easing: "linear" or "ease-in-out" (smoothstep 3t^2 - 2t^3)
    """
    zoom_range = end - start
    if abs(zoom_range) < 0.001:
        return str(start)

    lo = min(start, end)
    hi = max(start, end)

    if easing == "linear":
        return f"min(max({start}+(on/{frames})*{zoom_range},{lo}),{hi})"

    # ease-in-out: smoothstep = 3t^2 - 2t^3 where t = on/frames
    return (
        f"st(0\\, on/{frames});"
        f" st(1\\, 3*ld(0)*ld(0) - 2*ld(0)*ld(0)*ld(0));"
        f" {start} + ld(1)*{zoom_range}"
    )


def _pan_expr(pan_rate: float, base_expr: str, frames: int) -> str:
    """Build pan x or y expression with optional drift.

    Args:
        pan_rate: per-frame drift rate (0 = no drift, use base only)
        base_expr: center expression e.g. "iw/2-(iw/zoom/2)"
        frames: total frames (unused currently, available for future curves)
    """
    if pan_rate == 0:
        return base_expr
    return f"{base_expr} + on*{pan_rate}"


def get_kb_filter(
    mood: str,
    duration: float,
    fps: int = 30,
    easing: str | None = None,
    width: int = 1080,
    height: int = 1920,
) -> str:
    """Generate a complete ffmpeg zoompan filter string for a scene.

    Returns empty string if duration is too short (below REELS_KENBURNS_MIN_DURATION).
    Falls back to 'calm' preset for unknown moods.

    Args:
        mood: scene mood key (one of MOOD_PRESETS keys)
        duration: scene duration in seconds
        fps: frames per second
        easing: "linear" or "ease-in-out"; None defaults to config value
        width: output width in pixels
        height: output height in pixels

    Returns:
        Complete ffmpeg filter string (scale + zoompan), or "" if gated.
    """
    if easing is None:
        easing = REELS_KENBURNS_EASING

    if duration <= REELS_KENBURNS_MIN_DURATION:
        return ""

    preset = MOOD_PRESETS.get(mood, MOOD_PRESETS["calm"])
    frames = int(duration * fps)

    z_expr = _zoom_expr(preset["start_zoom"], preset["end_zoom"], frames, easing)

    base_x = "iw/2-(iw/zoom/2)"
    base_y = "ih/2-(ih/zoom/2)"
    x_expr = _pan_expr(preset["pan_x"], base_x, frames)
    y_expr = _pan_expr(preset["pan_y"], base_y, frames)

    return (
        f"scale={width * 2}:-1,"
        f"zoompan=z='{z_expr}':d={frames}:x='{x_expr}':y='{y_expr}'"
        f":s={width}x{height}:fps={fps}"
    )
