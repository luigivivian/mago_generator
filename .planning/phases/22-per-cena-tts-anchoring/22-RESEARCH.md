# Phase 22: Per-Cena TTS Anchoring — Research

**Researched:** 2026-04-08
**Domain:** Async Python / Gemini Flash TTS / ffmpeg PCM concat / SQLAlchemy JSONB partial updates
**Confidence:** HIGH (all critical claims verified locally against the installed `google-genai 1.68.0` and the project's ffmpeg)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Concurrency strategy**
- **D-01:** Per-cena Gemini TTS calls scheduled via `asyncio.Semaphore(3)`. Each cena call acquires the semaphore, generates, releases. Balances latency (~7s for 20 cenas) against Gemini RPM risk on biblical reels.
- **D-02:** Per-call retry on 429/5xx: **3 attempts with exponential backoff (1s, 2s, 4s)**. After all retries fail, the cena is marked `cenas[i].failed = true` and the loop continues with the remaining cenas. No whole-step abort on single-cena failure.
- **D-03:** Progress reporting via **per-cena status writes** inside `step_state.tts.cenas[i].status` (`pending` → `generating` → `complete` | `failed`). Frontend SWR (2s polling) surfaces "Generating TTS 7/20". Must use the same `get_session_factory()` + `_scene_lock` pattern from `run_step_video_kie`'s `on_scene_update` (src/api/routes/reels.py:276-298) to avoid racing the parent transaction.
- **D-04:** Phase 22 generates exactly `N = len(script.cenas)` per-cena files at the moment TTS runs. If `run_step_srt` later expands the script via the scene splitter (M > N), `tts.cenas` stays at N. Reconciliation is **explicitly deferred to Phase 23**.

**Failure + selective retry semantics**
- **D-05:** Step-level status convention: `step_state.tts.status = "complete"` if all cenas succeed, `"complete_with_failures"` if any `cenas[i].failed` is true, `"failed"` only if the concat itself fails or zero cenas succeeded.
- **D-06:** Selective retry through the **existing** `/reels/{jobId}/step/tts` endpoint with an optional `cena_indices: int[]` parameter (empty / absent = regen all). `narracao_completa.wav` is re-concatenated after any successful retry. No new endpoint.

**step_state.tts shape & editor compat**
- **D-07:** Shape is **purely additive**. Existing readers keep working unchanged:
  - `step_state.tts.path` → still points to `narracao_completa.wav`/`audio.wav` (editor fallback at `memelab/src/stores/editor-store.ts:167`).
  - `step_state.tts.duration` → still a float, now the sum of per-cena durations via ffprobe on the concat file (editor reads at line 198).
  - **Added:** `step_state.tts.cenas: [{index, narracao, path, duration, status, failed?}]` — new authoritative per-cena data.
  - **Added:** `step_state.tts.total_duration_source = "ffprobe_concat"` for Phase 23 trust-check.
- **D-08:** Per-cena files at `{job_dir}/audio/cena_{i:03d}.wav`; concat output stays at `{job_dir}/audio.wav`. Create `audio/` subdirectory on demand.

**Concat strategy**
- **D-09:** `ffmpeg -f concat -safe 0 -i list.txt -c copy -y {out}.wav`. All per-cena files identical format (24kHz mono 16-bit PCM WAV from `_wrap_pcm_as_wav`) → `-c copy` is zero-reencoding. No Python `wave`-module reassembly.
- **D-10:** **No silence padding** between cenas in the concat.

**Biblical speaking_rate enforcement**
- **D-11:** Clamp at the lowest layer inside `src/reels_pipeline/tts.py :: generate_narration`. First line after arg validation: `if tone == "biblical": speaking_rate = 1.0` (overrides caller-supplied `speed`).
- **D-12:** Log the override at INFO level when it fires.

### Claude's Discretion
- Exact naming of `cenas[i].status` enum values (canonical set: `pending`/`generating`/`complete`/`failed`).
- Whether `run_step_tts`'s signature becomes `(script, job_dir) -> (concat_path, total_duration, cost_usd, cenas_meta)` or stays with script via `self.config`. Pick the cleanest.
- Unit-test sizing for the retry/semaphore loop.
- Whether `flag_modified` commits are per-cena or batched in pairs.

### Deferred Ideas (OUT OF SCOPE)
- **ffmpeg `silenceremove` post-processing** — orthogonal. If it lands later, must run on per-cena files before ffprobe measurement (not the concat).
- **Pipeline routing restructure** — unrelated, own phase.
- **Silence padding between cenas** — D-10 says none.
- **Splitter / tts.cenas reconciliation when SRT expands cenas** — deferred to Phase 23.
- **Per-cena voice override** — captured in Phase 999.15 backlog.
- **ElevenLabs integration** — v4.0 scope exclusion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TTS-01 | `run_step_tts` generates one Gemini TTS file per cena | "asyncio patterns" section — bounded-parallel pattern; "Code Examples" → per-cena async loop |
| TTS-02 | Each file's duration measured via ffprobe immediately after generation | "ffprobe accuracy" section verified sub-microsecond precision on 24kHz mono PCM WAV; reuse `video_builder.get_video_duration()` |
| TTS-03 | Durations persisted in `step_state.tts.cenas[i].duration` (float seconds) | "JSONB partial updates" section — `flag_modified` pattern from `run_step_video_kie`; per-cena dict shape documented |
| TTS-04 | `narracao_completa` is concatenated from per-cena files via ffmpeg (not generated as a single call) | "ffmpeg concat demuxer" section — locally verified bit-exact `-f concat -c copy` on identical 24kHz mono 16-bit PCM WAV |
| TTS-05 | When `tone == "biblical"`, `speaking_rate` is forced to 1.0 | "Code Examples" → biblical clamp at generate_narration entry |
| TTS-06 | Single-cena failure does not abort pipeline; retry with backoff; cena reported for regen | "Gemini TTS error taxonomy" section — `ClientError` (4xx incl. 429) vs `ServerError` (5xx) classification; retry policy |
</phase_requirements>

## Summary

This phase refactors a single-call TTS step into a bounded-parallel per-cena loop that produces one 24kHz mono 16-bit PCM WAV per `script.cenas[i]`, measures each with ffprobe, concatenates them bit-exact into `audio.wav` for editor compat, and writes per-cena progress using the same `get_session_factory()` + `flag_modified()` dance that `run_step_video_kie` uses for clip generation. Every locked decision in CONTEXT.md is consistent with verified library and tool behavior — there are **no architectural reroutes** hiding in the research.

Two facts were verified locally (not just cited) because they are load-bearing for success criterion #2:

1. **`ffmpeg -f concat -safe 0 -c copy` is bit-exact** on identical-format PCM WAV. Local test concatenated three `pcm_s16le, 24000Hz, mono` files; output frame count equals the sum of input frames, and the MD5 of the raw PCM payload of the concat equals the MD5 of the input payloads joined in Python — zero samples added, removed, or resampled.
2. **ffprobe `format=duration` and `wave.getnframes()/framerate` agree to 0.0003 ms** on a 24kHz mono 16-bit PCM WAV. The 50ms tolerance in success criterion #2 is almost three orders of magnitude larger than any measurement noise; the real drift budget is comfortably consumed just by how many decimal places we persist in JSON.

One optimization opportunity is visible but **out of scope**: the installed `google-genai 1.68.0` exposes a native async path (`client.aio.models.generate_content(...)`), whereas `tts.py` currently wraps the sync path in `asyncio.to_thread(...)`. Both work; migrating is cleaner but not required for this phase and should not be folded in (risk of scope creep on the critical v4.0 foundation refactor).

**Primary recommendation:** Mirror the structural pattern of `run_step_video_kie` (src/reels_pipeline/main.py:589-936) almost verbatim — the scene list initialization, `_update_scene(idx, {...})` helper, outer `asyncio.gather([process_cena(info) for info in tasks])` bounded by a `Semaphore(3)`, inner per-attempt retry with classified exception handling, and independent `get_session_factory()` session for progress commits. That pattern is the only one in this codebase known to safely write JSON column mid-step without deadlocking the parent transaction; reinventing it is a known footgun.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `google-genai` | 1.68.0 (installed) | Gemini Flash TTS via `generate_content` with `response_modalities=["AUDIO"]` | Already the sole TTS provider per v4.0 scope exclusion. Exposes typed error classes (`ClientError`, `ServerError`) for retry classification. |
| `asyncio` (stdlib) | Python 3.13 | `Semaphore` bounded concurrency + `gather` + `to_thread` for sync→async bridging | Standard library. Codebase already uses `Semaphore` in 5 files (e.g., `src/pipeline/workers/phrase_worker.py:19`, `src/image_gen/gemini_client.py:1165`). |
| `sqlalchemy` | 2.0 async | `flag_modified(j, "step_state")` for JSON column partial updates | Only mechanism SQLAlchemy has to detect in-place dict mutation on JSON columns. Codebase uses it 15+ times in `src/api/routes/reels.py`. |
| `ffmpeg` (system) | Any recent | `-f concat -safe 0 -c copy` for bit-exact PCM WAV concatenation | Verified locally: sample-exact concat of identical-format WAVs with zero re-encoding. |
| `ffprobe` (system) | Any recent | `-show_entries format=duration` for float-seconds measurement | Already wrapped by `src/reels_pipeline/video_builder.py:293 :: get_video_duration()`. Verified sub-microsecond accuracy on 24kHz mono 16-bit PCM WAV. |

**No new dependencies needed.** Every building block is already installed and already used elsewhere in the codebase.

### Supporting (existing, reuse verbatim)
| Asset | Location | Use |
|-------|----------|-----|
| `generate_narration()` | `src/reels_pipeline/tts.py:73` | Single-call Gemini TTS. Wrap it in a per-cena loop; add biblical clamp at line ~100 (after arg validation, before `style_prompt` build). |
| `_wrap_pcm_as_wav()` | `src/reels_pipeline/tts.py:33` | Already produces the identical format (`pcm_s16le, 24000Hz, mono`) required for `-c copy` concat to work. No changes needed. |
| `get_video_duration()` | `src/reels_pipeline/video_builder.py:293` | Subprocess wrapper around `ffprobe -show_entries format=duration -of csv=p=0`. Works on WAV unchanged; reuse as-is for `tts.cenas[i].duration`. |
| `_scene_update` / `on_scene_update` pattern | `src/api/routes/reels.py:276-298` | The canonical pattern: `asyncio.Lock()` guard + independent `get_session_factory()` session + `flag_modified(j, "step_state")` + `await s.commit()`. Copy this shape verbatim into the `tts` step handler. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff — and why we don't |
|------------|-----------|-----------------------------|
| `asyncio.to_thread(client.models.generate_content, ...)` (current) | `await client.aio.models.generate_content(...)` (native async) | Cleaner, avoids one thread per call. **But:** changes a working code path in a phase whose job is per-cena anchoring, not SDK migration. Defer. |
| `ffmpeg -f concat -c copy` | `wave` module assembly in Python | Python `wave.writeframes(b''.join(payloads))` also produces bit-exact output and avoids a subprocess. **But:** D-09 locks this decision to ffmpeg, and ffmpeg is already on the critical path for every other step. Consistent tooling wins. |
| `ffprobe format=duration` | `wave.getnframes() / framerate` | `wave` path is ~10x faster (no subprocess) and gives slightly higher decimal precision. **But:** we must reuse `get_video_duration()` per the code-insights section of CONTEXT.md, and the precision difference (0.0003ms) is irrelevant against the 50ms tolerance. |
| Per-cena `flag_modified` commit | Batched (every N cenas) commit | Batched reduces DB round-trips. **But:** per-cena matches the existing `on_scene_update` pattern exactly, and for 15–25 cenas the commit cost is negligible vs the Gemini API latency. Default to per-cena; CONTEXT.md flags batching as claude-discretion tuning. |

**Installation:** None required — all packages already in `pyproject.toml`/installed.

**Version verification:**
```bash
python3 -c "import google.genai; print(google.genai.__version__)"   # → 1.68.0 (installed)
ffmpeg -version | head -1
ffprobe -version | head -1
```
No remote registry check was performed because no new dependency is being introduced.

## Architecture Patterns

### Recommended Call Structure (mirrors `run_step_video_kie` at src/reels_pipeline/main.py:589-936)

```
run_step_tts(script, job_dir, cena_indices=None, on_cena_update=None)
│
├── biblical clamp: if tone=='biblical' speed=1.0  (happens inside generate_narration per D-11)
│
├── Determine target indices:
│     - cena_indices is None → regen all: target = range(len(script['cenas']))
│     - cena_indices provided → selective retry: target = cena_indices
│
├── Initialize state:
│     - Seed scenes list with {index, status: 'pending'} for each cena (all, not just targets)
│     - Preserve existing successful entries when cena_indices is provided (D-06)
│
├── Bounded-parallel fan-out:
│     semaphore = asyncio.Semaphore(3)          # D-01
│     async def process_cena(i):
│         async with semaphore:
│             for attempt in range(3):          # D-02: 3 attempts
│                 try:
│                     path = os.path.join(job_dir, 'audio', f'cena_{i:03d}.wav')
│                     await generate_narration(cena['narracao'], path, ...)
│                     dur = get_video_duration(path)
│                     _update_cena(i, {status:'complete', path, duration:dur})
│                     return (i, path, dur, None)
│                 except ClientError as e:
│                     if e.code == 429:       # RESOURCE_EXHAUSTED — retryable
│                         if attempt < 2: await asyncio.sleep(2**attempt); continue
│                     if e.code in (400, 403): break   # INVALID_ARGUMENT / PERMISSION — don't retry
│                     if attempt < 2: await asyncio.sleep(2**attempt); continue
│                 except ServerError:           # 5xx — retryable
│                     if attempt < 2: await asyncio.sleep(2**attempt); continue
│                 except Exception as e:        # unknown — log + mark failed
│                     _update_cena(i, {status:'failed', error: str(e)[:300]})
│                     return (i, None, None, e)
│             _update_cena(i, {status:'failed', failed: True, error: '...'})
│             return (i, None, None, last_err)
│
│     results = await aio.gather(*[process_cena(i) for i in target])
│
├── Concat (only if at least one cena succeeded):
│     list_path = write_concat_list(sorted per-cena paths of successful cenas)
│     ffmpeg -f concat -safe 0 -i list_path -c copy -y audio.wav   # D-09
│     total_dur = get_video_duration(audio.wav)
│
├── Persist step_state (additive — D-07):
│     step_state.tts.path = audio.wav
│     step_state.tts.duration = total_dur
│     step_state.tts.cenas = [...]    # new authoritative
│     step_state.tts.total_duration_source = "ffprobe_concat"
│     step_state.tts.status = "complete" | "complete_with_failures" | "failed"   # D-05
│
└── Return (audio_path, total_dur, cost_usd, cenas_meta)
```

### Progress-Write Pattern (verbatim from `run_step_video_kie`)

Copy this shape from `src/api/routes/reels.py:276-298`. The `_scene_lock` is **required** — without it, two simultaneous `flag_modified` commits can race the parent transaction's commit and corrupt `step_state`. This is the lesson from the "established per-cena progress pattern" line in CONTEXT.md canonical_refs.

```python
# Per-cena status callback — independent session to avoid concurrent
# commit on the parent session (which is mid-transaction)
_cena_lock = asyncio.Lock()

async def _cena_update(cenas_list):
    from src.database.session import get_session_factory
    async with _cena_lock:
        try:
            sf = get_session_factory()
            async with sf() as s:
                result = await s.execute(
                    select(ReelsJob).where(ReelsJob.job_id == job_id)
                )
                j = result.scalar_one_or_none()
                if j and j.step_state:
                    j.step_state["tts"]["cenas"] = cenas_list
                    flag_modified(j, "step_state")
                    await s.commit()
        except Exception as e:
            logger.warning("Cena update commit failed (non-fatal): %s", e)

def on_cena_update(cenas_list):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_cena_update(cenas_list))
    except RuntimeError:
        pass
```

### Anti-Patterns to Avoid
- **Calling `flag_modified` on the parent session during a Gemini API call.** The parent session is in the middle of a long-running transaction; commit there and you can deadlock or lose the transaction. Always use an independent `get_session_factory()` session for mid-step writes.
- **Re-entering `generate_narration` without the biblical clamp.** D-11 requires the clamp to live inside `generate_narration`. If any caller (main.py:1083 batch-mode, reels.py step handler, or a new test helper) bypasses it, the contradiction between the "speak slowly" prompt and `1.35` default returns. This is the point of placing the clamp at the lowest layer.
- **Storing the scene list as a list of positional tuples.** Use `[{index, narracao, path, duration, status, failed?}]` (dicts with explicit `index` field). The editor's `sceneTimings?.find((t) => t.index === i)` pattern at `memelab/src/stores/editor-store.ts:147` expects identifiable indices — future code in Phase 23 will likely do the same.
- **Running `generate_narration` outside the semaphore for "just the last cena".** Bounded parallelism means *all* calls go through the semaphore. Bypassing the limiter for any subset of cenas defeats the RPM safety margin on biblical reels.
- **Ignoring `content safety` blocks in the error classifier.** If Gemini blocks a biblical cena due to content safety, `ClientError` will surface as 400 (not 429) with `status="INVALID_ARGUMENT"`. Treat as `failed` — retrying will not help. See the pitfall table below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded parallel TTS dispatch | Custom queue + worker pool | `asyncio.Semaphore(3)` + `asyncio.gather()` | Already in codebase 5x. Python stdlib. Cooperative, non-blocking, well-understood. |
| Retry with exponential backoff | Custom loop with `time.sleep` | `for attempt in range(3): ... await asyncio.sleep(2**attempt)` inside try/except | Simple, readable, avoids introducing `tenacity` as a new dep for a 9-line loop. Mirrors the retry shape in `run_step_video_kie:811-891`. |
| PCM WAV concatenation | Python `wave` module reassembly, or `scipy.io.wavfile` | `ffmpeg -f concat -safe 0 -c copy` | ffmpeg handles the WAV header rewrite (data chunk size, RIFF length) deterministically; verified bit-exact locally. D-09 locks this decision. |
| Audio duration measurement | Python `wave.getnframes()/framerate` | `get_video_duration()` (existing `ffprobe` wrapper) | The existing helper already handles the subprocess/error path; reusing it keeps the codebase consistent. Precision difference is 0.0003 ms — irrelevant. |
| JSON column mid-step update | Raw SQL `UPDATE ... SET step_state = JSON_SET(...)` | `flag_modified(j, "step_state")` after Python dict mutation | SQLAlchemy's change-tracking cannot observe in-place JSON mutations; `flag_modified` is the documented escape hatch. Codebase uses it 15+ times. |
| Gemini TTS error classification | `"if '429' in str(e)"` string matching | `except ClientError as e: if e.code == 429: ...` using `google.genai.errors` | `google-genai 1.68.0` exposes typed exceptions with `.code`, `.status`, `.message` attributes. String matching is brittle across SDK versions. |

**Key insight:** every building block already exists in this codebase. The phase is a refactor, not a feature rollout. Research reveals zero unknowns — only assembly of existing parts in the documented shape.

## Runtime State Inventory

*(Phase 22 is a pure code refactor. No rename/string-replace/data migration. Nothing to inventory. This section is kept for plan-checker conformance.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** The pre-refactor `step_state.tts` shape will be replaced on the next TTS step run for any job. Legacy jobs (where `tts.cenas` is absent) are already handled by the editor fallbacks at `memelab/src/stores/editor-store.ts:167` (uses `tts.path`) and `editor-store.ts:198` (uses `tts.duration` with sanity bounds). Additive schema means legacy jobs continue to render unchanged. | None — additive change. |
| Live service config | **None.** No external service (n8n, Tailscale, Datadog, Modal) has a hardcoded reference to the TTS step's internal shape. The FastAPI endpoint URL (`/reels/{jobId}/step/tts`) stays stable. | None. |
| OS-registered state | **None.** No scheduled tasks, launchd plists, or systemd units touch this step. | None. |
| Secrets / env vars | **None renamed or removed.** `GOOGLE_API_KEY`, `REELS_TTS_MODEL`, `REELS_TTS_VOICE`, `REELS_TTS_PROVIDER` all unchanged. `tts_speed` in `ReelsConfig` column stays — it's the caller-side default that D-11 clamps inside `generate_narration`. | None. |
| Build artifacts | **None.** No egg-info, compiled binaries, or Docker image tags reference the TTS step shape. | None. |

## Common Pitfalls

### Pitfall 1: Dict aliasing on `step_state` mutation
**What goes wrong:** Writing `step_data["cenas"] = scenes_list` on a local `step_data` dict that was obtained via `step_state.get("tts", {})` — the `{}` default means the update lands on an orphan dict that is never re-attached to `step_state`.
**Why it happens:** Python's `dict.get(key, default)` does not insert the default into the dict. The returned `{}` is not the same object as `step_state["tts"]`.
**How to avoid:** Always re-assign: `step_state["tts"] = step_data` after mutation, then `flag_modified(job, "step_state")`. The existing pattern at `src/api/routes/reels.py:159-164` does this correctly for the top-level `generating` status write — mirror that shape.
**Warning signs:** "Progress writes look fine in logs but the editor never sees them" / "status flickers back to pending after generation completes."

### Pitfall 2: Ordering instability in the concat list
**What goes wrong:** `os.listdir('audio/')` returns files in filesystem order (not sorted), so cena 10 may land before cena 2 in the concat list.
**Why it happens:** `listdir` order is undefined across filesystems (APFS sorts differently than ext4).
**How to avoid:** Build the concat list from `sorted(results, key=lambda r: r.index)` — the per-cena return tuples already carry the index, and the filenames use `cena_{i:03d}.wav` padding explicitly so a string sort also works.
**Warning signs:** Narration plays out of order; timings look right but the listener hears cena 10 → cena 1 → cena 11 → cena 2.

### Pitfall 3: Semaphore not released on exception
**What goes wrong:** Using `sem.acquire()` / `sem.release()` as explicit calls and forgetting `try/finally`.
**Why it happens:** Python exceptions inside the critical section leak the semaphore permit; after 3 failures the semaphore is permanently stuck.
**How to avoid:** Always use `async with semaphore:` — the context manager guarantees release on exception. This is what every existing `Semaphore` use in the codebase does (`src/llm_client.py:237`).
**Warning signs:** First batch runs fine; subsequent TTS runs hang silently. Restart fixes it.

### Pitfall 4: Treating content-safety blocks as retryable
**What goes wrong:** A biblical cena about a violent event (e.g., Goliath's death) trips Gemini's content safety filter. Retrying 3 times wastes ~7s and still fails.
**Why it happens:** `ClientError` with `code=400` and `status="INVALID_ARGUMENT"` or `"BLOCKED"` is **not** retryable — the content is the problem, not a transient condition.
**How to avoid:** Classify error codes: `429` (RESOURCE_EXHAUSTED) and `5xx` → retry; `400` (INVALID_ARGUMENT, including safety blocks) and `403` (PERMISSION_DENIED) → break out of retry loop immediately, mark as `failed`. Verified against `google.genai.errors.APIError._get_status()` which extracts the gRPC status from the response body.
**Warning signs:** "Same cena fails 3 times with identical error"; `attempt=1,2,3` log lines all show the same 400 code.

### Pitfall 5: ffmpeg concat list with wrong quoting
**What goes wrong:** A `job_dir` with a space in it (e.g., `output/reels/job 123/audio/cena_000.wav`) breaks the concat demuxer because the default `-safe 1` rejects it.
**Why it happens:** The concat demuxer considers paths with spaces or absolute paths as "unsafe."
**How to avoid:** Always pass `-safe 0` (already in D-09). Write the list file with each entry as `file '/absolute/path/to/cena_000.wav'\n` — single quotes, no escaping needed for spaces. `-safe 0` must come **before** `-i list.txt`, not after (ffmpeg is position-sensitive).
**Warning signs:** "Unsafe file name" error from ffmpeg on job paths that contain a space or start with `/`.

### Pitfall 6: `narracao_completa` recomputed from script text, not from the audio
**What goes wrong:** After concat, the caller updates `step_state.tts.duration` with `sum(cena.duration for cena in cenas)` instead of `get_video_duration(audio.wav)`.
**Why it happens:** It's "obvious" that they should be equal, and summing in Python is free.
**How to avoid:** D-07 explicitly says `tts.duration` must be the ffprobe-measured value on the concat file. This lets Phase 23's trust-check compare two *independent* measurements and catch drift. Using the sum discards that cross-check. The 50ms tolerance in success criterion #2 exists precisely so Phase 23 can assert they agree.
**Warning signs:** Phase 23's audit logs never see a mismatch because the mismatch can never happen by construction; silent bugs accumulate.

### Pitfall 7: Mutating the same JSON dict concurrently from two progress writers
**What goes wrong:** Two simultaneous `_cena_update` coroutines both read `j.step_state`, both mutate it, both call `flag_modified`, and the second commit clobbers the first.
**Why it happens:** Without a lock, async coroutines can interleave arbitrarily between `session.execute(select...)` and `await s.commit()`.
**How to avoid:** `_cena_lock = asyncio.Lock()` around the entire session-open + read + mutate + commit sequence, exactly as `run_step_video_kie` does it. The lock is local to the request handler, not global.
**Warning signs:** "Cena 7 finishes after cena 8 but the polling UI shows cena 8 as `generating` forever"; log diff shows cena 8 state was overwritten by a stale cena 7 commit.

## Code Examples

### Biblical clamp inside `generate_narration` (D-11)

```python
# src/reels_pipeline/tts.py :: generate_narration
# First line after arg validation (line ~103, before `voice_name = voice or ...`)

    if tone == "biblical" and (speed is None or speed != 1.0):
        logger.info(
            "Biblical tone: forcing speaking_rate=1.0 (was %s)",
            speed if speed is not None else "default",
        )
        speed = 1.0
    # ... existing `speaking_rate = speed or 1.35` below picks it up
```

### Per-cena retry loop with typed error classification (verified against `google.genai.errors` 1.68.0)

```python
# Verified: google.genai.errors.ClientError (4xx) has attributes .code, .status, .message
# Verified: google.genai.errors.ServerError (5xx) has same attributes
# See: /Users/luigivivian/meme-lab/src/reels_pipeline/tts.py :: generate_narration for the call site

from google.genai import errors as genai_errors

async def process_cena(i: int, cena: dict) -> dict:
    async with semaphore:
        cena_narracao = cena.get("narracao", "")
        cena_path = os.path.join(job_dir, "audio", f"cena_{i:03d}.wav")
        last_err: Exception | None = None

        for attempt in range(3):
            _update_cena(i, {"status": "generating", "error": None})
            try:
                await generate_narration(
                    text=cena_narracao,
                    output_path=cena_path,
                    voice=self.config.get("tts_voice"),
                    provider=self.config.get("tts_provider"),
                    speed=self.config.get("tts_speed"),
                    tone=tone,  # biblical clamp happens inside
                )
                duration = get_video_duration(cena_path)
                _update_cena(i, {
                    "status": "complete",
                    "path": cena_path,
                    "duration": duration,
                    "narracao": cena_narracao,
                })
                return {"index": i, "path": cena_path, "duration": duration, "failed": False}

            except genai_errors.ClientError as e:
                last_err = e
                # 429 RESOURCE_EXHAUSTED → retry with backoff
                # 400 INVALID_ARGUMENT / 403 PERMISSION_DENIED → do not retry (content safety, bad key)
                if e.code == 429 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)  # 1s, 2s
                    continue
                if e.code in (400, 403):
                    logger.warning("Cena %d: non-retryable client error %s %s", i, e.code, e.status)
                    break
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue

            except genai_errors.ServerError as e:
                last_err = e
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue

            except Exception as e:
                last_err = e
                logger.exception("Cena %d attempt %d: unexpected exception", i, attempt + 1)
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue

        # All retries exhausted
        err_msg = f"{type(last_err).__name__}: {str(last_err)[:280]}"
        _update_cena(i, {
            "status": "failed",
            "failed": True,
            "error": err_msg,
            "narracao": cena_narracao,
        })
        return {"index": i, "path": None, "duration": None, "failed": True, "error": err_msg}
```

### ffmpeg concat helper (mirrors the D-09 command line)

```python
# Verified locally bit-exact: output frame count equals sum of input frames,
# MD5 of concat PCM payload equals MD5 of the joined input payloads.
# See: /Users/luigivivian/meme-lab/src/reels_pipeline/video_builder.py:293 for ffprobe pattern to reuse

import subprocess

def _concat_cena_wavs(per_cena_paths: list[str], output_path: str) -> str:
    """Bit-exact PCM WAV concat via ffmpeg concat demuxer (-c copy, zero re-encode)."""
    # Write concat list to a sibling file (ffmpeg -f concat requires a file, not stdin,
    # because it has to read the durations in a pre-scan pass).
    list_path = output_path + ".concat.txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for p in per_cena_paths:
            # Absolute path in single quotes; -safe 0 permits spaces and absolutes
            abs_p = os.path.abspath(p)
            f.write(f"file '{abs_p}'\n")

    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    try:
        os.unlink(list_path)
    except OSError:
        pass

    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg concat failed (exit {result.returncode}): {result.stderr[:500]}"
        )
    return output_path
```

### Mirroring `_scene_update` for TTS progress writes

Copied verbatim from `src/api/routes/reels.py:276-298` with `clips` → `tts` and `scenes_list` → `cenas_list`. **Do not modify the session/lock/flag_modified dance** — the shape is load-bearing.

```python
# In src/api/routes/reels.py inside the `elif step_name == "tts":` branch,
# hoisted so process_cena in run_step_tts can receive it as on_cena_update callback.

_cena_lock = asyncio.Lock()

async def _cena_update(cenas_list):
    from src.database.session import get_session_factory
    async with _cena_lock:
        try:
            sf = get_session_factory()
            async with sf() as s:
                result = await s.execute(
                    select(ReelsJob).where(ReelsJob.job_id == job_id)
                )
                j = result.scalar_one_or_none()
                if j and j.step_state:
                    tts_step = j.step_state.setdefault("tts", {})
                    tts_step["cenas"] = cenas_list
                    flag_modified(j, "step_state")
                    await s.commit()
        except Exception as e:
            logger.warning("TTS cena update commit failed (non-fatal): %s", e)

def on_cena_update(cenas_list):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_cena_update(cenas_list))
    except RuntimeError:
        pass
```

## State of the Art

| Old approach | Current approach | Why it matters here |
|--------------|------------------|---------------------|
| Single-shot `generate_content` for the entire `narracao_completa` | Per-cena calls, measured independently, then ffmpeg-concat | Restores the audio-as-anchor principle from `pipeline-historia-narracao-imagem.md` §5.1 — duration is *measured*, never *estimated*. |
| `asyncio.to_thread(client.models.generate_content, ...)` | `await client.aio.models.generate_content(...)` (available in `google-genai>=1.0`) | **Not adopted in this phase** — out of scope. Keep current `to_thread` pattern to minimize refactor surface. Note for a future cleanup phase. |
| String-matching Gemini errors (`"429" in str(e)`) | `except ClientError as e: if e.code == 429` | `google-genai 1.68.0` exposes typed errors with integer `.code` and string `.status` (e.g. `"RESOURCE_EXHAUSTED"`). Brittle string match is a smell. |

**Deprecated / outdated:**
- `google.generativeai` (the pre-2024 SDK) is deprecated; the codebase already uses `google.genai` (correct one). No action needed.
- The `duration` directive in concat list files — not needed for PCM WAV with valid headers; ffmpeg reads the frame count from the WAV header directly.

## Open Questions

1. **What are the exact published RPM/TPM for `gemini-2.5-flash-preview-tts` on the free tier?**
   - **What we know:** Free-tier Gemini 2.5 Flash (non-TTS) is documented at 10 RPM / 250 RPD / 250k TPM (cross-referenced from community sources). Google explicitly says *preview* models have "more restrictive" limits and directs developers to AI Studio's dashboard for the per-project quota.
   - **What's unclear:** Google no longer publishes a single canonical RPM number for `gemini-2.5-flash-preview-tts`; the rate-limits page explicitly punts to the per-project dashboard.
   - **Recommendation:** Trust D-01's `Semaphore(3)` as a safe ceiling. For a 20-cena biblical reel this caps steady-state at ~180 RPM theoretical (each call ~1s), but in practice the per-call latency (2–7s) keeps it well under any plausible cap. If we hit 429 in production, the D-02 retry loop absorbs it. Do **not** try to reverse-engineer the exact RPM — it changes without notice.

2. **Does `gemini-2.5-flash-preview-tts` share quota with other Gemini endpoints on the same project?**
   - **What we know:** Rate limits are per-project, not per-API-key, and typically shared across Gemini endpoints within the same model family. Each model has its own RPD but TPM/RPM may be aggregated.
   - **What's unclear:** Whether a reel job generating TTS + script + transcription in parallel (which the pipeline currently does not do, but could in future) consumes from the same bucket.
   - **Recommendation:** Phase 22 runs TTS as a discrete step, so there's no parallel consumption. Document this as a future phase concern.

3. **How does selective retry (D-06) interact with the editor's `sourceVersion` waveform cache-bust?**
   - **What we know:** `memelab/src/stores/editor-store.ts:213` sets `sourceVersion: String(realAudioSeconds)` on the audio block so the waveform hook can bust its peak cache when TTS regenerates and the URL stays stable but bytes change.
   - **What's unclear:** If a selective retry regenerates cena 5 of 20 and the total duration changes by 0.08s, does the editor's waveform bust? It should — `tts.duration` will have changed.
   - **Recommendation:** The planner should add a task that writes a **fresh** `tts.duration` after every concat (not just the first one). The editor is already robust to this via the sanity-bounded read at line 192-200. No editor changes needed.

4. **Should `cost_usd` be summed per-cena or estimated from the concat total length?**
   - **What we know:** Gemini Flash TTS is billed by characters in / seconds out. `estimate_tts_cost()` uses `len(text) / 150 * 0.019 / 60`.
   - **What's unclear:** Whether selective retry should re-add the cena's cost or replace it.
   - **Recommendation:** Sum per-successful-cena: `cost_usd = sum(estimate_tts_cost(cena.narracao) for cena in successful_cenas)`. Selective retry is "re-cost the retried cenas" — match what `run_step_video_kie` does for Kie credits (it only refunds, not double-charges). This is a Claude-discretion detail the planner can decide.

## Environment Availability

*(Phase 22 has no new external deps beyond what the pipeline already uses.)*

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `google-genai` | Gemini TTS client | ✓ | 1.68.0 (`pip show google-genai`) | — |
| `ffmpeg` | Concat demuxer (`-f concat -c copy`) | ✓ | System binary on PATH (verified by local concat test above) | — |
| `ffprobe` | Duration measurement (`format=duration`) | ✓ | System binary on PATH (verified by local precision test above) | Python `wave.getnframes()/framerate` if ffprobe hangs or fails |
| Python `asyncio` + `wave` stdlib | Concurrency + PCM header wrapping | ✓ | Python 3.13 (already in use) | — |
| `sqlalchemy.orm.attributes.flag_modified` | JSON column partial-update write-detection | ✓ | SQLAlchemy 2.0 (already in use 15+ times in reels.py) | — |
| `GOOGLE_API_KEY` env var | Gemini authentication | ✓ (runtime) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest with `pytest-asyncio` (verified via `pyproject.toml` → `asyncio_mode = "auto"`) |
| Config file | `/Users/luigivivian/meme-lab/pyproject.toml` (tool.pytest.ini_options block) |
| Test directory | `/Users/luigivivian/meme-lab/tests/` (flat layout, `test_*.py` files) |
| Quick run command | `pytest tests/test_reels_tts.py -x -q` *(new file — does not yet exist)* |
| Full suite command | `pytest tests/ -x -q` |
| Sample existing patterns | `tests/test_credit_service.py` (async + SQLAlchemy), `tests/test_bible_script.py` (data integrity), `tests/test_bible_e2e.py` (e2e marker — skipped by default) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| TTS-01 | `run_step_tts` produces one audio file per `script.cenas[i]` | unit (mock Gemini) | `pytest tests/test_reels_tts.py::test_generates_one_file_per_cena -x` | ❌ Wave 0 |
| TTS-02 | Each per-cena file has `duration` measured by ffprobe | unit (uses real ffmpeg-generated silence) | `pytest tests/test_reels_tts.py::test_ffprobe_duration_measured_per_cena -x` | ❌ Wave 0 |
| TTS-03 | `step_state.tts.cenas[i].duration` persisted with float seconds | integration (in-memory JSON mutation + `flag_modified` assertion) | `pytest tests/test_reels_tts.py::test_step_state_cenas_persisted -x` | ❌ Wave 0 |
| TTS-04 | `narracao_completa.wav` is concatenated from per-cena files, not generated separately | unit (assert ffmpeg is called with `-f concat -c copy` and that Gemini is *not* called for the concat text) | `pytest tests/test_reels_tts.py::test_concat_not_single_call -x` | ❌ Wave 0 |
| TTS-04 (sum-tolerance) | `sum(cenas[i].duration) == get_video_duration(concat_path)` within 50ms | unit on real PCM files | `pytest tests/test_reels_tts.py::test_sum_matches_concat_within_tolerance -x` | ❌ Wave 0 |
| TTS-05 | `tone == "biblical"` forces `speaking_rate = 1.0` inside `generate_narration` | unit (captures the args passed to `client.models.generate_content` via monkeypatch) | `pytest tests/test_reels_tts.py::test_biblical_clamps_speed_to_1 -x` | ❌ Wave 0 |
| TTS-05 (log) | The override is logged at INFO level (D-12) | unit (pytest `caplog`) | `pytest tests/test_reels_tts.py::test_biblical_clamp_logged -x` | ❌ Wave 0 |
| TTS-06 | Single-cena failure does not abort; cena marked `failed=true`; other cenas intact | unit (monkeypatched Gemini: cena 3 raises, cenas 0-2 and 4-N succeed) | `pytest tests/test_reels_tts.py::test_single_cena_failure_isolated -x` | ❌ Wave 0 |
| TTS-06 (classification) | `ClientError(400)` is NOT retried; `ClientError(429)` IS retried 3x with backoff | unit (monkeypatch raises typed errors; assert attempt counts) | `pytest tests/test_reels_tts.py::test_error_classification -x` | ❌ Wave 0 |
| Success criterion #3 | Biblical reel audio is audibly slower than non-biblical | manual smoke (human listening) | N/A — documented as manual gate in PLAN.md | N/A |
| Success criterion #4 | Selective retry via `cena_indices` parameter preserves untouched cenas | integration (mock pipeline, call step twice with different `cena_indices`) | `pytest tests/test_reels_tts.py::test_selective_retry_preserves_others -x` | ❌ Wave 0 |
| Success criterion #5 | Editor still loads and plays waveform for `audio.wav` unchanged | manual smoke + programmatic check: `pytest tests/test_reels_tts.py::test_editor_compat_tts_path_and_duration_still_written -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/test_reels_tts.py -x -q` (< 30 seconds on mock clients)
- **Per wave merge:** `pytest tests/ -x -q --ignore=tests/test_bible_e2e.py` (full suite minus e2e marker)
- **Phase gate:** Full suite green + a manual editor smoke test on one regenerated reel before `/gsd:verify-work`

### Programmatic Editor-Compat Check

Success criterion #5 is mostly a manual smoke test, but one invariant is automatable: after a TTS step run, `step_state.tts.path` must be a valid file path pointing to `audio.wav` and `step_state.tts.duration` must be a float within the sanity window `[0.5, 600]` (the bounds the editor enforces at `memelab/src/stores/editor-store.ts:192-193`):

```python
def test_editor_compat_tts_path_and_duration_still_written(tmp_path, mock_pipeline):
    """Regression: editor at editor-store.ts:167 and :198 read these exact fields."""
    step_state = run_tts_step_with_fake_gemini(job_dir=tmp_path)
    assert step_state["tts"]["path"].endswith("audio.wav")
    assert os.path.isfile(step_state["tts"]["path"])
    assert isinstance(step_state["tts"]["duration"], float)
    assert 0.5 <= step_state["tts"]["duration"] <= 600
```

### Bit-Exact Concat Assertion Test Pattern

Success criterion #2 (sum-to-tolerance) has a stronger form — the concat is bit-exact, so we can assert equality to within FP rounding, not just 50ms:

```python
def test_sum_matches_concat_within_tolerance(tmp_path):
    """Verified locally: ffmpeg -f concat -c copy produces bit-exact PCM WAV merge.
    50ms tolerance is cosmetic — real variance is sub-millisecond."""
    # Arrange: create 3 real PCM WAV files with wave module (fast, deterministic)
    per_cena_paths = make_fake_tts_wavs(tmp_path, n_frames_list=[73_123, 89_451, 105_903])
    # Act: call concat helper
    concat_path = _concat_cena_wavs(per_cena_paths, tmp_path / "audio.wav")
    # Assert
    per_cena_durs = [get_video_duration(p) for p in per_cena_paths]
    concat_dur = get_video_duration(concat_path)
    assert abs(sum(per_cena_durs) - concat_dur) < 0.050  # 50ms tolerance from success criterion
    assert abs(sum(per_cena_durs) - concat_dur) < 0.001  # stronger: sub-millisecond
```

### Wave 0 Gaps
- [ ] `tests/test_reels_tts.py` — covers TTS-01..TTS-06 + success criteria #2/#4/#5 programmatic parts. Does not yet exist.
- [ ] `tests/conftest.py` — does not currently exist in this repo (no fixtures shared across tests). Phase 22 needs at minimum a fake-Gemini monkeypatch helper and a `make_fake_tts_wavs(tmp_path, n_frames_list)` fixture. Add as a new `tests/conftest.py` or as local fixtures inside `tests/test_reels_tts.py`.
- [ ] No pytest install needed — already in use (20+ existing test files).
- [ ] Consider adding a `@pytest.mark.reels` marker if the planner wants to scope "quick TTS tests" vs the full suite, but this is optional.

## Sources

### Primary (HIGH confidence — verified locally or against installed SDK)

- **Installed SDK:** `google-genai` 1.68.0 inspected via `python3 -c "from google.genai import errors; print(dir(errors))"`
  - Confirmed: `APIError`, `ClientError`, `ServerError`, `UnknownApiResponseError`, `FunctionInvocationError` exist
  - Confirmed: `APIError.code` is int, `.status` is string (e.g., `"RESOURCE_EXHAUSTED"`), `.message` is string
  - Confirmed: `ClientError extends APIError` (4xx), `ServerError extends APIError` (5xx)
  - Confirmed: `client.aio.models.generate_content(...)` is available as a coroutine (native async path exists)

- **Local ffmpeg bit-exact concat test:** `python3` script run in `/Users/luigivivian/meme-lab/` using system `ffmpeg`
  - Created 3 PCM WAV files (`pcm_s16le, 24000Hz, mono, 73123/89451/105903 frames`)
  - Ran `ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy out.wav`
  - Confirmed: `out_frames == sum(input_frames)` (268477 == 268477)
  - Confirmed: MD5 of `wave.readframes(nframes)` on `out.wav` equals MD5 of `b''.join(payloads)` — bit-identical payload
  - Conclusion: `-c copy` is sample-exact for this format; 50ms tolerance is met by four orders of magnitude

- **Local ffprobe vs `wave` precision test:** Same session
  - Created a 127,493-frame PCM WAV (24kHz mono, 5.312208333s exact)
  - `ffprobe format=duration` → 5.312208000
  - `ffprobe stream=duration` → 5.312208000
  - `wave.getnframes()/framerate` → 5.312208333
  - Delta: 0.000333 ms (sub-microsecond) — `get_video_duration()` is sufficient

- **Codebase inspection:** All file:line references in this document were read directly, not inferred.
  - `/Users/luigivivian/meme-lab/src/reels_pipeline/tts.py:73-157` — `generate_narration` full source
  - `/Users/luigivivian/meme-lab/src/reels_pipeline/main.py:355-383` — current `run_step_tts`
  - `/Users/luigivivian/meme-lab/src/reels_pipeline/main.py:589-936` — `run_step_video_kie` full per-scene loop pattern
  - `/Users/luigivivian/meme-lab/src/reels_pipeline/main.py:1083` — batch-mode TTS caller
  - `/Users/luigivivian/meme-lab/src/api/routes/reels.py:218-228` — current tts step handler
  - `/Users/luigivivian/meme-lab/src/api/routes/reels.py:276-298` — `_scene_update` / `on_scene_update` canonical pattern
  - `/Users/luigivivian/meme-lab/src/reels_pipeline/video_builder.py:293-317` — `get_video_duration()` helper
  - `/Users/luigivivian/meme-lab/memelab/src/stores/editor-store.ts:110-217` — editor compat boundary (`tts.path`, `tts.duration`, `sourceVersion`)
  - `/Users/luigivivian/meme-lab/pyproject.toml` — pytest config (`asyncio_mode = "auto"`)

### Secondary (MEDIUM confidence — official docs / widely-cited community sources)

- [Gemini API Rate Limits (official)](https://ai.google.dev/gemini-api/docs/rate-limits) — confirms Google no longer publishes exact RPM for preview models; points developers to the AI Studio dashboard. Confirms 4xx/5xx error code semantics.
- [FFmpeg Formats Documentation — concat demuxer](https://ffmpeg.org/ffmpeg-formats.html) — authoritative source for the `-f concat -safe 0 -c copy` pattern, same-codec requirement, and the `-safe` flag position-sensitivity.
- [ffprobe Documentation (format entries)](https://ffmpeg.org/ffprobe-all.html) — format-level vs stream-level duration semantics.
- [Python `wave` module docs](https://docs.python.org/3/library/wave.html) — `getnframes()`, `getframerate()`, PCM-only support (matches what `_wrap_pcm_as_wav` already produces).
- [google-genai Python SDK (GitHub)](https://github.com/googleapis/python-genai) — async client access via `client.aio`, `asyncio.to_thread` workaround pattern, and the ongoing discussion about native async migration (issue #283).

### Tertiary (LOW confidence — community sources used only for background, not for load-bearing claims)

- Community guides on Gemini 429 error handling and tenacity retry patterns — used only to confirm the broad shape of the error-classification recommendation (already validated directly against the installed SDK). Not cited for specific numbers.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every library is already installed and already used in this codebase; no new dependencies
- Architecture pattern: **HIGH** — mirrors `run_step_video_kie` exactly, which is already in production
- ffmpeg concat bit-exactness: **HIGH** — verified locally with a deterministic test, MD5-confirmed bit-identical
- ffprobe precision: **HIGH** — verified locally on the exact sample format (24kHz mono 16-bit PCM)
- Gemini TTS error taxonomy: **HIGH** — verified by inspecting `google.genai.errors` source in the installed 1.68.0 package
- Gemini TTS exact RPM limits: **LOW** — Google does not publish; mitigated by `Semaphore(3)` + retry safety margin (design acknowledges the unknown)
- Editor compat boundary: **HIGH** — read the exact lines of `editor-store.ts` that will be the contract
- SQLAlchemy `flag_modified` pattern: **HIGH** — 15+ existing call sites in the same file being modified

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days — stable ecosystem; ffmpeg/asyncio/SQLAlchemy don't move fast; only risk is `google-genai` SDK bumping a major version)

---

*Phase: 22-per-cena-tts-anchoring*
*Researched: 2026-04-08*
