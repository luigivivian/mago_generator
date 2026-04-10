# Phase 1002: Product Studio v2 -- Cinematic Multi-Scene Ads - Research

**Researched:** 2026-04-10
**Domain:** Multi-scene video ad pipeline (backend Python + frontend Next.js + FFmpeg + Kling 3.0 API)
**Confidence:** HIGH

## Summary

The existing Product Studio pipeline (`src/product_studio/pipeline.py`) is a well-structured 8-step orchestrator that handles single-image-to-video generation. Phase 1002 extends this into a multi-scene cinematic pipeline with per-take editing, multi-image Kling generation, SFX audio mixing, and video composition with transitions.

The Kling 3.0 API on Kie.ai natively supports exactly what this phase needs: `kling_elements` for passing 2-4 product reference images per element, `multi_shots` mode with `multi_prompt` for up to 5 shots per task, and per-shot duration control (1-12s each, 3-15s total). The existing `KieSora2Client` already has a `kling_v3` input format but currently only passes a single image and disables multi_shots -- the extension path is clear.

The frontend currently has a wizard-based UI (`memelab/src/components/ads/wizard.tsx`) with 8 step components and rich preset data (`ad-presets.ts` with per-niche cameras, lighting, backgrounds, moods). The take editor (REQ-PS2-04) replaces the current linear stepper with a card-based editor where each take is independently configurable. The existing `concat_segments` function in `video_builder.py` already implements FFmpeg xfade transitions between video clips -- this can be reused directly for take composition.

**Primary recommendation:** Extend the existing `ProductAdPipeline` class with new multi-image steps, reuse the existing `concat_segments` xfade logic from the reels pipeline for video composition, and build the take editor as a new frontend component that replaces the current stepper for the generation phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-PS2-01 | Multi-image upload (3-4 images) | Existing ads route has `UploadFile` handling; extend to accept array. Kling elements accept 2-4 URLs. |
| REQ-PS2-02 | Image treatment pipeline | Existing `bg_remover.py` + `scene_composer.py` handle single images; extend to process batch with normalization for Kling (min 300x300, max 10MB, JPG/PNG) |
| REQ-PS2-03 | AI scene & script generation | Existing `analyze_product` + `build_video_prompt`; extend to generate multi-shot storyboard using Gemini structured output with category-aware defaults |
| REQ-PS2-04 | Take editor UI | New frontend component; replaces stepper. Existing `ad-presets.ts` has camera/lighting/mood presets per niche to populate dropdowns |
| REQ-PS2-05 | Category-aware prompt templates | 7 category configs defined in `guia-producao-visual-ai-produtos.md` Section 5.2; implement as Python dict/JSON with `build_product_prompt` pattern from Section 7 |
| REQ-PS2-06 | Kling multi-image video generation | Kie.ai Kling 3.0 API supports `kling_elements` (2-4 images per element) + `multi_shots` + `multi_prompt`. Existing `KieSora2Client._build_payload` has `kling_v3` format -- extend with elements support |
| REQ-PS2-07 | Audio SFX library | New capability; bundle starter library as static assets. No existing SFX infrastructure -- music_client.py handles Suno music only |
| REQ-PS2-08 | Audio mixing | Existing `format_exporter.mix_audio` handles TTS+music mixing with FFmpeg amix. Extend to layer SFX hits over ambient base per take |
| REQ-PS2-09 | Video composition | Existing `concat_segments` in `video_builder.py` already implements FFmpeg xfade transitions (fade, dissolve, etc.) between video clips. Direct reuse. |
| REQ-PS2-10 | Multi-format export | Existing `export_all_formats` + `export_blur_pad` in `format_exporter.py` handles 9:16, 16:9, 1:1 with blur padding. Direct reuse + add individual take export and thumbnail generation |
| REQ-PS2-11 | Replace existing /ads routes | Existing `ads.py` router at `/ads` prefix. Extend routes for multi-scene flow; keep old single-image job history visible via status field |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | Backend API routes | Project convention |
| SQLAlchemy | existing | Database models (ProductAdJob) | Project convention |
| Pydantic | existing | Request/response models | Project convention |
| FFmpeg | 8.1 | Video composition, transitions, audio mixing | Already installed, xfade transitions proven in reels pipeline |
| httpx | existing | Async HTTP for Kie.ai API | Project convention (KieSora2Client) |
| Pillow | existing | Image processing, resize, normalization | Already used in scene_composer |
| google-genai | existing | Gemini for analysis + scene generation | Already used in prompt_builder, scene_composer |
| Next.js | existing | Frontend (App Router) | Project convention |
| Tailwind CSS | existing | Styling | Project convention |
| shadcn/ui | existing | UI components (Card, Button, Select, Slider) | Already used in ads wizard |
| framer-motion | existing | Animations (stepper uses it) | Already imported in stepper.tsx |

### Supporting (new for this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | All capabilities exist in current stack |

**No new dependencies needed.** The entire phase can be built with existing libraries. Audio SFX files are static assets (MP3/WAV), not a library dependency.

## Architecture Patterns

### Backend: Extended Pipeline Steps

The current `ProductAdPipeline` has 8 steps. For v2, the pipeline becomes:

```
1. upload       -- Accept 3-4 images (NEW)
2. treatment    -- Resize/normalize images for Kling (REPLACES scene)
3. generation   -- AI generates multi-shot storyboard (REPLACES analysis+prompt)
4. video        -- Kling multi-image per take (EXTENDED)
5. audio        -- SFX library selection + mixing (EXTENDED)
6. composition  -- FFmpeg xfade stitch takes (NEW, uses existing concat_segments)
7. export       -- Multi-format + individual takes + thumbnail (EXTENDED)
```

### Recommended Project Structure Changes

```
src/product_studio/
  pipeline.py          # Extend ProductAdPipeline with v2 steps
  pipeline_v2.py       # OR: new class CinematicAdPipeline (cleaner separation)
  config.py            # Add category configs, SFX mappings
  models.py            # Add TakeConfig, StoryboardScene, v2 request models
  prompt_builder.py    # Add build_product_prompt with category templates
  scene_composer.py    # Add batch image treatment (resize/normalize)
  sfx_library.py       # NEW: SFX catalog + category auto-selection
  take_composer.py     # NEW: FFmpeg take composition (wraps concat_segments)

memelab/src/
  components/ads/
    take-editor.tsx    # NEW: Card-based take editor
    take-card.tsx      # NEW: Individual take configuration card
    sfx-picker.tsx     # NEW: SFX selection per take
    category-config.ts # NEW: 7 category configs (from guide JSON)
  app/(app)/ads/
    new/page.tsx       # Modify: v2 wizard flow (upload -> generate -> edit -> render)
```

### Pattern 1: Kling 3.0 Elements + Multi-Shot

**What:** Pass product images as `kling_elements` and use `multi_prompt` for per-take generation in a single API call.
**When to use:** When generating all takes for a single product ad.
**Example:**

```python
# Source: docs.kie.ai/market/kling/kling-3-0 [VERIFIED: WebFetch]
payload = {
    "model": "kling-3.0/video",
    "input": {
        "prompt": "Cinematic product commercial featuring @product_hero",
        "image_urls": [first_frame_url],  # Optional first frame
        "sound": False,
        "duration": "12",
        "aspect_ratio": "9:16",
        "mode": "pro",
        "multi_shots": True,
        "multi_prompt": [
            {"prompt": "Wide shot of @product_hero on marble, slow dolly push-in", "duration": 3},
            {"prompt": "Extreme macro of @product_hero texture detail", "duration": 3},
            {"prompt": "Action shot, @product_hero with dramatic lighting", "duration": 4},
        ],
        "kling_elements": [
            {
                "name": "product_hero",
                "description": "product being advertised",
                "element_input_urls": [img1_url, img2_url, img3_url, img4_url],
            }
        ],
    },
}
```

### Pattern 2: Category-Aware Prompt Templates

**What:** Deterministic prompt templates per product category with LLM enhancement.
**When to use:** Scene generation step -- select category defaults then optionally refine with Gemini.

```python
# Source: guia-producao-visual-ai-produtos.md Section 5.2 + Section 7 [VERIFIED: codebase]
CATEGORY_CONFIGS = {
    "food_cookies": {
        "display_name": "Cookies & Biscoitos",
        "surface": "dark slate | marble | rustic wood",
        "lighting": "dramatic side + warm backlight rim",
        "mood": "warm, indulgent, appetizing",
        "lens": "100mm macro, f/2.8",
        "hero_actions": ["cookie breaking in half", "chocolate chips melting", ...],
        "video_camera_moves": ["slow dolly push-in", "static with slow zoom", ...],
        "negative": "plastic look, flat lighting, cluttered",
    },
    # ... 6 more categories
}
```

### Pattern 3: Reusing concat_segments for Take Composition

**What:** The reels pipeline's `concat_segments` function already builds FFmpeg xfade filter chains.
**When to use:** Video composition step (REQ-PS2-09).

```python
# Source: src/reels_pipeline/video_builder.py:726 [VERIFIED: codebase]
from src.reels_pipeline.video_builder import concat_segments

# Compose takes with transitions
composed_path = concat_segments(
    segment_paths=[take1_path, take2_path, take3_path],
    output_path=os.path.join(job_dir, "composed.mp4"),
    transition_duration=0.5,
    transition_type="dissolve",  # fade, dissolve, wipeleft, etc.
)
```

### Anti-Patterns to Avoid

- **Generating takes individually via separate API calls:** Use Kling 3.0 `multi_shots` mode for coherent multi-take generation in a single call when possible. Fall back to per-take calls only when user edits individual takes.
- **Building a custom video transition system:** FFmpeg xfade already supports 30+ transition types. Use `concat_segments` directly.
- **LLM-only prompt generation:** Use category templates as the deterministic base, then optionally enhance with Gemini. Templates ensure consistent quality; LLM adds creative variation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video transitions | Custom frame blending | FFmpeg xfade via `concat_segments` | 30+ built-in transitions, hardware-accelerated |
| Audio crossfades | Manual sample mixing | FFmpeg `acrossfade` / `amix` | Already proven in `mix_audio` |
| Image resizing | Custom resize logic | Pillow `Image.resize(LANCZOS)` | Already used in scene_composer |
| Multi-format export | Custom aspect ratio conversion | `export_all_formats` + `export_blur_pad` | Blur-pad already handles all 3 formats |
| Video duration detection | Custom ffprobe wrapper | `get_video_duration` from video_builder | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: Kling element_input_urls image requirements
**What goes wrong:** API rejects images that are too small, too large, or wrong format.
**Why it happens:** Kling elements require 300x300 min, 10MB max, JPG/PNG only.
**How to avoid:** Image treatment step must normalize ALL uploaded images to these constraints before generating GCS URLs.
**Warning signs:** 422 errors from Kie.ai API during video generation step.

### Pitfall 2: Multi-shot total duration exceeds 15s
**What goes wrong:** Sum of per-shot durations in `multi_prompt` exceeds Kling's 15s max per task.
**Why it happens:** Take editor allows 3-10s per take; 4 takes at 5s = 20s > 15s limit.
**How to avoid:** Either: (a) validate total <= 15s and split into multiple Kling tasks, or (b) generate takes individually when total exceeds 15s, then compose with FFmpeg.
**Warning signs:** API rejection or silent truncation of later shots.

### Pitfall 3: @element_name reference counts toward 500-char prompt limit
**What goes wrong:** Each `@element_name` reference consumes 37 characters from the 500-char per-shot prompt limit.
**Why it happens:** Kling replaces @references with internal tokens.
**How to avoid:** Keep element names short (e.g., `@prod` not `@product_hero_main`). Budget: 500 - 37 = 463 chars for actual prompt text.
**Warning signs:** Truncated prompts producing unexpected video content.

### Pitfall 4: SFX audio sync with video transitions
**What goes wrong:** SFX hit sounds don't align with take transition points after xfade composition.
**Why it happens:** xfade transitions overlap clips by `transition_duration`, shifting all subsequent audio cue points.
**How to avoid:** Calculate audio cue offsets accounting for cumulative xfade overlap: `offset[i] = sum(durations[:i]) - i * transition_duration`. Same formula used in `concat_segments`.
**Warning signs:** Audio hits arriving early/late relative to visual transitions.

### Pitfall 5: Breaking backward compatibility for /ads routes
**What goes wrong:** Existing single-image ad jobs fail to load or display.
**Why it happens:** Schema changes to ProductAdJob break old records.
**How to avoid:** Add new columns (nullable), keep old columns functional. Use a `pipeline_version` field to distinguish v1 (single-image) from v2 (multi-scene) jobs. Both versions served from same routes.
**Warning signs:** 500 errors on /ads/jobs listing page.

## Code Examples

### Image Treatment: Normalize for Kling Elements

```python
# Pattern from existing scene_composer.py, extended for batch
from PIL import Image

KLING_MIN_PX = 300
KLING_MAX_BYTES = 10 * 1024 * 1024  # 10MB

def normalize_for_kling(input_path: str, output_path: str) -> str:
    """Resize/compress image to meet Kling element requirements."""
    img = Image.open(input_path).convert("RGB")
    w, h = img.size
    
    # Enforce minimum
    if w < KLING_MIN_PX or h < KLING_MIN_PX:
        scale = max(KLING_MIN_PX / w, KLING_MIN_PX / h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    
    # Save as JPEG with quality reduction until under 10MB
    quality = 95
    while quality >= 50:
        img.save(output_path, "JPEG", quality=quality)
        if os.path.getsize(output_path) <= KLING_MAX_BYTES:
            return output_path
        quality -= 10
    
    return output_path
```

### Take Editor Card Data Model

```typescript
// Frontend take configuration (maps to backend TakeConfig)
interface TakeConfig {
  id: string;
  order: number;
  prompt: string;            // Editable action description
  camera_move: string;       // dolly, orbit, macro_zoom, static, crane
  duration: number;          // 3-10 seconds
  transition_type: string;   // dissolve, cut, whip_pan, fade
  sfx_id: string | null;     // Selected SFX from library
  thumbnail_url?: string;    // Preview from first reference image
}
```

### Multi-Take Audio Composition

```python
# Layer SFX over ambient base using FFmpeg
def compose_take_audio(
    ambient_path: str,
    sfx_entries: list[dict],  # [{path, offset_sec, volume}]
    output_path: str,
    total_duration: float,
) -> str:
    """Mix ambient base + per-take SFX hits."""
    cmd = ["ffmpeg", "-y", "-i", ambient_path]
    for sfx in sfx_entries:
        cmd += ["-i", sfx["path"]]
    
    # Build amix with delay offsets
    filters = []
    inputs = [f"[0:a]atrim=0:{total_duration}[base]"]
    for i, sfx in enumerate(sfx_entries):
        delay_ms = int(sfx["offset_sec"] * 1000)
        vol = sfx.get("volume", 0.8)
        inputs.append(
            f"[{i+1}:a]adelay={delay_ms}|{delay_ms},volume={vol}[sfx{i}]"
        )
    
    mix_inputs = "[base]" + "".join(f"[sfx{i}]" for i in range(len(sfx_entries)))
    n = 1 + len(sfx_entries)
    filters = ";".join(inputs) + f";{mix_inputs}amix=inputs={n}:duration=first[out]"
    
    cmd += ["-filter_complex", filters, "-map", "[out]",
            "-c:a", "aac", "-b:a", "192k", output_path]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    return output_path
```

## State of the Art

| Old Approach (v1) | New Approach (v2) | Impact |
|-------------------|-------------------|--------|
| Single product image input | 3-4 multi-angle images via Kling elements | Much better product consistency across takes |
| Single video clip generation | Multi-shot Kling 3.0 with `multi_prompt` | Coherent multi-take videos in single API call |
| LLM-generated prompts only | Category templates + LLM enhancement | Deterministic quality floor with creative variation |
| Linear stepper wizard | Card-based take editor | Full creative control per take |
| Suno music only | SFX library + ambient + music layering | Professional audio design |
| Copy-based video (single clip) | xfade-composed multi-take videos | Cinematic feel with transitions |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Kling 3.0 `kling_elements` accepts 2-4 images per element for product consistency | Architecture Patterns | Would need per-take single-image fallback; reduces product consistency |
| A2 | `multi_shots` + `multi_prompt` produces visually coherent takes | Architecture Patterns | Would need to generate takes individually and accept less coherence |
| A3 | SFX library can be bundled as ~50-100 static MP3/WAV files (~20-50MB) | REQ-PS2-07 support | May need external SFX API; licensing must be verified |
| A4 | FFmpeg xfade supports whip_pan transition type | Pitfalls | whip_pan may not be a standard xfade name; need to verify available types |

**Note on A1/A2:** The Kie.ai docs page confirmed `kling_elements` with `element_input_urls` array (2-4 URLs) and `multi_prompt` array (up to 5 shots). [VERIFIED: WebFetch docs.kie.ai/market/kling/kling-3-0]. However, quality of multi-image element consistency has not been tested in this project.

**Note on A3:** SFX sourcing and licensing is flagged as open question RQ-002 in `.planning/research/questions.md`. [ASSUMED]

**Note on A4:** FFmpeg xfade supports: fade, fadeblack, fadewhite, dissolve, wipeleft, wiperight, wipeup, wipedown, slideleft, slideright, slideup, slidedown, and ~20 more. "whip_pan" is not a standard name -- use `wipeleft` as equivalent. [VERIFIED: FFmpeg docs]

## Open Questions

1. **SFX Library Sourcing (RQ-002)**
   - What we know: Need ~50-100 royalty-free sounds categorized by product type (ASMR, epic, ambient)
   - What's unclear: Licensing for commercial use, whether to bundle statically or use API
   - Recommendation: Start with a small bundled library (10-20 sounds per category) from Freesound.org (CC0 licensed). Expand later with API integration if needed.

2. **Kling Multi-Image Quality**
   - What we know: API supports it, docs confirm 2-4 images per element
   - What's unclear: How well it maintains product fidelity across multi-shot generation
   - Recommendation: Build the pipeline with multi-image support but include a per-take regeneration fallback for quality issues.

3. **Multi-Shot Duration Limit Strategy**
   - What we know: Kling 3.0 max is 15s per task; multi_prompt shots range 1-12s each
   - What's unclear: Best strategy when user configures >15s total across takes
   - Recommendation: Split into multiple Kling tasks (one per take) when total exceeds 15s. Compose with FFmpeg afterward. This is the safest approach and matches the existing per-scene generation pattern in the reels pipeline.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| FFmpeg | Video composition, audio mixing | Yes | 8.1 | -- |
| Python | Backend pipeline | Yes | 3.9.6 | -- |
| Node.js | Frontend | Yes | 24.12.0 | -- |
| Kie.ai API | Kling 3.0 video generation | Yes (env KIE_API_KEY) | -- | -- |
| Google Gemini API | Scene analysis, prompt generation | Yes (env GOOGLE_API_KEY) | -- | -- |
| GCS | Image hosting for Kie.ai input | Yes (existing GCSUploader) | -- | -- |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend) + vitest (frontend) |
| Config file | `pyproject.toml` [tool.pytest.ini_options] + `memelab/vitest.config.ts` |
| Quick run command | `python -m pytest tests/test_product_studio_v2.py -x` |
| Full suite command | `python -m pytest tests/ -x --timeout=60` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-PS2-01 | Multi-image upload validation (3-4 images, format, size) | unit | `pytest tests/test_product_studio_v2.py::test_01_multi_image_upload -x` | Wave 0 |
| REQ-PS2-02 | Image normalization for Kling (min 300px, max 10MB) | unit | `pytest tests/test_product_studio_v2.py::test_02_image_treatment -x` | Wave 0 |
| REQ-PS2-03 | AI scene generation returns structured storyboard | unit | `pytest tests/test_product_studio_v2.py::test_03_scene_generation -x` | Wave 0 |
| REQ-PS2-04 | Take editor config model validation | unit | `vitest run src/__tests__/take-editor.test.tsx` | Wave 0 |
| REQ-PS2-05 | Category template selection and prompt building | unit | `pytest tests/test_product_studio_v2.py::test_05_category_templates -x` | Wave 0 |
| REQ-PS2-06 | Kling payload with kling_elements + multi_prompt | unit | `pytest tests/test_product_studio_v2.py::test_06_kling_multi_image -x` | Wave 0 |
| REQ-PS2-07 | SFX library catalog loading + category filter | unit | `pytest tests/test_product_studio_v2.py::test_07_sfx_library -x` | Wave 0 |
| REQ-PS2-08 | Audio mixing with SFX + ambient layers | unit | `pytest tests/test_product_studio_v2.py::test_08_audio_mixing -x` | Wave 0 |
| REQ-PS2-09 | Video composition via concat_segments | unit | `pytest tests/test_product_studio_v2.py::test_09_video_composition -x` | Wave 0 |
| REQ-PS2-10 | Multi-format export + individual takes | unit | `pytest tests/test_product_studio_v2.py::test_10_multi_format_export -x` | Wave 0 |
| REQ-PS2-11 | Backward compat: old jobs visible, new routes work | unit | `pytest tests/test_product_studio_v2.py::test_11_backward_compat -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_product_studio_v2.py -x --timeout=30`
- **Per wave merge:** `python -m pytest tests/ -x --timeout=60`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test_product_studio_v2.py` -- covers REQ-PS2-01 through REQ-PS2-11 (xfail stubs)
- [ ] `memelab/src/__tests__/take-editor.test.tsx` -- covers REQ-PS2-04 frontend (todo stubs)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `get_current_user` dependency on all /ads routes |
| V3 Session Management | no | Handled by existing auth layer |
| V4 Access Control | yes | User can only access own jobs (existing `user_id` filter) |
| V5 Input Validation | yes | Pydantic models for request validation; image format/size validation at upload |
| V6 Cryptography | no | No new crypto requirements |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious image upload (oversized, wrong format) | Tampering | Validate format/size before processing; Pillow safe open |
| Path traversal in job_dir | Tampering | Use uuid-based job dirs (existing pattern) |
| SSRF via image_url to Kie.ai | Spoofing | Only pass GCS-uploaded URLs (existing GCSUploader pattern) |
| Cost amplification (many takes) | Denial of Service | Validate max 5 takes per job; cost estimate before generation |

## Sources

### Primary (HIGH confidence)
- Kie.ai Kling 3.0 API docs (`docs.kie.ai/market/kling/kling-3-0`) -- element system, multi-shot, payload format [VERIFIED: WebFetch]
- Existing codebase: `src/product_studio/pipeline.py`, `src/video_gen/kie_client.py`, `src/reels_pipeline/video_builder.py` [VERIFIED: codebase read]
- Production guide: `guia-producao-visual-ai-produtos.md` -- 7 category configs, prompt templates, camera vocabulary [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- Kling 3.0 feature overview (multiple search results confirming multi-image, multi-shot, 15s max, native audio) [VERIFIED: WebSearch cross-referenced with API docs]

### Tertiary (LOW confidence)
- SFX library sourcing strategy (Freesound CC0) -- needs validation of licensing terms and catalog size [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new deps needed
- Architecture: HIGH -- extending existing pipeline pattern with proven components (concat_segments, mix_audio, export_all_formats)
- Kling API integration: HIGH -- verified against official Kie.ai docs
- SFX library: LOW -- sourcing strategy is assumed, needs user decision
- Pitfalls: MEDIUM -- based on API docs constraints + project experience with FFmpeg/Kie.ai

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- Kling 3.0 API is production; existing codebase is stable)
