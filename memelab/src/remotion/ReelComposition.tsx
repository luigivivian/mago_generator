import { AbsoluteFill, Sequence } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import type {
  EditorTrack,
  EditorScene,
  EditorAudioItem,
  EditorSubtitle,
} from "../stores/editor-types";
import { Scene } from "./components/Scene";
import { SubtitleOverlay } from "./components/SubtitleOverlay";

type TransitionType = EditorScene["transition"]["type"];

function getPresentation(type: TransitionType) {
  switch (type) {
    case "fade":
      return fade();
    case "slide":
      return slide();
    case "wipe":
      return wipe();
    case "flip":
      return flip();
    default:
      return fade();
  }
}

export const ReelComposition: React.FC<{ tracks: EditorTrack[] }> = ({
  tracks,
}) => {
  const videoTrack = tracks.find((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const subtitleTrack = tracks.find((t) => t.type === "subtitle");

  const scenes = (videoTrack?.items ?? []) as EditorScene[];
  const audioItems = (audioTrack?.items ?? []) as EditorAudioItem[];
  const subtitles = (subtitleTrack?.items ?? []) as EditorSubtitle[];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {scenes.length > 0 && (
        <TransitionSeries>
          {scenes.map((scene, i) => {
            const elements: React.ReactNode[] = [];

            elements.push(
              <TransitionSeries.Sequence
                key={`scene-${scene.id}`}
                durationInFrames={scene.durationInFrames}
              >
                <Scene scene={scene} />
              </TransitionSeries.Sequence>,
            );

            if (
              i < scenes.length - 1 &&
              scene.transition.type !== "none" &&
              scene.transition.durationFrames > 0
            ) {
              elements.push(
                <TransitionSeries.Transition
                  key={`transition-${scene.id}`}
                  presentation={getPresentation(scene.transition.type)}
                  timing={linearTiming({
                    durationInFrames: scene.transition.durationFrames,
                  })}
                />,
              );
            }

            return elements;
          })}
        </TransitionSeries>
      )}

      {audioItems.map((item) => (
        <Sequence
          key={item.id}
          from={item.from}
          durationInFrames={item.durationInFrames}
        >
          <Audio src={item.audioUrl} startFrom={item.startFrom ?? 0} />
        </Sequence>
      ))}

      <SubtitleOverlay subtitles={subtitles} />
    </AbsoluteFill>
  );
};
