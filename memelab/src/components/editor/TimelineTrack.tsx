"use client";

import { TimelineBlock } from "./TimelineBlock";
import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";

interface TimelineTrackProps {
  type: "video" | "audio" | "subtitle";
  items: EditorScene[] | EditorAudioItem[] | EditorSubtitle[];
  pixelsPerFrame: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTrim?: (id: string, newDurationFrames: number) => void;
}

const TRACK_CONFIG = {
  video: { height: "h-14", bg: "bg-zinc-900", border: "border-b border-zinc-800" },
  audio: { height: "h-14", bg: "bg-zinc-950", border: "border-b border-zinc-800" },
  subtitle: { height: "h-10", bg: "bg-zinc-900", border: "" },
};

export function TimelineTrack({
  type,
  items,
  pixelsPerFrame,
  selectedId,
  onSelect,
  onTrim,
}: TimelineTrackProps) {
  const config = TRACK_CONFIG[type];

  return (
    <div className={`relative ${config.height} ${config.bg} ${config.border}`}>
      {type === "video" ? (
        <div className="flex h-full items-center gap-px">
          {(items as EditorScene[]).map((item) => (
            <TimelineBlock
              key={item.id}
              item={item}
              pixelsPerFrame={pixelsPerFrame}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
              onTrim={
                onTrim
                  ? (dur) => onTrim(item.id, dur)
                  : undefined
              }
              trackType="video"
            />
          ))}
        </div>
      ) : (
        <div className="relative h-full">
          {(items as (EditorAudioItem | EditorSubtitle)[]).map((item) => (
            <TimelineBlock
              key={item.id}
              item={item}
              pixelsPerFrame={pixelsPerFrame}
              selected={item.id === selectedId}
              onSelect={() => onSelect(item.id)}
              trackType={type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
