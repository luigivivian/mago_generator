import { describe, it, expect } from "vitest";
import { srtTimeToFrames, parseSrt } from "@/lib/editor/srt";

describe("srtTimeToFrames", () => {
  it("converts 1 second to 30 frames", () => {
    expect(srtTimeToFrames("00:00:01,000", 30)).toBe(30);
  });

  it("converts 1 minute to 1800 frames", () => {
    expect(srtTimeToFrames("00:01:00,000", 30)).toBe(1800);
  });

  it("converts 1 hour to 108000 frames", () => {
    expect(srtTimeToFrames("01:00:00,000", 30)).toBe(108000);
  });

  it("converts 500ms to 15 frames", () => {
    expect(srtTimeToFrames("00:00:00,500", 30)).toBe(15);
  });
});

describe("parseSrt", () => {
  const validSrt = `1
00:00:00,000 --> 00:00:02,000
Hello world

2
00:00:02,500 --> 00:00:05,000
Second subtitle`;

  it("returns 2 EditorSubtitle objects for valid 2-entry SRT", () => {
    const subs = parseSrt(validSrt, 30);
    expect(subs).toHaveLength(2);
  });

  it("subtitles have IDs matching /^sub-/", () => {
    const subs = parseSrt(validSrt, 30);
    for (const sub of subs) {
      expect(sub.id).toMatch(/^sub-/);
    }
  });

  it("subtitle IDs do not contain Date.now-like 13-digit timestamps alone", () => {
    const subs = parseSrt(validSrt, 30);
    // genId produces prefix-timestamp-counter, so there should be 3 segments
    for (const sub of subs) {
      const parts = sub.id.split("-");
      // Must have at least 3 parts: prefix, timestamp, counter
      expect(parts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("handles \\r\\n line endings", () => {
    const crlfSrt = "1\r\n00:00:00,000 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:02,500 --> 00:00:05,000\r\nWorld";
    const subs = parseSrt(crlfSrt, 30);
    expect(subs).toHaveLength(2);
    expect(subs[0].text).toBe("Hello");
    expect(subs[1].text).toBe("World");
  });

  it("skips malformed blocks with fewer than 3 lines", () => {
    const malformedSrt = `1
00:00:00,000 --> 00:00:02,000
Hello

bad block

3
00:00:03,000 --> 00:00:05,000
Valid`;
    const subs = parseSrt(malformedSrt, 30);
    expect(subs).toHaveLength(2);
  });

  it("sets correct startFrame and endFrame", () => {
    const subs = parseSrt(validSrt, 30);
    expect(subs[0].startFrame).toBe(0);
    expect(subs[0].endFrame).toBe(60); // 2 seconds * 30fps
    expect(subs[1].startFrame).toBe(75); // 2.5 seconds * 30fps
    expect(subs[1].endFrame).toBe(150); // 5 seconds * 30fps
  });
});
