"use client";

import { TimelineBlock } from "./TimelineBlock";
import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";

interface TimelineTrackProps {
  type: "video" | "audio" | "subtitle";
  items: EditorScene[] | EditorAudioItem[] | EditorSubtitle[];
  pixelsPerFrame: number;
  // 999.12 D-01: support both single selectedId (legacy) and selection set membership.
  // selectedIds is the source of truth when provided.
  selectedId: string | null;
  selectedIds?: Set<string>;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onEmptyClick?: () => void;
  onTrim?: (id: string, newDurationFrames: number) => void;
  onTrimStart?: (id: string, newStartFrame: number) => void;
  onTrimEnd?: (id: string, newEndFrame: number) => void;
  onMove?: (id: string, value: number) => void;
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
  selectedIds,
  onSelect,
  onEmptyClick,
  onTrim,
  onTrimStart,
  onTrimEnd,
  onMove,
}: TimelineTrackProps) {
  const config = TRACK_CONFIG[type];

  // 999.12 D-03: clicking the track background (not a child block) clears selection.
  // We use pointerdown so it fires before any block-level pointerup steals focus.
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (e.target === e.currentTarget && onEmptyClick) onEmptyClick();
  };

  const isSelected = (id: string): boolean =>
    selectedIds ? selectedIds.has(id) : id === selectedId;

  return (
    <div
      className={`relative ${config.height} ${config.bg} ${config.border}`}
      onPointerDown={handleBackgroundPointerDown}
    >
      {type === "video" ? (
        <div
          className="flex h-full items-center gap-px"
          onPointerDown={handleBackgroundPointerDown}
        >
          {(items as EditorScene[]).map((item) => (
            <TimelineBlock
              key={item.id}
              item={item}
              pixelsPerFrame={pixelsPerFrame}
              selected={isSelected(item.id)}
              onSelect={(e) => onSelect(item.id, e)}
              onTrim={
                onTrim
                  ? (dur) => onTrim(item.id, dur)
                  : undefined
              }
              onTrimStart={onTrimStart ? (v) => onTrimStart(item.id, v) : undefined}
              trackType="video"
            />
          ))}
        </div>
      ) : (
        <div className="relative h-full" onPointerDown={handleBackgroundPointerDown}>
          {(items as (EditorAudioItem | EditorSubtitle)[]).map((item) => (
            <TimelineBlock
              key={item.id}
              item={item}
              pixelsPerFrame={pixelsPerFrame}
              selected={isSelected(item.id)}
              onSelect={(e) => onSelect(item.id, e)}
              onTrim={onTrim ? (dur) => onTrim(item.id, dur) : undefined}
              onTrimStart={onTrimStart ? (v) => onTrimStart(item.id, v) : undefined}
              onTrimEnd={onTrimEnd ? (v) => onTrimEnd(item.id, v) : undefined}
              onMove={onMove ? (v) => onMove(item.id, v) : undefined}
              trackType={type}
            />
          ))}
        </div>
      )}
    </div>
  );
}
