---
phase: quick
plan: 260406-editor-timeline-tools
subsystem: editor
tags: [editor, keyboard-shortcuts, timeline, context-menu, zustand]
key-files:
  created:
    - memelab/src/hooks/use-editor-shortcuts.ts
  modified:
    - memelab/src/stores/editor-store.ts
    - memelab/src/components/editor/ContextMenu.tsx
    - memelab/src/app/(editor)/reels/[jobId]/edit/page.tsx
decisions:
  - "Keyboard shortcuts skip events when focus is in input/textarea/contenteditable to avoid conflicts"
  - "freezeFrame adds frames to durationInFrames rather than creating a new scene segment"
  - "Subtitle split only shows in context menu when playhead overlaps a subtitle"
metrics:
  duration: 2m24s
  completed: 2026-04-06
---

# Editor Timeline Tools and Keyboard Shortcuts

Zustand store actions for subtitle/audio/freeze-frame ops, keyboard shortcuts hook, and enhanced timeline context menu.

## Commits

| # | Hash | Description | Files |
|---|------|-------------|-------|
| 1 | 31b58b3 | Store actions: deleteSubtitle, addSubtitle, splitSubtitle, deleteAudioItem, trimAudioItem, freezeFrame | editor-store.ts |
| 2 | 1bc4ac8 | Keyboard shortcuts hook: Space, Backspace/Delete, Ctrl+Z, Ctrl+Shift+Z | use-editor-shortcuts.ts |
| 3 | 8b851b3 | Context menu: Cortar Legenda no Playhead, Congelar Frame, Estender | ContextMenu.tsx |
| 4 | 67ad888 | Wire useEditorShortcuts into editor page | page.tsx |

## What Was Built

### Store Actions (editor-store.ts)
- `deleteSubtitle(subtitleId)` -- removes subtitle, clears selection if it was selected
- `addSubtitle(subtitle)` -- appends new EditorSubtitle to array
- `splitSubtitle(subtitleId, frame)` -- splits subtitle into two at given frame, with boundary guards
- `deleteAudioItem(audioId)` -- removes audio item from track
- `trimAudioItem(audioId, newDuration)` -- changes audio item durationInFrames
- `freezeFrame(sceneId, framesToFreeze)` -- adds frames to scene's durationInFrames

All actions go through zundo temporal middleware so they are automatically undoable.

### Keyboard Shortcuts (use-editor-shortcuts.ts)
- Space: toggle play/pause via playerRef
- Backspace/Delete: delete selected subtitle (priority) or selected scene (if >1 scene)
- Ctrl+Z / Cmd+Z: undo via zundo temporal
- Ctrl+Shift+Z / Cmd+Shift+Z: redo via zundo temporal
- Guards against firing when user is typing in input/textarea/contenteditable

### Context Menu (ContextMenu.tsx)
- "Cortar Legenda no Playhead": splits the active subtitle at the playhead position (only shown when a subtitle overlaps the playhead)
- "Congelar Frame (+1s)": extends scene by EDITOR_FPS (30) frames via freezeFrame
- "Estender (+1s)": extends scene duration by EDITOR_FPS frames via trimScene

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
