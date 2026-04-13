"use client";

import { Film } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface SeedanceShot {
  subject: string;
  cameraMove: string;
  duration: number;
  transition: string;
}

interface SeedanceConfigProps {
  shotCount: number;
  onShotCountChange: (count: number) => void;
  preset: string;
  onPresetChange: (preset: string) => void;
  shots: SeedanceShot[];
  onShotsChange: (shots: SeedanceShot[]) => void;
  heroImageUrl?: string;
}

// IMPORTANT: camera_move values MUST match TakeConfig.camera_move Literal in src/product_studio/models.py
const CAMERA_MOVES = [
  { value: "static", label: "Static" },
  { value: "dolly_in", label: "Dolly In" },
  { value: "dolly_out", label: "Dolly Out" },
  { value: "dolly", label: "Dolly" },
  { value: "orbit", label: "Orbit" },
  { value: "crane", label: "Crane" },
  { value: "macro_zoom", label: "Macro Zoom" },
  { value: "static_macro", label: "Static Macro" },
  { value: "push_in", label: "Push In" },
  { value: "tilt_up", label: "Tilt Up" },
  { value: "pull_back", label: "Pull Back" },
  { value: "product_rotate", label: "Product Rotate" },
];

const TRANSITIONS = [
  { value: "cut", label: "Cut" },
  { value: "dissolve", label: "Dissolve" },
  { value: "fade", label: "Fade" },
  { value: "wipeleft", label: "Wipe Left" },
  { value: "fadeblack", label: "Fade Black" },
];

const PRESETS = [
  { value: "product", label: "Product Showcase" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "dynamic", label: "Dynamic" },
  { value: "custom", label: "Custom" },
];

function generatePresetShots(preset: string, count: number): SeedanceShot[] {
  const presetConfigs: Record<string, Partial<SeedanceShot>[]> = {
    product: [
      { cameraMove: "static", transition: "dissolve" },
      { cameraMove: "dolly_in", transition: "dissolve" },
      { cameraMove: "orbit", transition: "fade" },
      { cameraMove: "crane", transition: "dissolve" },
    ],
    lifestyle: [
      { cameraMove: "crane", transition: "dissolve" },
      { cameraMove: "static", transition: "dissolve" },
      { cameraMove: "dolly_out", transition: "fade" },
      { cameraMove: "pull_back", transition: "dissolve" },
    ],
    dynamic: [
      { cameraMove: "push_in", transition: "cut" },
      { cameraMove: "orbit", transition: "cut" },
      { cameraMove: "dolly_in", transition: "fade" },
      { cameraMove: "crane", transition: "cut" },
    ],
  };
  const configs = presetConfigs[preset] ?? [];
  return Array.from({ length: count }, (_, i) => ({
    subject: "",
    cameraMove: configs[i % configs.length]?.cameraMove ?? "static",
    duration: 4,
    transition: configs[i % configs.length]?.transition ?? "dissolve",
  }));
}

export function SeedanceConfig({
  shotCount,
  onShotCountChange,
  preset,
  onPresetChange,
  shots,
  onShotsChange,
  heroImageUrl,
}: SeedanceConfigProps) {
  const updateShot = (idx: number, field: keyof SeedanceShot, value: string | number) => {
    const updated = [...shots];
    updated[idx] = { ...updated[idx], [field]: value };
    onShotsChange(updated);
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Film className="h-4 w-4" /> Seedance Multi-Shot
        </h3>
        {heroImageUrl && (
          <span className="text-[10px] text-muted-foreground">@Image1 = hero</span>
        )}
      </div>

      {/* Shot count + Preset row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Shots</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={2}
              max={4}
              value={shotCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                onShotCountChange(n);
                const updated = [...shots];
                while (updated.length < n)
                  updated.push({ subject: "", cameraMove: "static", duration: 4, transition: "dissolve" });
                onShotsChange(updated.slice(0, n));
              }}
              className="flex-1"
            />
            <span className="text-sm font-mono w-4">{shotCount}</span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Preset</label>
          <Select
            value={preset}
            onValueChange={(v) => {
              onPresetChange(v);
              if (v !== "custom") {
                onShotsChange(generatePresetShots(v, shotCount));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Per-shot cards */}
      <div className="space-y-3">
        {shots.map((shot, idx) => (
          <div key={idx} className="rounded border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Shot {idx + 1}</p>
            <Textarea
              placeholder="Subject description (what's in this shot)..."
              value={shot.subject}
              onChange={(e) => updateShot(idx, "subject", e.target.value)}
              rows={2}
              className="text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <Select value={shot.cameraMove} onValueChange={(v) => updateShot(idx, "cameraMove", v)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMERA_MOVES.map((cm) => (
                    <SelectItem key={cm.value} value={cm.value}>
                      {cm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(shot.duration)} onValueChange={(v) => updateShot(idx, "duration", Number(v))}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4s</SelectItem>
                  <SelectItem value="8">8s</SelectItem>
                </SelectContent>
              </Select>
              {idx < shots.length - 1 && (
                <Select value={shot.transition} onValueChange={(v) => updateShot(idx, "transition", v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSITIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
