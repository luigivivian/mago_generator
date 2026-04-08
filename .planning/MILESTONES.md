# Milestones

## v3.0 Editor Polish & Cost Optimization (Shipped: 2026-04-07)

**Phases completed:** 8 phases, 25 plans, 0 critical gaps

**Key accomplishments:**

- Phase 999.9: Full Kie API credit system — per-model pricing, balance management, logs page, admin top-up. Gates all Kie pipelines (video, reels, ads) with credit pre-check; deduct on success, refund on failure.
- Phase 1000: Character-scoped navigation — sidebar selector that filters all 6 content surfaces (gallery, videos, reels, ads, themes, publishing) by character_slug. Persisted in localStorage. Includes "Todos os Personagens" override.
- Phase 1001: Biblical reels category — new bible_config schema, biblical system prompts, frontend wizard with story selector + manual script mode, verse highlighting, full E2E test.
- Phase 999.10: Production-grade in-browser video editor — Remotion-based with multi-track timeline (video/audio/legendas), drag-and-drop reorder, trim handles, properties panel, autosave, undo/redo, "Editar Video" entry from reels list. 8 plans landing the editor end-to-end.
- Phase 999.11: 10 critical editor bugs — SRT fetch race, AudioContext leak on zoom, freezeFrame cascade shift, contentEditable text loss, duplicate subtitle IDs, trimScene clamp, autosave timer leak after unmount, context menu stale offset, duplicate playhead sync, video left-trim semantics. Pure functions extracted to lib/editor/ with vitest coverage.
- Phase 999.12: Editor UX enhancements — multi-select with bulk ops, snap-to-edge/playhead with Alt-disable, arrow-key nudging, per-clip volume, per-track mute/solo, safe-zone overlay (TikTok/Instagram), zoom-to-fit, resizable timeline panel, export progress modal with polling, pre-export validation, subtitle style presets in localStorage.
- Phase 999.13: Drift assertion in loadFromStepState (smoke alarm for upstream alignment regressions) + TTS config UI cleanup (default 1.35, range 0.8-1.6, real Gemini voice list). Root causes for the original "audio drift / slow TTS" complaint were already addressed in earlier commits 21a1831, 8957444, 392c0db, quick task 260407-2cj.
- Phase 999.14: Economic asset mode — migration 030 with economic_mode column, ReelsConfig field, pipeline short-circuit that bypasses Kie API entirely and produces static clips, scene splitter bypass via effective_max=30s, frontend toggle with cost preview comparing dynamic vs economic, and Ken Burns motion in the Remotion Scene component (4 deterministic patterns indexed by scene.index, zoom 1.0..1.15 + ±5% pan). Cuts reel generation costs by ~70%.

**Tech debt accepted:** Migration 030 must be applied via `alembic upgrade head`. No fresh UAT for 999.10-08 — verified-via-proxy through 999.11. Audio bulk-duplicate deferred. Some pure functions in lib/editor/ have no dedicated unit tests yet. Drift assertion is dev-only console.warn. Cost preview is approximate.

**Audit:** [v3.0-MILESTONE-AUDIT.md](v3.0-MILESTONE-AUDIT.md)

---

## v2.0 Pipeline Simplification, Auto-Publicacao & Multi-Tenant (Shipped: 2026-04-01)

**Phases completed:** 8 phases, 27 plans, 53 tasks

**Key accomplishments:**

- Stale job scanner with 15-min auto-fail, retry endpoint for failed video jobs, progress API with step labels, and kie_client transient retry logic
- Card grid video jobs UI with progress bars, retry buttons, expandable detail rows, and status filter tabs
- Backend PATCH approve endpoint, model/sort filters on video list, frontend API client with SWR hook, and Videos sidebar navigation entry
- Dedicated /videos page with responsive video card grid, inline HTML5 playback, download/approve/delete actions, filter tabs, and violet Video Gerado badge on gallery images
- BRL-native cost tracking via ApiUsage cost_brl column, per-model tier grouping, and credits summary API endpoint with prices_brl lookup
- VideoCreditsCard component with per-model BRL cost breakdown table, daily budget progress bar, and all-time stats on dashboard
- GET /dashboard/business-metrics endpoint with 5 metric groups (videos, avg cost BRL, budget, trends, packages) using period comparison queries and legacy USD-to-BRL fallback
- 4 business StatsCards with colored icon backgrounds and trend arrow icons, plus full USD-to-BRL conversion for cost pie chart, total text, and video dialog budget
- Four AI modules for product ad pipeline: rembg background removal, Gemini scene composition with product preservation, style-aware cinematic prompt builder, and Portuguese copy generator
- KieMusicClient for Suno music via Kie.ai, FFmpeg format exporter with blur pad, text overlay (drawtext+tempfile), and 4-mode audio mixing
- ProductAdPipeline with 8 step methods chaining all modules -- GCS upload for video gen, Suno music, FFmpeg assembly, and BRL cost estimation before generation
- REST API with 10 endpoints for product ad pipeline following reels.py pattern -- create, execute, approve, regenerate, cost estimate
- API client types, SWR hooks, ads listing page, and 4-section wizard for creating video ads
- 1. [Rule 3 - Blocking] Ad API types and hooks not in worktree
- 4 async modules generating 9:16 images via Gemini, structured JSON roteiro via multimodal, WAV narration via Flash TTS, and SRT subtitles via Gemini audio transcription -- all using same GOOGLE_API_KEY with zero new dependencies
- FFmpeg xfade slideshow assembly (scale+pad, crossfade, SRT subtitles, audio mix) and ReelsPipeline 5-step sequential orchestrator with progress tracking and USD/BRL cost accumulation
- Complete Reels page with generation form (tema + tone/duration/niche/preset), real-time progress polling at 2s, job history card grid with status badges, and collapsible config panel for TTS/video settings
- Per-step pipeline execution with step_state persistence, video segmentation for >30s reels, and backward-compatible run() refactor
- Step-based API surface for interactive pipeline: execute/approve/regenerate/edit per step with tenant isolation and artifact file serving
- Interactive stepper UI with 6-step indicators, AnimatePresence transitions, and first 3 step components (prompt, images, script) with full approve/regenerate/edit controls
- Full 6-step interactive stepper with HTML5 audio preview, inline SRT editing, and video player with download
- Reordered interactive pipeline steps so script generates before images, with per-cena context-aware image generation from approved script cenas
- Per-scene Hailuo image-to-video generation via Kie.ai with parallel polling, static fallback, and mobile-optimized subtitle styling (FontSize=28)
- Reordered frontend stepper to match backend step order and fixed all approve wiring so each step triggers the correct next generation
- script_gen.py

---

## v2.0 Pipeline Simplification, Auto-Publicacao & Multi-Tenant (Shipped: 2026-03-27)

**Phases completed:** 4 phases, 8 plans, 15 tasks

**Key accomplishments:**

- BRL-native cost tracking via ApiUsage cost_brl column, per-model tier grouping, and credits summary API endpoint with prices_brl lookup
- VideoCreditsCard component with per-model BRL cost breakdown table, daily budget progress bar, and all-time stats on dashboard
- GET /dashboard/business-metrics endpoint with 5 metric groups (videos, avg cost BRL, budget, trends, packages) using period comparison queries and legacy USD-to-BRL fallback
- 4 business StatsCards with colored icon backgrounds and trend arrow icons, plus full USD-to-BRL conversion for cost pie chart, total text, and video dialog budget

---

## v2.0 Pipeline Simplification, Auto-Publicacao & Multi-Tenant (Shipped: 2026-03-27)

**Phases completed:** 9 phases, 23 plans, 43 tasks

**Key accomplishments:**

- Manual pipeline backend with hex-color Pillow composition, approval workflow, 27 theme palettes, and 9 API endpoints forcing zero Gemini Image calls
- Pipeline page rewrite with manual run form (input mode tabs, theme/color/image selectors), results grid with optimistic approve/reject per card and bulk actions, matching UI-SPEC design contract
- Alembic migration 010 with backfill/NOT NULL, CharacterRepository tenant filtering with admin bypass, and get_user_character deps helper
- PipelineRunRepository
- Alembic migration 012 with 6 video columns on ContentPackage, video_prompt_notes on Theme, 13 config constants for Kie.ai Sora 2, and GCS uploader service for public image URLs
- 4 video API endpoints (generate, batch, status, budget) with daily budget enforcement, background async processing, and cost tracking via kie_video service

---
