"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { X, Sun, Moon, Maximize, Minimize, Check } from "lucide-react";
import { useTheme, PALETTES, PALETTE_CATEGORIES, type ThemePalette, type PaletteCategory } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";

interface ThemeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeModal({ open, onClose }: ThemeModalProps) {
  const { mode, setMode, paletteId, setPaletteId, fullscreen, toggleFullscreen, palette: currentPalette } = useTheme();
  const [activeCategory, setActiveCategory] = useState<PaletteCategory>("core");
  const filteredPalettes = PALETTES.filter((p) => p.category === activeCategory);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-lg max-h-[90vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
                <h2 className="text-lg font-semibold">Aparencia</h2>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--color-secondary)] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-6 overflow-y-auto">
                {/* Mode toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Modo</label>
                  <div className="flex gap-2">
                    <ToggleButton active={mode === "light"} onClick={() => setMode("light")} icon={<Sun className="h-4 w-4" />} label="Light" />
                    <ToggleButton active={mode === "dark"} onClick={() => setMode("dark")} icon={<Moon className="h-4 w-4" />} label="Dark" />
                  </div>
                </div>

                {/* Theme grid with category tabs */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Tema</label>
                  {/* Category tabs */}
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {PALETTE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer",
                          activeCategory === cat.id
                            ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                            : "bg-[var(--color-secondary)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {/* Palette grid */}
                  <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                    {filteredPalettes.map((p) => (
                      <PaletteCard
                        key={p.id}
                        palette={p}
                        active={p.id === paletteId}
                        onClick={() => setPaletteId(p.id)}
                        darkMode={mode === "dark"}
                      />
                    ))}
                  </div>
                </div>

                {/* Display */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Tela</label>
                  <ToggleButton
                    active={fullscreen}
                    onClick={toggleFullscreen}
                    icon={fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    label={fullscreen ? "Sair Tela Cheia" : "Tela Cheia"}
                    fullWidth
                  />
                </div>

                {/* Live preview */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Preview</label>
                  <LivePreview palette={currentPalette} darkMode={mode === "dark"} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Palette card with multi-color swatch ─────────────────────────────

function PaletteCard({
  palette,
  active,
  onClick,
  darkMode,
}: {
  palette: ThemePalette;
  active: boolean;
  onClick: () => void;
  darkMode: boolean;
}) {
  const bg = darkMode ? "#0f0f14" : "#f0f0f5";
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left",
        "border transition-all duration-200 cursor-pointer",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/8 ring-1 ring-[var(--color-primary)]/30"
          : "border-[var(--color-border)] hover:border-[var(--color-muted-foreground)]/30 hover:bg-[var(--color-secondary)]/50"
      )}
    >
      {/* Color stack */}
      <div className="flex -space-x-1.5 shrink-0">
        <div className="h-8 w-8 rounded-lg border-2 shadow-sm z-30" style={{ backgroundColor: palette.primary, borderColor: bg }} />
        <div className="h-8 w-8 rounded-lg border-2 shadow-sm z-20" style={{ backgroundColor: palette.secondary, borderColor: bg }} />
        <div className="h-8 w-8 rounded-lg border-2 shadow-sm z-10" style={{ backgroundColor: palette.accent, borderColor: bg }} />
        <div className="h-8 w-8 rounded-lg border-2 shadow-sm z-0" style={{ backgroundColor: palette.complement, borderColor: bg }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium truncate", active && "text-[var(--color-primary)]")}>
          {palette.label}
        </p>
        {/* Micro semantic dots */}
        <div className="flex gap-1 mt-1">
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.success }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.warning }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.destructive }} />
          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.info }} />
        </div>
      </div>
      {active && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
          <Check className="h-4 w-4 text-[var(--color-primary)] shrink-0" />
        </motion.div>
      )}
    </button>
  );
}

// ── Live preview mini-UI ─────────────────────────────────────────────

function LivePreview({ palette, darkMode }: { palette: ThemePalette; darkMode: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Mini header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-secondary)]">
        <div className="h-5 w-5 rounded-md" style={{ backgroundColor: palette.primary }} />
        <div className="h-2 w-16 rounded-full" style={{ backgroundColor: palette.primary, opacity: 0.6 }} />
        <div className="ml-auto flex gap-1">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.success }} />
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.warning }} />
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.destructive }} />
        </div>
      </div>
      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Color legend */}
        <div className="grid grid-cols-4 gap-2">
          <ColorChip label="Primary" color={palette.primary} fg={palette.primaryForeground} />
          <ColorChip label="Secondary" color={palette.secondary} fg={palette.secondaryForeground} />
          <ColorChip label="Accent" color={palette.accent} fg={palette.accentForeground} />
          <ColorChip label="Complement" color={palette.complement} fg={palette.complementForeground} />
        </div>
        {/* Gradient bar */}
        <div
          className="h-2 w-full rounded-full"
          style={{ background: `linear-gradient(to right, ${palette.gradientFrom}, ${palette.gradientVia}, ${palette.gradientTo})` }}
        />
        {/* Mini buttons row */}
        <div className="flex gap-1.5">
          <div className="flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>
            Primario
          </div>
          <div className="flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: palette.secondary, color: palette.secondaryForeground }}>
            Secundario
          </div>
          <div className="flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-medium border" style={{ backgroundColor: "transparent", color: palette.accent, borderColor: palette.accent }}>
            Accent
          </div>
          <div className="flex-1 h-6 rounded-md flex items-center justify-center text-[9px] font-medium" style={{ backgroundColor: palette.complement, color: palette.complementForeground }}>
            Compl.
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorChip({ label, color, fg }: { label: string; color: string; fg: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-6 w-full rounded-md flex items-center justify-center" style={{ backgroundColor: color }}>
        <span className="text-[8px] font-bold" style={{ color: fg }}>{label.slice(0, 3).toUpperCase()}</span>
      </div>
      <span className="text-[8px] text-[var(--color-muted-foreground)]">{color}</span>
    </div>
  );
}

// ── Shared toggle button ─────────────────────────────────────────────

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  fullWidth,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium",
        "border transition-all duration-200 cursor-pointer",
        fullWidth ? "w-full" : "flex-1",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          : "border-[var(--color-border)] hover:bg-[var(--color-secondary)] text-[var(--color-foreground)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
