"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useAdSteps, useAdJob } from "@/hooks/use-ads";
import { executeAdStep, approveAdStep, regenerateAdStep } from "@/lib/api";
import { AdStepper, AdStepContent, ADS_STEP_ORDER, getStepStatus } from "@/components/ads/stepper";
import { Button } from "@/components/ui/button";
import type { AdStepData } from "@/lib/api";
import { StepAnalysis } from "@/components/ads/step-analysis";
import { StepScene } from "@/components/ads/step-scene";
import { StepPrompt } from "@/components/ads/step-prompt";
import { StepVideo } from "@/components/ads/step-video";
import { StepCopy } from "@/components/ads/step-copy";
import { StepAudio } from "@/components/ads/step-audio";
import { StepAssembly } from "@/components/ads/step-assembly";
import { StepExport } from "@/components/ads/step-export";

function StepperSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
        <div className="h-6 w-32 rounded bg-secondary animate-pulse" />
      </div>
      <div className="flex items-center justify-center gap-1 py-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <div className="h-0.5 w-6 mx-0.5 bg-border" />}
            <div className="w-9 h-9 rounded-full bg-secondary animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-48 rounded bg-secondary animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-secondary/50 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-secondary/50 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Steps where user should configure before executing (don't auto-run)
const MANUAL_STEPS = new Set(["scene", "prompt"]);

export default function AdJobPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const { data, error, isLoading, mutate } = useAdSteps(jobId);
  const { data: jobData, isLoading: jobLoading } = useAdJob(jobId);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewingStep, setViewingStep] = useState<string | null>(null);
  const autoStarted = useRef(false);

  // Auto-start first step if all steps are pending (new draft)
  // Skip for v2 jobs — they run the pipeline in background automatically
  useEffect(() => {
    if (!data || autoStarted.current) return;
    if ((data as any).pipeline_version === 2) return;
    const allPending = data.steps.every((s) => s.status === "pending");
    if (allPending && data.steps.length > 0) {
      autoStarted.current = true;
      handleExecuteStep(data.steps[0].step_name);
    }
  }, [data]);

  // Sync viewingStep with current step when data changes
  useEffect(() => {
    if (!data) return;
    // Only auto-navigate if not viewing a specific step
    if (!viewingStep) return;
    // If the step we're viewing just completed, stay on it
  }, [data]);

  if (isLoading || !data) return <StepperSkeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/ads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400">Ad nao encontrado ou erro ao carregar.</p>
        </div>
      </div>
    );
  }

  const pipelineVersion = jobData?.pipeline_version ?? (data as any)?.pipeline_version ?? 1;
  const jobStatus = jobData?.status ?? "pending";
  const jobOutputs = (jobData as any)?.outputs as Record<string, string> | undefined;

  // V2 jobs: show pipeline status with real-time polling via useAdJob
  if (pipelineVersion === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/ads">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Video Ad</h1>
            <p className="text-muted-foreground">
              Pipeline v2 — {jobData?.product_name ?? "multi-scene cinematico"}
            </p>
          </div>
        </div>

        {jobStatus === "processing" || jobStatus === "pending" ? (
          <div className="rounded-lg border bg-card p-12 flex flex-col items-center gap-4">
            <div className="relative">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/10 animate-ping" />
            </div>
            <p className="text-sm font-medium">Gerando video cinematico...</p>
            <p className="text-xs text-muted-foreground">
              Storyboard, geracao de cenas, composicao e audio. Pode levar 3-8 minutos.
            </p>
            <p className="text-[10px] text-muted-foreground/50">Atualizando automaticamente...</p>
          </div>
        ) : jobStatus === "error" || jobStatus === "failed" ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 space-y-2">
            <p className="text-red-400 font-medium">Erro na geracao</p>
            <p className="text-red-400/70 text-sm">
              {(jobData as any)?.error_message || "O pipeline encontrou um erro. Tente criar um novo ad."}
            </p>
            <Link href="/ads/new">
              <Button variant="outline" size="sm" className="mt-2">Criar novo ad</Button>
            </Link>
          </div>
        ) : jobStatus === "complete" ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-3">
              <p className="text-emerald-400 font-medium">Video gerado com sucesso!</p>
              {jobOutputs?.composed_video && (
                <video
                  src={`/api/ads/${jobId}/file/${jobOutputs.composed_video.split("/").pop()}`}
                  controls
                  autoPlay
                  muted
                  className="w-full max-w-lg rounded-lg border border-border"
                />
              )}
              {jobOutputs && !jobOutputs.composed_video && (
                <div className="space-y-2">
                  {Object.entries(jobOutputs).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="text-foreground truncate">{String(val).split("/").pop()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link href="/ads/new">
              <Button variant="outline" size="sm">Criar outro ad</Button>
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  const steps = data.steps ?? [];
  const currentStepName = data.current_step;
  const stepsMap: Record<string, AdStepData> = {};
  for (const s of steps) stepsMap[s.step_name] = s;

  // What the user is looking at (can be different from pipeline's current step)
  const activeView = viewingStep || currentStepName;
  const activeViewIndex = ADS_STEP_ORDER.indexOf(activeView);
  const activeStepData = stepsMap[activeView];
  const activeStatus = activeStepData?.status || "pending";

  // Navigation helpers
  const canGoPrev = activeViewIndex > 0;
  const prevStepId = canGoPrev ? ADS_STEP_ORDER[activeViewIndex - 1] : null;
  const nextStepId = activeViewIndex < ADS_STEP_ORDER.length - 1 ? ADS_STEP_ORDER[activeViewIndex + 1] : null;
  const nextStepData = nextStepId ? stepsMap[nextStepId] : null;
  const canGoNext = nextStepId && getStepStatus(nextStepId, currentStepName, stepsMap) !== "pending";

  async function handleExecuteStep(stepName: string, params?: Record<string, unknown>) {
    // Guard: prevent duplicate calls while already loading
    if (actionLoading) return;
    setActionLoading("execute");
    try {
      await executeAdStep(jobId, stepName, params);
      setViewingStep(stepName);
      mutate();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(stepName: string) {
    if (actionLoading) return;
    setActionLoading("approve");
    try {
      await approveAdStep(jobId, stepName);
      const nextIdx = ADS_STEP_ORDER.indexOf(stepName) + 1;
      if (nextIdx < ADS_STEP_ORDER.length) {
        const next = ADS_STEP_ORDER[nextIdx];
        if (!MANUAL_STEPS.has(next)) {
          await executeAdStep(jobId, next);
        }
        setViewingStep(next);
      }
      mutate();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRegenerate(stepName: string, overrides?: { video_model?: string; target_duration?: string; audio_mode?: string }) {
    if (actionLoading) return;
    setActionLoading("regenerate");
    try {
      await regenerateAdStep(jobId, stepName, overrides);
      setViewingStep(stepName);
      mutate();
    } finally {
      setActionLoading(null);
    }
  }

  function handleStepClick(stepId: string) {
    setViewingStep(stepId);
  }

  const analysisStep = stepsMap["analysis"];
  const analysisNiche =
    (analysisStep?.status === "approved" || analysisStep?.status === "complete")
      ? ((analysisStep.result as Record<string, unknown> | undefined)?.niche as string) ?? ""
      : "";

  function renderStepContent() {
    // Common props for all steps
    const props = {
      stepState: activeStepData ?? { step_name: activeView, status: "pending" as const },
      onApprove: () => handleApprove(activeView),
      onRegenerate: (overrides?: { video_model?: string; target_duration?: string }) => handleRegenerate(activeView, overrides),
      jobId,
    };

    switch (activeView) {
      case "analysis":
        return <StepAnalysis {...props} />;
      case "scene":
        return <StepScene {...props} niche={analysisNiche} onExecute={(params) => handleExecuteStep("scene", params)} />;
      case "prompt":
        return <StepPrompt {...props} niche={analysisNiche} onExecute={() => handleExecuteStep("prompt")} />;
      case "video":
        return <StepVideo
          {...props}
          onRegenerate={(overrides) => handleRegenerate("video", overrides)}
          onRetry={() => handleExecuteStep("video")}
        />;
      case "copy":
        return <StepCopy {...props} />;
      case "audio":
        return <StepAudio {...props} />;
      case "assembly":
        return <StepAssembly {...props} />;
      case "export":
        return <StepExport {...props} />;
      default:
        return null;
    }
  }

  // For pending non-manual steps that aren't the pipeline's current, show execute button
  const showExecuteButton = activeStatus === "pending" && !MANUAL_STEPS.has(activeView);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/ads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Product Ad</h1>
        {actionLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />
        )}
      </div>

      {/* Stepper — now clickable */}
      <AdStepper
        currentStep={currentStepName}
        steps={steps}
        viewingStep={activeView}
        onStepClick={handleStepClick}
      />

      {/* Step content */}
      <AdStepContent currentStep={activeViewIndex}>
        {showExecuteButton ? (
          <div className="rounded-lg border bg-card p-8 text-center space-y-4">
            <p className="text-muted-foreground">
              Passo <span className="text-foreground font-medium">{activeView}</span> aguardando execucao.
            </p>
            <Button
              onClick={() => handleExecuteStep(activeView)}
              disabled={actionLoading === "execute"}
            >
              {actionLoading === "execute" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Executar Passo
            </Button>
          </div>
        ) : (
          renderStepContent()
        )}
      </AdStepContent>

      {/* Navigation bar */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrev}
          onClick={() => prevStepId && setViewingStep(prevStepId)}
        >
          <ArrowLeft className="mr-1 h-3 w-3" /> Anterior
        </Button>

        <span className="text-xs text-muted-foreground">
          {activeViewIndex + 1} / {ADS_STEP_ORDER.length}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => nextStepId && setViewingStep(nextStepId)}
        >
          Proximo <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
