"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
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
import type { SnapTarget } from "@/lib/editor";

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
  // 999.12 D-01: full multi-select set drives block highlighting
  const selection = useEditorStore((s) => s.selection);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);
  const reorderScenes = useEditorStore((s) => s.reorderScenes);
  const setSelectedScene = useEditorStore((s) => s.setSelectedScene);
  const setSelectedSubtitle = useEditorStore((s) => s.setSelectedSubtitle);
  const setSelectedAudio = useEditorStore((s) => s.setSelectedAudio);
  const toggleSelection = useEditorStore((s) => s.toggleSelection);
  const replaceSelection = useEditorStore((s) => s.replaceSelection);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const bulkDeleteSelected = useEditorStore((s) => s.bulkDeleteSelected);
  const bulkDuplicateSelected = useEditorStore((s) => s.bulkDuplicateSelected);
  const setPlayheadFrame = useEditorStore((s) => s.setPlayheadFrame);
  const trimScene = useEditorStore((s) => s.trimScene);
  const updateSubtitle = useEditorStore((s) => s.updateSubtitle);
  const moveSubtitle = useEditorStore((s) => s.moveSubtitle);
  const trimSceneLeft = useEditorStore((s) => s.trimSceneLeft);
  const trimAudioItem = useEditorStore((s) => s.trimAudioItem);
  const trimAudioLeft = useEditorStore((s) => s.trimAudioLeft);
  const moveAudioItem = useEditorStore((s) => s.moveAudioItem);
  const totalFrames = useTotalDuration();

  // 999.12 D-01: selection set membership lookups for each track
  const selectedSceneIds = new Set<string>();
  const selectedSubtitleIds = new Set<string>();
  const selectedAudioIds = new Set<string>();
  for (const key of selection) {
    const colonIdx = key.indexOf(":");
    if (colonIdx === -1) continue;
    const kind = key.slice(0, colonIdx);
    const id = key.slice(colonIdx + 1);
    if (kind === "scene") selectedSceneIds.add(id);
    else if (kind === "subtitle") selectedSubtitleIds.add(id);
    else if (kind === "audio") selectedAudioIds.add(id);
  }

  // 999.12 D-01: route a click to toggle (modifier) or replace (plain)
  const handleSceneSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection("scene", id);
      else replaceSelection("scene", id);
    },
    [toggleSelection, replaceSelection],
  );
  const handleSubtitleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection("subtitle", id);
      else replaceSelection("subtitle", id);
    },
    [toggleSelection, replaceSelection],
  );
  const handleAudioSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection("audio", id);
      else replaceSelection("audio", id);
    },
    [toggleSelection, replaceSelection],
  );

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

  // Playhead syncs via RAF loop in RemotionPreview only (D-01)

  // Attach non-passive wheel listener for zoom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => handleWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [handleWheel]);

  // Auto-scroll timeline to keep playhead visible during playback
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playheadPx = playheadFrame * pixelsPerFrame;
    const viewLeft = el.scrollLeft;
    const viewRight = viewLeft + el.clientWidth;
    const margin = el.clientWidth * 0.15;
    if (playheadPx < viewLeft + margin) {
      el.scrollLeft = Math.max(0, playheadPx - margin);
    } else if (playheadPx > viewRight - margin) {
      el.scrollLeft = playheadPx - el.clientWidth + margin;
    }
  }, [playheadFrame, pixelsPerFrame]);

  // Sync scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [setScrollLeft]);

  // 999.12 D-04: snap targets — playhead frame + every scene start/end
  const snapTargets = useMemo<SnapTarget[]>(() => {
    const targets: SnapTarget[] = [{ frame: playheadFrame, label: "playhead" }];
    let off = 0;
    for (const s of scenes) {
      targets.push({ frame: off, label: `scene-${s.index}-start` });
      off += s.durationInFrames;
      targets.push({ frame: off, label: `scene-${s.index}-end` });
    }
    return targets;
  }, [scenes, playheadFrame]);

  // 999.12 D-02, D-06, D-07: keyboard shortcuts for bulk ops + nudge.
  // Skip when focus is in a text input/textarea/contenteditable so the
  // PropertiesPanel and inline subtitle editor still receive their keys.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      if (selection.size === 0) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        bulkDeleteSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        bulkDuplicateSelected();
        return;
      }
      // 999.12 D-06: arrow nudge — 1f / Shift=10f / Cmd|Ctrl=30f
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const sign = e.key === "ArrowLeft" ? -1 : 1;
        const magnitude = (e.metaKey || e.ctrlKey) ? 30 : e.shiftKey ? 10 : 1;
        const delta = sign * magnitude;
        e.preventDefault();
        // Apply as ONE undo entry by mutating the store directly inside
        // a single setState. Scenes don't move freely (they're a sortable
        // list) — only nudge subtitles and audio.
        useEditorStore.setState((state) => {
          const subtitles = state.subtitles.map((s) => {
            if (selection.has(`subtitle:${s.id}`)) {
              const dur = s.endFrame - s.startFrame;
              const newStart = Math.max(0, s.startFrame + delta);
              return { ...s, startFrame: newStart, endFrame: newStart + dur };
            }
            return s;
          });
          const audioItems = state.audioItems.map((a) => {
            if (selection.has(`audio:${a.id}`)) {
              return { ...a, from: Math.max(0, a.from + delta) };
            }
            return a;
          });
          return { subtitles, audioItems };
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selection, bulkDeleteSelected, bulkDuplicateSelected]);

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
      {/* Ruler row — same flex layout as tracks so label column aligns */}
      <div className="flex">
        <div className="w-20 shrink-0 border-r border-zinc-700 h-6 bg-zinc-900" />
        <div className="flex-1 overflow-hidden">
          <TimelineRuler
            pixelsPerFrame={pixelsPerFrame}
            totalFrames={totalFrames}
            playheadFrame={playheadFrame}
            onSeek={handleSeek}
            scrollLeft={scrollLeft}
          />
        </div>
      </div>

      {/* Tracks */}
      <ContextMenu target={ctxTarget} playheadFrame={playheadFrame}>
      <div className="flex flex-1 min-h-0">
        {/* Track labels — highlight selected track */}
        <div className="w-20 shrink-0 border-r border-zinc-700">
          <div
            className={`h-14 flex items-center px-2 text-xs border-b border-zinc-800 transition-colors cursor-pointer ${
              selectedSceneId
                ? "text-purple-300 bg-purple-500/10 border-l-2 border-l-purple-500"
                : "text-zinc-400 border-l-2 border-l-transparent"
            }`}
            onClick={() => {
              if (!selectedSceneId && scenes.length > 0) setSelectedScene(scenes[0].id);
            }}
          >
            Video
          </div>
          <div
            className={`h-14 flex items-center px-2 text-xs border-b border-zinc-800 transition-colors cursor-pointer ${
              selectedAudioId
                ? "text-blue-300 bg-blue-500/10 border-l-2 border-l-blue-500"
                : "text-zinc-400 border-l-2 border-l-transparent"
            }`}
            onClick={() => {
              if (!selectedAudioId && audioItems.length > 0) setSelectedAudio(audioItems[0].id);
            }}
          >
            Audio
          </div>
          <div
            className={`h-10 flex items-center px-2 text-xs transition-colors cursor-pointer ${
              selectedSubtitleId
                ? "text-amber-300 bg-amber-500/10 border-l-2 border-l-amber-500"
                : "text-zinc-400 border-l-2 border-l-transparent"
            }`}
            onClick={() => {
              if (!selectedSubtitleId && subtitles.length > 0) setSelectedSubtitle(subtitles[0].id);
            }}
          >
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
              className="absolute top-0 bottom-0 pointer-events-none z-20"
              style={{ left: playheadFrame * pixelsPerFrame }}
            >
              {/* Triangle head */}
              <div className="absolute -top-1 -translate-x-1/2 w-0 h-0"
                style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "6px solid #ef4444" }}
              />
              {/* Vertical line */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 -translate-x-1/2" />
            </div>

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
                  selectedIds={selectedSceneIds}
                  onSelect={handleSceneSelect}
                  onEmptyClick={clearSelection}
                  onTrim={(id, dur) => trimScene(id, dur)}
                  onTrimStart={(id, newTrimFrom) => trimSceneLeft(id, newTrimFrom)}
                  snapTargets={snapTargets}
                />
              </SortableContext>
            </DndContext>

            {/* Audio track */}
            <TimelineTrack
              type="audio"
              items={audioItems}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={selectedAudioId}
              selectedIds={selectedAudioIds}
              onSelect={handleAudioSelect}
              onEmptyClick={clearSelection}
              onTrim={(id, dur) => trimAudioItem(id, dur)}
              onTrimStart={(id, newFrom) => trimAudioLeft(id, newFrom)}
              onMove={(id, newFrom) => moveAudioItem(id, newFrom)}
              snapTargets={snapTargets}
            />

            {/* Subtitle track */}
            <TimelineTrack
              type="subtitle"
              items={subtitles}
              pixelsPerFrame={pixelsPerFrame}
              selectedId={selectedSubtitleId}
              selectedIds={selectedSubtitleIds}
              onSelect={handleSubtitleSelect}
              onEmptyClick={clearSelection}
              onTrimStart={(id, start) => updateSubtitle(id, { startFrame: start })}
              onTrimEnd={(id, end) => updateSubtitle(id, { endFrame: end })}
              onMove={(id, delta) => moveSubtitle(id, delta)}
              snapTargets={snapTargets}
            />
          </div>
        </div>
      </div>
      </ContextMenu>
    </div>
  );
}
