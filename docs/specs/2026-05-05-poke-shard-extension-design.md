# poke-shard — Browser Extension Design

- **Date**: 2026-05-05
- **Status**: Draft (awaiting user review)
- **Author**: hett (with AI collaboration)

## 1. Overview

A lightweight Chromium browser extension that displays tiny pixel/anime-style Pokémon wandering along the bottom edge of every web page. The default is one Pokémon; the user can configure up to three. Built with strict RAM/CPU discipline so it can run on every tab without being noticed.

## 2. Goals

- One small Pokémon visibly walking along the bottom of the viewport on most web pages, by default.
- User can change count (1–3), size, speed, vertical offset, and per-site enable/disable.
- Pixel/anime aesthetic via Gen 5 Black/White animated sprites (canonical walking animations).
- **Performance**: < 3 MB heap per tab, ~0% CPU when tab hidden, < 1% CPU active.
- Fully offline after first run.
- Works on all Chromium browsers (Chrome, Edge, Brave, Helium, Arc, Opera) with no per-browser code.
- Distributable via GitHub: clone or download release zip → Load Unpacked.

## 3. Non-goals (v1)

- Battles, catching, evolutions, persistent companions, or any "game" mechanic.
- Chrome Web Store publication. (Possible later under a non-Pokémon rebrand if desired.)
- Bundling Pokémon sprite assets in the repository. (Sprites are fetched at runtime to keep the repo asset-clean.)
- Firefox / non-Chromium support.
- Cross-device sync of settings.

## 4. User stories

- As a user, I install the extension and immediately see one tiny Pokémon walking along the bottom of every page I visit.
- As a user, I open the options page and increase the count to three.
- As a user, I add `mail.example.com` to the blacklist so Pokémon don't appear in my email tab.
- As a user, I click a Pokémon to reroll which species appears.
- As a user, I drag a Pokémon to nudge its vertical offset on a site that has a sticky footer.

## 5. Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Service Worker (background.ts)                            │
│  - On install: fetch curated sprite GIFs from PokéAPI CDN  │
│  - Cache as data URLs in chrome.storage.local              │
│  - Handle "resync sprites" message from options page       │
└────────────────────────────────────────────────────────────┘
                          │
                          │ chrome.storage.local
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Content Script (content.ts) — runs on top frame only      │
│  - Reads settings + sprite cache                           │
│  - Mounts Shadow-DOM root at document.documentElement      │
│  - Spawns N Pokémon <img> elements                         │
│  - Subscribes to chrome.storage.onChanged for live update  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  wander.ts — single rAF loop @ ~30fps                │  │
│  │  - State per Pokémon: x, vx, dir, nextDecisionAt     │  │
│  │  - transform: translate3d updates only               │  │
│  │  - Pauses on document.visibilityState === 'hidden'   │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Options Page (options/index.html + options.ts)            │
│  - Count, size, speed, vertical offset                     │
│  - Per-site blacklist (textarea, one domain per line)      │
│  - "Resync sprites" button (messages background)           │
│  - Reduced-motion override                                 │
└────────────────────────────────────────────────────────────┘
```

## 6. Components and responsibilities

### `background.ts` (service worker)
- `chrome.runtime.onInstalled`: fetches sprite GIFs for the curated list of Pokémon ids; converts each response to a data URL; writes to `chrome.storage.local` under `spriteCache`.
- Listens for `{ type: "RESYNC_SPRITES" }` messages from the options page and re-runs the fetch.
- Idle otherwise. MV3 service workers terminate when not needed; this is fine.

### `content.ts` (content script)
- Injected via `manifest.content_scripts` with `run_at: document_idle`, `all_frames: false`, `matches: ["<all_urls>"]`.
- Guards: `if (window.top !== window.self) return;` and `if (document.documentElement.dataset.pokeShardMounted) return;`.
- Reads `settings` and `spriteCache` from `chrome.storage.local`.
- If site is blacklisted or extension is disabled: do nothing.
- Otherwise: creates a host element with `position: fixed; left: 0; right: 0; bottom: 0; height: 80px; pointer-events: none; z-index: 2147483647`, attaches a Shadow Root, mounts the lane and sprites inside.
- Subscribes to `chrome.storage.onChanged` for live settings updates (rebuild sprites in place).
- Subscribes to `document.visibilityState` to pause/resume the wander loop.

### `wander.ts` (motion engine)
- One module-level `requestAnimationFrame` loop. Tracks last frame time and skips frames to target ~30fps.
- For each Pokémon, holds `{ id, el, x, vx, dir, nextDecisionAt, hopUntil }`.
- Each frame: advance `x += vx * dt`, clamp to viewport bounds (bounce), apply `transform: translate3d(x, 0, 0)`, optionally `translateY` for hop frames, set `transform: scaleX(±1)` for facing direction.
- Decisions (every 1–4s per Pokémon, jittered): randomly pick walk-left / walk-right / idle / hop.

### `storage.ts`
- Typed wrappers over `chrome.storage.local` for `settings` and `spriteCache`.
- Defaults: `{ enabled: true, count: 1, sizePx: 40, speed: "normal", verticalOffsetPx: 8, blacklist: [], reducedMotion: "auto" }`.

### `options/`
- Plain HTML + TS (no UI framework). Form bound to `chrome.storage.local`.
- "Resync sprites" button posts a message to the background worker.

### `pokemon-list.ts`
- An array of 24 curated Pokémon ids and display names. No sprite bytes — just numeric ids resolved at runtime.

## 7. Data model

```ts
type Settings = {
  enabled: boolean;
  count: 1 | 2 | 3;
  sizePx: number;             // 24..64
  speed: "slow" | "normal" | "fast";
  verticalOffsetPx: number;   // 0..40
  blacklist: string[];        // hostnames
  reducedMotion: "auto" | "off" | "on";
};

type SpriteCache = {
  version: number;            // bump if list/format changes
  fetchedAt: number;          // epoch ms
  byId: Record<number, string>; // pokemonId -> data URL
};
```

Storage keys: `settings`, `spriteCache`.

## 8. Sprite delivery

- **Source**: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/<id>.gif`
- **Curated list**: 24 fan-favorite Pokémon ids (e.g., 1, 4, 7, 25, 133, 143, 196, 197, 282, 448, ...). Final list to be picked during implementation.
- **Fetch flow**:
  1. `onInstalled` triggers `fetchAllSprites(ids)`.
  2. For each id: `fetch(url)` → `blob()` → `FileReader.readAsDataURL` → record in `byId`.
  3. Persist `spriteCache` in one `chrome.storage.local.set` call.
- **Estimated size**: 24 × ~10KB ≈ 240KB cached. Well within `chrome.storage.local` quota (~10MB by default).
- **Failure handling**: if fetch fails for an id, skip it; if total cached < 1, log and try once more on next browser startup.

## 9. Wandering algorithm

- Speeds (px/s):
  - slow: 25
  - normal: 50
  - fast: 90
- State machine per Pokémon:
  - `walk_left` / `walk_right`: vx = ±speed
  - `idle`: vx = 0 for 0.5–1.5s
  - `hop`: ride a small parabolic translateY over 250ms while still walking
- Decision cadence: pick a new state every 1.5–4s, with weights favoring `walk_*` over `idle`.
- Edge bounce: when sprite would leave viewport, reverse direction and immediately enter `walk_*` opposite.
- Facing: apply `transform: scaleX(-1)` when moving left.
- Reduced motion: if `prefers-reduced-motion: reduce` and `reducedMotion: "auto"`, halve speed and remove hops; if `"on"`, force this regardless; if `"off"`, never reduce.

## 10. Performance budget

| Metric                     | Budget                         |
| -------------------------- | ------------------------------ |
| Extension package size     | < 500 KB (no sprites bundled)  |
| Sprite cache size          | ~240 KB                        |
| Per-tab heap delta         | < 3 MB                         |
| CPU active (1 Pokémon)     | < 1% on a modern laptop        |
| CPU when tab hidden        | 0% (rAF paused)                |
| Frame target               | 30 fps (frame-skipped from 60) |
| DOM nodes added per page   | ≤ 6 (host + shadow + lane + 1–3 imgs) |

Mitigations baked in: single rAF loop shared across sprites; native GIF playback (no per-frame canvas work); transform-only updates; visibility-based pause.

## 11. Permissions and manifest

```json
{
  "manifest_version": 3,
  "name": "poke-shard",
  "version": "0.1.0",
  "description": "Tiny pixel Pokémon wandering along the bottom of your screen.",
  "permissions": ["storage"],
  "host_permissions": [
    "https://raw.githubusercontent.com/PokeAPI/sprites/*"
  ],
  "background": { "service_worker": "src/background.ts", "type": "module" },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content.ts"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "options_page": "src/options/index.html",
  "icons": { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

Note: extension icons are *not* Pokémon sprites — they will be original art generated for this project.

## 12. Repository structure

```
poke-shard/
├── manifest.json                 # generated by Vite plugin
├── src/
│   ├── background.ts
│   ├── content.ts
│   ├── wander.ts
│   ├── storage.ts
│   ├── pokemon-list.ts
│   ├── styles.css
│   └── options/
│       ├── index.html
│       └── options.ts
├── icons/                        # original icons only (no Pokémon assets)
├── docs/specs/
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
└── LICENSE                       # MIT
```

`README.md` will include: install steps, screenshots, performance notes, and an explicit notice that Pokémon sprites are © Nintendo / Game Freak / Creatures Inc., are fetched at runtime from PokéAPI's public CDN, and are not redistributed by this repository.

## 13. Build tooling

- **TypeScript** (strict).
- **Vite** + `@crxjs/vite-plugin` for MV3 packaging with HMR during development.
- `npm run build` → produces `dist/` ready for Load Unpacked or zipping.
- `npm run dev` → live reload while iterating on options page and content script.

## 14. Risks and mitigations

| Risk                                              | Likelihood | Mitigation                                                    |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| Nintendo DMCA on the GitHub repo                  | Low        | No bundled assets; runtime fetch from a third-party CDN; clear copyright notice in README. |
| Sticky footers / cookie banners overlap sprites   | Medium     | Vertical offset slider; very high z-index; document the workaround in README. |
| First-run network unavailable                     | Low        | Show nothing until cache populated; retry on next browser startup. |
| Sites with aggressive `* { ... }` CSS resets      | Low        | Shadow DOM isolation.                                         |
| Memory leak from repeated SPA navigations         | Low        | Idempotent mount via `dataset.pokeShardMounted` guard; remove listeners on `pagehide`. |
| Service worker terminates mid-fetch on install    | Low        | Use `chrome.runtime.onInstalled` + `await` of the full pipeline; SW stays alive while awaited. |

## 15. Acceptance criteria

- Loading the unpacked build into Chrome shows a single walking Pokémon at the bottom of `https://example.com` within ~1 second of page load.
- Hidden tabs measurably consume 0% CPU from this extension (verifiable via `chrome://tracing` or DevTools Performance).
- Heap delta on a typical news site is under 3 MB (DevTools Memory snapshot).
- Options page can change count, size, speed, blacklist, and offset — changes apply within 1 second across all open tabs.
- Adding a domain to the blacklist hides Pokémon on that domain on the next navigation/reload.
- Clicking a Pokémon swaps it to a different sprite from the cache.
- Repo contains zero `.png` / `.gif` files of Pokémon sprites; clone size is under ~1 MB.

## 16. Future work (out of scope for v1)

- Drag-to-reposition and remembered positions per site.
- Favorites list and weighted spawn.
- Optional larger sprite packs (Gen 5 Pokémon set is ~650 sprites; could be opt-in).
- Companion that follows the cursor.
- Speech bubbles with random flavor text.
- Generic "monster pals" rebrand for Chrome Web Store.
