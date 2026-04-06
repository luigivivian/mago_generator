"use client";

import { AbsoluteFill, Img, Video, useCurrentFrame } from "remotion";
import type { EditorTrack, EditorScene } from "@/stores/editor-types";
import { EDITOR_FPS } from "@/stores/editor-types";

interface ReelCompositionProps {
  tracks: EditorTrack[];
}

export const ReelComposition: React.FC<ReelCompositionProps> = ({ tracks }) => {
  const frame = useCurrentFrame();
  const videoTrack = tracks.find((t) => t.type === "video");
  const scenes = (videoTrack?.items ?? []) as EditorScene[];

  let accumulated = 0;
  let activeScene: EditorScene | null = null;
  for (const scene of scenes) {
    if (frame >= accumulated && frame < accumulated + scene.durationInFrames) {
      activeScene = scene;
      break;
    }
    accumulated += scene.durationInFrames;
  }

  if (!activeScene) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#09090b", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#71717a", fontSize: 24 }}>Sem cenas</p>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      {activeScene.clipUrl ? (
        <Video src={activeScene.clipUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : activeScene.imgUrl ? (
        <Img src={activeScene.imgUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <AbsoluteFill style={{ backgroundColor: "#1c1c22", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#71717a", fontSize: 20 }}>Cena {activeScene.index + 1}</p>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
