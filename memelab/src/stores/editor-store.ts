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
  SelectableKind,
  TrackKind,
} from "./editor-types";
import { DEFAULT_VOICE_CONFIG, EDITOR_FPS, selectionKey, parseSelectionKey } from "./editor-types";
import {
  genId,
  parseSrt,
  shiftSubtitles,
  shiftAudio,
  getSceneTimeRange,
  subsInRange,
  subsOverlapping,
  reindexScenes,
} from "@/lib/editor";

// SRT fetch race guard — generation counter + AbortController (D-04)
let srtGeneration = 0;
let srtAbortController: AbortController | null = null;

interface EditorState {
  scenes: EditorScene[];
  subtitles: EditorSubtitle[];
  transitions: EditorTransition[];
  audioItems: EditorAudioItem[];
  selectedSceneId: string | null;
  selectedSubtitleId: string | null;
  selectedAudioId: string | null;
  // 999.12 D-01: multi-select via "kind:id" key set
  selection: Set<string>;
  // 999.12 D-19: per-track mute/solo (UI state, not in undo history)
  mutedTracks: Set<TrackKind>;
  soloedTracks: Set<TrackKind>;
  playheadFrame: number;
  subtitlesEdited: boolean;

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
  splitAudioItem: (audioId: string, frame: number) => void;
  trimAudioItem: (audioId: string, newDuration: number) => void;
  trimAudioLeft: (audioId: string, newFrom: number) => void;
  moveAudioItem: (audioId: string, newFrom: number) => void;
  // 999.14 D-09 (Bug 6): ripple-cut up to playhead — trims the leading
  // segment off BOTH audio and scenes/subtitles, shifting everything left
  // so the timeline starts where the playhead was. The single most-requested
  // workflow ("delete the slow intro").
  rippleTrimToPlayhead: () => void;
  // 999.14 D-09: same idea but cuts from the playhead to the end
  rippleTrimAfterPlayhead: () => void;
  // Scene tools
  trimSceneLeft: (sceneId: string, newTrimFrom: number) => void;
  freezeFrame: (sceneId: string, framesToFreeze: number) => void;
  setTransition: (sceneId: string, type: EditorScene["transition"]["type"], durationFrames: number) => void;
  setPlaybackRate: (sceneId: string, rate: number) => void;
  resetClipStart: (sceneId: string) => void;
  moveScene: (sceneId: string, newFrom: number) => void;
  resetAudio: (jobId: string, stepState: Record<string, unknown>) => void;
  // Selection
  setSelectedScene: (sceneId: string | null) => void;
  setSelectedSubtitle: (subtitleId: string | null) => void;
  setSelectedAudio: (audioId: string | null) => void;
  // 999.12 D-01..D-03: multi-select
  toggleSelection: (kind: SelectableKind, id: string) => void;
  addToSelection: (kind: SelectableKind, id: string) => void;
  replaceSelection: (kind: SelectableKind, id: string) => void;
  clearSelection: () => void;
  bulkDeleteSelected: () => void;
  bulkDuplicateSelected: () => void;
  // 999.12 D-09, D-19: per-clip volume + per-track mute/solo
  setAudioVolume: (audioId: string, volume: number) => void;
  toggleTrackMute: (track: TrackKind) => void;
  toggleTrackSolo: (track: TrackKind) => void;
  setPlayheadFrame: (frame: number) => void;
  markSubtitlesClean: () => void;
  loadSubtitlesFromSrt: (jobId: string, srtPath: string, fps?: number) => void;
  totalDuration: () => number;
  toEditorPersistState: () => EditorPersistState;
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
      selection: new Set<string>(),
      mutedTracks: new Set<TrackKind>(),
      soloedTracks: new Set<TrackKind>(),
      playheadFrame: 0,
      subtitlesEdited: false,

      loadFromStepState: (stepState, jobId, fps = EDITOR_FPS) => {
        const sceneStatuses = stepState.clips?.scenes ?? stepState.video?.scenes ?? [];
        const imagePaths = stepState.images?.paths ?? [];
        // SRT scene_timings from Gemini alignment are authoritative for duration
        // (real narration length > clip length). Backend writes these under
        // step_state.srt (not step_state.tts). Each entry: { index, start, end,
        // duration, narracao } where duration is the real span length.
        const sceneTimings = (stepState.srt as Record<string, unknown> | undefined)?.scene_timings as
          | Array<{ index: number; start: number; end: number; duration: number; narracao?: string }>
          | undefined;

        // Source count priority:
        // 1. clips.scenes — authoritative when clips exist
        // 2. tts.cenas_meta — real per-cena TTS output (matches script cenas)
        // 3. script.json.cenas — the script itself
        // 4. srt.scene_timings — LAST resort (may have extra entries from scene splitter)
        const ttsCenas = (stepState.tts as Record<string, unknown> | undefined)?.cenas_meta as
          | Array<Record<string, unknown>> | undefined;
        const scriptCenas = (stepState.script as Record<string, unknown> | undefined)?.json as Record<string, unknown> | undefined;
        const scriptCenasCount = (scriptCenas?.cenas as unknown[] | undefined)?.length ?? 0;
        const sourceCount = sceneStatuses.length > 0
          ? sceneStatuses.length
          : ttsCenas && ttsCenas.length > 0
          ? ttsCenas.length
          : scriptCenasCount > 0
          ? scriptCenasCount
          : (sceneTimings?.length ?? 0);

        // When step_state is sparse (clips.scenes=[], images.paths=[]) we
        // reconstruct preview paths by pipeline convention: the pipeline
        // always writes images/cena_{i:02d}.jpg and either
        // clips/new_clip_{i:02d}_trimmed.mp4 (preferred) or
        // clips/new_clip_{i:02d}.mp4. The backend file route serves paths
        // relative to job_dir so these work even without step_state pointers.
        const pad2 = (i: number) => i.toString().padStart(2, "0");
        const conventionImg = (i: number) => `images/cena_${pad2(i)}.jpg`;
        const conventionClip = (i: number) => `clips/new_clip_${pad2(i)}_trimmed.mp4`;

        let fromCursor = 0;
        const scenes: EditorScene[] = Array.from({ length: sourceCount }, (_, i) => {
          const ss = sceneStatuses[i];
          const ttsCena = ttsCenas?.find((t: Record<string, unknown>) => t.index === i);
          const sceneTiming = sceneTimings?.find((t) => t.index === i);
          // Priority: tts.cenas_meta (post-compression) > srt.scene_timings > clips.scenes > fallback
          const durationSec = (ttsCena?.duration as number | undefined) ?? sceneTiming?.duration ?? ss?.duration ?? 5;
          const imgPath = ss?.img_path ?? imagePaths[i] ?? conventionImg(i);
          const clipPath = ss?.clip_path ?? conventionClip(i);
          const dur = Math.round(durationSec * fps);
          const sceneFrom = fromCursor;
          fromCursor += dur;
          return {
            id: genId(),
            index: i,
            from: sceneFrom,
            clipUrl: reelFileUrl(jobId, clipPath),
            imgUrl: reelFileUrl(jobId, imgPath),
            durationInFrames: dur,
            narration: sceneTiming?.narracao ?? ss?.prompt ?? "",
            voiceConfig: { ...DEFAULT_VOICE_CONFIG },
            transition: { type: "none" as const, durationFrames: 0 },
            status: "ready" as const,
          };
        });

        // Audio file convention: pipeline always writes audio.wav at job root.
        // When step_state.tts.path is missing (sparse step_state), fall back
        // to the convention path so the audio track still works.
        const ttsPath = stepState.tts?.path ?? "audio.wav";
        const audioItems: EditorAudioItem[] = [];
        if (ttsPath) {
          // 999.14 D-08 fix: audio block duration MUST be the real audio
          // file length, not the sum of scene durations. The backend writes
          // the real ffprobe duration to step_state.tts.duration when running
          // the TTS step. If that's missing (legacy jobs), fall back to the
          // SRT total duration (also real audio length, written by
          // run_step_srt), and finally to the sum of scene durations as a
          // last resort.
          //
          // When the audio block was sized to sum-of-scenes (the old buggy
          // behavior), Remotion's <Sequence> would clip playback at that
          // shorter span AND the waveform would be visually compressed
          // because TimelineBlock paints all the bars into the narrower
          // canvas — so the bars no longer aligned with where the playhead
          // sat during playback.
          const sceneTotalFrames = scenes.reduce(
            (sum, s) => sum + s.durationInFrames,
            0,
          );
          // Sanity check: backend sometimes writes a corrupted tts.duration
          // (e.g. 0.0017s from a bad ffprobe read). Reject values outside
          // [0.5s, 600s] and fall back through srt.duration -> last srt
          // timing end -> sum(scene durations).
          const isSane = (n: unknown): n is number =>
            typeof n === "number" && n >= 0.5 && n <= 600;
          const lastTimingEnd = sceneTimings && sceneTimings.length > 0
            ? sceneTimings[sceneTimings.length - 1].end
            : null;
          const realAudioSeconds =
            (isSane(stepState.tts?.duration) && stepState.tts!.duration) ||
            (isSane(stepState.srt?.duration) && stepState.srt!.duration) ||
            (isSane(lastTimingEnd) && lastTimingEnd) ||
            null;
          const audioFrames = realAudioSeconds
            ? Math.round(realAudioSeconds * fps)
            : sceneTotalFrames;
          audioItems.push({
            id: genId("audio"),
            audioUrl: reelFileUrl(jobId, ttsPath),
            from: 0,
            durationInFrames: audioFrames,
            // Tag the audio with the source duration so the waveform hook
            // can bust its peak cache when TTS regenerates (the URL stays
            // stable but the file bytes change).
            sourceVersion: realAudioSeconds != null
              ? String(realAudioSeconds)
              : undefined,
          });
        }

        // Parse subtitles from SRT file if available (D-04: generation counter + abort).
        // Convention fallback: pipeline always writes subtitles.srt at job root,
        // so even when step_state.srt.path is missing we can still load it.
        const srtPath = stepState.srt?.path ?? "subtitles.srt";
        if (srtPath) {
          srtAbortController?.abort();
          srtGeneration++;
          const thisGen = srtGeneration;
          const controller = new AbortController();
          srtAbortController = controller;

          const token =
            typeof window !== "undefined"
              ? (localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token"))
              : null;
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          fetch(reelFileUrl(jobId, srtPath), { headers, signal: controller.signal, cache: "no-cache" })
            .then((r) => r.text())
            .then((text) => {
              if (thisGen !== srtGeneration) return; // stale
              const subtitles = parseSrt(text, fps);
              if (subtitles.length > 0) set({ subtitles });
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

        // 999.13 D-04: drift smoke-alarm. Subtitles load asynchronously
        // via the SRT fetch above (~few hundred ms), so we wait 1.5s
        // before sampling. If sum(scene durations) and last subtitle end
        // disagree by >0.5s, log a warning so future regressions surface.
        if (typeof window !== "undefined") {
          setTimeout(() => {
            const state = get();
            if (state.scenes.length === 0 || state.subtitles.length === 0) return;
            const totalSceneSec =
              state.scenes.reduce((sum, s) => sum + s.durationInFrames, 0) / fps;
            const lastSubEnd =
              state.subtitles[state.subtitles.length - 1].endFrame / fps;
            const drift = Math.abs(totalSceneSec - lastSubEnd);
            if (drift > 0.5) {
              console.warn(
                `[editor:drift] sum(scene)=${totalSceneSec.toFixed(2)}s vs last_sub_end=${lastSubEnd.toFixed(2)}s (drift=${drift.toFixed(2)}s) — upstream alignment may be inconsistent`,
              );
            }
          }, 1500);
        }
      },

      loadFromEditorState: (editorState) => {
        // Backward compat: assign `from` if missing (old saved states)
        let cursor = 0;
        const scenes = editorState.scenes.map((s) => {
          if (s.from != null) {
            cursor = s.from + s.durationInFrames;
            return s;
          }
          const withFrom = { ...s, from: cursor };
          cursor += s.durationInFrames;
          return withFrom;
        });
        set({
          scenes,
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

          // Remap audio items: split any that span multiple scenes, then
          // relocate each segment to match its owning scene's new position.
          const audioItems: EditorAudioItem[] = [];
          for (const a of state.audioItems) {
            const aEnd = a.from + a.durationInFrames;
            const sourceOff = a.startFrom ?? 0;
            // Collect segments: one per scene the audio overlaps
            const segments: { sceneId: string; from: number; dur: number; startFrom: number }[] = [];
            for (const s of oldScenes) {
              const oldR = oldOffsets[s.id];
              const segStart = Math.max(a.from, oldR.start);
              const segEnd = Math.min(aEnd, oldR.end);
              if (segEnd > segStart) {
                segments.push({
                  sceneId: s.id,
                  from: segStart,
                  dur: segEnd - segStart,
                  startFrom: sourceOff + (segStart - a.from),
                });
              }
            }
            if (segments.length === 0) {
              audioItems.push(a);
            } else if (segments.length === 1) {
              // Common case (post-split): audio fits in one scene
              const seg = segments[0];
              const newR = newOffsets[seg.sceneId];
              const intraOffset = seg.from - oldOffsets[seg.sceneId].start;
              audioItems.push({
                ...a,
                from: newR.start + intraOffset,
                durationInFrames: seg.dur,
                startFrom: seg.startFrom,
              });
            } else {
              // Audio spans multiple scenes — split into per-scene segments
              for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const newR = newOffsets[seg.sceneId];
                const intraOffset = seg.from - oldOffsets[seg.sceneId].start;
                audioItems.push({
                  ...a,
                  id: i === 0 ? a.id : genId("audio"),
                  from: newR.start + intraOffset,
                  durationInFrames: seg.dur,
                  startFrom: seg.startFrom,
                });
              }
            }
          }

          return { scenes: reindexScenes(newScenes), subtitles, audioItems };
        });
      },

      trimScene: (sceneId, newDuration) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const clampedDuration = Math.max(15, newDuration);
          if (clampedDuration === state.scenes[idx].durationInFrames) return state;
          const scenes = state.scenes.map((s) =>
            s.id === sceneId ? { ...s, durationInFrames: clampedDuration } : s,
          );
          return { scenes };
        });
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
            from: original.from + original.durationInFrames,
          };
          const scenes = [...state.scenes];
          scenes.splice(idx + 1, 0, duplicate);

          return { scenes: reindexScenes(scenes) };
        });
      },

      deleteScene: (sceneId) => {
        set((state) => ({
          scenes: reindexScenes(state.scenes.filter((s) => s.id !== sceneId)),
          selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
        }));
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
            from: original.from + frameOffset,
            durationInFrames: original.durationInFrames - frameOffset,
          };
          const scenes = [...state.scenes];
          scenes.splice(idx, 1, firstHalf, secondHalf);

          return { scenes: reindexScenes(scenes) };
        });
      },

      updateSubtitle: (subtitleId, updates) => {
        set((state) => {
          const hasTextChange = "text" in updates;
          return {
            subtitles: state.subtitles.map((s) =>
              s.id === subtitleId ? { ...s, ...updates } : s,
            ),
            ...(hasTextChange ? { subtitlesEdited: true } : {}),
          };
        });
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
            id: genId("sub"),
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

      splitAudioItem: (audioId, frame) => {
        set((state) => {
          const audioItems: EditorAudioItem[] = [];
          for (const a of state.audioItems) {
            if (a.id !== audioId) { audioItems.push(a); continue; }
            const aEnd = a.from + a.durationInFrames;
            if (frame <= a.from || frame >= aEnd) { audioItems.push(a); continue; }
            const sourceOffset = a.startFrom ?? 0;
            audioItems.push({ ...a, durationInFrames: frame - a.from });
            audioItems.push({
              ...a,
              id: genId("audio"),
              from: frame,
              durationInFrames: aEnd - frame,
              startFrom: sourceOffset + (frame - a.from),
            });
          }
          return { audioItems };
        });
      },

      trimAudioItem: (audioId, newDuration) => {
        set((state) => ({
          audioItems: state.audioItems.map((a) =>
            a.id === audioId ? { ...a, durationInFrames: newDuration } : a,
          ),
        }));
      },

      trimAudioLeft: (audioId: string, newFrom: number) => {
        set((state) => ({
          audioItems: state.audioItems.map((a) => {
            if (a.id !== audioId) return a;
            const delta = newFrom - a.from;
            return {
              ...a,
              from: newFrom,
              durationInFrames: Math.max(15, a.durationInFrames - delta),
              startFrom: (a.startFrom ?? 0) + delta,
            };
          }),
        }));
      },

      trimSceneLeft: (sceneId, newFrom) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const scene = state.scenes[idx];
          const sceneEnd = scene.from + scene.durationInFrames;
          const clampedFrom = Math.max(0, Math.min(newFrom, sceneEnd - 15));
          const newDuration = sceneEnd - clampedFrom;
          if (clampedFrom === scene.from) return state;
          const scenes = state.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, from: clampedFrom, durationInFrames: newDuration }
              : s,
          );
          return { scenes };
        });
      },

      freezeFrame: (sceneId, framesToFreeze) => {
        set((state) => {
          const idx = state.scenes.findIndex((s) => s.id === sceneId);
          if (idx === -1) return state;
          const scenes = state.scenes.map((s) =>
            s.id === sceneId
              ? { ...s, durationInFrames: s.durationInFrames + framesToFreeze }
              : s,
          );
          return { scenes };
        });
      },

      setTransition: (sceneId, type, durationFrames) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, transition: { ...s.transition, type, durationFrames } } : s,
          ),
        }));
      },

      setPlaybackRate: (sceneId, rate) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, playbackRate: Math.max(0.25, Math.min(4, rate)) } : s,
          ),
        }));
      },

      resetClipStart: (sceneId) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, trimFrom: 0 } : s,
          ),
        }));
      },

      moveScene: (sceneId, newFrom) => {
        set((state) => ({
          scenes: state.scenes.map((s) =>
            s.id === sceneId ? { ...s, from: Math.max(0, newFrom) } : s,
          ),
        }));
      },

      resetAudio: (jobId, stepState) => {
        const fps = EDITOR_FPS;
        const ttsPath = (stepState.tts as Record<string, unknown> | undefined)?.path as string | undefined ?? "audio.wav";
        if (!ttsPath) return;
        const sceneTimings = ((stepState.srt as Record<string, unknown> | undefined)?.scene_timings ?? []) as Array<{ end?: number }>;
        const isSane = (n: unknown): n is number => typeof n === "number" && n >= 0.5 && n <= 600;
        const lastTimingEnd = sceneTimings.length > 0 ? sceneTimings[sceneTimings.length - 1].end : null;
        const realAudioSeconds =
          (isSane((stepState.tts as Record<string, unknown> | undefined)?.duration) && (stepState.tts as Record<string, unknown>).duration as number) ||
          (isSane((stepState.srt as Record<string, unknown> | undefined)?.duration) && (stepState.srt as Record<string, unknown>).duration as number) ||
          (isSane(lastTimingEnd) && lastTimingEnd) ||
          null;
        const state = get();
        const sceneTotalFrames = state.scenes.reduce((max, s) => Math.max(max, s.from + s.durationInFrames), 0);
        const audioFrames = realAudioSeconds ? Math.round(realAudioSeconds * fps) : sceneTotalFrames;
        set({
          audioItems: [{
            id: genId("audio"),
            audioUrl: reelFileUrl(jobId, ttsPath),
            from: 0,
            durationInFrames: audioFrames,
            sourceVersion: realAudioSeconds != null ? String(realAudioSeconds) : undefined,
          }],
        });
      },

      moveSubtitle: (subtitleId, newStartFrame) => {
        set((state) => ({
          subtitles: state.subtitles.map((s) => {
            if (s.id !== subtitleId) return s;
            const duration = s.endFrame - s.startFrame;
            const start = Math.max(0, newStartFrame);
            return { ...s, startFrame: start, endFrame: start + duration };
          }),
        }));
      },

      moveAudioItem: (audioId, newFrom) => {
        set((state) => ({
          audioItems: state.audioItems.map((a) =>
            a.id === audioId ? { ...a, from: Math.max(0, newFrom) } : a,
          ),
        }));
      },

      // 999.14 D-09 (Bug 6): ripple-cut from frame 0 up to the current
      // playhead. This is the "remove slow intro" workflow the user explicitly
      // requested. It does FOUR things in one undoable operation:
      //
      //   1. Trim audio: every audio item that starts at or before the
      //      playhead has its leading segment skipped via startFrom += cut.
      //      Items entirely before the playhead are deleted. Items entirely
      //      after the playhead get their `from` shifted left by the cut.
      //   2. Trim scenes: walks scenes accumulating frame offsets. Scenes
      //      entirely inside [0, playhead) are deleted. The scene that
      //      contains the playhead has its left edge trimmed (durationInFrames
      //      reduced and trimFrom set so the source clip skips the cut).
      //   3. Trim subtitles: subs entirely before the playhead are deleted.
      //      Subs that span the playhead are clipped (startFrame := 0).
      //      All subs after are shifted left by the cut amount.
      //   4. Reset playhead to 0.
      //
      // This operation is intentionally aggressive — it COMPRESSES the
      // timeline. The user's stated complaint was "audio chumbado" because
      // cutting the audio alone left scenes misaligned. This action keeps
      // them in sync.
      rippleTrimToPlayhead: () => {
        set((state) => {
          const cut = state.playheadFrame;
          if (cut <= 0) return state;

          // 1. Audio: each item is in absolute frames via item.from + duration.
          //    For each item, three cases: entirely before cut, spans cut, or
          //    entirely after cut.
          const audioItems: EditorAudioItem[] = [];
          for (const a of state.audioItems) {
            const aEnd = a.from + a.durationInFrames;
            if (aEnd <= cut) {
              // Entirely inside the cut region — drop it.
              continue;
            }
            if (a.from >= cut) {
              // Entirely after the cut — shift left.
              audioItems.push({ ...a, from: a.from - cut });
              continue;
            }
            // Spans the cut: keep the tail. The retained portion starts at
            // `cut` (timeline frame) and corresponds to source position
            // `(a.startFrom ?? 0) + (cut - a.from)`. After shift, its new
            // `from` becomes 0.
            const shavedFrames = cut - a.from;
            audioItems.push({
              ...a,
              from: 0,
              durationInFrames: a.durationInFrames - shavedFrames,
              startFrom: (a.startFrom ?? 0) + shavedFrames,
            });
          }

          // 2. Scenes: drop scenes entirely before the cut, trim the
          //    spanning scene, shift everything left by `cut` frames.
          const scenes: EditorScene[] = [];
          for (const s of state.scenes) {
            const sEnd = s.from + s.durationInFrames;
            if (sEnd <= cut) continue; // entirely before cut — drop
            if (s.from >= cut) {
              // Entirely after cut — shift left
              scenes.push({ ...s, from: s.from - cut });
              continue;
            }
            // Spans the cut: trim the leading portion
            const shaved = cut - s.from;
            scenes.push({
              ...s,
              from: 0,
              durationInFrames: s.durationInFrames - shaved,
              trimFrom: (s.trimFrom ?? 0) + shaved,
            });
          }

          // 3. Subtitles: drop entirely-before, clip spanning, shift after.
          const subtitles: EditorSubtitle[] = [];
          for (const sub of state.subtitles) {
            if (sub.endFrame <= cut) continue;
            if (sub.startFrame >= cut) {
              subtitles.push({
                ...sub,
                startFrame: sub.startFrame - cut,
                endFrame: sub.endFrame - cut,
              });
              continue;
            }
            // Spans the cut — clip start to 0
            subtitles.push({
              ...sub,
              startFrame: 0,
              endFrame: sub.endFrame - cut,
            });
          }

          return {
            scenes: reindexScenes(scenes),
            audioItems,
            subtitles,
            playheadFrame: 0,
          };
        });
      },

      // 999.14 D-09 (Bug 6): mirror of rippleTrimToPlayhead — drops
      // everything from the playhead to the end. Useful for trimming the
      // CTA off the end of a video.
      rippleTrimAfterPlayhead: () => {
        set((state) => {
          const cut = state.playheadFrame;

          const audioItems: EditorAudioItem[] = [];
          for (const a of state.audioItems) {
            const aEnd = a.from + a.durationInFrames;
            if (a.from >= cut) continue; // entirely after — drop
            if (aEnd <= cut) {
              audioItems.push(a); // entirely before — keep
              continue;
            }
            // spans the cut: keep the head, shorten duration
            audioItems.push({ ...a, durationInFrames: cut - a.from });
          }

          const scenes: EditorScene[] = [];
          for (const s of state.scenes) {
            const sEnd = s.from + s.durationInFrames;
            if (s.from >= cut) continue; // entirely after — drop
            if (sEnd <= cut) {
              scenes.push(s); // entirely before — keep
              continue;
            }
            // spans the cut: trim the trailing portion
            scenes.push({ ...s, durationInFrames: cut - s.from });
          }

          const subtitles: EditorSubtitle[] = [];
          for (const sub of state.subtitles) {
            if (sub.startFrame >= cut) continue;
            if (sub.endFrame <= cut) {
              subtitles.push(sub);
              continue;
            }
            subtitles.push({ ...sub, endFrame: cut });
          }

          return {
            scenes: reindexScenes(scenes),
            audioItems,
            subtitles,
          };
        });
      },

      setSelectedScene: (sceneId) =>
        set({
          selectedSceneId: sceneId,
          selectedSubtitleId: null,
          selectedAudioId: null,
          selection: sceneId ? new Set([selectionKey("scene", sceneId)]) : new Set<string>(),
        }),
      setSelectedSubtitle: (subtitleId) =>
        set({
          selectedSubtitleId: subtitleId,
          selectedSceneId: null,
          selectedAudioId: null,
          selection: subtitleId ? new Set([selectionKey("subtitle", subtitleId)]) : new Set<string>(),
        }),
      setSelectedAudio: (audioId) =>
        set({
          selectedAudioId: audioId,
          selectedSceneId: null,
          selectedSubtitleId: null,
          selection: audioId ? new Set([selectionKey("audio", audioId)]) : new Set<string>(),
        }),

      // 999.12 D-01..D-03: multi-select actions
      toggleSelection: (kind, id) =>
        set((state) => {
          const key = selectionKey(kind, id);
          const next = new Set(state.selection);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          // Sync scalar fields with the FIRST entry of this kind in the set
          const findFirst = (k: SelectableKind): string | null => {
            for (const entry of next) {
              const ref = parseSelectionKey(entry);
              if (ref?.kind === k) return ref.id;
            }
            return null;
          };
          return {
            selection: next,
            selectedSceneId: findFirst("scene"),
            selectedSubtitleId: findFirst("subtitle"),
            selectedAudioId: findFirst("audio"),
          };
        }),
      addToSelection: (kind, id) =>
        set((state) => {
          const next = new Set(state.selection);
          next.add(selectionKey(kind, id));
          return {
            selection: next,
            selectedSceneId: kind === "scene" ? id : state.selectedSceneId,
            selectedSubtitleId: kind === "subtitle" ? id : state.selectedSubtitleId,
            selectedAudioId: kind === "audio" ? id : state.selectedAudioId,
          };
        }),
      replaceSelection: (kind, id) =>
        set({
          selection: new Set([selectionKey(kind, id)]),
          selectedSceneId: kind === "scene" ? id : null,
          selectedSubtitleId: kind === "subtitle" ? id : null,
          selectedAudioId: kind === "audio" ? id : null,
        }),
      clearSelection: () =>
        set({
          selection: new Set<string>(),
          selectedSceneId: null,
          selectedSubtitleId: null,
          selectedAudioId: null,
        }),

      bulkDeleteSelected: () =>
        set((state) => {
          if (state.selection.size === 0) return state;
          const sceneIds: string[] = [];
          const subIds: string[] = [];
          const audioIds: string[] = [];
          for (const key of state.selection) {
            const ref = parseSelectionKey(key);
            if (!ref) continue;
            if (ref.kind === "scene") sceneIds.push(ref.id);
            else if (ref.kind === "subtitle") subIds.push(ref.id);
            else if (ref.kind === "audio") audioIds.push(ref.id);
          }

          // 1. Delete scenes (cascade subtitles/audio inside their ranges).
          // We iterate from highest index to lowest so frame ranges remain valid
          // as we shift later content backward.
          let scenes = state.scenes;
          let subtitles = state.subtitles;
          let audioItems = state.audioItems;
          const sortedSceneIdxs = sceneIds
            .map((id) => scenes.findIndex((s) => s.id === id))
            .filter((i) => i !== -1)
            .sort((a, b) => b - a);
          for (const idx of sortedSceneIdxs) {
            const range = getSceneTimeRange(scenes, idx);
            const dur = range.end - range.start;
            const removedScene = scenes[idx];
            subtitles = subtitles.filter(
              (s) => !(s.startFrame >= range.start && s.endFrame <= range.end),
            );
            subtitles = shiftSubtitles(subtitles, range.start, -dur);
            audioItems = shiftAudio(audioItems, range.start, -dur);
            scenes = scenes.filter((s) => s.id !== removedScene.id);
          }
          scenes = reindexScenes(scenes);

          // 2. Delete subtitles
          subtitles = subtitles.filter((s) => !subIds.includes(s.id));

          // 3. Delete audio items
          audioItems = audioItems.filter((a) => !audioIds.includes(a.id));

          return {
            scenes,
            subtitles,
            audioItems,
            selection: new Set<string>(),
            selectedSceneId: null,
            selectedSubtitleId: null,
            selectedAudioId: null,
          };
        }),

      bulkDuplicateSelected: () =>
        set((state) => {
          if (state.selection.size === 0) return state;
          // For now: only scenes and subtitles. Audio duplicate would
          // collide with original — defer.
          let scenes = state.scenes;
          let subtitles = state.subtitles;
          let audioItems = state.audioItems;
          const newSelection = new Set<string>();

          for (const key of state.selection) {
            const ref = parseSelectionKey(key);
            if (!ref) continue;
            if (ref.kind === "scene") {
              const idx = scenes.findIndex((s) => s.id === ref.id);
              if (idx === -1) continue;
              const original = scenes[idx];
              const range = getSceneTimeRange(scenes, idx);
              const duration = original.durationInFrames;
              const dup: EditorScene = { ...original, id: genId(), index: idx + 1 };
              scenes = [...scenes];
              scenes.splice(idx + 1, 0, dup);
              const cloned = subsInRange(subtitles, range.start, range.end).map((s) => ({
                ...s,
                id: genId("sub"),
                startFrame: s.startFrame + duration,
                endFrame: s.endFrame + duration,
              }));
              const shifted = shiftSubtitles(subtitles, range.end, duration);
              subtitles = [...shifted, ...cloned].sort((a, b) => a.startFrame - b.startFrame);
              audioItems = shiftAudio(audioItems, range.end, duration);
              newSelection.add(selectionKey("scene", dup.id));
            } else if (ref.kind === "subtitle") {
              const orig = subtitles.find((s) => s.id === ref.id);
              if (!orig) continue;
              const dup: EditorSubtitle = {
                ...orig,
                id: genId("sub"),
                startFrame: orig.endFrame + 1,
                endFrame: orig.endFrame + 1 + (orig.endFrame - orig.startFrame),
              };
              subtitles = [...subtitles, dup].sort((a, b) => a.startFrame - b.startFrame);
              newSelection.add(selectionKey("subtitle", dup.id));
            }
          }

          return {
            scenes: reindexScenes(scenes),
            subtitles,
            audioItems,
            selection: newSelection,
          };
        }),

      // 999.12 D-09: per-clip volume on EditorAudioItem
      setAudioVolume: (audioId, volume) =>
        set((state) => ({
          audioItems: state.audioItems.map((a) =>
            a.id === audioId
              ? { ...a, volume: Math.max(0, Math.min(1, volume)) }
              : a,
          ),
        })),

      // 999.12 D-19: per-track mute (toggle membership)
      toggleTrackMute: (track) =>
        set((state) => {
          const next = new Set(state.mutedTracks);
          if (next.has(track)) next.delete(track);
          else next.add(track);
          return { mutedTracks: next };
        }),

      // 999.12 D-19: per-track solo (toggling solo also clears mute on that
      // track, and DAW behavior says solo replaces other solos rather than
      // adding to them — but we're keeping it as toggle-set for simplicity)
      toggleTrackSolo: (track) =>
        set((state) => {
          const nextSolo = new Set(state.soloedTracks);
          const nextMute = new Set(state.mutedTracks);
          if (nextSolo.has(track)) nextSolo.delete(track);
          else {
            nextSolo.add(track);
            nextMute.delete(track);
          }
          return { soloedTracks: nextSolo, mutedTracks: nextMute };
        }),

      setPlayheadFrame: (frame) => set({ playheadFrame: frame }),
      markSubtitlesClean: () => set({ subtitlesEdited: false }),

      loadSubtitlesFromSrt: (jobId, srtPath, fps = EDITOR_FPS) => {
        // D-04: generation counter + abort for race prevention
        srtAbortController?.abort();
        srtGeneration++;
        const thisGen = srtGeneration;
        const controller = new AbortController();
        srtAbortController = controller;

        const token =
          typeof window !== "undefined"
            ? (localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token"))
            : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        fetch(reelFileUrl(jobId, srtPath), { headers, signal: controller.signal, cache: "no-cache" })
          .then((r) => r.text())
          .then((text) => {
            if (thisGen !== srtGeneration) return; // stale
            let subtitles = parseSrt(text, fps);
            if (subtitles.length === 0) return;
            // SRT timestamps are in source-audio coordinates. When the
            // audio has been left-trimmed (startFrom > from), shift
            // subtitles so they align with the audible portion.
            const { audioItems } = get();
            const main = audioItems[0];
            if (main) {
              const trimOffset = (main.startFrom ?? 0) - main.from;
              if (trimOffset > 0) {
                subtitles = subtitles
                  .map((s) => ({
                    ...s,
                    startFrame: s.startFrame - trimOffset,
                    endFrame: s.endFrame - trimOffset,
                  }))
                  .filter((s) => s.endFrame > 0);
                if (subtitles.length > 0 && subtitles[0].startFrame < 0) {
                  subtitles[0] = { ...subtitles[0], startFrame: 0 };
                }
              }
            }
            set({ subtitles });
          })
          .catch(() => {});
      },

      totalDuration: () => {
        const state = get();
        const sceneEnd = state.scenes.reduce((max, s) => Math.max(max, s.from + s.durationInFrames), 0);
        const audioEnd = state.audioItems.reduce((max, a) => Math.max(max, a.from + a.durationInFrames), 0);
        const subEnd = state.subtitles.reduce((max, s) => Math.max(max, s.endFrame), 0);
        return Math.max(sceneEnd, audioEnd, subEnd);
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
