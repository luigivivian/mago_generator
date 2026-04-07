# Meme Lab Dev Log

## Working State
**Session:** 1 | **Date:** 2026-04-06

### Active Task
Refatorar pipeline + fix TTS/sync/legendas + editor-first flow
- [x] Limpar historico reels do palavrasdeluz (8 jobs, 114 scene_assets, 9 dirs)
- [x] Backend: StepApproveResponse com redirect_to_editor
- [x] Backend: approve_step pula auto-trigger do video step quando aprovar clips
- [x] Frontend: handleApprove + step-clips redirect to editor
- [x] Fix: idempotent approve path also returns redirect_to_editor
- [x] Fix: reels list shows "Editar" for complete jobs without video_url
- [x] Fix: StepVideo shows "Abrir Editor" when no video rendered
- [x] Fix: BibleConfig auto-fills tema when selecting a story
- [x] Fix #1: TTS expressiveness — style prompts by tone + temperature 1.5
- [x] Fix #2: Scene sync — use exact SRT scene_timings instead of char-count proportions
- [x] Fix #3: SRT preserved (already fixed) — scene_timings stored in step_state
- [ ] Restart API server to load changes
- [ ] E2E test: full flow from create to editor redirect

### Key Files (current shape)
**`src/reels_pipeline/tts.py`** (MODIFIED)
5 tone presets (biblical, inspirational, storytelling, educational, motivational), temperature=1.5

**`src/reels_pipeline/transcriber.py`** (MODIFIED)
align_srt_with_script returns (srt_text, scene_timings) — per-scene {start, end, duration}

**`src/reels_pipeline/video_builder.py`** (MODIFIED)
concat_clips_with_audio prefers scene_timings > script proportions > SRT equal-split

**`src/api/routes/reels.py`** (MODIFIED)
Stores scene_timings in step_state.srt, passes through all concat_clips_with_audio calls

**`src/reels_pipeline/main.py`** (MODIFIED)
run_step_tts passes tone (auto-detects biblical from bible_config), run_step_srt returns scene_timings

### Decisions (active)
- Pipeline marks job "complete" after clips approval — video step becomes optional
- Editor-first: user validates in Remotion editor before spending render credits
- TTS style prompts embedded in contents field (Gemini TTS uses contents for both style and text)
- Scene timing hierarchy: SRT-derived > character-count proportions > equal-split

### Next Steps
1. Restart API server and test full flow
2. Test TTS quality improvement with biblical tone
3. Verify scene sync with new scene_timings

### Watch Out
- Server reload stuck (process state UN) — needs manual restart
- align_srt_with_script return type changed from str to tuple[str, list[dict]] — only 1 caller

---
---

## Session Archive

(No previous sessions)

## Milestones
- [ ] Editor-first pipeline flow complete and tested

## Mistakes & Lessons

## Technical Debt & Future Ideas
- Consider removing "video" from STEP_ORDER and stepper entirely (replace with "editor" step)
- Add auto-redirect on job page when job is complete + no video (currently shows StepVideo empty state with editor link)
