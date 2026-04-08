"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PlayerRef } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Pause,
  Undo2,
  Redo2,
  Download,
  Check,
  Loader2,
  ArrowLeft,
  Scissors,
  Copy,
  Trash2,
  Snowflake,
  HelpCircle,
  Maximize2,
  Smartphone,
  Type,
  RotateCcw,
} from "lucide-react";
import type { SafePlatform } from "./SafeZoneOverlay";
import { useUndoRedo } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { useStepState } from "@/hooks/use-reels";
import { patchEditorState } from "@/lib/api";
import { EDITOR_FPS, DEFAULT_SUBTITLE_STYLE } from "@/stores/editor-types";
import { genId } from "@/lib/editor";
import { ExportModal } from "./ExportModal";

interface ToolbarProps {
  playerRef: React.RefObject<PlayerRef | null>;
  saveStatus: "idle" | "saving" | "saved";
  // 999.12 D-11: safe-zone overlay platform cycle
  safePlatform?: SafePlatform;
  onSafePlatformChange?: (platform: SafePlatform) => void;
}

function ToolbarEditButtons({ playerRef }: { playerRef: React.RefObject<PlayerRef | null> }) {
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectedSubtitleId = useEditorStore((s) => s.selectedSubtitleId);
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);
  const hasSelection = !!(selectedSceneId || selectedSubtitleId || selectedAudioId);

  const handleSplit = useCallback(() => {
    const store = useEditorStore.getState();
    const frame = store.playheadFrame;
    if (store.selectedSubtitleId) {
      store.splitSubtitle(store.selectedSubtitleId, frame);
    } else if (store.selectedAudioId) {
      store.splitAudioItem(store.selectedAudioId, frame);
    } else if (store.selectedSceneId) {
      let sceneStart = 0;
      for (const s of store.scenes) {
        if (s.id === store.selectedSceneId) break;
        sceneStart += s.durationInFrames;
      }
      const offset = frame - sceneStart;
      if (offset > 0) store.splitScene(store.selectedSceneId, offset);
    }
  }, []);

  const handleDuplicate = useCallback(() => {
    const store = useEditorStore.getState();
    if (store.selectedSceneId) store.duplicateScene(store.selectedSceneId);
  }, []);

  const handleDelete = useCallback(() => {
    const store = useEditorStore.getState();
    if (store.selectedSubtitleId) store.deleteSubtitle(store.selectedSubtitleId);
    else if (store.selectedAudioId) store.deleteAudioItem(store.selectedAudioId);
    else if (store.selectedSceneId && store.scenes.length > 1) store.deleteScene(store.selectedSceneId);
  }, []);

  const handleFreeze = useCallback(() => {
    const store = useEditorStore.getState();
    if (store.selectedSceneId) store.freezeFrame(store.selectedSceneId, EDITOR_FPS);
  }, []);

  // Add a new subtitle at the playhead with default 2s duration. After
  // creating, select it so PropertiesPanel switches to the SubtitlePanel
  // and the user lands directly on the text/style editor.
  const handleAddSubtitle = useCallback(() => {
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
  }, []);

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleSplit}
        disabled={!hasSelection}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Cortar no Playhead (S)"
      >
        <Scissors className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={!selectedSceneId}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Duplicar (D)"
      >
        <Copy className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleFreeze}
        disabled={!selectedSceneId}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Congelar Frame +1s (F)"
      >
        <Snowflake className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleAddSubtitle}
        className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent text-amber-300 border border-amber-500/30"
        title="Adicionar legenda no playhead (T)"
      >
        <Type className="h-4 w-4" />
        <span className="text-xs font-medium">Legenda</span>
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!hasSelection}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-red-400 hover:text-red-300"
        title="Deletar (Delete)"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toolbar({ playerRef, saveStatus, safePlatform = "off", onSafePlatformChange }: ToolbarProps) {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const [isPlaying, setIsPlaying] = useState(false);
  // 999.12 D-14: ExportModal handles validation + polling
  const [exportModalOpen, setExportModalOpen] = useState(false);
  // Use scenes count to re-run effect after Player mounts with data
  const scenesCount = useEditorStore((s) => s.scenes.length);
  // 999.14 D-08 fix (Bug 1): "Reset editor state" reads the live step_state
  // from SWR cache, reloads the editor store from it (overwriting any
  // persisted-but-stale `step_state.editor` user-mutations from earlier
  // sessions), and immediately PATCHes the freshly loaded state back to
  // the backend so the staleness can never bite again on the next reload.
  const { data: stepState } = useStepState(jobId);
  const [resetting, setResetting] = useState(false);

  const handleResetEditorState = useCallback(async () => {
    if (!stepState) return;
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            "Resetar o estado do editor descarta todas as edicoes salvas (cortes, duplicatas, legendas adicionadas, transicoes) e recarrega a partir das cenas/clipes originais. Continuar?",
          );
    if (!ok) return;
    setResetting(true);
    try {
      const store = useEditorStore.getState();
      store.loadFromStepState(stepState, jobId);
      // Immediately persist the freshly loaded state so the next page load
      // doesn't see the old persisted editor mutations.
      const fresh = useEditorStore.getState().toEditorPersistState();
      await patchEditorState(jobId, {
        scenes: fresh.scenes as unknown as Record<string, unknown>[],
        subtitles: fresh.subtitles as unknown as Record<string, unknown>[],
        transitions: fresh.transitions as unknown as Record<string, unknown>[],
        audioItems: fresh.audioItems as unknown as Record<string, unknown>[],
      });
    } catch (err) {
      console.error("[reset-editor-state] failed:", err);
    } finally {
      setResetting(false);
    }
  }, [stepState, jobId]);

  useEffect(() => {
    const { current } = playerRef;
    if (!current) return;
    setIsPlaying(current.isPlaying());

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    current.addEventListener("play", onPlay);
    current.addEventListener("pause", onPause);
    current.addEventListener("ended", onEnded);
    return () => {
      current.removeEventListener("play", onPlay);
      current.removeEventListener("pause", onPause);
      current.removeEventListener("ended", onEnded);
    };
  }, [playerRef, scenesCount]);

  const togglePlay = useCallback(() => {
    playerRef.current?.toggle();
  }, [playerRef]);

  const handleExport = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2 bg-background shrink-0">
      <Link
        href={`/reels/${jobId}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mr-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Voltar</span>
      </Link>

      <div className="h-5 w-px bg-border" />

      <button
        type="button"
        onClick={togglePlay}
        className="p-1.5 rounded hover:bg-accent text-foreground"
        title={isPlaying ? "Pausar" : "Reproduzir"}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <div className="h-5 w-px bg-border" />

      <button
        type="button"
        onClick={() => undo()}
        disabled={!canUndo}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Desfazer (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => redo()}
        disabled={!canRedo}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Refazer (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="h-5 w-px bg-border" />

      <ToolbarEditButtons playerRef={playerRef} />

      <div className="h-5 w-px bg-border" />

      {/* 999.14 D-08 (Bug 1 escape hatch): reset persisted editor state to
          the live step_state. Use when scenes look duplicated or counts
          look wrong because an earlier session left stale `step_state.editor`. */}
      <button
        type="button"
        onClick={handleResetEditorState}
        disabled={resetting || !stepState}
        className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 hover:text-zinc-100 border border-zinc-700"
        title="Resetar editor — descarta edicoes e recarrega da pipeline"
      >
        {resetting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        <span className="text-xs font-medium">Resetar</span>
      </button>

      <div className="h-5 w-px bg-border" />

      {/* 999.12 D-13: zoom-to-fit */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("timeline:fit"))}
        className="p-1.5 rounded hover:bg-accent text-foreground"
        title="Ajustar timeline (Shift+Z)"
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      {/* 999.12 D-11: safe-zone overlay cycle (off → tiktok → instagram) */}
      {onSafePlatformChange && (
        <button
          type="button"
          onClick={() => {
            const next: SafePlatform =
              safePlatform === "off" ? "tiktok" : safePlatform === "tiktok" ? "instagram" : "off";
            onSafePlatformChange(next);
          }}
          className={`p-1.5 rounded hover:bg-accent flex items-center gap-1 ${safePlatform !== "off" ? "text-purple-400" : "text-foreground"}`}
          title={
            safePlatform === "off"
              ? "Safe zone: desligado (clique para TikTok)"
              : safePlatform === "tiktok"
              ? "Safe zone: TikTok (clique para Instagram)"
              : "Safe zone: Instagram (clique para desligar)"
          }
        >
          <Smartphone className="h-4 w-4" />
          {safePlatform !== "off" && (
            <span className="text-[10px] font-bold uppercase">
              {safePlatform === "tiktok" ? "T" : "I"}
            </span>
          )}
        </button>
      )}

      <div className="flex-1" />

      <AnimatePresence mode="wait">
        {saveStatus === "saving" && (
          <motion.span
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground flex items-center gap-1"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Salvando...
          </motion.span>
        )}
        {saveStatus === "saved" && (
          <motion.span
            key="saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-xs text-green-400 flex items-center gap-1"
          >
            <Check className="h-3 w-3" />
            Salvo
          </motion.span>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true, code: "Slash" }))}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground"
        title="Atalhos (?)"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-sm text-white font-medium"
        title="Exportar video"
      >
        <Download className="h-4 w-4" />
        Exportar
      </button>

      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        jobId={jobId}
      />
    </div>
  );
}
