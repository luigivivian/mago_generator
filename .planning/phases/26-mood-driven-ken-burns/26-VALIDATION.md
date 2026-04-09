---
phase: 26
slug: mood-driven-ken-burns
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | tests/conftest.py |
| **Quick run command** | `python -m pytest tests/test_reels_ken_burns.py -x -q` |
| **Full suite command** | `python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python -m pytest tests/test_reels_ken_burns.py -x -q`
- **After every plan wave:** Run `python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 0 | MOTION-01..05 | xfail stubs | `pytest tests/test_reels_ken_burns.py -x -q` | ❌ W0 | ⬜ pending |
| 26-02-01 | 02 | 1 | MOTION-01,04,05 | unit | `pytest tests/test_reels_ken_burns.py -x -q` | ❌ W0 | ⬜ pending |
| 26-02-02 | 02 | 1 | MOTION-01,02,03 | unit | `pytest tests/test_reels_ken_burns.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_reels_ken_burns.py` — xfail stubs for MOTION-01..MOTION-05
- [ ] Existing `tests/conftest.py` — shared fixtures already present

*Existing infrastructure covers fixture needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual KB motion quality | MOTION-01 | FFmpeg zoompan output requires visual inspection | Generate a 5-cena reel with mixed moods, scrub MP4 to verify different motion per scene |
| Economic mode KB applied | MOTION-02 | Needs actual ffmpeg render | Run economic mode job, verify static clips have zoompan in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
