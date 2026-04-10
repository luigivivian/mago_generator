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
  const audioItems = useEditorStore((s) => s.audioItems);
  const subtitles = useEditorStore((s) => s.subtitles);
  const sceneEnd = scenes.reduce((max, s) => Math.max(max, s.from + s.durationInFrames), 0);
  const audioEnd = audioItems.reduce((max, a) => Math.max(max, a.from + a.durationInFrames), 0);
  const subEnd = subtitles.reduce((max, s) => Math.max(max, s.endFrame), 0);
  return Math.max(sceneEnd, audioEnd, subEnd);
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
