"use client";

import { useCallback, useRef } from "react";
import { EDITOR_FPS } from "@/stores/editor-types";

interface TimelineRulerProps {
  pixelsPerFrame: number;
  totalFrames: number;
  playheadFrame: number;
  onSeek: (frame: number) => void;
  scrollLeft: number;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function TimelineRuler({
  pixelsPerFrame,
  totalFrames,
  playheadFrame,
  onSeek,
  scrollLeft,
}: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const xToFrame = useCallback(
    (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = clientX - rect.left + scrollLeft;
      return Math.max(0, Math.min(Math.round(x / pixelsPerFrame), totalFrames));
    },
    [pixelsPerFrame, scrollLeft, totalFrames],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onSeek(xToFrame(e.clientX));
    },
    [xToFrame, onSeek],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      onSeek(xToFrame(e.clientX));
    },
    [xToFrame, onSeek],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const totalWidth = totalFrames * pixelsPerFrame;
  const framesPerSecond = EDITOR_FPS;

  // Determine tick interval based on zoom level
  let tickIntervalSeconds = 1;
  const pixelsPerSecond = pixelsPerFrame * framesPerSecond;
  if (pixelsPerSecond < 15) tickIntervalSeconds = 10;
  else if (pixelsPerSecond < 30) tickIntervalSeconds = 5;
  else if (pixelsPerSecond < 60) tickIntervalSeconds = 2;

  const ticks: { x: number; label: string }[] = [];
  const totalSeconds = Math.ceil(totalFrames / framesPerSecond);
  for (let s = 0; s <= totalSeconds; s += tickIntervalSeconds) {
    ticks.push({
      x: s * framesPerSecond * pixelsPerFrame,
      label: formatTime(s),
    });
  }

  const playheadX = playheadFrame * pixelsPerFrame - scrollLeft;

  return (
    <div
      ref={rulerRef}
      className="relative h-6 bg-zinc-900 border-b border-zinc-700 select-none cursor-pointer overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="relative h-full"
        style={{ width: totalWidth, transform: `translateX(-${scrollLeft}px)` }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.x}
            className="absolute top-0 h-full flex flex-col items-center"
            style={{ left: tick.x }}
          >
            <div className="w-px h-2 bg-zinc-500" />
            <span className="text-[9px] text-zinc-400 leading-none mt-0.5">
              {tick.label}
            </span>
          </div>
        ))}
      </div>

      {playheadX >= 0 && (
        <div
          className="absolute top-0 pointer-events-none z-10"
          style={{ left: playheadX }}
        >
          <div className="absolute -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #ef4444" }}
          />
          <div className="absolute top-0 w-0.5 h-6 bg-red-500 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
