"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { useSelectedScene, useSelectedSubtitle } from "@/hooks/use-editor";
import { regenerateStep } from "@/lib/api";
import { EDITOR_FPS } from "@/stores/editor-types";
import type { EditorScene } from "@/stores/editor-types";

const VOICE_OPTIONS = [
  "Puck", "Aoede", "Charon", "Fenrir", "Kore", "Leda", "Orus", "Zephyr",
];

const TRANSITION_TYPES = [
  { value: "none", label: "Nenhuma" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "wipe", label: "Wipe" },
  { value: "flip", label: "Flip" },
] as const;

const FONT_OPTIONS = ["Inter", "Roboto", "Montserrat", "Open Sans"];

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border pb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-sm font-medium text-foreground hover:text-foreground/80"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open && <div className="mt-2 space-y-3">{children}</div>}
    </div>
  );
}

function SliderField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs tabular-nums text-foreground">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-purple-500 h-1.5"
      />
    </div>
  );
}

function ScenePanel({ jobId }: { jobId: string }) {
  const scene = useSelectedScene();
  const trimScene = useEditorStore((s) => s.trimScene);
  const setTransition = useEditorStore((s) => s.setTransition);
  const scenes = useEditorStore((s) => s.scenes);
  const [regenNarration, setRegenNarration] = useState(false);
  const [regenClip, setRegenClip] = useState(false);

  if (!scene) return null;

  const durationSec = parseFloat((scene.durationInFrames / EDITOR_FPS).toFixed(1));
  const transitionDurationSec = parseFloat((scene.transition.durationFrames / EDITOR_FPS).toFixed(1));

  const handleUpdateVoice = (voice: string) => {
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, voiceConfig: { ...s.voiceConfig, voice } } : s
      ),
    }));
  };

  const handleUpdateSpeed = (speed: number) => {
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, voiceConfig: { ...s.voiceConfig, speed } } : s
      ),
    }));
  };

  const handleRegenNarration = async () => {
    setRegenNarration(true);
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, status: "regenerating" as const } : s
      ),
    }));
    try {
      await regenerateStep(jobId, "tts");
    } finally {
      setRegenNarration(false);
      useEditorStore.setState((state) => ({
        scenes: state.scenes.map((s) =>
          s.id === scene.id ? { ...s, status: "ready" as const } : s
        ),
      }));
    }
  };

  const handleRegenClip = async () => {
    setRegenClip(true);
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, status: "regenerating" as const } : s
      ),
    }));
    try {
      await regenerateStep(jobId, "clips");
    } finally {
      setRegenClip(false);
      useEditorStore.setState((state) => ({
        scenes: state.scenes.map((s) =>
          s.id === scene.id ? { ...s, status: "ready" as const } : s
        ),
      }));
    }
  };

  return (
    <div className="space-y-3">
      <Section title={`Cena ${scene.index + 1}`}>
        <SliderField
          label="Duracao"
          value={durationSec}
          min={0.5}
          max={15}
          step={0.1}
          unit="s"
          onChange={(v) => trimScene(scene.id, Math.round(v * EDITOR_FPS))}
        />
        {scene.narration && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Narracao</label>
            <p className="text-xs text-foreground/80 bg-zinc-900 rounded p-2 leading-relaxed">
              {scene.narration}
            </p>
          </div>
        )}
      </Section>

      <Section title="Transicao">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <select
            value={scene.transition.type}
            onChange={(e) => setTransition(scene.id, e.target.value as EditorScene["transition"]["type"], scene.transition.durationFrames)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TRANSITION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {scene.transition.type !== "none" && (
          <SliderField
            label="Duracao"
            value={transitionDurationSec}
            min={0.1}
            max={2}
            step={0.1}
            unit="s"
            onChange={(v) => setTransition(scene.id, scene.transition.type, Math.round(v * EDITOR_FPS))}
          />
        )}
      </Section>

      <Section title="Voz / Narracao">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Voz</label>
          <select
            value={scene.voiceConfig.voice}
            onChange={(e) => handleUpdateVoice(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
        <SliderField
          label="Velocidade"
          value={scene.voiceConfig.speed}
          min={0.5}
          max={2.0}
          step={0.1}
          unit="x"
          onChange={handleUpdateSpeed}
        />
      </Section>

      <Section title="Acoes">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleRegenNarration}
            disabled={regenNarration || scenes.length === 0}
            className="flex items-center justify-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenNarration ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerar Narracao
          </button>
          <button
            type="button"
            onClick={handleRegenClip}
            disabled={regenClip || scenes.length === 0}
            className="flex items-center justify-center gap-2 rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regenClip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerar Clip
          </button>
        </div>
      </Section>
    </div>
  );
}

function SubtitlePanel() {
  const subtitle = useSelectedSubtitle();
  const updateSubtitle = useEditorStore((s) => s.updateSubtitle);

  if (!subtitle) return null;

  const startSec = parseFloat((subtitle.startFrame / EDITOR_FPS).toFixed(2));
  const endSec = parseFloat((subtitle.endFrame / EDITOR_FPS).toFixed(2));

  return (
    <div className="space-y-3">
      <Section title="Legenda">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Texto</label>
          <textarea
            value={subtitle.text}
            onChange={(e) => updateSubtitle(subtitle.id, { text: e.target.value })}
            rows={3}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Inicio (s)</label>
            <input
              type="number"
              value={startSec}
              min={0}
              step={0.1}
              onChange={(e) => updateSubtitle(subtitle.id, { startFrame: Math.round(parseFloat(e.target.value) * EDITOR_FPS) })}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Fim (s)</label>
            <input
              type="number"
              value={endSec}
              min={0}
              step={0.1}
              onChange={(e) => updateSubtitle(subtitle.id, { endFrame: Math.round(parseFloat(e.target.value) * EDITOR_FPS) })}
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </Section>

      <Section title="Estilo">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fonte</label>
          <select
            value={subtitle.style.fontFamily}
            onChange={(e) => updateSubtitle(subtitle.id, { style: { ...subtitle.style, fontFamily: e.target.value } })}
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <SliderField
          label="Tamanho"
          value={subtitle.style.fontSize}
          min={24}
          max={96}
          step={2}
          unit="px"
          onChange={(v) => updateSubtitle(subtitle.id, { style: { ...subtitle.style, fontSize: v } })}
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cor do Texto</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={subtitle.style.color}
                onChange={(e) => updateSubtitle(subtitle.id, { style: { ...subtitle.style, color: e.target.value } })}
                className="h-8 w-8 rounded border border-input cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">{subtitle.style.color}</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Cor da Sombra</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={subtitle.style.shadowColor}
                onChange={(e) => updateSubtitle(subtitle.id, { style: { ...subtitle.style, shadowColor: e.target.value } })}
                className="h-8 w-8 rounded border border-input cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">{subtitle.style.shadowColor}</span>
            </div>
          </div>
        </div>
        <SliderField
          label="Sombra"
          value={subtitle.style.shadowSize}
          min={0}
          max={10}
          step={1}
          unit="px"
          onChange={(v) => updateSubtitle(subtitle.id, { style: { ...subtitle.style, shadowSize: v } })}
        />
      </Section>

      <Section title="Posicao">
        <SliderField
          label="Horizontal (X)"
          value={subtitle.position.x}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => updateSubtitle(subtitle.id, { position: { ...subtitle.position, x: v } })}
        />
        <SliderField
          label="Vertical (Y)"
          value={subtitle.position.y}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => updateSubtitle(subtitle.id, { position: { ...subtitle.position, y: v } })}
        />
      </Section>
    </div>
  );
}

// 999.12 D-09: per-clip volume control for selected audio item
function AudioPanel() {
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);
  const audioItem = useEditorStore((s) =>
    selectedAudioId ? s.audioItems.find((a) => a.id === selectedAudioId) : undefined,
  );
  const setAudioVolume = useEditorStore((s) => s.setAudioVolume);

  if (!audioItem) return null;
  const volumePct = Math.round((audioItem.volume ?? 1) * 100);

  return (
    <Section title="Volume">
      <SliderField
        label="Volume"
        value={volumePct}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v) => setAudioVolume(audioItem.id, v / 100)}
      />
    </Section>
  );
}

interface PropertiesPanelProps {
  jobId: string;
}

export function PropertiesPanel({ jobId }: PropertiesPanelProps) {
  const scene = useSelectedScene();
  const subtitle = useSelectedSubtitle();
  // 999.12 D-01: surface multi-select state
  const selection = useEditorStore((s) => s.selection);
  const bulkDeleteSelected = useEditorStore((s) => s.bulkDeleteSelected);
  const bulkDuplicateSelected = useEditorStore((s) => s.bulkDuplicateSelected);

  // 999.12 D-01: when more than 1 item is selected, show a compact summary
  // instead of the per-item editor (which only fits one).
  if (selection.size > 1) {
    let scenes = 0;
    let subs = 0;
    let audio = 0;
    for (const key of selection) {
      const colonIdx = key.indexOf(":");
      if (colonIdx === -1) continue;
      const kind = key.slice(0, colonIdx);
      if (kind === "scene") scenes++;
      else if (kind === "subtitle") subs++;
      else if (kind === "audio") audio++;
    }
    const parts: string[] = [];
    if (scenes) parts.push(`${scenes} cena${scenes > 1 ? "s" : ""}`);
    if (subs) parts.push(`${subs} legenda${subs > 1 ? "s" : ""}`);
    if (audio) parts.push(`${audio} audio${audio > 1 ? "s" : ""}`);
    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-foreground">
          {selection.size} itens selecionados
          <span className="block text-xs text-muted-foreground mt-0.5">
            {parts.join(" · ")}
          </span>
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => bulkDuplicateSelected()}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-card/80"
          >
            Duplicar todos (Cmd+D)
          </button>
          <button
            type="button"
            onClick={() => bulkDeleteSelected()}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
          >
            Excluir todos (Delete)
          </button>
        </div>
      </div>
    );
  }

  // 999.12 D-09: when only an audio item is selected, show AudioPanel
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);
  if (!scene && !subtitle && selectedAudioId) {
    return (
      <div className="p-4 space-y-4">
        <AudioPanel />
      </div>
    );
  }

  if (!scene && !subtitle) {
    return (
      <div className="flex items-center justify-center h-40 p-4">
        <p className="text-sm text-muted-foreground text-center">
          Selecione uma cena ou legenda para editar
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {scene && <ScenePanel jobId={jobId} />}
      {subtitle && <SubtitlePanel />}
    </div>
  );
}
