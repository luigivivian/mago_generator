import { describe, it, expect } from "vitest";
import { resamplePeaks } from "@/hooks/use-audio-waveform";

describe("resamplePeaks", () => {
  it("downsamples 4 peaks to 2 using max-in-bucket", () => {
    const source = new Float32Array([0.5, 1.0, 0.3, 0.8]);
    const result = resamplePeaks(source, 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(1.0, 5);
    expect(result[1]).toBeCloseTo(0.8, 5);
  });

  it("resamples 100 peaks to 10 with correct length", () => {
    const source = new Float32Array(100);
    for (let i = 0; i < 100; i++) source[i] = Math.random();
    const result = resamplePeaks(source, 10);
    expect(result).toHaveLength(10);
  });

  it("output values are between 0 and max(source)", () => {
    const source = new Float32Array([0.2, 0.9, 0.1, 0.6, 0.4, 0.7]);
    const result = resamplePeaks(source, 3);
    const sourceMax = Math.max(...Array.from(source));
    for (const val of result) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(sourceMax);
    }
  });

  it("returns empty array for targetCount 0", () => {
    const source = new Float32Array([0.5, 1.0]);
    expect(resamplePeaks(source, 0)).toEqual([]);
  });

  it("handles single-element source", () => {
    const source = new Float32Array([0.7]);
    const result = resamplePeaks(source, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(0.7, 5);
  });
});
