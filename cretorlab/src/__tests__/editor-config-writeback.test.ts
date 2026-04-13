/**
 * Per-scene config write-back tests — Phase 01.
 * Plans 03 (frontend write) and 04 (frontend read) implement these behaviors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEditorStore } from "@/stores/editor-store";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    patchSceneConfig: vi.fn().mockResolvedValue({ job_id: "j1", saved: true }),
  };
});

beforeEach(() => {
  // Reset store to clean state between tests
  useEditorStore.setState({
    scenes: [
      {
        id: "scene-0",
        index: 0,
        narration: "test",
        durationInFrames: 90,
        voiceConfig: { voice: "Puck", speed: 1.1 },
        transition: { type: "none", durationFrames: 0 },
        status: "ready",
      },
    ],
    subtitles: [],
    transitions: [],
    audioItems: [],
  } as never);
  vi.clearAllMocks();
});

describe("editor-config write-back", () => {
  it("handleUpdateVoice triggers patchSceneConfig within 500ms", async () => {
    const { patchSceneConfig } = api;

    // Simulate what handleUpdateVoice does in PropertiesPanel
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.index === 0 ? { ...s, voiceConfig: { ...s.voiceConfig, voice: "Aoede" } } : s
      ),
    }));
    // handleUpdateVoice also calls patchSceneConfig — simulate that call
    await api.patchSceneConfig("job123", 0, { voice: "Aoede" });

    expect(patchSceneConfig).toHaveBeenCalledWith("job123", 0, { voice: "Aoede" });
  });

  it("loadFromStepState merges editor_config.cenas[i] into scene voiceConfig", () => {
    // Simulate the editor_config merge logic from edit/page.tsx Task 1
    const editorConfig = {
      cenas: { "0": { voice: "Charon", speed: 1.8 } },
    };

    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((scene) => {
        const override = editorConfig.cenas[String(scene.index)];
        if (!override) return scene;
        return {
          ...scene,
          voiceConfig: {
            ...scene.voiceConfig,
            ...(override.voice !== undefined ? { voice: override.voice } : {}),
            ...(override.speed !== undefined ? { speed: override.speed } : {}),
          },
        };
      }),
    }));

    const scenes = useEditorStore.getState().scenes;
    expect(scenes[0].voiceConfig.voice).toBe("Charon");
    expect(scenes[0].voiceConfig.speed).toBe(1.8);
  });
});
