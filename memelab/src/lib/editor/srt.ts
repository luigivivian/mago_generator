import { genId } from "./ids";
import type { EditorSubtitle } from "@/stores/editor-types";
import { DEFAULT_SUBTITLE_STYLE } from "@/stores/editor-types";

export function srtTimeToFrames(time: string, fps: number): number {
  const [h, m, rest] = time.split(":");
  const [s, ms] = rest.split(/[,.]/);
  const totalSeconds =
    parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  return Math.round(totalSeconds * fps);
}

export function parseSrt(text: string, fps: number): EditorSubtitle[] {
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
        id: genId("sub"),
        text,
        startFrame: srtTimeToFrames(start?.trim() ?? "00:00:00,000", fps),
        endFrame: srtTimeToFrames(end?.trim() ?? "00:00:00,000", fps),
        position: { x: 50, y: 85 },
        style: { ...DEFAULT_SUBTITLE_STYLE },
      } as EditorSubtitle;
    })
    .filter((e): e is EditorSubtitle => e !== null);
}
