"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Plus, X, Loader2, Film,
  Sparkles, RotateCcw, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAdJobV2, generateScenePrompt, composePreview } from "@/lib/api";

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
  const [uploading, setUploading] = useState(false);

  // Step 2: Product info
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("generic");

  // Step 3: Composition
  const [scenePrompt, setScenePrompt] = useState("");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [variationCount, setVariationCount] = useState(4);
  const [composing, setComposing] = useState(false);
  const [composingIdx, setComposingIdx] = useState<number | null>(null);
  const [composed, setComposed] = useState<ComposedImage[]>([]);
  const [editingPromptFor, setEditingPromptFor] = useState<number | null>(null);
  const [singlePrompt, setSinglePrompt] = useState("");

  // Step 4: Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCount = images.filter((img) => img.selected).length;
  const selectedUrls = images.filter((img) => img.selected).map((img) => img.url);
  const heroImage = images.find((img) => img.isHero);
  const approvedComposed = composed.filter((c) => c.approved);

  // ── Upload ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
  const handleGeneratePrompt = async () => {
    if (!productName.trim()) return;
    setGeneratingPrompt(true);
    setError(null);
    try {
      const result = await generateScenePrompt({
        product_name: productName.trim(),
        category,
      });
      setScenePrompt(result.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar prompt");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // ── Batch compose (hero image only) ──
  const handleComposeAll = async () => {
    if (!scenePrompt.trim() || !heroImage) return;
    setComposing(true);
    setError(null);
    try {
      const data = await composePreview({
        image_url: heroImage.url,
        prompt: scenePrompt,
        count: variationCount,
      });
      const results: ComposedImage[] = data.composed_urls.map((url) => ({
        url, approved: false, prompt: scenePrompt,
      }));
      setComposed((prev) => [...prev, ...results]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na composicao");
    } finally {
      setComposing(false);
    }
  };

  // ── Single image regen ──
  const handleRegenSingle = async (compIdx: number, customPrompt?: string) => {
    if (!heroImage) return;
    const item = composed[compIdx];
    const sourceUrl = heroImage.url;
    const prompt = customPrompt || item.prompt;
    setComposingIdx(compIdx);
    setError(null);
    try {
      const data = await composePreview({
        image_url: sourceUrl,
        prompt,
        count: 1,
      });
      setComposed((prev) =>
        prev.map((c, i) =>
          i === compIdx ? { ...c, url: data.composed_urls[0], prompt, approved: false } : c
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao regenerar");
    } finally {
      setComposingIdx(null);
      setEditingPromptFor(null);
    }
  };

  const toggleApprove = (idx: number) => {
    setComposed((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, approved: !c.approved } : c))
    );
  };

  const removeComposed = (idx: number) => {
    setComposed((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ──
  // Send all selected images as element references (for 3D model)
  // and composed images as the scene backgrounds for video prompts
  const handleSubmit = async () => {
    if (approvedComposed.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createAdJobV2({
        product_name: productName.trim(),
        category,
        image_urls: selectedUrls,
        composed_urls: approvedComposed.map((c) => c.url),
      });
      router.push(`/ads/${job.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar ad");
      setSubmitting(false);
    }
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
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading
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
                  disabled={generatingPrompt}
                  className="h-7 text-xs"
                >
                  {generatingPrompt
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
                <Button onClick={handleComposeAll} disabled={composing}>
                  {composing
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
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-[9/16] ${
                        item.approved
                          ? "border-green-500 ring-2 ring-green-500/30"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      {composingIdx === idx && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={`composed ${idx + 1}`} className="w-full h-full object-cover" />

                      {/* Approve badge */}
                      {item.approved && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                      )}

                      {/* Action bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 justify-center">
                        <button
                          onClick={() => toggleApprove(idx)}
                          className={`p-1.5 rounded-md text-xs ${
                            item.approved ? "bg-green-600 text-white" : "bg-white/20 text-white hover:bg-white/30"
                          }`}
                          title={item.approved ? "Remover aprovacao" : "Aprovar"}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRegenSingle(idx)}
                          className="p-1.5 rounded-md bg-white/20 text-white hover:bg-white/30 text-xs"
                          title="Regenerar"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingPromptFor(idx); setSinglePrompt(item.prompt); }}
                          className="p-1.5 rounded-md bg-white/20 text-white hover:bg-white/30 text-xs"
                          title="Editar prompt e regenerar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeComposed(idx)}
                          className="p-1.5 rounded-md bg-white/20 text-white hover:bg-red-600/80 text-xs"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
                      disabled={composingIdx !== null}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Regenerar com novo prompt
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Step 4: Submit ── */}
        {approvedComposed.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              4. Gerar video
            </h3>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting} size="lg">
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando video ad...</>
                : <><Film className="mr-2 h-4 w-4" />Gerar Video Ad ({approvedComposed.length} cenas aprovadas)</>}
            </Button>
          </section>
        )}

        {error && <div className="text-sm text-red-600 bg-red-600/10 rounded-lg p-3">{error}</div>}
      </div>
    </div>
  );
}
