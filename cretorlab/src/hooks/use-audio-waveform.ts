"use client";

import { useEffect, useState, useRef } from "react";

interface WaveformData {
  peaks: number[]; // normalized 0-1 amplitude values
  duration: number; // seconds
}

// Singleton AudioContext — one per tab, never closed (D-08)
let sharedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
  }
  return sharedCtx;
}

// Raw cache keyed by `${audioUrl}::${versionKey}` so that TTS regeneration
// (which keeps the URL stable but changes the file bytes) busts the cache
// instead of replaying the stale waveform forever.
const rawCache = new Map<string, { peaks: Float32Array; duration: number }>();

/**
 * Resample a Float32Array of peak amplitudes to a target count using max-in-bucket.
 * Pure function, exported for testing.
 */
export function resamplePeaks(source: Float32Array, targetCount: number): number[] {
  if (targetCount <= 0) return [];
  const result: number[] = [];
  const step = source.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(Math.floor((i + 1) * step), source.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      if (source[j] > max) max = source[j];
    }
    result.push(max);
  }
  return result;
}

export function useAudioWaveform(
  audioUrl: string | undefined,
  numSamples: number = 200,
  // Optional version key — when this changes, the cache entry is treated
  // as a different audio source and re-fetched. Pass step_state.tts.duration
  // (or any monotonic-ish value the caller knows changes when the file does).
  versionKey?: string | number,
): WaveformData | null {
  const [data, setData] = useState<WaveformData | null>(null);
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (!audioUrl) return;

    const cacheKey = `${audioUrl}::${versionKey ?? ""}`;
    const cached = rawCache.get(cacheKey);
    if (cached) {
      const peaks = resamplePeaks(cached.peaks, numSamples);
      const peakMax = Math.max(...peaks, 0.01);
      setData({ peaks: peaks.map((p) => p / peakMax), duration: cached.duration });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const token =
      typeof window !== "undefined"
        ? (localStorage.getItem("access_token") ?? sessionStorage.getItem("access_token"))
        : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    // cache: "no-cache" forces revalidation against the FastAPI file route so
    // we always read the current file bytes after a TTS regeneration, even if
    // the URL is unchanged.
    fetch(audioUrl, { headers, signal: controller.signal, cache: "no-cache" })
      .then((r) => r.arrayBuffer())
      .then((buffer) => getAudioContext().decodeAudioData(buffer))
      .then((decoded) => {
        if (controller.signal.aborted) return;
        const channelData = decoded.getChannelData(0);
        // Extract full-resolution absolute peaks
        const fullPeaks = new Float32Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          fullPeaks[i] = Math.abs(channelData[i]);
        }
        rawCache.set(cacheKey, { peaks: fullPeaks, duration: decoded.duration });

        const peaks = resamplePeaks(fullPeaks, numSamples);
        const peakMax = Math.max(...peaks, 0.01);
        setData({ peaks: peaks.map((p) => p / peakMax), duration: decoded.duration });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [audioUrl, numSamples, versionKey]);

  return data;
}
