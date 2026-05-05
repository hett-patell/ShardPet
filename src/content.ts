import {
  DEFAULT_WORK_TIMERS,
  loadSettings,
  loadSpriteCache,
  loadWorkTimers,
  saveWorkTimers,
  type Settings,
  type SpriteCache,
  type WorkTimers
} from "./storage";
import {
  initialWanderState,
  stepWanderState,
  hopOffsetPx,
  speedForSetting,
  type WanderState
} from "./wander";
import {
  applyDismiss,
  isHostnameMatched,
  tickWorkTimer
} from "./work-timer";
import { mountOverlay, type OverlayHandles } from "./overlay";
import stylesText from "./styles.css?raw";

if (window.top === window.self && !document.documentElement.dataset.shardpetMounted) {
  document.documentElement.dataset.shardpetMounted = "1";
  void main();
}

type Pokemon = {
  id: number;
  el: HTMLImageElement;
  state: WanderState;
};

let host: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let lane: HTMLDivElement | null = null;
let indicator: HTMLDivElement | null = null;
let indicatorHost: HTMLDivElement | null = null;
let pokemons: Pokemon[] = [];
let rafId = 0;
let lastFrame = 0;
let baseSpeed = 50;
let settings: Settings | null = null;
let cache: SpriteCache | null = null;

let workTimers: WorkTimers = { ...DEFAULT_WORK_TIMERS };
let workTickIntervalId: ReturnType<typeof setInterval> | null = null;
let lastVisibleTickMs = 0;
let lastWorkPersistMs = 0;
let workTimersDirty = false;
let overlayHandles: OverlayHandles | null = null;
let suppressNextStorageEvent = false;

const FRAME_BUDGET_MS = 1000 / 30;
const WORK_TICK_INTERVAL_MS = 5_000;
const WORK_PERSIST_INTERVAL_MS = 30_000;
const DISMISS_COOLDOWN_SECONDS = 5 * 60;

async function main(): Promise<void> {
  settings = await loadSettings();
  cache = await loadSpriteCache();
  workTimers = await loadWorkTimers();

  syncWorkTimerLifecycle();

  if (!settings.enabled) {
    attachLifecycle();
    return;
  }
  if (isBlacklisted(settings, location.hostname)) {
    attachLifecycle();
    return;
  }
  if (!cache || Object.keys(cache.byId).length === 0) {
    attachLifecycle();
    return;
  }

  mount(settings, cache);
  attachLifecycle();
}

function syncWorkTimerLifecycle(): void {
  const shouldRun =
    !!settings &&
    settings.productivityNagEnabled &&
    document.visibilityState !== "hidden";
  if (shouldRun) startWorkTimer();
  else pauseWorkTimer();
}

function isBlacklisted(s: Settings, hostname: string): boolean {
  return s.blacklist.some(domain => hostname === domain || hostname.endsWith("." + domain));
}

function laneHeightPx(s: Settings): number {
  return Math.max(80, s.sizePx + s.verticalOffsetPx + 16);
}

function applyLaneHeight(s: Settings): void {
  if (!host || !lane) return;
  const h = laneHeightPx(s);
  host.style.height = `${h}px`;
  lane.style.height = `${h}px`;
}

function mount(s: Settings, c: SpriteCache): void {
  host = document.createElement("div");
  host.id = "shardpet-host";
  host.style.cssText = "all: initial; position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483647; pointer-events: none;";
  shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = stylesText;
  shadow.appendChild(style);

  lane = document.createElement("div");
  lane.className = "poke-lane";
  shadow.appendChild(lane);

  document.documentElement.appendChild(host);

  applyLaneHeight(s);

  baseSpeed = speedForSetting(s.speed);
  applyReducedMotion(s, baseSpeed);
  spawnPokemons(s, c);
  startLoop();
}

function applyReducedMotion(s: Settings, base: number): void {
  const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduce =
    s.reducedMotion === "on" ||
    (s.reducedMotion === "auto" && prefers);
  baseSpeed = reduce ? base * 0.5 : base;
}

function pickRandomId(c: SpriteCache, exclude?: number): number {
  const all = Object.keys(c.byId).map(Number);
  if (all.length === 0) throw new Error("sprite cache is empty");
  const filtered = exclude === undefined ? all : all.filter(id => id !== exclude);
  const pool = filtered.length > 0 ? filtered : all;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return pick as number;
}

function spawnPokemons(s: Settings, c: SpriteCache): void {
  if (!lane) return;
  for (const p of pokemons) p.el.remove();
  pokemons = [];

  const vw = window.innerWidth;
  for (let i = 0; i < s.count; i++) {
    const id = pickRandomId(c);
    const url = c.byId[id];
    if (!url) continue;
    const el = document.createElement("img");
    el.className = "poke";
    el.src = url;
    el.style.setProperty("--poke-size", `${s.sizePx}px`);
    el.style.setProperty("--poke-bottom", `${s.verticalOffsetPx}px`);
    el.alt = "";
    el.draggable = false;
    el.addEventListener("click", () => rerollPokemon(i));
    lane.appendChild(el);

    const state = initialWanderState({
      viewportWidth: vw,
      spriteWidth: s.sizePx,
      now: performance.now(),
      rng: Math.random
    });
    pokemons.push({ id, el, state });
  }
}

function rerollPokemon(index: number): void {
  const p = pokemons[index];
  if (!cache || !p) return;
  const newId = pickRandomId(cache, p.id);
  const url = cache.byId[newId];
  if (!url) return;
  p.id = newId;
  p.el.src = url;
}

function startLoop(): void {
  cancelAnimationFrame(rafId);
  lastFrame = performance.now();
  const tick = (now: number) => {
    rafId = requestAnimationFrame(tick);
    const elapsed = now - lastFrame;
    if (elapsed < FRAME_BUDGET_MS) return;
    const dt = elapsed / 1000;
    lastFrame = now;
    if (!settings) return;
    const vw = window.innerWidth;
    for (const p of pokemons) {
      p.state = stepWanderState(p.state, {
        dt,
        viewportWidth: vw,
        spriteWidth: settings.sizePx,
        now,
        rng: Math.random,
        baseSpeed
      });
      const yOff = hopOffsetPx(p.state, now);
      const flip = p.state.dir === -1 ? -1 : 1;
      p.el.style.transform = `translate3d(${p.state.x}px, ${yOff}px, 0) scaleX(${flip})`;
    }
  };
  rafId = requestAnimationFrame(tick);
}

function stopLoop(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function attachLifecycle(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      stopLoop();
      pauseWorkTimer();
    } else {
      startLoop();
      syncWorkTimerLifecycle();
    }
  });

  window.addEventListener("pagehide", () => {
    stopLoop();
    pauseWorkTimer();
    if (host) host.remove();
    if (overlayHandles) overlayHandles.destroy();
    teardownIndicator();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) {
      void reloadSettings();
    }
    if (changes.spriteCache) {
      void reloadCache();
    }
    if (changes.workTimers && changes.workTimers.newValue) {
      if (suppressNextStorageEvent) {
        suppressNextStorageEvent = false;
      } else {
        workTimers = changes.workTimers.newValue as WorkTimers;
      }
    }
  });
}

function startWorkTimer(): void {
  if (workTickIntervalId !== null) return;
  if (!settings || !settings.productivityNagEnabled) return;
  if (document.visibilityState === "hidden") return;
  lastVisibleTickMs = performance.now();
  workTickIntervalId = setInterval(() => void runWorkTick(), WORK_TICK_INTERVAL_MS);
}

function pauseWorkTimer(): void {
  if (workTickIntervalId === null) return;
  void runWorkTick({ forcePersist: true });
  clearInterval(workTickIntervalId);
  workTickIntervalId = null;
}

async function persistWorkTimers(): Promise<void> {
  workTimersDirty = false;
  lastWorkPersistMs = performance.now();
  suppressNextStorageEvent = true;
  await saveWorkTimers(workTimers);
}

async function runWorkTick(opts?: { forcePersist?: boolean }): Promise<void> {
  if (!settings) return;
  if (!settings.productivityNagEnabled) return;
  if (overlayHandles) return;

  const now = performance.now();
  const deltaSeconds = Math.max(0, (now - lastVisibleTickMs) / 1000);
  lastVisibleTickMs = now;

  const hostname = location.hostname;
  if (!hostname) return;

  const isAllowlisted = isHostnameMatched(hostname, settings.allowlist);
  const thresholdSeconds = settings.workThresholdMinutes * 60;

  const result = tickWorkTimer(workTimers, {
    hostname,
    isAllowlisted,
    deltaSeconds,
    nowMs: Date.now(),
    thresholdSeconds
  });

  workTimers = result.state;
  if (deltaSeconds > 0) workTimersDirty = true;

  const accumulated = workTimers.hostnamesElapsed[hostname] ?? 0;
  const cooldownRemainingMs = Math.max(0, workTimers.cooldownUntilMs - Date.now());

  updateIndicator(hostname, isAllowlisted, accumulated, thresholdSeconds, cooldownRemainingMs);

  const shouldFlush =
    workTimersDirty &&
    (opts?.forcePersist ||
      result.shouldTrigger ||
      now - lastWorkPersistMs >= WORK_PERSIST_INTERVAL_MS);
  if (shouldFlush) {
    await persistWorkTimers();
  }

  if (result.shouldTrigger) {
    triggerNagOverlay();
  }
}

function ensureIndicator(): void {
  if (!settings || !settings.showTimerIndicator) {
    teardownIndicator();
    return;
  }
  if (indicator) return;

  indicatorHost = document.createElement("div");
  indicatorHost.id = "shardpet-indicator-host";
  indicatorHost.style.cssText =
    "all: initial; position: fixed; top: 8px; right: 8px; z-index: 2147483647; pointer-events: none;";
  const ishadow = indicatorHost.attachShadow({ mode: "closed" });
  const istyle = document.createElement("style");
  istyle.textContent = `
    .ind {
      font: 600 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      color: #fff;
      background: rgba(10, 12, 18, 0.78);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      letter-spacing: 0.02em;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25);
    }
    .ind.allowed { background: rgba(20, 90, 40, 0.85); }
    .ind.cooldown { background: rgba(120, 70, 0, 0.85); }
  `;
  ishadow.appendChild(istyle);
  indicator = document.createElement("div");
  indicator.className = "ind";
  indicator.textContent = "ShardPet…";
  ishadow.appendChild(indicator);
  document.documentElement.appendChild(indicatorHost);
}

function teardownIndicator(): void {
  if (indicatorHost) indicatorHost.remove();
  indicatorHost = null;
  indicator = null;
}

function fmtSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r.toString().padStart(2, "0")}s`;
}

function updateIndicator(
  hostname: string,
  isAllowlisted: boolean,
  accumulatedSec: number,
  thresholdSec: number,
  cooldownMs: number
): void {
  ensureIndicator();
  if (!indicator) return;
  if (isAllowlisted) {
    indicator.className = "ind allowed";
    indicator.textContent = `${hostname} • allowlisted`;
    return;
  }
  if (cooldownMs > 0) {
    indicator.className = "ind cooldown";
    indicator.textContent = `${hostname} • cooldown ${fmtSeconds(cooldownMs / 1000)}`;
    return;
  }
  indicator.className = "ind";
  indicator.textContent = `${hostname} • ${fmtSeconds(accumulatedSec)} / ${fmtSeconds(thresholdSec)}`;
}

function triggerNagOverlay(): void {
  if (overlayHandles) return;
  if (!settings) return;
  if (!cache || Object.keys(cache.byId).length === 0) return;

  const urls = Object.values(cache.byId).filter((u): u is string => typeof u === "string");
  if (urls.length === 0) return;

  overlayHandles = mountOverlay({
    spriteDataUrls: urls,
    hostname: location.hostname,
    thresholdMinutes: settings.workThresholdMinutes,
    onDismiss: () => {
      overlayHandles = null;
      workTimers = applyDismiss(workTimers, {
        nowMs: Date.now(),
        cooldownSeconds: DISMISS_COOLDOWN_SECONDS,
        hostname: location.hostname
      });
      workTimersDirty = true;
      void persistWorkTimers();
    }
  });
}

function visualSettingsChanged(prev: Settings | null, next: Settings): boolean {
  if (!prev) return true;
  return (
    prev.enabled !== next.enabled ||
    prev.count !== next.count ||
    prev.sizePx !== next.sizePx ||
    prev.verticalOffsetPx !== next.verticalOffsetPx ||
    prev.speed !== next.speed ||
    prev.reducedMotion !== next.reducedMotion ||
    prev.blacklist.join("|") !== next.blacklist.join("|")
  );
}

async function reloadSettings(): Promise<void> {
  const s = await loadSettings();
  const prev = settings;
  settings = s;

  if (!s.showTimerIndicator) teardownIndicator();
  syncWorkTimerLifecycle();

  if (!s.enabled || isBlacklisted(s, location.hostname)) {
    teardown();
    return;
  }
  if (!host) {
    if (cache) mount(s, cache);
    return;
  }
  if (!visualSettingsChanged(prev, s)) return;

  baseSpeed = speedForSetting(s.speed);
  applyReducedMotion(s, baseSpeed);
  applyLaneHeight(s);

  const needsRespawn =
    !prev || prev.count !== s.count || prev.sizePx !== s.sizePx;
  if (cache && needsRespawn) {
    spawnPokemons(s, cache);
  } else if (prev && prev.verticalOffsetPx !== s.verticalOffsetPx) {
    for (const p of pokemons) {
      p.el.style.setProperty("--poke-bottom", `${s.verticalOffsetPx}px`);
    }
  }
}

async function reloadCache(): Promise<void> {
  cache = await loadSpriteCache();
  if (settings && cache && host) spawnPokemons(settings, cache);
}

function teardown(): void {
  stopLoop();
  if (host) host.remove();
  host = null;
  shadow = null;
  lane = null;
  pokemons = [];
}
