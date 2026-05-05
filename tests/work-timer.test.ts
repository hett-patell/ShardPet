import { describe, test, expect } from "vitest";
import {
  isHostnameMatched,
  tickWorkTimer,
  applyDismiss,
  type WorkTimerInput
} from "../src/work-timer";
import { DEFAULT_WORK_TIMERS } from "../src/storage";

describe("isHostnameMatched", () => {
  test("exact hostname match", () => {
    expect(isHostnameMatched("github.com", ["github.com"])).toBe(true);
  });

  test("subdomain matches base domain", () => {
    expect(isHostnameMatched("docs.github.com", ["github.com"])).toBe(true);
  });

  test("base domain does NOT match subdomain entry", () => {
    expect(isHostnameMatched("github.com", ["docs.github.com"])).toBe(false);
  });

  test("unrelated hostname does not match", () => {
    expect(isHostnameMatched("example.com", ["github.com"])).toBe(false);
  });

  test("partial substring does not match", () => {
    expect(isHostnameMatched("github.com.evil.com", ["github.com"])).toBe(false);
  });

  test("empty list never matches", () => {
    expect(isHostnameMatched("github.com", [])).toBe(false);
  });
});

describe("tickWorkTimer", () => {
  const baseInput = (overrides: Partial<WorkTimerInput>): WorkTimerInput => ({
    hostname: "reddit.com",
    isAllowlisted: false,
    deltaSeconds: 30,
    nowMs: 1_000_000,
    thresholdSeconds: 300,
    ...overrides
  });

  test("increments hostname counter when not allowlisted", () => {
    const start = { ...DEFAULT_WORK_TIMERS };
    const result = tickWorkTimer(start, baseInput({}));
    expect(result.state.hostnamesElapsed["reddit.com"]).toBe(30);
    expect(result.shouldTrigger).toBe(false);
  });

  test("accumulates across multiple ticks", () => {
    let state = { ...DEFAULT_WORK_TIMERS };
    for (let i = 0; i < 5; i++) {
      state = tickWorkTimer(state, baseInput({})).state;
    }
    expect(state.hostnamesElapsed["reddit.com"]).toBe(150);
  });

  test("triggers when accumulated reaches threshold", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 280 },
      cooldownUntilMs: 0
    };
    const result = tickWorkTimer(state, baseInput({ deltaSeconds: 30 }));
    expect(result.shouldTrigger).toBe(true);
    expect(result.state.hostnamesElapsed["reddit.com"]).toBeGreaterThanOrEqual(300);
  });

  test("does NOT trigger while in cooldown", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 280 },
      cooldownUntilMs: 2_000_000
    };
    const result = tickWorkTimer(state, baseInput({ deltaSeconds: 30, nowMs: 1_500_000 }));
    expect(result.shouldTrigger).toBe(false);
  });

  test("triggers again after cooldown elapses", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 320 },
      cooldownUntilMs: 1_000_000
    };
    const result = tickWorkTimer(state, baseInput({ nowMs: 1_500_000 }));
    expect(result.shouldTrigger).toBe(true);
  });

  test("resets hostname counter when allowlisted", () => {
    const state = {
      hostnamesElapsed: { "github.com": 200 },
      cooldownUntilMs: 0
    };
    const result = tickWorkTimer(state, baseInput({
      hostname: "github.com",
      isAllowlisted: true
    }));
    expect(result.state.hostnamesElapsed["github.com"]).toBe(0);
    expect(result.shouldTrigger).toBe(false);
  });

  test("does not modify other hostnames' counters", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 100, "twitter.com": 200 },
      cooldownUntilMs: 0
    };
    const result = tickWorkTimer(state, baseInput({ hostname: "reddit.com" }));
    expect(result.state.hostnamesElapsed["twitter.com"]).toBe(200);
    expect(result.state.hostnamesElapsed["reddit.com"]).toBe(130);
  });

  test("ignores zero or negative deltaSeconds", () => {
    const state = { ...DEFAULT_WORK_TIMERS };
    const result = tickWorkTimer(state, baseInput({ deltaSeconds: -5 }));
    expect(result.state.hostnamesElapsed["reddit.com"] ?? 0).toBe(0);
  });
});

describe("applyDismiss", () => {
  test("sets cooldownUntilMs to nowMs + cooldownSeconds*1000", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 320 },
      cooldownUntilMs: 0
    };
    const out = applyDismiss(state, { nowMs: 1_000_000, cooldownSeconds: 300 });
    expect(out.cooldownUntilMs).toBe(1_000_000 + 300_000);
  });

  test("does not erase the per-hostname counter", () => {
    const state = {
      hostnamesElapsed: { "reddit.com": 320 },
      cooldownUntilMs: 0
    };
    const out = applyDismiss(state, { nowMs: 1_000_000, cooldownSeconds: 300 });
    expect(out.hostnamesElapsed["reddit.com"]).toBe(320);
  });
});
