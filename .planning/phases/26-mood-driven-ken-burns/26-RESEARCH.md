# Phase 26: Mood-Driven Ken Burns - Research

**Researched:** 2026-04-09
**Domain:** FFmpeg zoompan filter, mood-to-motion mapping, Python module design
**Confidence:** HIGH

## Summary

Phase 26 replaces the hard-coded even/odd zoom alternation in `video_builder.py:216-228` with a mood-driven Ken Burns preset map. The `CenaSchema.mood` field (landed in Phase 24, 7 enum values) drives which zoompan expression is applied per scene. This must work in both the static slideshow path (`build_reel_video`) and the economic/Kie.ai static clips path (`concat_clips_with_audio`). A duration gate (>6s, from real per-cena durations landed in Phase 22) prevents Ken Burns from being applied to short scenes.

The FFmpeg `zoompan` filter is well-documented and the expressions needed for all 7 presets are straightforward. The main complexity is: (1) threading `scene_timings` and `script` (with mood data) into `build_reel_video` (which currently has neither), (2) applying zoompan to static clips in the economic mode path (currently bare `scale+pad` only), and (3) implementing quadratic easing via zoompan's `z=` expression (replacing the linear `zoom+0.0008` increment).

**Primary recommendation:** Create a standalone `src/reels_pipeline/ken_burns.py` module with a `MOOD_PRESETS` dict and a `get_kb_filter(mood, duration, fps, easing, width, height)` pure function that returns the full ffmpeg zoompan filter string. All call sites import this one function.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 7 distinct presets: `mysterious`=slow zoom-in, `dramatic`=diagonal pan, `hopeful`=zoom-out wide, `tense`=push-in, `calm`=gentle drift, `sad`=slow pull-back, `epic`=wide-to-close zoom
- Zoom intensity: uniform 15% range (0.0008/frame baseline, same as current)
- Pan direction for directional presets: use ffmpeg zoompan x/y expressions (not just center-locked)
- Also update `_build_scene_motion_prompt` in main.py to use mood->camera-direction mapping (consistent with ffmpeg presets, replaces even/odd index logic)
- Read `tts.cenas[i].duration` -- if <= 6.0s, render static (no motion). Use `REELS_KENBURNS_MIN_DURATION=6.0` config constant with env override
- Wire `scene_timings` param into `build_reel_video` so each scene gets its real duration instead of fixed `image_duration` -- enables per-scene > 6s gate
- Add zoompan to static-image clips in `concat_clips_with_audio` economic mode (currently bare). Kie.ai clips stay untouched (already have motion)
- Detect static vs Kie.ai clips via `_make_static` flag/filename pattern
- Quadratic ease-in-out via ffmpeg zoompan `z=` expression (replace linear `zoom+0.0008` with frame-position-aware formula)
- `REELS_KENBURNS_EASING` env var: `ease-in-out` (default), `linear`
- New `src/reels_pipeline/ken_burns.py` module with `MOOD_PRESETS` dict and `get_kb_filter(mood, duration, fps)` helper
- Test strategy: Wave 0 xfail stubs (matching Phase 22-25 pattern), then flip to GREEN. Test the preset map (pure function) + verify ffmpeg filter string output per mood

### Claude's Discretion
- Exact quadratic coefficients for the easing curve
- ffmpeg zoompan expression syntax details for diagonal/drift pans
- How to structure the xfail->GREEN test waves

### Deferred Ideas (OUT OF SCOPE)
- Sinusoidal easing (quadratic chosen for MVP)
- Per-mood zoom intensity (uniform 15% for MVP)
- Remotion frontend KB (already exists via 999.14 -- this phase is backend ffmpeg only)
- Advanced motion: split-screen, cross-fade variants
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOTION-01 | Replace even/odd pattern with mood->preset map | MOOD_PRESETS dict in ken_burns.py; zoompan expressions per mood documented below |
| MOTION-02 | Presets with {startScale, endScale, panX, panY} per ref doc 6.3 | Full zoompan expression mapping for all 7 presets + diagonal/drift pans |
| MOTION-03 | Ken Burns in concat_clips_with_audio path too (not just slideshow) | Static clip detection via scene status + zoompan injection in economic mode |
| MOTION-04 | Configurable easing (linear vs ease-in-out) via env var | Quadratic easing expression for zoompan z= documented; env var pattern from config.py |
| MOTION-05 | KB only when cena duration > 6s (using real tts durations) | scene_timings threading into build_reel_video; gate logic using REELS_KENBURNS_MIN_DURATION |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ffmpeg | 8.1 (local) | Video assembly with zoompan filter | Already the project's video tool; zoompan is the canonical Ken Burns filter |
| pytest | 9.0.2 | Test framework | Already in use across Phases 22-25 |
| Python stdlib `os` | 3.x | Env var config pattern | Matches existing config.py pattern |

### Supporting
No new dependencies. This phase is entirely ffmpeg filter expression work + Python module creation.

## Architecture Patterns

### New Module: `src/reels_pipeline/ken_burns.py`

```
src/reels_pipeline/
├── ken_burns.py       # NEW: MOOD_PRESETS dict + get_kb_filter() pure function
├── video_builder.py   # MODIFIED: imports get_kb_filter, replaces even/odd block
├── main.py            # MODIFIED: _build_scene_motion_prompt uses mood->camera map
├── config.py          # MODIFIED: adds REELS_KENBURNS_EASING, REELS_KENBURNS_MIN_DURATION
└── timing.py          # UNCHANGED: already provides scene_timings
```

### Pattern 1: Pure Function Filter Builder

The `get_kb_filter()` function is a **pure function** (no I/O, no state). Input: mood string + duration + fps + easing + dimensions. Output: ffmpeg filter string. This makes it trivially testable.

```python
# Source: project convention from timing.py (pure function pattern)
def get_kb_filter(
    mood: str,
    duration: float,
    fps: int = 30,
    easing: str = "ease-in-out",
    width: int = 1080,
    height: int = 1920,
) -> str:
    """Return ffmpeg zoompan filter string for the given mood preset.
    
    Returns empty string if duration <= REELS_KENBURNS_MIN_DURATION.
    """
```

### Pattern 2: Zoompan Expression Construction

The ffmpeg zoompan filter accepts expression strings for `z`, `x`, `y`, `d`, and `s` parameters. Key variables available inside expressions:

| Variable | Meaning |
|----------|---------|
| `zoom` | Current zoom level (last calculated) |
| `on` | Output frame number (0-indexed) |
| `iw`, `ih` | Input width/height |
| `time` / `ot` | Output timestamp in seconds |

**Linear zoom-in (current code, to be replaced):**
```
z='min(zoom+0.0008,1.15)'
x='iw/2-(iw/zoom/2)'
y='ih/2-(ih/zoom/2)'
```

**Quadratic ease-in-out zoom** (MOTION-04, recommended approach):

Use the frame-position-normalized expression with `on` and `d` (total frames). The quadratic formula `3t^2 - 2t^3` (smoothstep) gives ease-in-out:

```
# Normalized time: t = on/d (0.0 to 1.0)
# Smoothstep: p = 3*t*t - 2*t*t*t
# Zoom: base + p * range
z='st(0, on/{frames}); st(1, 3*ld(0)*ld(0) - 2*ld(0)*ld(0)*ld(0)); 1.0 + ld(1)*0.15'
```

For **linear** easing (the env var override):
```
z='1.0 + (on/{frames})*0.15'
```

### Pattern 3: Seven Mood Presets as Zoompan Expressions

Based on ref doc section 6.3 presets and ffmpeg zoompan capabilities:

| Mood | Preset Name | z expression | x expression | y expression | Visual |
|------|-------------|-------------|-------------|-------------|--------|
| `mysterious` | slow_zoom_in | `1.0 -> 1.15` | `iw/2-(iw/zoom/2)` | `ih/2-(ih/zoom/2)` | Center zoom-in |
| `dramatic` | diagonal | `1.0 -> 1.15` | `iw/2-(iw/zoom/2) + on*0.15` | `ih/2-(ih/zoom/2) - on*0.1` | Zoom + diagonal drift |
| `hopeful` | slow_zoom_out | `1.15 -> 1.0` (init if(eq(on,1),1.15,...)) | `iw/2-(iw/zoom/2)` | `ih/2-(ih/zoom/2)` | Center zoom-out |
| `tense` | push_in | `1.0 -> 1.15` | `iw/2-(iw/zoom/2)` | `ih*0.4-(ih/zoom/2)` (upper-center focus) | Slow push-in, slightly off-center |
| `calm` | gentle_drift | `1.05` (constant) | `iw/2-(iw/zoom/2) + on*0.08` | `ih/2-(ih/zoom/2)` | Gentle horizontal drift |
| `sad` | slow_pull_back | `1.12 -> 1.0` | `iw/2-(iw/zoom/2)` | `ih/2-(ih/zoom/2)` | Slow zoom-out from close |
| `epic` | wide_to_close | `1.0 -> 1.18` | `iw/2-(iw/zoom/2) + on*0.1` | `ih/2-(ih/zoom/2) - on*0.08` | Aggressive zoom + diagonal |

**Critical zoompan notes (from official docs):**
- Zoom range is 1-10 (values <1 clamped to 1)
- For zoom-out, must initialize with `if(eq(on,1), startZoom, ...)` because initial zoom defaults to 1.0
- Pan expressions `x` and `y` are pixel positions of the top-left corner of the output crop within the (zoomed) input
- The `d` parameter is frames per input image (since we use `-loop 1 -t {duration}`, there is only 1 input image)

### Pattern 4: Easing Implementation Detail

The quadratic smoothstep `3t^2 - 2t^3` maps `t in [0,1]` to a smooth S-curve. In ffmpeg expression syntax:

```python
# Python that generates the ffmpeg expression string
def _zoom_expr(start: float, end: float, frames: int, easing: str) -> str:
    zoom_range = end - start
    if easing == "linear":
        return f"'{start} + (on/{frames})*{zoom_range}'"
    else:  # ease-in-out (smoothstep)
        return (
            f"'st(0, on/{frames});"
            f" st(1, 3*ld(0)*ld(0) - 2*ld(0)*ld(0)*ld(0));"
            f" {start} + ld(1)*{zoom_range}'"
        )
```

For zoom-out (start > end), reverse: `start - ld(1) * abs(range)`. The `if(eq(on,1), ...)` initialization trick is NOT needed when using the expression-based approach because we compute absolute zoom from frame position rather than relative increments.

### Pattern 5: Static Clip Detection in Economic Mode

In `run_step_video_kie`, economic mode produces clips via `_make_static()`. Each scene gets `"static": True` in its status dict. The concat path can detect these via:

1. **Scene status dict** (preferred): `scene.get("static", False)` -- already set in the economic mode block
2. **Filename pattern**: clips produced by `_make_static` are named `clip_XX.mp4` (same as Kie.ai clips, so not distinguishable by name alone)

For the `concat_clips_with_audio` path, the approach is:
- Add an optional `moods: list[str] | None` parameter
- For each static clip (identified by scene_timings or clip metadata), apply zoompan before the xfade chain
- Kie.ai clips already have motion, so they pass through unchanged

### Anti-Patterns to Avoid

- **Modifying zoompan in concat's xfade chain:** The zoompan must be applied BEFORE the clip enters the xfade pipeline. Apply it as a pre-processing step (re-encode the static clip with zoompan) or as a filter before the xfade input label.
- **Using relative zoom increments for ease-in-out:** The current `zoom+0.0008` pattern doesn't support easing because it's relative. Use absolute position: `base + eased_progress * range`.
- **Hardcoding frame counts:** Always derive from `duration * fps`. Different scenes have different durations (Phase 22 real durations).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zoompan filter | Custom pixel manipulation in Python | FFmpeg zoompan filter | Hardware-accelerated, battle-tested, already in the pipeline |
| Easing curves | Custom frame-by-frame interpolation | FFmpeg expression `st()/ld()` | Runs inside FFmpeg's filter graph, zero overhead |
| Duration measurement | Custom audio parsing | `ffprobe` via existing `get_video_duration` | Already proven in Phase 22-23 |

## Common Pitfalls

### Pitfall 1: Zoom-Out Initialization
**What goes wrong:** FFmpeg zoompan starts `zoom` at 1.0 by default. If you use `zoom-0.0008` for zoom-out, the first frame tries to go below 1.0 and gets clamped.
**Why it happens:** The `zoom` variable is initialized to 1.0 (the filter's default starting zoom).
**How to avoid:** Use expression-based absolute positioning: `start - progress * range` where progress is `on/frames`. OR use the classic `if(eq(on,1), startValue, zoom-delta)` pattern.
**Warning signs:** Zoom-out scenes look static (no visible motion).

### Pitfall 2: Pan Expression Clamping
**What goes wrong:** If `x` or `y` expressions evaluate to positions that would show beyond the source image boundary, ffmpeg clamps them silently. The pan appears to "stick" at the edge.
**Why it happens:** zoompan refuses to pan beyond the input image boundary.
**How to avoid:** Keep pan increments small relative to the zoom level. With 15% zoom (1.15x), you have ~7.5% of image width/height as usable pan range. Don't exceed `(zoom-1)/2 * iw` for x-pan.
**Warning signs:** Pan motion stops partway through the scene.

### Pitfall 3: build_reel_video Doesn't Have Per-Scene Durations
**What goes wrong:** Currently `build_reel_video` uses a single `image_duration` for ALL scenes. Adding the >6s gate requires knowing each scene's real duration.
**Why it happens:** The function was designed before Phase 22 added per-cena durations.
**How to avoid:** Thread `scene_timings` as a new parameter. When present, use `scene_timings[i].duration` instead of `image_duration` for both the `-t` input flag and the zoompan `d=` parameter. Fall back to `image_duration` for legacy calls.
**Warning signs:** All scenes get KB or none get KB (gate not working per-scene).

### Pitfall 4: Static Clip in Economic Mode Has No Zoompan
**What goes wrong:** `_make_static()` in `main.py:896-903` produces clips with `scale+pad` only. When these clips go through `concat_clips_with_audio`, no zoompan is applied because `concat_clips_with_audio` works with video clips (not images) and doesn't have a zoompan step.
**Why it happens:** Economic mode was designed as a quick bypass; KB was expected to come from the frontend editor.
**How to avoid:** Two options: (A) Apply zoompan inside `_make_static()` itself when mood is available, or (B) Apply zoompan as a pre-filter in `concat_clips_with_audio` for static clips. Option A is simpler because it produces ready-to-use clips.
**Warning signs:** Economic mode reels have no motion at all.

### Pitfall 5: build_segment_videos Also Calls build_reel_video
**What goes wrong:** The segmentation path (`total_duration > 30s`) calls `build_segment_videos` which calls `build_reel_video` per segment. If you only modify `build_reel_video`, the mood/timings need to flow through `build_segment_videos` too.
**Why it happens:** The segmentation path slices the script into sub-scripts. Each segment's `build_reel_video` call needs its own slice of scene_timings and moods.
**How to avoid:** Thread the scene_timings through `run_step_video -> build_segment_videos -> build_reel_video`. Each segment gets its relevant slice.
**Warning signs:** Segmented (>30s) reels have no KB motion.

### Pitfall 6: ffmpeg Expression Semicolons Need Escaping
**What goes wrong:** The `filter_complex` string uses `;` as a filter separator. Zoompan expressions using `st()/ld()` also use `;` internally.
**Why it happens:** Semicolons serve dual purpose in ffmpeg filter_complex strings.
**How to avoid:** The zoompan `z=` expression is wrapped in single quotes inside the filter string. Since zoompan's expression parser runs inside the filter, internal semicolons within the `z='...'` value are parsed by the expression engine, not the filter graph parser. The quoting already in the code (`z='{expr}'`) handles this correctly.
**Warning signs:** ffmpeg parse errors mentioning "unexpected end of filter" or "invalid expression".

## Code Examples

### Example 1: ken_burns.py Core Structure

```python
# Source: synthesized from ref doc 6.3 + ffmpeg zoompan docs
import os

REELS_KENBURNS_MIN_DURATION = float(
    os.environ.get("REELS_KENBURNS_MIN_DURATION", "6.0")
)
REELS_KENBURNS_EASING = os.environ.get("REELS_KENBURNS_EASING", "ease-in-out")

MOOD_PRESETS = {
    "mysterious": {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0,     "pan_y": 0},
    "dramatic":   {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0.02,  "pan_y": -0.02},
    "hopeful":    {"start_zoom": 1.15, "end_zoom": 1.0,  "pan_x": 0,     "pan_y": 0},
    "tense":      {"start_zoom": 1.0,  "end_zoom": 1.15, "pan_x": 0,     "pan_y": -0.015},
    "calm":       {"start_zoom": 1.05, "end_zoom": 1.05, "pan_x": 0.01,  "pan_y": 0},
    "sad":        {"start_zoom": 1.12, "end_zoom": 1.0,  "pan_x": 0,     "pan_y": 0},
    "epic":       {"start_zoom": 1.0,  "end_zoom": 1.18, "pan_x": 0.015, "pan_y": -0.012},
}

# Mood -> Kie.ai camera direction (for _build_scene_motion_prompt)
MOOD_CAMERA_MAP = {
    "mysterious": "Slow push-in to medium close-up",
    "dramatic":   "Diagonal tracking shot",
    "hopeful":    "Gentle pull-back to wide establishing shot",
    "tense":      "Steady push-in with slight upward tilt",
    "calm":       "Subtle lateral drift",
    "sad":        "Slow pull-back from close-up",
    "epic":       "Dynamic wide-to-close zoom with diagonal sweep",
}
```

### Example 2: Zoompan Filter String Generation

```python
# Source: ffmpeg zoompan docs + smoothstep easing
def _zoom_expr(start: float, end: float, frames: int, easing: str) -> str:
    zoom_range = end - start
    if abs(zoom_range) < 0.001:
        return str(start)  # constant zoom (calm preset drift)
    if easing == "linear":
        if zoom_range > 0:
            return f"min({start}+(on/{frames})*{zoom_range},{end})"
        else:
            return f"if(eq(on\\,1)\\,{start}\\,max({start}+(on/{frames})*{zoom_range}\\,{end}))"
    else:  # ease-in-out (smoothstep: 3t^2 - 2t^3)
        return (
            f"st(0\\, on/{frames});"
            f" st(1\\, 3*ld(0)*ld(0) - 2*ld(0)*ld(0)*ld(0));"
            f" {start} + ld(1)*{zoom_range}"
        )
```

### Example 3: Full get_kb_filter Output

```python
# For mood="dramatic", duration=8.0, fps=30, easing="ease-in-out"
# frames = 8.0 * 30 = 240
# Output:
"zoompan=z='st(0\\, on/240); st(1\\, 3*ld(0)*ld(0) - 2*ld(0)*ld(0)*ld(0)); 1.0 + ld(1)*0.15'"
":d=240"
":x='iw/2-(iw/zoom/2) + on*0.02'"
":y='ih/2-(ih/zoom/2) + on*(-0.02)'"
":s=1080x1920:fps=30"
```

### Example 4: Modified build_reel_video Zoompan Block

```python
# Current (to be replaced):
if i % 2 == 0:
    zoom = "min(zoom+0.0008,1.15)"
else:
    zoom = "if(eq(on\\,1)\\,1.15\\,max(zoom-0.0008\\,1.0))"

# New (mood-driven):
from src.reels_pipeline.ken_burns import get_kb_filter, REELS_KENBURNS_MIN_DURATION

# Inside the loop:
scene_dur = scene_timings[i]["duration"] if scene_timings and i < len(scene_timings) else image_duration
mood = moods[i] if moods and i < len(moods) else "calm"

if REELS_KENBURNS_ENABLED and scene_dur > REELS_KENBURNS_MIN_DURATION:
    kb_filter = get_kb_filter(mood, scene_dur, fps)
    scale_filters.append(f"[{i}]{kb_filter}[s{i}]")
else:
    scale_filters.append(
        f"[{i}]scale=1080:1920:force_original_aspect_ratio=decrease,"
        f"pad=1080:1920:-1:-1:color=black[s{i}]"
    )
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | pytest.ini (assumed from project root) |
| Quick run command | `python -m pytest tests/test_reels_ken_burns.py -x -q` |
| Full suite command | `python -m pytest tests/ -x -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOTION-01 | mood->preset map returns correct preset for each of 7 moods | unit | `pytest tests/test_reels_ken_burns.py::test_01_mood_preset_map -x` | Wave 0 |
| MOTION-02 | zoompan filter string contains correct z/x/y expressions for each preset | unit | `pytest tests/test_reels_ken_burns.py::test_02_preset_zoompan_params -x` | Wave 0 |
| MOTION-03 | get_kb_filter is called in concat_clips_with_audio for static clips | unit | `pytest tests/test_reels_ken_burns.py::test_03_concat_path_applies_kb -x` | Wave 0 |
| MOTION-04 | easing=linear produces linear expr, ease-in-out produces smoothstep | unit | `pytest tests/test_reels_ken_burns.py::test_04_easing_config -x` | Wave 0 |
| MOTION-05 | duration <= 6.0 produces no zoompan (static fallback) | unit | `pytest tests/test_reels_ken_burns.py::test_05_duration_gate -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_reels_ken_burns.py -x -q`
- **Per wave merge:** `python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_reels_ken_burns.py` -- covers MOTION-01 through MOTION-05 (5 xfail stubs)
- [ ] No new conftest fixtures needed (ken_burns.py is pure functions, no mocking required)

## Open Questions

1. **Expression escaping in filter_complex chains**
   - What we know: The current code uses `\\,` for commas and `\\` for backslashes inside zoompan expressions. The `st()/ld()` functions use `;` which is also the filter_complex separator.
   - What's unclear: Whether the smoothstep expression's internal semicolons need escaping when embedded in a filter_complex chain.
   - Recommendation: Test the actual ffmpeg command with a sample image. The expression is inside single quotes in the zoompan parameter value, so ffmpeg's expression parser should handle it. But a quick smoke test during implementation is prudent.

2. **Segmented videos (>30s) threading**
   - What we know: `build_segment_videos` calls `build_reel_video` per segment. It passes `config_override` but not `scene_timings` or moods.
   - What's unclear: Whether any real production reels hit the >30s segmentation path.
   - Recommendation: Thread the data through for correctness, but deprioritize testing this path.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ffmpeg | zoompan filter generation + video assembly | Yes | 8.1 | -- |
| pytest | Test suite | Yes | 9.0.2 | -- |
| Python | Module code | Yes | 3.x | -- |

No missing dependencies.

## Sources

### Primary (HIGH confidence)
- FFmpeg zoompan filter documentation: https://ayosec.github.io/ffmpeg-filters-docs/8.0/Filters/Video/zoompan.html -- full parameter list, expression variables, examples
- Ken Burns FFmpeg blog: https://mko.re/blog/ken-burns-ffmpeg/ -- practical zoom-in/out/pan expressions
- Project reference doc: `pipeline-historia-narracao-imagem.md` section 6.3 -- mood->preset mapping specification

### Secondary (MEDIUM confidence)
- Creatomate FFmpeg zoom guide: https://creatomate.com/blog/how-to-zoom-images-and-videos-using-ffmpeg -- additional zoom expression patterns

### Tertiary (LOW confidence)
- ffmpeg expression `st()/ld()` for easing -- verified syntax exists in docs but complex multi-statement expressions in zoompan `z=` parameter are not widely documented with practical examples. Needs smoke test.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing tools
- Architecture: HIGH -- pure function module, well-understood ffmpeg filter, existing integration points mapped
- Pitfalls: HIGH -- all pitfalls verified against actual codebase (read every relevant function)
- Zoompan expressions: MEDIUM -- simple presets are well-documented; quadratic easing via `st()/ld()` in zoompan is less commonly documented but the expression engine supports it

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable domain, ffmpeg zoompan is mature)
