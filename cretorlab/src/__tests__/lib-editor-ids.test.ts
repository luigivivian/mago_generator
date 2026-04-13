import { describe, it, expect } from "vitest";
import { genId } from "@/lib/editor/ids";

describe("genId", () => {
  it("returns string matching /^scene-\\d+-\\d+$/ with default prefix", () => {
    const id = genId();
    expect(id).toMatch(/^scene-\d+-\d+$/);
  });

  it("returns string matching /^sub-\\d+-\\d+$/ with sub prefix", () => {
    const id = genId("sub");
    expect(id).toMatch(/^sub-\d+-\d+$/);
  });

  it("returns string matching /^audio-\\d+-\\d+$/ with audio prefix", () => {
    const id = genId("audio");
    expect(id).toMatch(/^audio-\d+-\d+$/);
  });

  it("produces 1000 unique IDs in a tight loop", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(genId("x"));
    }
    expect(ids.size).toBe(1000);
  });
});
