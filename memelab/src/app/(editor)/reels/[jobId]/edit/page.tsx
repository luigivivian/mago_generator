"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import { useStepState } from "@/hooks/use-reels";
import { useEditorStore } from "@/stores/editor-store";
import { useAutosave } from "@/hooks/use-autosave";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { RemotionPreview } from "@/components/editor/RemotionPreview";
import { Timeline } from "@/components/editor/Timeline";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { SubtitleEditor } from "@/components/editor/SubtitleEditor";
import { Toolbar } from "@/components/editor/Toolbar";

export default function EditorPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { data: stepState, error, isLoading } = useStepState(jobId);
  const playerRef = useRef<PlayerRef>(null);
  const loadedRef = useRef(false);
  const saveStatus = useAutosave(jobId);

  const subtitles = useEditorStore((s) => s.subtitles);
  const playheadFrame = useEditorStore((s) => s.playheadFrame);

  useEffect(() => {
    if (!stepState || loadedRef.current) return;
    const store = useEditorStore.getState();
    if (stepState.editor && stepState.editor.scenes.length > 0) {
      store.loadFromEditorState({
        scenes: stepState.editor.scenes as never[],
        subtitles: stepState.editor.subtitles as never[],
        transitions: stepState.editor.transitions as never[],
        audioItems: stepState.editor.audioItems as never[],
      });
      // If saved editor state has no subtitles, load from SRT
      if (
        (!stepState.editor.subtitles || stepState.editor.subtitles.length === 0) &&
        stepState.srt?.path
      ) {
        store.loadSubtitlesFromSrt(jobId, stepState.srt.path);
      }
    } else {
      store.loadFromStepState(stepState, jobId);
    }
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
    <EditorLayout
      toolbar={<Toolbar playerRef={playerRef} saveStatus={saveStatus} />}
      preview={
        <div className="relative" style={{ width: 270, height: 480 }}>
          <RemotionPreview playerRef={playerRef} />
          <SubtitleEditor
            subtitles={subtitles}
            currentFrame={playheadFrame}
            compositionWidth={270}
            compositionHeight={480}
          />
        </div>
      }
      timeline={<Timeline playerRef={playerRef} />}
      panel={<PropertiesPanel jobId={jobId} />}
    />
  );
}
