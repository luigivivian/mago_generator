// 999.14 D-09, D-10: estimate reel generation cost in BRL credits
// before triggering a job. Numbers mirror the backend's CREDIT_COSTS
// table. Pure helper — no React, no DOM.

const CREDIT_PER_BRL = 100; // backend uses integer credits, $0.01 ≈ 1 credit

const VIDEO_MODEL_COSTS: Record<string, number> = {
  // BRL per scene-clip — sourced from backend config
  "hailuo/2-3-image-to-video-standard": 1.31,
  "hailuo/2-3-image-to-video-pro": 6.30,
  "sora-2": 8.50,
};

export interface ReelCostEstimate {
  scenes: number;
  brl: number;
  credits: number;
  economic: boolean;
}

export function estimateReelCredits({
  targetDuration,
  videoModel,
  economicMode,
}: {
  targetDuration: number;
  videoModel: string;
  economicMode: boolean;
}): ReelCostEstimate {
  // Approximate cena count: ~3s per cena dynamic, ~6s per cena economic
  const scenes = economicMode
    ? Math.max(2, Math.round(targetDuration / 6))
    : Math.max(3, Math.round(targetDuration / 3));

  // Economic mode skips video gen entirely; only TTS + image gen costs
  // remain (those are not modeled here — they're a small fixed cost).
  const perScene = economicMode ? 0 : (VIDEO_MODEL_COSTS[videoModel] ?? 1.31);
  const brl = parseFloat((scenes * perScene).toFixed(2));
  const credits = Math.round(brl * CREDIT_PER_BRL);

  return { scenes, brl, credits, economic: economicMode };
}
