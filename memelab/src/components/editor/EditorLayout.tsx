"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { PanelRightClose, PanelRightOpen, Monitor } from "lucide-react";

interface EditorLayoutProps {
  toolbar: React.ReactNode;
  preview: React.ReactNode;
  timeline?: React.ReactNode;
  panel?: React.ReactNode;
}

const TIMELINE_HEIGHT_KEY = "memelab.editor.timelineHeight";
const MIN_TIMELINE_HEIGHT = 180;

export function EditorLayout({ toolbar, preview, timeline, panel }: EditorLayoutProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  // 999.12 D-18: persistent draggable timeline height
  const [timelineHeight, setTimelineHeight] = useState<number>(220);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Restore persisted timeline height
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TIMELINE_HEIGHT_KEY) : null;
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (Number.isFinite(parsed) && parsed >= MIN_TIMELINE_HEIGHT) {
        setTimelineHeight(Math.min(parsed, window.innerHeight * 0.6));
      }
    }
  }, []);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: timelineHeight };

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        // drag up grows the timeline (delta > 0 when moving up)
        const delta = dragRef.current.startY - ev.clientY;
        const max = window.innerHeight * 0.6;
        const next = Math.max(MIN_TIMELINE_HEIGHT, Math.min(max, dragRef.current.startHeight + delta));
        setTimelineHeight(next);
      };
      const onUp = () => {
        if (dragRef.current) {
          try {
            localStorage.setItem(TIMELINE_HEIGHT_KEY, String(Math.round(timelineHeight)));
          } catch {
            // ignore
          }
        }
        dragRef.current = null;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [timelineHeight],
  );

  // Persist on change after pointerup
  useEffect(() => {
    if (dragRef.current) return; // skip during active drag
    try {
      localStorage.setItem(TIMELINE_HEIGHT_KEY, String(Math.round(timelineHeight)));
    } catch {
      // ignore
    }
  }, [timelineHeight]);

  if (!isDesktop) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="text-center space-y-4 max-w-md">
          <Monitor className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Editor de Video</h2>
          <p className="text-muted-foreground">
            Use um computador para acessar o editor de video. A tela precisa ter pelo menos 1024px de largura.
          </p>
          <Link
            href="/reels"
            className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
          >
            Voltar para Reels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {toolbar}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 flex items-center justify-center p-4 bg-background min-h-0 overflow-hidden">
            <div className="h-full w-full flex items-center justify-center">
              {preview}
            </div>
          </div>

          {/* 999.12 D-18: draggable resize handle */}
          <div
            onPointerDown={handleResizeStart}
            className="h-1 cursor-row-resize bg-zinc-800 hover:bg-purple-500/40 shrink-0"
          />
          <div
            className="shrink-0 overflow-auto border-t border-border"
            style={{ height: timelineHeight }}
          >
            {timeline ?? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Timeline aqui
              </div>
            )}
          </div>
        </div>

        {panelOpen && (
          <div className="w-80 border-l border-border shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Propriedades</span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            {panel ?? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Selecione uma cena
              </div>
            )}
          </div>
        )}

        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="p-2 border-l border-border hover:bg-accent text-muted-foreground self-start mt-2"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
