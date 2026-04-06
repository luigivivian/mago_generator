"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
import { ContextMenu, type ContextTarget } from "./ContextMenu";
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
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);
  const reorderScenes = useEditorStore((s) => s.reorderScenes);
  const setSelectedScene = useEditorStore((s) => s.setSelectedScene);
  const setSelectedSubtitle = useEditorStore((s) => s.setSelectedSubtitle);
  const setSelectedAudio = useEditorStore((s) => s.setSelectedAudio);
  const setPlayheadFrame = useEditorStore((s) => s.setPlayheadFrame);
  const trimScene = useEditorStore((s) => s.trimScene);
  const updateSubtitle = useEditorStore((s) => s.updateSubtitle);
  const moveSubtitle = useEditorStore((s) => s.moveSubtitle);
  const trimSceneLeft = useEditorStore((s) => s.trimSceneLeft);
  const trimAudioItem = useEditorStore((s) => s.trimAudioItem);
  const trimAudioLeft = useEditorStore((s) => s.trimAudioLeft);
  const moveAudioItem = useEditorStore((s) => s.moveAudioItem);
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

  // Attach non-passive wheel listener for zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => handleWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [handleWheel]);

  // Sync playhead with player timeupdate
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const handler = (e: { detail: { frame: number } }) => {
      setPlayheadFrame(e.detail.frame);
    };
    // @remotion/player fires "timeupdate" with frame info
    const playerEl = player as unknown as EventTarget;
    playerEl.addEventListener("timeupdate", handler as EventListener);
    return () =>
      playerEl.removeEventListener("timeupdate", handler as EventListener);
  }, [playerRef, setPlayheadFrame]);

  // Sync scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [setScrollLeft]);

  const sceneIds = scenes.map((s) => s.id);

  // Compute context target based on current selection
  const getContextTarget = useCallback((): ContextTarget => {
    if (selectedSceneId) {
      const idx = scenes.findIndex((s) => s.id === selectedSceneId);
      if (idx !== -1) {
        let start = 0;
        for (let i = 0; i < idx; i++) start += scenes[i].durationInFrames;
        return { type: "scene", sceneId: selectedSceneId, startFrame: start, durationFrames: scenes[idx].durationInFrames };
      }
    }
    if (selectedSubtitleId) return { type: "subtitle", subtitleId: selectedSubtitleId };
    if (selectedAudioId) return { type: "audio", audioId: selectedAudioId };
    return { type: "empty" };
  }, [selectedSceneId, selectedSubtitleId, selectedAudioId, scenes]);

  const [ctxTarget, setCtxTarget] = useState<ContextTarget>({ type: "empty" });
  const handleCtx = useCallback(
    () => setCtxTarget(getContextTarget()),
    [getContextTarget],
  );

  return (
    <div className="flex flex-col border-t border-zinc-700 bg-zinc-950 select-none" onContextMenu={handleCtx}>
      {/* Ruler */}
      <TimelineRuler
        pixelsPerFrame={pixelsPerFrame}
        totalFrames={totalFrames}
        playheadFrame={playheadFrame}
        onSeek={handleSeek}
        scrollLeft={scrollLeft}
      />

      {/* Tracks */}
      <ContextMenu target={ctxTarget} playheadFrame={playheadFrame}>
      <div className="flex flex-1 min-h-0">
        {/* Track labels */}
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

        {/* Scrollable track content */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          <div
            className="relative"
            style={{ minWidth: totalFrames * pixelsPerFrame + 100 }}
          >
            {/* Playhead line across all tracks */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
              style={{ left: playheadFrame * pixelsPerFrame }}
            />

            {/* Video track (sortable) */}
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
                  onTrimStart={(id, newTrimFrom) => trimSceneLeft(id, newTrimFrom)}
                />
              </SortableContext>
            </DndContext>

            {/* Audio track */}
            <TimelineTrack
              type="audio"
              items={audioItems}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={selectedAudioId}
              onSelect={setSelectedAudio}
              onTrim={(id, dur) => trimAudioItem(id, dur)}
              onTrimStart={(id, newFrom) => trimAudioLeft(id, newFrom)}
              onMove={(id, newFrom) => moveAudioItem(id, newFrom)}
            />

            {/* Subtitle track */}
            <TimelineTrack
              type="subtitle"
              items={subtitles}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={selectedSubtitleId}
              onSelect={setSelectedSubtitle}
              onTrimStart={(id, start) => updateSubtitle(id, { startFrame: start })}
              onTrimEnd={(id, end) => updateSubtitle(id, { endFrame: end })}
              onMove={(id, delta) => moveSubtitle(id, delta)}
            />
          </div>
        </div>
      </div>
      </ContextMenu>
    </div>
  );
}
