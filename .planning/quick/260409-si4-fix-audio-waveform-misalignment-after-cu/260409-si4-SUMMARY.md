---
phase: quick
plan: 260409-si4
subsystem: ui
tags: [editor, audio, waveform, bugfix]

key-files:
  modified:
    - memelab/src/stores/editor-store.ts

duration: 3min
completed: 2026-04-09
---

# Quick Task 260409-si4: Fix audio waveform misalignment after cut and move

**Fixed reorderScenes audio remapping to properly handle from, durationInFrames, and startFrom**

## Accomplishments
- Rewrote audio remapping in `reorderScenes` to decompose audio items into per-scene segments
- Each segment now gets correct `from` (new scene position + intra-scene offset), `durationInFrames` (clamped to scene boundary), and `startFrom` (source audio offset for waveform display)
- Handles both post-split (1:1 audio-to-scene) and unsplit (audio spans multiple scenes) cases
- Unsplit audio that spans multiple scenes is automatically split into per-scene segments during reorder

## Root Cause
`reorderScenes` only updated `audio.from` by the scene's positional delta. After a split+move:
- `durationInFrames` still covered the old range (audio block wrong width)
- `startFrom` was unchanged (waveform showed wrong slice of source audio)
- Audio blocks ended up at wrong positions with wrong durations

## Self-Check: PASSED
