import { describe, test, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type Settings,
  type SpriteCache,
  CURRENT_CACHE_VERSION
} from "../src/storage";

describe("DEFAULT_SETTINGS", () => {
  test("matches the current defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      enabled: true,
      count: 1,
      sizePx: 80,
      speed: "normal",
      verticalOffsetPx: 8,
      blacklist: [],
      reducedMotion: "auto",
      allowlist: [],
      productivityNagEnabled: true,
      workThresholdMinutes: 5,
      showTimerIndicator: false
    });
  });
});

describe("mergeSettings", () => {
  test("returns defaults when given undefined", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  test("overrides only provided fields", () => {
    const partial: Partial<Settings> = { count: 3, sizePx: 50 };
    const merged = mergeSettings(partial);
    expect(merged.count).toBe(3);
    expect(merged.sizePx).toBe(50);
    expect(merged.enabled).toBe(true);
    expect(merged.blacklist).toEqual([]);
  });

  test("clamps count to 1..3", () => {
    expect(mergeSettings({ count: 0 as 1 }).count).toBe(1);
    expect(mergeSettings({ count: 9 as 1 }).count).toBe(3);
  });

  test("clamps sizePx to 24..128", () => {
    expect(mergeSettings({ sizePx: 10 }).sizePx).toBe(24);
    expect(mergeSettings({ sizePx: 999 }).sizePx).toBe(128);
  });

  test("preserves non-empty blacklist arrays", () => {
    const merged = mergeSettings({ blacklist: ["mail.example.com"] });
    expect(merged.blacklist).toEqual(["mail.example.com"]);
  });

  test("preserves non-empty allowlist arrays", () => {
    const merged = mergeSettings({ allowlist: ["github.com", "docs.example.com"] });
    expect(merged.allowlist).toEqual(["github.com", "docs.example.com"]);
  });

  test("clamps workThresholdMinutes to 1..120", () => {
    expect(mergeSettings({ workThresholdMinutes: 0 }).workThresholdMinutes).toBe(1);
    expect(mergeSettings({ workThresholdMinutes: 9999 }).workThresholdMinutes).toBe(120);
  });
});

describe("SpriteCache version", () => {
  test("CURRENT_CACHE_VERSION is a positive integer", () => {
    expect(Number.isInteger(CURRENT_CACHE_VERSION)).toBe(true);
    expect(CURRENT_CACHE_VERSION).toBeGreaterThan(0);
  });

  test("SpriteCache type allows expected shape", () => {
    const cache: SpriteCache = {
      version: CURRENT_CACHE_VERSION,
      fetchedAt: Date.now(),
      byId: { 25: "data:image/gif;base64,xxx" }
    };
    expect(cache.byId[25]).toContain("data:image/gif");
  });
});
