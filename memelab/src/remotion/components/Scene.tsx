import { AbsoluteFill, Img, useCurrentFrame, interpolate } from "remotion";
import { Video } from "@remotion/media";
import type { EditorScene } from "../../stores/editor-types";

const KEN_BURNS_PATTERNS: { translateX: number; translateY: number }[] = [
  { translateX: 0, translateY: 0 },
  { translateX: -5, translateY: 0 },
  { translateX: 5, translateY: 0 },
  { translateX: 0, translateY: -5 },
];

export const Scene: React.FC<{ scene: EditorScene }> = ({ scene }) => {
  const frame = useCurrentFrame();

  if (scene.clipUrl) {
    const rate = scene.playbackRate ?? 1;
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Video
          src={scene.clipUrl}
          trimBefore={scene.trimFrom ?? 0}
          style={{ width: "100%", height: "100%" }}
          objectFit="cover"
          playbackRate={rate}
          muted
        />
      </AbsoluteFill>
    );
  }

  if (scene.imgUrl) {
    const dur = Math.max(1, scene.durationInFrames);
    const zoom = interpolate(frame, [0, dur], [1, 1.15]);
    const pattern = KEN_BURNS_PATTERNS[scene.index % KEN_BURNS_PATTERNS.length];
    const tx = interpolate(frame, [0, dur], [0, pattern.translateX]);
    const ty = interpolate(frame, [0, dur], [0, pattern.translateY]);

    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        <Img
          src={scene.imgUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom}) translate(${tx}%, ${ty}%)`,
            transformOrigin: "center center",
          }}
        />
      </AbsoluteFill>
    );
  }

  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
};
