"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { patchEditorState } from "@/lib/api";

export function useAutosave(jobId: string) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<NodeJS.Timeout>();
  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);
  const transitions = useEditorStore((s) => s.transitions);
  const audioItems = useEditorStore((s) => s.audioItems);

  useEffect(() => {
    if (scenes.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await patchEditorState(jobId, {
          scenes: scenes as unknown as Record<string, unknown>[],
          subtitles: subtitles as unknown as Record<string, unknown>[],
          transitions: transitions as unknown as Record<string, unknown>[],
          audioItems: audioItems as unknown as Record<string, unknown>[],
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("idle");
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scenes, subtitles, transitions, audioItems, jobId]);

  return saveStatus;
}
