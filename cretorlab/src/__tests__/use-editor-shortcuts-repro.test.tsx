import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { useEditorStore } from "@/stores/editor-store";

function Harness() {
  const ref = useRef<PlayerRef>(null);
  useEditorShortcuts(ref);
  return <div>harness</div>;
}

describe("use-editor-shortcuts Ctrl+Z repro", () => {
  beforeEach(() => {
    act(() => {
      useEditorStore.setState({
        scenes: [],
        subtitles: [],
        transitions: [],
        audioItems: [],
        selectedSceneId: null,
        selectedSubtitleId: null,
        selectedAudioId: null,
        playheadFrame: 0,
      });
      useEditorStore.temporal.getState().clear();
    });
  });

  it("Ctrl+Z fires undo when focused on body", () => {
    render(<Harness />);

    // Load scenes
    act(() => {
      useEditorStore.getState().loadFromStepState({
        job_id: "test", current_step: 6,
        clips: { status: "done", scenes: [
          { index: 0, status: "success", clip_path: "c0.mp4", img_path: "i0.jpg", duration: 5, prompt: "s0" },
          { index: 1, status: "success", clip_path: "c1.mp4", img_path: "i1.jpg", duration: 5, prompt: "s1" },
        ], approved: true },
        tts: { path: "a.wav", approved: true },
        srt: { path: "s.srt", approved: true },
        script: { json: { scenes: [] }, approved: true },
      } as never, "test", 30);
    });

    const originalFirstId = useEditorStore.getState().scenes[0].id;

    // Do a reorder
    act(() => {
      useEditorStore.getState().reorderScenes(0, 1);
    });

    expect(useEditorStore.getState().scenes[0].id).not.toBe(originalFirstId);
    expect(useEditorStore.temporal.getState().pastStates.length).toBeGreaterThan(0);

    // Dispatch Ctrl+Z on window
    act(() => {
      const event = new KeyboardEvent("keydown", {
        code: "KeyZ",
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    });

    expect(useEditorStore.getState().scenes[0].id).toBe(originalFirstId);
  });

  it("Cmd+Z fires undo (Mac)", () => {
    render(<Harness />);
    act(() => {
      useEditorStore.getState().loadFromStepState({
        job_id: "test", current_step: 6,
        clips: { status: "done", scenes: [
          { index: 0, status: "success", clip_path: "c0.mp4", img_path: "i0.jpg", duration: 5, prompt: "s0" },
          { index: 1, status: "success", clip_path: "c1.mp4", img_path: "i1.jpg", duration: 5, prompt: "s1" },
        ], approved: true },
        tts: { path: "a.wav", approved: true },
        srt: { path: "s.srt", approved: true },
        script: { json: { scenes: [] }, approved: true },
      } as never, "test", 30);
    });

    const originalFirstId = useEditorStore.getState().scenes[0].id;

    act(() => {
      useEditorStore.getState().reorderScenes(0, 1);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        code: "KeyZ",
        key: "z",
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });

    expect(useEditorStore.getState().scenes[0].id).toBe(originalFirstId);
  });

  it("Ctrl+Shift+Z fires redo after an undo", () => {
    render(<Harness />);
    act(() => {
      useEditorStore.getState().loadFromStepState({
        job_id: "test", current_step: 6,
        clips: { status: "done", scenes: [
          { index: 0, status: "success", clip_path: "c0.mp4", img_path: "i0.jpg", duration: 5, prompt: "s0" },
          { index: 1, status: "success", clip_path: "c1.mp4", img_path: "i1.jpg", duration: 5, prompt: "s1" },
        ], approved: true },
        tts: { path: "a.wav", approved: true },
        srt: { path: "s.srt", approved: true },
        script: { json: { scenes: [] }, approved: true },
      } as never, "test", 30);
    });

    const originalFirstId = useEditorStore.getState().scenes[0].id;

    act(() => {
      useEditorStore.getState().reorderScenes(0, 1);
    });
    const reorderedFirstId = useEditorStore.getState().scenes[0].id;

    // Ctrl+Z — undo
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        code: "KeyZ",
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(useEditorStore.getState().scenes[0].id).toBe(originalFirstId);

    // Ctrl+Shift+Z — redo
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        code: "KeyZ",
        key: "z",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(useEditorStore.getState().scenes[0].id).toBe(reorderedFirstId);
  });

  it("Ctrl+Y fires redo (Windows alias)", () => {
    render(<Harness />);
    act(() => {
      useEditorStore.getState().loadFromStepState({
        job_id: "test", current_step: 6,
        clips: { status: "done", scenes: [
          { index: 0, status: "success", clip_path: "c0.mp4", img_path: "i0.jpg", duration: 5, prompt: "s0" },
          { index: 1, status: "success", clip_path: "c1.mp4", img_path: "i1.jpg", duration: 5, prompt: "s1" },
        ], approved: true },
        tts: { path: "a.wav", approved: true },
        srt: { path: "s.srt", approved: true },
        script: { json: { scenes: [] }, approved: true },
      } as never, "test", 30);
    });

    const originalFirstId = useEditorStore.getState().scenes[0].id;

    act(() => {
      useEditorStore.getState().reorderScenes(0, 1);
    });
    const reorderedFirstId = useEditorStore.getState().scenes[0].id;

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        code: "KeyZ",
        key: "z",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(useEditorStore.getState().scenes[0].id).toBe(originalFirstId);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        code: "KeyY",
        key: "y",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }));
    });
    expect(useEditorStore.getState().scenes[0].id).toBe(reorderedFirstId);
  });
});
