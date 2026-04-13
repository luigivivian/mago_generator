---
phase: 1004
slug: v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 1004 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend) / TypeScript type-check (frontend) |
| **Config file** | memelab/tsconfig.json, pytest.ini (if exists) |
| **Quick run command** | `cd memelab && npx tsc --noEmit` |
| **Full suite command** | `cd memelab && npx tsc --noEmit && python -m pytest src/ -x -q 2>/dev/null || true` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd memelab && npx tsc --noEmit`
- **After every plan wave:** Run full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1004-01-01 | 01 | 1 | scene_prompts in createAdJobV2 payload | type-check | `cd memelab && npx tsc --noEmit` | ⬜ pending |
| 1004-01-02 | 01 | 1 | VIDEO_MODELS consolidation | type-check | `cd memelab && npx tsc --noEmit` | ⬜ pending |
| 1004-01-03 | 01 | 1 | model selector renders correct options | manual | browser test /ads/new | ⬜ pending |
| 1004-02-01 | 02 | 2 | AI prompt builder modal opens | manual | browser test /ads/new | ⬜ pending |
| 1004-02-02 | 02 | 2 | 5W1H fields assemble correct prompt | type-check | `cd memelab && npx tsc --noEmit` | ⬜ pending |
| 1004-02-03 | 02 | 2 | Seedance fields render for bytedance models | manual | browser test model switch | ⬜ pending |
| 1004-03-01 | 03 | 3 | Seedance multi-shot section shows on model select | manual | browser test /ads/new | ⬜ pending |
| 1004-03-02 | 03 | 3 | Per-shot form renders 4-12 shot cards | manual | browser test Seedance wizard | ⬜ pending |
| 1004-03-03 | 03 | 3 | RegenerateV2Request accepts scene_prompts | type-check | `cd memelab && npx tsc --noEmit` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing TypeScript infrastructure covers type-checking
- No new test files required for Wave 0 — frontend changes are UI-only, verified manually + type-check

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Model selector shows correct duration options | UI rendering | Go to /ads/new, change model, verify duration options update |
| AI prompt builder assembles 5W1H prompt correctly | End-to-end flow | Fill WHO/WHAT/etc fields, verify assembled prompt text |
| Seedance section expands on bytedance/* model select | Conditional UI | Select Seedance model, verify multi-shot section appears |
| Per-shot cards show camera/duration/transition selects | UI rendering | In Seedance section, add shots, verify all fields present |
| Regeneration with new scene_prompts submits correct payload | API integration | On job detail, edit prompt, click Regenerate, check network payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
