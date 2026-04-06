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
import { DEFAULT_VOICE_CONFIG, DEFAULT_SUBTITLE_STYLE, EDITOR_FPS } from "./editor-types";

function srtTimeToFrames(time: string, fps: number): number {
  const [h, m, rest] = time.split(":");
  const [s, ms] = rest.split(/[,.]/);
  const totalSeconds =
    parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  return Math.round(totalSeconds * fps);
}

function parseSrt(text: string, fps: number): EditorSubtitle[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n(?=\d+\n\d{2}:\d{2})/g, "\n\n");
  return normalized
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.length < 3) return null;
      const idx = parseInt(lines[0]);
      if (isNaN(idx)) return null;
      const [start, end] = lines[1].split(" --> ");
      const text = lines.slice(2).join("\n");
      return {
        id: `sub-${Date.now()}-${idx}`,
        text,
        startFrame: srtTimeToFrames(start?.trim() ?? "00:00:00,000", fps),
        endFrame: srtTimeToFrames(end?.trim() ?? "00:00:00,000", fps),
        position: { x: 50, y: 85 },
        style: { ...DEFAULT_SUBTITLE_STYLE },
      } as EditorSubtitle;
    })
    .filter((e): e is EditorSubtitle => e !== null);
}

interface EditorState {
  scenes: EditorScene[];
  subtitles: EditorSubtitle[];
  transitions: EditorTransition[];
  audioItems: EditorAudioItem[];
  selectedSceneId: string | null;
  selectedSubtitleId: string | null;
  selectedAudioId: string | null;
  playheadFrame: number;

  loadFromStepState: (stepState: StepState, jobId: string, fps?: number) => void;
  loadFromEditorState: (editorState: EditorPersistState) => void;
  // Linked scene operations — cascade to subtitles and audio
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  trimScene: (sceneId: string, newDuration: number) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;
  splitScene: (sceneId: string, frameOffset: number) => void;
  // Subtitle operations
  updateSubtitle: (subtitleId: string, updates: Partial<EditorSubtitle>) => void;
  deleteSubtitle: (subtitleId: string) => void;
  addSubtitle: (subtitle: EditorSubtitle) => void;
  splitSubtitle: (subtitleId: string, frame: number) => void;
  moveSubtitle: (subtitleId: string, deltaFrames: number) => void;
  // Audio operations
  deleteAudioItem: (audioId: string) => void;
  trimAudioItem: (audioId: string, newDuration: number) => void;
  moveAudioItem: (audioId: string, newFrom: number) => void;
  // Scene tools
  freezeFrame: (sceneId: string, framesToFreeze: number) => void;
  setTransition: (sceneId: string, type: EditorScene["transition"]["type"], durationFrames: number) => void;
  // Selection
  setSelectedScene: (sceneId: string | null) => void;
  setSelectedSubtitle: (subtitleId: string | null) => void;
  setSelectedAudio: (audioId: string | null) => void;
  setPlayheadFrame: (frame: number) => void;
  loadSubtitlesFromSrt: (jobId: string, srtPath: string, fps?: number) => void;
  totalDuration: () => number;
  toEditorPersistState: () => EditorPersistState;
}

let idCounter = 0;
function genId(prefix = "scene"): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

function reindexScenes(scenes: EditorScene[]): EditorScene[] {
  return scenes.map((s, i) => ({ ...s, index: i }));
}

// --- Linked operation helpers ---

function getSceneTimeRange(scenes: EditorScene[], sceneIndex: number): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < sceneIndex; i++) start += scenes[i].durationInFrames;
  return { start, end: start + scenes[sceneIndex].durationInFrames };
}

function shiftSubtitles(subs: EditorSubtitle[], afterFrame: number, delta: number): EditorSubtitle[] {
  return subs
    .map((s) => {
      if (s.startFrame >= afterFrame) {
        return { ...s, startFrame: s.startFrame + delta, endFrame: s.endFrame + delta };
      }
      if (s.endFrame > afterFrame) {
        return { ...s, endFrame: Math.max(s.startFrame + 1, s.endFrame + delta) };
      }
      return s;
    })
    .filter((s) => s.endFrame > s.startFrame && s.startFrame >= 0);
}

function shiftAudio(items: EditorAudioItem[], afterFrame: number, delta: number): EditorAudioItem[] {
  return items
    .map((a) => {
      if (a.from >= afterFrame) return { ...a, from: Math.max(0, a.from + delta) };
      if (a.from + a.durationInFrames > afterFrame) {
        return { ...a, durationInFrames: Math.max(1, a.durationInFrames + delta) };
      }
      return a;
    })
    .filter((a) => a.durationInFrames > 0);
}

function subsInRange(subs: EditorSubtitle[], start: number, end: number): EditorSubtitle[] {
  return subs.filter((s) => s.startFrame >= start && s.endFrame <= end);
}

function subsOverlapping(subs: EditorSubtitle[], start: number, end: number): EditorSubtitle[] {
  return subs.filter((s) => s.startFrame < end && s.endFrame > start);
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
      selectedAudioId: null,
      playheadFrame: 0,

      loadFromStepState: (stepState, jobId, fps = EDITOR_FPS) => {
        const sceneStatuses = stepState.clips?.scenes ?? stepState.video?.scenes ?? [];
        const imagePaths = stepState.images?.paths ?? [];
        // TTS scene_timings are authoritative for duration (narration length > clip length)
        const ttsTimings = (stepState.tts as Record<string, unknown>)?.scene_timings as
          | Array<{ index: number; start: number; end: number; duration: number; narracao?: string }>
          | undefined;

        const scenes: EditorScene[] = sceneStatuses.map((ss, i) => {
          const ttsTiming = ttsTimings?.find((t) => t.index === i);
          // Use TTS duration (narration length) when available, otherwise clip duration
          const durationSec = ttsTiming?.duration ?? ss.duration ?? 5;
          return {
            id: genId(),
            index: i,
            clipUrl: ss.clip_path ? reelFileUrl(jobId, ss.clip_path) : undefined,
            imgUrl: ss.img_path
              ? reelFileUrl(jobId, ss.img_path)
              : imagePaths[i]
                ? reelFileUrl(jobId, imagePaths[i])
                : undefined,
            durationInFrames: Math.round(durationSec * fps),
            narration: ttsTiming?.narracao ?? ss.prompt ?? "",
            voiceConfig: { ...DEFAULT_VOICE_CONFIG },
            transition: { type: "none" as const, durationFrames: 0 },
            status: "ready" as const,
          };
        });

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

        // Parse subtitles from SRT file if available
        const srtPath = stepState.srt?.path;
        if (srtPath) {
          const token =
            typeof window !== "undefined"
              ? (localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token"))
              : null;
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          fetch(reelFileUrl(jobId, srtPath), { headers })
            .then((r) => r.text())
            .then((text) => {
              const subtitles = parseSrt(text, fps);
              if (subtitles.length > 0) {
                set({ subtitles });
              }
            })
            .catch(() => {});
        }

        set({
          scenes,
          subtitles: [],
          transitions: [],
          audioItems,
          selectedSceneId: null,
          selectedSubtitleId: null,
          selectedAudioId: null,
          playheadFrame: 0,
        });
      },

      loadFromEditorState: (editorState) => {
        set({
          scenes: editorState.scenes,
          subtitles: editorState.subtitles,
          transitions: editorState.transitions,
          audioItems: editorState.audioItems,
          selectedSceneId: null,
          selectedSubtitleId: null,
          selectedAudioId: null,
          playheadFrame: 0,
        });
      },

      reorderScenes: (fromIndex, toIndex) => {
        set((state) => {
          const oldScenes = state.scenes;
          const newScenes = [...oldScenes];
          const [moved] = newScenes.splice(fromIndex, 1);
          newScenes.splice(toIndex, 0, moved);

          // Build old and new offset maps for each scene id
          const oldOffsets: Record<string, { start: number; end: number }> = {};
          let off = 0;
          for (const s of oldScenes) {
            oldOffsets[s.id] = { start: off, end: off + s.durationInFrames };
            off += s.durationInFrames;
          }
          const newOffsets: Record<string, { start: number; end: number }> = {};
          off = 0;
          for (const s of newScenes) {
            newOffsets[s.id] = { start: off, end: off + s.durationInFrames };
            off += s.durationInFrames;
          }

          // Remap subtitles: find which scene each sub belonged to, shift to new position
          const subtitles = state.subtitles.map((sub) => {
            for (const s of oldScenes) {
              const oldR = oldOffsets[s.id];
              if (sub.startFrame >= oldR.start && sub.startFrame < oldR.end) {
                const newR = newOffsets[s.id];
                const delta = newR.start - oldR.start;
                return {
                  ...sub,
                  startFrame: sub.startFrame + delta,
                  endFrame: sub.endFrame + delta,
                };
              }
            }
            return sub;
          });

          // Remap audio items similarly
          const audioItems = state.audioItems.map((a) => {
            for (const s of oldScenes) {
              const oldR = oldOffsets[s.id];
              if (a.from >= oldR.start && a.from < oldR.end) {
                const newR = newOffsets[s.id];
                return { ...a, from: a.from + (newR.start - oldR.start) };
              }
            }
            return a;
          });

          return { scenes: reindexScenes(newScenes), subtitles, audioItems };
        });
      },

      trimScene: (sceneId, newDuration) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const oldDuration = state.scenes[idx].durationInFrames;
          const delta = newDuration - oldDuration;
          if (delta === 0) return state;
          const range = getSceneTimeRange(state.scenes, idx);
          const scenes = state.scenes.map((s) =>
            s.id === sceneId ? { ...s, durationInFrames: Math.max(15, newDuration) } : s,
          );
          // Shift everything after this scene by the delta
          const subtitles = shiftSubtitles(state.subtitles, range.end, delta);
          const audioItems = shiftAudio(state.audioItems, range.end, delta);
          return { scenes, subtitles, audioItems };
        });
      },

      duplicateScene: (sceneId) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const original = state.scenes[idx];
          const range = getSceneTimeRange(state.scenes, idx);
          const duration = original.durationInFrames;

          const duplicate: EditorScene = { ...original, id: genId(), index: idx + 1 };
          const scenes = [...state.scenes];
          scenes.splice(idx + 1, 0, duplicate);

          // Clone subtitles within this scene's range, shifted to the duplicate position
          const clonedSubs = subsInRange(state.subtitles, range.start, range.end).map((s) => ({
            ...s,
            id: genId("sub"),
            startFrame: s.startFrame + duration,
            endFrame: s.endFrame + duration,
          }));
          // Shift existing subtitles after the insertion point forward
          const shifted = shiftSubtitles(state.subtitles, range.end, duration);
          const subtitles = [...shifted, ...clonedSubs].sort((a, b) => a.startFrame - b.startFrame);

          const audioItems = shiftAudio(state.audioItems, range.end, duration);

          return { scenes: reindexScenes(scenes), subtitles, audioItems };
        });
      },

      deleteScene: (sceneId) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const range = getSceneTimeRange(state.scenes, idx);
          const duration = range.end - range.start;
          // Remove subtitles entirely within the scene, shift later ones back
          const subsAfterRemove = state.subtitles.filter(
            (s) => !(s.startFrame >= range.start && s.endFrame <= range.end),
          );
          const subtitles = shiftSubtitles(subsAfterRemove, range.start, -duration);
          const audioItems = shiftAudio(state.audioItems, range.start, -duration);
          return {
            scenes: reindexScenes(state.scenes.filter((s) => s.id !== sceneId)),
            subtitles,
            audioItems,
            selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
          };
        });
      },

      splitScene: (sceneId, frameOffset) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1 || frameOffset <= 0 || frameOffset >= state.scenes[idx].durationInFrames)
            return state;
          const original = state.scenes[idx];
          const range = getSceneTimeRange(state.scenes, idx);
          const splitFrame = range.start + frameOffset; // absolute frame

          const firstHalf: EditorScene = { ...original, durationInFrames: frameOffset };
          const secondHalf: EditorScene = {
            ...original,
            id: genId(),
            durationInFrames: original.durationInFrames - frameOffset,
          };
          const scenes = [...state.scenes];
          scenes.splice(idx, 1, firstHalf, secondHalf);

          // Split subtitles that span the split point
          const subtitles: EditorSubtitle[] = [];
          for (const sub of state.subtitles) {
            if (sub.startFrame < splitFrame && sub.endFrame > splitFrame) {
              subtitles.push({ ...sub, endFrame: splitFrame });
              subtitles.push({
                ...sub,
                id: genId("sub"),
                startFrame: splitFrame,
              });
            } else {
              subtitles.push(sub);
            }
          }

          // Split audio items that span the split point
          const audioItems: EditorAudioItem[] = [];
          for (const a of state.audioItems) {
            const aEnd = a.from + a.durationInFrames;
            if (a.from < splitFrame && aEnd > splitFrame) {
              audioItems.push({ ...a, durationInFrames: splitFrame - a.from });
              audioItems.push({
                ...a,
                id: genId("audio"),
                from: splitFrame,
                durationInFrames: aEnd - splitFrame,
              });
            } else {
              audioItems.push(a);
            }
          }

          return { scenes: reindexScenes(scenes), subtitles, audioItems };
        });
      },

      updateSubtitle: (subtitleId, updates) => {
        set((state) => ({
          subtitles: state.subtitles.map((s) =>
            s.id === subtitleId ? { ...s, ...updates } : s,
          ),
        }));
      },

      deleteSubtitle: (subtitleId) => {
        set((state) => ({
          subtitles: state.subtitles.filter((s) => s.id !== subtitleId),
          selectedSubtitleId:
            state.selectedSubtitleId === subtitleId ? null : state.selectedSubtitleId,
        }));
      },

      addSubtitle: (subtitle) => {
        set((state) => ({
          subtitles: [...state.subtitles, subtitle],
        }));
      },

      splitSubtitle: (subtitleId, frame) => {
        set((state) => {
          const idx = state.subtitles.findIndex((s) => s.id === subtitleId);
          if (idx === -1) return state;
          const original = state.subtitles[idx];
          if (frame <= original.startFrame || frame >= original.endFrame) return state;
          const first: EditorSubtitle = {
            ...original,
            endFrame: frame,
          };
          const second: EditorSubtitle = {
            ...original,
            id: `sub-${Date.now()}-split`,
            startFrame: frame,
          };
          const subtitles = [...state.subtitles];
          subtitles.splice(idx, 1, first, second);
          return { subtitles };
        });
      },

      deleteAudioItem: (audioId) => {
        set((state) => ({
          audioItems: state.audioItems.filter((a) => a.id !== audioId),
        }));
      },

      trimAudioItem: (audioId, newDuration) => {
        set((state) => ({
          audioItems: state.audioItems.map((a) =>
            a.id === audioId ? { ...a, durationInFrames: newDuration } : a,
          ),
        }));
      },

      freezeFrame: (sceneId, framesToFreeze) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, durationInFrames: s.durationInFrames + framesToFreeze }
              : s,
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

      moveSubtitle: (subtitleId, deltaFrames) => {
        set((state) => ({
          subtitles: state.subtitles.map((s) =>
            s.id === subtitleId
              ? {
                  ...s,
                  startFrame: Math.max(0, s.startFrame + deltaFrames),
                  endFrame: Math.max(1, s.endFrame + deltaFrames),
                }
              : s,
          ),
        }));
      },

      moveAudioItem: (audioId, newFrom) => {
        set((state) => ({
          audioItems: state.audioItems.map((a) =>
            a.id === audioId ? { ...a, from: Math.max(0, newFrom) } : a,
          ),
        }));
      },

      setSelectedScene: (sceneId) => set({ selectedSceneId: sceneId }),
      setSelectedSubtitle: (subtitleId) => set({ selectedSubtitleId: subtitleId }),
      setSelectedAudio: (audioId) => set({ selectedAudioId: audioId }),
      setPlayheadFrame: (frame) => set({ playheadFrame: frame }),

      loadSubtitlesFromSrt: (jobId, srtPath, fps = EDITOR_FPS) => {
        const token =
          typeof window !== "undefined"
            ? (localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token"))
            : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        fetch(reelFileUrl(jobId, srtPath), { headers })
          .then((r) => r.text())
          .then((text) => {
            const subtitles = parseSrt(text, fps);
            if (subtitles.length > 0) {
              set({ subtitles });
            }
          })
          .catch(() => {});
      },

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
