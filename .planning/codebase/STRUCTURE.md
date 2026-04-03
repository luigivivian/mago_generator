# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```
meme-lab/                          # Project root
├── src/                           # Python FastAPI backend
│   ├── api/                       # HTTP layer — routes, deps, models, serializers
│   │   ├── app.py                 # FastAPI app factory + router registration + lifespan
│   │   ├── deps.py                # Shared FastAPI dependencies (auth, db, theme resolver)
│   │   ├── models.py              # Pydantic request/response schemas
│   │   ├── serializers.py         # ORM → dict converters
│   │   ├── registry.py            # Agent registry
│   │   └── routes/                # One file per domain (16 route modules)
│   ├── auth/                      # Auth domain (JWT, bcrypt, service)
│   ├── billing/                   # Stripe billing schemas and service
│   ├── database/                  # ORM models, repositories, migrations, session
│   │   ├── models.py              # All 19 SQLAlchemy ORM models (single file)
│   │   ├── base.py                # DeclarativeBase + TimestampMixin
│   │   ├── repositories/          # Typed async repo classes
│   │   ├── migrations/            # Alembic migration scripts (027 versions)
│   │   └── seed.py                # DB seeding script
│   ├── services/                  # Cross-domain services (credits, publisher, scheduler, etc.)
│   ├── pipeline/                  # Multi-agent content pipeline (L1-L5 agents)
│   │   ├── orchestrator.py        # Sync orchestrator
│   │   ├── async_orchestrator.py  # Async orchestrator (current)
│   │   ├── broker.py              # Trend broker
│   │   ├── curator.py             # Content curator
│   │   ├── workers/               # Individual pipeline workers
│   │   └── processors/            # Aggregator, analyzer, generator
│   ├── reels_pipeline/            # Instagram Reels pipeline (7 steps)
│   │   ├── main.py                # Orchestrator: chains image→script→TTS→SRT→video
│   │   ├── image_gen.py           # Gemini image generation for reel scenes
│   │   ├── script_gen.py          # Gemini script generation
│   │   ├── tts.py                 # Gemini TTS narration
│   │   ├── transcriber.py         # Gemini transcription → SRT
│   │   ├── video_builder.py       # FFmpeg xfade assembly
│   │   ├── asset_registry.py      # Scene asset semantic reuse
│   │   ├── models.py              # Pydantic schemas for reels API
│   │   └── config.py              # Output dirs, constants
│   ├── product_studio/            # Product Ad pipeline (8 steps)
│   │   ├── pipeline.py            # 8-step orchestrator
│   │   ├── scene_composer.py      # Gemini Vision product analysis
│   │   ├── bg_remover.py          # rembg background removal
│   │   ├── prompt_builder.py      # Cinematic prompt generation
│   │   ├── copy_generator.py      # Headline + CTA generation
│   │   ├── music_client.py        # Suno AI music generation
│   │   ├── format_exporter.py     # FFmpeg multi-format export
│   │   ├── models.py              # Pydantic schemas for ads API
│   │   └── config.py              # Step order, output dirs, style presets
│   ├── video_gen/                 # Kie.ai video generation client
│   │   ├── kie_client.py          # KieSora2Client: create task, poll, download
│   │   ├── video_prompt_builder.py # Motion prompt construction per theme
│   │   ├── legend_renderer.py     # Subtitle/legend overlay (FFmpeg)
│   │   ├── gcs_uploader.py        # GCS upload for Kie.ai image URLs
│   │   └── stale_job_scanner.py   # Background thread to detect stuck jobs
│   ├── image_gen/                 # Gemini image generation client
│   │   └── gemini_client.py       # Image gen, ref loading, model discovery
│   ├── llm_client.py              # LLM client (Gemini/Ollama abstraction)
│   └── characters.py              # Character DNA utilities (legacy)
├── memelab/                       # Next.js 15 frontend (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx         # Root layout (dark mode, Inter font, AuthProvider)
│   │   │   ├── page.tsx           # Redirect / → /dashboard
│   │   │   ├── login/page.tsx     # Login form
│   │   │   ├── register/page.tsx  # Register form
│   │   │   ├── landing/page.tsx   # Public landing page
│   │   │   └── (app)/             # Authenticated route group
│   │   │       ├── layout.tsx     # Auth guard + Shell wrapper
│   │   │       ├── dashboard/     # Stats, charts, pipeline overview
│   │   │       ├── characters/    # Character list, detail, new, refs sub-pages
│   │   │       ├── gallery/       # Image browser + theme filter
│   │   │       ├── videos/        # Video gallery + generation
│   │   │       ├── reels/         # Reels job list + interactive wizard
│   │   │       ├── ads/           # Ad job list + wizard
│   │   │       ├── agents/        # Agent grid
│   │   │       ├── pipeline/      # Pipeline control + SVG diagram
│   │   │       ├── themes/        # Theme CRUD
│   │   │       ├── phrases/       # Phrase generator
│   │   │       ├── trends/        # Trending topics feed
│   │   │       ├── jobs/          # Batch job monitor
│   │   │       ├── publishing/    # Schedule queue + calendar
│   │   │       ├── credits/       # Credit balance + log + admin top-up
│   │   │       ├── billing/       # Stripe plan management
│   │   │       └── settings/      # User settings + Instagram OAuth callback
│   │   ├── components/
│   │   │   ├── layout/            # Shell, Sidebar, Header, VideoProgress
│   │   │   ├── reels/             # Reels step components (step-*.tsx)
│   │   │   ├── ads/               # Ads wizard step components (step-*.tsx)
│   │   │   ├── agents/            # Agent modal + config
│   │   │   ├── panels/            # StatsCard, PipelineDiagram (SVG)
│   │   │   └── ui/                # shadcn/ui primitives (button, card, dialog, etc.)
│   │   ├── contexts/
│   │   │   ├── auth-context.tsx   # JWT token storage + user state + auto-401 redirect
│   │   │   └── character-context.tsx # Active character selection (shared across pages)
│   │   ├── hooks/
│   │   │   ├── use-api.ts         # SWR hooks for all backend endpoints
│   │   │   ├── use-reels.ts       # SWR hooks for reels-specific endpoints
│   │   │   ├── use-ads.ts         # SWR hooks for ads-specific endpoints
│   │   │   └── use-pipeline.ts    # Pipeline execution hook with polling
│   │   └── lib/
│   │       ├── api.ts             # Typed HTTP client — all fetch calls, all TypeScript types
│   │       ├── constants.ts       # NAV_ITEMS, color maps, platform labels
│   │       ├── utils.ts           # cn() (clsx + tailwind-merge)
│   │       └── animations.ts      # Framer Motion stagger variants
│   └── next.config.ts             # Next.js rewrites: /api/* → http://127.0.0.1:8000/*
├── config.py                      # Global config: paths, API keys (env), video models, pipeline settings
├── alembic.ini                    # Alembic DB migration config
├── pyproject.toml                 # Python project + deps
├── requirements.txt               # Pip requirements
├── characters/                    # Character ref images (filesystem)
│   └── {character-slug}/refs/{approved,pending,rejected}/
├── assets/                        # Static assets (backgrounds, fonts)
├── output/                        # Generated files (gitignored)
│   ├── backgrounds_generated/     # Gemini/ComfyUI generated backgrounds (PNG)
│   ├── memes/                     # Composed meme images (background + text)
│   └── videos/                    # Generated Kie.ai video files (MP4)
├── data/                          # SQLite DB file (default, gitignored)
└── tests/                         # Python test suite
```

---

## Directory Purposes

**`src/api/routes/`:**
- Purpose: One FastAPI `APIRouter` per domain — HTTP boundary only
- Files: `auth.py`, `video.py`, `reels.py`, `ads.py`, `credits.py`, `characters.py`, `generation.py`, `jobs.py`, `themes.py`, `pipeline.py`, `content.py`, `agents.py`, `drive.py`, `publishing.py`, `billing.py`, `dashboard.py`, `instagram.py`
- Pattern: routes import service/repo, call business logic, return serialized response

**`src/database/repositories/`:**
- Purpose: Type-safe async DB access; one repo per model group
- Files: `character_repo.py`, `content_repo.py`, `job_repo.py`, `pipeline_repo.py`, `schedule_repo.py`, `theme_repo.py`, `usage_repo.py`, `user_repo.py`
- Pattern: each repo takes `AsyncSession` in `__init__`, exposes async methods

**`src/database/migrations/versions/`:**
- Purpose: Alembic migration history — 27 migrations from `001_initial_schema.py` to `027_credit_system.py`
- Naming: `NNN_description.py` (sequential) + one UUID-named migration for characters rendering column
- Run migrations: `alembic upgrade head`

**`src/reels_pipeline/` and `src/product_studio/`:**
- Purpose: Self-contained domain pipelines with their own models, config, and step executors
- These pipelines are called from their respective route files, not from the generic pipeline orchestrator
- Both follow the same interactive stepper pattern via `step_state` JSON

**`memelab/src/lib/api.ts`:**
- Purpose: Single source of truth for all HTTP calls from the frontend
- Contains TypeScript interfaces mirroring FastAPI response shapes
- All SWR hooks in `use-api.ts`, `use-reels.ts`, `use-ads.ts` delegate to functions defined here

**`memelab/src/contexts/auth-context.tsx`:**
- Purpose: Central auth state — stores tokens, provides `login/logout/register`, hydrates on mount
- Token storage: `localStorage` (persist=true) or `sessionStorage` (session-only) based on `rememberMe` flag
- 401 handling in `memelab/src/lib/api.ts` clears tokens and redirects to `/login`

---

## Key File Locations

**Entry Points:**
- `src/api/app.py`: FastAPI app factory — lifespan, router registration, CORS
- `src/api/__main__.py`: CLI entry point — `python -m src.api --port 8000`
- `memelab/src/app/layout.tsx`: Next.js root layout — `AuthProvider` wraps entire tree
- `memelab/src/app/(app)/layout.tsx`: Auth guard — redirects unauthenticated users to `/login`

**Configuration:**
- `config.py`: All Python config — paths, feature flags (`VIDEO_ENABLED`, `REELS_ENABLED`), API keys from env, video model catalog, pipeline settings
- `memelab/next.config.ts`: Next.js rewrites (proxy to FastAPI)
- `memelab/src/app/globals.css`: Tailwind 4 `@theme` design tokens (colors, radius, font)

**Core Logic:**
- `src/database/models.py`: All 19 ORM tables in one file
- `src/services/credit_service.py`: `CreditService` — only safe way to mutate credits
- `src/api/deps.py`: `get_current_user`, `db_session`, `get_user_character`, `resolver_tema`
- `src/auth/jwt.py`: JWT create/verify (PyJWT, HS256, 2h TTL)
- `config.py` function `compute_credit_cost(model_id, duration)`: credit pricing table

**Domain Pipelines:**
- `src/reels_pipeline/main.py`: Reels orchestrator — 7-step sequential execution
- `src/product_studio/pipeline.py`: Ads orchestrator — 8-step `run_step_*()` methods
- `src/video_gen/kie_client.py`: `KieSora2Client` — Kie.ai lifecycle: create → poll → download

---

## Naming Conventions

**Python files:**
- Route files: `{domain}.py` (e.g., `video.py`, `reels.py`, `credits.py`)
- Repository files: `{model_group}_repo.py`
- Service files: `{service_name}_service.py` or `{name}_client.py`
- Pipeline files: `{step_name}.py` (e.g., `script_gen.py`, `video_builder.py`)

**TypeScript files:**
- Pages: `page.tsx` in directory matching route
- Step components: `step-{step_name}.tsx` (e.g., `step-script.tsx`, `step-video.tsx`)
- Hooks: `use-{domain}.ts`
- Context files: `{domain}-context.tsx`

**Database tables:**
- snake_case plural (e.g., `character_refs`, `reels_jobs`, `product_ad_jobs`, `credit_logs`)
- Indexes prefixed: `idx_{table_abbrev}_{column}` (e.g., `idx_reels_jobs_user_id`)

**Frontend route paths:**
- All under `memelab/src/app/(app)/` for authenticated pages
- Character detail: `/characters/[slug]/page.tsx`
- Reel detail: `/reels/[jobId]/page.tsx`
- Ad detail: `/ads/[jobId]/page.tsx`

---

## Where to Add New Code

**New API domain (e.g., a new pipeline type):**
1. Create `src/api/routes/{domain}.py` with `router = APIRouter(prefix="/{domain}", tags=[...])`
2. Register in `src/api/app.py`: `from src.api.routes import {domain}` + `app.include_router({domain}.router)`
3. Add ORM model to `src/database/models.py`
4. Create Alembic migration: `alembic revision --autogenerate -m "add_{domain}"`
5. Add frontend page at `memelab/src/app/(app)/{domain}/page.tsx`
6. Add fetch functions to `memelab/src/lib/api.ts`
7. Add SWR hook to `memelab/src/hooks/use-api.ts`
8. Add nav item to `memelab/src/lib/constants.ts` NAV_ITEMS

**New credit-gated operation:**
1. Inject `CreditService(session)` in the route handler
2. Call `await credit_svc.check_and_deduct(user_id, model_id, duration, job_type, job_id)` before the Kie.ai call
3. Wrap in try/except `InsufficientCreditsError` → HTTP 402
4. Call `await credit_svc.refund(...)` in the except block for API failures

**New step in an interactive pipeline:**
1. Add step name to `ADS_STEP_ORDER` in `src/product_studio/config.py` or `STEP_ORDER` in `src/api/routes/reels.py`
2. Add `run_step_{name}()` method to the pipeline class
3. Add step handler in the route's step execution endpoint
4. Add `step-{name}.tsx` component in `memelab/src/components/{domain}/`

**New ORM model:**
- Add class to `src/database/models.py` (always in this single file)
- Include `user_id` FK for multi-tenant isolation
- Add relationship to parent model
- Generate Alembic migration

**New repository:**
- Create `src/database/repositories/{model_group}_repo.py`
- Accept `AsyncSession` in `__init__`
- Add to `src/database/repositories/__init__.py`

---

## Special Directories

**`output/`:**
- Purpose: All generated files (images, videos, memes)
- Generated: Yes (by pipeline workers and video generation)
- Committed: No (in `.gitignore`)
- Sub-dirs: `backgrounds_generated/` (PNG), `memes/` (PNG), `videos/` (MP4), `reels/` (MP4 + assets), `ads/` (MP4)

**`characters/{slug}/refs/`:**
- Purpose: Character reference images for visual consistency in Gemini image generation
- Structure: `approved/`, `pending/`, `rejected/` subdirs per character
- Committed: Yes (for built-in characters like `mago-mestre`)

**`src/database/migrations/versions/`:**
- Purpose: Alembic migration history
- Generated: Yes (by `alembic revision`)
- Committed: Yes (version control for schema changes)

**`memelab/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, codebase docs, research)
- Generated: Yes (by GSD commands)
- Committed: Yes

---

*Structure analysis: 2026-04-02*
