---
phase: 1004-v2-ad-regeneration-ai-prompt-builder-and-seedance-parallel-f
verified: 2026-04-12T22:05:00-03:00
status: human_needed
score: 13/13
overrides_applied: 0
human_verification:
  - test: "Model selector and duration adaptation on /ads/new"
    expected: "All 7+ models listed, selecting Seedance shows 4s/8s durations, selecting Kling shows 5s/10s"
    why_human: "Runtime UI behavior with model switching cannot be verified programmatically"
  - test: "Seedance multi-shot section conditional rendering"
    expected: "SeedanceConfig panel appears only when bytedance/* model is selected, disappears when switching to Kling/Wan"
    why_human: "Conditional rendering depends on runtime React state changes"
  - test: "AI Prompt Builder modal — Kling tab"
    expected: "5W1H fields (WHO/WHAT/WHERE/WHEN/WHY/HOW) appear, character counter shows 1500 limit, assembled prompt updates live"
    why_human: "Modal interaction and live counter require browser rendering"
  - test: "AI Prompt Builder modal — Seedance tab"
    expected: "Narrative pattern select, style direction select, Act 1/2/3 textareas appear; counter shows 2480 limit; 'Usar este prompt' inserts assembled text into scene textarea"
    why_human: "Tab switching and text insertion into parent state requires browser"
  - test: "Detail page scene prompt editing and regeneration"
    expected: "Completed V2 jobs show editable scene prompts; editing and clicking Regenerate sends scene_prompts in network request body"
    why_human: "Requires an existing completed V2 job and network inspection"
---

# Phase 1004: V2 Ad Regeneration, AI Prompt Builder, and Seedance Parallel Flow — Verification Report

**Phase Goal:** Consolidate VIDEO_MODELS, add model selector + duration picker to V2 wizard, create AI prompt builder modal (5W1H for Kling, narrative acts for Seedance), add Seedance multi-shot configuration panel, extend RegenerateV2Request with scene_prompts, and add scene prompt editing to detail page regeneration flow.
**Verified:** 2026-04-12T22:05:00-03:00
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VIDEO_MODELS is defined in exactly one file and imported by all consumers | VERIFIED | `const VIDEO_MODELS` exists only in `memelab/src/lib/video-models.ts`. All 3 consumers (step-video.tsx, ads/new/page.tsx, ads/[jobId]/page.tsx) import from `@/lib/video-models`. No `V2_MODELS` references remain. |
| 2 | Model selector on /ads/new shows all models with durations | VERIFIED (code) | `VIDEO_MODELS.map()` renders all 10 models in a Select component. `getDurations()` drives the duration Select. Needs human to confirm UI renders correctly. |
| 3 | Selecting a model updates clip_duration options to match that model | VERIFIED (code) | `onValueChange` handler calls `getDurations(v)` and resets `clipDuration` if incompatible. Seedance models have `[4, 8]` durations. |
| 4 | scene_prompts from approved compositions are sent in createAdJobV2 payload | VERIFIED | `handleSubmit` maps `approvedComposed.map((c) => c.prompt)` for Kling and `seedanceShots.map(...)` for Seedance, both passed as `scene_prompts` to `createAdJobV2`. |
| 5 | User can open AI prompt builder modal from each scene prompt textarea | VERIFIED (code) | `promptBuilderScene` state + "AI Prompt" button sets scene index in both ads/new/page.tsx and ads/[jobId]/page.tsx. PromptBuilderModal receives `open={promptBuilderScene !== null}`. |
| 6 | Builder shows 5W1H fields for Kling models and narrative/act fields for Seedance models | VERIFIED (code) | PromptBuilderModal uses `isSeedanceModel(modelValue)` to set `defaultTab`. Kling tab has 6 fields (WHO/WHAT/WHERE/WHEN/WHY/HOW) + negative. Seedance tab has pattern/style selects + Act 1/2/3. |
| 7 | Assembled prompt appears in preview with character counter before insertion | VERIFIED (code) | `assembled` computed from active tab's assembly function. `charCount/{maxChars}` counter shown (1500 Kling, 2480 Seedance). Preview `<p>` always visible. |
| 8 | Use this prompt button inserts assembled text into scene textarea | VERIFIED (code) | `onUsePrompt(assembled)` called on button click. In ads/new: updates `composed` state for the target item. In [jobId]: updates `editedPrompts[idx]`. |
| 9 | On detail page, user can edit scene prompts and regenerate with new prompts | VERIFIED (code) | `editedPrompts` state initialized from `jobData.config.scene_prompts`. Editable Textarea per scene. `handleRegenerateV2` includes `editedPrompts` as `overrides.scene_prompts`. |
| 10 | RegenerateV2Request accepts scene_prompts and backend merges them into config | VERIFIED | `models.py` line 120: `scene_prompts: Optional[list[str]] = None` in `RegenerateV2Request`. `ads.py` lines 1296-1297: `if req.scene_prompts is not None: config["scene_prompts"] = req.scene_prompts`. |
| 11 | Seedance multi-shot section appears when a bytedance/* model is selected | VERIFIED (code) | `{isSeedanceModel(videoModel) && <SeedanceConfig .../>}` at line 664 in ads/new/page.tsx. |
| 12 | User can configure 2-4 shots with camera move, duration, and transition per shot | VERIFIED | SeedanceConfig has range slider `min={2} max={4}`, 12 camera moves (all valid TakeConfig literals), 4s/8s duration options, 5 transitions. Per-shot cards render `shots.map()`. |
| 13 | TypeScript compilation passes (no new errors) | VERIFIED | `npx tsc --noEmit` produces exactly 10 errors, all in pre-existing editor/test files unrelated to Phase 1004. Zero new errors in any Phase 1004 file. |

**Score:** 13/13 truths verified (5 require human runtime confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `memelab/src/lib/video-models.ts` | Single source of truth for VIDEO_MODELS | VERIFIED | 29 lines. Exports `VideoModel` interface, `VIDEO_MODELS` (10 models), `isSeedanceModel()`, `getDurations()`. |
| `memelab/src/app/(app)/ads/new/page.tsx` | V2 creation page with model selector, Seedance section, and scene prompt collection | VERIFIED | Imports all 3 functions from video-models.ts. Has model/duration Select UI, conditional SeedanceConfig, PromptBuilderModal, readyToSubmit dual logic. |
| `memelab/src/app/(app)/ads/[jobId]/page.tsx` | Detail page using shared VIDEO_MODELS + editable scene prompts | VERIFIED | Imports VIDEO_MODELS, PromptBuilderModal. Has editedPrompts state, scene prompt Textareas, handleRegenerateV2 with scene_prompts override. |
| `memelab/src/components/ads/step-video.tsx` | V1 step using shared VIDEO_MODELS | VERIFIED | Imports `VIDEO_MODELS` from `@/lib/video-models` (line 16). |
| `memelab/src/components/ads/prompt-builder-modal.tsx` | Modal with 5W1H + Seedance tabs + char counter | VERIFIED | 205 lines. Full implementation with Tabs, 5W1H fields, Seedance narrative fields, live preview with char counter, "Usar este prompt" button. |
| `memelab/src/components/ads/seedance-config.tsx` | Seedance multi-shot configuration panel | VERIFIED | 219 lines. Shot slider (2-4), 4 presets with auto-fill, per-shot cards (subject/camera/duration/transition), all valid camera_move literals. |
| `src/product_studio/models.py` | RegenerateV2Request with scene_prompts field | VERIFIED | Line 120: `scene_prompts: Optional[list[str]] = None` present in `RegenerateV2Request`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `video-models.ts` | `ads/new/page.tsx` | `import { VIDEO_MODELS, getDurations, isSeedanceModel }` | WIRED | Line 21 in ads/new/page.tsx |
| `video-models.ts` | `ads/[jobId]/page.tsx` | `import { VIDEO_MODELS }` | WIRED | Line 12 in ads/[jobId]/page.tsx |
| `video-models.ts` | `step-video.tsx` | `import { VIDEO_MODELS }` | WIRED | Line 16 in step-video.tsx |
| `ads/new/page.tsx` | `/ads/create-v2` | `createAdJobV2({ scene_prompts, video_model, clip_duration })` | WIRED | Lines 301-309 in ads/new/page.tsx |
| `prompt-builder-modal.tsx` | `ads/new/page.tsx` | `import + render in scene prompt section` | WIRED | Lines 22 + 764-778 in ads/new/page.tsx |
| `prompt-builder-modal.tsx` | `ads/[jobId]/page.tsx` | `import + render in V2 section` | WIRED | Lines 13 + 370-381 in ads/[jobId]/page.tsx |
| `ads/[jobId]/page.tsx` | `/ads/{jobId}/regenerate-v2` | `regenerateAdJobV2 with scene_prompts override` | WIRED | Lines 127-128 in ads/[jobId]/page.tsx |
| `src/api/routes/ads.py` | `src/product_studio/models.py` | `req.scene_prompts merge into config` | WIRED | Lines 1296-1297 in ads.py |
| `seedance-config.tsx` | `ads/new/page.tsx` | `isSeedanceModel conditional render` | WIRED | Lines 23 + 664-676 in ads/new/page.tsx |
| `ads/new/page.tsx` | `/ads/create-v2` | `createAdJobV2 with Seedance shots mapped to scene_prompts` | WIRED | Lines 288-308 in ads/new/page.tsx |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `prompt-builder-modal.tsx` | `assembled` | Local state (who/what/etc or act1/2/3), assembled synchronously | Yes — user input directly populates fields | FLOWING |
| `ads/new/page.tsx` | `scene_prompts` in submit | `approvedComposed.map(c => c.prompt)` or `seedanceShots.map(...)` | Yes — driven by user-entered composition prompts or shot subjects | FLOWING |
| `ads/[jobId]/page.tsx` | `editedPrompts` | Initialized from `jobData.config.scene_prompts` via useEffect | Yes — loaded from actual job config stored in backend | FLOWING |
| `seedance-config.tsx` | `shots` | Controlled by parent state in ads/new/page.tsx, preset auto-fill | Yes — preset fills cameraMove/transition, user fills subject | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| VIDEO_MODELS defined exactly once | `grep -r "const VIDEO_MODELS" memelab/src/` | 1 result (video-models.ts only) | PASS |
| No V2_MODELS references remain | `grep -r "V2_MODELS" memelab/src/` | 0 results | PASS |
| scene_prompts in RegenerateV2Request | `grep "scene_prompts" src/product_studio/models.py` | Line 120: `Optional[list[str]] = None` | PASS |
| scene_prompts merge in backend | `grep "req.scene_prompts" src/api/routes/ads.py` | Lines 1296-1297: merge logic present | PASS |
| PromptBuilderModal imported in both pages | `grep "PromptBuilderModal" memelab/src/app/(app)/ads/*/page.tsx` | Found in both new/page.tsx and [jobId]/page.tsx | PASS |
| TypeScript no new errors | `npx tsc --noEmit` | 10 errors, all pre-existing in editor/test files | PASS |
| All 3 consumers import from shared file | grep imports | step-video.tsx, ads/new/page.tsx, [jobId]/page.tsx all import from `@/lib/video-models` | PASS |
| isSeedanceModel conditional rendering | `grep "isSeedanceModel" ads/new/page.tsx` | Conditional `&&` at line 664 guards SeedanceConfig render | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| P1004-01 | 1004-01 | VIDEO_MODELS shared constant | SATISFIED |
| P1004-02 | 1004-01 | Model selector on V2 creation wizard | SATISFIED |
| P1004-03 | 1004-01 | Duration picker adapts to selected model | SATISFIED |
| P1004-04 | 1004-02 | AI prompt builder modal component | SATISFIED |
| P1004-05 | 1004-02 | 5W1H fields for Kling models | SATISFIED |
| P1004-06 | 1004-02 | Narrative act fields for Seedance models | SATISFIED |
| P1004-07 | 1004-03 | Seedance multi-shot configuration panel | SATISFIED |
| P1004-08 | 1004-02 | RegenerateV2Request scene_prompts + scene prompt editing | SATISFIED |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `seedance-config.tsx` | `placeholder=` attributes in Textareas | Info | HTML placeholder attributes for UX guidance — not stubs. These are user-facing hint text, not empty implementations. |
| `prompt-builder-modal.tsx` | `placeholder=` attributes on all Textareas | Info | Same as above — HTML input placeholders, not code stubs. |

No blockers or warnings found. All placeholder matches are HTML input `placeholder=` attributes, not implementation stubs.

---

### Human Verification Required

#### 1. Model selector and duration adaptation on /ads/new

**Test:** Go to `/ads/new`, upload 1-2 images, advance to step 2. Verify the model selector dropdown shows all 10 models. Select "Seedance Lite" — verify duration options change to 4s and 8s. Select "Kling 3.0" — verify duration options return to 5s and 10s.
**Expected:** Model switching triggers immediate duration option update. No stale durations.
**Why human:** Runtime React state transitions with dropdown interactions cannot be verified by static code analysis.

#### 2. Seedance multi-shot section conditional rendering

**Test:** On `/ads/new`, select a Seedance (bytedance/*) model. Verify the "Seedance Multi-Shot" card appears below the model/duration selectors. Change shot count slider from 3 to 4 — verify a 4th shot card appears. Select "Dynamic" preset — verify camera moves auto-fill. Switch model to "Kling 3.0" — verify the Seedance section disappears entirely.
**Expected:** Section appears only for bytedance/* models. Preset auto-fill works. Slider adds/removes cards.
**Why human:** Conditional rendering and real-time state changes require browser runtime.

#### 3. AI Prompt Builder modal — Kling 5W1H tab

**Test:** On `/ads/new` with a Kling model, advance to the composition step and click "AI Prompt" next to a scene. Verify modal opens on Kling 5W1H tab. Fill in WHO and WHAT fields — verify the preview section updates with assembled text and the counter (e.g. "45/1500") increments. Click "Usar este prompt" — verify text appears in the scene's textarea.
**Expected:** 6 labeled fields (WHO/WHAT/WHERE/WHEN/WHY/HOW) + negative. Live preview. 1500 char limit shown.
**Why human:** Modal open/close, tab state, text insertion into parent component state.

#### 4. AI Prompt Builder modal — Seedance narrative tab

**Test:** With a Seedance model selected, click "AI Prompt" on a scene. Verify modal opens on Seedance Narrative tab by default (or the tab auto-selects). Verify narrative pattern Select, style direction Select, and Act 1/2/3 Textareas are present. Fill Act 1 — verify preview shows assembled text with 2480 char limit.
**Expected:** Auto-tab selection to Seedance when modelValue is bytedance/*. 2480 char counter.
**Why human:** `defaultValue` vs active tab behavior and tab switching requires browser.

#### 5. Detail page scene prompt editing and regeneration

**Test:** Open an existing completed V2 job at `/ads/[jobId]`. Verify that if the job has scene_prompts in its config, editable Textareas appear for each prompt. Edit one prompt text. Click Regenerate (or the regeneration button). Inspect the network request — verify the body contains `scene_prompts` array with the edited value.
**Expected:** Edited prompts flow through to the backend regeneration API call.
**Why human:** Requires an existing completed V2 job and browser DevTools network inspection.

---

### Gaps Summary

No automated gaps found. All 13 truths verified by code inspection. 10 TypeScript errors exist but are all pre-existing in unrelated editor/test files (confirmed identical to errors documented in summaries). Phase 1004 files compile cleanly.

5 human verification items remain for runtime behavior that cannot be verified by static analysis.

---

_Verified: 2026-04-12T22:05:00-03:00_
_Verifier: Claude (gsd-verifier)_
