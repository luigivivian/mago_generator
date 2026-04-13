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
- [x] 01-02-PLAN.md — Backend: new /scene-config endpoint + TTS per-cena override
- [x] 01-03-PLAN.md — Frontend write: patchSceneConfig + PropertiesPanel handlers + remove warning
- [x] 01-04-PLAN.md — Frontend read: editor_config merge on load + flip frontend tests green

### Phase 1002: Product Studio v2 — Cinematic Multi-Scene Ads

**Goal:** Replace current single-image `/ads` pipeline with a cinematic multi-scene video production tool. User uploads 3-4 product images → AI generates scene suggestions → full take editor with camera/action/transition config → Kling multi-image video generation → audio SFX mix → multi-format export.
**Requirements:** REQ-PS2-01, REQ-PS2-02, REQ-PS2-03, REQ-PS2-04, REQ-PS2-05, REQ-PS2-06, REQ-PS2-07, REQ-PS2-08, REQ-PS2-09, REQ-PS2-10, REQ-PS2-11
**Depends on:** none
**Plans:** 7/7 plans complete

Plans:
- [x] 1002-01-PLAN.md — V2 data models + DB migration + xfail test stubs (Wave 1)
- [x] 1002-02-PLAN.md — 7 category configs + prompt templates (Wave 1)
- [x] 1002-03-PLAN.md — Multi-image upload endpoint + normalize_for_kling (Wave 2)
- [x] 1002-04-PLAN.md — Gemini storyboard + Kling multi-image payload (Wave 2)
- [x] 1002-05-PLAN.md — SFX library + audio mix + video composition (Wave 2)
- [x] 1002-06-PLAN.md — Multi-format export + run_v2_pipeline orchestrator + /create-v2 route (Wave 3)
- [x] 1002-07-PLAN.md — Take editor UI + /ads/new multi-image flow + e2e verification (Wave 3)

### Phase 1003: Pro Video Prompt Engineering

**Goal:** Elevate all video prompt generation to professional commercial standards using Skool-level techniques (exhaustive scene description, camera-as-sentence, physics micro-details, per-shot stability). Add 3 new categories, per-category element/prop libraries, template variable system, free prompt mode, and pytest prompt linting suite.
**Requirements:** REQ-PPE-01, REQ-PPE-02, REQ-PPE-03, REQ-PPE-04, REQ-PPE-05, REQ-PPE-06, REQ-PPE-07, REQ-PPE-08, REQ-PPE-09, REQ-PPE-10, REQ-PPE-11, REQ-PPE-12, REQ-PPE-13, REQ-PPE-14, REQ-PPE-15, REQ-PPE-16
**Depends on:** Phase 1002
**Plans:** 3/3 plans complete

Plans:
- [x] 1003-01-PLAN.md — Config overhaul: 10 categories, Skool-level shot plans, stability suffixes, negative prompts, element libraries (Wave 1)
- [x] 1003-02-PLAN.md — Prompt builder + scene composer: template resolution, 2000 char budget, Gemini pro fallback, free prompt, frame chaining (Wave 2)
- [x] 1003-03-PLAN.md — Pytest prompt linting suite + human verification (Wave 3)

## Backlog

> Compressed summaries. Run `/gsd:discuss-phase` to expand any item before planning.

- **999.10 -- Full Video Editor:** Executed in v3.0 -- likely obsolete.
- **999.11 -- Editor Critical Bugs:** Most fixed during v3.0 -- audit remaining.
- **999.12 -- Editor UX Enhancements:** Partially done in v3.0 -- audit remaining.
- **999.13 -- Audio/Subtitle/Scene Sync:** Partially addressed by phase 22 (v4.0) -- audit remaining.
- **999.14 -- Economic Asset Mode (Ken Burns):** Partially addressed by phase 26 (v4.0) -- audit remaining.

### Phase 1004: V2 Ad Regeneration, AI Prompt Builder, and Seedance Parallel Flow

**Goal:** Consolidate VIDEO_MODELS, add model selector + duration picker to V2 wizard, create AI prompt builder modal (5W1H for Kling, narrative acts for Seedance), add Seedance multi-shot configuration panel, extend RegenerateV2Request with scene_prompts, and add scene prompt editing to detail page regeneration flow.
**Requirements:** P1004-01, P1004-02, P1004-03, P1004-04, P1004-05, P1004-06, P1004-07, P1004-08
**Depends on:** Phase 1003
**Plans:** 3/3 plans complete

Plans:
- [x] 1004-01-PLAN.md — VIDEO_MODELS consolidation + model selector + duration picker (Wave 1)
- [x] 1004-02-PLAN.md — AI Prompt Builder modal + scene prompt editing on detail page + backend RegenerateV2Request extension (Wave 2)
- [x] 1004-03-PLAN.md — Seedance multi-shot configuration panel + conditional wizard flow (Wave 2)
