import type { EditorScene } from "@/stores/editor-types";

export function reindexScenes(scenes: EditorScene[]): EditorScene[] {
  return scenes.map((s, i) => ({ ...s, index: i }));
}
