import {
  DEFAULT_SETTINGS,
  DEFAULT_WORK_TIMERS,
  loadSettings,
  loadSpriteCache,
  saveSettings,
  saveWorkTimers,
  type Settings
} from "../storage";
import { POKEMON_LIST } from "../pokemon-list";
import {
  initialWanderState,
  stepWanderState,
  hopOffsetPx,
  speedForSetting,
  type WanderState
} from "../wander";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// ---------- form elements ----------

const enabledEl = $<HTMLInputElement>("enabled");
const countEl = $<HTMLInputElement>("count");
const countOut = $<HTMLOutputElement>("count-out");
const sizeEl = $<HTMLInputElement>("size");
const sizeOut = $<HTMLOutputElement>("size-out");
const offsetEl = $<HTMLInputElement>("offset");
const offsetOut = $<HTMLOutputElement>("offset-out");
const blacklistEl = $<HTMLTextAreaElement>("blacklist");
const nagEnabledEl = $<HTMLInputElement>("nag-enabled");
const thresholdEl = $<HTMLInputElement>("threshold");
const thresholdOut = $<HTMLOutputElement>("threshold-out");
const allowlistEl = $<HTMLTextAreaElement>("allowlist");
const indicatorEl = $<HTMLInputElement>("indicator");
const favoritesEl = $<HTMLTextAreaElement>("favorites");
const resyncBtn = $<HTMLButtonElement>("resync");
const resetTimersBtn = $<HTMLButtonElement>("reset-timers");
const statusEl = $<HTMLSpanElement>("status");
const versionLabel = document.getElementById("version-label");
const brandMark = $<HTMLImageElement>("brand-mark");

// Segmented radio groups (replace the old <select>s).
const speedRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="speed"]')
);
const reducedRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="reduced"]')
);

// ---------- version label ----------

if (versionLabel) {
  try {
    versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch {
    /* non-extension context (e.g. unit tests) */
  }
}

// ---------- helpers ----------

const splitLines = (text: string): string[] =>
  text.split("\n").map(s => s.trim()).filter(s => s.length > 0);

// Hostnames as reported by location.hostname are always lowercase, so we
// normalise user-typed entries the same way — otherwise "GitHub.com" in the
// allowlist would silently never match a real navigation to "github.com".
const splitHostnames = (text: string): string[] =>
  splitLines(text).map(s => s.toLowerCase());

const readRadioValue = <T extends string>(
  radios: ReadonlyArray<HTMLInputElement>,
  fallback: T
): T => {
  const checked = radios.find(r => r.checked);
  return (checked ? checked.value : fallback) as T;
};

const writeRadioValue = (
  radios: ReadonlyArray<HTMLInputElement>,
  value: string
): void => {
  for (const r of radios) r.checked = r.value === value;
};

function applyToForm(s: Settings): void {
  enabledEl.checked = s.enabled;
  countEl.value = String(s.count);
  countOut.value = String(s.count);
  sizeEl.value = String(s.sizePx);
  sizeOut.value = `${s.sizePx}px`;
  offsetEl.value = String(s.verticalOffsetPx);
  offsetOut.value = `${s.verticalOffsetPx}px`;
  writeRadioValue(speedRadios, s.speed);
  writeRadioValue(reducedRadios, s.reducedMotion);
  blacklistEl.value = s.blacklist.join("\n");
  favoritesEl.value = s.favorites.join("\n");
  nagEnabledEl.checked = s.productivityNagEnabled;
  thresholdEl.value = String(s.workThresholdMinutes);
  thresholdOut.value = `${s.workThresholdMinutes} min`;
  allowlistEl.value = s.allowlist.join("\n");
  indicatorEl.checked = s.showTimerIndicator;
}

function readForm(): Settings {
  return {
    enabled: enabledEl.checked,
    count: Number(countEl.value) as 1 | 2 | 3 | 4 | 5,
    sizePx: Number(sizeEl.value),
    verticalOffsetPx: Number(offsetEl.value),
    speed: readRadioValue(speedRadios, "normal"),
    reducedMotion: readRadioValue(reducedRadios, "auto"),
    blacklist: splitHostnames(blacklistEl.value),
    favorites: splitLines(favoritesEl.value).map(Number).filter(n => !isNaN(n) && n > 0),
    allowlist: splitHostnames(allowlistEl.value),
    productivityNagEnabled: nagEnabledEl.checked,
    workThresholdMinutes: Number(thresholdEl.value),
    showTimerIndicator: indicatorEl.checked
  };
}

async function persist(): Promise<void> {
  const s = readForm();
  await saveSettings(s);
  applyToForm(s);
  schedulePreviewRefresh();
}

// ---------- persistence wiring ----------

let settingsHydrated = false;

const formEls: HTMLElement[] = [
  enabledEl, countEl, sizeEl, offsetEl, blacklistEl,
  nagEnabledEl, thresholdEl, allowlistEl, indicatorEl, favoritesEl,
  ...speedRadios, ...reducedRadios
];

for (const el of formEls) {
  el.addEventListener("change", () => void persist());
  if (el instanceof HTMLInputElement && el.type === "range") {
    el.addEventListener("input", () => {
      if (el === countEl) countOut.value = countEl.value;
      if (el === sizeEl) sizeOut.value = `${sizeEl.value}px`;
      if (el === offsetEl) offsetOut.value = `${offsetEl.value}px`;
      if (el === thresholdEl) thresholdOut.value = `${thresholdEl.value} min`;
      // Range "input" fires continuously while dragging — refresh preview
      // visually without persisting on every micro-event. "change" still
      // persists at the end of the drag.
      schedulePreviewRefresh();
    });
  }
}

// ---------- action buttons ----------

resetTimersBtn.addEventListener("click", async () => {
  resetTimersBtn.disabled = true;
  try {
    await saveWorkTimers({ ...DEFAULT_WORK_TIMERS });
    statusEl.textContent = "Work-timer state cleared.";
  } catch (e) {
    statusEl.textContent = `Error: ${String(e)}`;
  } finally {
    resetTimersBtn.disabled = false;
  }
});

resyncBtn.addEventListener("click", async () => {
  resyncBtn.disabled = true;
  statusEl.textContent = "Fetching…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "RESYNC_SPRITES" });
    statusEl.textContent = res?.ok ? `Synced ${res.count} sprites.` : "Sync failed.";
    // New cache likely available — refresh both the brand mark and the preview.
    cachedSpriteUrls = null;
    void loadPreviewSprites();
  } catch (e) {
    statusEl.textContent = `Error: ${String(e)}`;
  } finally {
    resyncBtn.disabled = false;
  }
});

async function reportCacheHealth(): Promise<void> {
  if (statusEl.textContent && statusEl.textContent.length > 0) return;
  try {
    const cache = await loadSpriteCache();
    const have = cache ? Object.keys(cache.byId).length : 0;
    const total = POKEMON_LIST.length;
    if (have === 0) {
      statusEl.textContent = "Sprite cache is empty — try Resync.";
    } else if (have < total * 0.9) {
      statusEl.textContent = `Cache incomplete (${have}/${total}). Try Resync.`;
    }
  } catch {
    /* ignore — popup can render without cache info */
  }
}

// ---------- brand mark (Pikachu in header) ----------

const BRAND_POKEMON_ID = 25;

async function loadBrandMark(): Promise<void> {
  try {
    const cache = await loadSpriteCache();
    const url = cache?.byId[BRAND_POKEMON_ID];
    if (!url) return;
    brandMark.src = url;
    brandMark.dataset.loaded = "1";
  } catch {
    /* brand mark is decorative; silently skip on failure */
  }
}

// ---------- live preview ----------

const previewEl = $<HTMLDivElement>("preview");
const previewEmptyEl = $<HTMLDivElement>("preview-empty");

type PreviewSprite = {
  id: number;
  url: string;
  img: HTMLImageElement;
  state: WanderState;
};

let previewSprites: PreviewSprite[] = [];
let previewRaf = 0;
let previewLastFrame = 0;
let cachedSpriteUrls: Record<number, string> | null = null;
let previewRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const PREVIEW_FRAME_BUDGET_MS = 1000 / 30;
// The popup is 340 px wide, the preview is the section body minus padding
// (~292 px), and we cap sprite size during preview so a 128-px Snorlax
// doesn't eclipse the whole strip. Real on-page sprites are still 128 px.
const PREVIEW_MAX_SPRITE_PX = 40;
const PREVIEW_HEIGHT_PX = 80;

function previewWidth(): number {
  // getBoundingClientRect width minus the 4-px ground stripe margin.
  return Math.max(120, Math.floor(previewEl.getBoundingClientRect().width));
}

function previewSpritePx(s: Settings): number {
  // Scale the real sprite size into the preview while preserving relative
  // perception of "small / medium / huge" pets.
  const scale = Math.min(1, PREVIEW_MAX_SPRITE_PX / 80);
  return Math.max(20, Math.min(PREVIEW_MAX_SPRITE_PX, Math.round(s.sizePx * scale)));
}

function clearPreviewSprites(): void {
  for (const p of previewSprites) p.img.remove();
  previewSprites = [];
}

function pickPreviewIds(
  cache: Record<number, string>,
  count: number,
  favorites: ReadonlyArray<number>
): number[] {
  const all = Object.keys(cache).map(Number);
  if (all.length === 0) return [];
  // Favor the user's favorites if any are in the cache; otherwise pick
  // uniformly. Snorlax (id 143) is filtered because it's immobile and a
  // static sprite makes the preview feel dead.
  const favsInCache = favorites.filter(id => cache[id] !== undefined && id !== 143);
  const pool = favsInCache.length > 0 ? favsInCache : all.filter(id => id !== 143);
  if (pool.length === 0) return all.slice(0, count);

  const picked: number[] = [];
  const used = new Set<number>();
  while (picked.length < count && used.size < pool.length) {
    const id = pool[Math.floor(Math.random() * pool.length)] as number;
    if (used.has(id)) continue;
    used.add(id);
    picked.push(id);
  }
  return picked;
}

async function loadPreviewSprites(): Promise<void> {
  if (!cachedSpriteUrls) {
    const cache = await loadSpriteCache();
    cachedSpriteUrls = cache?.byId ?? {};
  }
  if (Object.keys(cachedSpriteUrls).length === 0) {
    previewEmptyEl.style.display = "grid";
    clearPreviewSprites();
    stopPreviewLoop();
    return;
  }
  previewEmptyEl.style.display = "none";
  rebuildPreview();
}

function rebuildPreview(): void {
  const s = readForm();
  if (!s.enabled || !cachedSpriteUrls) {
    clearPreviewSprites();
    stopPreviewLoop();
    return;
  }

  const ids = pickPreviewIds(cachedSpriteUrls, s.count, s.favorites);
  if (ids.length === 0) {
    clearPreviewSprites();
    stopPreviewLoop();
    return;
  }

  clearPreviewSprites();
  const px = previewSpritePx(s);
  const w = previewWidth();
  const now = performance.now();

  for (const id of ids) {
    const url = cachedSpriteUrls[id];
    if (!url) continue;
    const img = document.createElement("img");
    img.className = "preview-sprite";
    img.src = url;
    img.alt = "";
    img.draggable = false;
    img.style.width = `${px}px`;
    img.style.height = `${px}px`;
    previewEl.appendChild(img);

    const state = initialWanderState({
      viewportWidth: w,
      spriteWidth: px,
      now,
      rng: Math.random
    });
    previewSprites.push({ id, url, img, state });
  }

  startPreviewLoop();
}

function previewBaseSpeed(s: Settings): number {
  // Mirror content.ts's reduced-motion handling so the preview behaves like
  // the real lane on the page. We can't read prefers-reduced-motion at the
  // settings level without window.matchMedia, which is fine in the popup.
  const base = speedForSetting(s.speed);
  const prefers = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduce = s.reducedMotion === "on" || (s.reducedMotion === "auto" && prefers);
  // Preview area is narrow, so scale the effective speed down so the sprite
  // doesn't ping-pong like a screensaver at "fast".
  return (reduce ? base * 0.5 : base) * 0.4;
}

function startPreviewLoop(): void {
  cancelAnimationFrame(previewRaf);
  previewLastFrame = performance.now();
  const s = readForm();
  const w = previewWidth();
  const px = previewSpritePx(s);
  const baseSpeed = previewBaseSpeed(s);

  const tick = (now: number) => {
    previewRaf = requestAnimationFrame(tick);
    const elapsed = now - previewLastFrame;
    if (elapsed < PREVIEW_FRAME_BUDGET_MS) return;
    previewLastFrame = now;
    const dt = elapsed / 1000;

    for (const p of previewSprites) {
      p.state = stepWanderState(p.state, {
        dt,
        viewportWidth: w,
        spriteWidth: px,
        now,
        rng: Math.random,
        baseSpeed
      });
      const yOff = hopOffsetPx(p.state, now);
      const flip = p.state.dir === -1 ? -1 : 1;
      p.img.style.transform = `translate3d(${p.state.x}px, ${yOff}px, 0) scaleX(${flip})`;
    }
  };
  previewRaf = requestAnimationFrame(tick);
}

function stopPreviewLoop(): void {
  cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

// Debounce preview rebuilds so dragging a slider doesn't thrash the DOM.
function schedulePreviewRefresh(): void {
  if (previewRefreshTimer !== null) clearTimeout(previewRefreshTimer);
  previewRefreshTimer = setTimeout(() => {
    previewRefreshTimer = null;
    rebuildPreview();
  }, 90);
}

// Pause the preview when the popup isn't visible (it shouldn't normally
// matter — popups close on blur — but Chrome occasionally keeps them open
// in inspect-mode and the preview would just burn CPU).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    stopPreviewLoop();
    if (settingsHydrated) void persist();
  } else if (previewSprites.length > 0) {
    startPreviewLoop();
  }
});

// Preview dimensions depend on layout — re-init once the popup is laid out.
const previewObserver = new ResizeObserver(() => {
  if (previewSprites.length > 0) {
    const w = previewWidth();
    for (const p of previewSprites) {
      // Keep sprites in-bounds after a resize without restarting the loop.
      const maxX = Math.max(0, w - parseFloat(p.img.style.width || "32"));
      if (p.state.x > maxX) p.state.x = maxX;
    }
  }
});
previewObserver.observe(previewEl);

// ---------- bootstrap ----------

(async () => {
  const s = await loadSettings();
  applyToForm({ ...DEFAULT_SETTINGS, ...s });
  settingsHydrated = true;
  void reportCacheHealth();
  void loadBrandMark();
  void loadPreviewSprites();
})();
