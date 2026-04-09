# Phase 22 — Deferred Items

Pre-existing test failures observed during 22-04 execution. None caused by Phase 22 changes; all confirmed via `git stash` baseline check. Out of scope for this phase.

## Test Collection Errors

- `tests/test_agents_quick.py` — `ModuleNotFoundError: No module named 'src.pipeline.agents.hackernews'`. Import path drifted from a deleted/renamed module.

## Test Failures (pre-existing baseline)

### tests/test_credit_service.py (4 failures)
- `test_check_and_deduct_sufficient_balance`
- `test_check_and_deduct_insufficient_balance`
- `test_refund_adds_credits_back`
- `test_compute_credit_cost_delegates_to_config`

### tests/test_credits.py (2 failures)
- `test_compute_cost_brl_from_config`
- `test_compute_cost_brl_closest_duration`

### tests/test_video_prompt_builder.py (3 failures)
- `test_system_prompt_v2_sections`
- `test_system_prompt_v2_present_continuous_rule`
- `test_enhance_prompt_v2_sections`

### tests/test_atomic_counter.py (5 failures)
- `test_check_limit_at_limit`
- `test_check_limit_rejected_row`
- `test_unlimited_when_zero`
- `test_rejection_response_format`
- `test_limit_enforcement_exactly_at_boundary`

### Misc (2 more failures observed in full suite, also pre-existing)
- See `pytest tests/ --ignore=tests/test_bible_e2e.py --ignore=tests/test_agents_quick.py` for full list.

## Verification

Confirmed via:
```bash
git stash
pytest tests/test_credits.py tests/test_credit_service.py tests/test_video_prompt_builder.py tests/test_atomic_counter.py -q --tb=no
git stash pop
```
Same failures appear with Phase 22-04 changes reverted. These are unrelated to per-cena TTS work and should be addressed in a separate cleanup phase.
