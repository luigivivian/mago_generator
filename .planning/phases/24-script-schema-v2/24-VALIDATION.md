---
phase: 24
slug: script-schema-v2
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (existing) |
| **Config file** | none (default pytest discovery) |
| **Quick run command** | `python3 -m pytest tests/test_reels_script_schema.py -x -q` |
| **Full suite command** | `python3 -m pytest tests/ -x -q --ignore=tests/test_agents_quick.py` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest tests/test_reels_script_schema.py -x -q`
- **After every plan wave:** Run `python3 -m pytest tests/ -x -q --ignore=tests/test_agents_quick.py`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 0 | SCRIPT-01..06 | unit | `pytest tests/test_reels_script_schema.py -x` | ❌ W0 | ⬜ pending |
| 24-02-01 | 02 | 1 | SCRIPT-01 | unit | `pytest tests/test_reels_script_schema.py::test_01_character_card_in_schema -x` | ❌ W0 | ⬜ pending |
| 24-02-02 | 02 | 1 | SCRIPT-02 | unit | `pytest tests/test_reels_script_schema.py::test_02_image_prompt_per_cena -x` | ❌ W0 | ⬜ pending |
| 24-02-03 | 02 | 1 | SCRIPT-03 | unit | `pytest tests/test_reels_script_schema.py::test_03_mood_enum -x` | ❌ W0 | ⬜ pending |
| 24-02-04 | 02 | 1 | SCRIPT-04 | unit | `pytest tests/test_reels_script_schema.py::test_04_transitions_enum -x` | ❌ W0 | ⬜ pending |
| 24-03-01 | 03 | 1 | SCRIPT-05 | unit | `pytest tests/test_reels_script_schema.py::test_05_system_prompts_updated -x` | ❌ W0 | ⬜ pending |
| 24-04-01 | 04 | 2 | SCRIPT-06 | unit | `pytest tests/test_reels_script_schema.py::test_06_legacy_migration -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_reels_script_schema.py` — xfail stubs for SCRIPT-01 through SCRIPT-06 + extras (07-10)
- [ ] Framework install: none needed (pytest already available)

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Legacy job loads in editor | SCRIPT-06 | Needs real DB job + editor UI | Load a pre-v4.0 job via `/reels/{jobId}`, verify no crash, advance through images+clips |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
