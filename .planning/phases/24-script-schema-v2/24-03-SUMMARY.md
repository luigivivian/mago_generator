---
phase: 24-script-schema-v2
plan: 03
subsystem: api
tags: [gemini, prompts, schema, image-prompt, mood, transitions, character-card]

requires:
  - phase: 24-script-schema-v2
    provides: ROTEIRO_SCHEMA with v2 fields (plan 24-02)
provides:
  - All 7 system prompt templates updated with v2 field instructions (image_prompt, mood, transition_in/out)
  - legenda_overlay semantic split: subtitle text (user language) vs image_prompt (English, 4-layer)
  - character_card injection in generate_script() from character_context
  - 7 active GREEN tests, 3 remaining xfail stubs for Wave 3
affects: [24-04-PLAN, 25-structured-image-generation, 26-mood-driven-ken-burns]

tech-stack:
  added: []
  patterns: [v2-prompt-instructions-per-language, character-card-injection-from-context, legenda-overlay-semantic-split]

key-files:
  created: []
  modified: [src/reels_pipeline/script_gen.py, tests/test_reels_script_schema.py]

key-decisions:
  - "V2 field blocks inserted before final 'Create a script' section in each template -- consistent placement across all 7"
  - "legenda_overlay old instruction removed from all templates; new instruction emphasizes short subtitle text only"
  - "character_card populated from character_context.character_dna + composition, style_seed truncated to 200 chars"

patterns-established:
  - "v2 prompt instructions are language-appropriate (pt-BR/en-US/es-ES) with identical field structure"
  - "character_card injection happens post-LLM response (overrides any LLM-generated card with authoritative DB data)"

requirements-completed: [SCRIPT-05]

duration: 3min
completed: 2026-04-09
---

# Phase 24 Plan 03: Script Schema v2 Prompt Layer Summary

**Updated all 7 system prompt templates with v2 field instructions (image_prompt, mood, transitions) and injected character_card from character_context in generate_script()**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T14:59:25Z
- **Completed:** 2026-04-09T15:03:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Updated 3 regular prompt templates (pt-BR, en-US, es-ES) with v2 field instruction blocks
- Updated 3 bible prompt templates (pt-BR, en-US, es-ES) with v2 field instruction blocks
- Updated 1 fallback prompt template with v2 field instruction blocks
- Replaced old legenda_overlay-as-image-prompt instruction in all templates with new semantic (subtitle text only)
- Added character_card injection in generate_script() from character_context.character_dna + composition
- Updated text-only user_prompt to reference v2 field semantics
- Flipped test_05 (SCRIPT-05) and test_10 from xfail to active GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Update all 7 prompt templates with v2 field instructions** - `ab131be` (feat)
2. **Task 2: Flip test_05 and test_10 from xfail to active GREEN** - `ab94cbf` (test)

## Files Created/Modified
- `src/reels_pipeline/script_gen.py` - 7 prompt templates updated + character_card injection + user_prompt v2 semantics
- `tests/test_reels_script_schema.py` - test_05 and test_10 flipped from xfail to active

## Decisions Made
- V2 field blocks placed consistently before the final "Create a script" / "Crie um roteiro" section in all templates
- character_card style_seed built from character_dna[:200] + composition -- truncation prevents excessively long seeds
- Bible prompt legenda_overlay instructions also updated to reflect new subtitle-only semantics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 3 (24-04) can wire migration at load points and flip tests 06-08
- All 7 prompts now instruct LLM to generate v2 fields with meaningful content
- character_card injection is active when character_context has character_dna

## Self-Check: PASSED

- [x] src/reels_pipeline/script_gen.py exists
- [x] tests/test_reels_script_schema.py exists
- [x] Commit ab131be exists in git log
- [x] Commit ab94cbf exists in git log

---
*Phase: 24-script-schema-v2*
*Completed: 2026-04-09*
