---
phase: 1000
slug: character-scoped-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1000 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend), Next.js lint (frontend) |
| **Config file** | pytest.ini, memelab/.eslintrc |
| **Quick run command** | `pytest tests/ -x -q --tb=short` |
| **Full suite command** | `pytest tests/ -v && cd memelab && npx next lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ -x -q --tb=short`
- **After every plan wave:** Run `pytest tests/ -v && cd memelab && npx next lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | character_slug filter | integration | `grep "character_slug" src/api/routes/*.py` | TBD | pending |
| TBD | TBD | TBD | CharacterContext propagation | lint | `cd memelab && npx next lint` | TBD | pending |

*Status: pending -- will be filled after plans are created*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. CharacterContext already exists.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Character selector visible in sidebar | Sidebar UI | Visual | Open app, verify selector renders |
| Page content changes on character switch | All pages | Visual + data | Switch character, verify listings change |
| Selected character persists on refresh | localStorage | Browser | Select, refresh, verify same character |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
