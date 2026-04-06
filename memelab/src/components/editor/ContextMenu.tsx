"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Trash2, Scissors, Sparkles, Snowflake, Timer } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { EDITOR_FPS } from "@/stores/editor-types";
import type { EditorScene } from "@/stores/editor-types";

const TRANSITION_OPTIONS: { value: EditorScene["transition"]["type"]; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "wipe", label: "Wipe" },
  { value: "flip", label: "Flip" },
];

interface ContextMenuProps {
  children: React.ReactNode;
  sceneId: string;
  playheadFrame: number;
  sceneDurationFrames: number;
  sceneStartFrame: number;
}

interface MenuPosition {
  x: number;
  y: number;
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive ? "text-red-400 hover:text-red-300" : "text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function TransitionSubmenu({
  sceneId,
  currentType,
  onClose,
}: {
  sceneId: string;
  currentType: EditorScene["transition"]["type"];
  onClose: () => void;
}) {
  const setTransition = useEditorStore((s) => s.setTransition);

  return (
    <div className="py-1">
      {TRANSITION_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => {
            setTransition(sceneId, opt.value, opt.value === "none" ? 0 : 15);
            onClose();
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-zinc-800 ${
            currentType === opt.value ? "text-purple-400" : "text-foreground"
          }`}
        >
          {currentType === opt.value && <span className="text-xs">●</span>}
          {currentType !== opt.value && <span className="text-xs opacity-0">●</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ContextMenu({
  children,
  sceneId,
  playheadFrame,
  sceneDurationFrames,
  sceneStartFrame,
}: ContextMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [showTransitions, setShowTransitions] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const deleteScene = useEditorStore((s) => s.deleteScene);
  const splitScene = useEditorStore((s) => s.splitScene);
  const freezeFrame = useEditorStore((s) => s.freezeFrame);
  const trimScene = useEditorStore((s) => s.trimScene);
  const splitSubtitle = useEditorStore((s) => s.splitSubtitle);
  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);

  const scene = scenes.find((s) => s.id === sceneId);
  const canDelete = scenes.length > 1;
  const frameOffset = playheadFrame - sceneStartFrame;
  const canSplit = frameOffset > 0 && frameOffset < sceneDurationFrames;

  // Find subtitle that overlaps the playhead within this scene
  const activeSubtitle = subtitles.find(
    (s) => playheadFrame >= s.startFrame && playheadFrame < s.endFrame,
  );
  const canSplitSubtitle =
    activeSubtitle != null &&
    playheadFrame > activeSubtitle.startFrame &&
    playheadFrame < activeSubtitle.endFrame;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowTransitions(false);
    },
    [],
  );

  const close = useCallback(() => {
    setMenuPos(null);
    setShowTransitions(false);
  }, []);

  useEffect(() => {
    if (!menuPos) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [menuPos, close]);

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>

      {menuPos && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-zinc-950 py-1 shadow-xl"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {showTransitions ? (
            <div>
              <button
                type="button"
                onClick={() => setShowTransitions(false)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-zinc-800 rounded"
              >
                ← Voltar
              </button>
              <div className="h-px bg-border my-1" />
              <TransitionSubmenu
                sceneId={sceneId}
                currentType={scene?.transition.type ?? "none"}
                onClose={close}
              />
            </div>
          ) : (
            <>
              <MenuItem
                icon={Copy}
                label="Duplicar Cena"
                onClick={() => {
                  duplicateScene(sceneId);
                  close();
                }}
              />
              <MenuItem
                icon={Trash2}
                label="Deletar Cena"
                onClick={() => {
                  deleteScene(sceneId);
                  close();
                }}
                disabled={!canDelete}
                destructive
              />
              <div className="h-px bg-border my-1" />
              <MenuItem
                icon={Scissors}
                label="Dividir no Playhead"
                onClick={() => {
                  splitScene(sceneId, frameOffset);
                  close();
                }}
                disabled={!canSplit}
              />
              {canSplitSubtitle && (
                <MenuItem
                  icon={Scissors}
                  label="Cortar Legenda no Playhead"
                  onClick={() => {
                    splitSubtitle(activeSubtitle!.id, playheadFrame);
                    close();
                  }}
                />
              )}
              <div className="h-px bg-border my-1" />
              <MenuItem
                icon={Snowflake}
                label="Congelar Frame (+1s)"
                onClick={() => {
                  freezeFrame(sceneId, EDITOR_FPS);
                  close();
                }}
              />
              <MenuItem
                icon={Timer}
                label="Estender (+1s)"
                onClick={() => {
                  trimScene(sceneId, sceneDurationFrames + EDITOR_FPS);
                  close();
                }}
              />
              <div className="h-px bg-border my-1" />
              <button
                type="button"
                onClick={() => setShowTransitions(true)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-zinc-800 text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Transicao
                </span>
                <span className="text-xs text-muted-foreground">→</span>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
