"use client";

import { useEffect, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/stores/editor-store";

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
        if (player.isPlaying()) {
          player.pause();
        } else {
          player.play();
        }
        return;
      }

      // Backspace/Delete = delete selected item
      if (e.code === "Backspace" || e.code === "Delete") {
        e.preventDefault();
        if (store.selectedSubtitleId) {
          store.deleteSubtitle(store.selectedSubtitleId);
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
    },
    [playerRef],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
