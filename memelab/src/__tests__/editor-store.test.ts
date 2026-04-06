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
});
