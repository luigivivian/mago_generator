"use client";

import { useCallback, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2 } from "lucide-react";
import type { EditorScene, EditorSubtitle, EditorAudioItem } from "@/stores/editor-types";
import { EDITOR_FPS } from "@/stores/editor-types";
import { useEditorStore } from "@/stores/editor-store";
import { useAudioWaveform } from "@/hooks/use-audio-waveform";
import { snapFrame, type SnapTarget } from "@/lib/editor";

interface TimelineBlockProps {
  item: EditorScene | EditorAudioItem | EditorSubtitle;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onTrim?: (newDurationFrames: number) => void;
  onTrimStart?: (newStartFrame: number) => void;
  onTrimEnd?: (newEndFrame: number) => void;
  onMove?: (value: number) => void;
  trackType: "video" | "audio" | "subtitle";
  // 999.12 D-04: snap targets for drag/trim
  snapTargets?: SnapTarget[];
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
  onTrimStart,
  snapTargets,
  blockStartFrame,
}: {
  item: EditorScene;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onTrim?: (newDurationFrames: number) => void;
  onTrimStart?: (newTrimFrom: number) => void;
  snapTargets?: SnapTarget[];
  blockStartFrame: number; // absolute frame where this scene starts (for snap math)
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const trimStartRef = useRef<{ startX: number; startDuration: number; startTrimFrom: number; side: "left" | "right" } | null>(null);

  const handleTrimPointerDown = useCallback(
    (e: React.PointerEvent, side: "left" | "right") => {
      e.stopPropagation();
      e.preventDefault();
      trimStartRef.current = {
        startX: e.clientX,
        startDuration: item.durationInFrames,
        startTrimFrom: item.trimFrom ?? 0,
        side,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!trimStartRef.current) return;
        const deltaX = ev.clientX - trimStartRef.current.startX;
        const deltaFrames = Math.round(deltaX / pixelsPerFrame);
        if (trimStartRef.current.side === "right" && onTrim) {
          // 999.12 D-04: snap right edge to nearest target. The right edge
          // absolute frame is blockStartFrame + new duration. Excluding own
          // edges from targets to avoid self-snap.
          const newDurationRaw = trimStartRef.current.startDuration + deltaFrames;
          const candidateAbsoluteEnd = blockStartFrame + newDurationRaw;
          const filtered = (snapTargets ?? []).filter(
            (t) => t.frame !== blockStartFrame && t.frame !== blockStartFrame + trimStartRef.current!.startDuration,
          );
          const snap = ev.altKey
            ? { frame: candidateAbsoluteEnd, snapped: false }
            : snapFrame(candidateAbsoluteEnd, filtered, pixelsPerFrame, 6);
          const newDuration = snap.frame - blockStartFrame;
          onTrim(Math.max(MIN_DURATION_FRAMES, newDuration));
        } else if (trimStartRef.current.side === "left" && onTrimStart) {
          const newTrimFrom = Math.max(0, trimStartRef.current.startTrimFrom + deltaFrames);
          onTrimStart(newTrimFrom);
        }
      };

      const handlePointerUp = () => {
        trimStartRef.current = null;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [item.durationInFrames, item.trimFrom, pixelsPerFrame, onTrim, onTrimStart, snapTargets, blockStartFrame],
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
        onSelect(e);
      }}
    >
      {/* Left trim handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-purple-400/60 hover:bg-purple-400 z-10 rounded-l-sm"
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
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-purple-400/60 hover:bg-purple-400 z-10 rounded-r-sm"
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
  onTrimStart,
  onTrimEnd,
  onMove,
  snapTargets,
}: {
  item: EditorSubtitle;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onTrimStart?: (newStartFrame: number) => void;
  onTrimEnd?: (newEndFrame: number) => void;
  onMove?: (deltaFrames: number) => void;
  snapTargets?: SnapTarget[];
}) {
  const left = item.startFrame * pixelsPerFrame;
  const width = (item.endFrame - item.startFrame) * pixelsPerFrame;
  const dragRef = useRef<{ startX: number; startVal: number; type: "left" | "right" | "move" } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "left" | "right" | "move") => {
      e.stopPropagation();
      e.preventDefault();
      const startVal = type === "left" ? item.startFrame : type === "right" ? item.endFrame : item.startFrame;
      dragRef.current = { startX: e.clientX, startVal, type };

      const handleMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = Math.round((ev.clientX - dragRef.current.startX) / pixelsPerFrame);
        // 999.12 D-04, D-05: snap with Alt to disable
        const applySnap = (candidate: number): number => {
          if (ev.altKey) return candidate;
          // Filter own edges out of targets
          const filtered = (snapTargets ?? []).filter(
            (t) => t.frame !== item.startFrame && t.frame !== item.endFrame,
          );
          return snapFrame(candidate, filtered, pixelsPerFrame, 6).frame;
        };
        if (dragRef.current.type === "left" && onTrimStart) {
          const candidate = Math.max(0, Math.min(item.endFrame - MIN_DURATION_FRAMES, dragRef.current.startVal + delta));
          onTrimStart(applySnap(candidate));
        } else if (dragRef.current.type === "right" && onTrimEnd) {
          const candidate = Math.max(item.startFrame + MIN_DURATION_FRAMES, dragRef.current.startVal + delta);
          onTrimEnd(applySnap(candidate));
        } else if (dragRef.current.type === "move" && onMove) {
          const candidate = Math.max(0, dragRef.current.startVal + delta);
          onMove(applySnap(candidate));
        }
      };
      const handleUp = () => {
        dragRef.current = null;
        document.removeEventListener("pointermove", handleMove);
        document.removeEventListener("pointerup", handleUp);
      };
      document.addEventListener("pointermove", handleMove);
      document.addEventListener("pointerup", handleUp);
    },
    [item.startFrame, item.endFrame, pixelsPerFrame, onTrimStart, onTrimEnd, onMove, snapTargets],
  );

  return (
    <div
      className={`absolute h-10 border rounded-sm flex items-center ${TRACK_COLORS.subtitle} ${selected ? "ring-2 ring-amber-500" : ""}`}
      style={{ left, width }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-amber-400/60 hover:bg-amber-400 z-10 rounded-l-sm"
        onPointerDown={(e) => handlePointerDown(e, "left")}
      />
      <div
        className="flex-1 px-1.5 overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => handlePointerDown(e, "move")}
      >
        <span className="text-[10px] text-amber-200 truncate block">{item.text}</span>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-amber-400/60 hover:bg-amber-400 z-10 rounded-r-sm"
        onPointerDown={(e) => handlePointerDown(e, "right")}
      />
    </div>
  );
}

function AudioBlock({
  item,
  pixelsPerFrame,
  selected,
  onSelect,
  onTrim,
  onTrimStart,
  onMove,
  snapTargets,
}: {
  item: EditorAudioItem;
  pixelsPerFrame: number;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onTrim?: (newDuration: number) => void;
  onTrimStart?: (newFrom: number) => void;
  onMove?: (newFrom: number) => void;
  snapTargets?: SnapTarget[];
}) {
  const left = item.from * pixelsPerFrame;
  const width = item.durationInFrames * pixelsPerFrame;
  const dragRef = useRef<{ startX: number; startVal: number; type: "left" | "right" | "move" } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, type: "left" | "right" | "move") => {
      e.stopPropagation();
      e.preventDefault();
      const startVal = type === "left" ? item.from : type === "right" ? item.durationInFrames : item.from;
      dragRef.current = { startX: e.clientX, startVal, type };

      const handlePtrMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = Math.round((ev.clientX - dragRef.current.startX) / pixelsPerFrame);
        // 999.12 D-04, D-05: snap with Alt to disable
        const audioEnd = item.from + item.durationInFrames;
        const filtered = (snapTargets ?? []).filter(
          (t) => t.frame !== item.from && t.frame !== audioEnd,
        );
        const applySnap = (candidate: number): number =>
          ev.altKey ? candidate : snapFrame(candidate, filtered, pixelsPerFrame, 6).frame;

        if (dragRef.current.type === "right" && onTrim) {
          // Right edge means new absolute end frame; snap target is end frame
          const candidateEnd = item.from + Math.max(MIN_DURATION_FRAMES, dragRef.current.startVal + delta);
          const snapped = applySnap(candidateEnd);
          onTrim(Math.max(MIN_DURATION_FRAMES, snapped - item.from));
        } else if (dragRef.current.type === "left" && onTrimStart) {
          const candidate = Math.max(0, dragRef.current.startVal + delta);
          onTrimStart(applySnap(candidate));
        } else if (dragRef.current.type === "move" && onMove) {
          const candidate = Math.max(0, dragRef.current.startVal + delta);
          onMove(applySnap(candidate));
        }
      };
      const handleUp = () => {
        dragRef.current = null;
        document.removeEventListener("pointermove", handlePtrMove);
        document.removeEventListener("pointerup", handleUp);
      };
      document.addEventListener("pointermove", handlePtrMove);
      document.addEventListener("pointerup", handleUp);
    },
    [item.from, item.durationInFrames, pixelsPerFrame, onTrim, onTrimStart, onMove, snapTargets],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Pass item.sourceVersion as the cache-busting key — when TTS regenerates,
  // editor-store.loadFromStepState writes the new step_state.tts.duration into
  // sourceVersion, which busts the waveform's peak cache and forces a re-fetch.
  const waveform = useAudioWaveform(
    item.audioUrl,
    Math.max(50, Math.round(width / 2)),
    item.sourceVersion,
  );
  const subtitles = useEditorStore((s) => s.subtitles);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(56 * dpr); // h-14 = 56px
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, 56);

    // Compute which portion of the waveform to draw based on startFrom/duration
    const totalSourceFrames = Math.round(waveform.duration * EDITOR_FPS);
    const trimStart = item.startFrom ?? 0;
    const startRatio = totalSourceFrames > 0 ? trimStart / totalSourceFrames : 0;
    const durationRatio = totalSourceFrames > 0 ? item.durationInFrames / totalSourceFrames : 1;

    const peakStart = Math.floor(startRatio * waveform.peaks.length);
    const peakCount = Math.max(1, Math.floor(durationRatio * waveform.peaks.length));
    const visiblePeaks = waveform.peaks.slice(peakStart, peakStart + peakCount);

    const barWidth = Math.max(1, width / visiblePeaks.length);
    const centerY = 28;

    ctx.fillStyle = "rgba(96, 165, 250, 0.5)"; // blue-400/50
    for (let i = 0; i < visiblePeaks.length; i++) {
      const h = visiblePeaks[i] * 22; // max half-height
      ctx.fillRect(i * barWidth, centerY - h, Math.max(1, barWidth - 0.5), h * 2);
    }
  }, [waveform, width, item.startFrom, item.durationInFrames]);

  // Compute overlapping subtitles for this audio range
  const audioStart = item.from;
  const audioEnd = item.from + item.durationInFrames;
  const overlappingSubs = subtitles.filter(
    (s) => s.startFrame < audioEnd && s.endFrame > audioStart,
  );

  return (
    <div
      className={`absolute h-14 border rounded-sm overflow-hidden ${TRACK_COLORS.audio} ${selected ? "ring-2 ring-blue-500" : ""}`}
      style={{ left, width }}
      onClick={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Subtitle text overlays */}
      <div className="absolute inset-0 pointer-events-none flex items-end">
        {overlappingSubs.map((sub) => {
          const subLeft = Math.max(0, (sub.startFrame - audioStart) * pixelsPerFrame);
          const subWidth = (Math.min(sub.endFrame, audioEnd) - Math.max(sub.startFrame, audioStart)) * pixelsPerFrame;
          return (
            <span
              key={sub.id}
              className="absolute text-[8px] text-blue-200/70 truncate leading-none pb-0.5 px-0.5"
              style={{ left: subLeft, width: subWidth }}
            >
              {sub.text}
            </span>
          );
        })}
      </div>

      {/* Trim handles */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-blue-400/60 hover:bg-blue-400 z-10 rounded-l-sm"
        onPointerDown={(e) => handlePointerDown(e, "left")}
      />
      <div
        className="absolute inset-0 left-2 right-2 cursor-grab active:cursor-grabbing z-[5]"
        onPointerDown={(e) => handlePointerDown(e, "move")}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-blue-400/60 hover:bg-blue-400 z-10 rounded-r-sm"
        onPointerDown={(e) => handlePointerDown(e, "right")}
      />

      {/* Duration label */}
      <span className="absolute top-0.5 left-3 text-[9px] text-blue-300/80 pointer-events-none z-[6]">
        {(item.durationInFrames / 30).toFixed(1)}s
      </span>

      {/* 999.14 D-09 (Bug 6 fix): trim status indicator. Shown when the
          audio item is trimmed from the source — startFrom > 0 means
          leading source seconds are skipped, and (startFrom + duration <
          totalSourceFrames) means trailing source seconds are skipped.
          The user reported "audio chumbado" (stuck/glued) because
          there was no visual signal that their cut had taken effect.
          This badge fixes that. */}
      {((item.startFrom ?? 0) > 0 ||
        (waveform &&
          (item.startFrom ?? 0) + item.durationInFrames <
            Math.round(waveform.duration * EDITOR_FPS) - 5)) && (
        <span
          className="absolute top-0.5 right-3 text-[9px] font-medium text-amber-300 bg-amber-900/60 px-1 rounded pointer-events-none z-[6]"
          title={
            waveform
              ? `Audio cortado: pulando ${((item.startFrom ?? 0) / EDITOR_FPS).toFixed(1)}s do inicio, ${(
                  Math.max(
                    0,
                    waveform.duration -
                      ((item.startFrom ?? 0) + item.durationInFrames) / EDITOR_FPS,
                  )
                ).toFixed(1)}s do fim. Original: ${waveform.duration.toFixed(1)}s.`
              : "Audio cortado"
          }
        >
          ✂ -{((item.startFrom ?? 0) / EDITOR_FPS).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

interface ExtendedTimelineBlockProps extends TimelineBlockProps {
  blockStartFrame?: number;
}

export function TimelineBlock(props: ExtendedTimelineBlockProps) {
  const { item, trackType } = props;

  if (trackType === "video" && isScene(item)) {
    return (
      <VideoBlock
        item={item}
        pixelsPerFrame={props.pixelsPerFrame}
        selected={props.selected}
        onSelect={props.onSelect}
        onTrim={props.onTrim}
        onTrimStart={props.onTrimStart}
        snapTargets={props.snapTargets}
        blockStartFrame={props.blockStartFrame ?? 0}
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
        onTrimStart={props.onTrimStart}
        onTrimEnd={props.onTrimEnd}
        onMove={props.onMove}
        snapTargets={props.snapTargets}
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
        onTrim={props.onTrim}
        onTrimStart={props.onTrimStart}
        onMove={props.onMove}
        snapTargets={props.snapTargets}
      />
    );
  }

  return null;
}
