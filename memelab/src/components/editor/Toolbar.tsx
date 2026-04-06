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
} from "lucide-react";
import { useUndoRedo } from "@/hooks/use-editor";
import { useEditorStore } from "@/stores/editor-store";
import { EDITOR_FPS } from "@/stores/editor-types";
import { exportRemotion } from "@/lib/api";

interface ToolbarProps {
  playerRef: React.RefObject<PlayerRef | null>;
  saveStatus: "idle" | "saving" | "saved";
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

export function Toolbar({ playerRef, saveStatus }: ToolbarProps) {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Use scenes count to re-run effect after Player mounts with data
  const scenesCount = useEditorStore((s) => s.scenes.length);

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

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportRemotion(jobId);
    } finally {
      setExporting(false);
    }
  }, [jobId, exporting]);

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
        onClick={undo}
        disabled={!canUndo}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Desfazer"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className="p-1.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed text-foreground"
        title="Refazer (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="h-5 w-px bg-border" />

      <ToolbarEditButtons playerRef={playerRef} />

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
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-sm text-white font-medium"
        title="Exportar video"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Exportar
      </button>
    </div>
  );
}
