import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useEditorStore } from "@/stores/editor-store";
import type { StepState, SceneStatus } from "@/lib/api";
import type { EditorScene } from "@/stores/editor-types";

function makeSceneStatus(index: number, overrides?: Partial<SceneStatus>): SceneStatus {
  return {
    index,
    status: "success",
    clip_path: `clips/scene_${index}.mp4`,
    img_path: `images/scene_${index}.png`,
    duration: 5,
    prompt: `Scene ${index} narration`,
    ...overrides,
  };
}

function makeStepState(sceneCount: number): StepState {
  const scenes = Array.from({ length: sceneCount }, (_, i) => makeSceneStatus(i));
  return {
    job_id: "test-job-123",
    current_step: 6,
    clips: { status: "done", scenes, approved: true },
    tts: { path: "audio/narration.wav", approved: true },
    srt: { path: "subs/narration.srt", approved: true },
    script: {
      json: { scenes: scenes.map((s) => ({ narration: s.prompt })) },
      approved: true,
    },
  };
}

describe("editor-store", () => {
  beforeEach(() => {
    act(() => {
      useEditorStore.setState({
        scenes: [],
        subtitles: [],
        transitions: [],
        audioItems: [],
        selectedSceneId: null,
        selectedSubtitleId: null,
        playheadFrame: 0,
      });
      useEditorStore.temporal.getState().clear();
    });
  });

  describe("loadFromStepState", () => {
    it("converts StepState with 3 scenes into 3 EditorScene objects with correct clipUrl/imgUrl/durationInFrames", () => {
      const stepState = makeStepState(3);

      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const { scenes } = useEditorStore.getState();
      expect(scenes).toHaveLength(3);

      scenes.forEach((scene: EditorScene, i: number) => {
        expect(scene.clipUrl).toContain(`clips/scene_${i}.mp4`);
        expect(scene.imgUrl).toContain(`images/scene_${i}.png`);
        expect(scene.durationInFrames).toBe(5 * 30); // 5 seconds * 30 fps
        expect(scene.index).toBe(i);
        expect(scene.narration).toBe(`Scene ${i} narration`);
        expect(scene.status).toBe("ready");
      });
    });
  });

  describe("reorderScenes", () => {
    it("reorderScenes(0, 2) moves first scene to third position", () => {
      const stepState = makeStepState(3);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const originalIds = useEditorStore.getState().scenes.map((s) => s.id);

      act(() => {
        useEditorStore.getState().reorderScenes(0, 2);
      });

      const { scenes } = useEditorStore.getState();
      // Scene that was at index 0 is now at index 2
      expect(scenes[0].id).toBe(originalIds[1]);
      expect(scenes[1].id).toBe(originalIds[2]);
      expect(scenes[2].id).toBe(originalIds[0]);
      // Indexes are recalculated
      scenes.forEach((scene, i) => {
        expect(scene.index).toBe(i);
      });
    });
  });

  describe("trimScene", () => {
    it("changes durationInFrames of target scene", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;

      act(() => {
        useEditorStore.getState().trimScene(sceneId, 90);
      });

      const scene = useEditorStore.getState().scenes.find((s) => s.id === sceneId);
      expect(scene!.durationInFrames).toBe(90);
    });
  });

  describe("duplicateScene", () => {
    it("creates a new scene with unique id inserted after original", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;

      act(() => {
        useEditorStore.getState().duplicateScene(sceneId);
      });

      const { scenes } = useEditorStore.getState();
      expect(scenes).toHaveLength(3);
      // Duplicate is inserted at position 1, with unique id
      expect(scenes[1].id).not.toBe(sceneId);
      expect(scenes[1].clipUrl).toBe(scenes[0].clipUrl);
      expect(scenes[1].durationInFrames).toBe(scenes[0].durationInFrames);
      // Indexes recalculated
      scenes.forEach((scene, i) => {
        expect(scene.index).toBe(i);
      });
    });
  });

  describe("deleteScene", () => {
    it("removes scene by id", () => {
      const stepState = makeStepState(3);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[1].id;

      act(() => {
        useEditorStore.getState().deleteScene(sceneId);
      });

      const { scenes } = useEditorStore.getState();
      expect(scenes).toHaveLength(2);
      expect(scenes.find((s) => s.id === sceneId)).toBeUndefined();
      scenes.forEach((scene, i) => {
        expect(scene.index).toBe(i);
      });
    });
  });

  describe("splitScene", () => {
    it("at playhead creates two scenes from one with combined duration equal to original", () => {
      const stepState = makeStepState(1);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;
      const originalDuration = useEditorStore.getState().scenes[0].durationInFrames;
      const splitAt = 60; // Split at frame 60

      act(() => {
        useEditorStore.getState().splitScene(sceneId, splitAt);
      });

      const { scenes } = useEditorStore.getState();
      expect(scenes).toHaveLength(2);
      expect(scenes[0].durationInFrames).toBe(splitAt);
      expect(scenes[1].durationInFrames).toBe(originalDuration - splitAt);
      expect(scenes[0].id).not.toBe(scenes[1].id);
      scenes.forEach((scene, i) => {
        expect(scene.index).toBe(i);
      });
    });
  });

  describe("totalDuration", () => {
    it("calculation = sum(sceneDurations) - sum(transitionDurations)", () => {
      const stepState = makeStepState(3);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      // Set transitions on scenes to test overlap subtraction
      const scenes = useEditorStore.getState().scenes;
      act(() => {
        useEditorStore.getState().setTransition(scenes[0].id, "fade", 10);
        useEditorStore.getState().setTransition(scenes[1].id, "slide", 15);
      });

      const state = useEditorStore.getState();
      const totalSceneDuration = state.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
      const totalTransitionDuration = state.scenes.reduce((sum, s) => sum + s.transition.durationFrames, 0);
      const expected = totalSceneDuration - totalTransitionDuration;

      expect(state.totalDuration()).toBe(expected);
    });
  });

  describe("undo/redo", () => {
    it("undo after reorderScenes restores original order", () => {
      const stepState = makeStepState(3);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const originalIds = useEditorStore.getState().scenes.map((s) => s.id);

      act(() => {
        useEditorStore.getState().reorderScenes(0, 2);
      });

      // Verify order changed
      const reorderedIds = useEditorStore.getState().scenes.map((s) => s.id);
      expect(reorderedIds).not.toEqual(originalIds);

      // Undo
      act(() => {
        useEditorStore.temporal.getState().undo();
      });

      const restoredIds = useEditorStore.getState().scenes.map((s) => s.id);
      expect(restoredIds).toEqual(originalIds);
    });
  });

  describe("updateSubtitle", () => {
    it("changes text and timing of a subtitle", () => {
      // Manually add a subtitle
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-1",
              text: "Original text",
              startFrame: 0,
              endFrame: 30,
              position: { x: 50, y: 80 },
              style: {
                fontSize: 48,
                fontFamily: "Inter",
                color: "#FFFFFF",
                shadowColor: "#000000",
                shadowSize: 4,
              },
            },
          ],
        });
      });

      act(() => {
        useEditorStore.getState().updateSubtitle("sub-1", {
          text: "Updated text",
          startFrame: 10,
          endFrame: 60,
        });
      });

      const sub = useEditorStore.getState().subtitles[0];
      expect(sub.text).toBe("Updated text");
      expect(sub.startFrame).toBe(10);
      expect(sub.endFrame).toBe(60);
    });
  });

  describe("setTransition", () => {
    it("updates transition type and duration for a scene", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;

      act(() => {
        useEditorStore.getState().setTransition(sceneId, "wipe", 20);
      });

      const scene = useEditorStore.getState().scenes.find((s) => s.id === sceneId);
      expect(scene!.transition.type).toBe("wipe");
      expect(scene!.transition.durationFrames).toBe(20);
    });
  });

  describe("trimScene clamp-before-delta", () => {
    it("clamps to 15 frames min and shifts subtitles by clamped delta, not raw delta", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      // Each scene is 150 frames (5s * 30fps). Add a subtitle starting at frame 200 (in scene 1).
      const sceneId = useEditorStore.getState().scenes[0].id;
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-clamp",
              text: "After scene 0",
              startFrame: 200,
              endFrame: 230,
              position: { x: 50, y: 80 },
              style: { fontSize: 48, fontFamily: "Inter", color: "#FFFFFF", shadowColor: "#000000", shadowSize: 4 },
            },
          ],
        });
      });

      // Trim scene 0 to 5 frames -> should clamp to 15
      act(() => {
        useEditorStore.getState().trimScene(sceneId, 5);
      });

      const state = useEditorStore.getState();
      const scene = state.scenes.find((s) => s.id === sceneId);
      expect(scene!.durationInFrames).toBe(15); // clamped

      // Delta should be 15 - 150 = -135, NOT 5 - 150 = -145
      const sub = state.subtitles.find((s) => s.id === "sub-clamp");
      expect(sub!.startFrame).toBe(200 - 135); // 65
      expect(sub!.endFrame).toBe(230 - 135); // 95
    });

    it("allows trimming above current duration without clamping", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-expand",
              text: "After scene 0",
              startFrame: 200,
              endFrame: 230,
              position: { x: 50, y: 80 },
              style: { fontSize: 48, fontFamily: "Inter", color: "#FFFFFF", shadowColor: "#000000", shadowSize: 4 },
            },
          ],
        });
      });

      // Trim scene 0 to 200 frames (expand by 50)
      act(() => {
        useEditorStore.getState().trimScene(sceneId, 200);
      });

      const state = useEditorStore.getState();
      const sub = state.subtitles.find((s) => s.id === "sub-expand");
      expect(sub!.startFrame).toBe(250); // 200 + 50
    });
  });

  describe("freezeFrame cascades subtitles and audio", () => {
    it("shifts subtitles and audio after scene end by framesToFreeze", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      // Scene 0 ends at frame 150. Add subtitle and audio after it.
      const sceneId = useEditorStore.getState().scenes[0].id;
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-freeze",
              text: "After scene 0",
              startFrame: 160,
              endFrame: 190,
              position: { x: 50, y: 80 },
              style: { fontSize: 48, fontFamily: "Inter", color: "#FFFFFF", shadowColor: "#000000", shadowSize: 4 },
            },
          ],
          audioItems: [
            {
              id: "audio-freeze",
              audioUrl: "test.mp3",
              from: 160,
              durationInFrames: 60,
            },
          ],
        });
      });

      act(() => {
        useEditorStore.getState().freezeFrame(sceneId, 30);
      });

      const state = useEditorStore.getState();
      const scene = state.scenes.find((s) => s.id === sceneId);
      expect(scene!.durationInFrames).toBe(180); // 150 + 30

      const sub = state.subtitles.find((s) => s.id === "sub-freeze");
      expect(sub!.startFrame).toBe(190); // 160 + 30
      expect(sub!.endFrame).toBe(220); // 190 + 30

      const audio = state.audioItems.find((a) => a.id === "audio-freeze");
      expect(audio!.from).toBe(190); // 160 + 30
    });

    it("does not shift subtitles before the frozen scene", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[1].id; // scene 1 starts at 150
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-before",
              text: "Before scene 1",
              startFrame: 10,
              endFrame: 40,
              position: { x: 50, y: 80 },
              style: { fontSize: 48, fontFamily: "Inter", color: "#FFFFFF", shadowColor: "#000000", shadowSize: 4 },
            },
          ],
        });
      });

      act(() => {
        useEditorStore.getState().freezeFrame(sceneId, 30);
      });

      const sub = useEditorStore.getState().subtitles.find((s) => s.id === "sub-before");
      expect(sub!.startFrame).toBe(10); // unchanged
      expect(sub!.endFrame).toBe(40); // unchanged
    });
  });

  describe("trimSceneLeft and trimFrom", () => {
    it("trimSceneLeft increases trimFrom and decreases durationInFrames", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;
      // Scene 0: 150 frames, trimFrom defaults to 0

      act(() => {
        useEditorStore.getState().trimSceneLeft(sceneId, 30); // trim 30 frames from left
      });

      const state = useEditorStore.getState();
      const scene = state.scenes.find((s) => s.id === sceneId);
      expect(scene!.trimFrom).toBe(30);
      expect(scene!.durationInFrames).toBe(120); // 150 - 30
    });

    it("cascades subtitle shifts from left-trim", () => {
      const stepState = makeStepState(2);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const sceneId = useEditorStore.getState().scenes[0].id;
      act(() => {
        useEditorStore.setState({
          subtitles: [
            {
              id: "sub-ltrim",
              text: "After scene 0",
              startFrame: 200,
              endFrame: 230,
              position: { x: 50, y: 80 },
              style: { fontSize: 48, fontFamily: "Inter", color: "#FFFFFF", shadowColor: "#000000", shadowSize: 4 },
            },
          ],
        });
      });

      act(() => {
        useEditorStore.getState().trimSceneLeft(sceneId, 30);
      });

      // Duration shrank by 30, so delta = -30, subtitles after scene end shift back
      const sub = useEditorStore.getState().subtitles.find((s) => s.id === "sub-ltrim");
      expect(sub!.startFrame).toBe(170); // 200 - 30
    });

    it("EditorScene trimFrom is undefined by default", () => {
      const stepState = makeStepState(1);
      act(() => {
        useEditorStore.getState().loadFromStepState(stepState, "test-job-123", 30);
      });

      const scene = useEditorStore.getState().scenes[0];
      expect(scene.trimFrom).toBeUndefined();
    });
  });
});
