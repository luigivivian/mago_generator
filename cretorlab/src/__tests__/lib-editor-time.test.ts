import { describe, it, expect } from "vitest";
import { reindexScenes } from "@/lib/editor/time";
import type { EditorScene } from "@/stores/editor-types";

function makeScene(overrides: Partial<EditorScene> = {}): EditorScene {
  return {
    id: "test-id",
    index: 99,
    durationInFrames: 150,
    narration: "test narration",
    voiceConfig: { voice: "Puck", speed: 1.1 },
    transition: { type: "fade", durationFrames: 10 },
    status: "ready",
    ...overrides,
  };
}

describe("reindexScenes", () => {
  it("assigns index 0, 1, 2 in order", () => {
    const scenes = [
      makeScene({ id: "a", index: 5 }),
      makeScene({ id: "b", index: 10 }),
      makeScene({ id: "c", index: 0 }),
    ];
    const result = reindexScenes(scenes);
    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
    expect(result[2].index).toBe(2);
  });

  it("preserves all other scene fields", () => {
    const scene = makeScene({
      id: "keep-me",
      durationInFrames: 200,
      narration: "important",
      clipUrl: "http://example.com/clip.mp4",
    });
    const result = reindexScenes([scene]);
    expect(result[0].id).toBe("keep-me");
    expect(result[0].durationInFrames).toBe(200);
    expect(result[0].narration).toBe("important");
    expect(result[0].clipUrl).toBe("http://example.com/clip.mp4");
    expect(result[0].transition).toEqual({ type: "fade", durationFrames: 10 });
  });
});
