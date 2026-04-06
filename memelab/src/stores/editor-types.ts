export interface EditorScene {
  id: string;
  index: number;
  clipUrl?: string;
  imgUrl?: string;
  durationInFrames: number;
  narration: string;
  voiceConfig: {
    voice: string;
    speed: number;
  };
  transition: {
    type: "fade" | "slide" | "wipe" | "flip" | "none";
    durationFrames: number;
  };
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
  type: "fade" | "slide" | "wipe" | "flip" | "none";
  durationFrames: number;
  easing: "linear" | "ease-in-out" | "spring";
}

export interface EditorAudioItem {
  id: string;
  audioUrl: string;
  from: number;
  durationInFrames: number;
}

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
