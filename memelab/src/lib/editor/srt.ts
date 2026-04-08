import { genId } from "./ids";
import type { EditorSubtitle } from "@/stores/editor-types";
import { DEFAULT_SUBTITLE_STYLE } from "@/stores/editor-types";

export function srtTimeToFrames(time: string, fps: number): number {
  // Accept both "HH:MM:SS,mmm" (canonical SRT) and "HH:MM:SS:mmm"
  // (some Gemini transcriptions use `:` everywhere). Match all 4
  // numeric components regardless of separator.
  const m = time.match(/^(\d+):(\d+):(\d+)[,.:](\d+)$/);
  if (!m) return NaN;
  const [, h, mm, s, ms] = m;
  const totalSeconds =
    parseInt(h) * 3600 + parseInt(mm) * 60 + parseInt(s) + parseInt(ms) / 1000;
  return Math.round(totalSeconds * fps);
}

export function parseSrt(text: string, fps: number): EditorSubtitle[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n(?=\d+\n\d{2}:\d{2})/g, "\n\n");
  return normalized
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.length < 2) return null;
      // Canonical SRT has `<idx>\n<ts> --> <ts>\n<text>`.
      // Gemini sometimes omits the index line entirely and produces just
      // `<ts> --> <ts>\n<text>`. Accept both formats.
      const tsLineRe = /^\d{1,2}:\d{2}:\d{2}[,.:]\d{1,3}\s*-->/;
      let tsLine: string;
      let textStart: number;
      if (tsLineRe.test(lines[0])) {
        tsLine = lines[0];
        textStart = 1;
      } else {
        if (lines.length < 3) return null;
        const idx = parseInt(lines[0]);
        if (isNaN(idx)) return null;
        tsLine = lines[1];
        textStart = 2;
      }
      const [start, end] = tsLine.split(" --> ");
      const text = lines.slice(textStart).join("\n");
      const startFrame = srtTimeToFrames(start?.trim() ?? "00:00:00,000", fps);
      const endFrame = srtTimeToFrames(end?.trim() ?? "00:00:00,000", fps);
      // Drop entries with corrupt timestamps (e.g. SRT with `:` instead of `,`
      // in the milliseconds slot — produces NaN). Otherwise NaN serializes
      // as null in JSON and pollutes the persisted editor state forever.
      if (!Number.isFinite(startFrame) || !Number.isFinite(endFrame)) return null;
      if (endFrame <= startFrame) return null;
      return {
        id: genId("sub"),
        text,
        startFrame,
        endFrame,
        position: { x: 50, y: 85 },
        style: { ...DEFAULT_SUBTITLE_STYLE },
      } as EditorSubtitle;
    })
    .filter((e): e is EditorSubtitle => e !== null);
}
