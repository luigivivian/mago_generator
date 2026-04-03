# Codebase Concerns

**Analysis Date:** 2026-04-02

---

## Tech Debt

### Dual `ContentPackage` Models

- Issue: `ContentPackage` exists in two places — `src/pipeline/models_v2.py` (dataclass, in-memory pipeline use) and `src/database/models.py` (ORM, persistence). Pipeline workers import the dataclass version; API routes and video/reels tasks import the ORM version. There is no type-safe bridge between them.
- Files: `src/pipeline/models_v2.py`, `src/database/models.py`, `src/pipeline/workers/generation_layer.py`, `src/pipeline/workers/quality_worker.py`
- Impact: A worker returning `src.pipeline.models_v2.ContentPackage` cannot be passed to code expecting the SQLAlchemy model. Bugs surface silently — wrong attribute names return `None` or raise `AttributeError` at runtime.
- Fix approach: Consolidate to ORM-only, or add a typed converter with validation. At minimum, rename the dataclass to `ContentDraft` to make the split explicit.

### Dual `TrendSource` Enums

- Issue: `TrendSource` is defined in both `src/pipeline/models.py` and `src/pipeline/models_v2.py`. The v2 version extends v1 but both exist. `src/pipeline/models_v2.py` imports `_OldTrendSource` from the original, creating a confusing aliased import chain.
- Files: `src/pipeline/models.py`, `src/pipeline/models_v2.py`
- Impact: Code importing from the wrong module uses an incomplete enum. New sources added to v2 are invisible to v1 callers.
- Fix approach: Delete `src/pipeline/models.py` and migrate all remaining callers to `models_v2`.

### Global Mutable Config Mutation in Pipeline Route

- Issue: `src/api/routes/pipeline.py` (lines 61-65) mutates the global `config.COST_MODE` at runtime to implement per-request cost overrides, then restores it (line 228). Under concurrent requests this is a race condition — Request A sets `COST_MODE = "eco"`, Request B reads it before Request A restores the original.
- Files: `src/api/routes/pipeline.py` (lines 61-65, 228)
- Impact: Incorrect cost mode applied to concurrent pipeline runs. Silent — no error is raised, but LLM tier selection is wrong.
- Fix approach: Pass `cost_mode` explicitly through the call chain. The `AsyncOrchestrator` already accepts it as a constructor argument.

### In-Memory Job State with No Eviction

- Issue: Batch generation jobs (`src/api/routes/jobs.py`, `JOBS: dict`) and character ref generation jobs (`src/api/routes/characters.py`, `_ref_generation_jobs: dict`) track progress in process-local dicts. State is lost on restart. DB persistence in `jobs.py` only happens at job completion (`_persist_job_to_db`), so mid-run progress is invisible after a restart.
- Files: `src/api/routes/jobs.py` (line 21), `src/api/routes/characters.py` (line 107)
- Impact: After server restart, all in-flight or completed-but-unqueried jobs disappear from the API. Users polling status get 404 or stale data. Dicts also grow unboundedly with no eviction — memory leak under sustained usage.
- Fix approach: Write job status to the DB at start and update incrementally. The `BatchJob` table already exists — use it for real-time tracking. Evict completed jobs from the in-memory dict after a TTL.

### Legacy `themes.yaml` Three-Way Theme Lookup

- Issue: `src/api/deps.py:resolver_tema()` performs a cascading lookup across three sources: builtin `SITUACOES` dict, legacy `themes.yaml` file, then database. The YAML format is a remnant of the pre-database era.
- Files: `src/api/deps.py` (lines 95-232, `load_themes_config`, `save_themes_config`, `resolver_tema`, `resolver_tema_batch`)
- Impact: Three code paths that must stay in sync. The YAML file silently overrides DB themes if the key matches. New themes created via the UI (stored in DB) are shadowed by legacy YAML entries with the same key.
- Fix approach: Migrate YAML themes to the database (one-time script), then delete `load_themes_config` and remove the YAML branch from `resolver_tema`.

### `VIDEO_DAILY_BUDGET_USD` Endpoint Coexists with Credit System

- Issue: `GET /generate/video/budget` (`src/api/routes/video.py` lines 1165-1193) still computes and returns `VIDEO_DAILY_BUDGET_USD`. The file header says "CreditService replaces old daily budget" (line 5), but this endpoint returns the old USD-based metric. The `VideoBudgetResponse` model exposes `daily_budget_usd`, which is no longer the enforcement mechanism.
- Files: `src/api/routes/video.py` (lines 1165-1193), `src/api/models.py` (line 282), `src/database/repositories/usage_repo.py` (lines 413, 546)
- Impact: UI consumers of `/budget` see a USD cap that is not enforced. Actual gating is credit-based. Creates confusion about which mechanism is active.
- Fix approach: Rewrite `/budget` to return credit balance, or mark it deprecated and expose `/credits/balance` as the canonical source.

### Legacy `assets/backgrounds/mago/` Directory Fallback

- Issue: `src/api/routes/pipeline.py` (lines 409-413, 749-751) hardcodes a fallback for the `mago-mestre` slug to `assets/backgrounds/mago/`.
- Files: `src/api/routes/pipeline.py` (lines 409-413, 749-751)
- Impact: Low — cosmetic debt. Any future slug rename silently breaks the fallback.
- Fix approach: Remove once confirmed no images exist only in the legacy directory.

---

## Security Considerations

### `GET /drive/images/{filename}` — Unauthenticated Image Serving

- Risk: `src/api/routes/drive.py:get_image()` (line 125) has no `Depends(get_current_user)`. Any caller who knows (or guesses) a filename can download any image from the server without authentication.
- Files: `src/api/routes/drive.py` (lines 124-147)
- Current mitigation: `validate_filename` rejects path traversal. The neighboring list/latest/by-theme and download endpoints all require auth.
- Recommendations: Add `Depends(get_current_user)` to match all neighboring endpoints. If the intent is frontend `<img>` embedding, issue short-lived signed tokens instead.

### Character Slug Is Globally Unique — Enables Slug Enumeration

- Risk: `characters.slug` has a global `UNIQUE` constraint (`src/database/models.py` line 32). Two users cannot create characters with the same slug. `CharacterRepository.get_by_slug()` fetches first, then checks ownership — so the 404 vs 403 difference reveals whether a slug exists to any authenticated user.
- Files: `src/database/models.py` (line 32), `src/database/repositories/character_repo.py` (lines 19-30)
- Current mitigation: 403 is returned instead of character data. Slug contents are not revealed.
- Recommendations: Change the unique constraint to `UniqueConstraint("user_id", "slug")` to enable per-user namespacing and remove slug enumeration risk.

### Content Package Ownership Check Skipped When `character_id` Is Null

- Risk: In `generate_video()` and `retry_video_generation()` (`src/api/routes/video.py` lines 483-491, 1220-1228), ownership is verified by loading the character linked to the package. If `pkg.character_id` is `None`, the check is skipped and any authenticated user can trigger video generation on that package.
- Files: `src/api/routes/video.py` (lines 483-491, 1220-1228)
- Current mitigation: Admin bypass only. Non-admin with null `character_id` package bypasses ownership check.
- Recommendations: Add a direct `user_id` column to `ContentPackage`, or deny video generation for unowned packages.

### Race Condition in Credit Pre-Check vs Background Deduction (TOCTOU)

- Risk: `generate_video()` (lines 507-512) performs a read-only balance check then responds. The actual deduction happens inside the background task. Between the pre-check and deduction, concurrent requests can pass the pre-check using the same balance.
- Files: `src/api/routes/video.py` (lines 507-512), `src/services/credit_service.py` (lines 131-145)
- Current mitigation: `SELECT ... FOR UPDATE` in `check_and_deduct` on MySQL. SQLite falls back to single-writer serialization. On PostgreSQL with `asyncpg`, `with_for_update()` behavior depends on transaction isolation level.
- Recommendations: Move the authoritative deduction into the request handler (before spawning background task) to eliminate the TOCTOU window.

---

## Performance Bottlenecks

### `_list_drive_images()` — Full Filesystem Scan on Every Request

- Problem: `src/api/routes/drive.py:_list_drive_images()` walks the filesystem (including all character background subdirectories) on every call. Used by four endpoints: `/drive/images`, `/drive/images/latest`, `/drive/images/by-theme/{key}`, `/drive/themes`.
- Files: `src/api/routes/drive.py` (lines 49-96)
- Cause: No caching. `Path.glob()` and `stat()` calls are synchronous. The route handlers use `def` (not `async def`), so they run in the default thread pool — but each call still walks the full tree.
- Improvement path: Cache the directory listing with a short TTL (5-10 seconds). Long-term: track images in the DB and query instead of scanning.

### Character List Loads All Rows Then Paginates in Python

- Problem: `api_list_characters()` calls `repo.list_all()` which fetches all non-deleted characters for the user, then applies Python-level slice pagination.
- Files: `src/api/routes/characters.py` (lines 157-182), `src/database/repositories/character_repo.py` (lines 45-55)
- Cause: `list_all` does not accept `limit`/`offset` parameters.
- Improvement path: Add `limit`/`offset` to `CharacterRepository.list_all` and push pagination into the SQL query.

### Ref Generation Worker Blocks Thread with Fixed `time.sleep(10)`

- Problem: `_generate_refs_worker` (`src/api/routes/characters.py` line 673) calls `time.sleep(10)` between each image — blocking the daemon thread for the full batch duration (up to 150 seconds for 15 refs at 10s each).
- Files: `src/api/routes/characters.py` (line 673)
- Cause: Fixed sleep for rate limit avoidance instead of adaptive backoff on actual 429 responses.
- Improvement path: Use adaptive backoff. Convert to an async task so the sleep does not waste a thread.

---

## Fragile Areas

### Thread-Based Background Workers Are Untested and Exception-Swallowing

- Files: `src/api/routes/jobs.py` (lines 4, 167-172), `src/api/routes/characters.py` (lines 8, 712-720)
- Why fragile: Both batch image jobs and character ref generation use `threading.Thread(daemon=True)`. Unhandled exceptions in daemon threads are silently swallowed. `_persist_job_to_db` creates a new event loop from a sync thread (`asyncio.new_event_loop()`) — correct but fragile. Any exception before `_persist_job_to_db` is called leaves the DB job record in `status="running"` permanently.
- Safe modification: Do not add new background work via raw threads. Wrap the full thread body in broad try/except that writes failure status to the DB. Use FastAPI `BackgroundTasks` for new work.
- Test coverage: Zero.

### Stale Job Scanner Uses `created_at` as Proxy for Generation Start Time

- Files: `src/video_gen/stale_job_scanner.py` (line 47)
- Why fragile: Staleness is checked as `ContentPackage.created_at < (now - 15 minutes)`. But `created_at` is the package creation time, not when video generation was triggered. A package created hours ago with video triggered recently will be mis-classified as stale immediately.
- Safe modification: Add a `video_started_at` timestamp column updated when `video_status` transitions to `"generating"`, and use that column in the stale check.
- Test coverage: None.

### `reels.py` — 2,358 Lines in a Single File

- Files: `src/api/routes/reels.py`
- Why fragile: Route handlers, background task implementations, step-state machines, preset definitions, and LLM prompt constants all co-located. `STEP_ORDER` (line 82) and `_init_step_state` (line 104) are tightly coupled to every step handler — a change to step names or order must be applied consistently across all three.
- Safe modification: Read the full file before editing. Use the `STEP_ORDER` list as the canonical step registry and verify every handler uses consistent step names.
- Test coverage: Not verified.

### Pipeline Route Does Not Restore Config on Exception

- Files: `src/api/routes/pipeline.py` (lines 61-65, 227-228)
- Why fragile: The `_cfg.COST_MODE` mutation is restored on line 228, but this is not inside a `finally` block. If an exception propagates between mutation (line 65) and restore (line 228), the global config is permanently set to the request's value for the lifetime of the process.
- Safe modification: Wrap with `try/finally` or, preferably, eliminate the mutation entirely.

---

## Scaling Limits

### Single-Process Background Workers — Not Safe for Horizontal Scaling

- Current capacity: APScheduler (post publishing every 60s, Instagram token refresh every 12h) and the stale job scanner run inside the API process.
- Limit: Running multiple API replicas causes each replica to independently trigger post publishing and stale scanning, resulting in duplicate publishes and duplicate stale marks.
- Scaling path: Move scheduled jobs to a dedicated worker process. Use a DB-level advisory lock or a `is_processing` flag on the scheduled post to prevent concurrent execution across replicas.

---

## Known Bugs

### `video_status="blocked"` — Silent Failure with No User Notification

- Symptoms: When `check_and_deduct` raises `InsufficientCreditsError` inside `_generate_video_task`, the package is set to `video_status="blocked"` but no event or notification is triggered. The user discovers the block only by polling status.
- Files: `src/api/routes/video.py` (lines 219-223)
- Trigger: User passes the pre-check (balance barely sufficient) but a concurrent request depletes the balance before the background task runs.
- Workaround: User must manually poll `/generate/video/{id}/status`.

### TikTok Publishing Raises `NotImplementedError` Silently

- Symptoms: Scheduling a post to TikTok calls `_publish_tiktok` which raises `NotImplementedError`. The scheduler catches it as a generic failure and retries with exponential backoff until max retries, then marks the post permanently failed. The user is never told the platform is unimplemented.
- Files: `src/services/publisher.py` (lines 282-287)
- Trigger: Creating a scheduled post with `platform="tiktok"`.
- Workaround: None. Post retries indefinitely then fails.

### `/dashboard/pipeline-activity` Leaks Legacy Runs Across Tenants

- Symptoms: The query in `src/api/routes/dashboard.py` (lines 79-95) includes `PipelineRun.character_id IS NULL` runs for all users via an `OR` clause. Legacy runs with no character are shown to every authenticated user, not scoped to the requesting user.
- Files: `src/api/routes/dashboard.py` (lines 79-95)
- Trigger: Any user loading the pipeline activity dashboard chart.
- Workaround: None currently. Admin-level data leaks to regular users.

---

## Missing Critical Features

### No Per-User Slug Namespace

- Problem: Character slugs are globally unique, preventing two users from creating characters with the same name. Fixing this requires a schema migration to change the unique constraint to `(user_id, slug)`.
- Blocks: Multi-tenant self-serve use.

### No Credit Provisioning on User Registration

- Problem: New users start with `balance=0`. No registration hook seeds initial credits. Users cannot use video generation until an admin manually calls `POST /credits/admin/top-up`.
- Files: `src/auth/service.py` (register method), `src/services/credit_service.py`
- Blocks: Self-serve onboarding.

### Best Posting Times Are Hardcoded Static Data

- Problem: `GET /publishing/best-times` returns a hardcoded dict (lines 217-232 in `src/api/routes/publishing.py`). A TODO comment marks integration with Instagram Insights.
- Files: `src/api/routes/publishing.py` (lines 217-232)
- Blocks: Accurate personalized posting recommendations.

---

## Test Coverage Gaps

### Thread-Based Background Workers

- What's not tested: `_run_batch_job` (`src/api/routes/jobs.py`), `_generate_refs_worker` (`src/api/routes/characters.py`), `_persist_job_to_db` (`src/api/routes/jobs.py`).
- Risk: Race conditions, DB persistence failures, and silent error swallowing go undetected.
- Priority: High

### Credit System Race Conditions

- What's not tested: Concurrent `check_and_deduct` calls for the same user, pre-check/deduction TOCTOU in `generate_video`, refund correctness on background error.
- Files: `src/services/credit_service.py`, `src/api/routes/video.py`
- Risk: Users overdraft credits under concurrent load.
- Priority: High

### Unauthenticated Image Endpoint

- What's not tested: Whether `GET /drive/images/{filename}` correctly requires authentication. It does not — no auth dependency is present.
- Files: `src/api/routes/drive.py` (line 125)
- Priority: High

### Stale Scanner Decision Branches

- What's not tested: `scan_stale_jobs` logic paths — active task skip, succeeded recovery, failed propagation, no task_id handling.
- Files: `src/video_gen/stale_job_scanner.py`
- Risk: Stale detection silently mis-classifies active jobs as failed.
- Priority: Medium

### Global Config Mutation Under Concurrency

- What's not tested: Concurrent `POST /pipeline/run` requests with different `cost_mode` values. A test would expose the race condition.
- Files: `src/api/routes/pipeline.py` (lines 61-65)
- Priority: Medium

---

*Concerns audit: 2026-04-02*
