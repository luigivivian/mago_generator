"use client";

import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { useSelectedScene, useSelectedSubtitle } from "@/hooks/use-editor";
import { regenerateStep, patchSceneConfig } from "@/lib/api";
import { EDITOR_FPS } from "@/stores/editor-types";
import type { EditorScene } from "@/stores/editor-types";
import { loadPresets, savePresets, addPreset, renamePreset, deletePreset, type SubtitlePreset } from "@/lib/editor";

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
    patchSceneConfig(jobId, scene.index, { voice }).catch(() => {
      // Fire-and-forget — store mutation is authoritative for UX,
      // network failure is non-blocking (user will see stale on reload)
    });
  };

  const handleUpdateSpeed = (speed: number) => {
    useEditorStore.setState((state) => ({
      scenes: state.scenes.map((s) =>
        s.id === scene.id ? { ...s, voiceConfig: { ...s.voiceConfig, speed } } : s
      ),
    }));
    patchSceneConfig(jobId, scene.index, { speed }).catch(() => {
      // Fire-and-forget
    });
  };

  const handleRegenNarration = async () => {
    // 999.14 D-09 (Bug 4 unparked): warn the user that regenerating TTS
    // wipes step_state.editor on the backend (reels.py:1174-1175 pops
    // editor on tts/srt/script regen). All editor cuts/trims/subtitles
    // will be lost. Let them confirm so they don't lose work silently.
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Regenerar a narracao apaga TODAS as suas edicoes do editor (cortes de audio, trims de cena, legendas adicionadas, transicoes). O audio sera reconstruido a partir do roteiro original e usa as configuracoes de voz por cena (ou globais do job se nao configurado por cena). Continuar?",
      );
      if (!ok) return;
    }
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
    // 999.14 D-09 (Bug 4 unparked): clip regen does NOT wipe editor state
    // on the backend (only tts/srt/script do — reels.py:1174). But the
    // visual asset will change, so warn the user and let them cancel.
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Regenerar este clip vai gerar um novo arquivo de video para a cena. Suas edicoes do editor (cortes, trims, legendas) serao preservadas. Continuar?",
      );
      if (!ok) return;
    }
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
          max={20}
          step={0.1}
          unit="s"
          onChange={(v) => trimScene(scene.id, Math.round(v * EDITOR_FPS))}
        />
        {/* 999.14 D-09 (Bug 6 fix): hint that the duration slider only
            stretches/shrinks the scene visually — it does NOT trim the
            audio. Use "Cortar Inicio/Fim" in the toolbar for that. */}
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          A duracao mostra apenas o tempo visual da cena. Para cortar o
          audio junto, use os botoes "Inicio" / "Fim" na barra superior.
        </p>
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
            onChange={(e) => {
              const newType = e.target.value as EditorScene["transition"]["type"];
              // When switching from "none" to any actual transition, ensure
              // duration is non-zero so ReelComposition's render guard
              // (`durationFrames > 0`) actually emits the transition.
              // Default to 15 frames (0.5s at 30fps) — same as ContextMenu.
              const newDur = newType === "none"
                ? 0
                : scene.transition.durationFrames > 0
                  ? scene.transition.durationFrames
                  : 15;
              setTransition(scene.id, newType, newDur);
            }}
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

      <SubtitlePresetsSection
        currentStyle={subtitle.style}
        onApply={(style) => updateSubtitle(subtitle.id, { style })}
      />
    </div>
  );
}

// 999.12 D-21, D-22: subtitle style presets stored in localStorage
function SubtitlePresetsSection({
  currentStyle,
  onApply,
}: {
  currentStyle: SubtitlePreset["style"];
  onApply: (style: SubtitlePreset["style"]) => void;
}) {
  const [presets, setPresets] = useState<SubtitlePreset[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const persist = (next: SubtitlePreset[]) => {
    setPresets(next);
    savePresets(next);
  };

  const handleSave = () => {
    const next = addPreset(presets, currentStyle);
    persist(next);
  };

  const handleDelete = (id: string) => {
    persist(deletePreset(presets, id));
  };

  const handleRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) persist(renamePreset(presets, id, trimmed));
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <Section title="Presets de estilo">
      <button
        type="button"
        onClick={handleSave}
        className="w-full text-xs px-2 py-1.5 rounded border border-border hover:bg-accent"
      >
        Salvar estilo atual como preset
      </button>
      {presets.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhum preset salvo. Salve o estilo atual para reutilizar em outras legendas.
        </p>
      ) : (
        <ul className="space-y-1">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 text-xs rounded border border-border bg-card px-2 py-1"
            >
              {renamingId === p.id ? (
                <input
                  type="text"
                  value={renameValue}
                  autoFocus
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(p.id);
                    if (e.key === "Escape") {
                      setRenamingId(null);
                      setRenameValue("");
                    }
                  }}
                  className="flex-1 bg-transparent outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onApply(p.style)}
                  onDoubleClick={() => {
                    setRenamingId(p.id);
                    setRenameValue(p.name);
                  }}
                  className="flex-1 text-left truncate hover:text-purple-300"
                  title="Clique para aplicar, duplo clique para renomear"
                >
                  {p.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="text-muted-foreground hover:text-red-400 p-0.5"
                title="Excluir preset"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
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
  const startFromSec = (audioItem.startFrom ?? 0) / EDITOR_FPS;
  const durationSec = audioItem.durationInFrames / EDITOR_FPS;
  const fromSec = audioItem.from / EDITOR_FPS;

  return (
    <div className="space-y-3">
      <Section title="Audio">
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <div className="flex justify-between">
            <span>Posicao no timeline:</span>
            <span className="text-foreground tabular-nums">{fromSec.toFixed(2)}s</span>
          </div>
          <div className="flex justify-between">
            <span>Duracao:</span>
            <span className="text-foreground tabular-nums">{durationSec.toFixed(2)}s</span>
          </div>
          {startFromSec > 0 && (
            <div className="flex justify-between text-amber-300/90">
              <span>Pulando do inicio:</span>
              <span className="tabular-nums">{startFromSec.toFixed(2)}s</span>
            </div>
          )}
        </div>
        {/* 999.14 D-09 (Bug 6 fix): explain audio editing options */}
        <p className="text-[10px] text-muted-foreground/70 leading-tight">
          Arraste as bordas do bloco para trim, arraste o meio para mover.
          Use "Cortar Inicio" / "Cortar Fim" na barra superior para um corte
          que tambem ajusta as cenas.
        </p>
      </Section>
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
    </div>
  );
}

interface PropertiesPanelProps {
  jobId: string;
}

export function PropertiesPanel({ jobId }: PropertiesPanelProps) {
  // IMPORTANT: every hook in this component must be called unconditionally
  // on every render, in the same order. Do NOT move any useEditorStore /
  // useSelectedX call below an early return — doing so changes the hook
  // count between renders (e.g., single-select → multi-select) and
  // triggers "Rendered fewer hooks than expected" (Bug 8, 2026-04-08).
  const scene = useSelectedScene();
  const subtitle = useSelectedSubtitle();
  // 999.12 D-01: surface multi-select state
  const selection = useEditorStore((s) => s.selection);
  const bulkDeleteSelected = useEditorStore((s) => s.bulkDeleteSelected);
  const bulkDuplicateSelected = useEditorStore((s) => s.bulkDuplicateSelected);
  // 999.12 D-09: read selectedAudioId up here (before any early return) so
  // the hook order stays stable across single/multi-select transitions.
  const selectedAudioId = useEditorStore((s) => s.selectedAudioId);

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
