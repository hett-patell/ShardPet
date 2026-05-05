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
let pokemons: Pokemon[] = [];
let rafId = 0;
let lastFrame = 0;
let baseSpeed = 50;
let settings: Settings | null = null;
let cache: SpriteCache | null = null;

let workTimers: WorkTimers = { ...DEFAULT_WORK_TIMERS };
let workTickIntervalId: ReturnType<typeof setInterval> | null = null;
let lastVisibleTickMs = 0;
let overlayHandles: OverlayHandles | null = null;

const FRAME_BUDGET_MS = 1000 / 30;
const WORK_TICK_INTERVAL_MS = 5_000;
const DISMISS_COOLDOWN_SECONDS = 5 * 60;

async function main(): Promise<void> {
  settings = await loadSettings();
  cache = await loadSpriteCache();
  workTimers = await loadWorkTimers();

  startWorkTimer();

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

function isBlacklisted(s: Settings, hostname: string): boolean {
  return s.blacklist.some(domain => hostname === domain || hostname.endsWith("." + domain));
}

function mount(s: Settings, c: SpriteCache): void {
  host = document.createElement("div");
  host.id = "shardpet-host";
  host.style.cssText = "all: initial; position: fixed; left: 0; right: 0; bottom: 0; height: 80px; z-index: 2147483647; pointer-events: none;";
  shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = stylesText;
  shadow.appendChild(style);

  lane = document.createElement("div");
  lane.className = "poke-lane";
  shadow.appendChild(lane);

  document.documentElement.appendChild(host);

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
      resumeWorkTimer();
    }
  });

  window.addEventListener("pagehide", () => {
    stopLoop();
    pauseWorkTimer();
    if (host) host.remove();
    if (overlayHandles) overlayHandles.destroy();
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
      workTimers = changes.workTimers.newValue as WorkTimers;
    }
  });
}

function startWorkTimer(): void {
  if (workTickIntervalId !== null) return;
  if (document.visibilityState === "hidden") {
    console.info("[ShardPet] timer not started (tab hidden); will start on visibilitychange");
    return;
  }
  lastVisibleTickMs = performance.now();
  workTickIntervalId = setInterval(() => void runWorkTick(), WORK_TICK_INTERVAL_MS);
  console.info(`[ShardPet] timer started, tick every ${WORK_TICK_INTERVAL_MS}ms`);
}

function pauseWorkTimer(): void {
  if (workTickIntervalId === null) return;
  void runWorkTick();
  clearInterval(workTickIntervalId);
  workTickIntervalId = null;
}

function resumeWorkTimer(): void {
  if (workTickIntervalId !== null) return;
  lastVisibleTickMs = performance.now();
  workTickIntervalId = setInterval(() => void runWorkTick(), WORK_TICK_INTERVAL_MS);
  console.info("[ShardPet] timer resumed");
}

async function runWorkTick(): Promise<void> {
  if (!settings) {
    console.info("[ShardPet] tick skipped: settings not loaded");
    return;
  }
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
  await saveWorkTimers(workTimers);

  const accumulated = workTimers.hostnamesElapsed[hostname] ?? 0;
  const cooldownRemainingMs = Math.max(0, workTimers.cooldownUntilMs - Date.now());
  console.info(
    `[ShardPet] tick host=${hostname} allowlisted=${isAllowlisted} ` +
    `accumulated=${accumulated.toFixed(0)}s threshold=${thresholdSeconds}s ` +
    `cooldownLeft=${(cooldownRemainingMs / 1000).toFixed(0)}s ` +
    `trigger=${result.shouldTrigger}`
  );

  if (result.shouldTrigger) {
    triggerNagOverlay();
  }
}

function triggerNagOverlay(): void {
  if (overlayHandles) return;
  if (!settings) return;
  if (!cache || Object.keys(cache.byId).length === 0) return;

  const ids = Object.keys(cache.byId).map(Number);
  if (ids.length === 0) return;
  const id = ids[Math.floor(Math.random() * ids.length)] as number;
  const url = cache.byId[id];
  if (!url) return;

  overlayHandles = mountOverlay({
    spriteDataUrl: url,
    hostname: location.hostname,
    thresholdMinutes: settings.workThresholdMinutes,
    onDismiss: () => {
      overlayHandles = null;
      workTimers = applyDismiss(workTimers, {
        nowMs: Date.now(),
        cooldownSeconds: DISMISS_COOLDOWN_SECONDS
      });
      void saveWorkTimers(workTimers);
    }
  });
}

async function reloadSettings(): Promise<void> {
  const s = await loadSettings();
  settings = s;
  if (!s.enabled || isBlacklisted(s, location.hostname)) {
    teardown();
    return;
  }
  if (!host) {
    if (cache) mount(s, cache);
    return;
  }
  baseSpeed = speedForSetting(s.speed);
  applyReducedMotion(s, baseSpeed);
  if (cache) spawnPokemons(s, cache);
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
