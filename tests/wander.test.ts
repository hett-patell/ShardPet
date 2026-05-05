import { describe, test, expect } from "vitest";
import {
  initialWanderState,
  stepWanderState,
  decideNextMode,
  speedForSetting,
  type WanderState
} from "../src/wander";

describe("speedForSetting", () => {
  test("maps slow/normal/fast to documented px/s", () => {
    expect(speedForSetting("slow")).toBe(25);
    expect(speedForSetting("normal")).toBe(50);
    expect(speedForSetting("fast")).toBe(90);
  });
});

describe("initialWanderState", () => {
  test("places sprite within viewport bounds", () => {
    const s = initialWanderState({ viewportWidth: 800, spriteWidth: 40, now: 1000, rng: () => 0.5 });
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(800 - 40);
    expect(s.mode).toBe("walk");
  });
});

describe("stepWanderState", () => {
  test("advances x by vx*dt while walking", () => {
    const state: WanderState = {
      x: 100, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.1, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.x).toBeCloseTo(95, 5);
  });

  test("does not advance while idle", () => {
    const state: WanderState = {
      x: 100, vx: 0, dir: 1, mode: "idle",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.5, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.x).toBe(100);
  });

  test("bounces at the left edge", () => {
    const state: WanderState = {
      x: 0, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.2, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.dir).toBe(1);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.x).toBeGreaterThanOrEqual(0);
  });

  test("bounces at the right edge", () => {
    const state: WanderState = {
      x: 760, vx: 50, dir: 1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.2, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.dir).toBe(-1);
    expect(out.vx).toBeLessThan(0);
    expect(out.x).toBeLessThanOrEqual(800 - 40);
  });

  test("triggers decideNextMode when nextDecisionAt elapses", () => {
    const state: WanderState = {
      x: 100, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 1000, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.016, viewportWidth: 800, spriteWidth: 40, now: 1500, rng: () => 0.0, baseSpeed: 50
    });
    expect(out.nextDecisionAt).toBeGreaterThan(1500);
  });
});

describe("decideNextMode", () => {
  test("rng < 0.6 yields walk_*", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.1 });
    expect(next.mode).toBe("walk");
  });

  test("rng in [0.6, 0.85) yields idle", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.7 });
    expect(next.mode).toBe("idle");
  });

  test("rng >= 0.85 yields hop", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.95 });
    expect(next.mode).toBe("hop");
  });

  test("schedules next decision in the future", () => {
    const next = decideNextMode({ now: 1000, dir: 1, rng: () => 0.5 });
    expect(next.nextDecisionAt).toBeGreaterThan(1000);
  });
});
