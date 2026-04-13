---
status: testing
phase: 01-per-scene-config-write-back-to-backend
source: [01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md]
started: 2026-04-09T20:20:00Z
updated: 2026-04-09T20:20:00Z
---

## Current Test

number: 1
name: Per-scene voice change persists after TTS regen
expected: |
  1. Open a reel in the editor
  2. Select a scene in the timeline
  3. In the Properties Panel (right side), change the voice dropdown to a different voice (e.g., "Aoede" or "Fenrir")
  4. Click "Regenerar Narracao" to trigger TTS regeneration
  5. After regen completes and the editor reloads, the voice dropdown for that scene should still show the voice you selected — NOT reset to the global default
awaiting: user response

## Tests

### 1. Per-scene voice change persists after TTS regen
expected: Open a reel in the editor, select a scene, change voice to a different one (e.g. Aoede), regenerate narration, and after reload the scene should still show the selected voice — not the global default.
result: [pending]

### 2. Per-scene speed change persists after TTS regen
expected: Open a reel in the editor, select a scene, change the speed slider to a different value (e.g. 1.5), regenerate narration, and after reload the scene should still show the configured speed — not the global default (1.1).
result: [pending]

### 3. Amber "display-only" warning removed
expected: In the Properties Panel voice/speed section, there should be NO amber warning text saying "Voz e velocidade aqui sao apenas visualizacao". The warning that told users voice/speed were display-only should be completely gone.
result: [pending]

### 4. Per-scene voice actually used in generated audio
expected: Set scene 0 to a noticeably different voice (e.g. "Fenrir" which is deeper). Regenerate TTS. Listen to the audio for that scene — it should sound like the selected voice, not the global default voice.
result: [pending]

### 5. Multiple scenes with different voices
expected: Set scene 0 to one voice (e.g. "Aoede") and scene 1 to a different voice (e.g. "Fenrir"). Regenerate TTS. Each scene's audio should sound like its respective configured voice.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none yet]
