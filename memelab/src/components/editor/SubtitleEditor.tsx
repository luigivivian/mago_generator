"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useEditorStore } from "@/stores/editor-store";
import type { EditorSubtitle } from "@/stores/editor-types";
import type { PlayerRef } from "@remotion/player";

interface SubtitleEditorProps {
  subtitles: EditorSubtitle[];
  currentFrame: number;
  compositionWidth: number;
  compositionHeight: number;
  // 999.12 D-08: pause player when user starts dragging a subtitle overlay
  playerRef?: React.RefObject<PlayerRef | null>;
}

function SubtitleOverlay({
  subtitle,
  compositionWidth,
  compositionHeight,
  playerRef,
}: {
  subtitle: EditorSubtitle;
  compositionWidth: number;
  compositionHeight: number;
  playerRef?: React.RefObject<PlayerRef | null>;
}) {
  const updateSubtitle = useEditorStore((s) => s.updateSubtitle);
  const setSelectedSubtitle = useEditorStore((s) => s.setSelectedSubtitle);
  const selectedSubtitleId = useEditorStore((s) => s.selectedSubtitleId);
  const isSelected = selectedSubtitleId === subtitle.id;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<string>(subtitle.text);
  const [isDragging, setIsDragging] = useState(false);

  // Sync from store only when NOT focused (D-03: prevents clobbering user typing)
  useEffect(() => {
    draftRef.current = subtitle.text;
    if (editRef.current && document.activeElement !== editRef.current) {
      editRef.current.textContent = subtitle.text;
    }
  }, [subtitle.id, subtitle.text]);

  const scaleFactor = compositionWidth / 1080;
  const scaledFontSize = Math.max(10, Math.round(subtitle.style.fontSize * scaleFactor));

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 999.12 D-08: auto-pause player if it's playing when drag starts
      const player = playerRef?.current;
      if (player && player.isPlaying()) player.pause();
      setSelectedSubtitle(subtitle.id);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: subtitle.position.x,
        origY: subtitle.position.y,
      };
      setIsDragging(true);

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current || !containerRef.current) return;
        const parent = containerRef.current.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
        const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, dragRef.current.origX + dx));
        const newY = Math.max(0, Math.min(100, dragRef.current.origY + dy));
        updateSubtitle(subtitle.id, { position: { x: newX, y: newY } });
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [subtitle.id, subtitle.position.x, subtitle.position.y, updateSubtitle, setSelectedSubtitle, playerRef],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const newText = e.currentTarget.textContent ?? "";
      draftRef.current = newText;
      if (newText !== subtitle.text) {
        updateSubtitle(subtitle.id, { text: newText });
      }
    },
    [subtitle.id, subtitle.text, updateSubtitle],
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: `${subtitle.position.x}%`,
        top: `${subtitle.position.y}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      <div
        ref={editRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedSubtitle(subtitle.id);
        }}
        style={{
          fontSize: `${scaledFontSize}px`,
          fontFamily: subtitle.style.fontFamily,
          color: subtitle.style.color,
          textShadow: subtitle.style.shadowSize > 0
            ? `0 0 ${subtitle.style.shadowSize}px ${subtitle.style.shadowColor}, 0 0 ${subtitle.style.shadowSize * 2}px ${subtitle.style.shadowColor}`
            : undefined,
          padding: "4px 8px",
          borderRadius: "4px",
          outline: isSelected ? "2px solid #7C3AED" : "1px solid transparent",
          outlineOffset: "2px",
          whiteSpace: "pre-wrap",
          textAlign: "center",
          minWidth: "40px",
          cursor: isDragging ? "grabbing" : "text",
        }}
      >
        {subtitle.text}
      </div>
    </div>
  );
}

export function SubtitleEditor({
  subtitles,
  currentFrame,
  compositionWidth,
  compositionHeight,
  playerRef,
}: SubtitleEditorProps) {
  const visibleSubtitles = subtitles.filter(
    (s) => s.startFrame <= currentFrame && currentFrame < s.endFrame,
  );

  if (visibleSubtitles.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {visibleSubtitles.map((subtitle) => (
        <SubtitleOverlay
          key={subtitle.id}
          subtitle={subtitle}
          compositionWidth={compositionWidth}
          compositionHeight={compositionHeight}
          playerRef={playerRef}
        />
      ))}
    </div>
  );
}
