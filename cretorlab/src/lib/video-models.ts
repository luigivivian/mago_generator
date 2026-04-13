export interface VideoModel {
  value: string;
  label: string;
  note?: string;
  durations: number[];
}

export const VIDEO_MODELS: VideoModel[] = [
  { value: "kling-3.0/video", label: "Kling 3.0", note: "premium", durations: [5, 10] },
  { value: "kling/v2-1-standard", label: "Kling v2.1", note: "standard", durations: [5, 10] },
  { value: "wan/2-6-flash-image-to-video", label: "Wan Flash", note: "barato", durations: [5, 10, 15] },
  { value: "wan/2-6-image-to-video", label: "Wan 2.6", note: "qualidade", durations: [5, 10] },
  { value: "hailuo/2-3-image-to-video-standard", label: "Hailuo 2.3", note: "standard", durations: [5, 10] },
  { value: "hailuo/2-3-image-to-video-pro", label: "Hailuo 2.3 Pro", note: "1080p", durations: [5, 10] },
  { value: "bytedance/v1-lite-image-to-video", label: "Seedance Lite", note: "barato", durations: [4, 8] },
  { value: "bytedance/v1-pro-fast-image-to-video", label: "Seedance Fast", note: "rapido", durations: [4, 8] },
  { value: "bytedance/seedance-1.5-pro", label: "Seedance 1.5 Pro", note: "cinema", durations: [4, 8] },
  { value: "grok-imagine/image-to-video", label: "Grok Imagine", note: "experimental", durations: [5, 10] },
];

/** Check if a model ID is a Seedance/Bytedance model */
export function isSeedanceModel(modelValue: string): boolean {
  return modelValue.startsWith("bytedance/");
}

/** Get duration options for a given model value */
export function getDurations(modelValue: string): number[] {
  return VIDEO_MODELS.find((m) => m.value === modelValue)?.durations ?? [5, 10];
}
