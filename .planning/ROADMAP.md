# Roadmap: Clip-Flow

## Completed Milestones

- [x] **v1.0**: Auth, Rate Limiting & Gemini Image Fix -- 11 phases, 25/25 requirements, completed 2026-03-24 -- [details](milestones/v1.0-ROADMAP.md)
- [x] **v2.0**: Pipeline Simplification, Auto-Publicacao & Multi-Tenant -- 17 phases, 72/77 requirements, completed 2026-04-01 -- [details](milestones/v2.0-ROADMAP.md)
- [x] **v3.0**: Editor Polish & Cost Optimization -- 8 phases, 25 plans, 0 critical gaps, tech debt acknowledged, completed 2026-04-07 -- [details](milestones/v3.0-ROADMAP.md)
- [x] **v4.0**: Pipeline Fidelity Refactor -- 5 phases, 17 plans, 26/26 requirements, 37 tests GREEN, completed 2026-04-09 -- [details](milestones/v4.0-ROADMAP.md)

## Backlog

> Compressed summaries. Run `/gsd:discuss-phase` to expand any item before planning.

- **999.10 -- Full Video Editor:** Remotion-based in-browser editor with multi-track timeline, live preview, subtitle editing, transition config, voice settings, server-side export. 8 plans (executed in v3.0).
- **999.11 -- Editor Critical Bugs:** 10 data-integrity/stability bugs -- playhead sync, freezeFrame cascading, subtitle safety. 3 plans. Most fixed during v3.0.
- **999.12 -- Editor UX Enhancements:** Pro-grade UX -- timeline snapping, selection model, nudging, overlay guides, export progress, subtitle presets. 6 plans. Partially done in v3.0.
- **999.13 -- Audio/Subtitle/Scene Sync Anchors:** Zero-drift contract between narration, subtitles, scene durations via word-level transcription anchors. 1 plan. Partially addressed by phase 22.
- **999.14 -- Economic Asset Mode (Ken Burns):** Cut costs ~70% via static images + Ken Burns instead of Hailuo clips. 2 plans. Partially addressed by phase 26.
- **999.15 -- Per-Scene Config Write-back (CRITICAL):** Make editor edits authoritative -- voice/speed/trim/freeze/duration must flow back to script.cenas/clips.scenes and survive regenerateStep(). Currently edits silently discarded on regeneration.
