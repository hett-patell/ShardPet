import { describe, test, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  pruneHostnames,
  MAX_TRACKED_HOSTNAMES,
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
      workThresholdMinutes: 15,
      showTimerIndicator: false,
      favorites: []
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

  test("clamps count to 1..5", () => {
    expect(mergeSettings({ count: 0 as 1 }).count).toBe(1);
    expect(mergeSettings({ count: 9 as 1 }).count).toBe(5);
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

  test("lowercases blacklist/allowlist entries (location.hostname is always lc)", () => {
    const merged = mergeSettings({
      blacklist: ["GitHub.com", "MAIL.example.com"],
      allowlist: ["Notion.so"]
    });
    expect(merged.blacklist).toEqual(["github.com", "mail.example.com"]);
    expect(merged.allowlist).toEqual(["notion.so"]);
  });

  test("trims and drops blank hostname entries", () => {
    const merged = mergeSettings({ blacklist: ["  github.com  ", "", "   "] });
    expect(merged.blacklist).toEqual(["github.com"]);
  });
});

describe("pruneHostnames", () => {
  test("returns the same object when entries fit under the cap", () => {
    const raw = { "a.com": 10, "b.com": 20, "c.com": 30 };
    expect(pruneHostnames(raw, 10)).toBe(raw);
  });

  test("keeps the top-N highest-elapsed entries when over the cap", () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < 50; i++) raw[`site-${i}.com`] = i;
    const pruned = pruneHostnames(raw, 5);
    expect(Object.keys(pruned)).toHaveLength(5);
    expect(pruned["site-49.com"]).toBe(49);
    expect(pruned["site-45.com"]).toBe(45);
    expect(pruned["site-44.com"]).toBeUndefined();
    expect(pruned["site-0.com"]).toBeUndefined();
  });

  test("MAX_TRACKED_HOSTNAMES is reasonable (within an order of magnitude of 100)", () => {
    expect(MAX_TRACKED_HOSTNAMES).toBeGreaterThan(10);
    expect(MAX_TRACKED_HOSTNAMES).toBeLessThan(1000);
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
