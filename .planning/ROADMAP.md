# Roadmap: Clip-Flow

## Completed Milestones

- [x] **v1.0**: Auth, Rate Limiting & Gemini Image Fix — 11 phases, 25/25 requirements, completed 2026-03-24 — [details](milestones/v1.0-ROADMAP.md)
- [x] **v2.0**: Pipeline Simplification, Auto-Publicacao & Multi-Tenant — 17 phases, 72/77 requirements, completed 2026-04-01 — [details](milestones/v2.0-ROADMAP.md)
- [x] **v3.0**: Editor Polish & Cost Optimization — 8 phases, 25 plans, 0 critical gaps, tech debt acknowledged, completed 2026-04-07 — [details](milestones/v3.0-ROADMAP.md)
- [x] **v4.0**: Pipeline Fidelity Refactor — 5 phases, 17 plans, 26/26 requirements, 37 tests GREEN, completed 2026-04-09 — [details](milestones/v4.0-ROADMAP.md)

## Backlog

### Phase 999.15: Editor reels — per-scene config write-back to backend (BACKLOG)

**Goal:** [Captured for future planning] Make `step_state.editor` authoritative so per-scene voice/speed sliders and trim/freeze/duration edits survive backend regenerations. Currently the editor is a read-mostly surface — edits in `PropertiesPanel` mutate the store but never flow back to `script.cenas` / `clips.scenes`, so `regenerateStep("tts")` and `regenerateStep("clips")` discard them.

**Context:** Diagnosed but parked during v3.0 editor debug session. Full evidence in [.planning/debug/reels-editor-multi-bugs.md](debug/reels-editor-multi-bugs.md).

**Priority:** medium (current workaround: regen first, re-edit manually)

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
