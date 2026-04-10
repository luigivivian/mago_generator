import { AbsoluteFill, Sequence } from "remotion";
import { Audio } from "@remotion/media";
import type {
  EditorTrack,
  EditorScene,
  EditorAudioItem,
  EditorSubtitle,
} from "../stores/editor-types";
import { useEditorStore } from "../stores/editor-store";
import { Scene } from "./components/Scene";
import { TransitionWrapper } from "./components/TransitionWrapper";
import { SubtitleOverlay } from "./components/SubtitleOverlay";

export const ReelComposition: React.FC<{ tracks: EditorTrack[] }> = ({
  tracks,
}) => {
  const videoTrack = tracks.find((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const subtitleTrack = tracks.find((t) => t.type === "subtitle");

  const scenes = (videoTrack?.items ?? []) as EditorScene[];
  const audioItems = (audioTrack?.items ?? []) as EditorAudioItem[];
  const subtitles = (subtitleTrack?.items ?? []) as EditorSubtitle[];

  const mutedTracks = useEditorStore((s) => s.mutedTracks);
  const soloedTracks = useEditorStore((s) => s.soloedTracks);
  const isAudibleTrack = (kind: "video" | "audio" | "subtitle"): boolean => {
    if (soloedTracks.size > 0) return soloedTracks.has(kind);
    return !mutedTracks.has(kind);
  };
  const audioAudible = isAudibleTrack("audio");
  const subtitlesVisible = isAudibleTrack("subtitle");

  // Sort scenes by position for transition pairing
  const sorted = [...scenes].sort((a, b) => a.from - b.from);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {sorted.map((scene, i) => {
        // This scene's transition config = exit effect
        const exitType = scene.transition.type;
        const exitDuration = exitType !== "none" ? scene.transition.durationFrames : 0;

        // Previous scene's transition = this scene's enter effect
        const prev = i > 0 ? sorted[i - 1] : null;
        const enterType = prev?.transition.type ?? "none";
        const enterDuration = enterType !== "none" ? (prev?.transition.durationFrames ?? 0) : 0;

        const hasTransition = enterType !== "none" || exitType !== "none";

        return (
          <Sequence
            key={`scene-${scene.id}`}
            from={scene.from}
            durationInFrames={scene.durationInFrames}
          >
            {hasTransition ? (
              <TransitionWrapper
                enterType={enterType}
                enterDuration={enterDuration}
                exitType={exitType}
                exitDuration={exitDuration}
                totalDuration={scene.durationInFrames}
              >
                <Scene scene={scene} />
              </TransitionWrapper>
            ) : (
              <Scene scene={scene} />
            )}
          </Sequence>
        );
      })}

      {audioItems.map((item) => {
        const effectiveVolume = audioAudible ? (item.volume ?? 1) : 0;
        return (
          <Sequence
            key={item.id}
            from={item.from}
            durationInFrames={item.durationInFrames}
          >
            <Audio
              src={item.audioUrl}
              trimBefore={item.startFrom ?? 0}
              volume={effectiveVolume}
              pauseWhenBuffering
            />
          </Sequence>
        );
      })}

      {subtitlesVisible && <SubtitleOverlay subtitles={subtitles} />}
    </AbsoluteFill>
  );
};
