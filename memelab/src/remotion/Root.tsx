import { Composition, CalculateMetadataFunction } from "remotion";
import { ReelComposition } from "./ReelComposition";
import type { EditorTrack, EditorScene } from "../stores/editor-types";
import { EDITOR_FPS } from "../stores/editor-types";

type ReelProps = {
  tracks: EditorTrack[];
};

const calculateMetadata: CalculateMetadataFunction<ReelProps> = ({
  props,
}) => {
  const videoTrack = props.tracks.find((t) => t.type === "video");
  const scenes = (videoTrack?.items ?? []) as EditorScene[];

  const sceneDuration = scenes.reduce(
    (sum, s) => sum + s.durationInFrames,
    0,
  );
  const transitionOverlap = scenes.reduce(
    (sum, s) => sum + s.transition.durationFrames,
    0,
  );

  return {
    durationInFrames: Math.max(1, sceneDuration - transitionOverlap),
  };
};

export const Root = () => {
  return (
    <Composition
      id="ReelEditor"
      component={ReelComposition}
      fps={EDITOR_FPS}
      width={1080}
      height={1920}
      durationInFrames={1}
      defaultProps={{ tracks: [] }}
      calculateMetadata={calculateMetadata}
    />
  );
};
