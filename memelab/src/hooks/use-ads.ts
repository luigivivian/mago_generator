import useSWR from "swr";
import * as api from "@/lib/api";

export function useAdJobs(character_slug?: string) {
  return useSWR(`ad-jobs-${character_slug ?? "all"}`, () => api.getAdJobs(character_slug || undefined), { refreshInterval: 5000 });
}

export function useAdJob(jobId: string | null) {
  return useSWR(
    jobId ? `ad-job-${jobId}` : null,
    () => api.getAdJob(jobId!),
    { refreshInterval: 3000, errorRetryCount: 1 }
  );
}

export function useAdSteps(jobId: string | null) {
  return useSWR(
    jobId ? `ad-steps-${jobId}` : null,
    () => api.getAdSteps(jobId!),
    { refreshInterval: 2000, errorRetryCount: 1 }
  );
}
