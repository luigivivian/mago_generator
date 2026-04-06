"use client";

import { useEffect, useCallback } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/stores/editor-store";
import { EDITOR_FPS } from "@/stores/editor-types";

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
          // Split audio at playhead
          const audio = store.audioItems.find((a) => a.id === store.selectedAudioId);
          if (audio && frame > audio.from && frame < audio.from + audio.durationInFrames) {
            const sourceOffset = audio.startFrom ?? 0;
            const first = { ...audio, durationInFrames: frame - audio.from };
            const second = {
              ...audio,
              id: `audio-split-${Date.now()}`,
              from: frame,
              durationInFrames: audio.from + audio.durationInFrames - frame,
              startFrom: sourceOffset + (frame - audio.from),
            };
            store.deleteAudioItem(audio.id);
            useEditorStore.setState((state) => ({
              audioItems: [...state.audioItems, first, second],
            }));
          }
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
    },
    [playerRef],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
