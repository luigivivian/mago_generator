"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Plus, X, Loader2, Film, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAdJobV2, composePreview } from "@/lib/api";

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
}

export default function NewAdPage() {
  const router = useRouter();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("generic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Composition step state
  const [composing, setComposing] = useState(false);
  const [composedUrls, setComposedUrls] = useState<string[]>([]);
  const [composedApproved, setComposedApproved] = useState(false);

  const selectedCount = images.filter((img) => img.selected).length;
  const selectedUrls = images.filter((img) => img.selected).map((img) => img.url);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("http://127.0.0.1:8000/ads/upload-images", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed ${res.status}: ${text || res.statusText}`);
      }
      const data: { image_urls: string[]; count: number } = await res.json();
      const newImages = data.image_urls.map((url) => ({ url, selected: false }));
      setImages((prev) => [...prev, ...newImages]);
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
        return { ...img, selected: !img.selected };
      })
    );
    // Reset composition when selection changes
    setComposedUrls([]);
    setComposedApproved(false);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setComposedUrls([]);
    setComposedApproved(false);
  };

  const handleCompose = async () => {
    if (!productName.trim() || selectedCount === 0 || composing) return;
    setComposing(true);
    setError(null);
    setComposedApproved(false);
    try {
      const result = await composePreview({
        image_urls: selectedUrls,
        category,
        product_name: productName.trim(),
      });
      setComposedUrls(result.composed_urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na composicao");
    } finally {
      setComposing(false);
    }
  };

  const handleSubmit = async () => {
    if (!productName.trim() || selectedCount === 0 || submitting) return;
    if (!composedApproved) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createAdJobV2({
        product_name: productName.trim(),
        category,
        image_urls: composedUrls.length > 0 ? composedUrls : selectedUrls,
      });
      router.push(`/ads/${job.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar ad");
      setSubmitting(false);
    }
  };

  const readyToCompose = selectedCount > 0 && productName.trim().length > 0;
  const hasComposed = composedUrls.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Video Ad</h1>
          <p className="text-muted-foreground">
            Upload, composicao de cena, e geracao de video
          </p>
        </div>
      </div>

      <div className="space-y-5 max-w-3xl">
        {/* Step 1: Images */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            1. Imagens do produto
          </h3>
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar imagens do produto
                </>
              )}
            </Button>
            {images.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedCount}/4 selecionadas
              </span>
            )}
          </div>

          {images.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Clique para selecionar ate 4 imagens
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors aspect-square ${
                      img.selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={`img ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {img.selected && (
                      <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <button
                      className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(i);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Step 2: Product info */}
        {images.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              2. Produto e categoria
            </h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome do produto</label>
              <Input
                placeholder="Ex: Serum Vitamina C, Tenis Runner Pro, Cookie Duplo Chocolate"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setComposedUrls([]);
                  setComposedApproved(false);
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Categoria</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setCategory(cat.value);
                      setComposedUrls([]);
                      setComposedApproved(false);
                    }}
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
          </div>
        )}

        {/* Step 3: Composition */}
        {readyToCompose && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              3. Composicao de cena
            </h3>

            {!hasComposed && (
              <Button
                variant="outline"
                onClick={handleCompose}
                disabled={composing}
              >
                {composing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Compondo cenas com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Compor cenas ({selectedCount} imagens)
                  </>
                )}
              </Button>
            )}

            {composing && (
              <p className="text-xs text-muted-foreground">
                Gemini esta gerando fundos profissionais para cada imagem. Isso pode levar alguns segundos...
              </p>
            )}

            {hasComposed && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Imagens compostas — revise antes de gerar o video
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {composedUrls.map((url, i) => (
                    <div
                      key={i}
                      className="relative rounded-lg overflow-hidden border border-border aspect-[9/16]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`composed ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCompose}
                    disabled={composing}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Refazer composicao
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setComposedApproved(true)}
                    disabled={composedApproved}
                    className={composedApproved ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {composedApproved ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Aprovado
                      </>
                    ) : (
                      "Aprovar composicao"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Submit (only after composition approved) */}
        {composedApproved && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              4. Gerar video
            </h3>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting}
              size="lg"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Film className="mr-2 h-4 w-4" />
              )}
              {submitting ? "Criando video ad..." : `Gerar Video Ad (${composedUrls.length} cenas)`}
            </Button>
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
