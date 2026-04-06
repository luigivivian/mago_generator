import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";

export function getSceneTimeRange(scenes: EditorScene[], sceneIndex: number): { start: number; end: number } {
  let start = 0;
  for (let i = 0; i < sceneIndex; i++) start += scenes[i].durationInFrames;
  return { start, end: start + scenes[sceneIndex].durationInFrames };
}

export function shiftSubtitles(subs: EditorSubtitle[], afterFrame: number, delta: number): EditorSubtitle[] {
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

export function shiftAudio(items: EditorAudioItem[], afterFrame: number, delta: number): EditorAudioItem[] {
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

export function subsInRange(subs: EditorSubtitle[], start: number, end: number): EditorSubtitle[] {
  return subs.filter((s) => s.startFrame >= start && s.endFrame <= end);
}

export function subsOverlapping(subs: EditorSubtitle[], start: number, end: number): EditorSubtitle[] {
  return subs.filter((s) => s.startFrame < end && s.endFrame > start);
}
