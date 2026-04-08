# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## reels-editor-waveform-drift — Remotion <Audio trimBefore> unit mismatch caused waveform/playhead drift after trimming audio
- **Date:** 2026-04-08
- **Error patterns:** waveform, playhead, audio, trim, trimBefore, drift, Remotion, Audio, Sequence, startFrom, EDITOR_FPS, desync, misalignment, ReelComposition
- **Root cause:** ReelComposition.tsx was passing `trimBefore={(item.startFrom ?? 0) / EDITOR_FPS}` to Remotion's `<Audio>` component. Remotion's `trimBefore` prop expects a FRAME count, not seconds — internally it divides by fps to get seconds. Dividing `startFrom` (frames) by `EDITOR_FPS` converted frames→seconds, then Remotion re-interpreted the result as frames, resulting in ~30x less audio being skipped than intended (e.g., a 10s cut at startFrom=300 frames actually skipped only 0.33s). The waveform canvas drawing was correct (treats startFrom as frames), so the visual showed the post-cut peaks under the playhead, but the actual playback was almost-original — producing a constant visual/audio drift that only manifested AFTER a cut (untrimmed audio with startFrom=0 divides to 0 and was always correct).
- **Fix:** One-line change in `memelab/src/remotion/ReelComposition.tsx` — pass `item.startFrom` directly as `trimBefore` without dividing by EDITOR_FPS. Removed the now-unused EDITOR_FPS import and added a verbose comment explaining the unit contract (`trimBefore` is frames, not seconds) so future devs don't reintroduce the bug. Scene.tsx's `<Video trimBefore>` was already correct.
- **Files changed:** memelab/src/remotion/ReelComposition.tsx
---

## reels-editor-multi-select-hooks-crash — React "Rendered fewer hooks than expected" on subtitle Ctrl+click multi-select
- **Date:** 2026-04-08
- **Error patterns:** Rendered fewer hooks than expected, Rules of Hooks, early return, multi-select, multiple selection, Ctrl+click, Cmd+click, subtitle, legenda, PropertiesPanel, useEditorStore, selectedAudioId, hooks violation, React crash
- **Root cause:** `PropertiesPanel.tsx` declared 5 `useEditorStore`/`useSelectedX` hooks at the top of its render function, then had an early return when `selection.size > 1` (multi-select summary branch), and finally declared a 6th hook (`useEditorStore((s) => s.selectedAudioId)`) AFTER that early return inside the AudioPanel branch. On the single-select render, all 6 hooks ran (total ~8 counting internal useEditorStore calls inside useSelectedScene/useSelectedSubtitle). On the next render when the user Ctrl+clicked to add a second subtitle, `selection.size` became 2, the early return fired BEFORE the 6th hook, and React detected the mismatched hook count and threw "Rendered fewer hooks than expected. This may be caused by an accidental early return statement." The bug was latent until Bug 5's fix made subtitles actually createable, giving users multiple items to multi-select for the first time.
- **Fix:** Moved the `const selectedAudioId = useEditorStore((s) => s.selectedAudioId);` declaration in `memelab/src/components/editor/PropertiesPanel.tsx` from inside the AudioPanel conditional branch up to the top of the `PropertiesPanel` function, alongside the other 5 hooks. Now all 6 hooks are called unconditionally on every render, and the `selection.size > 1` early return is safe because it fires AFTER all hooks have run. Added a prominent code comment at the top of the function warning future developers not to move hooks below early returns, with a pointer to Bug 8 in the debug log.
- **Files changed:** memelab/src/components/editor/PropertiesPanel.tsx
---

