# Phase 23 — Deferred Items

Pre-existing failures discovered during Plan 23-01 execution. NONE caused by Phase 23 work — all are pre-existing test-suite breakage in unrelated modules.

## Pre-existing collection error

- `tests/test_agents_quick.py` — `ModuleNotFoundError: No module named 'src.pipeline.agents.hackernews'`
  - Cause: missing module; predates Phase 23
  - Workaround: tests run with `--ignore=tests/test_agents_quick.py`

## Pre-existing test failures

Verified by removing `tests/test_reels_timing.py` and re-running — failures persist:

- `tests/test_credit_service.py` — 4 failures (assert mismatches in balance/refund logic)
- `tests/test_credits.py` — 2 failures (compute_cost_brl assertions)
- `tests/test_video_prompt_builder.py` — 5 failures (system/enhance prompt v2 sections)

Total: 16 pre-existing failures (228 passed, 7 xfailed from our new file).

These are out of scope for Phase 23 (audio-anchored timing propagation). Track separately if/when they become relevant to a future phase.
