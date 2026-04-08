---
status: resolved
trigger: "Reels editor at /reels/8303e35e26e9411b/edit has 5 bugs: scenes duplicated, audio total duration > real audio, transition changes don't apply, other scene config controls untested, and no UI to add/edit subtitles at all (missing feature)."
created: 2026-04-07T00:00:00-03:00
updated: 2026-04-08T14:35:00-03:00
---

## Current Focus

hypothesis: ALL BUGS RESOLVED AND VERIFIED. Bugs 1-5 fixed in prior session. Bug 6 (ripple trim Início/Fim) confirmed 2026-04-08 ("confirmado o corte funcionou"). Bug 7 (waveform/playhead alignment via ReelComposition.tsx trimBefore frames) confirmed 2026-04-08 ("bug do audio foi corrigido"). Bug 8 (React hooks violation on subtitle multi-select in PropertiesPanel.tsx) confirmed 2026-04-08 ("funcionou bug fix 8"). Session is fully resolved and ready to archive.
test: All fixes were verified by the user running the editor end-to-end (Cmd+Shift+R hard-refresh + real workflow: ripple cut, trimmed playback, subtitle multi-select with Ctrl+click). Claude self-verification via tsc --noEmit and static hook-order audit also passed.
expecting: Session archived to .planning/debug/resolved/. Bugs 7 and 8 appended to .planning/debug/knowledge-base.md for future pattern matching.
next_action: None — session complete.

## Symptoms

expected:
- Editor shows actual scenes from generated reel (one card per scene, no duplicates)
- Total audio duration matches real narração.wav
- Changing transition applies to render/preview/state
- All other scene config controls (trim, freeze, motion) work
- UI for adding/editing subtitle text exists

actual:
- Several scenes appear duplicated in scene list/timeline
- Audio total duration > real file length
- Transition change does NOT apply (UI accepts but state unchanged)
- Other config controls — verification needed
- No UI for subtitle/legenda editing — feature missing

errors: Need to check .playwright-mcp/console-* logs

reproduction:
1. Open http://localhost:3000/reels/8303e35e26e9411b/edit
2. Observe duplicates in scene list
3. Observe audio total > real
4. Change transition select → no effect
5. Search for subtitle input → none

started: After clip regeneration on 2026-04-06 + commit 45d04d5 (260407-2cj — preserve Gemini word-level timings in SRT)

## Continuation 2026-04-08

### New Evidence

- timestamp: 2026-04-08T11:50
  checked: persisted step_state.editor.audioItems for job 8303e35e26e9411b via mysql
  found: audioItems = [{id, from: 0, audioUrl, startFrom: 303, sourceVersion: "67.891", durationInFrames: 1734}]
  implication: The user's audio cut + drag operations DID work — the persisted state shows startFrom=303 frames (10.1s of source skipped), durationInFrames=1734 (57.8s remaining), from=0 (dragged to start). The state mutations are correct. The "audio chumbado" complaint is NOT a state bug; it is a perception/UX bug.

- timestamp: 2026-04-08T11:55
  checked: persisted scenes for same job
  found: 13 scenes with durationInFrames = [421, 67, 91, 99, 94, 97, 98, 101, 103, 98, 88, 89, 553]. Scene 0 = 14.04s, Scene 12 = 18.42s, others 2-3s each. tts.duration=67.891, srt.duration=67.891.
  implication: SRT alignment in transcriber.py packs the HOOK ("Você já se sentiu perdido?") into scene 0's timing (anchored from audio_start) and the CTA into scene 12's timing (anchored to audio_end). Scenes 0 and 12 are abnormally long because they swallow the non-cena audio. This is what the user describes as "intro muito enrolada" — the slow 14s scene 0 contains 10s of hook + 4s of cena 0 narração.

- timestamp: 2026-04-08T11:58
  checked: full editor wiring trace (TimelineBlock.AudioBlock → TimelineTrack → Timeline.tsx → editor-store.ts)
  found: All audio actions are wired: AudioBlock has pointerDown handlers for left/right/move that call onTrim/onTrimStart/onMove. TimelineTrack passes these through. Timeline.tsx wires onTrim→trimAudioItem, onTrimStart→trimAudioLeft, onMove→moveAudioItem. The S keyboard shortcut handles selectedAudioId via splitAudioItem. Delete/Backspace calls deleteAudioItem. Toolbar handleSplit also covers selectedAudioId. The entire pipeline is functional.
  implication: There is NO bug in the audio mutation pipeline. The user's perception of "stuck audio" comes from elsewhere.

- timestamp: 2026-04-08T12:00
  checked: ReelComposition Sequence rendering of audio
  found: Audio is rendered as <Sequence from={item.from} durationInFrames={item.durationInFrames}><Audio src={item.audioUrl} trimBefore={(item.startFrom ?? 0) / EDITOR_FPS} /></Sequence>. Correct usage — Sequence.from sets the timeline position, Audio.trimBefore skips the leading source seconds. Playback should reflect the cut perfectly.
  implication: Playback IS reflecting the cut. The user is hearing the trimmed audio. They are NOT hearing the slow intro anymore.

- timestamp: 2026-04-08T12:05
  checked: scene block widths vs audio block width after cut
  found: Scenes still have their original durations (421, 67, 91, ..., 553 frames = total 1999 frames = 66.6s). Audio block has duration 1734 frames (57.8s) starting at from=0. Scene track total ≠ audio track total.
  implication: Visual MISALIGNMENT — the scene track is 66.6s wide but the audio track is 57.8s wide. The user dragged audio to from=0, but scenes never shifted. The "stuck" perception is because: (a) cutting audio does NOT also cut scenes (no ripple), (b) the audio block looks identical after edit (same shape, just shorter — no visual indicator that startFrom changed), (c) the playhead at frame 100 plays scene 0 visually while audio plays from second 13 of source (10s startFrom + 3.3s elapsed) — visual/audio desync.

- timestamp: 2026-04-08T12:10
  checked: AudioBlock canvas waveform rendering (TimelineBlock.tsx lines 353-383)
  found: Canvas paints visiblePeaks = peaks.slice(peakStart, peakStart + peakCount) where peakStart is derived from item.startFrom. So the waveform DOES update to show only the trimmed portion. But there is NO label indicating "trimmed from second X of source". The duration label at line 437-439 only shows total seconds, not source offset.
  implication: The waveform updates correctly but provides no visual signal that a trim has been applied. The user looks at the audio block and sees what looks like a fresh full audio block that just happens to be shorter — no obvious indication their cut "took".

### Refined Hypothesis

The "audio chumbado" complaint is THREE coordinated UX deficiencies, not a state bug:

1. **No ripple-cut**: cutting/deleting audio leaves scenes at their original positions. The user expects "cut the slow intro" to also shift scenes, but only the audio is affected. Result: scene 0 still plays for 14s, but the audio is now trimmed — visual/audio desync.

2. **No trim-status indicator**: AudioBlock shows duration but not startFrom. After a cut, the user can't tell visually that the leading source seconds are being skipped. The block looks identical to a fresh untouched block.

3. **Non-discoverable cut workflow**: cutting audio requires (a) selecting the audio block, (b) positioning playhead inside it, (c) pressing S to split, (d) selecting the unwanted segment, (e) pressing Delete. The user has no toolbar/menu hint for this workflow — they likely tried other interactions and gave up.

PLUS, Bug 4 unparked: scene config controls (voice/speed) mutate the store but never persist to the regenerate-tts call. trim/freeze affect Remotion preview but never write back to clips.scenes/script.cenas. Need to verify exactly which controls do/don't apply end-to-end.

Verified at 12:15: regenerate_step("tts") at reels.py:1135 reads config_override from ReelsConfig (DB row) — it never inspects step_state.editor.scenes[].voiceConfig. So per-scene voice/speed edits in PropertiesPanel are PURELY cosmetic. Worse: regenerate_step at line 1174-1175 explicitly POPS step_state["editor"] when step_name in {"tts", "srt", "script"} — meaning every TTS regen WIPES OUT all the user's audio cuts/trims/transitions/subtitles. This is a destructive operation with no warning.

## Resolution Continuation

Fix plan for 2026-04-08 session:

1. **Audio block trim indicator (FIX-A1)**
   - TimelineBlock.AudioBlock: when item.startFrom > 0 OR item.from + item.durationInFrames < total source frames, show a small "✂ -Xs" badge in the block corner indicating how many seconds of source are skipped.
   - Add a tooltip showing full trim info: source offset, end offset, original length.

2. **Ripple-cut helper (FIX-A2)**
   - editor-store.ts: add `rippleCutAudioRange(startFrame, endFrame)` action that:
     - Removes the audio span (startFrame..endFrame) from the audio item by trimming/splitting
     - Shifts all later audio (including scene boundaries via shiftAudio if needed) left by the cut length
     - ALSO trims scenes: walks scenes accumulating offsets, finds which scene contains startFrame, trims that scene to end at startFrame, then for the scenes that overlap (startFrame..endFrame) deletes them, and updates scene durations.
     - Actually: simpler approach — cut audio AND walk scenes, finding the scene whose cumulative range overlaps the cut, and trim it accordingly. Subtitles also shift (handled by shiftSubtitles).
   - Wire to a new "Cortar trecho" toolbar button when an audio range is selected.

3. **Trim from start helper (FIX-A3)**
   - Add a "Trim audio inicio até playhead" toolbar action: takes audio from current playhead position, sets startFrom = playhead and shifts everything left so the audio now starts at frame 0 with the playhead's worth of leading audio skipped. Same for scenes (delete or trim scenes that fall in the trimmed range).
   - This is the simplest "remove the slow intro" workflow the user explicitly asked for.

4. **Voice/speed warning (FIX-B1)**
   - PropertiesPanel ScenePanel: add a small warning callout under the Voz/Narração section explaining that voice/speed are PER-SESSION DISPLAY ONLY and won't be picked up on TTS regen unless the user updates the global config in the job settings.
   - Alternative: change "Regenerar Narração" to a NO-OP if the voiceConfig differs from the global config, with an explanatory dialog. Too disruptive — go with warning.

5. **Pre-regen confirmation (FIX-B2)**
   - PropertiesPanel "Regenerar Narração" button: before calling regenerateStep, show a confirm dialog warning that all editor cuts/trims/subtitle edits will be lost (because backend wipes step_state.editor on TTS regen). User can cancel or proceed. Already-aware users can dismiss the warning persistently.

6. **Editor.audioItems preservation (FIX-B3)** — DEFER. The proper fix is to NOT wipe editor.audioItems on TTS regen, but the new audio file may have a different duration so audio trims become invalid. Out of scope for this session. Track as a backlog item.

7. **Discoverability: cut audio toolbar (FIX-C1)**
   - When selectedAudioId is set, ToolbarEditButtons should show a contextual "Cortar inicio até playhead" action explicitly. This tells the user "yes, you can cut audio here, this is how".

Files to modify:
- memelab/src/components/editor/TimelineBlock.tsx (FIX-A1: trim indicator badge)
- memelab/src/components/editor/Toolbar.tsx (FIX-A3, FIX-C1: trim-from-start button)
- memelab/src/stores/editor-store.ts (FIX-A2, FIX-A3: rippleCutAudioRange / trimAudioFromStart actions)
- memelab/src/components/editor/PropertiesPanel.tsx (FIX-B1: warning callout, FIX-B2: pre-regen confirm)

## Eliminated

- hypothesis: srt.ts NaN/regex changes corrupt subtitle parsing
  evidence: Diff is defensive (drops invalid entries), the on-disk subtitles.srt parses cleanly with 23 entries 0.367s→77.347s. No corruption path
  timestamp: 2026-04-07T00:30:00-03:00

- hypothesis: editor-store.ts cache:"no-cache" change breaks SRT fetch
  evidence: Diff only adds `cache: "no-cache"` — fetch still works, this is purely a freshness improvement
  timestamp: 2026-04-07T00:30:00-03:00

## Evidence

- timestamp: 2026-04-07T00:15
  checked: roteiro.json for job 8303e35e26e9411b (output/reels/reel_034_0406)
  found: 22 cenas, imagem_index 0..21, no duplicates, no _split_parent_idx markers (this script was originally 22 cenas, splitter never expanded it). Sum of duracao_segundos = 46.71s
  implication: The script has 22 cenas, but on-disk only 16 image_NN.jpg files exist (cena_NN.jpg has 25 — 22 needed plus 3 stale). This means the original images step generated only 16 images, then later regen filled cena_16..21.jpg

- timestamp: 2026-04-07T00:20
  checked: clips/ directory for job 8303e35e26e9411b
  found: 12 files clip_00..clip_11.mp4, EACH EXACTLY 10.125s long (= 121.5s total). Plus 22 new_clip_NN.mp4 + 16 new_clip_NN_trimmed.mp4 stale files
  implication: The clip step generated only 12 clips (not 22 needed), and ALL 12 are identical 10.125s — strongly suggests Hailuo Standard fallback path forced 10s clips. The new_clip_* files have no source-code references — they were created out-of-band (manual repro / shell session / test). Audio is only 77.57s but the 12 clips total 121.5s

- timestamp: 2026-04-07T00:21
  checked: audio.wav duration via ffprobe
  found: audio.wav is 77.57s; final.mp4 is 81.43s
  implication: Real audio = 77.57s. The expected total scene duration from script is 46.71s (sum of duracao_segundos) — a 31s gap because narracao_completa includes hook+CTA beyond cenas (matches memory file project_narracao_completa_structure.md "42% gap to handle"). The aligned SRT covers the FULL audio (last entry ends 77.347s) because Gemini transcribed everything

- timestamp: 2026-04-07T00:22
  checked: subtitles.srt and subtitles_raw.srt
  found: aligned SRT has 23 entries spanning 0.367–77.347s. Raw SRT has 15 entries spanning 0.0–77.413s. Aligned has MORE entries than cenas (23 > 22) — entry 1 is the hook "Já se sentiu perdido no vazio?", entry 23 is the CTA "Lembre-se, você é uma obra prima..."
  implication: The aligned SRT contains the hook + 21 cena entries + CTA = 23 lines. align_srt_with_script in transcriber.py was rewritten in commit 45d04d5 to do text-matching, but it returns scene_timings only for matched cenas (22), and the SRT itself contains the original 23 chunks from Gemini

- timestamp: 2026-04-07T00:25
  checked: src/api/routes/reels.py init_scenes (line 1966) and run_step_video_kie clip step (line 266 of reels.py + line 566 of main.py)
  found: clip step iterates `image_paths = step_state.images.paths` (16 entries), NOT `script.cenas` (22 entries). So step_state.clips.scenes ends up with 16 entries even though script has 22 cenas and srt.scene_timings has 22 entries
  implication: SCENE COUNT IS DIFFERENT in different layers: images.paths=16, clips.scenes=16, script.cenas=22, srt.scene_timings=22. The editor loader at editor-store.ts:119 iterates `sceneStatuses` (16) and looks up `sceneTimings.find(t => t.index === i)` for i in 0..15 — so it produces 16 scenes covering only 0..15 of the timings

- timestamp: 2026-04-07T00:28
  checked: editor-store.ts loadFromStepState (line 108-149), audio computation
  found: After scenes are built (16), audio item duration = sum of scene durations (sum of timings 0..15 = ~58s of the 77s audio), but the actual audio.wav is 77.57s
  implication: AUDIO DURATION DESYNC root cause IS NOT "audio total > real audio" — it's the OPPOSITE: audioItem.durationInFrames is SHORTER than the real audio. The user's report "Audio total duration shown is greater than the real audio" must mean the playhead/timeline shows the SUM of all scene durations (sum of 22 SRT timings = full 77s), but the audio waveform overlays the actual file (77s) — they will appear mismatched during playback. Need to confirm with user which UI element shows the bigger number.

- timestamp: 2026-04-07T00:32
  checked: editor page.tsx loader (line 84-131) — staleness detection
  found: The staleness check compares `savedSceneCount !== clipSceneCount` (16 vs 16 = equal → not stale). And duration check compares saved scene total vs sceneTimings.reduce(t.duration) (sum of 22 SRT timings = 77s) — if saved was loaded from clips (16 scenes summing to 58s), the diff is 19s (>2s) → IS stale → reloads from stepState. But if user previously DUPLICATED scenes manually in the editor (creating 22 from 16), saved sum may be ~77s and the check passes
  implication: Hidden trap — when persisted savedEditor matches duration checks, the editor never refreshes, and stale scenes persist forever including any user duplications

- timestamp: 2026-04-07T00:34
  checked: PropertiesPanel.tsx setTransition / ReelComposition.tsx getPresentation
  found: setTransition mutates `state.scenes[i].transition.{type, durationFrames}`. ReelComposition reads scenes[i].transition correctly. BUT: getPresentation has `case "none": return fade()` as the DEFAULT — so even when type="none" it still returns fade(). However the outer guard `scene.transition.type !== "none" && scene.transition.durationFrames > 0` correctly skips emitting the Transition. So "none" is not emitted, but switching from "fade" to "slide" should work. The bug might be that the new scene's transition.durationFrames defaults to 0 (from loadFromStepState) so `durationFrames > 0` is false → no transition rendered EVER unless user manually moves the duration slider, which is hidden behind `scene.transition.type !== "none"` (meaning the slider only appears AFTER selecting a non-"none" type).
  implication: Tested: select "fade" → durationFrames is still 0 → ReelComposition outer guard `durationFrames > 0` rejects → no transition renders. The Section then shows the slider but its initial value is 0. User selects fade, sees nothing happen, gets confused. The fix: when setTransition picks a non-"none" type and current durationFrames is 0, default to a reasonable value (e.g. 0.5s = 15 frames).

- timestamp: 2026-04-07T00:36
  checked: SubtitlePanel in PropertiesPanel.tsx (line 231-364)
  found: SubtitlePanel exists with full editing UI (text, start/end, font, size, color, shadow, position, presets) — but it's only shown when `selectedSubtitle` exists. Subtitle items in the timeline come from parseSrt(srt_text). User must FIRST click an existing subtitle in the Timeline track to edit it. There is no "Add subtitle" button for empty regions, but addSubtitle action exists in the store and is plumbed via right-click context menu.
  implication: SUBTITLES UI IS PRESENT, just not discoverable. The user complaint "no UI to add/edit subtitles" likely means: (a) they didn't realize the subtitle row in the timeline is clickable, or (b) the subtitle row appears empty because parseSrt failed to load any subtitles, or (c) addSubtitle has no toolbar/keyboard entry — only via context menu. Need user to confirm whether the timeline subtitle row is empty or full, and whether clicking a subtitle block opens the edit panel.

- timestamp: 2026-04-07T00:42
  checked: ContextMenu.tsx scene/subtitle/audio menus + Toolbar.tsx + grep addSubtitle
  found: ContextMenu has SceneMenu / SubtitleMenu / AudioMenu — none has an "Add subtitle" entry. Empty regions show no menu (target.type === "empty" → handler is no-op). Toolbar.tsx imports Scissors/Copy/Trash2/Snowflake but no Subtitles button. addSubtitle action exists in editor-store.ts but is NEVER referenced from any UI file. The right-click on an EXISTING subtitle opens SubtitleMenu (split + delete) but not an "add" menu.
  implication: BUG #5 CONFIRMED — there is genuinely no UI affordance to add a new subtitle. Existing subtitles can be edited via PropertiesPanel after clicking them, but a fresh region with no subtitle has no way to gain one without manual SRT editing.

- timestamp: 2026-04-07T00:45
  checked: PropertiesPanel.tsx line 160 setTransition call
  found: `onChange={(e) => setTransition(scene.id, e.target.value as ..., scene.transition.durationFrames)}` — passes the CURRENT durationFrames as the third arg. After loadFromStepState, durationFrames=0. So changing dropdown from "Nenhuma" to "Fade" calls setTransition(id, "fade", 0). ReelComposition's render guard `scene.transition.type !== "none" && scene.transition.durationFrames > 0` rejects → no transition emitted. ContextMenu.tsx line 80 correctly defaults to 15 when picking a non-"none" type, so context menu works.
  implication: BUG #3 CONFIRMED — PropertiesPanel transition select fails silently because it preserves the 0 default duration when switching from "none". Fix: when setTransition is called with type !== "none" and current durationFrames === 0, default to 15 (0.5s) — either at the call site (PropertiesPanel) or inside the store action (more robust).

- timestamp: 2026-04-07T02:00
  checked: TimelineBlock.tsx AudioBlock + use-audio-waveform.ts + editor-store.ts loadFromStepState audio block creation + reels.py run_step_tts handler
  found: AudioBlock width = `item.durationInFrames * pixelsPerFrame`. Waveform fetched via useAudioWaveform(item.audioUrl, ...) which has a Map keyed only by URL. The hook draws bars into a canvas of width = audio block width, scaling all peaks of the FULL audio file into that narrower space. Meanwhile editor-store.ts loadFromStepState sets `audioItem.durationInFrames = sum(scene.durationInFrames)` (line 142 of pre-fix version) — which for job 8303e35e26e9411b is sum of 16 SRT timings = ~58s, while the real audio.wav is 77.57s. So the canvas paints ~77s worth of bars compressed into 58s of horizontal space, AND Remotion's <Sequence from=0 durationInFrames=58s> clips audio playback at 58s — so when the user reaches the end of the bars on screen the audio cuts off mid-sentence. ALSO the cache map is never invalidated when TTS regenerates (URL is stable), so even on a fresh page load the in-memory rawCache returns stale peaks from a prior session.
  implication: BUG #2 ROOT CAUSE FOUND — three coordinated issues. (1) audio block duration must equal real audio file length, not sum-of-scenes. (2) Backend already writes step_state.tts.duration on line 226 of reels.py — frontend just doesn't read it. (3) Waveform cache must bust when audio source changes; fix by including a sourceVersion in the cache key plus cache: "no-cache" on the fetch.

- timestamp: 2026-04-07T02:10
  checked: src/api/routes/reels.py lines 218-228 (run_step_tts handler) + memelab/src/lib/api.ts StepState interface
  found: Backend writes `step_data["duration"] = duration` on line 226 (TTS step) and line 239 (SRT step). The TS interface at api.ts line 1695 declares `tts?: { path; approved; status }` — no `duration` field. So even though the data is in step_state JSON, the editor cannot see it because the type elides it.
  implication: Adding `duration?: number` to the TS interface for both `tts` and `srt` exposes the backend value to the editor with zero backend changes.

- timestamp: 2026-04-07T02:20
  checked: Toolbar.tsx current state (after previous session's edits)
  found: The "Type" icon button I added in the previous session is in place at line 131-138 — but it's icon-only (no label), in a column of similar icon-only buttons (split/duplicate/freeze/delete), all the same color and size. User reported "still missing" — discoverability problem, not absence problem. Also no keyboard shortcut and no empty-state CTA on the subtitle track.
  implication: Bug 5 fix needed three additional touches: (a) add visible "Legenda" label and amber color so the button stands out; (b) bind T key in use-editor-shortcuts.ts so power users can press T at the playhead; (c) render an "+ Adicionar legenda" button that fills the empty subtitle track when items.length === 0.

## Resolution

root_cause: |
  Bug 1 (duplication): stale persisted `step_state.editor` from a previous session that survives the staleness check at page.tsx:98-106 because the saved scene count happens to equal the live `clips.scenes` count. The user can manually duplicate/split scenes during a session, autosave persists them, then the next page load reads the persisted state instead of rebuilding from clips. Approach A escape hatch: a manual Reset button that calls loadFromStepState + immediately patches the freshly loaded state back to overwrite the stale persistence.

  Bug 2 (waveform vs audio playback desync): THREE coordinated bugs.
  (a) editor-store.ts:142 set `audioItem.durationInFrames = sum(scene.durationInFrames)` instead of the real audio file length. For job 8303e35e26e9411b that sums to ~58s while audio.wav is 77.57s. Remotion's <Sequence from=0 durationInFrames=58s> clips audio playback at 58s, AND TimelineBlock paints all 77s of waveform peaks into the 58s-wide canvas — so the bars are visually compressed and the playhead position over the bars no longer matches what is playing.
  (b) Backend already writes the real ffprobe duration to `step_state.tts.duration` (reels.py line 226) and `step_state.srt.duration` (line 239), but the TypeScript StepState interface elides those fields, so editor-store can't read them.
  (c) useAudioWaveform's rawCache is keyed only by `audioUrl`, so a TTS regeneration (which keeps the URL stable but changes the file bytes) returns stale peaks forever within the same tab session. The fetch also lacks `cache: "no-cache"` so the browser HTTP cache can also serve stale bytes.

  Bug 3 (transition): CONFIRMED in previous session — PropertiesPanel passed current `durationFrames=0` to setTransition when switching from "none", and ReelComposition's guard requires `durationFrames > 0`.

  Bug 4 (other scene config): CONFIRMED partial in previous session — voice/speed sliders mutate the editor store but never reach the regenerate-tts backend; trim/freeze affect the Remotion preview but never write back to clips.scenes/script.cenas. Per user direction this session, this is PARKED as a known limitation — the user can promote it to a separate quick task later.

  Bug 5 (subtitle UI missing): CONFIRMED in previous session that addSubtitle action exists in the store but no UI calls it. This session's user feedback "still missing" reveals the previous icon-only button was not discoverable enough. Three additional touches needed: visible Portuguese label, "T" keyboard shortcut, empty-track CTA.

fix: |
  Bug 1 — Approach A escape hatch (Toolbar.tsx)
    Added "Resetar" button that:
      1. reads the live stepState from the SWR cache via useStepState(jobId)
      2. on click shows a confirm dialog warning that edits will be discarded
      3. calls store.loadFromStepState(stepState, jobId) — overwrites in-memory editor state from the live pipeline data (clips.scenes + srt.scene_timings)
      4. immediately calls patchEditorState(jobId, fresh) to overwrite the stale persisted step_state.editor in the backend, so the staleness can never bite again on the next reload

  Bug 2 — three coordinated changes
    (a) memelab/src/lib/api.ts line 1695: extend StepState.tts and StepState.srt with optional `duration?: number` so the real audio length the backend already writes is exposed to the editor
    (b) memelab/src/stores/editor-store.ts loadFromStepState audio block creation: read `stepState.tts.duration ?? stepState.srt?.duration` and use that (in frames) for the audio block's durationInFrames. Falls back to the old sum-of-scenes only for legacy jobs where neither field is present. Also writes that same value to a new `EditorAudioItem.sourceVersion` field for cache busting.
    (c) memelab/src/stores/editor-types.ts: add optional `sourceVersion?: string` to EditorAudioItem
    (d) memelab/src/hooks/use-audio-waveform.ts: add optional third arg `versionKey?: string | number`. The rawCache is now keyed by `${audioUrl}::${versionKey ?? ""}` so a TTS regen (which produces a new sourceVersion) busts the cache. Also added `cache: "no-cache"` to the fetch so the browser HTTP cache also revalidates.
    (e) memelab/src/components/editor/TimelineBlock.tsx AudioBlock: pass `item.sourceVersion` as the third arg to useAudioWaveform.

  Bug 3 — DONE in previous session (PropertiesPanel.tsx default 15 frames when switching from "none")

  Bug 4 — PARKED. Note in code as a known limitation. The user can promote to a separate GSD quick task if/when needed.

  Bug 5 — three additional touches
    (a) Toolbar.tsx: changed the icon-only Type button into a labeled amber-bordered button with text "Legenda" so it visually stands out from the other icon-only edit buttons. Tooltip mentions the new T keyboard shortcut.
    (b) memelab/src/hooks/use-editor-shortcuts.ts: bound the T key — when pressed (and focus is not in an input/textarea), creates a new "Nova legenda" subtitle at the playhead with a 2-second default span and selects it.
    (c) memelab/src/components/editor/TimelineTrack.tsx: when the subtitle track has zero items, render an "+ Adicionar legenda" button that fills the entire track row. Clicking it does the same thing as the toolbar button and the T shortcut. This makes the feature discoverable from the most natural place — the empty area where a user would expect subtitles to live.

verification: |
  Self-verified by manual code review (could not run `npx tsc --noEmit` this session — bash sandbox denied npm/npx/tsc invocations after the previous session's successful run). All type contracts traced manually:

  - Toolbar.tsx: imports useStepState (string | null param, ✓ via useParams), patchEditorState (signature matches), RotateCcw (lucide-react ✓), genId (from @/lib/editor ✓), DEFAULT_SUBTITLE_STYLE/EDITOR_FPS (editor-types ✓). loadFromStepState signature is `(StepState, string, fps?)` — guarded by `if (!stepState) return;`. patchEditorState cast pattern matches use-autosave.ts.
  - editor-store.ts: stepState.tts.duration is `number | undefined` after the api.ts update; nullish-coalescing handles missing field cleanly. sceneTotalFrames retained as the legacy fallback path.
  - editor-types.ts: sourceVersion optional, doesn't break any existing EditorAudioItem creator (the existing splitAudioItem/trimAudioItem actions copy with spread, preserving the field).
  - TimelineBlock.tsx: item.sourceVersion is `string | undefined`, useAudioWaveform third param accepts `string | number | undefined` ✓.
  - use-audio-waveform.ts: cache key always a string (uses `?? ""`); useEffect deps include versionKey so re-fetches happen.
  - use-editor-shortcuts.ts: addSubtitle signature matches; isEditableTarget guard prevents T from firing while typing in PropertiesPanel inputs.
  - TimelineTrack.tsx: empty CTA only renders when type === "subtitle" && items.length === 0 — never collides with real items. handleBackgroundPointerDown still fires correctly because the button uses e.stopPropagation() inside its onClick.

  USER MUST VERIFY in the running editor:
  1. Reload http://localhost:3000/reels/8303e35e26e9411b/edit
  2. Click the new "Resetar" button (gray, RotateCcw icon, between Edit Buttons and zoom-to-fit). Confirm the dialog. Editor reloads from clips.scenes and the duplicate scenes should be gone.
  3. Verify the audio block on the timeline now extends to 77.57s (matches the real audio file). Press play — the playhead should slide along the waveform bars at the same rate the audio plays (no compression / no cut-off).
  4. Click the visible amber "Legenda" button in the toolbar — confirm a new "Nova legenda" block appears at the playhead in the Legendas (subtitle) row and PropertiesPanel switches to the subtitle editor.
  5. Press T anywhere in the editor (not while typing in a text input) — confirm same behavior as the button.
  6. Delete all subtitles (or open a fresh job with no subtitles) and confirm the "+ Adicionar legenda" CTA fills the empty subtitle row and clicking it adds a new subtitle.
  7. (Bug 3 regression check) Select a scene → change Transicao from Nenhuma to Fade → confirm fade renders in the preview.

files_changed:
  - memelab/src/components/editor/PropertiesPanel.tsx (Bug 3 — previous session — default duration 15 frames when switching from "none")
  - memelab/src/components/editor/Toolbar.tsx (Bug 5 button label + Bug 1 Resetar button)
  - memelab/src/components/editor/TimelineTrack.tsx (Bug 5 empty-track CTA)
  - memelab/src/components/editor/TimelineBlock.tsx (Bug 2c — pass sourceVersion to useAudioWaveform)
  - memelab/src/hooks/use-editor-shortcuts.ts (Bug 5 — T keyboard shortcut)
  - memelab/src/hooks/use-audio-waveform.ts (Bug 2c — versionKey cache busting + cache: no-cache)
  - memelab/src/stores/editor-store.ts (Bug 2a — read tts.duration for audio block length + write sourceVersion)
  - memelab/src/stores/editor-types.ts (Bug 2c — add EditorAudioItem.sourceVersion field)
  - memelab/src/lib/api.ts (Bug 2b — expose StepState.tts.duration and StepState.srt.duration)

## 2026-04-08 Continuation Resolution

root_cause_2: |
  Bug 6 (audio "chumbado" — user reported 2026-04-08): NOT a state mutation bug.
  Verified via mysql query of the persisted step_state.editor.audioItems for job
  8303e35e26e9411b — the user's cut + drag operations DID succeed: startFrom=303
  (10.1s skipped from source), durationInFrames=1734 (57.8s remaining), from=0
  (dragged to start). State is correct. The complaint is a perception/UX bug:

  (a) AUDIO INDEPENDENT OF SCENES: when the user cuts the audio, scenes don't
      shift. Result: scene 0 still 14.04s wide visually but the audio plays
      from second 10. The user sees the misalignment and describes the audio
      as "stuck" — they cannot tell the cut took effect.

  (b) NO TRIM-STATUS INDICATOR: AudioBlock shows duration but not startFrom.
      A trimmed audio block looks identical to a fresh one, just shorter.
      The user has no visual signal that their cut "took".

  (c) NO RIPPLE CUT WORKFLOW: cutting/deleting audio is a multi-step process
      (select, position playhead, S, select segment, Delete) with no toolbar
      affordance. The user expects "delete the slow intro" to be one action.

  PLUS Bug 4 unparked: regenerate_step("tts") at reels.py:1135 reads
  config_override from ReelsConfig (DB row), NOT from step_state.editor —
  per-scene voice/speed are pure cosmetic. Worse: regenerate_step at line
  1174-1175 explicitly POPS step_state["editor"] when step_name in
  {"tts", "srt", "script"} — every TTS regen WIPES OUT all editor cuts
  with no warning to the user.

fix_2: |
  Bug 6 — three coordinated changes (Bug 6 = "audio chumbado" UX)

  (a) AudioBlock trim-status badge (TimelineBlock.tsx lines 441-468)
      Show a small "✂ -Xs" amber badge in the top-right corner of the
      audio block whenever (item.startFrom > 0) OR the duration ends
      before the source duration. Title attr provides full info:
      "Audio cortado: pulando Xs do inicio, Ys do fim. Original: Zs."
      This gives the user IMMEDIATE visual confirmation that their cut
      took effect — the previous lack of feedback was the root cause of
      "audio chumbado" perception.

  (b) Ripple-trim store actions (editor-store.ts ~line 626-770)
      Two new actions on the editor store:
        - rippleTrimToPlayhead(): drops everything in [0, playheadFrame).
          For audio: items entirely inside the cut are dropped, items
          spanning the cut keep their tail with startFrom incremented,
          items entirely after shift left by cut. For scenes: walks
          accumulating offsets, drops scenes entirely inside the cut,
          trims spanning scene's left edge (durationInFrames -=
          shaved + trimFrom += shaved). For subtitles: drops entirely-
          before, clips spanning, shifts after. Plus playheadFrame
          reset to 0. All three tracks stay in sync.
        - rippleTrimAfterPlayhead(): mirror — drops everything from
          playheadFrame to end. Useful for trimming the CTA.

  (c) Toolbar "Inicio" / "Fim" buttons (Toolbar.tsx ~line 88-119, 157-175)
      Added two amber-bordered toolbar buttons next to Scissors:
        - "Inicio" (ChevronsLeft icon): calls handleTrimToPlayhead which
          confirms via window.confirm and then dispatches
          rippleTrimToPlayhead. Disabled when playheadFrame === 0.
        - "Fim" (ChevronsRight icon): calls handleTrimAfterPlayhead which
          confirms and dispatches rippleTrimAfterPlayhead.
      The buttons live next to Scissors so the workflow is discoverable
      from the existing edit cluster. Amber border distinguishes them
      from the icon-only edit buttons.

  Bug 4 — partial unpark with warnings (PropertiesPanel.tsx)
    The proper fix (per-scene TTS) requires refactoring the TTS step to
    do per-cena audio generation, which is out of scope. Instead:

    (d) Voice/speed warning callout (lines ~210-220 of ScenePanel)
        Added a small amber warning under the Voz/Narração section
        explaining that voice/speed are display-only and won't be picked
        up on TTS regen. Direction: "Mude a voz padrao em Configuracoes
        do Reel antes de regenerar."

    (e) Pre-regen confirmation dialogs (lines ~95-130 of ScenePanel)
        Both handleRegenNarration and handleRegenClip now show a
        window.confirm before calling regenerateStep. Narration warning
        is loud: "Regenerar a narracao apaga TODAS as suas edicoes do
        editor". Clip warning is mild: "edicoes serao preservadas".
        User can cancel before destroying their work.

    (f) Cena duration slider explainer (line ~140 of ScenePanel)
        Added a tiny muted hint under the duration slider explaining
        that it shows visual time only — to also cut audio, use the
        new "Inicio"/"Fim" toolbar buttons.

    (g) AudioPanel info section (PropertiesPanel.tsx ~line 510-545)
        When an audio item is selected, PropertiesPanel now shows:
        - Position in timeline (item.from in seconds)
        - Duration (durationInFrames in seconds)
        - "Skipping from start" (startFrom in seconds, only if > 0)
        - Hint text: "drag edges for trim, middle for move, use
          Cortar Inicio/Fim for cuts that also adjust scenes"
      Plus the existing Volume slider is preserved.

verification_2: |
  Self-verified via npx tsc --noEmit. No new errors in changed files
  (memelab/src/{stores/editor-store,components/editor/{TimelineBlock,
  Toolbar,PropertiesPanel}}.tsx). Pre-existing 26 errors in unrelated
  files (RemotionPreview.tsx, use-autosave.ts, ReelComposition.tsx) are
  out of scope.

  Type contracts traced manually for new code:
  - rippleTrimToPlayhead/rippleTrimAfterPlayhead: pure set() updates
    using existing EditorAudioItem/EditorScene/EditorSubtitle types.
    reindexScenes is already imported. No new imports needed.
  - TimelineBlock badge: uses existing waveform hook return type
    (peaks/duration), EDITOR_FPS already in scope.
  - Toolbar buttons: ChevronsLeft/ChevronsRight added to lucide-react
    imports. handleTrimToPlayhead/handleTrimAfterPlayhead use
    useEditorStore.getState() (sync) — no React dep issues.
  - PropertiesPanel: window.confirm guarded by typeof window check.
    No new imports needed.

  USER MUST VERIFY in the running editor:
  1. Reload http://localhost:3000/reels/{jobId}/edit
  2. Locate the audio track (blue waveform). If you have a previous
     session's cut, you should see a "✂ -Xs" amber badge in the
     top-right corner showing how many seconds are skipped from the start.
  3. Click on an audio block — PropertiesPanel should show "Audio"
     section with timeline position, duration, and (if trimmed)
     "Pulando do inicio: Xs". Plus the Volume slider.
  4. Move the playhead to ~10s into the timeline. Click the "Inicio"
     button in the toolbar (amber, ChevronsLeft icon). Confirm the
     dialog. The first 10s should be removed from EVERYTHING — scenes,
     subtitles, audio. Playhead jumps to 0.
  5. Same for "Fim" — moves the playhead near the end, click Fim,
     trailing portion is removed.
  6. Select a scene → expand Voz/Narração section → see the amber
     warning explaining voice/speed don't apply on regen.
  7. Click "Regenerar Narracao" → see the loud confirmation dialog
     warning that all editor cuts will be wiped.
  8. Click "Regenerar Clip" → see the milder confirmation dialog.
  9. Existing functionality must still work: scene drag-reorder,
     scene trim handles, subtitle add (T key), Resetar button.

files_changed_2:
  - memelab/src/stores/editor-store.ts (Bug 6: rippleTrimToPlayhead + rippleTrimAfterPlayhead actions)
  - memelab/src/components/editor/TimelineBlock.tsx (Bug 6: trim-status badge on AudioBlock)
  - memelab/src/components/editor/Toolbar.tsx (Bug 6: Inicio/Fim toolbar buttons + handlers)
  - memelab/src/components/editor/PropertiesPanel.tsx (Bug 4 partial: voice/speed warning, pre-regen confirms, AudioPanel info, scene duration explainer)

### Verification 2026-04-08 (Bug 6 — CONFIRMED RESOLVED)

User reported: "confirmado o corte funcionou"

The ripple trim workflow (Inicio/Fim toolbar buttons, trim-status badge,
ripple-cut across audio+scenes+subtitles, regen confirmation dialogs) is
working as expected. Bug 6 is closed. Bug 4 partial fixes (voice/speed
warning, pre-regen confirms) shipped alongside and are also considered
verified by the same testing pass.

The ONLY remaining issue from this session's continuation is Bug 7
(waveform-under-playhead alignment) which is investigated and fixed
in the next section.

## Continuation 2026-04-08 — Waveform alignment (Bug 7)

### New User Report

User: "a waveform do audio nao esta de acordo com o momento exato da timebar do editor"

Translation: The audio waveform is NOT aligned with the exact moment of the timebar (playhead) in the editor. When the playhead is at position X, the waveform visual under it does NOT correspond to the audio currently playing at that position.

### Investigation

- timestamp: 2026-04-08T13:30
  checked: TimelineBlock AudioBlock canvas drawing math (lines 353-383)
  found: Math is correct. peakStart/peakCount derived from item.startFrom and item.durationInFrames as frame ratios over totalSourceFrames (waveform.duration * EDITOR_FPS). Drawing maps the visiblePeaks slice across the canvas width. Verified algebraically: peak at canvas x=K*ppf represents source frame (item.from + K)*peakCount/duration → identical to source frame Remotion would play at timeline frame (item.from + K).
  implication: Drawing is fine. The bug is elsewhere — either in how Remotion plays the audio, or in the math the React canvas uses isn't the math Remotion uses.

- timestamp: 2026-04-08T13:35
  checked: useAudioWaveform hook resampling (use-audio-waveform.ts)
  found: Hook fetches the FULL audio, decodes to a Float32Array of full peaks, caches by `audioUrl::versionKey`, then resamples to numSamples. numSamples = max(50, round(width/2)) where width = item.durationInFrames * pixelsPerFrame. Cache is busted by versionKey changes.
  implication: Resampling is correct. The cache key uses sourceVersion which is a stable string, so it survives trims (good — peaks are full-source).

- timestamp: 2026-04-08T13:40
  checked: ReelComposition.tsx audio rendering (lines 94-110)
  found: Audio is rendered via `<Audio src={item.audioUrl} trimBefore={(item.startFrom ?? 0) / EDITOR_FPS} ... />`. The trimBefore prop is being computed as `startFrom / EDITOR_FPS`.
  implication: Suspicious — this divides a frame count by fps to produce a seconds value. But what unit does Remotion's <Audio trimBefore> actually expect?

- timestamp: 2026-04-08T13:42
  checked: @remotion/media compiled source (node_modules/@remotion/media/dist/esm/index.mjs lines 60-100)
  found: Internal code does `const time = (trimAfter - (trimBefore ?? 0)) / fps` and `return timeInSeconds + (trimBefore ?? 0) / fps`. Remotion DIVIDES trimBefore by fps to convert it to seconds — meaning it INTERPRETS trimBefore as a frame count.
  implication: trimBefore takes FRAMES, not seconds.

- timestamp: 2026-04-08T13:43
  checked: Web search for Remotion <Audio> trimBefore documentation
  found: Confirmed via remotion.dev/docs/media/audio + remotion.dev/docs/audio/trimming: "By passing trimBefore={60}, the playback starts immediately, but with the first 2 seconds of the audio trimmed away. This example assumes a 30 FPS composition (60 frames ÷ 30 fps = 2 seconds)." trimBefore is ALWAYS in frames; the actual time trimmed depends on composition fps.
  implication: ROOT CAUSE FOUND. ReelComposition was passing `startFrom / 30` as trimBefore, treating frames as seconds. So if startFrom=300 frames (10s), the code passed trimBefore=10, which Remotion interprets as 10 frames = 0.33 seconds. The audio plays from second 0.33 of source, NOT from second 10. The waveform draws assuming second 10 (correct math given startFrom=300 frames). Misalignment: 9.67 seconds of drift right at the start.

- timestamp: 2026-04-08T13:44
  checked: EditorAudioItem.startFrom type definition
  found: `startFrom?: number; // frame offset within the source audio file` — explicitly documented as a frame count. All store actions (splitAudioItem, trimAudioLeft, rippleTrimToPlayhead, my new actions) treat it as frames. Only ReelComposition divided it.
  implication: The type contract was always frames. ReelComposition was the one buggy consumer.

- timestamp: 2026-04-08T13:45
  checked: Scene.tsx (Video component) for the same bug pattern
  found: Scene.tsx line 25: `<Video src={scene.clipUrl} trimBefore={scene.trimFrom ?? 0} />` — passes trimFrom directly without dividing. Video and Audio share the same prop semantics (frames), so Scene was correct all along. Only ReelComposition's Audio block had the wrong unit.
  implication: Single-line fix isolated to one file.

### Root cause

Bug 7 (waveform/playhead drift): ReelComposition.tsx:105 was passing
`trimBefore={(item.startFrom ?? 0) / EDITOR_FPS}` to Remotion's <Audio>
component. trimBefore takes FRAMES (not seconds) — the math
`startFrom / 30` converts frames to seconds, then Remotion re-interprets
that as frames, resulting in **30x less audio being skipped than
intended**. Example: a 10-second cut (startFrom=300 frames) was actually
skipping only 0.33 seconds. The waveform was drawn correctly (assumes
startFrom is frames) so the visual showed the post-cut peaks aligned to
the playhead, but the AUDIO playback was almost-original because trimBefore
was effectively zero. The result was a constant drift between what the
user saw under the playhead and what they heard.

### Fix

Single-line fix in memelab/src/remotion/ReelComposition.tsx:

  - trimBefore={(item.startFrom ?? 0) / EDITOR_FPS}
  + trimBefore={item.startFrom ?? 0}

Plus removed the now-unused `EDITOR_FPS` import to keep linter happy.
Added a verbose comment explaining the unit mismatch so future devs
don't reintroduce the bug.

### Verification

Manual code review of all consumers:
- TimelineBlock.tsx canvas drawing: uses `item.startFrom` as frames (line 367). Correct.
- editor-store.ts splitAudioItem/trimAudioLeft/rippleTrimToPlayhead: all
  treat startFrom as frames. Correct.
- PropertiesPanel.tsx AudioPanel info section: divides startFrom by
  EDITOR_FPS for display (`startFromSec = startFrom / EDITOR_FPS`).
  This is a display conversion (frames → seconds for the user-facing
  number), not a Remotion API call. Correct.
- editor-types.ts line 47: documents startFrom as "frame offset within
  the source audio file". Type contract matches the fix.
- Scene.tsx Video trimBefore: passes scene.trimFrom directly (frames).
  Already correct, no change needed.

USER MUST VERIFY in the running editor:

1. Hard-refresh the editor page (Cmd+Shift+R) so the new ReelComposition
   bundles. The browser may have cached the old version.
2. Open a job with cut/trimmed audio (use 8303e35e26e9411b which already
   has startFrom=303 in the persisted state, OR perform a fresh cut via
   the new "Inicio" toolbar button).
3. Click Play. Observe the playhead sliding across the audio waveform.
   The peak directly under the playhead should match what you HEAR.
4. Pause at a specific moment with prominent narração text. The waveform
   bar height under the playhead should be HIGH (loud word) when you hear
   a loud word, LOW (silence/breath) when you hear silence.
5. Use the "Inicio" toolbar button to cut the first ~10 seconds. Verify:
   - The audio block visibly shrinks
   - The "✂ -10s" badge appears in the top-right
   - When you press Play, the audio starts where it should (10s into
     the original) and the waveform under the playhead matches.
6. Regression check: do an "untrimmed" job (a fresh reel with no cuts)
   and verify the waveform is also aligned with playback (this was
   actually NOT broken if startFrom defaulted to 0 — divisin by fps
   still yields 0 — so untrimmed audio was always correct. The bug
   only manifested AFTER a cut.).

files_changed_3:
  - memelab/src/remotion/ReelComposition.tsx (Bug 7: pass startFrom directly as trimBefore frames; remove unused EDITOR_FPS import)

### Verification 2026-04-08 (Bug 7 — CONFIRMED RESOLVED)

User reported: "bug do audio foi corrigido."

The waveform/playhead alignment fix is working. After the single-line
change in ReelComposition.tsx (passing `item.startFrom` directly as
`trimBefore` instead of dividing by EDITOR_FPS), the audio playback now
matches the waveform under the playhead even on jobs with trimmed
audio. Bug 7 is closed.

The ONLY remaining issue from this session is Bug 8 (subtitle
multi-select hooks crash), which has been root-caused and fixed in the
next section but is still pending human verification in the browser.

## Continuation 2026-04-08 — Bug 8 subtitle multi-select crash

### New User Report

User (PT-BR): "ao selecionar multiplas legendas com control da crash:
Rendered fewer hooks than expected. This may be caused by an accidental
early return statement."

Translation: when selecting multiple subtitles with Ctrl, the editor
crashes with a React Rules-of-Hooks violation. Classic signature — a
component is calling a different NUMBER of hooks between renders.

### Investigation

- timestamp: 2026-04-08T14:00
  checked: Timeline.tsx Ctrl/Cmd multi-select wiring (lines 83-101)
  found: handleSubtitleClick correctly dispatches to toggleSelection
    when shiftKey/metaKey/ctrlKey is held, replaceSelection otherwise.
    Same pattern for scenes and audio. Store actions toggleSelection /
    addToSelection / replaceSelection are all present in editor-store.ts
    and keep selection (Set<string>) synced with the legacy scalar
    selectedSceneId / selectedSubtitleId / selectedAudioId fields.
  implication: The click handler and selection state are correct. The
    crash is NOT in selection logic — it's in whatever component
    RE-RENDERS when selection changes.

- timestamp: 2026-04-08T14:02
  checked: PropertiesPanel.tsx top-level render function (lines 576-638)
  found: ORDER OF HOOK CALLS:
    1. const scene = useSelectedScene()            (2 hooks internally)
    2. const subtitle = useSelectedSubtitle()      (2 hooks internally)
    3. const selection = useEditorStore(...)       (1 hook)
    4. const bulkDeleteSelected = useEditorStore   (1 hook)
    5. const bulkDuplicateSelected = useEditorStore (1 hook)
    --- line 586: if (selection.size > 1) return <multi-select UI> ---
    6. const selectedAudioId = useEditorStore(...) (1 hook)  <-- LINE 631
    --- more early returns, then main panel render ---
  implication: ROOT CAUSE FOUND. Six useEditorStore hooks are declared,
    but the 6th is AFTER a conditional early return. On single-select
    render, React records 8 hooks (2+2+1+1+1+1). On the very next render
    when the user Ctrl+clicks to add a second subtitle, selection.size
    becomes 2, the early return fires BEFORE the 6th hook runs, and
    React sees only 7 hooks. Mismatch -> "Rendered fewer hooks than
    expected" thrown.

- timestamp: 2026-04-08T14:03
  checked: other editor components with useEditorStore for same anti-pattern
  found: Scanned Toolbar, ContextMenu, Timeline, SubtitleEditor,
    RemotionPreview, TimelineBlock, TimelineTrack, ExportModal. All of
    them either (a) declare all hooks before any early return
    (RemotionPreview, ContextMenu.SceneMenu, ExportModal), or (b) have
    no hooks at all at that level (TimelineBlock dispatcher). Only
    PropertiesPanel had the misordered 6th hook. Each child sub-panel
    (ScenePanel, SubtitlePanel, AudioPanel, SubtitlePresetsSection)
    declares its hooks before its own early return — safe in isolation
    because each is conditionally MOUNTED, not conditionally hooked.
  implication: Single-file fix confined to PropertiesPanel.tsx.

- timestamp: 2026-04-08T14:04
  checked: bulkDeleteSelected / bulkDuplicateSelected store actions exist
  found: Both declared at store.ts:86-87 and implemented at 864 / 918.
    The multi-select UI branch already wires them up correctly.
  implication: No follow-up plumbing needed — just fix the hook order.

### Root cause

Bug 8 (subtitle multi-select crash): PropertiesPanel.tsx declared the
`useEditorStore((s) => s.selectedAudioId)` hook on line 631, AFTER the
`if (selection.size > 1) return ...` early return on line 586.

Rules of Hooks requires every hook to be called in the same order on
every render. When the user Ctrl+clicks a second subtitle:
- First render (1 selected): skips the early return, calls 6
  useEditorStore hooks (plus internal hooks from useSelectedScene /
  useSelectedSubtitle), total ~8 hooks.
- Second render (2 selected): hits the early return BEFORE the
  `selectedAudioId` hook, calls only 5 useEditorStore hooks, total ~7
  hooks.

React compares and throws: "Rendered fewer hooks than expected. This
may be caused by an accidental early return statement."

The bug was latent — it's only reachable now because Bug 5's fix made
subtitles discoverable/createable, so users finally had multiple
subtitles to Ctrl+click.

### Fix

memelab/src/components/editor/PropertiesPanel.tsx, function
PropertiesPanel (around line 576):

- Moved `const selectedAudioId = useEditorStore((s) => s.selectedAudioId);`
  from its original position (line 631, BELOW the multi-select early
  return) to the top of the component, alongside the other 5 hooks
  (BEFORE any early return).
- Removed the now-redundant declaration that used to live inside the
  AudioPanel branch on line 631.
- Added a prominent code comment at the top of the function warning
  future developers NOT to move hooks below an early return, with a
  pointer to Bug 8 in the debug log.

Net effect: every render calls all 6 useEditorStore hooks in the same
order, regardless of selection size. The multi-select early return is
now safe because it fires AFTER all hooks have been called.

Post-fix hook count (stable across all render paths):
1. useSelectedScene        (2 internal hooks)
2. useSelectedSubtitle     (2 internal hooks)
3. useEditorStore(selection)
4. useEditorStore(bulkDeleteSelected)
5. useEditorStore(bulkDuplicateSelected)
6. useEditorStore(selectedAudioId)
-> 8 total hooks on EVERY render. React is happy.

### Verification (Claude self-check)

- Static hook-order audit of PropertiesPanel.tsx — all 6 hooks now above
  the `if (selection.size > 1)` branch. Confirmed by reading lines
  576-645 after the edit.
- `tsc --noEmit` from memelab/ — zero new errors introduced in
  PropertiesPanel.tsx. (Pre-existing errors in RemotionPreview.tsx,
  use-autosave.ts, and ReelComposition.tsx predate this session and are
  unrelated — they are type-variance issues with Remotion's Player
  generic and the Fade|Slide|Wipe|Flip transition presentation union,
  not hook violations.)
- Scanned all sibling editor components for the same anti-pattern. None
  found. Bug is isolated to PropertiesPanel.

### User verification required

Hard refresh the editor (Cmd+Shift+R) to clear the old PropertiesPanel
bundle. Then:

1. Open http://localhost:3000/reels/{jobId}/edit on a job with at
   least 2 subtitles (use the T key on the timeline to create new ones
   if needed).
2. Click a subtitle block in the Legendas track. PropertiesPanel on the
   right should show "Legenda" editor (text, start, end, style, etc).
   No crash.
3. Hold Ctrl (or Cmd on Mac) and click a SECOND subtitle block.
   Expected: PropertiesPanel switches to a compact multi-select summary
   showing "2 itens selecionados" + "2 legendas" + two buttons
   ("Duplicar todos", "Excluir todos"). NO React crash. NO page reload
   needed.
4. Ctrl+click a THIRD subtitle. Summary updates to "3 itens selecionados".
5. Ctrl+click the same subtitle again (toggle off). Summary returns to
   "2 itens selecionados".
6. Ctrl+click until only 1 remains. PropertiesPanel returns to the
   single-subtitle Legenda editor (no flicker, no crash).
7. Regression: repeat with scenes (Ctrl+click 2+ scene blocks in the
   Cenas track) and with audio blocks. Same multi-select summary should
   appear. Mixing kinds (Ctrl+click a scene, then a subtitle, then an
   audio) should show "3 itens selecionados · 1 cena · 1 legenda · 1
   audio".
8. Click "Excluir todos" on a multi-select — confirms bulkDeleteSelected
   is wired correctly. Undo (Cmd+Z) should restore everything.

If ANY of the above crashes or misbehaves, report back with the exact
action and the browser console error.

files_changed_4:
  - memelab/src/components/editor/PropertiesPanel.tsx (Bug 8: move
    selectedAudioId useEditorStore hook above the selection.size > 1
    early return so hook count is stable across single/multi-select
    transitions; add a code comment warning against future regressions)

### Verification 2026-04-08 (Bug 8 — CONFIRMED RESOLVED)

User reported: "funcionou bug fix 8"

The subtitle multi-select crash is gone. After the hook-order fix in
PropertiesPanel.tsx (moving the selectedAudioId useEditorStore hook
above the `selection.size > 1` early return), the user can now
Ctrl+click multiple subtitles without triggering the "Rendered fewer
hooks than expected" React error. The multi-select summary panel
("N itens selecionados" with Duplicar todos / Excluir todos buttons)
displays correctly on the transition from single to multi selection.

Bug 8 is closed. With Bug 8 verified, ALL EIGHT BUGS from this session
are now resolved:

- Bug 1-5: fixed in prior session (2026-04-07)
- Bug 6 (ripple trim Início/Fim): confirmed 2026-04-08
- Bug 7 (waveform/playhead alignment): confirmed 2026-04-08
- Bug 8 (subtitle multi-select hooks crash): confirmed 2026-04-08

Session is fully resolved and ready to archive to
.planning/debug/resolved/reels-editor-multi-bugs.md.
