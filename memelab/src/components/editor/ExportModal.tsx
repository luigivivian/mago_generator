"use client";

// 999.12 D-14 .. D-17: pre-export validation + polling export progress.
// Backend already writes step_state.video.export_status during the
// _export_remotion_task background task — we just poll via the
// existing useStepState SWR hook (2s refresh) and react to the field.

import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2, X, Download } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { useStepState } from "@/hooks/use-reels";
import { exportRemotion, reelFileUrl } from "@/lib/api";
import { validateEditorState, hasErrors, type ValidationIssue } from "@/lib/editor";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
}

type Stage = "validating" | "ready" | "exporting" | "done" | "failed";

export function ExportModal({ open, onClose, jobId }: ExportModalProps) {
  const scenes = useEditorStore((s) => s.scenes);
  const subtitles = useEditorStore((s) => s.subtitles);
  const audioItems = useEditorStore((s) => s.audioItems);
  const { data: stepState } = useStepState(open ? jobId : null);

  const issues = useMemo<ValidationIssue[]>(
    () => (open ? validateEditorState(scenes, subtitles, audioItems) : []),
    [open, scenes, subtitles, audioItems],
  );
  const hasErr = hasErrors(issues);

  const [stage, setStage] = useState<Stage>("validating");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Track whether we've seen "rendering" status from the backend.
  // Prevents stale cached "complete" from triggering "done" prematurely.
  const [sawRendering, setSawRendering] = useState(false);

  // Reset stage when modal opens
  useEffect(() => {
    if (open) {
      setStage("validating");
      setErrorMsg(null);
      setSawRendering(false);
    }
  }, [open]);

  // After validation runs (issues memo settles), move to ready
  useEffect(() => {
    if (open && stage === "validating") {
      setStage("ready");
    }
  }, [open, stage]);

  // Watch for backend status changes once we've kicked off an export
  useEffect(() => {
    if (stage !== "exporting" || !stepState?.video) return;
    const status = stepState.video.export_status;
    if (status === "rendering") {
      setSawRendering(true);
    }
    // Only transition to done/failed after we've confirmed the backend
    // received our request (saw "rendering" at least once).
    if (!sawRendering) return;
    if (status === "complete") {
      setStage("done");
    } else if (status === "failed") {
      setErrorMsg(stepState.video.export_error ?? "Erro desconhecido durante render");
      setStage("failed");
    }
  }, [stage, stepState, sawRendering]);

  const handleExport = async () => {
    setStage("exporting");
    setErrorMsg(null);
    setSawRendering(false);
    try {
      await exportRemotion(jobId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStage("failed");
    }
  };

  if (!open) return null;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f0f14] border border-white/[0.06] rounded-lg shadow-xl w-[480px] max-w-[95vw] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold">Exportar Video</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#1f1f2a] text-[#8888a0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {(stage === "validating" || stage === "ready") && (
            <>
              {issues.length === 0 ? (
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Tudo pronto para exportar.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {errors.map((issue, i) => (
                    <li
                      key={`e-${i}`}
                      className="flex items-start gap-2 text-xs text-red-300"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                  {warnings.map((issue, i) => (
                    <li
                      key={`w-${i}`}
                      className="flex items-start gap-2 text-xs text-amber-300"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs rounded border border-white/[0.06] hover:bg-[#1f1f2a]"
                >
                  Cancelar
                </button>
                {!hasErr && (
                  <button
                    type="button"
                    onClick={handleExport}
                    className="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 font-medium"
                  >
                    {warnings.length > 0 ? "Exportar mesmo assim" : "Exportar"}
                  </button>
                )}
              </div>
            </>
          )}

          {stage === "exporting" && (() => {
            const progress = stepState?.video?.export_progress ?? 0;
            return (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-[#f0f0f5]">Renderizando video...</p>
                <div className="w-full max-w-[300px] space-y-1">
                  <div className="h-2 rounded-full bg-[#1a1a24] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#8888a0] text-center">
                    {progress > 0 ? `${progress}%` : "Iniciando..."}
                  </p>
                </div>
              </div>
            );
          })()}

          {stage === "done" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <p className="text-sm text-[#f0f0f5]">Pronto!</p>
              {stepState?.video?.path && (
                <a
                  href={reelFileUrl(jobId, "editor-export.mp4")}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 font-medium"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar video
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-[#8888a0] hover:text-[#f0f0f5]"
              >
                Fechar
              </button>
            </div>
          )}

          {stage === "failed" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-red-300">Erro na exportacao</p>
              {errorMsg && (
                <p className="text-xs text-[#8888a0] max-w-[400px] text-center break-words">
                  {errorMsg}
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded border border-white/[0.06] hover:bg-[#1f1f2a]"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
