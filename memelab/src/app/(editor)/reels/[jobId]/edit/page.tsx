"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Volume2, X } from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import { useStepState } from "@/hooks/use-reels";
import { useEditorStore } from "@/stores/editor-store";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { RemotionPreview } from "@/components/editor/RemotionPreview";
import { Timeline } from "@/components/editor/Timeline";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { SubtitleEditor } from "@/components/editor/SubtitleEditor";
import { Toolbar } from "@/components/editor/Toolbar";
import { ShortcutsModal } from "@/components/editor/ShortcutsModal";
import { SafeZoneOverlay, useSafePlatform } from "@/components/editor/SafeZoneOverlay";
import { regenerateStep } from "@/lib/api";

function AudioRegenBanner({ jobId }: { jobId: string }) {
  const subtitlesEdited = useEditorStore((s) => s.subtitlesEdited);
  const markClean = useEditorStore((s) => s.markSubtitlesClean);
  const [regenerating, setRegenerating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      await regenerateStep(jobId, "tts");
      markClean();
      setDismissed(false);
    } finally {
      setRegenerating(false);
    }
  }, [jobId, markClean]);

  if (!subtitlesEdited || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm">
      <Volume2 className="h-4 w-4 text-amber-400 shrink-0" />
      <span className="text-amber-200 flex-1">
        Legendas editadas. Deseja regenerar o audio para refletir as alteracoes?
      </span>
      <button
        type="button"
        onClick={handleRegenerate}
        disabled={regenerating}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium disabled:opacity-50"
      >
        {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
        Regenerar Audio
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-zinc-800 text-muted-foreground"
        title="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function EditorPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { data: stepState, error, isLoading } = useStepState(jobId);
  const playerRef = useRef<PlayerRef>(null);
  const loadedRef = useRef(false);
  const saveStatus = useAutosave(jobId);

  const subtitles = useEditorStore((s) => s.subtitles);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);

  // 999.12 D-11: safe-zone overlay state (persisted in localStorage)
  const [safePlatform, setSafePlatform] = useSafePlatform();

  useEditorShortcuts(playerRef);

  useEffect(() => {
    if (!stepState || loadedRef.current) return;
    const store = useEditorStore.getState();

    // Check if persisted editor state has correct durations
    // If SRT scene_timings exist, they are authoritative — reload from step
    // state to pick up real narration-based durations instead of clip-based
    // ones. Backend writes these under step_state.srt (not step_state.tts).
    const sceneTimings = (stepState.srt as Record<string, unknown> | undefined)?.scene_timings as
      | Array<{ duration: number }> | undefined;
    const hasSceneTimings = sceneTimings && sceneTimings.length > 0;
    const savedEditor = stepState.editor;
    const clipSceneCount = (stepState.clips?.scenes ?? stepState.video?.scenes ?? []).length;
    const savedSceneCount = savedEditor?.scenes?.length ?? 0;
    // Detect broken persisted state: a previous buggy load may have written
    // scenes without clipUrl/imgUrl (or empty strings). Any such scene means
    // the persisted state is unusable — rebuild from stepState.
    const savedHasBrokenMedia = savedEditor && savedEditor.scenes.length > 0 &&
      (savedEditor.scenes as Array<{ clipUrl?: string; imgUrl?: string }>).some(
        (sc) => !sc.clipUrl && !sc.imgUrl,
      );
    const savedHasStaleTimings = savedEditor && savedEditor.scenes.length > 0 && (
      // Scene count mismatch with source data = stale (user split/deleted during a previous session)
      (clipSceneCount > 0 && savedSceneCount !== clipSceneCount) ||
      // Duration mismatch with SRT span timings > 2s = stale
      (hasSceneTimings && Math.abs(
        (savedEditor.scenes as Array<{ durationInFrames: number }>).reduce((s, sc) => s + sc.durationInFrames, 0) / 30 -
        sceneTimings!.reduce((s, t) => s + t.duration, 0)
      ) > 2) ||
      savedHasBrokenMedia
    );

    if (savedEditor && savedEditor.scenes.length > 0 && !savedHasStaleTimings) {
      store.loadFromEditorState({
        scenes: savedEditor.scenes as never[],
        subtitles: savedEditor.subtitles as never[],
        transitions: savedEditor.transitions as never[],
        audioItems: savedEditor.audioItems as never[],
      });
      // Always reload subtitles from SRT if editor has none (cleared by regenerate)
      if (!savedEditor.subtitles || savedEditor.subtitles.length === 0) {
        store.loadSubtitlesFromSrt(jobId, stepState.srt?.path ?? "subtitles.srt");
      }
    } else {
      store.loadFromStepState(stepState, jobId);
    }
    // Always ensure subtitles are loaded from fresh SRT (convention path
    // used as fallback when step_state.srt.path is missing).
    store.loadSubtitlesFromSrt(jobId, stepState.srt?.path ?? "subtitles.srt");
    loadedRef.current = true;
  }, [stepState, jobId]);

  if (isLoading || !stepState) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          <p className="text-sm text-muted-foreground">Carregando editor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <p className="text-red-400">Reel nao encontrado ou erro ao carregar.</p>
          <Link
            href="/reels"
            className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para Reels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
    <ShortcutsModal />
    <EditorLayout
      toolbar={
        <>
          <Toolbar
            playerRef={playerRef}
            saveStatus={saveStatus}
            safePlatform={safePlatform}
            onSafePlatformChange={setSafePlatform}
          />
          <AudioRegenBanner jobId={jobId} />
        </>
      }
      preview={
        <div className="relative" style={{ width: 270, height: 480 }}>
          <RemotionPreview playerRef={playerRef} />
          <SubtitleEditor
            subtitles={subtitles}
            currentFrame={playheadFrame}
            compositionWidth={270}
            compositionHeight={480}
            playerRef={playerRef}
          />
          <SafeZoneOverlay platform={safePlatform} />
        </div>
      }
      timeline={<Timeline playerRef={playerRef} />}
      panel={<PropertiesPanel jobId={jobId} />}
    />
    </>
  );
}
