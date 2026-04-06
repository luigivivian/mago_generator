---
status: investigating
trigger: "reels-sync-and-tts-quality — TTS robotic, scene/clip sync off, subtitles not synced"
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T00:01:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED for all 3 issues — see Resolution section
test: Full code trace complete across tts.py, video_builder.py, transcriber.py, main.py, reels.py
expecting: N/A — root cause analysis complete, awaiting user review before fixing
next_action: Present root cause analysis to user

## Symptoms

expected: Emotional, expressive narration with proper pacing for biblical content. Video scenes perfectly synced to narration timing. Subtitles appearing exactly when words are spoken.
actual: Robotic monotone narration. Scenes and narration are misaligned. Subtitles out of sync.
errors: No crash errors — quality/sync issue in pipeline output.
reproduction: View reel at http://localhost:3000/reels/5221431d6ef54e75 or check output/reels/reel_032_0404/final.mp4
started: Current pipeline behavior — likely always been like this.

## Eliminated

## Evidence

- timestamp: 2026-04-05T00:00:10Z
  checked: tts.py — generate_narration_per_scene function (lines 99-225)
  found: TTS calls pass raw narration text as `contents` with ZERO style/tone direction. Gemini TTS uses the `contents` field itself for both style instructions AND text-to-speak. Example from Google docs: "Say cheerfully: Have a wonderful day!" — the style is embedded in the contents. Current code passes just "No principio, a terra era vazia..." with no emotional direction.
  implication: This is the root cause of robotic, monotone narration. The TTS model has no instruction on HOW to speak — tone, emotion, pacing, dramatic delivery.

- timestamp: 2026-04-05T00:00:15Z
  checked: tts.py — speech_config (lines 82-91)
  found: Only PrebuiltVoiceConfig with voice_name is set. No `language_code` field. No `temperature` parameter. Voice is "Charon" (described as "serious, deep") which is reasonable for biblical content, but without style prompting it defaults to flat reading.
  implication: Missing temperature and language_code in GenerateContentConfig. Higher temperature = more expressive. Language code helps with accent/pronunciation.

- timestamp: 2026-04-05T00:00:20Z
  checked: video_builder.py — concat_clips_with_audio (lines 796-945)
  found: The function DOES use scene_timings indirectly via compute_scene_durations_from_script, which calculates proportional durations weighted by narration character count. Then _trim_clips_to_durations extends short clips with tpad (freeze last frame) or trims long ones. Evidence from actual output: clip_00 (5.875s raw) -> trimmed to 10.37s, matching scene 0's proportional share of 61.24s audio. This is WORKING CORRECTLY for visual sync.
  implication: Video clip duration matching is actually functional. The "sync off" perception likely comes from the SRT timing being wrong, not the clip timing.

- timestamp: 2026-04-05T00:00:25Z
  checked: SRT generation flow in reels.py (lines 231-256)
  found: When scene_timings exist (from per-scene TTS), the SRT is generated via generate_srt_from_timings() which creates subtitles with timestamps matching the TTS audio. BUT then in concat_clips_with_audio (line 872-884), the SRT is OVERWRITTEN by generate_srt_from_clips() which bases timestamps on TRIMMED CLIP durations, not audio durations. The clip durations don't match audio durations because clips are trimmed to proportional weights from character count, not from actual TTS durations.
  implication: SRT timestamps become based on clip visual durations rather than actual audio/narration durations. Since clips are extended/trimmed (some scenes have 5.875s clips extended to 10.37s via freeze-frame), the SRT timing diverges from audio.

- timestamp: 2026-04-05T00:00:30Z
  checked: Actual clip durations vs scene_timings from investigation_guidance
  found: |
    Scene timings from TTS:        Trimmed clip durations:
    Scene 0: 10.77s narration      clip_00_trimmed: 10.37s
    Scene 1: 6.89s narration       clip_01_trimmed: 6.43s
    Scene 2: 8.41s narration       clip_02_trimmed: 7.87s
    Scene 3: 7.53s narration       clip_03_trimmed: 8.57s (LONGER than narration)
    Scene 4: 9.73s narration       clip_04_trimmed: 9.47s
    Scene 5: 7.41s narration       clip_05_trimmed: 8.57s (LONGER than narration)
    Scene 6: 8.69s narration       clip_06_trimmed: 8.83s
    +loop: clip_00_loop_trimmed: 3.33s

    Audio total: 61.24s. Video total: 61.33s. Close but not exact.
    
    The clip durations are computed from CHARACTER COUNT proportions (compute_scene_durations_from_script), not from actual TTS scene_timings. For scenes 3 and 5, clips are LONGER than narration, meaning the next scene's audio starts playing over the previous scene's frozen frame.
  implication: The proportional-by-character-count approach is a rough approximation. The actual TTS durations are known (scene_timings) but NOT USED for clip trimming. This is the sync issue root cause.

- timestamp: 2026-04-05T00:00:35Z
  checked: generate_srt_from_clips (transcriber.py lines 328-389)
  found: This function generates SRT based on trimmed clip durations, subtracting transition_duration between scenes. It distributes narration text chunks evenly across each scene's effective duration. Since clip durations differ from TTS audio durations, subtitles drift.
  implication: The SRT re-generation from clip durations is the wrong approach when we have exact per-scene TTS timings.

## Resolution

root_cause: |
  THREE INTERRELATED ROOT CAUSES:

  1. **TTS Quality — No style/emotion prompting (CRITICAL)**
     File: src/reels_pipeline/tts.py, lines 154-168
     The `contents` parameter passed to Gemini TTS is just raw narration text ("No principio, a terra era vazia..."). Gemini TTS uses `contents` for BOTH style instructions AND text-to-speak. Without prepending a style prompt (e.g., "Narrate this biblical passage with reverence, emotion, and dramatic pacing: ..."), the model defaults to flat, robotic reading. Also missing: `temperature` (higher = more expressive) and `language_code` in the config.

  2. **Scene/Clip Sync — Using character-count proportions instead of actual TTS timings (MODERATE)**
     File: src/reels_pipeline/video_builder.py, lines 854-858
     `compute_scene_durations_from_script` computes clip durations proportionally by narration character count. But actual TTS durations are known from `scene_timings` (returned by generate_narration_per_scene). These exact durations are NOT passed to concat_clips_with_audio. Result: clips and audio drift by up to 1.14s per scene (scene 3: 7.53s audio vs 8.57s clip).

  3. **Subtitle Sync — SRT overwritten with clip-based timing instead of TTS-based timing (MODERATE)**
     File: src/reels_pipeline/video_builder.py, lines 872-884
     Even when the SRT was originally generated from exact TTS scene_timings, concat_clips_with_audio overwrites it with generate_srt_from_clips() which uses clip durations. This makes subtitles drift to match the (wrong) clip timing rather than the actual audio.

fix: |
  PROPOSED FIXES (pending user approval):

  1. **TTS Quality**: In generate_narration_per_scene, prepend a style/tone prompt to `contents`:
     - Add a `style_prompt` parameter (default for biblical: "Narrate with reverence, emotion, and dramatic pacing. Speak slowly at key moments, pause between sentences, convey the grandeur of the scene.")
     - Set `temperature` in GenerateContentConfig (e.g., 1.5-2.0 for more expression)
     - Consider `language_code: "pt-BR"` in SpeechConfig
     - Format contents as: f"{style_prompt}: {narracao}"

  2. **Scene/Clip Sync**: Pass actual scene_timings to concat_clips_with_audio so _trim_clips_to_durations uses real TTS durations instead of character-count proportions.
     - In run_step_video_kie (main.py), pass scene_timings as a parameter
     - In concat_clips_with_audio, when scene_timings provided, derive durations from them instead of compute_scene_durations_from_script
     - Account for xfade transition overlap in the calculation

  3. **Subtitle Sync**: When scene_timings are available, skip the generate_srt_from_clips re-generation in concat_clips_with_audio. The original SRT from generate_srt_from_timings is already correct relative to the audio.
     - Add a flag or check: if SRT was generated from TTS timings, don't overwrite
     - OR: regenerate SRT from scene_timings rather than clip durations

verification:
files_changed: []
