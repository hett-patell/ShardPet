import {
  DEFAULT_SETTINGS,
  DEFAULT_WORK_TIMERS,
  loadSettings,
  saveSettings,
  saveWorkTimers,
  type Settings
} from "../storage";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

const enabledEl = $<HTMLInputElement>("enabled");
const countEl = $<HTMLInputElement>("count");
const countOut = $<HTMLOutputElement>("count-out");
const sizeEl = $<HTMLInputElement>("size");
const sizeOut = $<HTMLOutputElement>("size-out");
const offsetEl = $<HTMLInputElement>("offset");
const offsetOut = $<HTMLOutputElement>("offset-out");
const speedEl = $<HTMLSelectElement>("speed");
const reducedEl = $<HTMLSelectElement>("reduced");
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

function applyToForm(s: Settings): void {
  enabledEl.checked = s.enabled;
  countEl.value = String(s.count);
  countOut.value = String(s.count);
  sizeEl.value = String(s.sizePx);
  sizeOut.value = `${s.sizePx}px`;
  offsetEl.value = String(s.verticalOffsetPx);
  offsetOut.value = `${s.verticalOffsetPx}px`;
  speedEl.value = s.speed;
  reducedEl.value = s.reducedMotion;
  blacklistEl.value = s.blacklist.join("\n");
  favoritesEl.value = s.favorites.join("\n");
  nagEnabledEl.checked = s.productivityNagEnabled;
  thresholdEl.value = String(s.workThresholdMinutes);
  thresholdOut.value = `${s.workThresholdMinutes} min`;
  allowlistEl.value = s.allowlist.join("\n");
  indicatorEl.checked = s.showTimerIndicator;
}

const splitLines = (text: string): string[] =>
  text.split("\n").map(s => s.trim()).filter(s => s.length > 0);

function readForm(): Settings {
  return {
    enabled: enabledEl.checked,
    count: Number(countEl.value) as 1 | 2 | 3,
    sizePx: Number(sizeEl.value),
    verticalOffsetPx: Number(offsetEl.value),
    speed: speedEl.value as Settings["speed"],
    reducedMotion: reducedEl.value as Settings["reducedMotion"],
    blacklist: splitLines(blacklistEl.value),
    favorites: splitLines(favoritesEl.value).map(Number).filter(n => !isNaN(n) && n > 0),
    allowlist: splitLines(allowlistEl.value),
    productivityNagEnabled: nagEnabledEl.checked,
    workThresholdMinutes: Number(thresholdEl.value),
    showTimerIndicator: indicatorEl.checked
  };
}

async function persist(): Promise<void> {
  const s = readForm();
  await saveSettings(s);
  applyToForm(s);
}

const formEls: HTMLElement[] = [
  enabledEl, countEl, sizeEl, offsetEl, speedEl, reducedEl, blacklistEl,
  nagEnabledEl, thresholdEl, allowlistEl, indicatorEl, favoritesEl
];

for (const el of formEls) {
  el.addEventListener("change", () => void persist());
  if (el instanceof HTMLInputElement && el.type === "range") {
    el.addEventListener("input", () => {
      if (el === countEl) countOut.value = countEl.value;
      if (el === sizeEl) sizeOut.value = `${sizeEl.value}px`;
      if (el === offsetEl) offsetOut.value = `${offsetEl.value}px`;
      if (el === thresholdEl) thresholdOut.value = `${thresholdEl.value} min`;
    });
  }
}

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
  } catch (e) {
    statusEl.textContent = `Error: ${String(e)}`;
  } finally {
    resyncBtn.disabled = false;
  }
});

(async () => {
  const s = await loadSettings();
  applyToForm({ ...DEFAULT_SETTINGS, ...s });
})();
