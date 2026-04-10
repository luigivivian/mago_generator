"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface BibleConfigState {
  scriptMode: "ai" | "manual";
  storyKey: string;
  storyRef: string;
  includeReflection: boolean;
  manualText: string;
}

interface BibleConfigProps {
  language: string;
  onConfigChange: (config: BibleConfigState) => void;
  onStorySelect?: (title: string, ref: string) => void;
}

const BIBLE_STORIES_LIST = [
  { key: "creation", ref: "Genesis 1-2", titlePt: "A Criacao", testament: "OT" },
  { key: "adam-eve", ref: "Genesis 3", titlePt: "Adao e Eva", testament: "OT" },
  { key: "noah-ark", ref: "Genesis 6-9", titlePt: "A Arca de Noe", testament: "OT" },
  { key: "abraham-isaac", ref: "Genesis 22", titlePt: "Abraao e Isaque", testament: "OT" },
  { key: "joseph-egypt", ref: "Genesis 37-50", titlePt: "Jose do Egito", testament: "OT" },
  { key: "moses-red-sea", ref: "Exodus 14", titlePt: "Moises e o Mar Vermelho", testament: "OT" },
  { key: "ten-commandments", ref: "Exodus 20", titlePt: "Os Dez Mandamentos", testament: "OT" },
  { key: "david-goliath", ref: "1 Samuel 17", titlePt: "Davi e Golias", testament: "OT" },
  { key: "daniel-lions", ref: "Daniel 6", titlePt: "Daniel na Cova dos Leoes", testament: "OT" },
  { key: "jonah-whale", ref: "Jonah 1-4", titlePt: "Jonas e a Baleia", testament: "OT" },
  { key: "ruth-naomi", ref: "Ruth 1-4", titlePt: "Rute e Noemi", testament: "OT" },
  { key: "esther-queen", ref: "Esther 1-10", titlePt: "Ester, a Rainha", testament: "OT" },
  { key: "elijah-prophets", ref: "1 Kings 18", titlePt: "Elias e os Profetas de Baal", testament: "OT" },
  { key: "samson-delilah", ref: "Judges 16", titlePt: "Sansao e Dalila", testament: "OT" },
  { key: "birth-jesus", ref: "Luke 2", titlePt: "O Nascimento de Jesus", testament: "NT" },
  { key: "good-samaritan", ref: "Luke 10:25-37", titlePt: "O Bom Samaritano", testament: "NT" },
  { key: "prodigal-son", ref: "Luke 15:11-32", titlePt: "O Filho Prodigo", testament: "NT" },
  { key: "sower-parable", ref: "Matthew 13:1-23", titlePt: "Parabola do Semeador", testament: "NT" },
  { key: "sermon-mount", ref: "Matthew 5-7", titlePt: "Sermao da Montanha", testament: "NT" },
  { key: "water-wine", ref: "John 2:1-11", titlePt: "Agua em Vinho", testament: "NT" },
  { key: "feeding-5000", ref: "John 6:1-14", titlePt: "Alimentacao dos 5000", testament: "NT" },
  { key: "walking-water", ref: "Matthew 14:22-33", titlePt: "Jesus Anda sobre as Aguas", testament: "NT" },
  { key: "lazarus", ref: "John 11:1-44", titlePt: "Ressurreicao de Lazaro", testament: "NT" },
  { key: "passion-resurrection", ref: "Matthew 26-28", titlePt: "Paixao e Ressurreicao", testament: "NT" },
  { key: "mustard-seed", ref: "Matthew 13:31-32", titlePt: "Parabola do Grao de Mostarda", testament: "NT" },
] as const;

const OT_STORIES = BIBLE_STORIES_LIST.filter((s) => s.testament === "OT");
const NT_STORIES = BIBLE_STORIES_LIST.filter((s) => s.testament === "NT");

export function BibleConfig({ language, onConfigChange, onStorySelect }: BibleConfigProps) {
  const [scriptMode, setScriptMode] = useState<"ai" | "manual">("ai");
  const [storyKey, setStoryKey] = useState("");
  const [storyRef, setStoryRef] = useState("");
  const [includeReflection, setIncludeReflection] = useState(true);
  const [manualText, setManualText] = useState("");

  useEffect(() => {
    onConfigChange({ scriptMode, storyKey, storyRef, includeReflection, manualText });
  }, [scriptMode, storyKey, storyRef, includeReflection, manualText]);

  return (
    <div className="space-y-3 animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground">Configuracao Biblica</h3>

      {/* Script mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScriptMode("ai")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
            scriptMode === "ai"
              ? "bg-primary/20 text-primary/80 border-primary/40"
              : "bg-secondary text-muted-foreground border-border"
          }`}
        >
          Gerar com IA
        </button>
        <button
          type="button"
          onClick={() => setScriptMode("manual")}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
            scriptMode === "manual"
              ? "bg-primary/20 text-primary/80 border-primary/40"
              : "bg-secondary text-muted-foreground border-border"
          }`}
        >
          Roteiro Manual
        </button>
      </div>

      {/* Conditional content */}
      {scriptMode === "ai" ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Historia Biblica</label>
            <Select value={storyKey} onValueChange={(key) => {
              setStoryKey(key);
              const story = BIBLE_STORIES_LIST.find((s) => s.key === key);
              if (story) {
                setStoryRef(story.ref);
                onStorySelect?.(story.titlePt, story.ref);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar historia" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Antigo Testamento</SelectLabel>
                  {OT_STORIES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.titlePt} — {s.ref}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Novo Testamento</SelectLabel>
                  {NT_STORIES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.titlePt} — {s.ref}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Referencia biblica livre</label>
            <Input
              placeholder="Ex: Genesis 22, Parabola do semeador"
              value={storyRef}
              onChange={(e) => setStoryRef(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <Textarea
          placeholder="Cole ou digite o roteiro completo da historia biblica..."
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={8}
        />
      )}

      {/* Reflection toggle */}
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={includeReflection}
          onChange={(e) => setIncludeReflection(e.target.checked)}
          className="accent-primary h-4 w-4 mt-0.5"
        />
        <div>
          <span className="text-sm">Incluir reflexao moderna</span>
          <p className="text-xs text-muted-foreground">
            Adiciona reflexao conectando a historia com a vida atual
          </p>
        </div>
      </label>
    </div>
  );
}
