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
  sizePx: 40,
  speed: "normal",
  verticalOffsetPx: 8,
  blacklist: [],
  reducedMotion: "auto"
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function mergeSettings(partial: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
  const count = clamp(s.count, 1, 3) as 1 | 2 | 3;
  const sizePx = clamp(s.sizePx, 24, 64);
  const verticalOffsetPx = clamp(s.verticalOffsetPx, 0, 40);
  const blacklist = Array.isArray(s.blacklist) ? s.blacklist.filter(x => typeof x === "string") : [];
  return { ...s, count, sizePx, verticalOffsetPx, blacklist };
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
