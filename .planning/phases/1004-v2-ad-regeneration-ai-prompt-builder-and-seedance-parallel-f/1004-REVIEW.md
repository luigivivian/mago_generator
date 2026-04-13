---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
reviewed: 2026-04-12T22:30:00-03:00
depth: standard
files_reviewed: 9
files_reviewed_list:
  - memelab/src/lib/video-models.ts
  - memelab/src/lib/api.ts
  - memelab/src/components/ads/prompt-builder-modal.tsx
  - memelab/src/components/ads/seedance-config.tsx
  - memelab/src/components/ads/step-video.tsx
  - memelab/src/app/(app)/ads/new/page.tsx
  - memelab/src/app/(app)/ads/[jobId]/page.tsx
  - src/api/routes/ads.py
  - src/product_studio/models.py
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 1004: Code Review Report

**Reviewed:** 2026-04-12T22:30:00-03:00
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase ships V2 ad regeneration, the AI Prompt Builder modal, and the Seedance parallel multi-shot flow. The architecture is clean and the new flows are coherent. The most serious issues are (1) a missing auth guard on the file-serving endpoint and (2) a missing max-count validation on the upload-images endpoint. Beyond those, there are four meaningful logic bugs: the `promptOverride` field in `StepVideo` is UI-only and never wired to the regenerate call; `handleRegenSingle` uses a raw array index as its identity key while the composed list can shift; the upload endpoint in `new/page.tsx` bypasses the API proxy and hardcodes a localhost URL; and the Seedance `Use this prompt` button is never disabled when all fields are empty.

---

## Critical Issues

### CR-01: File-serve endpoint has no authentication

**File:** `src/api/routes/ads.py:1238-1265`
**Issue:** `GET /ads/{job_id}/file/{filename}` explicitly skips authentication (comment: "No auth — UUID is unguessable"). This is a security assumption, not a security control. A UUID job ID leaked anywhere (logs, browser history, shared link) gives any unauthenticated actor read access to all artifacts in that job's output directory, including composed images, generated videos, and audio files. The filename is sanitized against path traversal, but no ownership check is performed.
**Fix:**
```python
# Add current_user dependency and ownership check, same as every other endpoint.
@router.get("/{job_id}/file/{filename}")
async def serve_ad_file(
    job_id: str,
    filename: str,
    db: AsyncSession = Depends(db_session),
    current_user=Depends(get_current_user),  # add this
):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    job = await _get_user_job(job_id, current_user.id, db)  # ownership enforced here
    ...
```

### CR-02: Upload-images endpoint does not enforce the 4-image maximum

**File:** `src/api/routes/ads.py:450-484`
**Issue:** The docstring says "Validates count (1-4)" and the Pydantic model `AdCreateRequestV2` enforces `max_length=4` on `image_urls`, but the upload endpoint itself only validates `len(files) < 1`. A caller can POST 100 images, triggering 100 Pillow normalizations and 100 GCS uploads in parallel. This is an unbounded resource consumption vector — no credits are deducted for GCS storage at upload time.
**Fix:**
```python
if len(files) < 1:
    raise HTTPException(400, "Upload at least 1 image")
if len(files) > 4:
    raise HTTPException(400, "Maximum 4 images per upload")
```

---

## Warnings

### WR-01: `promptOverride` state in StepVideo is collected but never sent

**File:** `memelab/src/components/ads/step-video.tsx:101-103, 148, 211`
**Issue:** `VideoConfig` renders a `Textarea` for `promptOverride` and the user can edit it, but `handleRegenerate` only sends `{ video_model, target_duration }` to `onRegenerate`. The edited prompt is silently discarded on every regenerate click, making the field non-functional. The `onRegenerate` prop type does not include a `prompt` field.
**Fix:** Add `prompt_override` to the regeneration overrides interface and pass it through:
```tsx
// Props type
onRegenerate: (overrides?: { video_model?: string; target_duration?: string; prompt_override?: string }) => void;

// handleRegenerate call
onClick={() => handleRegenerate({ video_model: model, target_duration: duration, prompt_override: promptOverride || undefined })}
```
The backend `regenerate_ad_step` already accepts arbitrary body params and stores them under `step_params_{step_name}`, so the plumbing exists; the frontend is the only missing piece.

### WR-02: `handleRegenSingle` uses array index as identity — stale if list shrinks

**File:** `memelab/src/app/(app)/ads/new/page.tsx:197-221`
**Issue:** `handleRegenSingle(compIdx)` captures the index at click time, starts an async operation, and later updates `composed` at `i === compIdx`. If the user removes an earlier item while the request is in flight, `compIdx` points to the wrong item on completion. The composed list is also updated with `prev.map((c, i) => i === compIdx ? ...)` using the index, not identity.
**Fix:** Use object identity instead of index:
```tsx
const handleRegenSingle = (item: ComposedImage, customPrompt?: string) => {
  const prompt = customPrompt || item.prompt;
  withBusy("regenerating", async () => {
    const data = await composePreview({ image_url: heroImage!.url, prompt, count: 1 });
    setComposed((prev) =>
      prev.map((c) => c === item ? { ...c, url: data.composed_urls[0], prompt, approved: false } : c)
    );
  });
};
```

### WR-03: Upload in `new/page.tsx` hardcodes `http://127.0.0.1:8000` instead of using the API proxy

**File:** `memelab/src/app/(app)/ads/new/page.tsx:131`
**Issue:** The upload fetch goes directly to `http://127.0.0.1:8000/ads/upload-images`, bypassing the Next.js rewrite proxy at `/api`. This works locally only. In any deployed environment (Vercel, staging, preview), the hardcoded address will fail with a network error. Every other API call in the codebase goes through `request()` in `api.ts` which uses the proxied `/api` base.
**Fix:**
```tsx
// Replace the inline fetch with the api.ts pattern
const token = getAuthToken();
const formData = new FormData();
for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
const res = await fetch("/api/ads/upload-images", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
  body: formData,
});
```

### WR-04: Seedance "Usar este prompt" button is never disabled when content is empty

**File:** `memelab/src/components/ads/prompt-builder-modal.tsx:77-81, 198`
**Issue:** `assembleSeedancePrompt()` unconditionally pushes `"Style: product."` (or whichever style is selected), so `assembled` is always non-empty even if the user fills in nothing. The button `disabled={!assembled.trim()}` is therefore always enabled for the Seedance tab, and clicking it submits `"Style: product."` as the prompt — a useless partial string.
**Fix:** Gate the button on meaningful content (at least one act is filled):
```tsx
const seedanceReady = !isSeedance || !!(act1 || act2 || act3);
// ...
<Button ... disabled={!assembled.trim() || !seedanceReady}>
```
Alternatively, exclude the static style line from the "is empty" check:
```tsx
const hasContent = isSeedance ? !!(act1 || act2 || act3) : !!assembled.trim();
<Button ... disabled={!hasContent}>
```

---

## Info

### IN-01: `AdJob` interface in `api.ts` is missing v2 fields used via casts

**File:** `memelab/src/lib/api.ts:1835-1846`
**Issue:** The `AdJob` interface does not include `config`, `image_urls`, `category`, `error_message`, or `outputs` (typed as `Record<string, string>` but backend returns nested objects). Multiple call sites in `[jobId]/page.tsx` work around this with `as unknown as Record<string, unknown>` and `(jobData as any)?.outputs`. These casts suppress type errors but create invisible coupling between the runtime shape and the TypeScript model.
**Fix:** Extend the interface with the v2 fields that are actively used:
```ts
export interface AdJob {
  // existing fields...
  config?: Record<string, unknown>;
  image_urls?: string[];
  category?: string;
  error_message?: string;
  outputs?: Record<string, unknown> | null;
}
```

### IN-02: `scene_index` in `generate-kling-prompt` will throw on non-integer input

**File:** `src/api/routes/ads.py:570`
**Issue:** `scene_index = int(req.get("scene_index", 0))` raises `ValueError` if the frontend sends a non-integer string (e.g., `"abc"`). The endpoint accepts `req: dict` with no validation — a malformed request produces an unhandled 500 rather than a 400. The same pattern exists for `count` at lines 639 and 696, where those values are also guarded only by `min()`/`max()`, not by a try/except.
**Fix:** Use `try/except ValueError` or switch to a Pydantic model for these endpoints.

### IN-03: SeedanceConfig `duration` selector only offers 4s and 8s, ignoring model durations

**File:** `memelab/src/components/ads/seedance-config.tsx:193-198`
**Issue:** The per-shot duration select is hardcoded to `[4, 8]`. The `VIDEO_MODELS` entries for Seedance models define `durations: [4, 8]` which happens to match, but the `getDurations(modelValue)` utility already exists to retrieve the right options dynamically. If a future Seedance model supports different durations, this component would not update automatically.
**Fix:** Accept `modelValue` as a prop and use `getDurations(modelValue)` to populate the selector. This is a minor coupling issue, not a current correctness bug.

---

_Reviewed: 2026-04-12T22:30:00-03:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
