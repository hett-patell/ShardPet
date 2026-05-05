# poke-shard Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Manifest V3 Chromium browser extension that displays 1–3 tiny pixel Pokémon walking along the bottom of every web page, configurable via an options page, with strict performance discipline.

**Architecture:** TypeScript + Vite + `@crxjs/vite-plugin` build. A service worker fetches Gen 5 BW animated GIFs from PokéAPI's CDN once on install and caches them as data URLs in `chrome.storage.local`. A content script mounts a Shadow-DOM-isolated bottom lane on top frames only and runs a single `requestAnimationFrame` loop (frame-skipped to ~30fps) that updates `transform: translate3d` for each Pokémon. An options page binds form controls to `chrome.storage.local` and lets the user resync sprites.

**Tech Stack:** TypeScript (strict), Vite 5+, `@crxjs/vite-plugin` v2, Vitest for unit tests, plain HTML/CSS for the options page (no UI framework).

**Spec:** See `docs/specs/2026-05-05-poke-shard-extension-design.md`.

---

## File Structure

| Path | Responsibility |
| ---- | -------------- |
| `package.json`, `tsconfig.json`, `vite.config.ts` | Build + tooling config |
| `manifest.json` | MV3 manifest (input to crxjs) |
| `src/pokemon-list.ts` | Curated 24 Pokémon ids (data only) |
| `src/storage.ts` | Typed `chrome.storage.local` wrappers + defaults |
| `src/sprite-fetcher.ts` | Pure functions to fetch + convert sprite GIFs to data URLs |
| `src/background.ts` | Service worker: onInstalled handler + resync message handler |
| `src/wander.ts` | Pure motion state machine (testable in isolation) |
| `src/content.ts` | Content script: Shadow DOM mount, render Pokémon, drive `wander` |
| `src/styles.css` | Shadow-DOM-scoped lane and sprite styles |
| `src/options/index.html` | Options page markup |
| `src/options/options.ts` | Options page logic: bind form to storage |
| `tests/wander.test.ts` | Vitest unit tests for `wander.ts` |
| `tests/storage.test.ts` | Vitest unit tests for `storage.ts` defaults/merging |
| `tests/sprite-fetcher.test.ts` | Vitest unit tests for blob→dataURL conversion |
| `README.md`, `LICENSE` | Project docs and MIT license |
| `.gitignore` | Standard Node/Vite ignores |

Tests cover the three pure modules. The DOM-heavy content script and Chrome-API-heavy background script are verified by manual acceptance steps in Task 13.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `.gitignore`
- Create: `manifest.json`
- Create: `src/main-placeholder.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "poke-shard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.25",
    "@types/chrome": "^0.0.268",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0",
    "jsdom": "^24.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" assert { type: "json" };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: "esnext",
    rollupOptions: { input: { options: "src/options/index.html" } }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
dist/
.vite/
*.log
.DS_Store
```

- [ ] **Step 5: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "poke-shard",
  "version": "0.1.0",
  "description": "Tiny pixel Pokemon wandering along the bottom of your screen.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://raw.githubusercontent.com/PokeAPI/sprites/*"
  ],
  "background": {
    "service_worker": "src/background.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content.ts"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "options_page": "src/options/index.html"
}
```

- [ ] **Step 6: Create a placeholder source file so the install + typecheck succeed**

`src/main-placeholder.ts`:

```ts
export {};
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` and `package-lock.json` created.

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore manifest.json src/main-placeholder.ts
git commit -m "chore: scaffold typescript + vite + crxjs project"
```

---

## Task 2: Curated Pokémon list

**Files:**
- Create: `src/pokemon-list.ts`

- [ ] **Step 1: Create the curated list**

`src/pokemon-list.ts`:

```ts
export type PokemonEntry = { id: number; name: string };

export const POKEMON_LIST: ReadonlyArray<PokemonEntry> = [
  { id: 1,   name: "bulbasaur" },
  { id: 4,   name: "charmander" },
  { id: 7,   name: "squirtle" },
  { id: 25,  name: "pikachu" },
  { id: 35,  name: "clefairy" },
  { id: 39,  name: "jigglypuff" },
  { id: 50,  name: "diglett" },
  { id: 54,  name: "psyduck" },
  { id: 92,  name: "gastly" },
  { id: 104, name: "cubone" },
  { id: 133, name: "eevee" },
  { id: 143, name: "snorlax" },
  { id: 147, name: "dratini" },
  { id: 152, name: "chikorita" },
  { id: 155, name: "cyndaquil" },
  { id: 158, name: "totodile" },
  { id: 196, name: "espeon" },
  { id: 197, name: "umbreon" },
  { id: 252, name: "treecko" },
  { id: 255, name: "torchic" },
  { id: 258, name: "mudkip" },
  { id: 282, name: "gardevoir" },
  { id: 387, name: "turtwig" },
  { id: 448, name: "lucario" }
];

export const SPRITE_URL = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/pokemon-list.ts
git commit -m "feat: add curated 24-pokemon list and sprite URL helper"
```

---

## Task 3: Storage module (TDD)

**Files:**
- Create: `tests/storage.test.ts`
- Create: `src/storage.ts`

- [ ] **Step 1: Write failing tests**

`tests/storage.test.ts`:

```ts
import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type Settings,
  type SpriteCache,
  CURRENT_CACHE_VERSION
} from "../src/storage";

describe("DEFAULT_SETTINGS", () => {
  test("matches the spec defaults", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      enabled: true,
      count: 1,
      sizePx: 40,
      speed: "normal",
      verticalOffsetPx: 8,
      blacklist: [],
      reducedMotion: "auto"
    });
  });
});

describe("mergeSettings", () => {
  test("returns defaults when given undefined", () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  test("overrides only provided fields", () => {
    const partial: Partial<Settings> = { count: 3, sizePx: 50 };
    const merged = mergeSettings(partial);
    expect(merged.count).toBe(3);
    expect(merged.sizePx).toBe(50);
    expect(merged.enabled).toBe(true);
    expect(merged.blacklist).toEqual([]);
  });

  test("clamps count to 1..3", () => {
    expect(mergeSettings({ count: 0 as 1 }).count).toBe(1);
    expect(mergeSettings({ count: 9 as 1 }).count).toBe(3);
  });

  test("clamps sizePx to 24..64", () => {
    expect(mergeSettings({ sizePx: 10 }).sizePx).toBe(24);
    expect(mergeSettings({ sizePx: 999 }).sizePx).toBe(64);
  });

  test("preserves non-empty blacklist arrays", () => {
    const merged = mergeSettings({ blacklist: ["mail.example.com"] });
    expect(merged.blacklist).toEqual(["mail.example.com"]);
  });
});

describe("SpriteCache version", () => {
  test("CURRENT_CACHE_VERSION is a positive integer", () => {
    expect(Number.isInteger(CURRENT_CACHE_VERSION)).toBe(true);
    expect(CURRENT_CACHE_VERSION).toBeGreaterThan(0);
  });

  test("SpriteCache type allows expected shape", () => {
    const cache: SpriteCache = {
      version: CURRENT_CACHE_VERSION,
      fetchedAt: Date.now(),
      byId: { 25: "data:image/gif;base64,xxx" }
    };
    expect(cache.byId[25]).toContain("data:image/gif");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- storage`
Expected: FAIL with "Cannot find module '../src/storage'".

- [ ] **Step 3: Implement `src/storage.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- storage`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add tests/storage.test.ts src/storage.ts
git commit -m "feat: add typed storage wrappers with defaults + clamping"
```

---

## Task 4: Sprite fetcher (TDD)

**Files:**
- Create: `tests/sprite-fetcher.test.ts`
- Create: `src/sprite-fetcher.ts`

- [ ] **Step 1: Write failing tests**

`tests/sprite-fetcher.test.ts`:

```ts
import { describe, test, expect, vi, beforeEach } from "vitest";
import { blobToDataUrl, fetchSprite, fetchAllSprites } from "../src/sprite-fetcher";

describe("blobToDataUrl", () => {
  test("converts a Blob to a data URL", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/gif" });
    const url = await blobToDataUrl(blob);
    expect(url.startsWith("data:image/gif;base64,")).toBe(true);
  });
});

describe("fetchSprite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns a data URL on success", async () => {
    const blob = new Blob([new Uint8Array([9, 9, 9])], { type: "image/gif" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(blob, { status: 200 })));
    const url = await fetchSprite(25);
    expect(url).toMatch(/^data:image\/gif;base64,/);
  });

  test("throws on non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(fetchSprite(99999)).rejects.toThrow(/404/);
  });
});

describe("fetchAllSprites", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("returns a record keyed by id and skips failures", async () => {
    const ok = new Blob([new Uint8Array([1])], { type: "image/gif" });
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      call += 1;
      if (call === 2) return new Response("nope", { status: 500 });
      return new Response(ok, { status: 200 });
    }));
    const out = await fetchAllSprites([1, 4, 7]);
    expect(Object.keys(out).length).toBe(2);
    expect(out[1]).toMatch(/^data:image\/gif;/);
    expect(out[7]).toMatch(/^data:image\/gif;/);
    expect(out[4]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- sprite-fetcher`
Expected: FAIL with "Cannot find module '../src/sprite-fetcher'".

- [ ] **Step 3: Implement `src/sprite-fetcher.ts`**

```ts
import { SPRITE_URL } from "./pokemon-list";

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function fetchSprite(id: number): Promise<string> {
  const res = await fetch(SPRITE_URL(id));
  if (!res.ok) throw new Error(`sprite ${id} failed: ${res.status}`);
  const blob = await res.blob();
  return await blobToDataUrl(blob);
}

export async function fetchAllSprites(ids: ReadonlyArray<number>): Promise<Record<number, string>> {
  const results = await Promise.allSettled(ids.map(async id => [id, await fetchSprite(id)] as const));
  const byId: Record<number, string> = {};
  for (const r of results) {
    if (r.status === "fulfilled") {
      const [id, url] = r.value;
      byId[id] = url;
    }
  }
  return byId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- sprite-fetcher`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/sprite-fetcher.test.ts src/sprite-fetcher.ts
git commit -m "feat: add resilient sprite fetcher with blob->data URL conversion"
```

---

## Task 5: Background service worker

**Files:**
- Create: `src/background.ts`
- Delete: `src/main-placeholder.ts`

- [ ] **Step 1: Implement `src/background.ts`**

```ts
import { POKEMON_LIST } from "./pokemon-list";
import { fetchAllSprites } from "./sprite-fetcher";
import { saveSpriteCache, CURRENT_CACHE_VERSION, loadSpriteCache } from "./storage";

const RESYNC_MESSAGE = "RESYNC_SPRITES";

async function syncSprites(): Promise<{ ok: boolean; count: number }> {
  const ids = POKEMON_LIST.map(p => p.id);
  const byId = await fetchAllSprites(ids);
  const count = Object.keys(byId).length;
  if (count === 0) return { ok: false, count: 0 };
  await saveSpriteCache({
    version: CURRENT_CACHE_VERSION,
    fetchedAt: Date.now(),
    byId
  });
  return { ok: true, count };
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await loadSpriteCache();
  if (existing && Object.keys(existing.byId).length > 0) return;
  try {
    await syncSprites();
  } catch (e) {
    console.warn("[poke-shard] initial sprite sync failed", e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const existing = await loadSpriteCache();
  if (existing && Object.keys(existing.byId).length > 0) return;
  try {
    await syncSprites();
  } catch (e) {
    console.warn("[poke-shard] startup sprite sync failed", e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === RESYNC_MESSAGE) {
    syncSprites()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, count: 0, error: String(err) }));
    return true;
  }
  return false;
});
```

- [ ] **Step 2: Remove the placeholder**

Run: `rm src/main-placeholder.ts`

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/background.ts
git rm src/main-placeholder.ts
git commit -m "feat: add background service worker with install + resync sync"
```

---

## Task 6: Wander state machine (TDD)

**Files:**
- Create: `tests/wander.test.ts`
- Create: `src/wander.ts`

- [ ] **Step 1: Write failing tests**

`tests/wander.test.ts`:

```ts
import { describe, test, expect } from "vitest";
import {
  initialWanderState,
  stepWanderState,
  decideNextMode,
  speedForSetting,
  type WanderState
} from "../src/wander";

describe("speedForSetting", () => {
  test("maps slow/normal/fast to documented px/s", () => {
    expect(speedForSetting("slow")).toBe(25);
    expect(speedForSetting("normal")).toBe(50);
    expect(speedForSetting("fast")).toBe(90);
  });
});

describe("initialWanderState", () => {
  test("places sprite within viewport bounds", () => {
    const s = initialWanderState({ viewportWidth: 800, spriteWidth: 40, now: 1000, rng: () => 0.5 });
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(800 - 40);
    expect(s.mode).toBe("walk");
  });
});

describe("stepWanderState", () => {
  test("advances x by vx*dt while walking", () => {
    const state: WanderState = {
      x: 100, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.1, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.x).toBeCloseTo(95, 5);
  });

  test("does not advance while idle", () => {
    const state: WanderState = {
      x: 100, vx: 0, dir: 1, mode: "idle",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.5, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.x).toBe(100);
  });

  test("bounces at the left edge", () => {
    const state: WanderState = {
      x: 0, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.2, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.dir).toBe(1);
    expect(out.vx).toBeGreaterThan(0);
    expect(out.x).toBeGreaterThanOrEqual(0);
  });

  test("bounces at the right edge", () => {
    const state: WanderState = {
      x: 760, vx: 50, dir: 1, mode: "walk",
      nextDecisionAt: 999_999, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.2, viewportWidth: 800, spriteWidth: 40, now: 0, rng: () => 0.5, baseSpeed: 50
    });
    expect(out.dir).toBe(-1);
    expect(out.vx).toBeLessThan(0);
    expect(out.x).toBeLessThanOrEqual(800 - 40);
  });

  test("triggers decideNextMode when nextDecisionAt elapses", () => {
    const state: WanderState = {
      x: 100, vx: -50, dir: -1, mode: "walk",
      nextDecisionAt: 1000, hopUntil: 0
    };
    const out = stepWanderState(state, {
      dt: 0.016, viewportWidth: 800, spriteWidth: 40, now: 1500, rng: () => 0.0, baseSpeed: 50
    });
    expect(out.nextDecisionAt).toBeGreaterThan(1500);
  });
});

describe("decideNextMode", () => {
  test("rng < 0.6 yields walk_*", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.1 });
    expect(next.mode).toBe("walk");
  });

  test("rng in [0.6, 0.85) yields idle", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.7 });
    expect(next.mode).toBe("idle");
  });

  test("rng >= 0.85 yields hop", () => {
    const next = decideNextMode({ now: 0, dir: 1, rng: () => 0.95 });
    expect(next.mode).toBe("hop");
  });

  test("schedules next decision in the future", () => {
    const next = decideNextMode({ now: 1000, dir: 1, rng: () => 0.5 });
    expect(next.nextDecisionAt).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- wander`
Expected: FAIL with "Cannot find module '../src/wander'".

- [ ] **Step 3: Implement `src/wander.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- wander`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/wander.test.ts src/wander.ts
git commit -m "feat: add pure wander state machine with edge bounce + hop"
```

---

## Task 7: Content script styles

**Files:**
- Create: `src/styles.css`

- [ ] **Step 1: Create the stylesheet**

`src/styles.css`:

```css
:host {
  all: initial;
}

.poke-lane {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80px;
  pointer-events: none;
  z-index: 2147483647;
  overflow: hidden;
}

.poke {
  position: absolute;
  bottom: var(--poke-bottom, 8px);
  left: 0;
  width: var(--poke-size, 40px);
  height: var(--poke-size, 40px);
  pointer-events: auto;
  cursor: pointer;
  image-rendering: pixelated;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .poke[data-respect-reduced-motion="true"] {
    transition: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles.css
git commit -m "feat: add shadow-dom-scoped lane + sprite styles"
```

---

## Task 8: Content script

**Files:**
- Create: `src/content.ts`

- [ ] **Step 1: Implement `src/content.ts`**

```ts
import {
  loadSettings,
  loadSpriteCache,
  type Settings,
  type SpriteCache
} from "./storage";
import {
  initialWanderState,
  stepWanderState,
  hopOffsetPx,
  speedForSetting,
  type WanderState
} from "./wander";
import stylesText from "./styles.css?raw";

if (window.top === window.self && !document.documentElement.dataset.pokeShardMounted) {
  document.documentElement.dataset.pokeShardMounted = "1";
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

const FRAME_BUDGET_MS = 1000 / 30;

async function main(): Promise<void> {
  settings = await loadSettings();
  cache = await loadSpriteCache();
  if (!settings.enabled) return;
  if (isBlacklisted(settings, location.hostname)) return;
  if (!cache || Object.keys(cache.byId).length === 0) return;

  mount(settings, cache);
  attachLifecycle();
}

function isBlacklisted(s: Settings, host: string): boolean {
  return s.blacklist.some(domain => host === domain || host.endsWith("." + domain));
}

function mount(s: Settings, c: SpriteCache): void {
  host = document.createElement("div");
  host.id = "poke-shard-host";
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
    if (document.visibilityState === "hidden") stopLoop();
    else startLoop();
  });

  window.addEventListener("pagehide", () => {
    stopLoop();
    if (host) host.remove();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings) {
      void reloadSettings();
    }
    if (changes.spriteCache) {
      void reloadCache();
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/content.ts
git commit -m "feat: add content script with shadow DOM mount + wander loop"
```

---

## Task 9: Options page

**Files:**
- Create: `src/options/index.html`
- Create: `src/options/options.ts`

- [ ] **Step 1: Create `src/options/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>poke-shard options</title>
    <style>
      body { font: 14px/1.5 system-ui, sans-serif; max-width: 640px; margin: 32px auto; padding: 0 16px; }
      h1 { margin-top: 0; }
      label { display: block; margin: 16px 0 4px; font-weight: 600; }
      input[type="range"] { width: 100%; }
      textarea { width: 100%; min-height: 80px; font-family: monospace; }
      button { padding: 8px 12px; cursor: pointer; }
      .row { display: flex; gap: 12px; align-items: center; }
      .status { margin-left: 12px; color: #666; }
    </style>
  </head>
  <body>
    <h1>poke-shard</h1>

    <div class="row">
      <input type="checkbox" id="enabled" />
      <label for="enabled">Enabled</label>
    </div>

    <label for="count">Number of Pokémon: <output id="count-out"></output></label>
    <input type="range" id="count" min="1" max="3" step="1" />

    <label for="size">Size (px): <output id="size-out"></output></label>
    <input type="range" id="size" min="24" max="64" step="2" />

    <label for="offset">Vertical offset (px): <output id="offset-out"></output></label>
    <input type="range" id="offset" min="0" max="40" step="1" />

    <label for="speed">Speed</label>
    <select id="speed">
      <option value="slow">slow</option>
      <option value="normal">normal</option>
      <option value="fast">fast</option>
    </select>

    <label for="reduced">Reduced motion</label>
    <select id="reduced">
      <option value="auto">auto (follow OS)</option>
      <option value="off">off</option>
      <option value="on">on</option>
    </select>

    <label for="blacklist">Blacklist (one hostname per line)</label>
    <textarea id="blacklist" placeholder="mail.example.com"></textarea>

    <div class="row" style="margin-top:24px">
      <button id="resync">Resync sprites</button>
      <span class="status" id="status"></span>
    </div>

    <p style="margin-top:32px;color:#666;font-size:12px">
      Pokémon sprites © Nintendo / Game Freak / Creatures Inc. Fetched at runtime from PokéAPI's public CDN. Not redistributed by this extension.
    </p>

    <script type="module" src="./options.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/options/options.ts`**

```ts
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
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/options/index.html src/options/options.ts
git commit -m "feat: add options page bound to chrome.storage with resync"
```

---

## Task 10: README and license

**Files:**
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Create `LICENSE`**

```
MIT License

Copyright (c) 2026 hett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create `README.md`**

````markdown
# poke-shard

A tiny Chromium extension that puts pixel Pokémon walking along the bottom of every web page you visit.

- 1–3 Pokémon (default 1)
- Configurable size, speed, vertical offset
- Per-site blacklist
- Pause when tab is hidden
- Shadow-DOM isolated; doesn't break page CSS or click handlers

## Install (developer mode)

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions` (or your Chromium browser's equivalent).
4. Enable **Developer mode**.
5. Click **Load unpacked** and pick the `dist/` folder.

On first install the extension fetches a curated set of Gen 5 BW animated GIFs from PokéAPI's public sprite CDN and caches them in `chrome.storage.local`. After that it works fully offline.

## Configure

Right-click the extension icon → **Options**, or visit `chrome-extension://<id>/src/options/index.html`.

## Performance

- Single `requestAnimationFrame` loop, frame-skipped to ~30fps.
- `transform: translate3d` updates only — no layout thrash.
- Animation paused when the tab is hidden.

## Develop

- `npm run dev` — Vite dev server with HMR for the options page.
- `npm test` — Vitest unit tests.
- `npm run typecheck` — strict TypeScript check.

## Licensing

This extension's source code is MIT-licensed (see `LICENSE`).

Pokémon names and sprites are © Nintendo / Game Freak / Creatures Inc. Sprites are **not** redistributed in this repository — they are fetched at runtime from PokéAPI's public CDN (`https://github.com/PokeAPI/sprites`). This project is an unofficial fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.
````

- [ ] **Step 3: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: add README and MIT license"
```

---

## Task 11: Build verification

**Files:** none modified.

- [ ] **Step 1: Run the production build**

Run: `npm run build`
Expected: completes with exit code 0; produces a `dist/` directory containing `manifest.json`, the bundled service worker, content script, options page, and `styles.css`.

- [ ] **Step 2: Inspect the build output**

Run: `ls -R dist`
Expected output includes (filenames may have hashes):
```
dist/manifest.json
dist/service-worker-loader.js
dist/assets/background-*.js
dist/assets/content-*.js
dist/src/options/index.html
dist/assets/options-*.js
dist/assets/styles-*.css
```

- [ ] **Step 3: Verify no Pokémon sprite assets leaked into the build**

Run: `find dist -name "*.gif" -o -name "*.png" | xargs -r ls -la`
Expected: empty output (no sprite assets bundled).

- [ ] **Step 4: Run all tests one more time**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit any lockfile updates**

Run: `git status`
If `package-lock.json` changed, run:
```bash
git add package-lock.json
git commit -m "chore: refresh lockfile after build verification"
```
Otherwise skip.

---

## Task 12: Manual acceptance check

**Files:** none.

This task is a manual verification pass against the spec's acceptance criteria. No code changes; record any failures as follow-up issues.

- [ ] **Step 1: Load the unpacked build**

In Chrome (or any Chromium browser): `chrome://extensions` → Developer mode → Load unpacked → select `dist/`. Confirm no errors in the extension's "Errors" panel.

- [ ] **Step 2: Verify install fetch**

Click "service worker" link on the extension card to open its DevTools. Run in console:
```js
chrome.storage.local.get("spriteCache", c => console.log(Object.keys(c.spriteCache?.byId ?? {}).length, "sprites cached"))
```
Expected: a number between 20 and 24 (a few may legitimately fail).

- [ ] **Step 3: Verify on-page rendering**

Open `https://example.com`. Within ~1 second a single tiny Pokémon should appear at the bottom-left or bottom-right and start walking. No layout shift on the page; clicking page links still works.

- [ ] **Step 4: Verify click-to-reroll**

Click the Pokémon. Its sprite should change to a different one from the cache.

- [ ] **Step 5: Verify pause when hidden**

Switch to another tab for 5 seconds, then switch back. The Pokémon should resume walking smoothly. Optionally use `chrome://tracing` or DevTools Performance to confirm CPU is ~0% while the tab is hidden.

- [ ] **Step 6: Verify options live-update**

Open Options. Change count to 3, size to 64, speed to fast. Switch back to `https://example.com`. Within ~1 second three larger, faster Pokémon should be walking.

- [ ] **Step 7: Verify blacklist**

Add `example.com` to the blacklist textarea. Reload `https://example.com`. No Pokémon should appear. Remove from blacklist and reload — Pokémon return.

- [ ] **Step 8: Verify resource budget**

Open DevTools → Memory → take a heap snapshot on a typical page (e.g., a news site). The extension's heap delta should be well under 3 MB. The DOM tab should show only the `#poke-shard-host` element added.

- [ ] **Step 9: Verify repo cleanliness**

Run: `find . -name "*.gif" -not -path "./node_modules/*" -not -path "./dist/*"` and `find . -name "*.png" -not -path "./node_modules/*" -not -path "./dist/*"`.
Expected: both empty (no Pokémon sprite assets in the repo source).

- [ ] **Step 10: Tag the release**

If all acceptance steps pass:
```bash
git tag v0.1.0
```
This is a local tag — pushing to GitHub is left to the user.

---

## Done definition

All 12 tasks checked. All Vitest tests pass. Manual acceptance steps in Task 12 pass. The repository contains source code only (no Pokémon sprite assets). The dist build loads cleanly into Chromium and shows tiny Pokémon walking at the bottom of arbitrary websites.
