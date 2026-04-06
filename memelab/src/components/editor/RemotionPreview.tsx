"use client";

import { useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { PlayerRef } from "@remotion/player";
import { useEditorStore } from "@/stores/editor-store";
import { useTotalDuration } from "@/hooks/use-editor";
import { EDITOR_FPS } from "@/stores/editor-types";
import type { EditorTrack } from "@/stores/editor-types";

const Player = dynamic(
  () => import("@remotion/player").then((mod) => mod.Player),
  { ssr: false },
);

const ReelComposition = dynamic(
  () => import("@/remotion/ReelComposition").then((m) => m.ReelComposition),
  { ssr: false },
);

interface RemotionPreviewProps {
  playerRef: React.RefObject<PlayerRef | null>;
}

export function RemotionPreview({ playerRef }: RemotionPreviewProps) {
  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioItems = useEditorStore((s) => s.audioItems);
  const setPlayheadFrame = useEditorStore((s) => s.setPlayheadFrame);
  const totalDuration = useTotalDuration();

  const handleFrameUpdate = useCallback(
    (e: { detail: { frame: number } }) => {
      setPlayheadFrame(e.detail.frame);
    },
    [setPlayheadFrame],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.addEventListener("frameupdate", handleFrameUpdate as never);
    return () => {
      player.removeEventListener("frameupdate", handleFrameUpdate as never);
    };
  }, [playerRef, handleFrameUpdate]);

  const tracks: EditorTrack[] = useMemo(
    () => [
      { type: "video" as const, items: scenes },
      { type: "audio" as const, items: audioItems },
      { type: "subtitle" as const, items: subtitles },
    ],
    [scenes, audioItems, subtitles],
  );

  const inputProps = useMemo(() => ({ tracks }), [tracks]);

  if (scenes.length === 0) {
    return (
      <div
        className="relative w-full max-w-[360px] mx-auto flex items-center justify-center bg-card rounded-lg border border-border"
        style={{ aspectRatio: "9/16" }}
      >
        <p className="text-muted-foreground text-sm">Nenhuma cena carregada</p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto" style={{ width: 270, height: 480 }}>
      <Player
        ref={playerRef}
        component={ReelComposition}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={EDITOR_FPS}
        durationInFrames={Math.max(totalDuration, 1)}
        inputProps={inputProps}
        acknowledgeRemotionLicense
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
