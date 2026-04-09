# Phase 25: Structured Image Generation - Research

**Researched:** 2026-04-09
**Domain:** Gemini Image API prompt composition, per-cena image generation pipeline
**Confidence:** HIGH

## Summary

Phase 25 rewires `generate_reel_images_per_cena` to consume the v2 script schema fields (`cena.image_prompt`, `character_card.style_seed`) instead of the legacy `narracao + legenda_overlay` prompt construction. The changes are concentrated in a single file (`src/reels_pipeline/image_gen.py`) with four precise modifications: (1) replace `narracao`/`legenda_overlay` usage with `cena.image_prompt` as the primary prompt, (2) prepend `character_card.style_seed` when present, (3) combine `BIBLE_STYLE_DNA` with `image_prompt` instead of overriding, and (4) ensure the aspect ratio string from config is always present in the text prompt.

The existing `_generate_single_image` helper already passes `aspect_ratio="9:16"` to `ImageConfig` at the API level. The requirement (IMAGE-04) is about ensuring the **text prompt** also contains the aspect ratio string (e.g., `9:16, no text, no watermark`), which the v2 `image_prompt` format already includes by convention. The implementation must make this explicit and derive it from job config rather than hardcoding.

**Primary recommendation:** Modify `generate_reel_images_per_cena` to read `cena["image_prompt"]` as primary prompt, prepend `style_seed` and `BIBLE_STYLE_DNA` as combinable layers, and inject aspect ratio from `REELS_IMAGE_ASPECT_RATIO` config constant. All changes in `image_gen.py` only.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMAGE-01 | `generate_reel_images_per_cena` uses `cena.image_prompt` as primary prompt (not `narracao + legenda_overlay`) | Lines 241-299 of `image_gen.py` currently build prompt from `narracao` and `legenda_overlay`. Must be replaced with `cena.get("image_prompt", "")`. Fallback to legacy approach when `image_prompt` is empty (migration compat). |
| IMAGE-02 | When `character_card` present, `style_seed` prepended to every per-cena prompt | `character_card` is a top-level field on the roteiro (see `script_gen.py:813-821`). The function receives `cenas` list but NOT the full script. The caller (`run_step_images_per_cena` in `main.py:269`) passes `config_override` which has access to the script. Must either pass `character_card` through config or add a parameter. |
| IMAGE-03 | `BIBLE_STYLE_DNA` combined with per-cena `image_prompt` (not override) | Currently (lines 261-271), bible mode builds the entire prompt from `BIBLE_STYLE_DNA` + `narracao` + `overlay`. Must change to: `BIBLE_STYLE_DNA` as style layer + `cena.image_prompt` as primary content. |
| IMAGE-04 | Aspect ratio always explicit in final prompt | `REELS_IMAGE_ASPECT_RATIO` constant is `"9:16"` in `config.py`. Currently hardcoded in `ImageConfig(aspect_ratio="9:16")`. Must also inject into text prompt for Gemini compliance. The v2 `image_prompt` already includes `9:16` by convention from script_gen prompts, but this must be enforced programmatically. |
</phase_requirements>

## Architecture Patterns

### Current Code Flow (pre-Phase 25)

```
reels.py route (images step)
  -> pipeline.run_step_images_per_cena(script, character_id, ...)
    -> image_gen.generate_reel_images_per_cena(cenas, character_id, ...)
      -> for each cena:
           prompt = build from narracao + legenda_overlay + character_dna/BIBLE_STYLE_DNA
           -> _generate_single_image(client, prompt, ref_images)
              -> client.models.generate_content(model, contents, config=ImageConfig(aspect_ratio="9:16"))
```

### Target Code Flow (Phase 25)

```
reels.py route (images step)
  -> pipeline.run_step_images_per_cena(script, character_id, ...)
    -> image_gen.generate_reel_images_per_cena(cenas, character_id, ..., character_card=..., aspect_ratio=...)
      -> for each cena:
           base_prompt = cena["image_prompt"]       # IMAGE-01
           if character_card: prepend style_seed     # IMAGE-02
           if bible_mode: combine BIBLE_STYLE_DNA    # IMAGE-03
           ensure aspect_ratio in prompt             # IMAGE-04
           -> _generate_single_image(client, final_prompt, ref_images, aspect_ratio=...)
```

### Pattern: Prompt Layering

The final prompt should be assembled in layers (top to bottom):

```
1. [HOOK_PREFIX]           -- first-frame hook instruction (scene 0 only)
2. [NO_TEXT_RULE]           -- always present
3. [STYLE_SEED]             -- from character_card.style_seed (when present)
4. [BIBLE_STYLE_DNA]        -- bible mode only, as a STYLE block
5. [IMAGE_PROMPT]           -- cena.image_prompt (primary content)
6. [ASPECT_RATIO_ENFORCE]   -- "Aspect ratio: {ar}" suffix
7. [SCENE_COUNTER]          -- "Scene {i+1} of {n}"
```

This replaces the current three-branch if/elif/else with a composable builder.

### Key Design Decision: How to Pass character_card

**Problem:** `generate_reel_images_per_cena` receives `cenas: list[dict]` but NOT the full script dict. The `character_card` lives at the script top level, not per-cena.

**Solution:** The caller `run_step_images_per_cena` in `main.py` already has access to `script`. Extract `script.get("character_card")` and pass it as a new parameter to `generate_reel_images_per_cena`.

```python
# main.py - run_step_images_per_cena
character_card = script.get("character_card")
generated_paths = await generate_reel_images_per_cena(
    cenas=cenas_to_generate,
    character_id=character_id,
    output_dir=images_dir,
    config_override=self.config,
    character_card=character_card,  # NEW
)
```

The same pattern applies to the regeneration endpoint in `reels.py:1456` which also calls `generate_reel_images_per_cena` directly.

### Key Design Decision: Aspect Ratio Source

The aspect ratio for image generation currently comes from two places:
1. `REELS_IMAGE_ASPECT_RATIO = "9:16"` in `config.py` (text constant)
2. `ImageConfig(aspect_ratio="9:16")` hardcoded in `_generate_single_image`

For IMAGE-04, the text prompt must include the aspect ratio. The source of truth should be `REELS_IMAGE_ASPECT_RATIO` from config, not a hardcoded string. This also makes `_generate_single_image` configurable for future aspect ratio changes.

### Anti-Patterns to Avoid

- **Overriding vs combining:** The current bible branch replaces the entire prompt structure with `BIBLE_STYLE_DNA`-first construction. The fix must COMBINE style DNA with `image_prompt`, not use one to override the other.
- **Duplicating aspect ratio in text AND API config:** Both are needed. The text prompt `image_prompt` already contains `9:16` by convention from Phase 24's script generation. But the enforcement must be programmatic (append if not present) rather than trusting the LLM always included it.
- **Losing character context:** Currently, character mode loads `char_ctx` from DB via `_load_character_context`. With the new v2 schema, `character_card.style_seed` replaces most of this for prompt construction. However, `ref_images` (uploaded reference images from DB) must still be loaded for visual consistency. The character card is for the text prompt; the DB refs are for multimodal input.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Aspect ratio validation | Custom regex parser | Simple `if ar_string not in prompt: prompt += f", {ar_string}"` | Only 8 valid values (see SDK: "1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9") |
| Character card propagation | New DB query in image_gen | Pass from caller (already has script dict) | Avoids duplicate DB calls, script already has the data |

## Common Pitfalls

### Pitfall 1: Breaking the Regeneration Path
**What goes wrong:** The single-scene regeneration endpoint (`reels.py:1420-1509`) calls `generate_reel_images_per_cena` directly with a single-element cenas list. If the new `character_card` parameter is required but not passed there, regeneration silently loses style consistency.
**Why it happens:** There are 3 call sites for `generate_reel_images_per_cena`: (1) `main.py:269`, (2) `reels.py:194` via pipeline method, (3) `reels.py:1456` direct import. All three must be updated.
**How to avoid:** Grep for all call sites of `generate_reel_images_per_cena` and update each one. The `character_card` parameter should be Optional with default None for backwards compatibility.
**Warning signs:** Image regeneration produces images without character style.

### Pitfall 2: Legacy Roteiro Fallback
**What goes wrong:** Legacy roteiros (pre-Phase 24) have `image_prompt` backfilled from `legenda_overlay` by `migrate_legacy_roteiro`. These backfilled values are short overlay texts, not proper 4-layer image prompts. Using them as-is produces worse images than the old `narracao + legenda_overlay` approach.
**Why it happens:** The migration sets `image_prompt = legenda_overlay` which is a subtitle, not an image description.
**How to avoid:** When `image_prompt` is empty or matches `legenda_overlay` exactly (indicating migration default), fall back to a constructed prompt using `narracao + legenda_overlay` as before. Or accept the degradation since these are legacy jobs that will eventually be regenerated.
**Warning signs:** Legacy jobs produce low-quality images after the change.

### Pitfall 3: Bible Mode Losing BIBLE_STYLE_DNA
**What goes wrong:** If bible mode simply uses `cena.image_prompt` without the style DNA, biblical images lose their distinctive "Bible Project" visual style.
**Why it happens:** The v2 `image_prompt` from bible script generation includes aspect ratio and scene description but NOT the full `BIBLE_STYLE_DNA` style guide (content safety rules, warm earth tones, etc.).
**How to avoid:** In bible mode, the final prompt must be: `BIBLE_STYLE_DNA + image_prompt + aspect_ratio`. The style DNA is a global prefix, not replaced by image_prompt.
**Warning signs:** Biblical images become photorealistic or contain nudity (content safety section lost).

### Pitfall 4: Double Style Instruction
**What goes wrong:** The v2 `image_prompt` from script_gen already includes a style component (e.g., "soft cel-shading cartoon style"). Prepending `style_seed` (which also contains style info from character DNA) could create contradictory style instructions.
**Why it happens:** Both `style_seed` and `image_prompt` carry style information.
**How to avoid:** Structure the prompt to make `style_seed` a CHARACTER identity block and `image_prompt` a SCENE description block. The LLM handles compositing. This is already how the script_gen prompt instructs the LLM — `image_prompt` describes the scene, `style_seed` describes the character's visual identity.
**Warning signs:** Generated images have inconsistent style across scenes.

## Code Examples

### Current prompt construction in generate_reel_images_per_cena (lines 261-299)

```python
# Current: three-branch prompt builder using narracao + legenda_overlay
if is_bible_mode:
    prompt = (
        f"{hook_prefix}{no_text_rule}"
        f"SCENE CONTEXT (for visual reference only):\n{narracao}\n\n"
        f"VISUAL DIRECTION:\n{overlay}\n\n"
        f"STYLE:\n{BIBLE_STYLE_DNA}\n\n"
        f"Scene {i+1} of {n}. Cinematic lighting, reverent composition."
    )
elif char_ctx and char_ctx.get("character_dna"):
    prompt = (
        f"{hook_prefix}{no_text_rule}"
        f"SCENE CONTEXT:\n{narracao}\n\n"
        f"VISUAL DIRECTION:\n{overlay}\n\n"
        f"CHARACTER STYLE:\n{char_ctx['character_dna']}\n\n"
        f"FORMAT: Instagram Reels vertical 9:16. Scene {i+1} of {n}.\n"
        # ...
    )
else:
    prompt = (
        f"{hook_prefix}{no_text_rule}"
        f"SCENE CONTEXT:\n{narracao}\n\n"
        # ...
    )
```

### Target prompt construction (Phase 25)

```python
# Phase 25: composable prompt builder using image_prompt + style_seed + BIBLE_STYLE_DNA
def _build_per_cena_prompt(
    cena: dict,
    i: int,
    n: int,
    is_bible_mode: bool,
    character_card: dict | None,
    char_ctx: dict | None,
    aspect_ratio: str,
) -> str:
    parts = []

    # Hook prefix for first frame
    if i == 0:
        parts.append(
            "FIRST FRAME — HOOK IMAGE (must grab attention instantly):\n"
            "This is the opening frame. High contrast, bold placement, dramatic composition.\n"
        )

    # No-text rule (always)
    parts.append(
        "CRITICAL: Do NOT render ANY text, words, letters, captions, subtitles, "
        "watermarks in the image. PURELY VISUAL.\n"
    )

    # Style seed from character_card (IMAGE-02)
    if character_card and character_card.get("style_seed"):
        parts.append(f"CHARACTER STYLE:\n{character_card['style_seed']}\n")

    # Bible style DNA (IMAGE-03) — combined, not override
    if is_bible_mode:
        parts.append(f"STYLE:\n{BIBLE_STYLE_DNA}\n")

    # Character DNA from DB context (ref images loaded separately)
    if not is_bible_mode and char_ctx and char_ctx.get("character_dna") and not character_card:
        # Fallback: legacy character context when no character_card in script
        parts.append(f"CHARACTER STYLE:\n{char_ctx['character_dna']}\n")
        if char_ctx.get("composition"):
            parts.append(f"COMPOSITION: {char_ctx['composition']}\n")
        if char_ctx.get("negative_traits"):
            parts.append(f"AVOID: {char_ctx['negative_traits']}\n")

    # Primary prompt (IMAGE-01)
    image_prompt = cena.get("image_prompt", "")
    if image_prompt:
        parts.append(f"IMAGE PROMPT:\n{image_prompt}\n")
    else:
        # Fallback for legacy cenas without proper image_prompt
        narracao = cena.get("narracao", "")
        overlay = cena.get("legenda_overlay", "")
        parts.append(f"SCENE CONTEXT:\n{narracao}\n\nVISUAL DIRECTION:\n{overlay}\n")

    # Aspect ratio enforcement (IMAGE-04)
    if aspect_ratio and aspect_ratio not in (image_prompt or ""):
        parts.append(f"Aspect ratio: {aspect_ratio}\n")

    # Scene counter
    parts.append(f"Scene {i+1} of {n}. Cinematic lighting, professional quality.")

    return "\n".join(parts)
```

### Caller update in main.py

```python
# main.py:run_step_images_per_cena - pass character_card from script
character_card = script.get("character_card")
generated_paths = await generate_reel_images_per_cena(
    cenas=cenas_to_generate,
    character_id=character_id,
    output_dir=images_dir,
    config_override=self.config,
    character_card=character_card,
)
```

### Caller update in reels.py (regeneration)

```python
# reels.py:1456 - pass character_card from script for regen
character_card = script_json.get("character_card")
new_paths = await generate_reel_images_per_cena(
    cenas=[single_cena],
    character_id=job.character_id,
    output_dir=images_dir,
    config_override=regen_config or None,
    character_card=character_card,
)
```

### _generate_single_image update for configurable aspect ratio

```python
# image_gen.py - accept aspect_ratio parameter
async def _generate_single_image(
    client, prompt: str,
    ref_images: list[PIL.Image.Image] | None = None,
    aspect_ratio: str = "9:16",
) -> PIL.Image.Image | None:
    # ... (existing code) ...
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,  # was hardcoded "9:16"
        ),
    ),
```

## Gemini ImageConfig Aspect Ratio Values

Verified via SDK introspection (google-genai installed locally):

| Value | Dimensions | Use Case |
|-------|-----------|----------|
| `"1:1"` | Square | Instagram posts |
| `"2:3"` | Portrait | -- |
| `"3:2"` | Landscape | -- |
| `"3:4"` | Portrait | -- |
| `"4:3"` | Landscape | -- |
| `"9:16"` | Vertical | **Reels/Shorts/TikTok (current default)** |
| `"16:9"` | Horizontal | YouTube landscape |
| `"21:9"` | Ultra-wide | Cinematic |

The `REELS_IMAGE_ASPECT_RATIO` config constant is `"9:16"`. The `ImageConfig.aspect_ratio` field accepts these 8 string values. Both the API-level config AND the text prompt should carry the same value.

## Call Sites Inventory

All places that call `generate_reel_images_per_cena` (must ALL be updated):

| File | Line | Context | Needs character_card |
|------|------|---------|---------------------|
| `src/reels_pipeline/main.py` | 269 | `run_step_images_per_cena` method | Yes — extract from `script.get("character_card")` |
| `src/api/routes/reels.py` | 1456 | `_regenerate_scene_image_bg` background task | Yes — extract from `script_json.get("character_card")` |

Note: `reels.py:194` calls `pipeline.run_step_images_per_cena` (the wrapper method), not `generate_reel_images_per_cena` directly. The wrapper handles the pass-through.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 + pytest-asyncio |
| Config file | `tests/conftest.py` (shared fixtures) |
| Quick run command | `python -m pytest tests/test_reels_image_gen.py -x -q` |
| Full suite command | `python -m pytest tests/ -x -q` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMAGE-01 | `image_prompt` used as primary prompt (not narracao/overlay) | unit | `pytest tests/test_reels_image_gen.py::test_01_image_prompt_primary -x` | Wave 0 |
| IMAGE-02 | `style_seed` prepended when character_card present | unit | `pytest tests/test_reels_image_gen.py::test_02_style_seed_prepended -x` | Wave 0 |
| IMAGE-03 | `BIBLE_STYLE_DNA` combined with image_prompt | unit | `pytest tests/test_reels_image_gen.py::test_03_bible_style_combined -x` | Wave 0 |
| IMAGE-04 | Aspect ratio always in final prompt | unit | `pytest tests/test_reels_image_gen.py::test_04_aspect_ratio_explicit -x` | Wave 0 |

### Testing Strategy

The `FakeGeminiClient` in `conftest.py` captures all `.calls` including the prompt text sent to `generate_content`. Tests can:
1. Call `generate_reel_images_per_cena` with crafted cena dicts
2. Inspect `fake_client.calls[i]["contents"][-1]` (last content part is the prompt string)
3. Assert substrings present/absent in the prompt

The existing `FakeGeminiClient` returns a fake image response (FakeGeminiResponse with PCM data). For image gen tests, we need a similar fake that returns an image response. The `_generate_single_image` function expects `response.candidates[0].content.parts[0].inline_data` with `mime_type.startswith("image/")` and `.data` as bytes. A new fixture or extension of the existing FakeGeminiClient is needed.

### Sampling Rate
- **Per task commit:** `python -m pytest tests/test_reels_image_gen.py -x -q`
- **Per wave merge:** `python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_reels_image_gen.py` -- covers IMAGE-01 through IMAGE-04 (4 tests as xfail stubs)
- [ ] `conftest.py` -- extend FakeGeminiClient or add `fake_gemini_image_client` fixture that returns image data instead of TTS PCM data
- [ ] Monkeypatch target: `src.llm_client._get_client` AND `src.reels_pipeline.image_gen._get_client` (same from-import binding pattern as TTS)

## Files Modified by This Phase

| File | Changes | Complexity |
|------|---------|-----------|
| `src/reels_pipeline/image_gen.py` | Rewrite `generate_reel_images_per_cena` prompt builder; add `character_card` and `aspect_ratio` params; update `_generate_single_image` signature | Primary |
| `src/reels_pipeline/main.py` | Pass `character_card` from script to `generate_reel_images_per_cena` | Trivial |
| `src/api/routes/reels.py` | Pass `character_card` in `_regenerate_scene_image_bg` | Trivial |
| `tests/test_reels_image_gen.py` | New test file with 4 tests (IMAGE-01..04) | New file |
| `tests/conftest.py` | Add `fake_gemini_image_client` fixture | Small addition |

## Sources

### Primary (HIGH confidence)
- `src/reels_pipeline/image_gen.py` -- direct code inspection, current prompt construction
- `src/reels_pipeline/models.py` -- CenaSchema, CharacterCardSchema, RoteiroSchema Pydantic models
- `src/reels_pipeline/script_gen.py` -- ROTEIRO_SCHEMA, character_card injection at line 813-821
- `src/reels_pipeline/config.py` -- REELS_IMAGE_ASPECT_RATIO constant
- `src/reels_pipeline/script_migration.py` -- legacy roteiro migration logic
- `src/api/routes/reels.py` -- route handler calling image generation
- `google.genai.types.ImageConfig` -- SDK introspection confirming aspect_ratio field and valid values

### Secondary (MEDIUM confidence)
- `src/reels_pipeline/main.py` -- run_step_images_per_cena wrapper with asset reuse logic

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all changes within existing google-genai SDK usage
- Architecture: HIGH -- direct code inspection of all 3 call sites and the function under modification
- Pitfalls: HIGH -- identified from concrete code paths (regeneration endpoint, legacy migration, bible mode)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable internal codebase, no external API changes expected)
