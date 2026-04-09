# Roadmap: Clip-Flow

## Completed Milestones

- [x] **v1.0**: Auth, Rate Limiting & Gemini Image Fix -- 11 phases, 25/25 requirements, completed 2026-03-24 -- [details](milestones/v1.0-ROADMAP.md)
- [x] **v2.0**: Pipeline Simplification, Auto-Publicacao & Multi-Tenant -- 17 phases, 72/77 requirements, completed 2026-04-01 -- [details](milestones/v2.0-ROADMAP.md)
- [x] **v3.0**: Editor Polish & Cost Optimization -- 8 phases, 25 plans, 0 critical gaps, tech debt acknowledged, completed 2026-04-07 -- [details](milestones/v3.0-ROADMAP.md)
- [x] **v4.0**: Pipeline Fidelity Refactor -- 5 phases, 17 plans, 26/26 requirements, 37 tests GREEN, completed 2026-04-09 -- [details](milestones/v4.0-ROADMAP.md)

## Active

### Phase 1: Per-scene config write-back to backend

**Goal:** Make editor edits authoritative -- voice/speed/trim/freeze/duration must flow back to script.cenas/clips.scenes and survive regenerateStep(). Currently edits in PropertiesPanel mutate the store but are silently discarded on regeneration.
**Requirements**: TBD
**Depends on:** none
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Wave 0 xfail test stubs (backend + frontend)
- [ ] 01-02-PLAN.md — Backend: new /scene-config endpoint + TTS per-cena override
- [ ] 01-03-PLAN.md — Frontend write: patchSceneConfig + PropertiesPanel handlers + remove warning
- [ ] 01-04-PLAN.md — Frontend read: editor_config merge on load + flip frontend tests green

## Backlog

> Compressed summaries. Run `/gsd:discuss-phase` to expand any item before planning.

- **999.10 -- Full Video Editor:** Executed in v3.0 -- likely obsolete.
- **999.11 -- Editor Critical Bugs:** Most fixed during v3.0 -- audit remaining.
- **999.12 -- Editor UX Enhancements:** Partially done in v3.0 -- audit remaining.
- **999.13 -- Audio/Subtitle/Scene Sync:** Partially addressed by phase 22 (v4.0) -- audit remaining.
- **999.14 -- Economic Asset Mode (Ken Burns):** Partially addressed by phase 26 (v4.0) -- audit remaining.
