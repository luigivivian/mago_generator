"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import type { PlayerRef } from "@remotion/player";
import { useStepState } from "@/hooks/use-reels";
import { useEditorStore } from "@/stores/editor-store";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { RemotionPreview } from "@/components/editor/RemotionPreview";
import { Toolbar } from "@/components/editor/Toolbar";

export default function EditorPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { data: stepState, error, isLoading } = useStepState(jobId);
  const playerRef = useRef<PlayerRef>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (stepState && !loadedRef.current) {
      useEditorStore.getState().loadFromStepState(stepState, jobId);
      loadedRef.current = true;
    }
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
      toolbar={<Toolbar playerRef={playerRef} saveStatus="idle" />}
      preview={<RemotionPreview playerRef={playerRef} />}
    />
  );
}
