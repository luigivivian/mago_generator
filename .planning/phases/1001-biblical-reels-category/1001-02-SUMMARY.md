---
phase: 1001-biblical-reels-category
plan: 02
subsystem: reels-pipeline
tags: [gemini, system-prompt, image-gen, bible, reels, config-override]

requires:
  - phase: 1001-biblical-reels-category
    plan: 01
    provides: bible_config JSON column, BIBLE_STORIES dict, parse_manual_script, extended request model
provides:
  - _BIBLE_SYSTEM_PROMPTS dict with PT-BR, EN, ES templates and biblical guardrails
  - _get_bible_system_prompt helper for building bible-specific system prompts
  - BIBLE_STYLE_DNA constant for Bible Project illustration style
  - Bible mode detection in generate_script (manual returns parse_manual_script, AI uses bible prompt)
  - Bible mode detection in generate_reel_images_per_cena (skips character DNA, uses BIBLE_STYLE_DNA)
  - bible_config flow from create_interactive -> step_state -> config_override -> all pipeline steps
affects: [1001-03, 1001-04, 1001-05]

tech-stack:
  added: []
  patterns: [bible mode detection via config_override["bible_config"], dedicated system prompt bypass]

key-files:
  created: []
  modified:
    - src/reels_pipeline/script_gen.py
    - src/reels_pipeline/image_gen.py
    - src/api/routes/reels.py
    - src/reels_pipeline/main.py

key-decisions:
  - "Bible system prompt has 5 guardrails in all 3 languages: follow faithfully, cite verses, no invented facts, no added characters, no altered outcomes"
  - "Bible mode clears character_section in script gen so character persona does not leak into biblical narration"
  - "BIBLE_STYLE_DNA references Bible Project style for consistent illustration across all biblical reels"
  - "config_override flows bible_config through all code paths: execute_step, approve_step, regenerate_step"
  - "Pipeline run_step_images_per_cena forwards self.config to generate_reel_images_per_cena for bible mode detection"

patterns-established:
  - "Bible mode detection: cfg.get('bible_config') -> bool gate for specialized behavior"
  - "Manual script bypass: script_mode='manual' returns parse_manual_script without calling Gemini"
  - "Illustration style constant: BIBLE_STYLE_DNA replaces character DNA for visual consistency"

requirements-completed: [BIBLE-SYSTEM-PROMPT, BIBLE-FAITHFUL-NARRATION, BIBLE-IMAGE-STYLE, BIBLE-CONFIG-FLOW, BIBLE-MANUAL-SCRIPT, BIBLE-REFLECTION-TOGGLE, BIBLE-MULTI-LANGUAGE, BIBLE-VERSE-CITATIONS]

duration: 7min
completed: 2026-04-03
---

# Phase 1001 Plan 02: Pipeline Behavior Summary

**Biblical system prompts with guardrails in 3 languages, Bible Project illustration style bypassing character DNA, and bible_config flow from API endpoint through step_state to all pipeline steps**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-03T05:01:23Z
- **Completed:** 2026-04-03T05:08:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- _BIBLE_SYSTEM_PROMPTS with PT-BR, EN, ES templates including 5 inviolable guardrails (faithful text, cite verses, no invented facts, no added characters, no altered outcomes)
- _get_bible_system_prompt builds language-appropriate prompt with reflection toggle, bible version, scene count, and time allocation
- generate_script detects bible mode: manual returns parse_manual_script directly (no Gemini call), AI uses bible-specific system prompt
- BIBLE_STYLE_DNA constant for Bible Project illustration style (clean lines, warm earth tones, cel-shading)
- generate_reel_images_per_cena and generate_reel_images accept config_override, skip character DNA in bible mode
- bible_config persisted to ReelsJob and step_state["config"] at creation, flowed through all step merge blocks

## Task Commits

Each task was committed atomically:

1. **Task 1a: Biblical system prompts and bible-mode detection in script_gen.py** - `19d8035` (feat)
2. **Task 1b: Bible-style image bypass in image_gen.py** - `12d32be` (feat)
3. **Task 2: Wire bible_config through create_interactive endpoint and step execution** - staged (git commit blocked by permission gate)

## Files Created/Modified
- `src/reels_pipeline/script_gen.py` - _BIBLE_SYSTEM_PROMPTS (3 languages), _get_bible_system_prompt, bible mode detection in generate_script
- `src/reels_pipeline/image_gen.py` - BIBLE_STYLE_DNA constant, config_override param on both image gen functions
- `src/api/routes/reels.py` - bible_config persistence, series_id/part_number on ReelsJob, config_override flow in all step paths
- `src/reels_pipeline/main.py` - Forward self.config to generate_reel_images_per_cena for bible mode

## Decisions Made
- Bible system prompt uses 5 explicit guardrails in each language, structured as GANCHO > CENARIO > NARRATIVA > LICAO > CTA
- Character persona (character_section) cleared when bible_config present, preventing wizard/mage leaking into biblical scripts
- Reflection toggle controls whether 2-3 closing sentences connect story to modern life (language-specific instructions)
- Bible version defaults from BIBLE_VERSIONS dict when not explicitly set in bible_config
- Scene count calculated as max(3, duracao // 12) for ~1 scene per 10-12 seconds

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cherry-picked Plan 01 commits into worktree**
- **Found during:** Pre-execution setup
- **Issue:** bible_stories.py and DB model changes from Plan 01 not present in this worktree
- **Fix:** Cherry-picked commits a10c9e2 and 008c6cb into worktree
- **Commits:** 490b805, 430773f

**2. [Rule 3 - Blocking] Pipeline run_step_images_per_cena not forwarding config_override**
- **Found during:** Task 2
- **Issue:** main.py called generate_reel_images_per_cena without config_override, so bible_config would not reach image gen
- **Fix:** Added config_override=self.config to the call in run_step_images_per_cena
- **File modified:** src/reels_pipeline/main.py

## Issues Encountered
- Git commit permission persistently denied for Task 2 (changes staged but uncommitted). Tasks 1a and 1b committed successfully.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functions are fully wired with real logic.

## Next Phase Readiness
- Biblical system prompts ready for use by wizard UI (Plan 03)
- BIBLE_STYLE_DNA ready for image generation in bible mode
- bible_config flows end-to-end through the pipeline
- All 8 requirements (BIBLE-SYSTEM-PROMPT through BIBLE-VERSE-CITATIONS) satisfied

## Self-Check: PARTIAL

Task 1a commit (19d8035) and Task 1b commit (12d32be) verified in git log. Task 2 changes staged but awaiting commit due to permission gate. All 4 source files verified present with correct modifications.

---
*Phase: 1001-biblical-reels-category*
*Completed: 2026-04-03*
