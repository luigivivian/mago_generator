---
phase: 25-structured-image-generation
plan: 01
subsystem: testing
tags: [pytest, xfail, gemini-image, fake-client]

requires:
  - phase: 24-script-schema-v2
    provides: CenaSchema with image_prompt field, CharacterCardSchema with style_seed
provides:
  - xfail test stubs for IMAGE-01 through IMAGE-04
  - FakeGeminiImageClient fixture returning JPEG bytes
  - Dual monkeypatch (llm_client + image_gen) for image generation tests
affects: [25-structured-image-generation]

tech-stack:
  added: []
  patterns: [xfail-then-flip wave pattern for image gen tests]

key-files:
  created: [tests/test_reels_image_gen.py]
  modified: [tests/conftest.py]

key-decisions:
  - "PIL-generated 1x1 JPEG for fake response (reliable across platforms vs hardcoded bytes)"
  - "Dual monkeypatch pattern (src.llm_client + src.reels_pipeline.image_gen) consistent with Phase 22 TTS fixture"

patterns-established:
  - "FakeGeminiImageClient: same interface as FakeGeminiClient but returns image/jpeg data"

requirements-completed: [IMAGE-01, IMAGE-02, IMAGE-03, IMAGE-04]

duration: 3min
completed: 2026-04-09
---

# Phase 25 Plan 01: Structured Image Generation -- Wave 0 xfail stubs

**4 xfail test stubs for IMAGE-01..04 with FakeGeminiImageClient fixture returning valid JPEG bytes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T16:26:48Z
- **Completed:** 2026-04-09T16:29:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- FakeGeminiImageResponse with PIL-generated 1x1 JPEG (valid image, not PCM TTS data)
- FakeGeminiImageClient capturing all generate_content calls for prompt assertion
- fake_gemini_image_client fixture with dual monkeypatch (llm_client source + image_gen local binding)
- 4 xfail/strict test stubs mapped to IMAGE-01 through IMAGE-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Add fake_gemini_image_client fixture to conftest.py** - `fab262d` (test)
2. **Task 2: Create xfail test stubs for IMAGE-01..IMAGE-04** - `70bf6a3` (test)

## Files Created/Modified
- `tests/test_reels_image_gen.py` - 4 xfail stubs: image_prompt primary, style_seed prepend, bible style combined, aspect ratio explicit
- `tests/conftest.py` - Added FakeGeminiImageResponse, FakeGeminiImageClient, fake_gemini_image_client fixture

## Decisions Made
- Used PIL.Image to generate a real 1x1 JPEG in the fixture rather than hardcoded bytes -- more reliable across platforms
- Followed exact same dual-monkeypatch pattern as Phase 22 TTS fixture (src.llm_client._get_client + src.reels_pipeline.image_gen._get_client)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None -- the 4 xfail tests are intentional Wave 0 stubs, designed to be flipped by Plan 25-02.

## Next Phase Readiness
- Plan 25-02 can flip all 4 tests from xfail to active as it implements IMAGE-01..04
- FakeGeminiImageClient captures full call args for prompt substring assertions

## Self-Check: PASSED

- [x] tests/test_reels_image_gen.py exists
- [x] tests/conftest.py exists
- [x] 25-01-SUMMARY.md exists
- [x] Commit fab262d found
- [x] Commit 70bf6a3 found

---
*Phase: 25-structured-image-generation*
*Completed: 2026-04-09*
