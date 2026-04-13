// 999.12 D-16, D-17: pre-export validation. Pure function — no DOM,
// no React. Returns a list of issues, errors block export, warnings
// can be overridden.

import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";
import { subsOverlapping } from "./cascade";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
}

export function validateEditorState(
  scenes: EditorScene[],
  subtitles: EditorSubtitle[],
  audioItems: EditorAudioItem[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Hard errors
  if (scenes.length === 0) {
    issues.push({ severity: "error", message: "Nenhuma cena para exportar" });
    return issues;
  }
  for (const s of scenes) {
    if (!s.clipUrl && !s.imgUrl) {
      issues.push({
        severity: "error",
        message: `Cena ${s.index + 1} sem clip nem imagem`,
      });
    }
    if (s.durationInFrames <= 0) {
      issues.push({
        severity: "error",
        message: `Cena ${s.index + 1} tem duracao zero`,
      });
    }
  }

  // Total duration calculation for warnings
  const totalFrames = scenes.reduce((sum, s) => sum + s.durationInFrames, 0);

  // Audio extending beyond timeline = warning (will be cropped silently)
  for (const a of audioItems) {
    if (a.from + a.durationInFrames > totalFrames) {
      issues.push({
        severity: "warning",
        message: "Audio se extende alem do final do video — sera cortado",
      });
      break;
    }
  }

  // Subtitle overlap warning — flag pairs where intersect > 50% of the
  // shorter subtitle's duration
  const seen = new Set<string>();
  for (const sub of subtitles) {
    if (seen.has(sub.id)) continue;
    const overlaps = subsOverlapping(
      subtitles.filter((s) => s.id !== sub.id),
      sub.startFrame,
      sub.endFrame,
    );
    for (const o of overlaps) {
      if (seen.has(o.id)) continue;
      const subDur = sub.endFrame - sub.startFrame;
      const oDur = o.endFrame - o.startFrame;
      const intersectStart = Math.max(sub.startFrame, o.startFrame);
      const intersectEnd = Math.min(sub.endFrame, o.endFrame);
      const intersectDur = Math.max(0, intersectEnd - intersectStart);
      if (Math.min(subDur, oDur) > 0 && intersectDur / Math.min(subDur, oDur) > 0.5) {
        issues.push({
          severity: "warning",
          message: `Legendas sobrepostas: "${sub.text.slice(0, 30)}..." e "${o.text.slice(0, 30)}..."`,
        });
        seen.add(sub.id);
        seen.add(o.id);
      }
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
