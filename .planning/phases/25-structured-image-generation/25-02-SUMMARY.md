---
phase: 25-structured-image-generation
plan: 02
subsystem: api
tags: [gemini-image, prompt-builder, per-cena, character-card, bible-style]

# Dependency graph
requires:
  - phase: 25-structured-image-generation/01
    provides: "xfail test stubs, conftest FakeGeminiImageClient fixture, REELS_IMAGE_ASPECT_RATIO config constant"
  - phase: 24-script-schema-v2
    provides: "CenaSchema.image_prompt, CharacterCardSchema.style_seed, RoteiroSchema.character_card"
provides:
  - "Composable _build_per_cena_prompt helper with 4-layer prompt structure"
  - "generate_reel_images_per_cena consuming image_prompt as primary prompt"
  - "character_card propagation through all 3 call sites"
  - "Configurable aspect_ratio on _generate_single_image"
  - "4 active GREEN tests for IMAGE-01 through IMAGE-04"
affects: [26-mood-driven-ken-burns]

# Tech tracking
tech-stack:
  added: []
  patterns: ["composable prompt builder with layered parts array"]

key-files:
  created: []
  modified:
    - "src/reels_pipeline/image_gen.py"
    - "src/reels_pipeline/main.py"
    - "src/api/routes/reels.py"
    - "tests/test_reels_image_gen.py"

key-decisions:
  - "Composable _build_per_cena_prompt replaces 3-branch if/elif/else -- single function handles all modes via parts array"
  - "character_card passed as explicit param (not via config_override) -- cleaner API, matches script top-level field"
  - "Legacy narracao+overlay fallback preserved for cenas without image_prompt -- migration compat"

patterns-established:
  - "Prompt layering: hook -> no-text -> style_seed -> BIBLE_STYLE_DNA -> image_prompt -> aspect_ratio -> scene counter"
  - "character_card propagation: caller extracts from script dict, passes to image gen function"

requirements-completed: [IMAGE-01, IMAGE-02, IMAGE-03, IMAGE-04]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 25 Plan 02: Structured Image Generation Summary

**Composable prompt builder consuming cena.image_prompt + character_card.style_seed + BIBLE_STYLE_DNA as layers, with configurable aspect ratio from config**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T16:32:20Z
- **Completed:** 2026-04-09T16:36:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced 3-branch if/elif/else prompt builder with composable `_build_per_cena_prompt` function
- All 3 call sites (main.py, reels.py regen) now pass `character_card` parameter
- Made `_generate_single_image` aspect ratio configurable via `REELS_IMAGE_ASPECT_RATIO`
- Flipped all 4 xfail stubs to active GREEN tests (IMAGE-01 through IMAGE-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite prompt builder and update generate_reel_images_per_cena signature** - `cbdd544` (feat)
2. **Task 2: Update call sites in main.py and reels.py + flip all 4 tests to GREEN** - `ca55cde` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `src/reels_pipeline/image_gen.py` - Added `_build_per_cena_prompt` composable helper, updated `generate_reel_images_per_cena` signature with `character_card`, made `_generate_single_image` aspect_ratio configurable
- `src/reels_pipeline/main.py` - Extract `character_card` from script and pass to `generate_reel_images_per_cena`
- `src/api/routes/reels.py` - Extract `character_card` from `script_json` in regeneration endpoint
- `tests/test_reels_image_gen.py` - Flipped 4 xfail stubs to active tests with real assertions

## Decisions Made
- Composable `_build_per_cena_prompt` replaces 3-branch if/elif/else -- single function handles all modes via parts list, easier to extend
- `character_card` passed as explicit keyword param (not via `config_override`) -- matches script top-level field, cleaner API
- Legacy narracao+overlay fallback preserved for cenas without `image_prompt` -- ensures migration compat with pre-Phase 24 roteiros

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 25 fully implemented: all 4 IMAGE requirements GREEN
- Phase 26 (Mood-Driven Ken Burns) can proceed -- it depends on Phase 22 (real per-cena durations) and Phase 24 (mood field), both of which are already shipped
- No blockers

---
*Phase: 25-structured-image-generation*
*Completed: 2026-04-09*
