import useSWR from "swr";
import * as api from "@/lib/api";

export function useReelJobs(status?: string, character_slug?: string) {
  return useSWR(
    `reel-jobs-${character_slug ?? "all"}-${status ?? "all"}`,
    () => api.getReelJobs(status, character_slug || undefined),
    { refreshInterval: 5000 }
  );
}

export function useReelStatus(jobId: string | null) {
  return useSWR(
    jobId ? `reel-status-${jobId}` : null,
    () => api.getReelStatus(jobId!),
    { refreshInterval: 2000, errorRetryCount: 1 }
  );
}

export function useReelsConfig() {
  return useSWR("reels-config", () => api.getReelsConfig());
}

export function useReelsPresets() {
  return useSWR("reels-presets", () => api.getReelsPresets());
}

export function useReelsModels() {
  return useSWR("reels-models", () => api.getReelsModels());
}

export function useStepState(jobId: string | null) {
  return useSWR(
    jobId ? `reel-step-state-${jobId}` : null,
    () => api.getStepState(jobId!),
    { refreshInterval: 2000, errorRetryCount: 1 }
  );
}
