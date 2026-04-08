"use client";

import { Type } from "lucide-react";
import { TimelineBlock } from "./TimelineBlock";
import { useEditorStore } from "@/stores/editor-store";
import {
  EDITOR_FPS,
  DEFAULT_SUBTITLE_STYLE,
} from "@/stores/editor-types";
import type {
  EditorScene,
  EditorSubtitle,
  EditorAudioItem,
} from "@/stores/editor-types";
import { genId, type SnapTarget } from "@/lib/editor";

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
  // 999.12 D-04: snap targets propagated to blocks
  snapTargets?: SnapTarget[];
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
  snapTargets,
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
          {(() => {
            // Compute cumulative absolute start frame for each scene so video
            // blocks can self-snap excluding their own edges (999.12 D-04).
            let cursor = 0;
            return (items as EditorScene[]).map((item) => {
              const startFrame = cursor;
              cursor += item.durationInFrames;
              return (
                <TimelineBlock
                  key={item.id}
                  item={item}
                  pixelsPerFrame={pixelsPerFrame}
                  selected={isSelected(item.id)}
                  onSelect={(e) => onSelect(item.id, e)}
                  onTrim={onTrim ? (dur) => onTrim(item.id, dur) : undefined}
                  onTrimStart={onTrimStart ? (v) => onTrimStart(item.id, v) : undefined}
                  trackType="video"
                  snapTargets={snapTargets}
                  blockStartFrame={startFrame}
                />
              );
            });
          })()}
        </div>
      ) : (
        <div className="relative h-full" onPointerDown={handleBackgroundPointerDown}>
          {/* Empty subtitle track CTA — only renders when there are zero
              subtitles, so the user has a discoverable entry point to add
              one without hunting for the toolbar button or right-click menu. */}
          {type === "subtitle" && items.length === 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const store = useEditorStore.getState();
                const startFrame = Math.max(0, store.playheadFrame);
                const endFrame = startFrame + 2 * EDITOR_FPS;
                const id = genId("sub");
                store.addSubtitle({
                  id,
                  text: "Nova legenda",
                  startFrame,
                  endFrame,
                  position: { x: 50, y: 85 },
                  style: { ...DEFAULT_SUBTITLE_STYLE },
                });
                store.setSelectedSubtitle(id);
              }}
              className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/5 transition-colors"
              title="Adicionar legenda no playhead (T)"
            >
              <Type className="h-3.5 w-3.5" />
              <span>+ Adicionar legenda</span>
            </button>
          )}
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
              snapTargets={snapTargets}
            />
          ))}
        </div>
      )}
    </div>
  );
}
