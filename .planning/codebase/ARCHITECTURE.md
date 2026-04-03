# Architecture

**Analysis Date:** 2026-04-02

## Pattern Overview

**Overall:** Layered monolith with domain-organized routes, service layer, repository pattern, and async SQLAlchemy ORM. Frontend is a Next.js proxy shell — all data fetching goes through `/api/*` rewrites to the FastAPI backend at `localhost:8000`.

**Key Characteristics:**
- FastAPI backend at `src/` with 16 route modules registered in `src/api/app.py`
- Next.js 15 (App Router) frontend at `memelab/` — zero backend logic, pure proxy
- Multi-tenant: all entities scoped to `user_id` via `Character.user_id` FK + `get_current_user` dep
- Credit system gates all Kie.ai API calls (`CreditService.check_and_deduct` before every video/reel/ad job)
- Two distinct async job patterns: fire-and-poll (video gen via `BackgroundTasks`) and interactive stepper (reels, ads via `step_state` JSON column)

---

## Domain Boundary Map

| Domain | Routes file | DB Models | Services / Pipelines | Frontend page | Key patterns |
|--------|-------------|-----------|----------------------|---------------|-------------|
| **Characters** | `src/api/routes/characters.py` | `Character`, `CharacterRef` | `src/database/repositories/character_repo.py` | `memelab/src/app/(app)/characters/` | CRUD + AI DNA generation via Gemini LLM; refs have `pending/approved/rejected` lifecycle |
| **Gallery** | `src/api/routes/drive.py`, `generation.py` | `GeneratedImage`, `ContentPackage`, `BatchJob` | `src/services/key_selector.py`, `src/image_gen/gemini_client.py` | `memelab/src/app/(app)/gallery/` | Filesystem-based storage in `output/backgrounds_generated/`; Drive browser lists PNGs by filename pattern |
| **Videos** | `src/api/routes/video.py` | `ContentPackage` (video columns) | `src/video_gen/kie_client.py`, `src/video_gen/video_prompt_builder.py`, `src/video_gen/stale_job_scanner.py` | `memelab/src/app/(app)/videos/` | Opt-in per `content_package_id`; async poll via `GET /generate/video/status/{id}`; credit-gated |
| **Reels** | `src/api/routes/reels.py` | `ReelsJob`, `ReelsConfig`, `SceneAsset` | `src/reels_pipeline/main.py`, `src/reels_pipeline/{script_gen,image_gen,tts,transcriber,video_builder}.py` | `memelab/src/app/(app)/reels/` | 7-step interactive pipeline (`step_state` JSON); steps: prompt→script→tts→srt→images→clips→video |
| **Ads (Product Studio)** | `src/api/routes/ads.py` | `ProductAdJob` | `src/product_studio/pipeline.py`, `src/product_studio/{scene_composer,copy_generator,music_client,bg_remover,format_exporter}.py` | `memelab/src/app/(app)/ads/` | 8-step interactive pipeline (`step_state` JSON); steps: analysis→scene→prompt→video→copy→audio→assembly→export |
| **Credit System** | `src/api/routes/credits.py` | `UserCredit`, `CreditLog` | `src/services/credit_service.py` | `memelab/src/app/(app)/credits/` | Pre-deduct before Kie.ai call; refund on failure; admin top-up; audit log per operation |
| **Dashboard** | `src/api/routes/dashboard.py` | `PipelineRun`, `ScheduledPost`, `ApiUsage` | `src/database/repositories/usage_repo.py` | `memelab/src/app/(app)/dashboard/` | 5 read-only aggregate endpoints; tenant-scoped via Character join |
| **Auth** | `src/api/routes/auth.py` | `User`, `RefreshToken` | `src/auth/service.py`, `src/auth/jwt.py` | `memelab/src/app/login/`, `memelab/src/app/register/` | JWT (HS256, 2h access / 30d refresh); bcrypt passwords; refresh token hashed SHA-256 in DB |
| **Billing** | `src/api/routes/billing.py` | `User` (plan/stripe columns) | `src/services/stripe_billing.py`, `src/billing/stripe_service.py` | `memelab/src/app/(app)/billing/` | Stripe Checkout + webhook; plan tiers gating usage limits |
| **Pipeline** | `src/api/routes/pipeline.py` | `PipelineRun`, `TrendEvent`, `WorkOrder`, `ContentPackage`, `AgentStat` | `src/pipeline/orchestrator.py`, `src/pipeline/async_orchestrator.py` | `memelab/src/app/(app)/pipeline/` | Multi-agent: trends→broker→curator→generation→post-prod; async orchestrator with `BackgroundTasks` |
| **Themes** | `src/api/routes/themes.py` | `Theme`, `EnhanceThemeCache` | `src/database/repositories/theme_repo.py` | `memelab/src/app/(app)/themes/` | Per-character themes; AI enhancement with caching (`EnhanceThemeCache`) |
| **Publishing** | `src/api/routes/publishing.py` | `ScheduledPost` | `src/services/publisher.py`, `src/services/scheduler_worker.py` | `memelab/src/app/(app)/publishing/` | Scheduler polls every 60s; Instagram Graph API posting |

---

## Layers

**Routes Layer:**
- Purpose: HTTP request parsing, auth injection, response serialization
- Location: `src/api/routes/`
- Contains: FastAPI `APIRouter` instances; one file per domain
- Depends on: Services, Repositories, ORM models, `src/api/deps.py`
- Used by: FastAPI app registered in `src/api/app.py`

**Service Layer:**
- Purpose: Business logic that crosses models or calls external APIs
- Location: `src/services/`, `src/auth/service.py`, `src/billing/`
- Key services:
  - `src/services/credit_service.py` — `CreditService`: atomic balance check+deduct+refund
  - `src/auth/service.py` — `AuthService`: register/login/refresh/logout
  - `src/services/key_selector.py` — `UsageAwareKeySelector`: dual free/paid Gemini key rotation
  - `src/services/publisher.py` — Instagram posting with retry
  - `src/services/scheduler_worker.py` — background thread polling DB for due posts

**Pipeline Layer:**
- Purpose: Domain-specific multi-step async orchestration
- Location: `src/reels_pipeline/`, `src/product_studio/`, `src/pipeline/`
- Depends on: `src/video_gen/kie_client.py`, Gemini API, FFmpeg, rembg

**Repository Layer:**
- Purpose: Database access, query construction
- Location: `src/database/repositories/`
- Contains: Typed async repo classes wrapping `AsyncSession`
- Key repos: `character_repo.py`, `usage_repo.py`, `job_repo.py`, `user_repo.py`

**ORM Layer:**
- Purpose: Schema definition and relationships
- Location: `src/database/models.py` (19 tables in one file, ~900 lines)
- Base: `src/database/base.py` (`DeclarativeBase` + `TimestampMixin`)
- Migrations: `src/database/migrations/versions/` (027 migrations as of 2026-04-02)

**Frontend Layer:**
- Purpose: UI only — no backend logic, all data via SWR + `memelab/src/lib/api.ts`
- Location: `memelab/src/`
- Depends on: FastAPI backend via Next.js rewrites (`/api/*` → `http://127.0.0.1:8000/*`)

---

## Data Flow

**Standard API request (authenticated):**
1. Browser `fetch("/api/some/endpoint", { headers: { Authorization: "Bearer <token>" } })`
2. Next.js rewrite → `http://127.0.0.1:8000/some/endpoint`
3. FastAPI route handler extracts JWT via `get_current_user` dependency (`src/api/deps.py`)
4. `verify_access_token` → `UserRepository.get_by_id` → returns `User` ORM object
5. Route calls repository or service with `AsyncSession` from `db_session` dependency
6. Repository executes async SQLAlchemy query, returns ORM object(s)
7. Route serializes to dict/Pydantic model → JSON response

**Video generation (credit-gated):**
1. `POST /generate/video/generate` with `content_package_id`, `model`, `duration`
2. Route calls `CreditService.check_and_deduct(user_id, model_id, duration, "video", job_id)`
3. If balance >= cost: deduct atomically (SELECT FOR UPDATE on `user_credits`), log to `credit_logs`
4. `BackgroundTasks.add_task(_generate_video_task, ...)` — returns `202` immediately
5. Background: `KieSora2Client.generate(image_url, prompt, model, duration)` → polls Kie.ai every 5-30s
6. On success: update `ContentPackage.video_path`, `video_status = "success"`
7. On failure: `CreditService.refund(...)` restores balance
8. Frontend polls `GET /generate/video/status/{content_package_id}` every 3s via `useVideoProgress`

**Reels interactive pipeline:**
1. `POST /reels/interactive` creates `ReelsJob` with `step_state = {all steps: "pending"}`
2. Frontend `POST /reels/{job_id}/step/{step_name}/approve` triggers each step sequentially
3. Each step: backend runs `ReelsPipeline.run_step_*()`, saves artifacts to `ReelsJob`, updates `step_state`
4. Frontend displays step-specific UI component (e.g., `step-script.tsx`, `step-clips.tsx`)
5. User reviews/edits artifacts at each step before approving — next step begins
6. Final step produces MP4, stored on filesystem, path saved to `ReelsJob.video_path`

**Auth flow:**
1. `POST /auth/login` → `AuthService.login` → bcrypt verify → issue JWT + random refresh token
2. Refresh token hashed SHA-256, stored in `refresh_tokens` table with `expires_at`
3. Frontend stores tokens in `localStorage` (persist) or `sessionStorage` (session-only)
4. `AuthContext` hydrates on mount via `GET /auth/me` — validates token, sets user state
5. On 401 from any non-auth endpoint: `memelab/src/lib/api.ts` clears tokens, redirects to `/login`
6. `POST /auth/refresh` rotates both tokens (old refresh deleted, new pair issued)

---

## Cross-Domain Dependencies

**Credits gates Videos, Reels, Ads:**
- `src/api/routes/video.py` imports `CreditService`, calls `check_and_deduct` before every Kie.ai call
- `src/api/routes/reels.py` calls `CreditService.check_and_deduct` before each Kie.ai clip in step-clips
- `src/api/routes/ads.py` calls `CreditService.check_and_deduct` before step-video Kie.ai call
- Insufficient balance raises `InsufficientCreditsError` → HTTP 402

**Auth gates everything except `/health` and `/llm/status`:**
- `get_current_user` in `src/api/deps.py` is a FastAPI dependency injected into every protected route
- Returns `User` ORM object; routes use `current_user.id` for tenant scoping

**Characters scopes Pipeline, Gallery, Publishing:**
- `Character.user_id` FK enforces tenant isolation
- `get_user_character(slug, current_user, session)` in `src/api/deps.py` verifies ownership

**Billing gates usage limits:**
- `src/services/stripe_billing.py` defines per-tier limits (free/pro/business)
- `/billing/status` exposes usage vs limits; enforcement is advisory (checked by frontend)

---

## Error Handling

**Strategy:** FastAPI `HTTPException` at route boundary; domain exceptions converted at route layer.

**Patterns:**
- `InsufficientCreditsError` → HTTP 402 in video/reels/ads routes
- `PermissionError` from `character_repo.get_by_slug` → HTTP 403 in `get_user_character`
- `ValueError` from `AuthService` → HTTP 401/409 in auth routes
- `KieAPIError` → logged + HTTP 500 or refund triggered
- Background task failures: catch-all except blocks update job status to `"failed"`, log traceback

---

## Background Services (started at app lifespan in `src/api/app.py`)

- **Scheduler worker** (`src/services/scheduler_worker.py`): polls `scheduled_posts` every 60s, publishes due posts to Instagram
- **Stale job scanner** (`src/video_gen/stale_job_scanner.py`): detects stuck `ContentPackage.video_status = "generating"` jobs, marks them failed after timeout
- **Gemini model discovery** (`src/image_gen/gemini_client.py`): `discover_image_models()` on startup, populates `app.state.gemini_image_models`

---

## Key Abstractions

**`CreditService` (`src/services/credit_service.py`):**
- Purpose: All credit mutations go through this service — never update `UserCredit.balance` directly
- Operations: `check_and_deduct`, `refund`, `top_up`, `get_balance`
- Every operation writes a `CreditLog` row for auditability
- Uses SELECT FOR UPDATE on MySQL; falls back to SQLite implicit serialization

**`UsageAwareKeySelector` (`src/services/key_selector.py`):**
- Purpose: Picks free or paid Gemini API key based on daily usage + user tier
- Used by: image generation routes in `src/api/routes/generation.py`

**`get_current_user` dependency (`src/api/deps.py`):**
- Purpose: Central auth gate — extracts JWT, validates, returns `User` ORM object
- Used by: every protected route via `Depends(get_current_user)`

**`step_state` pattern (Reels + Ads):**
- JSON column on `ReelsJob` / `ProductAdJob`
- Structure: `{step_name: {status: "pending|generating|approved|error", ...artifacts}}`
- Enables interactive execution: each step persisted independently, frontend drives sequence
- Step order for Reels (`src/api/routes/reels.py`): `["prompt", "script", "tts", "srt", "images", "clips", "video"]`
- Step order for Ads (`src/product_studio/config.py`): `["analysis", "scene", "prompt", "video", "copy", "audio", "assembly", "export"]`

---

*Architecture analysis: 2026-04-02*
