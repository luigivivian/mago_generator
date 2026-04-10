export interface EditorScene {
  id: string;
  index: number;
  clipUrl?: string;
  imgUrl?: string;
  durationInFrames: number;
  trimFrom?: number; // frame offset within source clip for left-trim
  narration: string;
  voiceConfig: {
    voice: string;
    speed: number;
  };
  transition: {
    type: "fade" | "slide" | "wipe" | "flip" | "iris" | "clock-wipe" | "none";
    durationFrames: number;
  };
  reversed?: boolean;
  playbackRate?: number; // 0.25–4, default 1
  status: "ready" | "regenerating";
}

export interface EditorSubtitle {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    shadowColor: string;
    shadowSize: number;
  };
}

export interface EditorTransition {
  afterSceneId: string;
  type: "fade" | "slide" | "wipe" | "flip" | "iris" | "clock-wipe" | "none";
  durationFrames: number;
  easing: "linear" | "ease-in-out" | "spring";
}

export interface EditorAudioItem {
  id: string;
  audioUrl: string;
  from: number;
  durationInFrames: number;
  startFrom?: number; // frame offset within the source audio file
  volume?: number; // 0..1, undefined = full volume (999.12 D-09)
  // Version tag for the underlying audio file. Set from step_state.tts.duration
  // (or .srt.duration as fallback) at load time. Used by useAudioWaveform to
  // bust its peak cache when the file content changes (e.g. after a TTS
  // regen) — the URL is stable so we can't rely on it alone.
  sourceVersion?: string;
}

// 999.12 D-19: per-track mute/solo
export type TrackKind = "video" | "audio" | "subtitle";

export interface EditorTrack {
  type: "video" | "audio" | "subtitle";
  items: EditorScene[] | EditorAudioItem[] | EditorSubtitle[];
}

export interface EditorPersistState {
  scenes: EditorScene[];
  subtitles: EditorSubtitle[];
  transitions: EditorTransition[];
  audioItems: EditorAudioItem[];
}

export const DEFAULT_SUBTITLE_STYLE: EditorSubtitle["style"] = {
  fontSize: 48,
  fontFamily: "Inter",
  color: "#FFFFFF",
  shadowColor: "#000000",
  shadowSize: 4,
};

export const DEFAULT_VOICE_CONFIG: EditorScene["voiceConfig"] = {
  voice: "Puck",
  speed: 1.1,
};

export const EDITOR_FPS = 30;

// Multi-select model (999.12 D-01..D-03)
export type SelectableKind = "scene" | "subtitle" | "audio";
export interface SelectableRef {
  kind: SelectableKind;
  id: string;
}
export const selectionKey = (kind: SelectableKind, id: string): string => `${kind}:${id}`;
export const parseSelectionKey = (key: string): SelectableRef | null => {
  const idx = key.indexOf(":");
  if (idx === -1) return null;
  const kind = key.slice(0, idx) as SelectableKind;
  if (kind !== "scene" && kind !== "subtitle" && kind !== "audio") return null;
  return { kind, id: key.slice(idx + 1) };
};
