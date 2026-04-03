# Technology Stack

*Generated: 2026-04-02 | Focus: tech*

## Languages

| Language | Version | Where Used |
|----------|---------|------------|
| Python | 3.12.8 | Backend API, pipeline, image gen, video gen, reels |
| TypeScript | 5.8.3 | Frontend dashboard (`memelab/`) |

## Runtime & Package Managers

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12.8 | Backend runtime |
| Node.js | 24.12.0 | Frontend runtime |
| npm | (bundled) | Frontend package manager; `memelab/package-lock.json` present |
| pip | system | Python dep manager; `requirements.txt` at root |

---

## Backend

### Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | 0.135.2 | REST API framework (`src/api/app.py`) |
| `uvicorn` | 0.42.0 | ASGI server (`src/api/__main__.py`) |
| `pyngrok` | >=7.0.0 | Optional ngrok tunnel for Colab/public URL access |

**Entry point:** `python -m src.api --port 8000`

**Router modules in `src/api/routes/`:**

| Module | Prefix |
|--------|--------|
| `generation.py` | `/generate/*` |
| `characters.py` | `/characters/*` |
| `reels.py` | `/reels/*` |
| `video.py` | `/video/*` |
| `ads.py` | `/ads/*` |
| `billing.py` | `/billing/*` |
| `credits.py` | `/credits/*` |
| `publishing.py` | `/publishing/*` |
| `auth.py` | `/auth/*` |
| `jobs.py`, `pipeline.py`, `agents.py`, `themes.py`, `drive.py`, `content.py`, `dashboard.py`, `instagram.py` | respective prefixes |

### Database

| Package | Version | Purpose |
|---------|---------|---------|
| `sqlalchemy` | 2.0.48 | Async ORM (`src/database/session.py`) |
| `alembic` | 1.18.4 | Schema migrations (`src/database/migrations/`) |
| `aiosqlite` | >=0.20 | Async SQLite driver (dev default) |
| `aiomysql` | >=0.2.0 | Async MySQL driver (production) |

- Default DB: SQLite at `data/clipflow.db`
- Production DB: MySQL via `DATABASE_URL=mysql+aiomysql://...`
- Models: `src/database/models.py` (17+ tables including `UserCredit`, `CreditLog`, `Subscription`)
- Repository pattern: `src/database/repositories/` (one repo per domain)

### Authentication

| Package | Version | Purpose |
|---------|---------|---------|
| `PyJWT` | 2.12.1 | JWT access/refresh tokens (`src/auth/jwt.py`) |
| `bcrypt` | >=5.0.0 | Password hashing rounds=12 (`src/auth/service.py`) |
| `cryptography` | >=42.0 | Fernet encryption for Instagram OAuth tokens stored in DB (`src/services/instagram_oauth.py`) |

### AI / ML

| Package | Version | Purpose | Domains |
|---------|---------|---------|---------|
| `google-genai` | 1.68.0 | Official Gemini SDK — LLM, image gen, TTS, transcription | All |
| `google-cloud-storage` | >=2.14.0 | GCS uploads for Kie.ai public image URLs (`src/video_gen/gcs_uploader.py`) | Videos, Ads |
| `rembg[cpu]` | >=2.0.0 | Local background removal from product photos (`src/product_studio/bg_remover.py`) | Ads |

**LLM abstraction:** `src/llm_client.py` wraps `google-genai` (primary) and Ollama HTTP (local fallback). Backend controlled by `LLM_BACKEND` env var.

**Gemini models in use (`config.py`):**

| Model | Env Var | Use Case |
|-------|---------|---------|
| `gemini-2.5-flash-lite` | `GEMINI_MODEL_LITE` | Cheap: phrase gen, captions, quality scoring |
| `gemini-2.5-flash` | `GEMINI_MODEL_NORMAL` | Critical: analyzer, grounding, web trends |
| `gemini-2.5-flash-image` | discovered at startup | Image generation with visual references |
| `gemini-2.5-flash-preview-tts` | `REELS_TTS_MODEL` | Reels narration TTS (PT-BR, 24kHz PCM → WAV) |

**ComfyUI integration:** `src/image_gen/comfyui_client.py` — REST + WebSocket to local server at `127.0.0.1:8188`; Flux LoRA image gen (primary backend when `IMAGE_BACKEND_PRIORITY=comfyui`).

### Image Processing

| Package | Version | Purpose |
|---------|---------|---------|
| `Pillow` | 12.1.1 | Text overlay, compositing, resizing (`src/image_maker.py`) |

### Task Scheduling

| Package | Version | Purpose |
|---------|---------|---------|
| `APScheduler` | >=3.10.0 | Publishing scheduler runs every 60s (`src/services/scheduler_worker.py`); insights collector runs every 12h |

### Trend Monitoring (`src/pipeline/agents/`)

| Package | Version | Purpose | Agent File |
|---------|---------|---------|-----------|
| `trendspyg` | >=0.3.0 | Google Trends RSS | `agents/google_trends.py` |
| `feedparser` | >=6.0.0 | Reddit, generic RSS, YouTube, Brazil Viral RSS | `agents/rss_feeds.py`, `agents/reddit_memes.py`, `agents/youtube_rss.py`, `agents/brazil_viral_rss.py` |
| `beautifulsoup4` | >=4.12.0 | HTML scraping | `src/scrape_assets.py` |
| `playwright` | >=1.40.0 | Headless browser for asset scraping | `src/scrape_assets.py` |
| `requests` | >=2.31.0 | Sync HTTP (ComfyUI REST) | `src/image_gen/comfyui_client.py` |
| `httpx` | >=0.27.0 | Async HTTP (Kie.ai, Ollama, Instagram, BlueSky) | multiple service clients |
| `websocket-client` | >=1.6.0 | ComfyUI WebSocket progress tracking | `src/image_gen/comfyui_client.py` |

### Billing

| Package | Purpose | Files |
|---------|---------|-------|
| `stripe` | Subscription management (lazy import, optional) | `src/billing/stripe_service.py`, `src/services/stripe_billing.py` |

*Note: `stripe` is not in `requirements.txt` but is imported lazily. Install separately if billing is needed.*

---

## Frontend (memelab/)

### Framework

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.5.12 | App Router; proxies `/api/*` → FastAPI `127.0.0.1:8000` via `next.config` rewrites |
| `react` | 19.1.0 | UI library |
| `react-dom` | 19.1.0 | DOM rendering |
| `typescript` | 5.8.3 | Type system |

### Styling

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` | 4.1.8 | CSS framework; no `tailwind.config.js` — uses `@theme` in `src/app/globals.css` |
| `@tailwindcss/postcss` | 4.1.8 | PostCSS integration |
| `class-variance-authority` | 0.7.1 | CVA for component variants |
| `clsx` | 2.1.1 | Conditional class names |
| `tailwind-merge` | 3.3.0 | Class deduplication; combined via `cn()` in `src/lib/utils.ts` |

### UI Components

| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/*` | various | Headless primitives: dialog, dropdown, tabs, select, switch, tooltip, progress, scroll-area, separator |
| `lucide-react` | 0.513.0 | Icons |
| `framer-motion` | 12.35.2 | Animations |

### Data Fetching

| Package | Version | Purpose |
|---------|---------|---------|
| `swr` | 2.3.3 | Data fetching with auto-revalidation (`memelab/src/hooks/use-api.ts`) |

### Visualization

| Package | Version | Purpose |
|---------|---------|---------|
| `recharts` | 3.8.1 | Charts (dashboard stats) |
| `@xyflow/react` | 12.10.1 | Node graph (pipeline diagram page) |
| `mermaid` | 11.6.0 | Present in deps; SVG diagram takes precedence in pipeline page |

### Testing (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | 4.1.1 | Test runner |
| `@testing-library/react` | 16.3.2 | React component testing |
| `@testing-library/jest-dom` | 6.9.1 | DOM matchers |
| `jsdom` | 29.0.1 | DOM environment |
| `@vitejs/plugin-react` | 6.0.1 | Vitest React plugin |

### Linting (Frontend)

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | 9.27.0 | Linting |
| `eslint-config-next` | 15.3.3 | Next.js ESLint rules |

---

## Infrastructure / System Dependencies

| Tool | Purpose | Required By |
|------|---------|------------|
| FFmpeg | Video assembly, xfade transitions, drawtext overlay, audio mixing | Reels pipeline (`src/reels_pipeline/video_builder.py`), Ads pipeline (`src/product_studio/pipeline.py`, `format_exporter.py`), legend worker |
| ComfyUI | Local Flux LoRA image gen at `127.0.0.1:8188` | Image backend (optional, `IMAGE_BACKEND_PRIORITY=comfyui`) |
| Ollama | Local LLM at `localhost:11434` | LLM backend (optional, `LLM_BACKEND=ollama`) |
| MySQL | Production database | Deploy with `DATABASE_URL=mysql+aiomysql://...` |
| SQLite | Dev/default database | Dev environments, no extra config needed |

---

## Configuration Files

| File | Purpose |
|------|---------|
| `config.py` | Root config: image gen, video gen, pipeline, Gemini, Kie.ai, Stripe, Instagram, ComfyUI, credit costs |
| `src/reels_pipeline/config.py` | Reels-specific constants (TTS, subtitle styling, FFmpeg transitions, Kie.ai models) |
| `src/product_studio/config.py` | Ads/product-studio constants (rembg model, export formats, music map) |
| `.env` | Local secrets (not committed) |
| `.env.example` | Template: `GOOGLE_API_KEY`, `DATABASE_URL`, `KIE_API_KEY`, `GCS_BUCKET_NAME`, `BLUESKY_*` |
| `pyproject.toml` | pytest config only (`asyncio_mode = "auto"`) |

---

## Domain–Technology Mapping

| Domain | Core Modules | AI/ML | External APIs |
|--------|-------------|-------|---------------|
| Characters | `src/database/repositories/character_repo.py`, `src/api/routes/characters.py` | Gemini (image gen with refs) | — |
| Gallery | `src/api/routes/drive.py`, local filesystem | Gemini (model discovery) | — |
| Videos | `src/video_gen/kie_client.py`, `video_prompt_builder.py` | — | Kie.ai, GCS |
| Reels | `src/reels_pipeline/main.py` + 7 modules | Gemini (script, TTS, transcription, image gen) | Kie.ai (optional scenes) |
| Ads / Product Studio | `src/product_studio/pipeline.py` + 8 modules | Gemini (scene composition, copy), rembg | Kie.ai (video), Suno via Kie.ai (music) |
| Credit System | `src/services/credit_service.py`, `src/billing/plans.py` | — | Stripe |
| Publishing | `src/services/instagram_client.py`, `publisher.py`, `scheduler_worker.py` | — | Instagram Graph API v21.0 |
| Trends Pipeline | `src/pipeline/agents/` (11 agents) | Gemini (web trends + grounding) | Google Trends, Reddit RSS, YouTube RSS, BlueSky |

---

*Stack analysis: 2026-04-02*
