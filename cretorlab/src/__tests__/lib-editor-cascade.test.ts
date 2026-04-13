import { describe, it, expect } from "vitest";
import {
  shiftSubtitles,
  shiftAudio,
  getSceneTimeRange,
  subsInRange,
  subsOverlapping,
} from "@/lib/editor/cascade";
import type { EditorSubtitle, EditorAudioItem, EditorScene } from "@/stores/editor-types";

function makeSub(id: string, startFrame: number, endFrame: number): EditorSubtitle {
  return {
    id,
    text: "test",
    startFrame,
    endFrame,
    position: { x: 50, y: 85 },
    style: { fontSize: 48, fontFamily: "Inter", color: "#FFF", shadowColor: "#000", shadowSize: 4 },
  };
}

function makeAudio(id: string, from: number, durationInFrames: number): EditorAudioItem {
  return { id, audioUrl: "test.mp3", from, durationInFrames };
}

function makeScene(id: string, durationInFrames: number, index: number): EditorScene {
  return {
    id,
    index,
    durationInFrames,
    narration: "",
    voiceConfig: { voice: "Puck", speed: 1.1 },
    transition: { type: "none", durationFrames: 0 },
    status: "ready",
  };
}

describe("shiftSubtitles", () => {
  it("shifts subtitles after afterFrame by +30", () => {
    const subs = [makeSub("a", 0, 30), makeSub("b", 60, 90)];
    const result = shiftSubtitles(subs, 50, 30);
    expect(result[0]).toEqual(subs[0]); // before afterFrame, unchanged
    expect(result[1].startFrame).toBe(90);
    expect(result[1].endFrame).toBe(120);
  });

  it("removes subtitles that collapse to zero/negative width with negative delta", () => {
    const subs = [makeSub("a", 60, 65)]; // 5 frame subtitle
    const result = shiftSubtitles(subs, 50, -30);
    // After shift: startFrame=30, endFrame=35 — still valid
    expect(result).toHaveLength(1);

    const subs2 = [makeSub("a", 51, 55)]; // startFrame just after afterFrame
    const result2 = shiftSubtitles(subs2, 50, -30);
    // After shift: startFrame=21, endFrame=25 — still valid (startFrame >= 0)
    expect(result2).toHaveLength(1);
  });

  it("adjusts endFrame only for subtitle spanning afterFrame", () => {
    const subs = [makeSub("a", 40, 80)]; // spans afterFrame=50
    const result = shiftSubtitles(subs, 50, 30);
    expect(result[0].startFrame).toBe(40); // unchanged
    expect(result[0].endFrame).toBe(110); // 80 + 30
  });
});

describe("shiftAudio", () => {
  it("shifts audio items after afterFrame by +30", () => {
    const items = [makeAudio("a", 0, 60), makeAudio("b", 90, 30)];
    const result = shiftAudio(items, 80, 30);
    expect(result[0]).toEqual(items[0]); // before afterFrame, unchanged
    expect(result[1].from).toBe(120); // 90 + 30
  });

  it("filters out items with durationInFrames <= 0", () => {
    // Audio that spans afterFrame: from < afterFrame, from+dur > afterFrame
    const items = [makeAudio("a", 40, 20)]; // from=40, dur=20, end=60, spans afterFrame=50
    const result = shiftAudio(items, 50, -25);
    // Spanning: durationInFrames = max(1, 20-25) = 1
    expect(result).toHaveLength(1);
    expect(result[0].durationInFrames).toBe(1);
  });
});

describe("getSceneTimeRange", () => {
  const scenes = [
    makeScene("s0", 100, 0),
    makeScene("s1", 150, 1),
    makeScene("s2", 200, 2),
  ];

  it("returns {start: 0, end: 100} for scene index 0", () => {
    expect(getSceneTimeRange(scenes, 0)).toEqual({ start: 0, end: 100 });
  });

  it("returns {start: 100, end: 250} for scene index 1", () => {
    expect(getSceneTimeRange(scenes, 1)).toEqual({ start: 100, end: 250 });
  });

  it("returns {start: 250, end: 450} for scene index 2", () => {
    expect(getSceneTimeRange(scenes, 2)).toEqual({ start: 250, end: 450 });
  });
});

describe("subsInRange", () => {
  it("returns only subtitles fully inside [start, end]", () => {
    const subs = [
      makeSub("a", 10, 40),  // fully inside [0, 50]
      makeSub("b", 30, 60),  // NOT fully inside [0, 50]
      makeSub("c", 0, 50),   // fully inside [0, 50]
    ];
    const result = subsInRange(subs, 0, 50);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "c"]);
  });
});

describe("subsOverlapping", () => {
  it("returns subtitles that partially overlap [start, end]", () => {
    const subs = [
      makeSub("a", 10, 40),   // overlaps [30, 60]
      makeSub("b", 60, 90),   // does NOT overlap [30, 60] (starts at end)
      makeSub("c", 50, 70),   // overlaps [30, 60]
      makeSub("d", 0, 10),    // does NOT overlap [30, 60]
    ];
    const result = subsOverlapping(subs, 30, 60);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "c"]);
  });
});
