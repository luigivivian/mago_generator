"use client";

import { useStore } from "zustand";
import { useEditorStore } from "@/stores/editor-store";

export function useUndoRedo() {
  const canUndo = useStore(useEditorStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditorStore.temporal, (s) => s.futureStates.length > 0);
  const { undo, redo } = useEditorStore.temporal.getState();
  return { undo, redo, canUndo, canRedo };
}

export function useTotalDuration() {
  const scenes = useEditorStore((s) => s.scenes);
  const sceneDuration = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  const transitionDuration = scenes.reduce((sum, s) => sum + s.transition.durationFrames, 0);
  return sceneDuration - transitionDuration;
}

export function useSelectedScene() {
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const scenes = useEditorStore((s) => s.scenes);
  return scenes.find((s) => s.id === selectedSceneId) ?? null;
}

export function useSelectedSubtitle() {
  const selectedSubtitleId = useEditorStore((s) => s.selectedSubtitleId);
  const subtitles = useEditorStore((s) => s.subtitles);
  return subtitles.find((s) => s.id === selectedSubtitleId) ?? null;
}
