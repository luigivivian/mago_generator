"use client";

import { useEffect, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/stores/editor-store";
import { EDITOR_FPS, DEFAULT_SUBTITLE_STYLE } from "@/stores/editor-types";
import { genId } from "@/lib/editor";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useEditorShortcuts(
  playerRef: React.RefObject<PlayerRef | null>,
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const store = useEditorStore.getState();
      const temporal = useEditorStore.temporal.getState();

      // Space = toggle play/pause
      if (e.code === "Space") {
        e.preventDefault();
        const player = playerRef.current;
        if (!player) return;
        if (player.isPlaying()) player.pause();
        else player.play();
        return;
      }

      // Backspace/Delete = delete selected item (priority: subtitle > audio > scene)
      if (e.code === "Backspace" || e.code === "Delete") {
        e.preventDefault();
        if (store.selectedSubtitleId) {
          store.deleteSubtitle(store.selectedSubtitleId);
        } else if (store.selectedAudioId) {
          store.deleteAudioItem(store.selectedAudioId);
        } else if (store.selectedSceneId && store.scenes.length > 1) {
          store.deleteScene(store.selectedSceneId);
        }
        return;
      }

      // Ctrl+Z = undo, Ctrl+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) {
          if (temporal.futureStates.length > 0) temporal.redo();
        } else {
          if (temporal.pastStates.length > 0) temporal.undo();
        }
        return;
      }

      // D = duplicate selected scene
      if (e.code === "KeyD" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (store.selectedSceneId) {
          store.duplicateScene(store.selectedSceneId);
        }
        return;
      }

      // S = split at playhead (scene, subtitle, or audio — whichever is selected)
      if (e.code === "KeyS" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const frame = store.playheadFrame;

        if (store.selectedSubtitleId) {
          store.splitSubtitle(store.selectedSubtitleId, frame);
        } else if (store.selectedAudioId) {
          store.splitAudioItem(store.selectedAudioId, frame);
        } else if (store.selectedSceneId) {
          // Find frame offset within the selected scene
          let sceneStart = 0;
          for (const s of store.scenes) {
            if (s.id === store.selectedSceneId) break;
            sceneStart += s.durationInFrames;
          }
          const offset = frame - sceneStart;
          if (offset > 0) {
            store.splitScene(store.selectedSceneId, offset);
          }
        }
        return;
      }

      // F = freeze frame on selected scene (+1s)
      if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (store.selectedSceneId) {
          store.freezeFrame(store.selectedSceneId, EDITOR_FPS);
        }
        return;
      }

      // T = add subtitle ("Texto") at the playhead with a 2s default span,
      // then select it so PropertiesPanel switches to the subtitle editor.
      if (e.code === "KeyT" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const startFrame = Math.max(0, store.playheadFrame);
        const endFrame = startFrame + 2 * EDITOR_FPS;
        const id = genId("sub");
        store.addSubtitle({
          id,
          text: "Nova legenda",
          startFrame,
          endFrame,
          position: { x: 50, y: 85 },
          style: { ...DEFAULT_SUBTITLE_STYLE },
        });
        store.setSelectedSubtitle(id);
        return;
      }
    },
    [playerRef],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
