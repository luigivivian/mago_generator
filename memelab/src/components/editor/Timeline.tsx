"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEditorStore } from "@/stores/editor-store";
import { useTotalDuration } from "@/hooks/use-editor";
import { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineTrack } from "./TimelineTrack";
import type { PlayerRef } from "@remotion/player";

interface TimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
}

export function Timeline({ playerRef }: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pixelsPerFrame, scrollLeft, setScrollLeft, handleWheel } =
    useTimelineZoom();

  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioItems = useEditorStore((s) => s.audioItems);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedSubtitleId = useEditorStore((s) => s.selectedSubtitleId);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);
  const reorderScenes = useEditorStore((s) => s.reorderScenes);
  const setSelectedScene = useEditorStore((s) => s.setSelectedScene);
  const setSelectedSubtitle = useEditorStore((s) => s.setSelectedSubtitle);
  const setPlayheadFrame = useEditorStore((s) => s.setPlayheadFrame);
  const trimScene = useEditorStore((s) => s.trimScene);
  const totalFrames = useTotalDuration();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = scenes.findIndex((s) => s.id === active.id);
      const newIndex = scenes.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderScenes(oldIndex, newIndex);
      }
    },
    [scenes, reorderScenes],
  );

  const handleSeek = useCallback(
    (frame: number) => {
      setPlayheadFrame(frame);
      playerRef.current?.seekTo(frame);
    },
    [setPlayheadFrame, playerRef],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => handleWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [handleWheel]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handler = (e: { detail: { frame: number } }) => {
      setPlayheadFrame(e.detail.frame);
    };
    const playerEl = player as unknown as EventTarget;
    playerEl.addEventListener("timeupdate", handler as EventListener);
    return () =>
      playerEl.removeEventListener("timeupdate", handler as EventListener);
  }, [playerRef, setPlayheadFrame]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [setScrollLeft]);

  const sceneIds = scenes.map((s) => s.id);

  return (
    <div className="flex flex-col border-t border-zinc-700 bg-zinc-950 select-none">
      <TimelineRuler
        pixelsPerFrame={pixelsPerFrame}
        totalFrames={totalFrames}
        playheadFrame={playheadFrame}
        onSeek={handleSeek}
        scrollLeft={scrollLeft}
      />

      <div className="flex flex-1 min-h-0">
        <div className="w-20 shrink-0 border-r border-zinc-700">
          <div className="h-14 flex items-center px-2 text-xs text-zinc-400 border-b border-zinc-800">
            Video
          </div>
          <div className="h-14 flex items-center px-2 text-xs text-zinc-400 border-b border-zinc-800">
            Audio
          </div>
          <div className="h-10 flex items-center px-2 text-xs text-zinc-400">
            Legendas
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="relative"
            style={{ minWidth: totalFrames * pixelsPerFrame + 100 }}
          >
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
              style={{ left: playheadFrame * pixelsPerFrame }}
            />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sceneIds}
                strategy={horizontalListSortingStrategy}
              >
                <TimelineTrack
                  type="video"
                  items={scenes}
                  pixelsPerFrame={pixelsPerFrame}
                  selectedId={selectedSceneId}
                  onSelect={setSelectedScene}
                  onTrim={(id, dur) => trimScene(id, dur)}
                />
              </SortableContext>
            </DndContext>

            <TimelineTrack
              type="audio"
              items={audioItems}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={null}
              onSelect={() => {}}
            />

            <TimelineTrack
              type="subtitle"
              items={subtitles}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={selectedSubtitleId}
              onSelect={setSelectedSubtitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
