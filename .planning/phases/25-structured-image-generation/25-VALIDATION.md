---
phase: 25
slug: structured-image-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 + pytest-asyncio |
| **Config file** | tests/conftest.py (shared fixtures) |
| **Quick run command** | `python -m pytest tests/test_reels_image_gen.py -x -q` |
| **Full suite command** | `python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_reels_image_gen.py -x -q`
- **After every plan wave:** Run `python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 0 | IMAGE-01..04 | unit | `pytest tests/test_reels_image_gen.py -x` | W0 | pending |
| 25-02-01 | 02 | 1 | IMAGE-01 | unit | `pytest tests/test_reels_image_gen.py::test_01_image_prompt_primary -x` | W0 | pending |
| 25-02-02 | 02 | 1 | IMAGE-02 | unit | `pytest tests/test_reels_image_gen.py::test_02_style_seed_prepended -x` | W0 | pending |
| 25-02-03 | 02 | 1 | IMAGE-03 | unit | `pytest tests/test_reels_image_gen.py::test_03_bible_style_combined -x` | W0 | pending |
| 25-02-04 | 02 | 1 | IMAGE-04 | unit | `pytest tests/test_reels_image_gen.py::test_04_aspect_ratio_explicit -x` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_reels_image_gen.py` — xfail stubs for IMAGE-01 through IMAGE-04
- [ ] `tests/conftest.py` — extend FakeGeminiClient or add image-specific fixture
- [ ] Monkeypatch target: `src.llm_client._get_client` AND `src.reels_pipeline.image_gen._get_client`
- [ ] Framework install: none needed (pytest already available)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual quality of generated images | IMAGE-01 | Requires human visual assessment | Generate images for a 5-cena job, visually compare outputs for prompt fidelity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
