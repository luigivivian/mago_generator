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
  const audioTrack = props.tracks.find((t) => t.type === "audio");
  const scenes = (videoTrack?.items ?? []) as EditorScene[];
  const audioItems = (audioTrack?.items ?? []) as { from: number; durationInFrames: number }[];

  const sceneEnd = scenes.reduce((max, s) => Math.max(max, (s.from ?? 0) + s.durationInFrames), 0);
  const audioEnd = audioItems.reduce((max, a) => Math.max(max, a.from + a.durationInFrames), 0);

  return {
    durationInFrames: Math.max(1, sceneEnd, audioEnd),
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
