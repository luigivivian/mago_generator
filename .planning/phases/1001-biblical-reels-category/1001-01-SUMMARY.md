---
phase: 1001-biblical-reels-category
plan: 01
subsystem: database
tags: [sqlalchemy, pydantic, migration, bible, reels]

requires:
  - phase: 999.4-instagram-reels-pipeline
    provides: ReelsJob model and reels_pipeline models
provides:
  - bible_config JSON column on ReelsJob for storing biblical reel configuration
  - ReelsSeries table for series continuity support
  - series_id FK and part_number on ReelsJob for series membership
  - BIBLE_STORIES dict with 25 pre-defined stories (14 OT + 11 NT)
  - parse_manual_script function for manual script mode
  - Extended ReelCreateInteractiveRequest with bible_config, series_id, part_number
affects: [1001-02, 1001-03, 1001-04, 1001-05]

tech-stack:
  added: []
  patterns: [bible_config JSON column for flexible biblical config storage, ReelsSeries entity for multi-part series]

key-files:
  created:
    - src/database/migrations/versions/029_add_bible_config_and_series.py
    - src/reels_pipeline/bible_stories.py
  modified:
    - src/database/models.py
    - src/reels_pipeline/models.py

key-decisions:
  - "Migration 029 chains from 028 (credit system + character_id); bible_config as JSON for flexible schema"
  - "25 stories (14 OT + 11 NT) with multi-language titles (pt/en/es) covering evangelical canon"
  - "parse_manual_script splits on double newline or --- markers, distributes duration evenly"

patterns-established:
  - "bible_config JSON column: flexible schema for script_mode, story_ref, include_reflection, bible_version"
  - "ReelsSeries: simple entity with user_id FK for tenant isolation"

requirements-completed: [BIBLE-SCHEMA, BIBLE-STORIES-DATA, BIBLE-REQUEST-MODEL]

duration: 3min
completed: 2026-04-03
---

# Phase 1001 Plan 01: Data Foundation Summary

**DB schema (bible_config JSON + ReelsSeries table), 25 pre-defined biblical stories with multi-language titles, and extended request model for biblical reels**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T04:53:53Z
- **Completed:** 2026-04-03T04:57:11Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 029 adds bible_config JSON column, reels_series table, series_id FK, and part_number to reels_jobs
- BIBLE_STORIES dict with 25 entries (14 OT + 11 NT) providing ref, multi-language titles, and testament classification
- parse_manual_script function converts raw text into RoteiroSchema-compatible dict with even duration distribution
- ReelCreateInteractiveRequest extended with bible_config, series_id, part_number optional fields

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + model columns for bible_config and series** - `a10c9e2` (feat)
2. **Task 2: Bible stories data module and request model extension** - `008c6cb` (feat)

## Files Created/Modified
- `src/database/migrations/versions/029_add_bible_config_and_series.py` - Migration: bible_config, reels_series table, series_id, part_number
- `src/reels_pipeline/bible_stories.py` - 25 pre-defined stories, parse_manual_script, BIBLE_VERSIONS, BIBLE_HASHTAGS
- `src/database/models.py` - ReelsJob bible_config/series_id/part_number columns, ReelsSeries model
- `src/reels_pipeline/models.py` - ReelCreateInteractiveRequest extended with bible fields

## Decisions Made
- Migration 029 chains from 028 (latest in main repo); bible_config as JSON for flexible schema evolution
- 25 stories cover evangelical canon (66 books); 14 OT + 11 NT matching research spec exactly
- parse_manual_script uses default CTA "Compartilha com alguem que precisa dessa palavra hoje" for biblical context

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All data contracts ready for Plan 02 (biblical system prompt in script_gen.py)
- BIBLE_STORIES and parse_manual_script available for import by downstream plans
- ReelCreateInteractiveRequest ready to receive bible_config from wizard UI

## Self-Check: PASSED

All 4 source files and 1 summary file verified present. Both task commits (a10c9e2, 008c6cb) confirmed in git log.

---
*Phase: 1001-biblical-reels-category*
*Completed: 2026-04-03*
