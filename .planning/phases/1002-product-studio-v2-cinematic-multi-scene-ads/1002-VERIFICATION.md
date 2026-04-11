---
phase: 1002-product-studio-v2-cinematic-multi-scene-ads
verified: 2026-04-10T22:15:00-03:00
status: human_needed
score: 9/11
overrides_applied: 0
gaps:
  - truth: "Credit system not deducted for v2 pipeline execution (CR-01)"
    status: failed
    reason: "_execute_v2_pipeline_task calls run_v2_pipeline with no CreditService.check_and_deduct anywhere in the v2 code path. V1 path deducts credits in both video and audio steps. Users run unlimited Kling calls at zero credit cost."
    artifacts:
      - path: "src/api/routes/ads.py"
        issue: "_execute_v2_pipeline_task (line 604-661) has no credit deduction or refund on failure"
    missing:
      - "Call CreditService.check_and_deduct before run_v2_pipeline, refund in except block"
  - truth: "image_urls validated against allowed hosts to prevent SSRF (CR-02)"
    status: failed
    reason: "AdCreateRequestV2.image_urls is list[str] with length bounds only — no HttpUrl type, no scheme whitelist, no host deny-list. run_v2_pipeline downloads each URL via httpx.AsyncClient, making the server an open proxy to internal metadata endpoints (e.g., GCP/AWS instance metadata)."
    artifacts:
      - path: "src/product_studio/models.py"
        issue: "image_urls: list[str] at line 100 — no URL type validation, no host allowlist"
      - path: "src/product_studio/pipeline.py"
        issue: "run_v2_pipeline downloads image_urls unconditionally via httpx.AsyncClient"
    missing:
      - "Change image_urls to list[HttpUrl] with field_validator enforcing https + GCS host allowlist"
human_verification:
  - test: "End-to-end v2 UI flow: upload 3-4 product images, verify take editor renders 3-5 cards with editable fields, click Render"
    expected: "POST /ads/upload-images returns image_urls; /ads/new shows TakeEditor with 3-5 auto-generated cards; each card has camera, action, duration, transition, and SFX fields; clicking Render triggers POST /ads/create-v2"
    why_human: "Interactive browser UX cannot be verified from grep/AST checks; test_04 is only a file-existence gate"
  - test: "V1 jobs still visible in /ads/jobs after POST /ads/create-v2 jobs exist"
    expected: "Both v1 and v2 jobs appear in the listing; v1 rows have pipeline_version=1 + empty v2 fields; v2 rows have pipeline_version=2"
    why_human: "Requires running DB with migration 040 applied and existing v1 job rows"
  - test: "Run alembic upgrade head against the actual database"
    expected: "Migration 040_product_ad_v2 applies cleanly; product_ad_jobs gains pipeline_version, takes_config, storyboard, image_urls, category columns; existing v1 rows auto-populate pipeline_version=1"
    why_human: "Migration 040 is written and verified (AST clean, down_revision=030 is correct head) but has NOT been run. No DB changes are safe until a developer runs this manually."
  - test: "Rendered v2 job shows populated take cards in /ads/{job_id}"
    expected: "After pipeline completes, GET /ads/{job_id} returns takes field with TakeConfig objects (not empty list)"
    why_human: "H-02 in code review: _job_to_response hardcodes takes=[] even when takes_config is populated. Needs fix before this passes; flagged as known bug."
---

# Phase 1002: Product Studio v2 Verification Report

**Phase Goal:** Build Product Studio v2 — a cinematic multi-scene ads pipeline using category-aware prompt templates, Kling 3.0 multi-image video generation, SFX/audio layering, multi-format export, and a card-based frontend take editor. Must maintain backward compatibility with v1 jobs.
**Verified:** 2026-04-10T22:15:00-03:00
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Multi-image upload endpoint (1-4 images, validated) | VERIFIED | `@router.post("/upload-images")` at `ads.py:409`; validates `len(files) 1-4` and content_type whitelist |
| 2 | Image treatment: normalize for Kling (min 300px, max 10MB JPEG) | VERIFIED | `normalize_for_kling` at `scene_composer.py:126`; `KLING_MIN_PX=300`, `KLING_MAX_BYTES=10MB` |
| 3 | AI scene generation via Gemini structured output | VERIFIED | `async def generate_storyboard` at `scene_composer.py:160`; uses `response_schema`, calls `build_product_prompt` |
| 4 | Card-based take editor (camera/action/duration/transition/SFX editable) | VERIFIED (file gate) | `TakeEditor`, `TakeCard`, `SFXPicker` components exist; `/ads/new` page mounts TakeEditor; full UX needs human QA |
| 5 | Category-aware prompt templates (7 categories) | VERIFIED | `CATEGORY_CONFIGS` has all 7 keys (`food_cookies`, `food_chocolate`, `food_burger`, `beauty_skincare`, `fashion_shoes`, `tech_electronics`, `beverage`); `build_product_prompt` wired |
| 6 | Kling multi-image generation (`kling_elements` + `multi_prompt`) | VERIFIED | `_build_payload` extended with `extra: dict \| None`; `kling_elements` + `multi_prompt` in `kling_v3` branch; `run_step_generation_v2` on pipeline |
| 7 | SFX library (catalog + category filter + auto-select) | VERIFIED | `SFX_CATALOG` (12 entries), `get_sfx_by_id`, `get_sfx_by_category`, `auto_select_sfx_for_product` in `sfx_library.py` |
| 8 | Audio mixing (ambient base + SFX with xfade-aware offsets) | VERIFIED | `compose_take_audio` + `calculate_sfx_offsets` in `take_composer.py`; ffmpeg amix with adelay; xfade offset formula correct |
| 9 | Video composition (per-transition-type stitching) | VERIFIED | `compose_takes` reuses `concat_segments` iteratively; handles all 5 transition types |
| 10 | Multi-format export (9:16, 1:1, 16:9 + thumbnail) | VERIFIED | `export_takes_multi_format` at `format_exporter.py:280`; `generate_thumbnail` at line 328 |
| 11 | Backward compat (v1 jobs still work, pipeline_version routing) | VERIFIED | `_job_to_response` returns `AdJobResponseV2` for all rows; v1 rows get `pipeline_version=1`; migration adds nullable columns with `server_default='1'` |

**Score:** 9/11 truths verified (two gaps noted; both are security/production-safety issues on an otherwise-complete implementation)

### Deferred Items

None. All 11 requirements are claimed by plans in this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/test_product_studio_v2.py` | 11 live tests (all xfail removed) | VERIFIED | 0 `@pytest.mark.xfail` decorators remain; 12 test functions total (11 + test_11b) |
| `src/product_studio/models.py` | TakeConfig, StoryboardScene, AdCreateRequestV2, AdJobResponseV2 | VERIFIED | All 4 classes at lines 77-119 |
| `src/database/models.py` | pipeline_version, takes_config, storyboard, image_urls, category columns | VERIFIED | Lines 874-878; SQLAlchemy 2.0 Mapped[] style |
| `src/database/migrations/versions/040_product_ad_v2_columns.py` | Alembic migration with down_revision='030' | VERIFIED | revision='040_product_ad_v2', down_revision='030', upgrade()/downgrade() present |
| `src/product_studio/config.py` | CATEGORY_CONFIGS with 7 entries | VERIFIED | 7 keys confirmed by Python import |
| `src/product_studio/prompt_builder.py` | build_product_prompt, build_negative_prompt | VERIFIED | Both functions at lines 83, 139 |
| `src/product_studio/scene_composer.py` | normalize_for_kling, generate_storyboard | VERIFIED | Lines 122-154 (normalize), 160+ (storyboard) |
| `src/api/routes/ads.py` | POST /upload-images, POST /create-v2, backward-compat GET /jobs | VERIFIED | Lines 409, 548, 664 |
| `src/video_gen/kie_client.py` | _build_payload + create_task + generate_video with extra param | VERIFIED | extra: dict \| None at lines 130, 287, 562 |
| `src/product_studio/pipeline.py` | run_step_generation_v2, run_v2_pipeline | VERIFIED | Lines 259, 370 |
| `src/product_studio/sfx_library.py` | SFX_CATALOG (12+), get_sfx_by_id, get_sfx_by_category, auto_select_sfx_for_product | VERIFIED | All functions present; 12 catalog entries |
| `src/product_studio/take_composer.py` | compose_takes, compose_take_audio, calculate_sfx_offsets | VERIFIED | Lines 18, 82, 159 |
| `src/product_studio/format_exporter.py` | export_takes_multi_format, generate_thumbnail | VERIFIED | Lines 280, 328 |
| `assets/sfx/README.md` | Operator SFX bundling instructions | VERIFIED | File exists |
| `memelab/src/components/ads/take-editor.tsx` | TakeEditor export | VERIFIED | export function TakeEditor at line 47 |
| `memelab/src/components/ads/take-card.tsx` | TakeCard export | VERIFIED | export function TakeCard at line 27 |
| `memelab/src/components/ads/sfx-picker.tsx` | SFXPicker export | VERIFIED | export function SFXPicker at line 33 |
| `memelab/src/components/ads/category-config.ts` | CATEGORIES, CAMERA_MOVES, TRANSITIONS | VERIFIED | All three exports confirmed at lines 4, 14, 22 |
| `memelab/src/__tests__/take-editor.test.tsx` | Vitest config-model test | VERIFIED | File exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/test_product_studio_v2.py` | `src/product_studio/models.py` | `from src.product_studio.models import` | WIRED | Imports TakeConfig, StoryboardScene, etc. |
| `src/product_studio/prompt_builder.py` | `src/product_studio/config.py` | `from src.product_studio.config import CATEGORY_CONFIGS` | WIRED | Import inside build_product_prompt |
| `src/api/routes/ads.py` | `src/product_studio/scene_composer.py` | `normalize_for_kling` | WIRED | Line 430 import, called at line 446 |
| `src/api/routes/ads.py` | `src/product_studio/pipeline.py` | `ProductAdPipeline` | WIRED | Line 610 import in _execute_v2_pipeline_task |
| `src/product_studio/pipeline.py` | `src/product_studio/take_composer.py` | `from src.product_studio.take_composer import` | WIRED | Lines 430-433; compose_takes, compose_take_audio called at 491, 523 |
| `src/product_studio/take_composer.py` | `src/reels_pipeline/video_builder.py` | `concat_segments` | WIRED | Line 40 import, called iteratively in compose_takes |
| `memelab/src/app/(app)/ads/new/page.tsx` | `memelab/src/components/ads/take-editor.tsx` | `import TakeEditor` | WIRED | Line 8 import, mounted at line 115 |
| `memelab/src/components/ads/take-editor.tsx` | `POST /ads/create-v2` | `fetch("/api/ads/create-v2", ...)` | WIRED | Line 113 |

### Requirements Coverage

| Requirement | Plan(s) | Description | Status | Evidence |
|-------------|---------|-------------|--------|----------|
| REQ-PS2-01 | 01, 03 | Multi-image upload endpoint (1-4 images, validated) | SATISFIED | `upload_product_images` in ads.py:409; validates count + content_type |
| REQ-PS2-02 | 03 | Image treatment (normalize for Kling: min 300x300, max 10MB) | SATISFIED | `normalize_for_kling` in scene_composer.py:126 |
| REQ-PS2-03 | 04 | AI scene generation (generate_storyboard with Gemini Vision) | SATISFIED | `generate_storyboard` in scene_composer.py:160; Gemini structured output with response_schema |
| REQ-PS2-04 | 07 | Take editor UI (card-based, editable camera/action/duration/transition/sfx) | SATISFIED (code gate) | TakeEditor, TakeCard, SFXPicker all ship; UX path needs human walkthrough |
| REQ-PS2-05 | 02 | Category-aware prompt templates (7 categories) | SATISFIED | CATEGORY_CONFIGS with 7 entries; build_product_prompt verified by Python import |
| REQ-PS2-06 | 04 | Kling multi-image video generation (kling_elements array) | SATISFIED | kling_v3 branch accepts extra.kling_elements + extra.multi_prompt; run_step_generation_v2 routes multi_shot vs per_take |
| REQ-PS2-07 | 05 | SFX library (catalog + lookup + auto-select) | SATISFIED | 12-entry SFX_CATALOG; get_sfx_by_id, get_sfx_by_category, auto_select_sfx_for_product |
| REQ-PS2-08 | 05 | Audio mixing (ambient base + SFX with xfade-aware offsets) | SATISFIED | compose_take_audio + calculate_sfx_offsets; H-03 (duration snap desyncs offsets) is a bug, not a missing feature |
| REQ-PS2-09 | 05 | Video composition (per-transition-type stitching) | SATISFIED | compose_takes with iterative concat_segments; 5 transition types supported |
| REQ-PS2-10 | 06 | Multi-format export (9:16, 1:1, 16:9 + thumbnail) | SATISFIED | export_takes_multi_format + generate_thumbnail in format_exporter.py |
| REQ-PS2-11 | 01, 06 | Backward compat (v1 jobs still work, pipeline_version routing) | SATISFIED | Single _job_to_response serializer; v1 rows get pipeline_version=1; migration nullable columns |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/api/routes/ads.py:604` | No `CreditService.check_and_deduct` in `_execute_v2_pipeline_task` | Blocker | Users make unlimited Kling API calls at zero cost; discovered as CR-01 in code review |
| `src/product_studio/models.py:100` | `image_urls: list[str]` with no URL type or host validation | Blocker | SSRF: server fetches attacker-supplied URLs including GCP/AWS metadata endpoints; CR-02 in code review |
| `src/api/routes/ads.py:109` | `takes=[]` hardcoded in `_job_to_response` | Warning | H-02: Plan 07 frontend shows blank take cards on completed v2 jobs despite data being persisted in takes_config |
| `src/product_studio/pipeline.py:504` | `calculate_sfx_offsets` uses caller-supplied durations, but Kling snaps 3s→5s, 7s→5s | Warning | H-03: SFX hits fire at wrong timestamps after Kling duration snap; audio sync incorrect on short takes |
| `src/product_studio/pipeline.py:530-548` | mux ffmpeg call missing `-movflags +faststart` | Info | H-04: Web video playback requires full download before start; inconsistent with rest of codebase |
| `src/api/routes/ads.py:422-428` | `content_type` check trusts client-supplied multipart header | Info | H-01: Polyglot files can bypass format check; Pillow still validates bytes but no size cap |

### Human Verification Required

#### 1. Database Migration

**Test:** Run `alembic upgrade head` against the active database.
**Expected:** Migration `040_product_ad_v2` applies cleanly. Table `product_ad_jobs` gains `pipeline_version` (default 1), `takes_config`, `storyboard`, `image_urls`, `category`. Existing v1 rows populate `pipeline_version=1` automatically.
**Why human:** The migration file is created and AST-verified, but it has not been executed against any database. The ORM model and migration are in sync — this is purely a deployment step.

#### 2. End-to-End Take Editor UX

**Test:** Open `/ads/new` in browser, upload 3-4 product images, wait for storyboard generation, verify take cards appear with all editable fields, click Render.
**Expected:** Upload triggers POST `/ads/upload-images`; TakeEditor renders with 3-5 cards showing camera move dropdown, action text, duration slider, transition selector, SFX picker; Render button triggers POST `/ads/create-v2`; job polling shows progress.
**Why human:** Interactive browser UX. `test_04_take_editor` is a file-existence gate only. Vitest tests cover config-model contracts but not the upload-to-render flow.

#### 3. V1/V2 Mixed Job Listing

**Test:** With migration applied and existing v1 jobs in DB, call GET `/ads/jobs`.
**Expected:** Both v1 and v2 jobs appear; v1 rows have `pipeline_version: 1`, `takes_config: null`, `image_urls: []`; v2 rows have `pipeline_version: 2` and populated fields.
**Why human:** Requires live DB with migration 040 applied.

#### 4. Completed V2 Job Take Fields (H-02)

**Test:** After a v2 job completes, call GET `/ads/{job_id}`.
**Expected:** Response `takes` field is populated with TakeConfig objects, not empty array.
**Why human:** Known bug (H-02): `_job_to_response` hardcodes `takes=[]`; `takes_config` is populated but `takes` is not coerced from it. This is a known issue from the code review that needs to be fixed before this passes.

### Gaps Summary

Two security issues from the code review constitute real gaps that must be resolved before production deployment:

**CR-01 — Credit bypass:** `_execute_v2_pipeline_task` runs the entire v2 pipeline (potentially multiple Kling 3.0 API calls at ~$0.20-$0.80 per call) with no credit check or deduction. The v1 path has explicit `CreditService.check_and_deduct` guards in both video and audio steps. This is a billing integrity issue.

**CR-02 — SSRF:** `AdCreateRequestV2.image_urls` is `list[str]` with no URL validation beyond length bounds. The pipeline downloads each URL via `httpx.AsyncClient`. A caller can submit cloud provider metadata URLs (`http://169.254.254.169/...`) to exfiltrate instance credentials. The plan described these as "GCS URLs from /upload-images" but the endpoint does not enforce that constraint.

Both gaps are code-level fixes (not architectural changes) and are well-defined by the code review. Four additional High findings (H-01 through H-04) are bugs that affect correctness and UX but do not block goal verification — the pipeline architecture is complete and working.

---

## Recommendation

**Do not deploy to production until CR-01 and CR-02 are resolved.** Both fixes are mechanical:
- CR-01: ~20 lines following the v1 credit pattern already in ads.py
- CR-02: Swap `list[str]` to `list[HttpUrl]` + 10-line field_validator

**Run migration 040 before any UAT.** All DB-dependent human verification tests require the schema to be current.

**H-02 should be fixed before UAT** because the take editor's post-render state depends on `takes` being populated. Without it, the UX flow from render → review completed job is broken.

The phase architecture is sound: all 11 requirements have implementations, all 11 tests are live (no xfail stubs remain), the backward-compat strategy (nullable columns, subclass response model, single serializer) is correct, and the module boundaries are clean.

---

_Verified: 2026-04-10T22:15:00-03:00_
_Verifier: Claude (gsd-verifier)_
