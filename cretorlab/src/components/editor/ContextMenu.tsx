"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Trash2, Scissors, Sparkles, Snowflake, Timer, Volume2, Subtitles, Gauge, SkipBack, RotateCcw } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { EDITOR_FPS } from "@/stores/editor-types";
import type { EditorScene } from "@/stores/editor-types";

const TRANSITION_OPTIONS: { value: EditorScene["transition"]["type"]; label: string }[] = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "wipe", label: "Wipe" },
  { value: "flip", label: "Flip 3D" },
  { value: "iris", label: "Iris" },
  { value: "clock-wipe", label: "Clock Wipe" },
];

export type ContextTarget =
  | { type: "scene"; sceneId: string; startFrame: number; durationFrames: number }
  | { type: "subtitle"; subtitleId: string }
  | { type: "audio"; audioId: string }
  | { type: "empty" };

interface ContextMenuProps {
  children: React.ReactNode;
  target: ContextTarget;
  playheadFrame: number;
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
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-[#1a1a24] disabled:opacity-40 disabled:cursor-not-allowed ${
        destructive ? "text-red-400 hover:text-red-300" : "text-[#f0f0f5]"
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
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-[#1a1a24] ${
            currentType === opt.value ? "text-primary" : "text-[#f0f0f5]"
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

function SceneMenu({
  target,
  playheadFrame,
  close,
}: {
  target: Extract<ContextTarget, { type: "scene" }>;
  playheadFrame: number;
  close: () => void;
}) {
  const [showTransitions, setShowTransitions] = useState(false);
  const [showSpeed, setShowSpeed] = useState(false);
  const duplicateScene = useEditorStore((s) => s.duplicateScene);
  const deleteScene = useEditorStore((s) => s.deleteScene);
  const splitScene = useEditorStore((s) => s.splitScene);
  const freezeFrame = useEditorStore((s) => s.freezeFrame);
  const trimScene = useEditorStore((s) => s.trimScene);
  const splitSubtitle = useEditorStore((s) => s.splitSubtitle);
  const setPlaybackRate = useEditorStore((s) => s.setPlaybackRate);
  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);

  const scene = scenes.find((s) => s.id === target.sceneId);
  const canDelete = scenes.length > 1;

  const sceneIdx = scenes.findIndex((s) => s.id === target.sceneId);
  const liveStartFrame = sceneIdx !== -1 ? scenes[sceneIdx].from : target.startFrame;
  const liveDurationFrames = sceneIdx !== -1 ? scenes[sceneIdx].durationInFrames : target.durationFrames;
  const frameOffset = playheadFrame - liveStartFrame;
  const canSplit = frameOffset > 0 && frameOffset < liveDurationFrames;

  const activeSubtitle = subtitles.find(
    (s) => playheadFrame >= s.startFrame && playheadFrame < s.endFrame,
  );
  const canSplitSubtitle =
    activeSubtitle != null &&
    playheadFrame > activeSubtitle.startFrame &&
    playheadFrame < activeSubtitle.endFrame;

  const SPEED_OPTIONS = [
    { value: 0.25, label: "0.25x" },
    { value: 0.5, label: "0.5x" },
    { value: 0.75, label: "0.75x" },
    { value: 1, label: "1x (Normal)" },
    { value: 1.5, label: "1.5x" },
    { value: 2, label: "2x" },
    { value: 3, label: "3x" },
    { value: 4, label: "4x" },
  ];

  if (showTransitions) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowTransitions(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#8888a0] hover:bg-[#1a1a24] rounded"
        >
          ← Voltar
        </button>
        <div className="h-px bg-border my-1" />
        <TransitionSubmenu
          sceneId={target.sceneId}
          currentType={scene?.transition.type ?? "none"}
          onClose={close}
        />
      </div>
    );
  }

  if (showSpeed) {
    const currentRate = scene?.playbackRate ?? 1;
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowSpeed(false)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[#8888a0] hover:bg-[#1a1a24] rounded"
        >
          ← Voltar
        </button>
        <div className="h-px bg-border my-1" />
        <div className="py-1">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setPlaybackRate(target.sceneId, opt.value); close(); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-[#1a1a24] ${
                currentRate === opt.value ? "text-primary" : "text-[#f0f0f5]"
              }`}
            >
              {currentRate === opt.value ? <span className="text-xs">●</span> : <span className="text-xs opacity-0">●</span>}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <MenuItem icon={Copy} label="Duplicar Cena" onClick={() => { duplicateScene(target.sceneId); close(); }} />
      <MenuItem icon={Trash2} label="Deletar Cena" onClick={() => { deleteScene(target.sceneId); close(); }} disabled={!canDelete} destructive />
      <div className="h-px bg-border my-1" />
      <MenuItem icon={Scissors} label="Dividir no Playhead" onClick={() => { splitScene(target.sceneId, frameOffset); close(); }} disabled={!canSplit} />
      {canSplitSubtitle && (
        <MenuItem icon={Subtitles} label="Cortar Legenda no Playhead" onClick={() => { splitSubtitle(activeSubtitle!.id, playheadFrame); close(); }} />
      )}
      <div className="h-px bg-border my-1" />
      <MenuItem icon={SkipBack} label="Mover para inicio" onClick={() => { useEditorStore.getState().moveScene(target.sceneId, 0); close(); }} />
      <MenuItem icon={RotateCcw} label="Resetar clip (tocar do inicio)" onClick={() => { useEditorStore.getState().resetClipStart(target.sceneId); close(); }} />
      <MenuItem icon={Snowflake} label="Congelar Frame (+1s)" onClick={() => { freezeFrame(target.sceneId, EDITOR_FPS); close(); }} />
      <MenuItem icon={Timer} label="Estender (+1s)" onClick={() => { trimScene(target.sceneId, liveDurationFrames + EDITOR_FPS); close(); }} />
      <div className="h-px bg-border my-1" />
      <button
        type="button"
        onClick={() => setShowSpeed(true)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-[#1a1a24] text-[#f0f0f5]"
      >
        <span className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5" />Velocidade ({(scene?.playbackRate ?? 1)}x)</span>
        <span className="text-xs text-[#8888a0]">→</span>
      </button>
      <button
        type="button"
        onClick={() => setShowTransitions(true)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-sm rounded hover:bg-[#1a1a24] text-[#f0f0f5]"
      >
        <span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />Transicao</span>
        <span className="text-xs text-[#8888a0]">→</span>
      </button>
    </>
  );
}

function SubtitleMenu({
  target,
  playheadFrame,
  close,
}: {
  target: Extract<ContextTarget, { type: "subtitle" }>;
  playheadFrame: number;
  close: () => void;
}) {
  const deleteSubtitle = useEditorStore((s) => s.deleteSubtitle);
  const splitSubtitle = useEditorStore((s) => s.splitSubtitle);
  const subtitles = useEditorStore((s) => s.subtitles);

  const sub = subtitles.find((s) => s.id === target.subtitleId);
  const canSplit = sub != null && playheadFrame > sub.startFrame && playheadFrame < sub.endFrame;

  return (
    <>
      <MenuItem icon={Scissors} label="Dividir Legenda no Playhead" onClick={() => { splitSubtitle(target.subtitleId, playheadFrame); close(); }} disabled={!canSplit} />
      <div className="h-px bg-border my-1" />
      <MenuItem icon={Trash2} label="Deletar Legenda" onClick={() => { deleteSubtitle(target.subtitleId); close(); }} destructive />
    </>
  );
}

function AudioMenu({
  target,
  playheadFrame,
  close,
}: {
  target: Extract<ContextTarget, { type: "audio" }>;
  playheadFrame: number;
  close: () => void;
}) {
  const deleteAudioItem = useEditorStore((s) => s.deleteAudioItem);
  const audioItems = useEditorStore((s) => s.audioItems);

  const audio = audioItems.find((a) => a.id === target.audioId);
  const canSplit = audio != null && playheadFrame > audio.from && playheadFrame < audio.from + audio.durationInFrames;

  return (
    <>
      {canSplit && (
        <MenuItem icon={Scissors} label="Dividir Audio no Playhead" onClick={() => {
          useEditorStore.getState().splitAudioItem(target.audioId, playheadFrame);
          close();
        }} />
      )}
      <div className="h-px bg-border my-1" />
      <MenuItem icon={Trash2} label="Deletar Audio" onClick={() => { deleteAudioItem(target.audioId); close(); }} destructive />
    </>
  );
}

export function ContextMenu({ children, target, playheadFrame }: ContextMenuProps) {
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (target.type === "empty") return;
      e.preventDefault();
      e.stopPropagation();
      setMenuPos({ x: e.clientX, y: e.clientY });
    },
    [target.type],
  );

  const close = useCallback(() => setMenuPos(null), []);

  useEffect(() => {
    if (!menuPos) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
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
          className="fixed z-50 min-w-[200px] rounded-lg border border-white/[0.08] bg-[#0e0e16] py-1 shadow-xl"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {target.type === "scene" && <SceneMenu target={target} playheadFrame={playheadFrame} close={close} />}
          {target.type === "subtitle" && <SubtitleMenu target={target} playheadFrame={playheadFrame} close={close} />}
          {target.type === "audio" && <AudioMenu target={target} playheadFrame={playheadFrame} close={close} />}
        </div>
      )}
    </>
  );
}
