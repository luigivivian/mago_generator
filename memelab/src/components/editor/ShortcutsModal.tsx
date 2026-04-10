"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { key: "Space", description: "Reproduzir / Pausar" },
  { key: "Delete", description: "Deletar item selecionado" },
  { key: "S", description: "Cortar no playhead" },
  { key: "D", description: "Duplicar cena selecionada" },
  { key: "F", description: "Congelar frame (+1s)" },
  { key: "Ctrl + Z", description: "Desfazer" },
  { key: "Ctrl + Shift + Z", description: "Refazer" },
  { key: "Ctrl + Scroll", description: "Zoom na timeline" },
  { key: "Scroll", description: "Scroll horizontal na timeline" },
  { key: "?", description: "Abrir/fechar este painel" },
];

export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.target.isContentEditable) return;
    }
    if (e.key === "?" || (e.shiftKey && e.code === "Slash")) {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.code === "Escape" && open) {
      setOpen(false);
    }
  }, [open]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <div
        className="bg-[#0f0f14] border border-white/[0.06] rounded-lg shadow-2xl w-[400px] max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-zinc-100">Atalhos do Editor</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-[#1f1f2a] text-[#8888a0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-[#f0f0f5]">{s.description}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#1a1a24] border border-white/[0.06] text-xs text-[#f0f0f5] font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-[#8888a0] text-center">
          Pressione <kbd className="px-1 py-0.5 rounded bg-[#1a1a24] border border-white/[0.06] text-[#8888a0] font-mono">?</kbd> para fechar
        </div>
      </div>
    </div>
  );
}
