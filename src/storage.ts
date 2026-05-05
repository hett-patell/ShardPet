export type Speed = "slow" | "normal" | "fast";
export type ReducedMotion = "auto" | "off" | "on";

export type Settings = {
  enabled: boolean;
  count: 1 | 2 | 3;
  sizePx: number;
  speed: Speed;
  verticalOffsetPx: number;
  blacklist: string[];
  reducedMotion: ReducedMotion;
  allowlist: string[];
  productivityNagEnabled: boolean;
  workThresholdMinutes: number;
};

export type WorkTimers = {
  hostnamesElapsed: Record<string, number>;
  cooldownUntilMs: number;
};

export type SpriteCache = {
  version: number;
  fetchedAt: number;
  byId: Record<number, string>;
};

export const CURRENT_CACHE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  count: 1,
  sizePx: 56,
  speed: "normal",
  verticalOffsetPx: 8,
  blacklist: [],
  reducedMotion: "auto",
  allowlist: [],
  productivityNagEnabled: true,
  workThresholdMinutes: 5
};

export const DEFAULT_WORK_TIMERS: WorkTimers = {
  hostnamesElapsed: {},
  cooldownUntilMs: 0
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function mergeSettings(partial: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
  const count = clamp(s.count, 1, 3) as 1 | 2 | 3;
  const sizePx = clamp(s.sizePx, 24, 64);
  const verticalOffsetPx = clamp(s.verticalOffsetPx, 0, 40);
  const blacklist = Array.isArray(s.blacklist) ? s.blacklist.filter(x => typeof x === "string") : [];
  const allowlist = Array.isArray(s.allowlist) ? s.allowlist.filter(x => typeof x === "string") : [];
  const workThresholdMinutes = clamp(s.workThresholdMinutes, 1, 120);
  return { ...s, count, sizePx, verticalOffsetPx, blacklist, allowlist, workThresholdMinutes };
}

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get("settings");
  return mergeSettings(got.settings as Partial<Settings> | undefined);
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: mergeSettings(s) });
}

export async function loadSpriteCache(): Promise<SpriteCache | null> {
  const got = await chrome.storage.local.get("spriteCache");
  const c = got.spriteCache as SpriteCache | undefined;
  if (!c || c.version !== CURRENT_CACHE_VERSION) return null;
  return c;
}

export async function saveSpriteCache(c: SpriteCache): Promise<void> {
  await chrome.storage.local.set({ spriteCache: c });
}

export async function loadWorkTimers(): Promise<WorkTimers> {
  const got = await chrome.storage.local.get("workTimers");
  const t = got.workTimers as Partial<WorkTimers> | undefined;
  if (!t) return { ...DEFAULT_WORK_TIMERS };
  return {
    hostnamesElapsed:
      t.hostnamesElapsed && typeof t.hostnamesElapsed === "object"
        ? (t.hostnamesElapsed as Record<string, number>)
        : {},
    cooldownUntilMs: typeof t.cooldownUntilMs === "number" ? t.cooldownUntilMs : 0
  };
}

export async function saveWorkTimers(t: WorkTimers): Promise<void> {
  await chrome.storage.local.set({ workTimers: t });
}
