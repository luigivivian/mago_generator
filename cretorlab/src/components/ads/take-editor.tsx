"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TakeCard } from "./take-card";
import {
  CATEGORIES,
  type TakeConfig,
  type CategoryKey,
} from "./category-config";

interface TakeEditorProps {
  imageUrls: string[];
  initialTakes?: TakeConfig[];
  onRender?: (jobId: string) => void;
}

const DEFAULT_TAKE: Omit<TakeConfig, "id" | "order"> = {
  prompt: "Product reveal with dramatic lighting",
  camera_move: "dolly",
  duration: 5,
  transition_type: "dissolve",
  sfx_id: null,
  thumbnail_url: null,
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token")
  );
}

export function TakeEditor({ imageUrls, initialTakes, onRender }: TakeEditorProps) {
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("food_cookies");
  const [takes, setTakes] = useState<TakeConfig[]>(
    initialTakes ?? [
      {
        id: makeId(),
        order: 0,
        ...DEFAULT_TAKE,
        thumbnail_url: imageUrls[0] ?? null,
      },
      {
        id: makeId(),
        order: 1,
        ...DEFAULT_TAKE,
        camera_move: "macro_zoom",
        thumbnail_url: imageUrls[1] ?? imageUrls[0] ?? null,
      },
      {
        id: makeId(),
        order: 2,
        ...DEFAULT_TAKE,
        camera_move: "orbit",
        thumbnail_url: imageUrls[2] ?? imageUrls[0] ?? null,
      },
    ],
  );
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDuration = takes.reduce((sum, t) => sum + t.duration, 0);

  const addTake = () => {
    if (takes.length >= 5) return;
    setTakes([
      ...takes,
      { id: makeId(), order: takes.length, ...DEFAULT_TAKE },
    ]);
  };

  const removeTake = (idx: number) => {
    const next = takes
      .filter((_, i) => i !== idx)
      .map((t, i) => ({ ...t, order: i }));
    setTakes(next);
  };

  const updateTake = (idx: number, take: TakeConfig) => {
    const next = [...takes];
    next[idx] = take;
    setTakes(next);
  };

  const handleRender = async () => {
    setError(null);
    if (!productName.trim()) {
      setError("Product name is required");
      return;
    }
    if (imageUrls.length === 0) {
      setError("At least one product image is required");
      return;
    }
    setRendering(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/ads/create-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_name: productName,
          category,
          image_urls: imageUrls,
          takes,
          output_formats: ["9:16"],
          audio_mode: "sfx",
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API error ${res.status}: ${text || res.statusText}`);
      }
      const data = await res.json();
      onRender?.(data.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">Product name</label>
          <Input
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Biscoitos Mae Benta"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Category</label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as CategoryKey)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">
          Takes: {takes.length}/5 &middot; Total: {totalDuration}s
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={addTake}
          disabled={takes.length >= 5}
        >
          + Add take
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {takes.map((take, idx) => (
          <TakeCard
            key={take.id}
            take={take}
            onChange={(t) => updateTake(idx, t)}
            onRemove={() => removeTake(idx)}
            canRemove={takes.length > 1}
          />
        ))}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <Button
        onClick={handleRender}
        disabled={rendering || takes.length === 0}
      >
        {rendering ? "Rendering..." : "Render video"}
      </Button>
    </div>
  );
}
