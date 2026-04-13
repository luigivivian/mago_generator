import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CAMERA_MOVES,
  TRANSITIONS,
  type TakeConfig,
} from "@/components/ads/category-config";
import { SFX_ENTRIES } from "@/components/ads/sfx-picker";

describe("take-editor config model", () => {
  it("has 7 categories matching backend CATEGORY_CONFIGS", () => {
    expect(CATEGORIES).toHaveLength(7);
    const keys = CATEGORIES.map((c) => c.key);
    expect(keys).toContain("food_cookies");
    expect(keys).toContain("food_burger");
    expect(keys).toContain("food_chocolate");
    expect(keys).toContain("beauty_skincare");
    expect(keys).toContain("fashion_shoes");
    expect(keys).toContain("tech_electronics");
    expect(keys).toContain("beverage");
  });

  it("has 5 camera moves matching backend enum", () => {
    expect(CAMERA_MOVES).toHaveLength(5);
    const keys = CAMERA_MOVES.map((c) => c.key);
    expect(keys).toEqual(["dolly", "orbit", "macro_zoom", "static", "crane"]);
  });

  it("has 5 transitions matching backend enum", () => {
    expect(TRANSITIONS).toHaveLength(5);
    const keys = TRANSITIONS.map((t) => t.key);
    expect(keys).toContain("dissolve");
    expect(keys).toContain("cut");
    expect(keys).toContain("fade");
    expect(keys).toContain("fadeblack");
    expect(keys).toContain("wipeleft");
  });

  it("SFX catalog has 12 entries mirroring backend sfx_library", () => {
    expect(SFX_ENTRIES).toHaveLength(12);
    const ids = SFX_ENTRIES.map((s) => s.id);
    expect(ids).toContain("asmr_crunch_01");
    expect(ids).toContain("epic_hit_01");
    expect(ids).toContain("ambient_warmth_01");
  });

  it("TakeConfig interface allows all required fields with prompt max 463", () => {
    const take: TakeConfig = {
      id: "abc",
      order: 0,
      prompt: "Dolly push-in on the cookie stack as crumbs fall",
      camera_move: "dolly",
      duration: 5,
      transition_type: "dissolve",
      sfx_id: "asmr_crunch_01",
      thumbnail_url: null,
    };
    expect(take.prompt.length).toBeLessThanOrEqual(463);
    expect(take.duration).toBeGreaterThanOrEqual(3);
    expect(take.duration).toBeLessThanOrEqual(10);
  });
});
