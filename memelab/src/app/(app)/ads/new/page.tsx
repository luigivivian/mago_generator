"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TakeEditor } from "@/components/ads/take-editor";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("access_token") ??
    sessionStorage.getItem("access_token")
  );
}

export default function NewAdPage() {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 4) {
      setError("Maximo 4 imagens");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
      const res = await fetch("/api/ads/upload-images", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed ${res.status}: ${text || res.statusText}`);
      }
      const data: { image_urls: string[]; count: number } = await res.json();
      setImageUrls(data.image_urls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRendered = (jobId: string) => {
    window.location.href = `/ads/${jobId}`;
  };

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
            Product Studio v2 — multi-scene cinematic ads
          </p>
        </div>
      </div>

      {imageUrls.length === 0 ? (
        <div className="space-y-3 max-w-xl">
          <label className="text-sm font-medium">
            Upload 1-4 product images
          </label>
          <Input
            type="file"
            multiple
            accept="image/jpeg,image/png"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading && (
            <span className="text-sm text-muted-foreground">
              Uploading and normalizing...
            </span>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {imageUrls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={u}
                alt={`ref ${i + 1}`}
                className="h-20 rounded"
              />
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImageUrls([])}
            >
              Reset
            </Button>
          </div>
          <TakeEditor imageUrls={imageUrls} onRender={handleRendered} />
        </>
      )}
    </div>
  );
}
