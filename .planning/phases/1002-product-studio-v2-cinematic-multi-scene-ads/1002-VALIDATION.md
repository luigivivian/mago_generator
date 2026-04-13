---
phase: 1002
slug: product-studio-v2-cinematic-multi-scene-ads
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 1002 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 1002-RESEARCH.md "Validation Architecture" section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 7.x |
| **Framework (frontend)** | vitest |
| **Config file (backend)** | `pyproject.toml` [tool.pytest.ini_options] |
| **Config file (frontend)** | `memelab/vitest.config.ts` |
| **Quick run command (backend)** | `python -m pytest tests/test_product_studio_v2.py -x --timeout=30` |
| **Quick run command (frontend)** | `cd memelab && npx vitest run src/__tests__/take-editor.test.tsx` |
| **Full suite command** | `python -m pytest tests/ -x --timeout=60` |
| **Estimated runtime** | ~60 seconds (quick) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_product_studio_v2.py -x --timeout=30`
- **After every plan wave:** Run `python -m pytest tests/ -x --timeout=60`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Requirements -> Test Map

Copied from `1002-RESEARCH.md` "Phase Requirements -> Test Map" table and extended with plan/task refs.

| Req ID | Plan | Behavior | Test Type | Automated Command | File Exists |
|--------|------|----------|-----------|-------------------|-------------|
| REQ-PS2-01 | 01, 03 | Multi-image upload validation (1-4 images, format, size) | unit | `pytest tests/test_product_studio_v2.py::test_01_multi_image_upload -x` | ❌ W0 |
| REQ-PS2-02 | 03 | Image normalization for Kling (min 300px, max 10MB) | unit | `pytest tests/test_product_studio_v2.py::test_02_image_treatment -x` | ❌ W0 |
| REQ-PS2-03 | 04 | AI scene generation returns structured storyboard | unit | `pytest tests/test_product_studio_v2.py::test_03_scene_generation -x` | ❌ W0 |
| REQ-PS2-04 | 01, 07 | Take editor config model validation | unit | `cd memelab && npx vitest run src/__tests__/take-editor.test.tsx` | ❌ W0 |
| REQ-PS2-05 | 02 | Category template selection and prompt building | unit | `pytest tests/test_product_studio_v2.py::test_05_category_templates -x` | ❌ W0 |
| REQ-PS2-06 | 04 | Kling payload with kling_elements + multi_prompt | unit | `pytest tests/test_product_studio_v2.py::test_06_kling_multi_image -x` | ❌ W0 |
| REQ-PS2-07 | 05 | SFX library catalog loading + category filter | unit | `pytest tests/test_product_studio_v2.py::test_07_sfx_library -x` | ❌ W0 |
| REQ-PS2-08 | 05 | Audio mixing with SFX + ambient layers (silent base + SFX hit path) | unit | `pytest tests/test_product_studio_v2.py::test_08_audio_mixing -x` | ❌ W0 |
| REQ-PS2-09 | 05 | Video composition via concat_segments | unit | `pytest tests/test_product_studio_v2.py::test_09_video_composition -x` | ❌ W0 |
| REQ-PS2-10 | 06 | Multi-format export + individual takes + thumbnail | unit | `pytest tests/test_product_studio_v2.py::test_10_multi_format_export -x` | ❌ W0 |
| REQ-PS2-11 | 01, 06 | Backward compat: old jobs visible, new routes work, v2 response shape | unit + integration | `pytest tests/test_product_studio_v2.py::test_11_backward_compat -x` | ❌ W0 |

---

## Wave 0 Requirements

Wave 0 test scaffolding is produced by Plan 01 Task 1 (see `1002-01-PLAN.md`):

- [ ] `tests/test_product_studio_v2.py` — 11 xfail stubs covering REQ-PS2-01 through REQ-PS2-11
- [ ] `memelab/src/__tests__/take-editor.test.tsx` — vitest stub for REQ-PS2-04 (created in Plan 07)
- [ ] `assets/sfx/` — SFX assets directory with README (created in Plan 05)

No framework install needed: both pytest and vitest are already configured in this repo.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end v2 flow visual QA | REQ-PS2-04, REQ-PS2-11 | Visual/interactive UX cannot be fully automated | Plan 07 Task 3 checkpoint — 14-step walkthrough from upload to rendered video |
| Kling multi-image quality | REQ-PS2-06 | Subjective product fidelity assessment across shots | Post-render visual inspection of at least 3 test jobs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after execution

**Approval:** pending
