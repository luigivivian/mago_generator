"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Film,
  Loader2,
  Sparkles,
  Package,
  Target,
  Palette,
  Volume2,
  Upload,
  X,
  ImageIcon,
  CheckCircle2,
  Wand2,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  createAdJob,
  analyzeProduct,
  uploadAdImage,
  generateNanoBanana,
  type AdCreateRequest,
} from "@/lib/api";

// ── Section wrapper ───────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  step,
  open,
  onToggle,
  filled,
  children,
}: {
  title: string;
  icon: typeof Package;
  step: number;
  open: boolean;
  onToggle: () => void;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="transition-all duration-200">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={onToggle}
      >
        <span
          className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-colors ${
            filled
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-primary/20 text-primary"
          }`}
        >
          {filled ? <CheckCircle2 className="h-4 w-4" /> : step}
        </span>
        <Icon className="h-5 w-5 text-primary" />
        <span className="font-medium flex-1">{title}</span>
        {filled && !open && (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs"
          >
            Preenchido
          </Badge>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Image upload dropzone ────────────────────────────────────────

function ImageDropzone({
  images,
  onUpload,
  uploading,
}: {
  images: Array<{ filename: string; path: string; preview: string }>;
  onUpload: (files: FileList) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files);
    },
    [onUpload]
  );

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">
        Imagens do produto (referencia)
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.multiple = true;
          input.onchange = () => {
            if (input.files && input.files.length > 0) onUpload(input.files);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Enviando imagem...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Arraste imagens ou clique para selecionar
            </span>
            <span className="text-xs text-muted-foreground/60">
              JPG, PNG ate 10MB
            </span>
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative group rounded-lg overflow-hidden border w-16 h-16"
            >
              <img
                src={img.preview}
                alt={`Ref ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────

const STYLES = [
  {
    value: "cinematic" as const,
    label: "Cinematico",
    desc: "Camera em movimento, iluminacao dramatica, sem narrador",
  },
  {
    value: "narrated" as const,
    label: "Narrado",
    desc: "Narracao em voz over com imagens do produto",
  },
  {
    value: "lifestyle" as const,
    label: "Lifestyle",
    desc: "Pessoa usando o produto em cenario real",
  },
];

const NICHES = [
  { value: "moda", label: "Moda" },
  { value: "tech", label: "Tecnologia" },
  { value: "food", label: "Alimentacao" },
  { value: "beauty", label: "Beleza" },
  { value: "fitness", label: "Fitness" },
  { value: "outros", label: "Outros" },
];

const TONES = [
  { value: "premium", label: "Premium" },
  { value: "energetico", label: "Energetico" },
  { value: "divertido", label: "Divertido" },
  { value: "minimalista", label: "Minimalista" },
  { value: "profissional", label: "Profissional" },
  { value: "natural", label: "Natural" },
];

const AUDIO_MODES = [
  { value: "mute", label: "Mudo" },
  { value: "music", label: "So trilha" },
  { value: "narrated", label: "TTS + trilha" },
  { value: "ambient", label: "Ambiente + trilha" },
];

// ── Submit progress overlay ─────────────────────────────────────

function SubmitOverlay({ step }: { step: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border shadow-2xl">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/10 animate-ping" />
        </div>
        <div className="text-center">
          <p className="font-medium">{step}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Isso pode levar alguns segundos...
          </p>
        </div>
      </div>
    </div>
  );
}

// ── AdWizard ─────────────────────────────────────────────────────

export function AdWizard() {
  const router = useRouter();

  // Section visibility
  const [openSection, setOpenSection] = useState(1);

  // Section 1: Produto
  const [productName, setProductName] = useState("");
  const [productImages, setProductImages] = useState<
    Array<{ filename: string; path: string; preview: string }>
  >([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Section 2: Preparacao Nano Banana (optional)
  const [nanoSrc, setNanoSrc] = useState<{ path: string; preview: string } | null>(null);
  const [nanoPrompt, setNanoPrompt] = useState("");
  const [nanoCount, setNanoCount] = useState(1);
  const [nanoGenerating, setNanoGenerating] = useState(false);
  const [nanoVariations, setNanoVariations] = useState<
    Array<{ path: string; preview_url: string; label: string }>
  >([]);
  const [nanoSelectedPath, setNanoSelectedPath] = useState<string | null>(null);

  // Section 3: Contexto
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeSuccess, setAnalyzeSuccess] = useState(false);

  // Section 3: Estilo
  const [style, setStyle] = useState<"cinematic" | "narrated" | "lifestyle">(
    "cinematic"
  );
  const [sceneDescription, setSceneDescription] = useState("");
  const [withHuman, setWithHuman] = useState(false);
  const [duration, setDuration] = useState("15");

  // Section 4: Audio & Formato
  const [audioMode, setAudioMode] = useState<
    "mute" | "music" | "narrated" | "ambient"
  >("music");
  const [formats, setFormats] = useState<string[]>(["9:16"]);
  const [videoModel, setVideoModel] = useState("kling-3.0/video");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  function toggleSection(n: number) {
    setOpenSection(openSection === n ? 0 : n);
  }

  function toggleFormat(fmt: string) {
    setFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
    );
  }

  async function handleImageUpload(files: FileList) {
    setUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const preview = URL.createObjectURL(file);
        const result = await uploadAdImage(file);
        setProductImages((prev) => [
          ...prev,
          { filename: result.filename, path: result.path, preview },
        ]);
      }
    } catch {
      setError("Erro ao enviar imagem");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleAnalyze() {
    if (!productName.trim()) return;
    setAnalyzing(true);
    setAnalyzeSuccess(false);
    try {
      const result = await analyzeProduct(productName.trim());
      if (result.niche && !niche) setNiche(result.niche);
      if (result.tone && !tone) setTone(result.tone);
      if (result.audience && !audience) setAudience(result.audience);
      if (result.scene_suggestions?.length && !sceneDescription) {
        setSceneDescription(result.scene_suggestions[0]);
      }
      setAnalyzeSuccess(true);
      setTimeout(() => setAnalyzeSuccess(false), 3000);
    } catch {
      // silently fail — user can fill manually
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerateNanoBanana() {
    if (!nanoSrc || !nanoPrompt.trim() || nanoGenerating) return;
    setNanoGenerating(true);
    setError(null);
    try {
      const result = await generateNanoBanana({
        source_path: nanoSrc.path,
        prompt: nanoPrompt.trim(),
        count: nanoCount,
      });
      const offset = nanoVariations.length;
      const newVars = result.variations.map((v, i) => ({
        ...v,
        label: `Variacao ${offset + i + 1}`,
      }));
      setNanoVariations((prev) => [...prev, ...newVars]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao gerar variacao com Gemini"
      );
    } finally {
      setNanoGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!productName.trim() || formats.length === 0) return;
    setSubmitting(true);
    setSubmitStep("Criando video ad...");
    setError(null);
    try {
      const req: AdCreateRequest = {
        product_name: productName.trim(),
        style,
        audio_mode: audioMode,
        output_formats: formats,
        target_duration: parseInt(duration),
        ...(tone ? { tone } : {}),
        ...(niche ? { niche } : {}),
        ...(audience ? { audience } : {}),
        ...(sceneDescription ? { scene_description: sceneDescription } : {}),
        ...(style === "lifestyle" ? { with_human: withHuman } : {}),
        video_model: videoModel,
        ...(nanoSelectedPath
          ? { product_image_url: nanoSelectedPath }
          : productImages.length > 0
          ? { product_image_url: productImages[0].path }
          : {}),
      };

      setSubmitStep("Enviando configuracao...");
      const job = await createAdJob(req);

      setSubmitStep("Redirecionando para o pipeline...");
      router.push(`/ads/${job.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar video ad");
      setSubmitting(false);
    }
  }

  const section1Filled = !!productName.trim();
  const section2Filled = !!(niche || audience || tone);
  const section3Filled = !!style;
  const section4Filled = formats.length > 0;

  const estimatedCost =
    style === "cinematic" ? 2.5 : style === "narrated" ? 3.0 : 2.0;

  const completedSections = [
    section1Filled,
    section2Filled,
    section3Filled,
    section4Filled,
  ].filter(Boolean).length;

  return (
    <>
      {submitting && <SubmitOverlay step={submitStep} />}

      <div className="space-y-3 max-w-2xl">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(completedSections / 4) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {completedSections}/4
          </span>
        </div>

        {/* Section 1: Produto */}
        <Section
          title="Produto"
          icon={Package}
          step={1}
          open={openSection === 1}
          onToggle={() => toggleSection(1)}
          filled={section1Filled}
        >
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Nome do produto
            </label>
            <Input
              placeholder="Ex: Tenis Runner Pro X"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              autoFocus
            />
          </div>

          <ImageDropzone
            images={productImages}
            onUpload={handleImageUpload}
            uploading={uploadingImage}
          />

          {section1Filled && productImages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSection(2)}
              className="mt-2"
            >
              Preparar imagem com Nano Banana
            </Button>
          )}
          {section1Filled && productImages.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSection(3)}
              className="mt-2"
            >
              Proximo
            </Button>
          )}
        </Section>

        {/* Section 2: Preparacao Nano Banana (optional) */}
        {productImages.length > 0 && (
          <Section
            title="Preparacao Nano Banana"
            icon={Wand2}
            step={2}
            open={openSection === 2}
            onToggle={() => toggleSection(2)}
            filled={nanoVariations.length > 0}
          >
            <p className="text-xs text-muted-foreground">
              Opcional. Use o Gemini para gerar uma variacao da imagem antes de criar o video. Selecione a melhor versao como imagem final.
            </p>

            {/* Source selector */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Selecionar imagem base
              </label>
              <div className="flex gap-2 flex-wrap">
                {productImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setNanoSrc({ path: img.path, preview: img.preview })}
                    className={`relative rounded-lg overflow-hidden border-2 w-16 h-16 transition-all ${
                      nanoSrc?.path === img.path
                        ? "border-primary shadow-sm shadow-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={img.preview}
                      alt={`Ref ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {nanoSrc?.path === img.path && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
                {nanoVariations.map((v, i) => (
                  <button
                    key={`var-${i}`}
                    type="button"
                    onClick={() => setNanoSrc({ path: v.path, preview: v.preview_url })}
                    className={`relative rounded-lg overflow-hidden border-2 w-16 h-16 transition-all ${
                      nanoSrc?.path === v.path
                        ? "border-primary shadow-sm shadow-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={v.preview_url}
                      alt={v.label}
                      className="w-full h-full object-cover"
                    />
                    {nanoSrc?.path === v.path && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt input */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prompt</label>
              <Textarea
                placeholder="Ex: Remova o fundo. Coloque o produto em uma superficie de marmore branco com luz natural suave..."
                value={nanoPrompt}
                onChange={(e) => setNanoPrompt(e.target.value)}
                rows={3}
              />
            </div>

            {/* Count + Generate */}
            <div className="flex items-center gap-2">
              <Select
                value={String(nanoCount)}
                onValueChange={(v) => setNanoCount(Number(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 variacao</SelectItem>
                  <SelectItem value="2">2 variacoes</SelectItem>
                  <SelectItem value="3">3 variacoes</SelectItem>
                  <SelectItem value="4">4 variacoes</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateNanoBanana}
                disabled={!nanoSrc || !nanoPrompt.trim() || nanoGenerating}
                className="flex-1"
              >
                {nanoGenerating ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3 w-3" />
                )}
                {nanoGenerating ? "Gerando..." : "Gerar variacao"}
              </Button>
            </div>

            {/* Gallery */}
            {nanoVariations.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">
                  Variacoes geradas ({nanoVariations.length})
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {nanoVariations.map((v, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border overflow-hidden transition-all ${
                        nanoSelectedPath === v.path
                          ? "border-emerald-500 ring-1 ring-emerald-500/50"
                          : "border-border"
                      }`}
                    >
                      <img
                        src={v.preview_url}
                        alt={v.label}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="p-2 space-y-1.5">
                        <p className="text-xs text-muted-foreground">{v.label}</p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="Usar como base para proxima geracao"
                            onClick={() => setNanoSrc({ path: v.path, preview: v.preview_url })}
                            className="flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border border-border hover:border-primary/50 transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Usar base
                          </button>
                          <button
                            type="button"
                            title="Selecionar para o video"
                            onClick={() =>
                              setNanoSelectedPath(
                                nanoSelectedPath === v.path ? null : v.path
                              )
                            }
                            className={`flex-1 flex items-center justify-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
                              nanoSelectedPath === v.path
                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                : "border-border hover:border-emerald-500/50"
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {nanoSelectedPath === v.path ? "Selecionada" : "Selecionar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nanoSelectedPath && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-md px-3 py-2">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                Imagem preparada sera usada no video
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSection(3)}
              className="mt-1 text-muted-foreground"
            >
              Pular e continuar
            </Button>
          </Section>
        )}

        {/* Section 3: Contexto */}
        <Section
          title="Contexto"
          icon={Target}
          step={productImages.length > 0 ? 3 : 2}
          open={openSection === 3}
          onToggle={() => toggleSection(3)}
          filled={section2Filled}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={!productName.trim() || analyzing}
            className="relative"
          >
            {analyzing ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : analyzeSuccess ? (
              <CheckCircle2 className="mr-2 h-3 w-3 text-emerald-400" />
            ) : (
              <Sparkles className="mr-2 h-3 w-3" />
            )}
            {analyzing
              ? "Analisando..."
              : analyzeSuccess
                ? "Campos preenchidos!"
                : "Analisar com IA"}
          </Button>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nicho</label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {NICHES.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tom</label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Publico-alvo
            </label>
            <Input
              placeholder="Ex: Mulheres 25-35, fitness, classe A/B"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </div>
        </Section>

        {/* Section 4: Estilo */}
        <Section
          title="Estilo"
          icon={Palette}
          step={productImages.length > 0 ? 4 : 3}
          open={openSection === 4}
          onToggle={() => toggleSection(4)}
          filled={section3Filled}
        >
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Tipo de video
            </label>
            <div className="grid grid-cols-1 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`text-left rounded-lg border p-3 transition-all duration-150 ${
                    style === s.value
                      ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Descricao da cena
            </label>
            <Textarea
              placeholder="Ex: Produto em mesa de marmore com luz natural lateral"
              value={sceneDescription}
              onChange={(e) => setSceneDescription(e.target.value)}
              rows={3}
            />
          </div>

          {style === "lifestyle" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withHuman}
                onChange={(e) => setWithHuman(e.target.checked)}
                className="accent-primary"
              />
              Incluir pessoa no video
            </label>
          )}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Duracao</label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 segundos</SelectItem>
                <SelectItem value="15">15 segundos</SelectItem>
                <SelectItem value="30">30 segundos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Section 5: Audio & Formato */}
        <Section
          title="Audio & Formato"
          icon={Volume2}
          step={productImages.length > 0 ? 5 : 4}
          open={openSection === 5}
          onToggle={() => toggleSection(5)}
          filled={section4Filled}
        >
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Audio</label>
            <Select
              value={audioMode}
              onValueChange={(v) => setAudioMode(v as typeof audioMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIO_MODES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Formatos de saida
            </label>
            <div className="flex gap-2">
              {["9:16", "16:9", "1:1"].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => toggleFormat(fmt)}
                  className={`px-3 py-1.5 rounded-md border text-sm transition-all duration-150 ${
                    formats.includes(fmt)
                      ? "border-primary bg-primary/10 text-primary shadow-sm shadow-primary/20"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
            {formats.length === 0 && (
              <p className="text-xs text-red-400">
                Selecione ao menos um formato
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              Modelo de video
            </label>
            <Select value={videoModel} onValueChange={setVideoModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wan/2-6-flash-image-to-video">Wan 2.6 Flash (rapido, R$1-3)</SelectItem>
                <SelectItem value="wan/2-6-image-to-video">Wan 2.6 (qualidade, R$2-5)</SelectItem>
                <SelectItem value="kling/v2-1-standard">Kling v2.1 (R$1-3)</SelectItem>
                <SelectItem value="kling-3.0/video">Kling 3.0 (premium, R$4-7)</SelectItem>
                <SelectItem value="hailuo/2-3-image-to-video-standard">Hailuo 2.3 (custo, R$0.86)</SelectItem>
                <SelectItem value="hailuo/2-3-image-to-video-pro">Hailuo 2.3 Pro (1080p, R$0.86)</SelectItem>
                <SelectItem value="bytedance/v1-pro-fast-image-to-video">Seedance Pro Fast (R$2-4)</SelectItem>
                <SelectItem value="bytedance/v1-lite-image-to-video">Seedance Lite (custo, R$1-2)</SelectItem>
                <SelectItem value="bytedance/seedance-1.5-pro">Seedance 1.5 Pro (cinema, R$3-8)</SelectItem>
                <SelectItem value="grok-imagine/image-to-video">Grok Imagine (R$1.5-2.5)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        {/* Cost estimate + Submit */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Custo estimado:
              </span>
              <span className="text-sm font-medium text-primary">
                R$ {estimatedCost.toFixed(2).replace(".", ",")}
              </span>
            </div>

            {nanoSelectedPath ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Wand2 className="h-3 w-3" />
                Usando imagem preparada com Nano Banana
              </div>
            ) : productImages.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {productImages.length} imagem(ns) do produto anexada(s)
              </div>
            ) : null}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={
                !productName.trim() || formats.length === 0 || submitting
              }
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Film className="mr-2 h-4 w-4" />
              )}
              Criar Video Ad
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
