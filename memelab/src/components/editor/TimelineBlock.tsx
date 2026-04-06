"use client";

import { useCallback, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2 } from "lucide-react";
import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";

interface TimelineBlockProps {
  item: EditorScene | EditorAudioItem | EditorSubtitle;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: () => void;
  onTrim?: (newDurationFrames: number) => void;
  trackType: "video" | "audio" | "subtitle";
}

const TRACK_COLORS = {
  video: "bg-purple-500/20 border-purple-500/40 hover:bg-purple-500/30",
  audio: "bg-blue-500/20 border-blue-500/40 hover:bg-blue-500/30",
  subtitle: "bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/30",
};

const MIN_DURATION_FRAMES = 15; // 0.5s at 30fps

function isScene(item: EditorScene | EditorAudioItem | EditorSubtitle): item is EditorScene {
  return "narration" in item;
}

function isSubtitle(item: EditorScene | EditorAudioItem | EditorSubtitle): item is EditorSubtitle {
  return "startFrame" in item && "text" in item;
}

function isAudio(item: EditorScene | EditorAudioItem | EditorSubtitle): item is EditorAudioItem {
  return "audioUrl" in item;
}

function VideoBlock({
  item,
  pixelsPerFrame,
  selected,
  onSelect,
  onTrim,
}: {
  item: EditorScene;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: () => void;
  onTrim?: (newDurationFrames: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const trimStartRef = useRef<{ startX: number; startDuration: number; side: "left" | "right" } | null>(null);

  const handleTrimPointerDown = useCallback(
    (e: React.PointerEvent, side: "left" | "right") => {
      e.stopPropagation();
      e.preventDefault();
      trimStartRef.current = {
        startX: e.clientX,
        startDuration: item.durationInFrames,
        side,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!trimStartRef.current || !onTrim) return;
        const deltaX = ev.clientX - trimStartRef.current.startX;
        const deltaFrames = Math.round(deltaX / pixelsPerFrame);
        let newDuration: number;
        if (trimStartRef.current.side === "right") {
          newDuration = trimStartRef.current.startDuration + deltaFrames;
        } else {
          newDuration = trimStartRef.current.startDuration - deltaFrames;
        }
        onTrim(Math.max(MIN_DURATION_FRAMES, newDuration));
      };

      const handlePointerUp = () => {
        trimStartRef.current = null;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [item.durationInFrames, pixelsPerFrame, onTrim],
  );

  const width = item.durationInFrames * pixelsPerFrame;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative h-14 border rounded-sm flex items-center shrink-0 ${TRACK_COLORS.video} ${selected ? "ring-2 ring-purple-500" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-purple-400/60 hover:bg-purple-400 z-10 rounded-l-sm"
        onPointerDown={(e) => handleTrimPointerDown(e, "left")}
      />

      {/* Drag handle (center area) */}
      <div
        className="flex-1 flex items-center justify-center gap-1 px-2 overflow-hidden cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        {item.imgUrl ? (
          <img
            src={item.imgUrl}
            alt={`Cena ${item.index + 1}`}
            className="h-8 w-8 rounded object-cover shrink-0"
          />
        ) : (
          <span className="text-xs font-medium text-purple-300 shrink-0">
            {item.index + 1}
          </span>
        )}
        {width > 60 && (
          <span className="text-[10px] text-zinc-400 truncate">
            {(item.durationInFrames / 30).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Right trim handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-purple-400/60 hover:bg-purple-400 z-10 rounded-r-sm"
        onPointerDown={(e) => handleTrimPointerDown(e, "right")}
      />

      {/* Regenerating overlay */}
      {item.status === "regenerating" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-sm">
          <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
        </div>
      )}
    </div>
  );
}

function SubtitleBlock({
  item,
  pixelsPerFrame,
  selected,
  onSelect,
}: {
  item: EditorSubtitle;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const left = item.startFrame * pixelsPerFrame;
  const width = (item.endFrame - item.startFrame) * pixelsPerFrame;

  return (
    <div
      className={`absolute h-10 border rounded-sm flex items-center px-1.5 ${TRACK_COLORS.subtitle} ${selected ? "ring-2 ring-amber-500" : ""} cursor-pointer`}
      style={{ left, width }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="text-[10px] text-amber-200 truncate">{item.text}</span>
    </div>
  );
}

function AudioBlock({
  item,
  pixelsPerFrame,
  selected,
  onSelect,
}: {
  item: EditorAudioItem;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const left = item.from * pixelsPerFrame;
  const width = item.durationInFrames * pixelsPerFrame;

  return (
    <div
      className={`absolute h-14 border rounded-sm flex items-center px-2 ${TRACK_COLORS.audio} ${selected ? "ring-2 ring-blue-500" : ""} cursor-pointer`}
      style={{
        left,
        width,
        background: "linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.3) 50%, rgba(59,130,246,0.15) 100%)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="text-[10px] text-blue-300 truncate">
        {(item.durationInFrames / 30).toFixed(1)}s
      </span>
    </div>
  );
}

export function TimelineBlock(props: TimelineBlockProps) {
  const { item, trackType } = props;

  if (trackType === "video" && isScene(item)) {
    return (
      <VideoBlock
        item={item}
        pixelsPerFrame={props.pixelsPerFrame}
        selected={props.selected}
        onSelect={props.onSelect}
        onTrim={props.onTrim}
      />
    );
  }

  if (trackType === "subtitle" && isSubtitle(item)) {
    return (
      <SubtitleBlock
        item={item}
        pixelsPerFrame={props.pixelsPerFrame}
        selected={props.selected}
        onSelect={props.onSelect}
      />
    );
  }

  if (trackType === "audio" && isAudio(item)) {
    return (
      <AudioBlock
        item={item}
        pixelsPerFrame={props.pixelsPerFrame}
        selected={props.selected}
        onSelect={props.onSelect}
      />
    );
  }

  return null;
}
