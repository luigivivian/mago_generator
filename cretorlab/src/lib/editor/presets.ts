// 999.12 D-21, D-22: subtitle style presets stored in localStorage.
// Pure helpers + a couple of side-effecting load/save wrappers.

import type { EditorSubtitle } from "@/stores/editor-types";

export interface SubtitlePreset {
  id: string;
  name: string;
  style: EditorSubtitle["style"];
}

const STORAGE_KEY = "cretorlab.editor.subtitlePresets";

export function loadPresets(): SubtitlePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is SubtitlePreset =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { id: unknown }).id === "string" &&
        typeof (p as { name: unknown }).name === "string" &&
        typeof (p as { style: unknown }).style === "object",
    );
  } catch {
    return [];
  }
}

export function savePresets(presets: SubtitlePreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore quota / private mode
  }
}

export function addPreset(
  presets: SubtitlePreset[],
  style: EditorSubtitle["style"],
  name?: string,
): SubtitlePreset[] {
  const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const finalName = name ?? `Preset ${presets.length + 1}`;
  return [...presets, { id, name: finalName, style: { ...style } }];
}

export function renamePreset(
  presets: SubtitlePreset[],
  id: string,
  name: string,
): SubtitlePreset[] {
  return presets.map((p) => (p.id === id ? { ...p, name } : p));
}

export function deletePreset(
  presets: SubtitlePreset[],
  id: string,
): SubtitlePreset[] {
  return presets.filter((p) => p.id !== id);
}
