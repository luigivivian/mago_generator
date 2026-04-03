---
phase: 1000-character-scoped-navigation
plan: 03
subsystem: ui
tags: [react, context, character-filtering, sidebar, next.js]

requires:
  - phase: 1000-character-scoped-navigation
    provides: character_slug in all SWR hooks and API functions (Plan 02)
  - phase: 13-multi-tenant-isolation
    provides: CharacterContext, CharacterSelector, character_id columns on models
provides:
  - "Todos os Personagens" option in CharacterSelector dropdown
  - Empty string default for activeSlug (all-characters mode)
  - Visual indicator for active selection (both Todos and individual characters)
affects: [dashboard-character-scoping]

tech-stack:
  added: []
  patterns: [empty string activeSlug = all characters (no filter), LayoutGrid icon for all-characters mode]

key-files:
  created: []
  modified:
    - memelab/src/components/layout/sidebar.tsx
    - memelab/src/contexts/character-context.tsx

key-decisions:
  - "Empty string default: activeSlug defaults to '' so new/returning users see all content without character filter"
  - "activeCharacter null when all selected: when activeSlug is empty, activeCharacter is null (no specific character active)"
  - "LayoutGrid icon for Todos: uses Lucide LayoutGrid to visually distinguish all-characters option from individual character initials"

patterns-established:
  - "All-characters mode: activeSlug === '' means no character filter; activeSlug || undefined evaluates to undefined, omitting API param"
  - "CharacterSelector Todos-first: Todos os Personagens always appears first with divider separating from character list"

requirements-completed: [CHAR-01, CHAR-02]

duration: 3min
completed: 2026-04-03
---

# Phase 1000 Plan 03: Todos os Personagens Option Summary

**CharacterSelector shows "Todos os Personagens" as first dropdown option with empty-string default so users see all content by default**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-03T02:41:04Z
- **Completed:** 2026-04-03T02:44:30Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added "Todos os Personagens" as the first option in the CharacterSelector dropdown with LayoutGrid icon
- Changed CharacterContext default activeSlug from "mago-mestre" to "" (empty string) so new users see all content
- activeCharacter resolves to null when all-characters mode is active (no false character selection)
- Collapsed sidebar shows grid icon instead of character initial when "Todos" is active

## Task Commits

Each task was committed atomically:

1. **Task 1: Add "Todos os Personagens" option and change CharacterContext default** - `4652dc5` (feat)

## Files Created/Modified
- `memelab/src/contexts/character-context.tsx` - Default activeSlug changed to "", activeCharacter returns null when slug is empty (all-characters mode)
- `memelab/src/components/layout/sidebar.tsx` - CharacterSelector prepends "Todos os Personagens" option with LayoutGrid icon, divider before character entries, visual highlight on active state, collapsed mode shows grid icon

## Decisions Made
- Empty string as default (not null or "all"): consistent with Plan 02's `activeSlug || undefined` pattern where empty string becomes undefined and omits the API param
- activeCharacter is null when Todos is selected: prevents downstream components from assuming a specific character is always active
- LayoutGrid icon for visual distinction: differentiates the "all" option from individual character entries that show name initials

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js lint required interactive ESLint setup (not configured in worktree). Verified with TypeScript compiler instead -- no type errors in modified files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 plans of Phase 1000 are now complete
- Character-scoped navigation is fully functional: backend filtering (Plan 01), frontend hook wiring (Plan 02), and "Todos" option with correct default (Plan 03)
- Dashboard character scoping was intentionally deferred and can be added following the same activeSlug || undefined pattern

## Self-Check: PASSED

All files verified present. Task commit (4652dc5) confirmed in git log.

---
*Phase: 1000-character-scoped-navigation*
*Completed: 2026-04-03*
