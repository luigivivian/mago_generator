import { AbsoluteFill, Sequence } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import type {
  EditorTrack,
  EditorScene,
  EditorAudioItem,
  EditorSubtitle,
} from "../stores/editor-types";
import { useEditorStore } from "../stores/editor-store";
import { useVideoConfig } from "remotion";
import { Scene } from "./components/Scene";
import { SubtitleOverlay } from "./components/SubtitleOverlay";

type TransitionType = EditorScene["transition"]["type"];

function getPresentation(type: TransitionType, w: number, h: number) {
  switch (type) {
    case "fade":
      return fade();
    case "slide":
      return slide();
    case "wipe":
      return wipe();
    case "flip":
      return flip();
    case "clock-wipe":
      return clockWipe({ width: w, height: h });
    case "iris":
      return iris({ width: w, height: h });
    default:
      return fade();
  }
}

export const ReelComposition: React.FC<{ tracks: EditorTrack[] }> = ({
  tracks,
}) => {
  const { width, height } = useVideoConfig();
  const videoTrack = tracks.find((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const subtitleTrack = tracks.find((t) => t.type === "subtitle");

  const scenes = (videoTrack?.items ?? []) as EditorScene[];
  const audioItems = (audioTrack?.items ?? []) as EditorAudioItem[];
  const subtitles = (subtitleTrack?.items ?? []) as EditorSubtitle[];

  // 999.12 D-19: track audibility — solo overrides mute
  const mutedTracks = useEditorStore((s) => s.mutedTracks);
  const soloedTracks = useEditorStore((s) => s.soloedTracks);
  const isAudibleTrack = (kind: "video" | "audio" | "subtitle"): boolean => {
    if (soloedTracks.size > 0) return soloedTracks.has(kind);
    return !mutedTracks.has(kind);
  };
  const audioAudible = isAudibleTrack("audio");
  const subtitlesVisible = isAudibleTrack("subtitle");

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
                  presentation={getPresentation(scene.transition.type, width, height)}
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

      {audioItems.map((item) => {
        // 999.12 D-09 + D-19: per-clip volume × track audibility
        const effectiveVolume = audioAudible ? (item.volume ?? 1) : 0;
        return (
          <Sequence
            key={item.id}
            from={item.from}
            durationInFrames={item.durationInFrames}
          >
            {/* 999.14 D-10 (Bug 7 fix): Remotion <Audio trimBefore> takes
                FRAMES, not seconds — at 30fps composition, trimBefore={60}
                skips 2 seconds of source audio. The previous code divided
                item.startFrom by EDITOR_FPS, converting frames to seconds,
                resulting in 30x LESS audio being skipped than intended.
                Result: the waveform was drawn assuming the audio plays
                from second X (correct) but Remotion actually played from
                second X/30 (wrong) — that's why the user saw the playhead
                drift relative to the waveform under it. Pass startFrom
                directly as a frame count. */}
            <Audio
              src={item.audioUrl}
              trimBefore={item.startFrom ?? 0}
              volume={effectiveVolume}
            />
          </Sequence>
        );
      })}

      {subtitlesVisible && <SubtitleOverlay subtitles={subtitles} />}
    </AbsoluteFill>
  );
};
