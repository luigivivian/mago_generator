---
phase: 1003-pro-video-prompt-engineering
reviewed: 2026-04-11T12:48:00-03:00
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/product_studio/config.py
  - src/product_studio/models.py
  - src/product_studio/prompt_builder.py
  - src/product_studio/scene_composer.py
  - tests/test_prompt_engineering.py
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 1003: Code Review Report

**Reviewed:** 2026-04-11T12:48:00-03:00
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 1003 introduces pro-level video prompt engineering: enriched `CATEGORY_CONFIGS`, pre-written `SHOT_PLANS`, per-shot `STABILITY_SUFFIXES`, a layered negative-prompt system, and a `FEW_SHOT_EXAMPLES` store. The prompt builder and scene composer were updated to consume these configs deterministically.

The code is well-structured and the prompt quality work is solid. There are no critical security or data-loss issues. Four warnings cover correctness gaps that could produce silent wrong behaviour at runtime: an unawaited client in the Gemini fallback path, inconsistent prompt length enforcement after `build_free_prompt` embeds negatives, a mismatch between the camera-move enum in `TakeConfig` and the set accepted by the Gemini fallback JSON schema, and the `food_burger` hero-action that mentions hands — contradicting the "no humans" rule applied everywhere else. Three info items flag dead code, a deprecated constant left in the hot path, and a missing assertion in the test suite.

## Warnings

### WR-01: Gemini fallback uses unawaited bare `genai.Client()` instead of injected client

**File:** `src/product_studio/scene_composer.py:247`
**Issue:** The fast-path branch calls `_get_client()` (the project-standard injected client). The Gemini fallback branch instantiates `genai.Client()` directly with no arguments, bypassing `_get_client()` entirely. This means the fallback ignores any API-key injection, mock/test overrides, or retry logic wired into `_get_client()`. In a test environment it will silently use a different (probably unconfigured) client.
**Fix:**
```python
# Replace line 247 in the Gemini fallback branch:
# client = genai.Client()   <-- remove this
client = _get_client()      # already imported at top of file

# Then change the response call from client.aio.models.generate_content to:
response = await asyncio.to_thread(
    client.models.generate_content,
    model="gemini-2.5-flash",
    contents=[instruction, *image_parts],
    config=types.GenerateContentConfig(...),
)
```
Or, if async is preferred, ensure `_get_client()` returns the async-capable client. Either way, unify on one client factory.

---

### WR-02: `build_free_prompt` embeds negative but `TakeConfig.prompt` max_length=2000 is checked before negative is appended by callers

**File:** `src/product_studio/prompt_builder.py:152-155`, `src/product_studio/models.py:81`
**Issue:** `build_free_prompt` enforces 2000 chars on the *positive* prompt only, then returns a separate `negative` string. But `generate_storyboard` (scene_composer.py lines 214, 343) embeds negatives directly into the `prompt` field as `f"{prompt} Negative: {neg}"` and re-enforces 2000 chars. `build_free_prompt` is not called from `generate_storyboard`, so the negative embedding is absent for free-prompt takes — but if a caller *does* embed the negative from `build_free_prompt` into `TakeConfig.prompt`, the combined string will exceed 2000 chars before being caught. The Pydantic `max_length=2000` on `TakeConfig.prompt` will then raise a `ValidationError` at construction time. The 2000-char cap in `build_free_prompt` should account for the negative suffix length.
**Fix:**
```python
def build_free_prompt(user_prompt, shot_type="", element_name="prod"):
    stability = STABILITY_SUFFIXES.get(shot_type, STABILITY_SUFFIX_DEFAULT)
    negative = f"{NEGATIVE_PROMPTS_BASE}, {PRODUCT_PRESERVE_NEGATIVE}"
    # Reserve space for " Negative: {negative}" when embedded
    max_positive = 2000 - len(f" Negative: {negative}") - 1
    positive = f"{user_prompt.strip()}. {stability}"
    if len(positive) > max_positive:
        positive = positive[:max_positive - 3] + "..."
    return positive, negative
```

---

### WR-03: `food_burger` hero-action contains "hands" — violates the no-humans/body-parts rule

**File:** `src/product_studio/config.py:144-145`
**Issue:** `food_burger.hero_actions[0]` is `"hands pressing down on bun with juices flowing"`. Every other layer of the system (compose_scene prompts, build_video_prompt system instruction, NEGATIVE_PROMPTS, PRODUCT_PRESERVE_NEGATIVE) explicitly forbids hands and body parts. When `resolve_template_vars` injects this hero-action at `shot_index=0`, the resulting storyboard prompt will include "hands" in the positive while the negative simultaneously bans them — contradictory instructions sent to the video model, likely causing generation failures or unexpected human elements.
**Fix:**
```python
"hero_actions": [
    "cheese melting and dripping in slow-motion with juices pooling",  # was: "hands pressing..."
    "cheese melting and dripping in slow-motion",
    "burger cut in half revealing all layers",
],
```

---

### WR-04: Camera-move enum mismatch between `TakeConfig` and Gemini fallback JSON schema

**File:** `src/product_studio/scene_composer.py:282-288`, `src/product_studio/models.py:82-86`
**Issue:** `TakeConfig.camera_move` accepts 12 values including `"dolly"`, `"macro_zoom"`, `"static"`, `"dolly_in"`, `"tilt_up"`, `"pull_back"`, `"product_rotate"`. The Gemini fallback schema (line 284-288) only allows 8: `["dolly", "orbit", "macro_zoom", "static", "crane", "static_macro", "dolly_out", "push_in"]` — missing `"dolly_in"`, `"tilt_up"`, `"pull_back"`, `"product_rotate"`. This is not immediately broken, but if the `STABILITY_SUFFIXES` dict (which *does* cover those 4 extra types) is ever extended and Gemini returns a value allowed by `TakeConfig` but not in the schema, or vice versa, silent downgrade occurs. More immediately: the schema allows `"dolly"` but `STABILITY_SUFFIXES` has no `"dolly"` key — it falls through to `STABILITY_SUFFIX_DEFAULT`. This means `dolly` takes lose their specific stability instruction.
**Fix:** Align the schema enum with `TakeConfig.camera_move` literals, and ensure `STABILITY_SUFFIXES` has an entry for every camera move that can appear in a prompt:
```python
# In scene_composer.py schema, expand enum to match TakeConfig:
"enum": ["dolly", "orbit", "macro_zoom", "static", "crane",
         "static_macro", "dolly_out", "dolly_in", "push_in",
         "tilt_up", "pull_back", "product_rotate"],

# In config.py, add missing STABILITY_SUFFIXES entry:
"dolly": "Smooth controlled dolly movement, no jitter, no drift, no deformation. Stable tracking, smooth motion.",
"static": "Locked camera, perfectly stable, no jitter, no drift, no deformation. Stable picture.",
"macro_zoom": "Smooth controlled zoom, no jitter, no drift, no deformation. Stable picture.",
```

## Info

### IN-01: `VIDEO_QUALITY_SUFFIX` is marked deprecated but still exported and potentially imported by consumers

**File:** `src/product_studio/config.py:456-461`
**Issue:** The constant is annotated `# DEPRECATED` with a comment pointing to Plans 02/03 for migration. If those plans have shipped (phase 1003 is now merged), the constant should be removed. Leaving deprecated exports in place invites future callers to use it.
**Fix:** Verify no remaining consumer imports `VIDEO_QUALITY_SUFFIX` (`grep -r "VIDEO_QUALITY_SUFFIX" src/`), then delete lines 456-461 from config.py.

---

### IN-02: `analyze_product` uses `response.text` without checking for None or empty candidates

**File:** `src/product_studio/scene_composer.py:118`
**Issue:** `response.text.strip()` will raise `AttributeError` if Gemini returns an empty response or a safety-blocked result (where `response.text` is `None`). The same pattern in `compose_scene` iterates `response.candidates[0].content.parts` without checking whether `candidates` is non-empty. Both are external API calls and can legitimately return empty results.
**Fix:**
```python
# For analyze_product (line 118):
text = response.text
if not text:
    raise RuntimeError("Gemini returned empty response for product analysis")
text = text.strip()

# For compose_scene (line 73):
candidates = response.candidates
if not candidates or not candidates[0].content.parts:
    raise RuntimeError("Gemini returned no candidates for scene composition")
for part in candidates[0].content.parts:
    ...
```

---

### IN-03: Test suite does not assert `build_negative_prompt` output contains `NEGATIVE_PROMPTS_BASE`

**File:** `tests/test_prompt_engineering.py:182-203`
**Issue:** `TestNegativePrompts` verifies shot-type negatives and `PRODUCT_PRESERVE` are present, and checks concatenation order of shot-type vs category. It does not verify that `NEGATIVE_PROMPTS_BASE` (`"blurry, low quality, distorted..."`) is always included. If someone accidentally removed step 3 in `build_negative_prompt`, the tests would still pass.
**Fix:**
```python
def test_base_negative_always_present(self):
    for shot_type in ["", "static_macro", "dolly_out"]:
        neg = build_negative_prompt("food_cookies", shot_type)
        assert "blurry" in neg.lower(), \
            f"NEGATIVE_PROMPTS_BASE missing for shot_type='{shot_type}'"
```

---

_Reviewed: 2026-04-11T12:48:00-03:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
