"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Plus, X, Loader2, Film,
  Sparkles, RotateCcw, Pencil, Trash2, Download, Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { createAdJobV2, generateScenePrompt, composePreview, generateKlingPrompt } from "@/lib/api";
import { VIDEO_MODELS, getDurations } from "@/lib/video-models";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token")
  );
}

const CATEGORIES = [
  { value: "beauty_skincare", label: "Cosmeticos & Skincare" },
  { value: "food_cookies", label: "Cookies & Biscoitos" },
  { value: "food_chocolate", label: "Chocolates & Confeitaria" },
  { value: "food_burger", label: "Hamburgueres & Fast Food" },
  { value: "fashion_shoes", label: "Tenis & Calcados" },
  { value: "tech_electronics", label: "Eletronicos & Tech" },
  { value: "beverage", label: "Bebidas & Drinks" },
  { value: "jewelry_watches", label: "Joias & Relogios" },
  { value: "candles_scented", label: "Velas & Aromatizantes" },
  { value: "supplements_bottles", label: "Suplementos & Vitaminas" },
  { value: "generic", label: "Outro produto" },
];

interface UploadedImage {
  url: string;
  selected: boolean;
  isHero: boolean;
}

interface ComposedImage {
  url: string;
  approved: boolean;
  prompt: string;
}

export default function NewAdPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Step 1: Upload
  const [images, setImages] = useState<UploadedImage[]>([]);

  // Step 2: Product info
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("generic");

  // Step 3: Composition
  const [scenePrompt, setScenePrompt] = useState("");
  const [variationCount, setVariationCount] = useState(4);
  const [composingIdx, setComposingIdx] = useState<number | null>(null);
  const [composed, setComposed] = useState<ComposedImage[]>([]);
  const [editingPromptFor, setEditingPromptFor] = useState<number | null>(null);
  const [singlePrompt, setSinglePrompt] = useState("");

  // Step 4: Video config
  const [videoModel, setVideoModel] = useState("kling-3.0/video");
  const [clipDuration, setClipDuration] = useState(5);
  const [generatingKlingFor, setGeneratingKlingFor] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState<{ url: string; idx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Global busy state — blocks all async actions and shows feedback
  type BusyState = null | "uploading" | "generating-prompt" | "composing" | "regenerating" | "submitting";
  const [busy, setBusy] = useState<BusyState>(null);
  const busyRef = useRef(false);

  const withBusy = useCallback(async (state: NonNullable<BusyState>, fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(state);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }, []);

  const isBusy = busy !== null;

  const selectedCount = images.filter((img) => img.selected).length;
  const selectedUrls = images.filter((img) => img.selected).map((img) => img.url);
  const heroImage = images.find((img) => img.isHero);
  const approvedComposed = composed.filter((c) => c.approved);

  // ── Upload ──
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    withBusy("uploading", async () => {
      const token = getAuthToken();
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
      const res = await fetch("http://127.0.0.1:8000/ads/upload-images", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed ${res.status}`);
      const data: { image_urls: string[]; count: number } = await res.json();
      setImages((prev) => [...prev, ...data.image_urls.map((url) => ({ url, selected: false, isHero: false }))]);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const toggleSelect = (idx: number) => {
    setImages((prev) =>
      prev.map((img, i) => {
        if (i !== idx) return img;
        if (!img.selected && selectedCount >= 4) return img;
        const nowSelected = !img.selected;
        return { ...img, selected: nowSelected, isHero: nowSelected ? img.isHero : false };
      })
    );
    setComposed([]);
    setScenePrompt("");
  };

  const setHero = (idx: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({ ...img, isHero: i === idx }))
    );
    setComposed([]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setComposed([]);
  };

  // ── Prompt generation ──
  const handleGeneratePrompt = () => {
    if (!productName.trim()) return;
    withBusy("generating-prompt", async () => {
      const result = await generateScenePrompt({
        product_name: productName.trim(),
        category,
      });
      setScenePrompt(result.prompt);
    });
  };

  // ── Batch compose (hero image only) ──
  const handleComposeAll = () => {
    if (!scenePrompt.trim() || !heroImage) return;
    withBusy("composing", async () => {
      const data = await composePreview({
        image_url: heroImage.url,
        prompt: scenePrompt,
        count: variationCount,
      });
      const results: ComposedImage[] = data.composed_urls.map((url) => ({
        url, approved: false, prompt: scenePrompt,
      }));
      setComposed((prev) => [...prev, ...results]);
    });
  };

  // ── Single image regen ──
  const handleRegenSingle = (compIdx: number, customPrompt?: string) => {
    if (!heroImage) return;
    const item = composed[compIdx];
    const prompt = customPrompt || item.prompt;
    setComposingIdx(compIdx);
    withBusy("regenerating", async () => {
      const data = await composePreview({
        image_url: heroImage.url,
        prompt,
        count: 1,
      });
      setComposed((prev) =>
        prev.map((c, i) =>
          i === compIdx ? { ...c, url: data.composed_urls[0], prompt, approved: false } : c
        )
      );
      setComposingIdx(null);
      setEditingPromptFor(null);
    }).then(() => {
      // Ensure cleanup even if withBusy catches
      setComposingIdx(null);
    });
  };

  const toggleApprove = (idx: number) => {
    setComposed((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, approved: !c.approved } : c))
    );
  };

  const removeComposed = (idx: number) => {
    setComposed((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Auto-generate Kling video prompt for a specific scene ──
  const handleGenerateKlingPrompt = (sceneIdx: number) => {
    if (generatingKlingFor !== null || isBusy) return;
    setGeneratingKlingFor(sceneIdx);
    setError(null);
    generateKlingPrompt({
      product_name: productName.trim(),
      category,
      scene_description: approvedComposed[sceneIdx]?.prompt,
      scene_index: sceneIdx,
    })
      .then((result) => {
        setComposed((prev) => {
          let count = 0;
          return prev.map((c) => {
            if (!c.approved) return c;
            if (count++ === sceneIdx) return { ...c, prompt: result.prompt };
            return c;
          });
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Erro ao gerar prompt Kling");
      })
      .finally(() => setGeneratingKlingFor(null));
  };

  // ── Download composed image ──
  const handleDownload = async (url: string, idx: number) => {
    try {
      const token = getAuthToken();
      const proxyUrl = `/api/ads/download-proxy?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `scene-${idx + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { /* silent */ }
  };

  // ── Submit ──
  const handleSubmit = () => {
    if (approvedComposed.length === 0) return;
    withBusy("submitting", async () => {
      const job = await createAdJobV2({
        product_name: productName.trim(),
        category,
        image_urls: selectedUrls,
        composed_urls: approvedComposed.map((c) => c.url),
        video_model: videoModel,
        clip_duration: clipDuration,
        scene_prompts: approvedComposed.map((c) => c.prompt),
      });
      router.push(`/ads/${job.job_id}`);
    });
  };

  const readyForPrompt = selectedCount > 0 && productName.trim().length > 0 && !!heroImage;
  const readyToCompose = readyForPrompt && scenePrompt.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ads">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Video Ad</h1>
          <p className="text-muted-foreground">Upload, composicao de cena com IA, e geracao de video</p>
        </div>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* ── Step 1: Images ── */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            1. Imagens do produto
          </h3>
          <div className="flex items-center gap-3">
            <input ref={inputRef} type="file" multiple accept="image/*" onChange={handleUpload} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isBusy}>
              {busy === "uploading"
                ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Enviando...</>
                : <><Plus className="h-4 w-4 mr-1" />Adicionar imagens</>}
            </Button>
            {images.length > 0 && (
              <span className="text-sm text-muted-foreground">{selectedCount}/4 selecionadas</span>
            )}
          </div>
          {images.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Clique para selecionar ate 4 referencias. Duplo-clique para definir a imagem hero (usada na composicao de cena).
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors aspect-square ${
                      img.isHero
                        ? "border-yellow-400 ring-2 ring-yellow-400/40"
                        : img.selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleSelect(i)}
                    onDoubleClick={(e) => { e.preventDefault(); if (img.selected) setHero(i); }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`img ${i + 1}`} className="w-full h-full object-cover" />
                    {img.isHero && (
                      <div className="absolute top-1 left-1 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                        HERO
                      </div>
                    )}
                    {img.selected && !img.isHero && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <button
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              {selectedCount > 0 && !heroImage && (
                <p className="text-xs text-yellow-400">
                  Duplo-clique em uma imagem selecionada para defini-la como hero (para composicao)
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Step 2: Product info ── */}
        {images.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              2. Produto e categoria
            </h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome do produto</label>
              <Input
                placeholder="Ex: Serum Vitamina C, Tenis Runner Pro, Cookie Duplo Chocolate"
                value={productName}
                onChange={(e) => { setProductName(e.target.value); setScenePrompt(""); setComposed([]); }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => { setCategory(cat.value); setScenePrompt(""); setComposed([]); }}
                    className={`text-left rounded-lg border px-3 py-2 text-sm transition-all ${
                      category === cat.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Step 3: Composition Studio ── */}
        {readyForPrompt && (
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              3. Composicao de cena
            </h3>

            {/* Prompt area */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Prompt da cena</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePrompt}
                  disabled={isBusy}
                  className="h-7 text-xs"
                >
                  {busy === "generating-prompt"
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Gerando...</>
                    : <><Sparkles className="h-3 w-3 mr-1" />Gerar com IA</>}
                </Button>
              </div>
              <Textarea
                placeholder="Descreva o fundo e ambiente da cena (ex: polished dark marble surface with soft rim lighting, shallow depth of field...)"
                value={scenePrompt}
                onChange={(e) => setScenePrompt(e.target.value)}
                rows={4}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Descreva apenas o FUNDO e AMBIENTE. O produto sera inserido automaticamente.
              </p>
            </div>

            {/* Variation config + generate */}
            {readyToCompose && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Variacoes por imagem:</label>
                  <div className="flex gap-1">
                    {[1, 2, 4, 8].map((n) => (
                      <button
                        key={n}
                        onClick={() => setVariationCount(n)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          variationCount === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleComposeAll} disabled={isBusy}>
                  {busy === "composing"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Compondo {variationCount} variacoes...</>
                    : <><Sparkles className="h-4 w-4 mr-2" />Compor {variationCount} variacoes da hero</>}
                </Button>
              </div>
            )}

            {/* Composed results grid */}
            {composed.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {composed.length} cenas geradas — {approvedComposed.length} aprovadas
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {composed.map((item, idx) => (
                    <div
                      key={idx}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all flex flex-col ${
                        item.approved
                          ? "border-green-500 ring-2 ring-green-500/30"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      {/* Image */}
                      <div
                        className="relative aspect-[9/16] cursor-pointer group/img"
                        onClick={() => setFullscreen({ url: item.url, idx })}
                      >
                        {composingIdx === idx && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={`composed ${idx + 1}`} className="w-full h-full object-cover" />
                        {item.approved && (
                          <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                          <Maximize2 className="h-6 w-6 text-white drop-shadow" />
                        </div>
                      </div>

                      {/* Prompt preview */}
                      <div className="p-2 bg-card border-t border-border">
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                          {item.prompt}
                        </p>
                      </div>

                      {/* Action bar */}
                      <div className={`flex border-t border-border divide-x divide-border ${isBusy && composingIdx !== idx ? "opacity-50 pointer-events-none" : ""}`}>
                        <button
                          onClick={() => !isBusy && toggleApprove(idx)}
                          disabled={isBusy}
                          className={`flex-1 p-1.5 text-xs flex items-center justify-center gap-1 transition-colors ${
                            item.approved
                              ? "bg-green-600/20 text-green-400"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => !isBusy && handleRegenSingle(idx)}
                          disabled={isBusy}
                          className="flex-1 p-1.5 text-xs text-muted-foreground hover:bg-muted flex items-center justify-center"
                          title="Regenerar"
                        >
                          {composingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => !isBusy && (() => { setEditingPromptFor(idx); setSinglePrompt(item.prompt); })()}
                          disabled={isBusy}
                          className="flex-1 p-1.5 text-xs text-muted-foreground hover:bg-muted flex items-center justify-center"
                          title="Editar prompt"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(item.url, idx); }}
                          className="flex-1 p-1.5 text-xs text-muted-foreground hover:bg-muted flex items-center justify-center"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => !isBusy && removeComposed(idx)}
                          disabled={isBusy}
                          className="flex-1 p-1.5 text-xs text-muted-foreground hover:bg-red-600/20 hover:text-red-400 flex items-center justify-center"
                          title="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Per-image prompt editor */}
                {editingPromptFor !== null && (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        Editar prompt — cena {editingPromptFor + 1}
                      </label>
                      <Button variant="ghost" size="sm" onClick={() => setEditingPromptFor(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={singlePrompt}
                      onChange={(e) => setSinglePrompt(e.target.value)}
                      rows={3}
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleRegenSingle(editingPromptFor, singlePrompt)}
                      disabled={isBusy}
                    >
                      {busy === "regenerating"
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Regenerando...</>
                        : <><RotateCcw className="h-3.5 w-3.5 mr-1" />Regenerar com novo prompt</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Step 4: Video config + Submit ── */}
        {approvedComposed.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              4. Configuracao do video
            </h3>

            {/* Model & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Modelo de video</label>
                <Select value={videoModel} onValueChange={(v) => {
                  setVideoModel(v);
                  const durations = getDurations(v);
                  if (!durations.includes(clipDuration)) setClipDuration(durations[0]);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIDEO_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}{m.note ? ` (${m.note})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Duracao por cena</label>
                <Select value={String(clipDuration)} onValueChange={(v) => setClipDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getDurations(videoModel).map((d) => (
                      <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Per-scene prompt review */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompts por cena (editaveis)</label>
              <div className="space-y-2">
                {approvedComposed.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-start rounded-lg border border-border p-2 bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={`scene ${idx + 1}`}
                      className="w-16 h-28 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Cena {idx + 1}</span>
                        <button
                          onClick={() => handleGenerateKlingPrompt(idx)}
                          disabled={generatingKlingFor !== null || isBusy}
                          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
                          title="Gerar prompt otimizado para Kling com IA"
                        >
                          {generatingKlingFor === idx
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Sparkles className="h-3 w-3" />}
                          Auto Kling
                        </button>
                      </div>
                      <Textarea
                        value={item.prompt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setComposed((prev) => {
                            const approvedIdx = prev.filter((c) => c.approved).indexOf(item);
                            let count = 0;
                            return prev.map((c) => {
                              if (!c.approved) return c;
                              if (count++ === approvedIdx) return { ...c, prompt: val };
                              return c;
                            });
                          });
                        }}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isBusy} size="lg">
              {busy === "submitting"
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando video ad...</>
                : <><Film className="mr-2 h-4 w-4" />Gerar Video Ad — {videoModel.split("/")[0]} ({approvedComposed.length} cenas)</>}
            </Button>
          </section>
        )}

        {error && <div className="text-sm text-red-600 bg-red-600/10 rounded-lg p-3">{error}</div>}

        {/* Global busy indicator */}
        {isBusy && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm">
              {busy === "uploading" && "Enviando imagens..."}
              {busy === "generating-prompt" && "Gerando prompt com IA..."}
              {busy === "composing" && "Compondo cenas..."}
              {busy === "regenerating" && "Regenerando cena..."}
              {busy === "submitting" && "Criando video ad..."}
            </span>
          </div>
        )}
      </div>

      {/* Fullscreen image overlay */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreen.url}
            alt="fullscreen"
            className="max-h-full max-w-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(fullscreen.url, fullscreen.idx); }}
              className="bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={() => setFullscreen(null)}
              className="bg-black/60 text-white rounded-full p-2 hover:bg-black/80 transition-colors"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
