import { create } from "zustand";
import { temporal } from "zundo";
import { reelFileUrl } from "@/lib/api";
import type { StepState } from "@/lib/api";
import type {
  EditorScene,
  EditorSubtitle,
  EditorTransition,
  EditorAudioItem,
  EditorPersistState,
} from "./editor-types";
import { DEFAULT_VOICE_CONFIG, EDITOR_FPS } from "./editor-types";

interface EditorState {
  scenes: EditorScene[];
  subtitles: EditorSubtitle[];
  transitions: EditorTransition[];
  audioItems: EditorAudioItem[];
  selectedSceneId: string | null;
  selectedSubtitleId: string | null;
  playheadFrame: number;

  loadFromStepState: (stepState: StepState, jobId: string, fps?: number) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  trimScene: (sceneId: string, newDuration: number) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  splitScene: (sceneId: string, frameOffset: number) => void;
  updateSubtitle: (subtitleId: string, updates: Partial<EditorSubtitle>) => void;
  setTransition: (sceneId: string, type: EditorScene["transition"]["type"], durationFrames: number) => void;
  setSelectedScene: (sceneId: string | null) => void;
  setSelectedSubtitle: (subtitleId: string | null) => void;
  setPlayheadFrame: (frame: number) => void;
  totalDuration: () => number;
  toEditorPersistState: () => EditorPersistState;
}

let idCounter = 0;
function genId(): string {
  return `scene-${Date.now()}-${++idCounter}`;
}

function reindexScenes(scenes: EditorScene[]): EditorScene[] {
  return scenes.map((s, i) => ({ ...s, index: i }));
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      scenes: [],
      subtitles: [],
      transitions: [],
      audioItems: [],
      selectedSceneId: null,
      selectedSubtitleId: null,
      playheadFrame: 0,

      loadFromStepState: (stepState, jobId, fps = EDITOR_FPS) => {
        const sceneStatuses = stepState.clips?.scenes ?? stepState.video?.scenes ?? [];
        const scenes: EditorScene[] = sceneStatuses.map((ss, i) => ({
          id: genId(),
          index: i,
          clipUrl: ss.clip_path ? reelFileUrl(jobId, ss.clip_path) : undefined,
          imgUrl: ss.img_path ? reelFileUrl(jobId, ss.img_path) : undefined,
          durationInFrames: (ss.duration ?? 5) * fps,
          narration: ss.prompt ?? "",
          voiceConfig: { ...DEFAULT_VOICE_CONFIG },
          transition: { type: "none" as const, durationFrames: 0 },
          status: "ready" as const,
        }));

        const audioItems: EditorAudioItem[] = [];
        if (stepState.tts?.path) {
          const totalDuration = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
          audioItems.push({
            id: `audio-${Date.now()}`,
            audioUrl: reelFileUrl(jobId, stepState.tts.path),
            from: 0,
            durationInFrames: totalDuration,
          });
        }

        set({
          scenes,
          subtitles: [],
          transitions: [],
          audioItems,
          selectedSceneId: null,
          selectedSubtitleId: null,
          playheadFrame: 0,
        });
      },

      reorderScenes: (fromIndex, toIndex) => {
        set((state) => {
          const scenes = [...state.scenes];
          const [moved] = scenes.splice(fromIndex, 1);
          scenes.splice(toIndex, 0, moved);
          return { scenes: reindexScenes(scenes) };
        });
      },

      trimScene: (sceneId, newDuration) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, durationInFrames: newDuration } : s,
          ),
        }));
      },

      duplicateScene: (sceneId) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const original = state.scenes[idx];
          const duplicate: EditorScene = {
            ...original,
            id: genId(),
            index: idx + 1,
          };
          const scenes = [...state.scenes];
          scenes.splice(idx + 1, 0, duplicate);
          return { scenes: reindexScenes(scenes) };
        });
      },

      deleteScene: (sceneId) => {
        set((state) => ({
          scenes: reindexScenes(state.scenes.filter((s) => s.id !== sceneId)),
        }));
      },

      splitScene: (sceneId, frameOffset) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const original = state.scenes[idx];
          const firstHalf: EditorScene = {
            ...original,
            durationInFrames: frameOffset,
          };
          const secondHalf: EditorScene = {
            ...original,
            id: genId(),
            durationInFrames: original.durationInFrames - frameOffset,
          };
          const scenes = [...state.scenes];
          scenes.splice(idx, 1, firstHalf, secondHalf);
          return { scenes: reindexScenes(scenes) };
        });
      },

      updateSubtitle: (subtitleId, updates) => {
        set((state) => ({
          subtitles: state.subtitles.map((s) =>
            s.id === subtitleId ? { ...s, ...updates } : s,
          ),
        }));
      },

      setTransition: (sceneId, type, durationFrames) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, transition: { ...s.transition, type, durationFrames } } : s,
          ),
        }));
      },

      setSelectedScene: (sceneId) => set({ selectedSceneId: sceneId }),
      setSelectedSubtitle: (subtitleId) => set({ selectedSubtitleId: subtitleId }),
      setPlayheadFrame: (frame) => set({ playheadFrame: frame }),

      totalDuration: () => {
        const state = get();
        const sceneDuration = state.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
        const transitionDuration = state.scenes.reduce((sum, s) => sum + s.transition.durationFrames, 0);
        return sceneDuration - transitionDuration;
      },

      toEditorPersistState: (): EditorPersistState => {
        const state = get();
        return {
          scenes: state.scenes,
          subtitles: state.subtitles,
          transitions: state.transitions,
          audioItems: state.audioItems,
        };
      },
    }),
    {
      partialize: (state) => ({
        scenes: state.scenes,
        subtitles: state.subtitles,
        transitions: state.transitions,
        audioItems: state.audioItems,
      }),
      limit: 50,
    },
  ),
);
