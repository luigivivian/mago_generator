"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editor-store";
import { patchEditorState } from "@/lib/api";

export function useAutosave(jobId: string) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<NodeJS.Timeout>();
  const idleTimerRef = useRef<NodeJS.Timeout>();
  const abortRef = useRef<AbortController>();
  const isMountedRef = useRef(true);

  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);
  const transitions = useEditorStore((s) => s.transitions);
  const audioItems = useEditorStore((s) => s.audioItems);

  // Track mount state (D-09)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (scenes.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Cancel any in-flight save request (D-09)
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      if (isMountedRef.current) setSaveStatus("saving");
      try {
        await patchEditorState(jobId, {
          scenes: scenes as unknown as Record<string, unknown>[],
          subtitles: subtitles as unknown as Record<string, unknown>[],
          transitions: transitions as unknown as Record<string, unknown>[],
          audioItems: audioItems as unknown as Record<string, unknown>[],
        });
        if (isMountedRef.current) {
          setSaveStatus("saved");
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setSaveStatus("idle");
          }, 1500);
        }
      } catch {
        if (isMountedRef.current) setSaveStatus("idle");
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      abortRef.current?.abort();
    };
  }, [scenes, subtitles, transitions, audioItems, jobId]);

  return saveStatus;
}
