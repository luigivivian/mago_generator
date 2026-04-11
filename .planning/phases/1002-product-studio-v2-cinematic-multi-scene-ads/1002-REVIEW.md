---
status: issues_found
phase: 1002-product-studio-v2-cinematic-multi-scene-ads
reviewed: 2026-04-10
depth: standard
scope: backend (Plans 01-06)
files_reviewed: 13
findings:
  critical: 2
  high: 4
  medium: 8
  low: 13
---

# Phase 1002 Code Review — Product Studio v2

**Scope:** Backend source files changed during Plans 01-06. Plan 07 (frontend `memelab/**`) reviewed separately or in a follow-up pass.

## Overall Verdict

**Solid structural work** — clean module boundaries, good Pydantic validation at the API edge, and the backward-compat strategy for v1/v2 ProductAdJob rows works correctly. The xfade audio offset math is right, the migration chain is valid (030 → 040), and the Kling 3.0 multi-image payload extension is backwards-compatible with non-v2 callers.

**However, three findings are serious enough to block a production launch** (see Critical + first-tier High sections). The rest are quality/consistency issues that can land in a follow-up cleanup pass.

## Threat Model Compliance

| ID | Threat | Present? | Where |
|---|---|---|---|
| T-1002-01 | `image_urls` 1-4 bound | ✅ | `models.py:100` min_length=1 max_length=4 |
| T-1002-02 | `duration` 3-10 | ✅ | `models.py:83` ge=3 le=10 |
| T-1002-03 | `prompt` max 463 | ✅ | `models.py:81` max_length=463 + `prompt_builder.py:133` runtime cap |
| T-1002-04/05 | CATEGORY fallback | ✅ | `prompt_builder.py:107`, `scene_composer.py:184`, `config.py:176` CATEGORY_DEFAULT |
| T-1002-06/07 | content-type whitelist | ⚠ Partial | `ads.py:425-428` — see **H-01** |
| T-1002-08/09 | LLM output validation | ⚠ Partial | `scene_composer.py:244` — see **M-01** |
| T-1002-13 | SFX id whitelist | ✅ | `sfx_library.py:62-67` + `resolve_sfx_path` returns None |
| T-1002-14 | ffmpeg list args | ✅ | `take_composer.py:155`, `format_exporter.py:*`, `pipeline.py:534-547` |

## Critical Issues

### CR-01: V2 pipeline bypasses credit system entirely

**File:** `src/api/routes/ads.py:604-661`

**Issue:** `_execute_v2_pipeline_task` calls `pipeline.run_v2_pipeline(...)` which hits Kie.ai multiple times, but there is no `CreditService.check_and_deduct` anywhere in the v2 path. The v1 `_execute_ad_step_task` at `ads.py:234-275` (video step) and `ads.py:292-327` (audio step) both deduct credits before every paid API call and refund on failure. **Users who call `POST /ads/create-v2` pay zero credits regardless of how many Kling generations fire.**

**Fix:** Before `run_v2_pipeline`, deduct credits based on take count × duration × Kling 3.0 rate:
```python
from src.services.credit_service import CreditService, InsufficientCreditsError
takes_list = list(job.takes_config) if job.takes_config else []
est_seconds = sum(int(t.get("duration", 5)) for t in takes_list) or 20
credit_svc = CreditService(session)
try:
    deducted = await credit_svc.check_and_deduct(
        user_id=job.user_id,
        model_id="kling-3.0/video",
        duration=est_seconds,
        job_type="ad_v2",
        job_id=str(job.job_id),
    )
except InsufficientCreditsError as e:
    job.status = "blocked"
    job.error_message = f"Insufficient credits: {e.balance}/{e.required}"
    await session.commit()
    return
```
Wrap `run_v2_pipeline` in try/except and refund `deducted` in the except block before re-raising.

### CR-02: SSRF via `AdCreateRequestV2.image_urls`

**File:** `src/product_studio/models.py:100` and `src/product_studio/pipeline.py:441-448`

**Issue:** `image_urls` is `list[str]` with length bounds only — no `HttpUrl` type, no scheme whitelist, no host deny-list. `_execute_v2_pipeline_task` persists the list to `job.image_urls` verbatim, and `run_v2_pipeline` step 1 iterates with `httpx.AsyncClient(timeout=60.0)` and `resp = await hc.get(url)`. **A caller can submit `http://169.254.169.254/latest/meta-data/iam/security-credentials/` (AWS metadata) or `http://metadata.google.internal/computeMetadata/v1/` (GCP metadata) and the server will fetch it into `job_dir/ref_0.jpg`.** Even if PIL later rejects the bytes, the server has already made an authenticated metadata call and the response body is on disk.

The plan docs describe `image_urls` as "GCS URLs returned by POST /ads/upload-images", but the endpoint places zero constraints on the shape — any caller can skip `/upload-images` and POST arbitrary URLs.

**Fix:** Use Pydantic `HttpUrl` and enforce a host allowlist at the request boundary:
```python
from pydantic import BaseModel, Field, HttpUrl, field_validator

ALLOWED_IMAGE_HOSTS = {"storage.googleapis.com", "storage.cloud.google.com"}

class AdCreateRequestV2(BaseModel):
    ...
    image_urls: list[HttpUrl] = Field(..., min_length=1, max_length=4)

    @field_validator("image_urls")
    @classmethod
    def _only_allowed_hosts(cls, v):
        for u in v:
            if u.host not in ALLOWED_IMAGE_HOSTS:
                raise ValueError(f"image host {u.host!r} not allowed")
            if u.scheme != "https":
                raise ValueError("image URL must be https")
        return v
```
Then cast back to `str` before persisting. As defense-in-depth, `run_v2_pipeline` should re-parse the URL and re-assert the host before calling `httpx.get`.

## High Issues

### H-01: Content-type whitelist is client-trusted

**File:** `src/api/routes/ads.py:422-428`

**Issue:** `f.content_type` is sent by the client in the multipart headers and is not validated against the actual bytes. An attacker can upload an arbitrary file with `Content-Type: image/jpeg` and bypass the check. The normalization path does `Image.open(raw_path).convert("RGB")` which raises `UnidentifiedImageError` for non-image bytes, so most payloads fail — but a crafted polyglot (real JPEG with appended malicious content) would pass both checks and land in GCS. **No file-size cap either**, so an attacker can OOM the tempdir with a 4×500MB upload.

**Fix:** Magic-byte verification and size cap:
```python
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB per file

# After writing raw_path:
if os.path.getsize(raw_path) > MAX_UPLOAD_BYTES:
    raise HTTPException(413, "Image too large (max 15MB)")
try:
    with Image.open(raw_path) as probe:
        probe.verify()
        if probe.format not in ("JPEG", "PNG"):
            raise HTTPException(400, f"Unsupported image format: {probe.format}")
except UnidentifiedImageError:
    raise HTTPException(400, "Uploaded file is not a valid image")
```
Note: `Image.verify()` invalidates the handle — re-open for `normalize_for_kling`.

### H-02: `_job_to_response` drops generated takes from v2 responses

**File:** `src/api/routes/ads.py:81-110` (specifically line 109: `takes=[]`)

**Issue:** `AdJobResponseV2` has two take-shaped fields: `takes: list[TakeConfig]` and `takes_config: Optional[list[dict]]`. The serializer sets `takes_config=getattr(job, "takes_config", None)` correctly but hardcodes `takes=[]`. After `_execute_v2_pipeline_task` completes, `job.takes_config` holds the final list of dicts, so `takes_config` in the response is populated — **but the `takes` field (which the frontend per Plan 07 consumes) is always empty.** Plan 07 take editor shows a blank state for completed v2 jobs even though the data is persisted.

**Fix:** Populate `takes` by coercing each stored dict through `TakeConfig`:
```python
from src.product_studio.models import TakeConfig
stored_takes = getattr(job, "takes_config", None) or []
try:
    takes_list = [TakeConfig(**t) for t in stored_takes if isinstance(t, dict)]
except Exception:
    takes_list = []
return AdJobResponseV2(
    ...
    takes=takes_list,
    takes_config=stored_takes or None,
    ...
)
```

### H-03: Kling 3.0 duration is silently snapped to [5, 10], corrupting SFX offsets

**File:** `src/product_studio/pipeline.py:311-318, 335-354` and `src/video_gen/kie_client.py:331-332`

**Issue:** `config.py:454` declares Kling 3.0 `durations=[5, 10]`. `kie_client.create_task` snaps the caller's duration to the nearest valid entry at line 332. Consequences:

1. In multi_shot branch, `duration=total_duration` is passed — a 3-take storyboard of [4, 4, 4] gives total=12, snaps to 10. **Two seconds of requested video silently vanish.**
2. In per-take branch, `duration=int(t["duration"])` is passed — a 3s take snaps to 5s, a 7s take to 5s. This desyncs `calculate_sfx_offsets(take_durations=[...ORIGINAL values...])` at `pipeline.py:504-505` from the actual video timeline, so **SFX hits fire at the wrong moment** and the ambient track's `total_duration` is wrong.

**Fix:** Pre-snap all take durations before generation:
```python
KLING3_VALID = (5, 10)
for t in takes:
    d = int(t.get("duration", 5))
    t["duration"] = min(KLING3_VALID, key=lambda v: abs(v - d))
```
Then the existing offset math works because `take_durations` at `pipeline.py:504` reflects what Kling actually produced.

### H-04: `run_v2_pipeline` mux ffmpeg call is missing `-movflags +faststart`

**File:** `src/product_studio/pipeline.py:530-548`

**Issue:** The final muxed video is persisted to `job_dir/composed_muxed.mp4` without faststart. `export_all_formats` at `format_exporter.py:262-264` then `shutil.copy2`s this file verbatim for the master 9:16 format. **The resulting MP4 has its moov atom at the end, forcing web players to download the full file before playback starts.** All other ffmpeg calls in the codebase include `+faststart`.

**Fix:** Add `"-movflags", "+faststart",` to the cmd at line 534-547.

## Medium Issues

### M-01: `generate_storyboard` JSON parse is not defensive

**File:** `src/product_studio/scene_composer.py:244-272`

`json.loads(response.text)` without try/except (line 244), assumes list shape, accesses required keys without KeyError handling. Gemini occasionally returns partial structures on tight token budgets; a single bad response crashes the pipeline. `int(t["duration"])` also raises ValueError on string like `"4 seconds"`.

### M-02: `auto_select_sfx_for_product` uses a hardcoded catalog index

**File:** `src/product_studio/sfx_library.py:85`

`ambient_id = ambient_candidates[0]["id"] if ambient_candidates else SFX_CATALOG[9]["id"]`. If the catalog is reordered, wrong SFX. Use `_DEFAULT_AMBIENT_ID = "ambient_warmth_01"`.

### M-03: `cost_brl` conversion ignores configured USD→BRL rate

**File:** `src/api/routes/ads.py:646`

`job.cost_brl = float(pipeline_result["cost_usd"]) * 5.0` hardcodes 5.0 while `config.py:12` defines `ADS_USD_TO_BRL = float(os.getenv("ADS_USD_TO_BRL", "5.75"))`. **V2 jobs under-report cost by ~15%.**

### M-04: `ADS_ENABLED` feature flag is never enforced

**File:** `src/product_studio/config.py:6` and all routes in `ads.py`

Flag is defined and documented as a feature gate, but no route checks it. V2 endpoints are live regardless.

### M-05: `run_v2_pipeline` doesn't mark job `step_state` per step

**File:** `src/product_studio/pipeline.py:370-574`

V1 flow uses `step_state` with per-step `status` so frontend stepper can poll progress. V2 orchestrator runs steps 1-6 as a single opaque block; frontend polling sees `pending → processing → complete` with no intermediate feedback over the ~60-120s generation window. Define `ADS_STEP_ORDER_V2` and write status updates between steps.

### M-06: `compose_take_audio` silently falls through when ambient path missing

**File:** `src/product_studio/take_composer.py:108`

The graceful-fallback matches the plan, **but the caller has no way to know the ambient was dropped** — no log, no return signal. An operator whose `assets/sfx/` directory is empty produces completely silent audio with zero errors. Add `logger.warning` calls for ambient fallthrough and SFX skips.

### M-07: `pipeline.py:633` casts `job.takes_config` to `list(...)` without shape check

**File:** `src/api/routes/ads.py:633`

`takes=list(job.takes_config) if job.takes_config else None`. If someone set `takes_config` to a dict manually, `list(dict)` yields keys. Guard with `isinstance(raw_takes, list)`.

### M-08: `_execute_v2_pipeline_task` uses bare `raise` in except (double-logging)

**File:** `src/api/routes/ads.py:651-661`

Raised exception in a FastAPI BackgroundTask is swallowed by the task runner. The bare `raise` serves no purpose beyond the `logger.error` that already provides visibility. Also: if `session.commit()` fails, the outer `raise` re-raises the *original* exception, losing the rollback context.

## Low / Info Issues

- **L-01** `prompt_builder.build_product_prompt` truncates mid-word with `...` — grammatically broken prompts
- **L-02** `pipeline.py:502` uses `.get("ambient_id") or ""` then passes empty string to `resolve_sfx_path`
- **L-03** `normalize_for_kling` last-resort halving may still not fit for very large inputs
- **L-04** `overlay_text` temp files can leak on FFmpeg crash between `NamedTemporaryFile` construction and `tmp_files.append`
- **L-05** subprocess calls with `capture_output=True` + `check=True` swallow stderr on failure — never logged
- **L-06** `run_v2_pipeline` job_dir uses relative path — breaks on non-CWD working dirs
- **L-07** `pipeline.py:307, 347` slice `image_urls[:4]` without comment pointing to upstream limit
- **L-08** `_init_step_state()` creates dead data on v2 rows (see M-05)
- **L-09** `SFX_CATALOG` file_paths are specific filenames with no startup sanity check
- **L-10** `pipeline.py:292` sums durations without `.get("duration", 5)` fallback
- **L-11** `compose_takes` shutil.copy failure doesn't attach context
- **L-12** `models.py:107-118` docstring claims `pipeline_version=1` fallback applies, but migration makes it always-present
- **L-13** `AdJobResponseV2.composed_video_path` duplicates `outputs['composed_video']` — two sources of truth

## Style & Consistency Notes (non-actionable)

- Inline imports for circular-dep breaks match existing `ProductAdPipeline` style ✓
- Module docstrings present and descriptive ✓
- `logger` names follow `clip-flow.<module>` convention ✓
- `Optional[list]` + `Mapped[Optional[list]]` matches SQLAlchemy 2.0 pydantic v2 patterns ✓
- Test mocking (monkeypatch + sys.modules stubs) allows tests to run without httpx/pillow/google-genai ✓

## Findings Summary

| Severity | Count | Must-fix before merge? |
|----------|-------|----------------------|
| Critical | 2 | **Yes — CR-01 (credit bypass) + CR-02 (SSRF)** |
| High | 4 | **Recommended — H-02 breaks Plan 07 UX, H-03 breaks audio sync** |
| Medium | 8 | Follow-up cleanup |
| Low | 13 | Follow-up cleanup |

**Top priorities before marking phase production-ready:** CR-01, CR-02, H-02, H-03. Everything else can land in a gap-closure sub-phase (e.g., 1002.1) or a separate hardening sweep.
