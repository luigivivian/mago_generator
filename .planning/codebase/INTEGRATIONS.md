# External Integrations

*Generated: 2026-04-02 | Focus: tech*

---

## Google Gemini API

**Purpose:** Primary AI backbone — LLM text generation, image generation, TTS narration, audio transcription, and grounded web search.

| Use Case | Model | File |
|----------|-------|------|
| Phrase generation, captions, quality scoring | `gemini-2.5-flash-lite` | `src/llm_client.py` |
| Content analysis, trend grounding, reels script | `gemini-2.5-flash` | `src/llm_client.py`, `src/reels_pipeline/script_gen.py` |
| Image generation with visual references | `gemini-2.5-flash-image` (discovered at startup) | `src/image_gen/gemini_client.py` |
| TTS narration (reels) | `gemini-2.5-flash-preview-tts` | `src/reels_pipeline/tts.py` |
| Audio transcription → SRT subtitles | `gemini-2.5-flash` | `src/reels_pipeline/transcriber.py` |
| Grounded web trends search | `gemini-2.5-flash` with `google_search` tool | `src/pipeline/agents/gemini_web_trends.py` |
| Product scene composition (ads) | `gemini-2.5-flash` | `src/product_studio/scene_composer.py` |
| Ads copy generation | `gemini-2.5-flash` | `src/product_studio/copy_generator.py` |

**Auth:** `GOOGLE_API_KEY` env var → `genai.Client(api_key=...)` in `src/llm_client.py`.
Optional paid key: `GOOGLE_API_KEY_PAID` for higher quotas; selected via `src/services/key_selector.py`.

**SDK:** `google-genai>=1.0.0` (installed: 1.68.0)

**Rate limits (free tier):** 500 RPD / 15 RPM for image models; `config.GEMINI_MAX_CONCURRENT = 5` semaphore enforced.

**Fallback:** Retry on 429 with exponential backoff (`GEMINI_IMAGE_MAX_RETRIES=2`, `GEMINI_IMAGE_WAIT_BASE=60s`).

**Domains served:** Characters, Gallery, Reels, Ads, Trends Pipeline.

---

## Kie.ai API

**Purpose:** Cloud video generation. Accepts an input image + motion prompt, returns a video clip. Also routes Suno music generation for ads.

**Client:** `src/video_gen/kie_client.py` (`KieSora2Client`)

**Supported models (configured in `config.VIDEO_MODELS`):**

| Model ID | Name | Resolution | Tier |
|----------|------|------------|------|
| `hailuo/2-3-image-to-video-standard` | Hailuo 2.3 Standard | 720p | cost |
| `hailuo/2-3-image-to-video-pro` | Hailuo 2.3 Pro | 1080p | cost |
| `bytedance/v1-pro-fast-image-to-video` | Seedance Pro Fast | 1080p | cost |
| `wan/2-6-flash-image-to-video` | Wan 2.6 Flash | 720p | cost |
| `wan/2-6-image-to-video` | Wan 2.6 | 720p | standard |
| `kling/v2-1-standard` | Kling v2.1 | 720p | standard |
| `bytedance/seedance-1.5-pro` | Seedance 1.5 Pro | 1080p | premium |
| `kling-3.0/video` | Kling 3.0 | 1080p | premium |
| `grok-imagine/image-to-video` | Grok Imagine | 720p | standard |
| `suno/v4` | Suno music gen | audio | (ads) |

**Auth:** `KIE_API_KEY` env var; passed as `Authorization: Bearer` header.

**Flow:** create task → poll with exponential backoff (`KIE_POLL_INITIAL_INTERVAL=5s`, `KIE_POLL_MAX_INTERVAL=30s`, `KIE_POLL_TIMEOUT=600s`) → download video.

**Concurrency:** `KIE_MAX_CONCURRENT=3` asyncio semaphore.

**Budget cap:** `VIDEO_DAILY_BUDGET_USD=3.0` enforced in `src/api/routes/video.py`.

**Input requirement:** image must be a **public URL** — resolved via GCS upload or `litterbox.catbox.moe` fallback (see GCS section).

**Credit mapping:** `config.CREDIT_COSTS` dict maps `(model_id, duration)` → credits consumed. `src/services/credit_service.py` gates calls.

**Domains served:** Videos, Reels, Ads (video + music).

---

## Google Cloud Storage (GCS)

**Purpose:** Hosts local images at public URLs required by Kie.ai API (Kie.ai cannot access `localhost` or private IPs).

**Client:** `src/video_gen/gcs_uploader.py` (`GCSUploader`)

**Auth:** `GOOGLE_APPLICATION_CREDENTIALS` env var → ADC service account JSON.

**Fallback:** If GCS is not configured, falls back to `litterbox.catbox.moe` (free, no API key, 1-hour expiry).

**Config vars:**
- `GCS_BUCKET_NAME` (default: `clipflow-video-uploads`)
- `GCS_SIGNED_URL_EXPIRY` (default: 3600s)

**SDK:** `google-cloud-storage>=2.14.0`

**Domains served:** Videos, Ads.

---

## Instagram Graph API

**Purpose:** Publishing photos, carousels, and reels to an Instagram Business account. Also used as a trend source (Explore feed).

**Version:** v21.0 (`INSTAGRAM_API_VERSION` in `config.py`)
**Base URL:** `https://graph.facebook.com/v21.0`

**Publishing client:** `src/services/instagram_client.py` (`InstagramClient`)
- Supports: single image, carousel (2-10 images), reels (video + cover)
- Async polling until container status = `FINISHED`

**OAuth service:** `src/services/instagram_oauth.py` (`InstagramOAuthService`)
- Facebook OAuth flow (short-lived → long-lived token exchange)
- Token encrypted at rest using Fernet (`cryptography` package), stored in `instagram_connections` table
- Bulk refresh before 60-day expiry

**Auth vars:**
- `INSTAGRAM_ACCESS_TOKEN` — long-lived token (global/legacy)
- `INSTAGRAM_BUSINESS_ID` — business account ID
- Per-user OAuth tokens stored in DB (encrypted)

**Webhook:** OAuth callback at `/settings/instagram/callback` (Next.js frontend) → `/instagram/callback` (FastAPI)

**Scopes required:** `instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`

**Limits:** max 30 hashtags, 2200 char captions.

**Domains served:** Publishing, Characters (insights), Trends (Explore as trend source).

---

## Stripe

**Purpose:** Subscription billing for Pro and Enterprise plans.

**Services:**
- `src/billing/stripe_service.py` (`StripeService`) — customer management, checkout session creation, Customer Portal, webhook processing, grace period + auto-downgrade on failed payments
- `src/services/stripe_billing.py` — graceful degradation wrapper (works without Stripe SDK or `STRIPE_SECRET_KEY`)

**Auth vars:**
- `STRIPE_SECRET_KEY` — server-side API key
- `STRIPE_PUBLISHABLE_KEY` — frontend (stored but not currently passed to frontend)
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification
- `STRIPE_PRO_PRICE_ID` — Stripe Price ID for Pro plan
- `STRIPE_ENTERPRISE_PRICE_ID` — Stripe Price ID for Enterprise plan

**Webhook endpoint:** `/billing/webhook` (`src/api/routes/billing.py`) — processes `customer.subscription.*` and `invoice.payment_failed` events.

**Plans:** Defined in `src/billing/plans.py` and `src/billing/schemas.py`.

**SDK:** `stripe` (lazy import via `import stripe` inside functions; not in `requirements.txt` — install separately).

**Domains served:** Credit System, Billing.

---

## BlueSky (AT Protocol)

**Purpose:** Trend monitoring — collects viral PT-BR posts from BlueSky social network.

**Client:** Direct HTTPS calls via `httpx` in `src/pipeline/agents/bluesky_trends.py`
**API:** AT Protocol public API (`bsky.app`)

**Auth vars:**
- `BLUESKY_HANDLE` — handle (e.g., `user.bsky.social`)
- `BLUESKY_APP_PASSWORD` — app password from bsky.app settings

**Config:** `BLUESKY_MAX_POSTS=15` posts per fetch.

**Domains served:** Trends Pipeline.

---

## Google Trends

**Purpose:** Fetches trending search topics for Brazil.

**Client:** `src/pipeline/agents/google_trends.py`
**SDK:** `trendspyg>=0.3.0` (wraps Google Trends RSS)
**Auth:** None (public RSS feed)
**Config:** `PIPELINE_GOOGLE_TRENDS_GEO="BR"` in `config.py`

**Domains served:** Trends Pipeline.

---

## Reddit (RSS)

**Purpose:** Fetches hot posts from meme subreddits as trend signals.

**Client:** `src/pipeline/agents/reddit_memes.py`
**Protocol:** Public RSS feeds at `https://www.reddit.com/r/{subreddit}/hot/.rss`
**SDK:** `feedparser>=6.0.0`
**Auth:** None

**Configured subreddits (`config.py`):** `brasil`, `eu_nvr`, `DiretoDoZapZap`, `memes`, `dankmemes`, `meirl`

**Domains served:** Trends Pipeline.

---

## YouTube (RSS)

**Purpose:** Fetches trending YouTube videos (general, comedy, entertainment categories) as content inspiration.

**Client:** `src/pipeline/agents/youtube_rss.py`
**Protocol:** YouTube RSS feeds
**SDK:** `feedparser>=6.0.0`
**Auth:** None (public RSS)
**Config:** `YOUTUBE_RSS_MAX_PER_CATEGORY=30`

**Domains served:** Trends Pipeline.

---

## Brazil Viral RSS / Sensacionalista

**Purpose:** Curated PT-BR meme and humor feeds for trend detection.

**Client:** `src/pipeline/agents/brazil_viral_rss.py`
**SDK:** `feedparser>=6.0.0`
**Auth:** None

**Configured feeds (`config.py`):**
- `https://www.reddit.com/r/brasil/hot/.rss`
- `https://www.reddit.com/r/eu_nvr/hot/.rss`
- `https://www.reddit.com/r/memes/hot/.rss`
- `https://www.sensacionalista.com.br/feed/`

**Config:** `BRAZIL_VIRAL_RSS_MAX_PER_FEED=10`

**Domains served:** Trends Pipeline.

---

## Ollama (Local LLM)

**Purpose:** Optional zero-cost local LLM backend. Replaces Gemini for text generation when running on GPU hardware.

**Client:** `src/llm_client.py` via `httpx.Client`
**Host:** `http://localhost:11434` (configurable via `OLLAMA_HOST`)
**Auth:** None (local service)

**Config vars:**
- `LLM_BACKEND=ollama` to activate
- `OLLAMA_MODEL` (default: `gemma3:4b` for 8GB VRAM; `llama3.1:8b` for 16GB)
- `OLLAMA_TIMEOUT=120s`
- `OLLAMA_FALLBACK_TO_GEMINI=true` — falls back to Gemini if Ollama unavailable

**Domains served:** All text generation domains (when configured).

---

## ComfyUI (Local Image Generation)

**Purpose:** Local Flux LoRA image generation at zero per-call cost. Primary image backend when `IMAGE_BACKEND_PRIORITY=comfyui`.

**Client:** `src/image_gen/comfyui_client.py` (`ComfyUIClient`)
**Protocol:** REST API + WebSocket for progress
**Host:** `127.0.0.1:8188` (configurable via `COMFYUI_HOST`, `COMFYUI_PORT`)
**Auth:** None (local service)

**Workflows:** JSON workflow files in `src/image_gen/workflows/`
- `flux_mago_lora.json` — txt2img with LoRA
- `flux_img2img.json` — img2img for refinement

**Config:** `COMFYUI_LORA_STRENGTH=0.85`, `COMFYUI_SAMPLING_STEPS=25`, `COMFYUI_GUIDANCE=4.0`, `COMFYUI_IMG2IMG_DENOISE=0.55`

**Concurrency:** `COMFYUI_MAX_CONCURRENT=1` (prevents OOM on RTX 4060 Ti 8GB)

**Fallback:** If ComfyUI fails and `COMFYUI_FALLBACK_TO_STATIC=true`, uses static background assets.

**Domains served:** Characters (image gen), Gallery.

---

## Facebook Graph API (Instagram OAuth)

**Purpose:** OAuth authorization flow to connect user Instagram Business accounts.

**Endpoint:** `https://graph.facebook.com/v21.0/oauth/...`
**Service:** `src/services/instagram_oauth.py`

**Required app permissions:** `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`

**Config vars:** `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI` (referenced in oauth service; not in `.env.example` — added during Phase 14).

---

## FFmpeg (System Binary)

**Purpose:** Video assembly, transitions, subtitle burn-in, text overlay, audio mixing. Called via `subprocess.run`.

**Not a Python package** — must be installed on the OS.

**Called from:**
- `src/reels_pipeline/video_builder.py` — xfade transitions, subtitle ASS burn-in, Ken-Burns zoom
- `src/product_studio/pipeline.py` — text overlay (drawtext), audio mixing
- `src/product_studio/format_exporter.py` — multi-format export (9:16, 16:9, 1:1) with blur padding
- `src/pipeline/workers/legend_worker.py` — video legend rendering (graceful fallback if not found)
- `src/video_gen/legend_renderer.py` — video text overlay

**Domains served:** Reels, Ads, Videos.

---

## Environment Variables Summary

| Variable | Service | Required |
|----------|---------|----------|
| `GOOGLE_API_KEY` | Gemini API | Yes |
| `GOOGLE_API_KEY_PAID` | Gemini API (high quota) | No |
| `DATABASE_URL` | SQLAlchemy | No (defaults to SQLite) |
| `KIE_API_KEY` | Kie.ai | Only if `VIDEO_ENABLED=true` or `REELS_ENABLED=true` |
| `GCS_BUCKET_NAME` | GCS | No (falls back to catbox.moe) |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCS ADC | No (falls back to catbox.moe) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram Graph API | No (publishing disabled without it) |
| `INSTAGRAM_BUSINESS_ID` | Instagram Graph API | No |
| `STRIPE_SECRET_KEY` | Stripe | No (billing disabled without it) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | No |
| `STRIPE_PRO_PRICE_ID` | Stripe | No |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe | No |
| `BLUESKY_HANDLE` | BlueSky | No |
| `BLUESKY_APP_PASSWORD` | BlueSky | No |
| `LLM_BACKEND` | LLM routing | No (defaults to `gemini`) |
| `OLLAMA_MODEL` | Ollama | No |
| `IMAGE_BACKEND_PRIORITY` | Image routing | No (defaults to `comfyui`) |
| `VIDEO_ENABLED` | Video gen feature flag | No (defaults to `false`) |
| `REELS_ENABLED` | Reels feature flag | No (defaults to `false`) |
| `VIDEO_DAILY_BUDGET_USD` | Budget cap | No (defaults to `3.0`) |

---

*Integration audit: 2026-04-02*
