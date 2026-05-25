export type Speed = "slow" | "normal" | "fast";
export type ReducedMotion = "auto" | "off" | "on";

export type Settings = {
  enabled: boolean;
  count: 1 | 2 | 3 | 4 | 5;
  sizePx: number;
  speed: Speed;
  verticalOffsetPx: number;
  blacklist: string[];
  reducedMotion: ReducedMotion;
  allowlist: string[];
  productivityNagEnabled: boolean;
  workThresholdMinutes: number;
  showTimerIndicator: boolean;
  favorites: number[];
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
};

export const MAX_TRACKED_HOSTNAMES = 100;

export const DEFAULT_WORK_TIMERS: WorkTimers = {
  hostnamesElapsed: {},
  cooldownUntilMs: 0
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Hostnames as reported by location.hostname are always lowercase, so we
// normalise list entries here too — otherwise "GitHub.com" in the allowlist
// would silently never match a real navigation. Doing it in mergeSettings
// also heals legacy mixed-case data from earlier versions on next read.
const normaliseHostList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === "string")
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0)
    : [];

export function mergeSettings(partial: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
  const count = clamp(s.count, 1, 5) as 1 | 2 | 3 | 4 | 5;
  const sizePx = clamp(s.sizePx, 24, 128);
  const verticalOffsetPx = clamp(s.verticalOffsetPx, 0, 40);
  const blacklist = normaliseHostList(s.blacklist);
  const allowlist = normaliseHostList(s.allowlist);
  const workThresholdMinutes = clamp(s.workThresholdMinutes, 1, 120);
  const favorites = Array.isArray(s.favorites) ? s.favorites.filter(x => typeof x === "number") : [];
  return { ...s, count, sizePx, verticalOffsetPx, blacklist, allowlist, workThresholdMinutes, favorites };
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

export function pruneHostnames(
  raw: Record<string, number>,
  cap: number = MAX_TRACKED_HOSTNAMES
): Record<string, number> {
  const entries = Object.entries(raw);
  if (entries.length <= cap) return raw;
  // Cap to top-N most-elapsed hostnames so a long history of one-off visits
  // doesn't slowly bloat chrome.storage.local forever.
  return Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, cap));
}

export async function loadWorkTimers(): Promise<WorkTimers> {
  const got = await chrome.storage.local.get("workTimers");
  const t = got.workTimers as Partial<WorkTimers> | undefined;
  if (!t) return { ...DEFAULT_WORK_TIMERS };
  const raw =
    t.hostnamesElapsed && typeof t.hostnamesElapsed === "object"
      ? (t.hostnamesElapsed as Record<string, number>)
      : {};
  return {
    hostnamesElapsed: pruneHostnames(raw),
    cooldownUntilMs: typeof t.cooldownUntilMs === "number" ? t.cooldownUntilMs : 0
  };
}

export async function saveWorkTimers(t: WorkTimers): Promise<void> {
  await chrome.storage.local.set({ workTimers: t });
}
