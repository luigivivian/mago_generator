"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { isSeedanceModel } from "@/lib/video-models";

interface PromptBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (prompt: string) => void;
  modelValue: string;
  sceneIndex: number;
}

const NARRATIVE_PATTERNS = [
  { value: "custom", label: "Custom" },
  { value: "unwrapping", label: "Unwrapping" },
  { value: "pour-drip", label: "Pour / Drip" },
  { value: "transformation", label: "Transformation" },
  { value: "seduction", label: "Seduction" },
  { value: "destruction-reveal", label: "Destruction / Reveal" },
  { value: "environment-build", label: "Environment Build" },
];

const STYLE_DIRECTIONS = [
  { value: "product", label: "Product Commercial" },
  { value: "action", label: "Action / Sports" },
  { value: "narrative", label: "Narrative / Cinematic" },
  { value: "fashion", label: "Fashion / Editorial" },
  { value: "music-video", label: "Music Video" },
  { value: "documentary", label: "Documentary / Raw" },
];

export function PromptBuilderModal({ open, onClose, onUsePrompt, modelValue, sceneIndex }: PromptBuilderModalProps) {
  const isSeedance = isSeedanceModel(modelValue);

  // Kling 5W1H fields
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState("");
  const [why, setWhy] = useState("");
  const [how, setHow] = useState("");
  const [negative, setNegative] = useState("");

  // Seedance narrative fields
  const [narrativePattern, setNarrativePattern] = useState("custom");
  const [styleDirection, setStyleDirection] = useState("product");
  const [act1, setAct1] = useState("");
  const [act2, setAct2] = useState("");
  const [act3, setAct3] = useState("");

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setWho(""); setWhat(""); setWhere(""); setWhen(""); setWhy(""); setHow(""); setNegative("");
      setNarrativePattern("custom"); setStyleDirection("product");
      setAct1(""); setAct2(""); setAct3("");
    }
  }, [open]);

  function assembleKlingPrompt(): string {
    const parts = [who, what, where, when, why].filter(Boolean);
    let prompt = parts.join(", ");
    if (how) prompt += `, ${how}`;
    if (negative) prompt += `. Negative: ${negative}`;
    return prompt.slice(0, 1500);
  }

  function assembleSeedancePrompt(): string {
    const parts: string[] = [];
    if (narrativePattern !== "custom") parts.push(`[${narrativePattern.toUpperCase()}]`);
    parts.push(`Style: ${styleDirection}.`);
    if (act1) parts.push(`Act 1 (Hook): ${act1}`);
    if (act2) parts.push(`Act 2 (Build): ${act2}`);
    if (act3) parts.push(`Act 3 (Payoff): ${act3}`);
    return parts.join(" ").slice(0, 2480);
  }

  const assembled = isSeedance ? assembleSeedancePrompt() : assembleKlingPrompt();
  const maxChars = isSeedance ? 2480 : 1500;
  const charCount = assembled.length;
  const defaultTab = isSeedance ? "seedance" : "kling";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Prompt Builder &mdash; Cena {sceneIndex + 1}</DialogTitle>
          <DialogDescription>
            Preencha os campos para montar um prompt otimizado para {isSeedance ? "Seedance" : "Kling"}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="kling" className="flex-1">Kling 5W1H</TabsTrigger>
            <TabsTrigger value="seedance" className="flex-1">Seedance Narrative</TabsTrigger>
          </TabsList>

          {/* Kling 5W1H Tab */}
          <TabsContent value="kling">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Who (sujeito)</label>
                <Textarea value={who} onChange={(e) => setWho(e.target.value)} rows={2} placeholder="Ex: a luxury perfume bottle with gold cap" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">What (acao)</label>
                <Textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={2} placeholder="Ex: rotating slowly on a marble pedestal" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Where (ambiente)</label>
                <Textarea value={where} onChange={(e) => setWhere(e.target.value)} rows={2} placeholder="Ex: dark studio with fog and warm backlight" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">When (tempo)</label>
                <Textarea value={when} onChange={(e) => setWhen(e.target.value)} rows={2} placeholder="Ex: golden hour, soft sunset light" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Why (emocao)</label>
                <Textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Ex: elegant, aspirational, premium feel" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">How (estilo/camera)</label>
                <Textarea value={how} onChange={(e) => setHow(e.target.value)} rows={2} placeholder="Ex: macro lens, shallow DOF, cinematic color grading" className="text-sm" />
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <label className="text-xs font-medium text-muted-foreground">Negative (evitar)</label>
              <Textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={2} placeholder="Ex: text, watermark, blurry, low quality" className="text-sm" />
            </div>
          </TabsContent>

          {/* Seedance Narrative Tab */}
          <TabsContent value="seedance">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Narrative pattern</label>
                <Select value={narrativePattern} onValueChange={setNarrativePattern}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NARRATIVE_PATTERNS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Style direction</label>
                <Select value={styleDirection} onValueChange={setStyleDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLE_DIRECTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3 mt-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Act 1 &mdash; Hook (0-4s)</label>
                <Textarea value={act1} onChange={(e) => setAct1(e.target.value)} rows={3} placeholder="Ex: Close-up of product emerging from shadow, camera dollies in slowly" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Act 2 &mdash; Escalation (4-10s)</label>
                <Textarea value={act2} onChange={(e) => setAct2(e.target.value)} rows={3} placeholder="Ex: Camera orbits as particles swirl around the product, light intensifies" className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Act 3 &mdash; Payoff (10-15s)</label>
                <Textarea value={act3} onChange={(e) => setAct3(e.target.value)} rows={3} placeholder="Ex: Wide reveal shot showing product in full context, hero framing" className="text-sm" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        <div className="space-y-2 border-t pt-3">
          <div className="flex justify-between text-xs">
            <span className="font-medium">Preview</span>
            <span className={charCount > maxChars * 0.9 ? "text-red-400" : "text-muted-foreground"}>
              {charCount}/{maxChars}
            </span>
          </div>
          <p className="text-sm text-muted-foreground bg-muted/50 rounded p-3 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {assembled || "Preencha os campos acima..."}
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onUsePrompt(assembled); onClose(); }} disabled={!assembled.trim() || (isSeedance && !(act1 || act2 || act3))}>
            Usar este prompt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
