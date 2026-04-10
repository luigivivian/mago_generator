// 999.12 D-04: pure snapping helper for timeline drag/trim.
// Returns the candidate frame snapped to the nearest target within
// `thresholdPx` (converted to frames via current zoom). No DOM, no
// React — fully unit-testable.

export interface SnapTarget {
  frame: number;
  label?: string;
}

export interface SnapResult {
  frame: number;
  snapped: boolean;
  targetLabel?: string;
}

export function snapFrame(
  candidate: number,
  targets: SnapTarget[],
  pixelsPerFrame: number,
  thresholdPx = 12,
): SnapResult {
  if (targets.length === 0 || pixelsPerFrame <= 0) {
    return { frame: candidate, snapped: false };
  }

  const thresholdFrames = thresholdPx / pixelsPerFrame;
  let best: SnapTarget | null = null;
  let bestDist = Infinity;

  for (const t of targets) {
    const dist = Math.abs(t.frame - candidate);
    if (dist <= thresholdFrames && dist < bestDist) {
      best = t;
      bestDist = dist;
    }
  }

  if (best) {
    return { frame: best.frame, snapped: true, targetLabel: best.label };
  }
  return { frame: candidate, snapped: false };
}
