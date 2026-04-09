---
phase: 24-script-schema-v2
plan: 02
subsystem: api
tags: [gemini, pydantic, schema, migration, roteiro, enum]

requires:
  - phase: 24-script-schema-v2
    provides: xfail test stubs (plan 24-01)
provides:
  - Extended ROTEIRO_SCHEMA with character_card, image_prompt, mood, transition_in/out
  - Extended CenaSchema and RoteiroSchema Pydantic models with Optional v2 fields
  - migrate_legacy_roteiro() pure function for backfilling legacy roteiros
  - 5 active GREEN tests validating schema contract
affects: [24-03-PLAN, 24-04-PLAN, 25-structured-image-generation, 26-mood-driven-ken-burns]

tech-stack:
  added: []
  patterns: [optional-v2-fields-with-defaults, enum-enforced-schema, idempotent-migration]

key-files:
  created: [src/reels_pipeline/script_migration.py]
  modified: [src/reels_pipeline/script_gen.py, src/reels_pipeline/models.py, tests/test_reels_script_schema.py]

key-decisions:
  - "character_card is Optional at both schema and Pydantic level -- no-character jobs (generic, bible) remain valid"
  - "New cena fields (image_prompt, mood, transitions) required in Gemini schema but Optional with defaults in Pydantic -- existing code constructing CenaSchema continues working"
  - "migrate_legacy_roteiro uses legenda_overlay as-is for image_prompt default -- no translation call in migration (pure function)"

patterns-established:
  - "v2 schema fields are required in Gemini response_schema (LLM must produce them) but Optional in Pydantic (existing code compat)"
  - "Migration function is pure, idempotent, and mutates in-place for efficiency"

requirements-completed: [SCRIPT-01, SCRIPT-02, SCRIPT-03, SCRIPT-04, SCRIPT-06]

duration: 3min
completed: 2026-04-09
---

# Phase 24 Plan 02: Script Schema v2 Data Layer Summary

**Extended ROTEIRO_SCHEMA with character_card, image_prompt, mood enum (7 values), and transition_in/out enum (4 values) per cena, plus idempotent migration function for legacy roteiros**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T14:53:29Z
- **Completed:** 2026-04-09T14:56:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended ROTEIRO_SCHEMA dict with 5 new fields (character_card top-level, image_prompt/mood/transition_in/transition_out per cena)
- Extended CenaSchema with Optional v2 fields (defaults: mood=calm, transitions=fade, image_prompt=None)
- Created CharacterCardSchema Pydantic model and added Optional character_card to RoteiroSchema
- Created migrate_legacy_roteiro() pure function that backfills v2 defaults from legenda_overlay
- Flipped 5 tests from xfail to active GREEN (01-04, 09)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ROTEIRO_SCHEMA + Pydantic models with v2 fields** - `7890db4` (feat)
2. **Task 2: Create migrate_legacy_roteiro() + flip 5 xfail tests to active** - `5b0aa9d` (test)

## Files Created/Modified
- `src/reels_pipeline/script_gen.py` - ROTEIRO_SCHEMA extended with character_card, image_prompt, mood, transition_in/out
- `src/reels_pipeline/models.py` - CenaSchema + CharacterCardSchema + RoteiroSchema extended with v2 Optional fields
- `src/reels_pipeline/script_migration.py` - NEW: migrate_legacy_roteiro() pure function
- `tests/test_reels_script_schema.py` - 5 tests flipped from xfail to active GREEN

## Decisions Made
- character_card placed after caption_instagram in schema (not in required list) -- Gemini omits it for no-character jobs
- mood enum ordered by narrative frequency: mysterious, dramatic, hopeful, tense, calm, sad, epic
- Migration function copies legenda_overlay to image_prompt as-is (no translation) -- legacy jobs get PT-BR image prompts, acceptable tradeoff vs adding LLM call to migration
- test_06 (legacy migration) kept as xfail per plan -- Wave 3 owns that test activation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing failure in tests/test_atomic_counter.py (rate limiting check_limit) -- unrelated to Phase 24, logged to deferred-items.md

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 2 (24-03) can update system prompt templates with v2 field instructions and flip tests 05, 10
- Wave 3 (24-04) can wire migration at load points and flip tests 06-08
- Schema contract is stable -- downstream phases (25, 26) can reference ROTEIRO_SCHEMA shape

## Self-Check: PASSED

- [x] src/reels_pipeline/script_gen.py exists
- [x] src/reels_pipeline/models.py exists
- [x] src/reels_pipeline/script_migration.py exists
- [x] tests/test_reels_script_schema.py exists
- [x] Commit 7890db4 exists in git log
- [x] Commit 5b0aa9d exists in git log

---
*Phase: 24-script-schema-v2*
*Completed: 2026-04-09*
