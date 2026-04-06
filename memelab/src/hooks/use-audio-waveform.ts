"use client";

import { useEffect, useState, useRef } from "react";

interface WaveformData {
  peaks: number[]; // normalized 0-1 amplitude values
  duration: number; // seconds
}

const cache = new Map<string, WaveformData>();

export function useAudioWaveform(audioUrl: string | undefined, numSamples: number = 200): WaveformData | null {
  const [data, setData] = useState<WaveformData | null>(null);
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!audioUrl) return;

    // Check cache
    const cacheKey = `${audioUrl}:${numSamples}`;
    if (cache.has(cacheKey)) {
      setData(cache.get(cacheKey)!);
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
      .then((buffer) => {
        const ctx = new AudioContext();
        return ctx.decodeAudioData(buffer).then((decoded) => {
          ctx.close();
          return decoded;
        });
      })
      .then((decoded) => {
        if (controller.signal.aborted) return;
        const channelData = decoded.getChannelData(0);
        const samplesPerPeak = Math.max(1, Math.floor(channelData.length / numSamples));
        const peaks: number[] = [];
        for (let i = 0; i < numSamples; i++) {
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);
          let max = 0;
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          peaks.push(max);
        }
        // Normalize
        const peakMax = Math.max(...peaks, 0.01);
        const normalized = peaks.map((p) => p / peakMax);
        const result: WaveformData = { peaks: normalized, duration: decoded.duration };
        cache.set(cacheKey, result);
        setData(result);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [audioUrl, numSamples]);

  return data;
}
