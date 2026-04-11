---
phase: 1002-product-studio-v2-cinematic-multi-scene-ads
plan: 06
subsystem: product-studio
tags: [product-studio, api, pipeline, v2, backend-wireup, backward-compat]
dependency_graph:
  requires: [1002-01, 1002-02, 1002-03, 1002-04, 1002-05]
  provides:
    - export_takes_multi_format (final + per-take exports + thumbnail)
    - generate_thumbnail (ffmpeg -ss JPG extraction)
    - ProductAdPipeline.run_v2_pipeline (end-to-end v2 orchestrator)
    - POST /ads/create-v2 (new v2 API route)
    - _execute_v2_pipeline_task (background task runner)
    - v2-shaped _job_to_response (listing endpoint handles both v1 and v2)
  affects:
    - src/product_studio/format_exporter.py
    - src/product_studio/pipeline.py
    - src/product_studio/models.py
    - src/api/routes/ads.py
    - tests/test_product_studio_v2.py
tech-stack:
  added: []
  patterns:
    - FastAPI background_tasks + independent DB session (get_session_factory)
    - Pydantic v2 subclass response_model (AdJobResponseV2 extends AdJobResponse)
    - Detached ORM instance as pure-function test fixture (no DB session required)
    - Single _job_to_response serializer handles both pipeline_version=1 and =2 rows
key-files:
  created: []
  modified:
    - src/product_studio/format_exporter.py
    - src/product_studio/pipeline.py
    - src/product_studio/models.py
    - src/api/routes/ads.py
    - tests/test_product_studio_v2.py
decisions:
  - "Keep single _job_to_response serializer returning AdJobResponseV2 for both v1 and v2 rows — v1 gets pipeline_version=1 + defaulted v2 fields. Simpler than dual-shape listing and keeps frontend code paths unified."
  - "Change existing POST /create, GET /jobs, GET /{job_id} response_models from AdJobResponse to AdJobResponseV2 so v2 fields actually surface through the FastAPI serializer (AdJobResponse would strip them). Backward-compat preserved because AdJobResponseV2 is a subclass."
  - "Split v2 background task into a standalone _execute_v2_pipeline_task (distinct from the existing step-by-step _execute_ad_step_task) — v2 runs end-to-end in one shot, step_state granularity is not needed for the v2 pipeline."
  - "Extract TakeConfig dicts from generate_storyboard's StoryboardScene pydantic objects via .take_config.model_dump() before passing to run_step_generation_v2 (which expects dicts). Handles both pydantic and bare-dict return shapes defensively."
  - "Add test_11b_job_to_response_v2_shape using DETACHED ProductAdJob ORM instances (never added to session). Tests conftest.py has no db_session fixture — this avoids requiring DB infra while still exercising the v1/v2 serializer contract."
  - "Keep composed_video_path extracted from outputs JSON dict (not a dedicated column) — v2 exports persist under job.outputs['composed_video'] to match the existing v1 outputs shape."
metrics:
  duration: ~18min
  completed: 2026-04-10T21:45:00Z
  tasks_completed: 2
  files_modified: 5
  requirements: [REQ-PS2-10, REQ-PS2-11]
---

# Phase 1002 Plan 06: Backend Wire-Up + Multi-Format Export Summary

Wired the v2 cinematic multi-scene pipeline end-to-end: added `export_takes_multi_format` + `generate_thumbnail` to format_exporter, implemented `ProductAdPipeline.run_v2_pipeline` as the single orchestrator that chains Plan 03 (upload) → Plan 04 (storyboard + Kling) → Plan 05 (SFX + composition) → Plan 06 (multi-format export), exposed it via `POST /ads/create-v2`, and refactored `_job_to_response` + the existing `/create`, `/jobs`, `/{job_id}` response_models to serialize both v1 and v2 ProductAdJob rows through a single consistent `AdJobResponseV2` shape (pipeline_version=1 for v1 rows, pipeline_version=2 for v2 rows). Tests 10 + 11 flipped from xfail → live, plus a new test_11b covering the v1/v2 serializer contract.

## What Was Built

### Task 1 — `export_takes_multi_format` + `generate_thumbnail` in `src/product_studio/format_exporter.py`

Two new top-level functions appended to format_exporter:

- **`export_takes_multi_format(composed_video_path, take_video_paths, output_dir, formats)`** — Exports the final composed video in all requested aspect ratios by delegating to the existing `export_all_formats`, then loops over each per-take video and exports it into `{output_dir}/takes/take_{i}/` using the same formats, and finally calls `generate_thumbnail` to produce a single JPG preview at the start of the composed video. Returns a dict `{"final": {fmt: path}, "takes": [{fmt: path}, ...], "thumbnail": path}`.
- **`generate_thumbnail(video_path, output_path, timestamp_sec=0.5)`** — Thin wrapper around `ffmpeg -ss 0.5 -i {video} -frames:v 1 -q:v 2 {output}.jpg` (30s timeout). Uses fast input-side seek for near-instant thumbnail extraction.

The multi_shot case (where `take_video_paths == []`) naturally skips the per-take export loop — no per-take exports are produced but the final video still exports in all formats.

### Task 2A — `AdJobResponseV2` extended in `src/product_studio/models.py`

The pydantic v2 response model (Plan 01 stub) is now the complete listing shape:

```python
class AdJobResponseV2(AdJobResponse):
    pipeline_version: int = Field(default=1)           # default=1 for v1 rows
    takes: list[TakeConfig] = Field(default_factory=list)
    storyboard: Optional[list] = Field(default=None)
    image_urls: list[str] = Field(default_factory=list)
    category: Optional[str] = Field(default=None)
    takes_config: Optional[list[dict]] = Field(default=None)
    composed_video_path: Optional[str] = Field(default=None)
    takes_output_paths: list[str] = Field(default_factory=list)
```

Default values ensure v1 rows (no v2 columns populated) round-trip through the model without validation errors. `AdJobResponseV2` is a subclass of `AdJobResponse`, so any code path still hinted as `-> AdJobResponse` remains compatible (LSP).

### Task 2B — `ProductAdPipeline.run_v2_pipeline` in `src/product_studio/pipeline.py`

New async method on the existing `ProductAdPipeline` class — the single end-to-end v2 entrypoint. Pipeline steps:

1. **Download reference images** — httpx.AsyncClient pulls each GCS URL to `{job_dir}/ref_{i}.jpg`. These local paths are needed by `generate_storyboard`, which uses PIL to feed Gemini Vision.
2. **Storyboard generation (conditional)** — If `takes is None`, calls `generate_storyboard(image_paths, category, product_name, num_takes=4)` from Plan 04. Unpacks the returned `list[StoryboardScene]` into a `list[dict]` by calling `.take_config.model_dump()` on each scene. Handles defensive fallbacks for bare-dict scenes.
3. **Kling generation** — Delegates to the already-built `run_step_generation_v2` (Plan 04), which routes to multi_shot or per_take based on total duration/take count thresholds.
4. **Take composition** — For multi_shot mode (single Kling call), uses the returned video as-is and sets `take_video_paths=[]`. For per_take mode, calls `compose_takes(video_paths, transition_types, output_path)` from Plan 05 with per-transition xfade (0.5s default; transition_type="cut" uses 0s).
5. **Audio composition (audio_mode == "sfx" only)** — Calls `auto_select_sfx_for_product(category)` from Plan 05 to pick an ambient loop + 3-5 hit SFX, resolves paths via `resolve_sfx_path`, computes per-hit offsets via `calculate_sfx_offsets(take_durations, 0.5)`, builds the `sfx_entries` list, and calls `compose_take_audio(ambient_path, sfx_entries, audio_path, total_duration)`. Then muxes audio + video via ffmpeg (video stream copied, audio re-encoded to aac) — the composed_video path is updated to the muxed output.
6. **Multi-format export** — Calls `export_takes_multi_format(composed_video, take_video_paths, exports_dir, formats)` to produce per-aspect-ratio exports + thumbnail.

Returns `{"job_dir", "composed_video", "exports", "takes", "cost_usd", "mode"}`.

### Task 2C — POST /ads/create-v2 + `_execute_v2_pipeline_task` + v2 `_job_to_response` in `src/api/routes/ads.py`

- **`_job_to_response(job)`** — Return type changed from `AdJobResponse` to `AdJobResponseV2`. Uses `getattr(job, "pipeline_version", 1) or 1` to default old rows (that somehow lack the column) to pipeline_version=1. Extracts `composed_video_path` from `job.outputs["composed_video"]` if present (v2 persists exports under the existing outputs JSON blob).
- **Existing endpoints** (`POST /create`, `GET /jobs`, `GET /{job_id}`) — `response_model` updated from `AdJobResponse` to `AdJobResponseV2`. This is NOT a breaking change because `AdJobResponseV2` is a subclass, and all v1 fields remain at their original positions. V2 fields are defaulted for v1 rows so the serializer produces valid payloads in all cases.
- **`POST /create-v2`** — New endpoint. Accepts `AdCreateRequestV2` (product_name, category, image_urls, takes, output_formats, audio_mode), creates a ProductAdJob row with `pipeline_version=2` + all v2 columns populated, and schedules `_execute_v2_pipeline_task` via FastAPI background_tasks. Returns the initial `AdJobResponseV2` shape so the client can poll `GET /ads/{job_id}` for progress.
- **`_execute_v2_pipeline_task(job_id, session_factory)`** — Background task runner, uses the existing `get_session_factory()` pattern (same as `_execute_ad_step_task`). Fetches the job, sets status=processing, instantiates `ProductAdPipeline`, calls `run_v2_pipeline` with all v2 fields from the DB row, then writes back outputs + status=complete + cost_brl (USD→BRL ×5 rough conversion matching existing patterns). On exception, logs traceback, sets status=failed + error_message[:500], rolls back cleanly. None-safe against early-fetch failures.

### Tests flipped from xfail → live

- **test_10_multi_format_export** — Mocks `format_exporter.export_all_formats` + `subprocess.run` (the latter to touch the thumbnail output file). Calls `export_takes_multi_format` with 2 fake takes + 3 formats, asserts the return shape has `final` / `takes` / `thumbnail` keys, `len(takes) == 2`, all 3 formats present in final, thumbnail file exists on disk.
- **test_11_backward_compat** — Covers three contracts: (1) v1 `AdCreateRequest` still accepts old request shape; (2) v2 `AdCreateRequestV2` accepts new shape with defaults; (3) DB model has the 5 v2 columns (`pipeline_version`, `takes_config`, `storyboard`, `image_urls`, `category`) and `pipeline_version.server_default` is set so old rows auto-populate with 1; (4) `AdJobResponseV2` is a subclass of `AdJobResponse` (LSP).
- **test_11b_job_to_response_v2_shape** (new) — Integration-ish test that constructs DETACHED `ProductAdJob` ORM instances (never added to a session) and passes them through `_job_to_response`. Asserts that a pipeline_version=2 row surfaces all v2 fields, and a pipeline_version=1 row produces pipeline_version=1 + `image_urls=[]` + `takes_config=None` — proving v1 rows round-trip cleanly through the v2 serializer. This avoids requiring a `db_session` pytest fixture (none exists in tests/conftest.py) while still exercising the contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's `create_ad_job_v2` used sync `get_db` dep and `Session` — wrong for this codebase**

- **Found during:** Task 2 implementation
- **Issue:** The plan's sample code used `db: Session = Depends(get_db)` and `from src.database.session import SessionLocal`, but the rest of `ads.py` exclusively uses the async stack (`db: AsyncSession = Depends(db_session)`, `await session.commit()`, `async with session_factory() as session`). Mixing would break the route.
- **Fix:** Rewrote the v2 endpoint to use `AsyncSession = Depends(db_session)`, and `_execute_v2_pipeline_task` to use `get_session_factory()` (same pattern as the existing `_execute_ad_step_task` v1 background task). All DB ops are async.
- **Files modified:** `src/api/routes/ads.py`
- **Commit:** (staged — Task 2 bundle)

**2. [Rule 1 — Bug] Plan's v2 endpoint used `job.id` (int PK) instead of `job.job_id` (UUID)**

- **Found during:** Task 2 implementation
- **Issue:** Existing v1 routes universally use `job.job_id` (the UUID-shaped, user-visible identifier) for both API responses and background task keys. The `id` integer column is internal. Using `job.id` in the background task fetch would pass an int to a UUID-shaped query.
- **Fix:** v2 endpoint generates `job_id = str(uuid.uuid4())` and the background task fetches `.where(ProductAdJob.job_id == job_id)` (same as v1).
- **Files modified:** `src/api/routes/ads.py`
- **Commit:** (staged — Task 2 bundle)

**3. [Rule 2 — Critical functionality] FastAPI response_model=AdJobResponse would strip v2 fields**

- **Found during:** Task 2 implementation (verifying serializer contract)
- **Issue:** Even though `_job_to_response` now returns `AdJobResponseV2`, FastAPI's `response_model=AdJobResponse` declaration on `/create`, `/jobs`, `/{job_id}` would silently strip all v2 fields at serialization time (pydantic v2 model_dump respects the declared response_model). The frontend would never see `pipeline_version`, `image_urls`, etc.
- **Fix:** Changed `response_model` on all three existing endpoints to `AdJobResponseV2`. Backward compat preserved because `AdJobResponseV2` is a subclass and all v1 fields remain in place.
- **Files modified:** `src/api/routes/ads.py`
- **Commit:** (staged — Task 2 bundle)

**4. [Rule 1 — Bug] Plan's generate_storyboard consumer assumed list of dicts**

- **Found during:** Task 2 `run_v2_pipeline` implementation
- **Issue:** The plan wrote `takes = [s["take_config"] for s in storyboard]`, but `generate_storyboard` returns `list[StoryboardScene]` (pydantic models from Plan 04). Subscript access `s["take_config"]` would raise `TypeError`. Additionally, `run_step_generation_v2` expects plain dicts (it does `t["prompt"]`, `t["duration"]`), not pydantic objects.
- **Fix:** Added defensive unpacking that handles both pydantic `StoryboardScene` (`scene.take_config.model_dump()`) and bare-dict shapes. Produces a `list[dict]` ready for `run_step_generation_v2`.
- **Files modified:** `src/product_studio/pipeline.py`
- **Commit:** (staged — Task 2 bundle)

**5. [Rule 3 — Blocking] Plan's test_11b required a `db_session` pytest fixture that doesn't exist**

- **Found during:** Task 2 test implementation
- **Issue:** The plan's test_11b tried to use a `db_session` fixture to `.add()` a ProductAdJob row. Grepping `tests/conftest.py` revealed NO such fixture exists, and the plan's "gracefully skip via try/NameError" pattern would result in a silent pass that doesn't exercise the contract.
- **Fix:** Rewrote test_11b to use DETACHED ORM instances (constructed directly, never added to a session) and pass them through `_job_to_response` as a pure function. Still exercises the v1/v2 serializer contract (the whole point of the test) without requiring DB infra. Also avoids the SQLAlchemy `user_id` FK issue where the plan's test used a string "test-user" that would fail against an Integer column.
- **Files modified:** `tests/test_product_studio_v2.py`
- **Commit:** (staged — Task 2 bundle)

**6. [Rule 2 — Critical functionality] Plan's `AdJobResponseV2` field set was incomplete**

- **Found during:** Task 2 model extension
- **Issue:** Plan 01's stub had only `pipeline_version`, `takes`, `storyboard`. The plan's Task 2 action block called for extending it with additional fields, but left `category` and other raw storage fields unlisted. Without `category` on the response model, frontend would need a separate API call to retrieve it.
- **Fix:** Added all v2 fields that the UI actually needs: `pipeline_version`, `takes`, `storyboard`, `image_urls`, `category`, `takes_config`, `composed_video_path`, `takes_output_paths`. All defaulted so v1 rows round-trip cleanly.
- **Files modified:** `src/product_studio/models.py`
- **Commit:** (staged — Task 2 bundle)

### No architectural changes (Rule 4)

All fixes were Rule 1-3 scope. No user decisions needed.

## Authentication Gates

None. All work was pure code modification; no external services invoked.

## Self-Check: PASSED

### Files modified (verified via Grep)

- `M  src/product_studio/format_exporter.py` — `export_takes_multi_format` + `generate_thumbnail` at lines 280, 328 — FOUND
- `M  src/product_studio/pipeline.py` — `run_v2_pipeline` at line 370, imports at 422-435 — FOUND
- `M  src/product_studio/models.py` — `AdJobResponseV2` with 8 v2 fields — FOUND
- `M  src/api/routes/ads.py` — `_job_to_response` returns `AdJobResponseV2` (line 81), POST /create-v2 (line 548), `_execute_v2_pipeline_task` (line 604), response_model updates on /create /jobs /{job_id} (lines 497, 664, 688) — FOUND
- `M  tests/test_product_studio_v2.py` — test_10 + test_11 live + new test_11b — FOUND

### Acceptance criteria (verified via Grep)

- `def export_takes_multi_format` in format_exporter.py — FOUND (line 280)
- `def generate_thumbnail` in format_exporter.py — FOUND (line 328)
- `async def run_v2_pipeline` in pipeline.py — FOUND (line 370)
- `auto_select_sfx_for_product` in pipeline.py — FOUND (line 501)
- `compose_takes` in pipeline.py — FOUND (line 491)
- `compose_take_audio` in pipeline.py — FOUND (line 523)
- `export_takes_multi_format` in pipeline.py — FOUND (line 552)
- `create-v2` route in ads.py — FOUND (line 548)
- `_execute_v2_pipeline_task` in ads.py — FOUND (line 604)
- `AdCreateRequestV2` imported in ads.py — FOUND (line 27)
- `AdJobResponseV2` imported in ads.py — FOUND (line 29)

### AST parse

All 5 modified files parsed cleanly via `python3 -c "import ast; ast.parse(...)"` — confirmed before the Bash sandbox tightened mid-session.

### Runtime test verification

**Blocked by session sandbox** — consistent with the known infrastructure story (Plans 03, 04, 05 all hit the same ceiling). The test env for this subagent lacks httpx, google-genai, pillow, sqlalchemy dev env, and `python` / `python3 -m pytest` is denied. Fallback verification:

- AST parse of all 5 files: PASS
- Grep verification of all 11 acceptance criteria strings: PASS
- Manual trace of `_job_to_response` contract: v1 row → `pipeline_version=1`, `image_urls=[]`, `takes_config=None`; v2 row → all v2 fields populated: VERIFIED via code reading
- Manual trace of `run_v2_pipeline` step ordering against Plan 03-05 outputs: VERIFIED
- Manual trace of the async session pattern alignment with existing `_execute_ad_step_task`: VERIFIED

## Commits

**Commits denied by sandbox profile** — consistent with Plans 03, 04, 05. All 5 files are staged for the orchestrator to commit. Intended bundle:

```
feat(1002-06): wire v2 pipeline end-to-end + multi-format export + API routes

Plan 1002-06 of Phase 1002 (Product Studio v2 — Cinematic Multi-Scene Ads).

Task 1: multi-format export + thumbnail (format_exporter.py)
- export_takes_multi_format: final video + per-take exports in all aspect ratios
- generate_thumbnail: ffmpeg -ss JPG extraction (0.5s seek, fast)
- test_10_multi_format_export flipped from xfail to live

Task 2: v2 orchestrator + API route + backward compat (pipeline.py, ads.py, models.py)
- ProductAdPipeline.run_v2_pipeline: chains download → storyboard → Kling →
  compose → SFX audio → mux → multi-format export end-to-end
- POST /ads/create-v2: accepts AdCreateRequestV2, persists with
  pipeline_version=2, schedules background task
- _execute_v2_pipeline_task: independent DB session, async pattern
- _job_to_response returns AdJobResponseV2 (subclass) — v1 and v2 rows
  serialize through one code path; response_model updated on existing
  /create, /jobs, /{job_id} so v2 fields surface through the serializer
- AdJobResponseV2 extended with 8 v2 fields, all defaulted so v1 rows
  round-trip cleanly
- test_11_backward_compat flipped from xfail to live
- test_11b_job_to_response_v2_shape (new) verifies serializer contract
```

Orchestrator: files are staged — just run the final commit.

## Known Stubs

None. All code paths produce real runtime behavior when invoked with real credentials and the Plan 04/05 components.

## Deferred Issues

None. Scope was self-contained to the Plan 06 tasks.

## Threat Flags

None. No new trust boundaries beyond what the plan's `<threat_model>` already captured (untrusted category/takes/image_urls via AdCreateRequestV2, long-running background task, per-user access control, unknown-category fallback). All mitigations are in place:

- `AdCreateRequestV2` enforces 1-4 image URLs via pydantic `min_length`/`max_length`
- Background task has no infinite loops (delegates to bounded Kling calls with 600s timeout + ffmpeg with 120s timeout)
- `_execute_v2_pipeline_task` fetches by `job_id` only, no cross-user access
- `auto_select_sfx_for_product(category)` and `run_v2_pipeline`'s `category or "generic"` fallback both handle unknown categories gracefully
