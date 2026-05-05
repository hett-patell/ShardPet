import type { WorkTimers } from "./storage";

export type WorkTimerInput = {
  hostname: string;
  isAllowlisted: boolean;
  deltaSeconds: number;
  nowMs: number;
  thresholdSeconds: number;
};

export type WorkTimerResult = {
  state: WorkTimers;
  shouldTrigger: boolean;
};

export function isHostnameMatched(hostname: string, list: ReadonlyArray<string>): boolean {
  return list.some(entry => hostname === entry || hostname.endsWith("." + entry));
}

export function tickWorkTimer(state: WorkTimers, input: WorkTimerInput): WorkTimerResult {
  const next: WorkTimers = {
    hostnamesElapsed: { ...state.hostnamesElapsed },
    cooldownUntilMs: state.cooldownUntilMs
  };

  if (input.isAllowlisted) {
    next.hostnamesElapsed[input.hostname] = 0;
    return { state: next, shouldTrigger: false };
  }

  if (input.deltaSeconds > 0) {
    const prev = next.hostnamesElapsed[input.hostname] ?? 0;
    next.hostnamesElapsed[input.hostname] = prev + input.deltaSeconds;
  }

  const accumulated = next.hostnamesElapsed[input.hostname] ?? 0;
  const inCooldown = input.nowMs < state.cooldownUntilMs;
  const shouldTrigger = !inCooldown && accumulated >= input.thresholdSeconds;
  return { state: next, shouldTrigger };
}

export function applyDismiss(
  state: WorkTimers,
  input: { nowMs: number; cooldownSeconds: number }
): WorkTimers {
  return {
    hostnamesElapsed: { ...state.hostnamesElapsed },
    cooldownUntilMs: input.nowMs + input.cooldownSeconds * 1000
  };
}
