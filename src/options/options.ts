import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "../storage";

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
const resyncBtn = $<HTMLButtonElement>("resync");
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
}

function readForm(): Settings {
  return {
    enabled: enabledEl.checked,
    count: Number(countEl.value) as 1 | 2 | 3,
    sizePx: Number(sizeEl.value),
    verticalOffsetPx: Number(offsetEl.value),
    speed: speedEl.value as Settings["speed"],
    reducedMotion: reducedEl.value as Settings["reducedMotion"],
    blacklist: blacklistEl.value
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.length > 0)
  };
}

async function persist(): Promise<void> {
  const s = readForm();
  await saveSettings(s);
  applyToForm(s);
}

for (const el of [enabledEl, countEl, sizeEl, offsetEl, speedEl, reducedEl, blacklistEl]) {
  el.addEventListener("change", () => void persist());
  if (el instanceof HTMLInputElement && el.type === "range") {
    el.addEventListener("input", () => {
      if (el === countEl) countOut.value = countEl.value;
      if (el === sizeEl) sizeOut.value = `${sizeEl.value}px`;
      if (el === offsetEl) offsetOut.value = `${offsetEl.value}px`;
    });
  }
}

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
