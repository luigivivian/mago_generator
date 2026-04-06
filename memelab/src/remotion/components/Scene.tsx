import { AbsoluteFill, Img } from "remotion";
import { Video } from "@remotion/media";
import type { EditorScene } from "../../stores/editor-types";

export const Scene: React.FC<{ scene: EditorScene }> = ({ scene }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scene.clipUrl ? (
        <Video
          src={scene.clipUrl}
          trimBefore={scene.trimFrom ?? 0}
          style={{ width: "100%", height: "100%" }}
          objectFit="cover"
        />
      ) : scene.imgUrl ? (
        <Img
          src={scene.imgUrl}
          style={{ width: "100%", height: "100%" }}
          objectFit="cover"
        />
      ) : null}
    </AbsoluteFill>
  );
};
