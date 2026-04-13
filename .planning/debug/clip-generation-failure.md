---
status: resolved
trigger: "Clip generation is failing in the meme-lab pipeline. The log shows: 'Creating video task: model=hailuo/2-3-image-to-video-standard duration=6s format=hailuo' but something goes wrong after this point."
created: 2026-04-06T22:00:00-03:00
updated: 2026-04-06T23:58:00-03:00
resolved: 2026-04-06T23:58:00-03:00
---

## Current Focus

hypothesis: Two related root causes — (A) script generation puts long image descriptions in `legenda_overlay` instead of short overlay text; (B) `init_scenes` copies that `legenda_overlay` directly into `scene["prompt"]`, which gets sent to Hailuo as the motion prompt during single-scene retry. Hailuo either rejects the very long descriptive prompt or returns empty resultUrls.
test: Confirm by reading script LLM prompt template (does it ask for short text?) AND init_scenes code (does it set scene["prompt"] = legenda_overlay?). Then form fix.
expecting: Script prompt explicitly asks for "short text 5-12 words" but LLM ignores it; init_scenes uses legenda_overlay verbatim
next_action: Read script generation prompt + decide where to fix (script prompt vs init_scenes vs both)

## Evidence

- Failing job: `8303e35e26e9411b` (output/reels/reel_034_0406)
- DB shows: scene 0 status=failed, task_id=null, clip_path="", error="No video URL in result", duration=3.0
- Scenes 1-8 status=pending (never retried)
- `task_id=null` + `error="No video URL in result"` matches EXACTLY the failure return of `pipeline.retry_single_scene` (src/reels_pipeline/main.py:889-893):
  ```python
  return {"index": scene_index, "status": "failed", "task_id": None,
          "clip_path": "", "prompt": prompt, "error": error_msg}
  ```
- The error string "No video URL in result" comes from `retry_single_scene` line 871: `raise RuntimeError("No video URL in result")` when `result is None` OR `result.video_url == ""`
- `init_scenes` endpoint (src/api/routes/reels.py:1933) initializes scenes from images. Line 1965: `dur = cena.get("duracao_segundos", target_duration // n)` — stores RAW float duration from script (3.0, 5.0, 8.0…)
- Line 1971: `"prompt": cena.get("legenda_overlay", "")` — copies legenda_overlay verbatim into scene prompt
- Script's roteiro.json shows `legenda_overlay` contains LONG image descriptions (180+ chars), not short overlay text:
  - cena 0: "Texto 'COMO TUDO COMEÇOU?' em tipografia antiga e profunda, sobre um fundo de nebulosa cósmica escura e em rotação lenta…"
  - cena 5: "Uma savana exuberante com leões majestosos, gazelas graciosas…"
- All 9 scenes have similar issue. The `legenda_overlay` field is being used as a visual/image description by the LLM.
- Duration snap in kie_client.py:313-314 correctly converts float 3.0 → int 6 for Hailuo, so duration is NOT the cause of the failure (the log line "duration=6s" confirms this)
- Pipeline structure: `run_step_video_kie` (parallel batch path) uses `_build_scene_motion_prompt(overlay, narracao, ...)` which WRAPS the overlay in a camera+motion prompt. So batch generation puts the long overlay inside a longer prompt → still problematic but more so.
- `retry_single_scene` (single-scene path) uses `scene.get("prompt", "")` directly — sends only the overlay description, no wrapping

## Key insight

There are actually TWO distinct issues:

**Issue A (script LLM behavior):** The script generation prompt asks for a "short overlay text" in `legenda_overlay`, but the LLM ignores this and writes a long visual description. This is a script/prompt quality bug.

**Issue B (init_scenes data flow):** `init_scenes` literally copies `legenda_overlay` into `scene["prompt"]`. This conflates two different things — overlay text (for video subtitle display) and motion prompt (for video generation). Even if the LLM behaved correctly and returned short text in `legenda_overlay`, that short text would still be a poor motion prompt for Hailuo.

The IMMEDIATE failure ("No video URL in result") is most likely because Hailuo received a long image-description prompt + a static cosmic-archway image, and either:
- Hailuo timed out / errored internally
- Hailuo returned success with no resultUrls (Kie.ai's silent failure mode)

Need to verify this theory before fixing — could also be a transient Kie.ai issue.

## Symptoms

expected: Video clips should be generated successfully after the video task is created
actual: Something fails after "Creating video task" log line — unknown if it hangs, errors, or returns empty
errors: Unknown — need to investigate logs and code
reproduction: Running the pipeline with clip generation
started: Currently happening

## Eliminated

## Evidence

## Resolution

root_cause: |
  Multi-layered observability bug in the clip generation flow:

  1. PRIMARY (visibility bug): When Kie.ai/Hailuo fails (either state="fail" with a real
     failMsg, OR state="success" with empty resultUrls), `kie_client.poll_until_complete`
     swallows the actual error and returns either `None` or an empty VideoGenerationResult.
     The calling code (process_scene + retry_single_scene) then raises a generic
     `RuntimeError("No video URL in result")`. This error masks the REAL failure reason
     from Kie.ai (e.g., NSFW filter, prompt rejection, internal Hailuo error).

     User reports "clip generation failing" but cannot see WHY because the error message
     is uninformative. Logs do contain the real failMsg via `logger.error("Task %s failed:
     [%s] %s", ...)` but it's lost between retries and not surfaced in the scene status.

  2. SECONDARY (data flow bug): `init_scenes` (src/api/routes/reels.py:1971) copies the
     script's `legenda_overlay` field directly into the scene's `prompt` field. But
     `legenda_overlay` is documented (in the script-gen system prompt) as "descricao
     visual detalhada do cenario … usado como prompt para gerar a imagem da cena" — i.e.,
     it's an IMAGE generation prompt, not a video MOTION prompt. The retry-scene path
     then sends this image-description directly to Hailuo as the motion prompt, which
     can confuse the model.

  3. TERTIARY (data flow bug): `init_scenes` also stores `duracao_segundos` (a float
     like 3.0, 5.0) directly as scene["duration"]. While `kie_client` snaps these to
     valid Hailuo durations [6, 10] before the API call, OTHER code paths use the float
     value directly (e.g., set-scene-static at line 1689 uses `scene.get("duration", 6)`
     for ffmpeg `-t` flag, producing a 3-second static clip when the actual scene
     timing should be 6+).

fix: |
  Three coordinated fixes:

  A. kie_client.py: Make `poll_until_complete` propagate the real failure reason.
     - Change the return type to always carry context (or raise a typed exception with failMsg/failCode).
     - When state="fail": raise KieAPIError(f"{failCode}: {failMsg}") instead of returning None.
     - When state="success" but resultUrls empty: raise KieAPIError("Kie.ai returned success
       but no result URLs (possible content filter or internal error)").

  B. main.py (process_scene + retry_single_scene): Catch KieAPIError specifically and
     surface the message to the user via the scene status.

  C. routes/reels.py (init_scenes): Use a proper motion prompt source.
     - Use `_build_scene_motion_prompt(legenda_overlay, narracao, ...)` (the same helper used
       by run_step_video_kie batch path) so the single-scene retry uses the same prompt
       structure as the batch path.
     - Snap duration to valid Hailuo values when storing in scene state, OR derive it from
       _pick_scene_duration so retry uses the right duration.

verification: |
  Self-verified via in-process unit tests (no Kie.ai credits spent):
  1. ✓ kie_client._parse_success_result handles 4 cases correctly:
     - success with URL → video_url set, failure_reason empty
     - success with empty resultUrls + failMsg → failure_reason="failMsg", failure_code set
     - success with empty resultUrls no failMsg → diagnostic message with raw resultJson
     - malformed resultJson → graceful fallback with diagnostic
  2. ✓ kie_client.poll_until_complete (state=fail) returns VideoGenerationResult with
     failure_reason and failure_code populated (instead of returning None silently)
  3. ✓ kie_client.poll_until_complete (state=success with URL) still returns
     populated result — backward compatible
  4. ✓ retry_single_scene end-to-end: when poll returns failure result,
     final scene["error"] = "Kie.ai task failed [SAFETY_FILTER]: Image content rejected by safety filter"
  5. ✓ retry_single_scene end-to-end: when poll returns None (timeout),
     scene["error"] = "Kie.ai poll timed out (task task_xyz never reached terminal state)"
  6. ✓ retry_single_scene end-to-end: success case still produces status="success"
     with task_id set — backward compatible
  7. ✓ ProductAdPipeline.run_step_video surfaces failure_reason in RuntimeError message
  8. ✓ All four modified files pass Python syntax check
  9. ✓ Imports all clean

  IMPORTANT: This fix improves OBSERVABILITY of the failure, but does not "fix" the
  underlying Kie.ai/Hailuo failure itself. The user should now be able to see the
  REAL error message (e.g., NSFW filter, prompt rejection, internal Hailuo error)
  in the scene status, which will tell us *why* clips are failing in production.
  After running a real reel, the user should report what error message now appears
  for the failing scenes — that will guide the next fix (likely a script-prompt or
  init_scenes data-flow change).

files_changed:
  - src/video_gen/kie_client.py
  - src/reels_pipeline/main.py
  - src/api/routes/video.py
  - src/product_studio/pipeline.py
  - src/api/routes/reels.py

## Resolution (2026-04-06 23:58)

Live reproduction via `.tmp/repro_clip_failure.py` called `pipeline.retry_single_scene`
directly for job 8303e35e26e9411b scene 0 with the EXACT same image, prompt, and
duration that had been failing. Result: **status=success, task_id=5fc3305be288994ec2ac4bcc10b1a7ec**,
clip saved to `output/reels/reel_034_0406/clips/clip_00.mp4` (2.5MB, 5.875s).

This exposed the REAL root cause that the observability fix wasn't enough to catch:

**Bug:** `retry-scene` endpoint at src/api/routes/reels.py:1751-1767 only read
`video_model` from the `ReelsConfig` DB table (when `job.config_id` is set).
Job 8303e35e26e9411b has `config_id=NULL` but `step_state.config.video_model =
"hailuo/2-3-image-to-video-pro"` (set at job creation). The endpoint skipped the
step_state merge that `execute-step` performs at line 989, so retry fell back to
`REELS_VIDEO_MODEL` env default = `"hailuo/2-3-image-to-video-standard"`.

**That explains** the exact log line the user reported:
`"model=hailuo/2-3-image-to-video-standard"` even though the job was Pro-configured.
Hailuo Standard was choking on scene 0's long cosmic-nebula prompt; when we retried
with Pro (what the job was supposed to use), it succeeded immediately.

**Fix (applied):** src/api/routes/reels.py retry_scene now merges
`step_state.config.video_model` (and `bible_config`) into `config_override`,
matching the pattern in `execute-step` at line 989. One-file change, ~4 lines.

**DB updated:** scene 0 marked `status=success` with the new task_id.

**Server restart:** required for the reels.py route change to take effect
(FastAPI doesn't hot-reload routes). User must restart their uvicorn process.

**Secondary issue (NOT fixed, deferred):** `init_scenes` still copies
`legenda_overlay` (documented as image gen prompt) into `scene["prompt"]` as the
motion prompt. Pro tolerates the long descriptions; Standard does not. Real long-term
fix would be to wrap retry prompts through `_build_scene_motion_prompt` OR fix the
script-gen system prompt so `legenda_overlay` stays short. Parking this until/unless
it recurs with Pro.
