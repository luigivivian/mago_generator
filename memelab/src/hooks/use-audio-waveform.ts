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

// Raw cache keyed by URL only — zoom changes resample cheaply without re-decode
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

export function useAudioWaveform(audioUrl: string | undefined, numSamples: number = 200): WaveformData | null {
  const [data, setData] = useState<WaveformData | null>(null);
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!audioUrl) return;

    // Cache hit — resample from raw peaks (no fetch, no decode)
    const cached = rawCache.get(audioUrl);
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

    fetch(audioUrl, { headers, signal: controller.signal })
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
        rawCache.set(audioUrl, { peaks: fullPeaks, duration: decoded.duration });

        const peaks = resamplePeaks(fullPeaks, numSamples);
        const peakMax = Math.max(...peaks, 0.01);
        setData({ peaks: peaks.map((p) => p / peakMax), duration: decoded.duration });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [audioUrl, numSamples]);

  return data;
}
