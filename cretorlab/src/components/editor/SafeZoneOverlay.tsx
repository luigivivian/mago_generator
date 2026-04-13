"use client";

// 999.12 D-11, D-12: safe-zone overlay for TikTok/Instagram UI danger
// areas. Rendered on top of the preview, never blocks clicks. State
// persisted in localStorage so it sticks across reloads.

import { useEffect, useState } from "react";

export type SafePlatform = "off" | "tiktok" | "instagram";
const STORAGE_KEY = "cretorlab.editor.safezone";

// Zones as fractions of the 1080x1920 reference frame.
// Approximated from CapCut/Reels safe-area overlays.
const ZONES: Record<Exclude<SafePlatform, "off">, { top: number; bottom: number; right: number }> = {
  tiktok: { top: 220 / 1920, bottom: 240 / 1920, right: 80 / 1080 },
  instagram: { top: 130 / 1920, bottom: 175 / 1920, right: 70 / 1080 },
};

export function useSafePlatform() {
  const [platform, setPlatform] = useState<SafePlatform>("off");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "off" || stored === "tiktok" || stored === "instagram") {
      setPlatform(stored);
    }
  }, []);

  const update = (p: SafePlatform) => {
    setPlatform(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      // ignore quota / private-mode failures
    }
  };

  return [platform, update] as const;
}

export function SafeZoneOverlay({ platform }: { platform: SafePlatform }) {
  if (platform === "off") return null;
  const z = ZONES[platform];
  const zoneStyle: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    border: "1px dashed rgba(239, 68, 68, 0.6)",
    pointerEvents: "none",
  };
  return (
    <div className="pointer-events-none absolute inset-0">
      <div style={{ ...zoneStyle, top: 0, left: 0, right: 0, height: `${z.top * 100}%` }} />
      <div style={{ ...zoneStyle, bottom: 0, left: 0, right: 0, height: `${z.bottom * 100}%` }} />
      <div style={{ ...zoneStyle, top: 0, bottom: 0, right: 0, width: `${z.right * 100}%` }} />
    </div>
  );
}
