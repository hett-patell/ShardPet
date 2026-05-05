import type { Speed } from "./storage";

export type Mode = "walk" | "idle" | "hop";

export type WanderState = {
  x: number;
  vx: number;
  dir: 1 | -1;
  mode: Mode;
  nextDecisionAt: number;
  hopUntil: number;
};

export type StepInput = {
  dt: number;
  viewportWidth: number;
  spriteWidth: number;
  now: number;
  rng: () => number;
  baseSpeed: number;
};

export function speedForSetting(s: Speed): number {
  switch (s) {
    case "slow": return 25;
    case "normal": return 50;
    case "fast": return 90;
  }
}

export function decideNextMode(input: { now: number; dir: 1 | -1; rng: () => number }): {
  mode: Mode;
  vxScale: number;
  dir: 1 | -1;
  nextDecisionAt: number;
  hopUntil: number;
} {
  const r = input.rng();
  const decisionDelayMs = 1500 + input.rng() * 2500;
  const nextDecisionAt = input.now + decisionDelayMs;
  if (r < 0.6) {
    const newDir: 1 | -1 = input.rng() < 0.5 ? 1 : -1;
    return { mode: "walk", vxScale: newDir, dir: newDir, nextDecisionAt, hopUntil: 0 };
  }
  if (r < 0.85) {
    return { mode: "idle", vxScale: 0, dir: input.dir, nextDecisionAt, hopUntil: 0 };
  }
  return {
    mode: "hop",
    vxScale: input.dir,
    dir: input.dir,
    nextDecisionAt,
    hopUntil: input.now + 250
  };
}

export function initialWanderState(input: {
  viewportWidth: number;
  spriteWidth: number;
  now: number;
  rng: () => number;
}): WanderState {
  const x = (input.viewportWidth - input.spriteWidth) * input.rng();
  const dir: 1 | -1 = input.rng() < 0.5 ? 1 : -1;
  return {
    x,
    vx: dir,
    dir,
    mode: "walk",
    nextDecisionAt: input.now + 1500 + input.rng() * 2500,
    hopUntil: 0
  };
}

export function stepWanderState(state: WanderState, input: StepInput): WanderState {
  let { x, vx, dir, mode, nextDecisionAt, hopUntil } = state;

  if (input.now >= nextDecisionAt) {
    const decision = decideNextMode({ now: input.now, dir, rng: input.rng });
    mode = decision.mode;
    dir = decision.dir;
    vx = decision.vxScale * input.baseSpeed;
    nextDecisionAt = decision.nextDecisionAt;
    hopUntil = decision.hopUntil;
  } else {
    if (mode === "walk" || mode === "hop") {
      vx = dir * input.baseSpeed;
    } else {
      vx = 0;
    }
  }

  if (mode !== "idle") {
    x += vx * input.dt;
  }

  const minX = 0;
  const maxX = Math.max(0, input.viewportWidth - input.spriteWidth);
  if (x <= minX) {
    x = minX;
    dir = 1;
    vx = input.baseSpeed;
    mode = "walk";
  } else if (x >= maxX) {
    x = maxX;
    dir = -1;
    vx = -input.baseSpeed;
    mode = "walk";
  }

  if (mode === "hop" && input.now > hopUntil) {
    mode = "walk";
  }

  return { x, vx, dir, mode, nextDecisionAt, hopUntil };
}

export function hopOffsetPx(state: WanderState, now: number): number {
  if (state.mode !== "hop" || now > state.hopUntil) return 0;
  const total = 250;
  const remaining = state.hopUntil - now;
  const t = 1 - remaining / total;
  const arc = Math.sin(t * Math.PI);
  return -arc * 6;
}
