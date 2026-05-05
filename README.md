# ShardPet

> Tiny pixel Pokémon walking along the bottom of every web page — and a friendly nudge when you've been on the wrong site too long.

ShardPet is a lightweight Chromium extension (Manifest V3) that drops one or more animated Gen 5 Pokémon sprites onto every web page, wandering, idling, and occasionally hopping along the bottom of the viewport. It also includes an optional **productivity nag**: pick an allowlist of sites that don't count, and after a configurable amount of cumulative time on any other site, a fullscreen "Get back to work!" overlay shows up with every cached sprite scattered across the screen.

Built to be small, isolated, and respectful of your CPU.

---

## Features

- **1–3 wandering Pokémon** with random walk / idle / hop behaviour, each click swaps the sprite to a different one.
- **Configurable** count, size (24–128 px), bottom offset, speed (slow / normal / fast), and a per-host blacklist.
- **Productivity nag** — per-hostname cumulative timer, configurable threshold (1–60 min), allowlist that resets the timer on those sites, and a 5-minute cooldown after each dismiss so the overlay isn't spammy.
- **Live timer pill** (optional) showing the current site's accumulated time / threshold / cooldown — handy for tuning your allowlist.
- **Toolbar popup** for all settings — no separate options page to navigate to.
- **Reduced-motion aware** — auto-detects `prefers-reduced-motion`, plus manual override.
- **Shadow-DOM isolated** so neither the lane nor the overlay leaks CSS into the page (or vice versa).
- **Offline after first install** — sprites are fetched once from PokéAPI's public CDN and cached locally.

## Performance design

ShardPet is designed to be invisible on a CPU profile.

- Single `requestAnimationFrame` loop, frame-skipped to ~30 FPS.
- Movement is `transform: translate3d` only — no layout/paint, stays on the GPU compositor layer.
- The animation loop is fully **suspended** when the tab is hidden (`visibilitychange`).
- The work timer also pauses on hidden tabs and resumes on visibility, so background tabs cost zero.
- Per-host cumulative time is throttled to one `chrome.storage.local` write every ~30 seconds (with forced flushes on visibility loss, dismiss, and trigger), so multi-tab fan-out stays low.
- The work-timer interval doesn't even start when the productivity nag is disabled.
- Sprites (~24 animated GIFs, total < 1 MB) live in `chrome.storage.local` as data URLs after the one-time fetch.
- Settings changes only re-create DOM nodes when something visual actually changed (count or size); changing the offset slider patches the existing sprites' CSS variables in place.

## Install (developer mode)

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions` (or the equivalent in Helium / Brave / Edge / Arc).
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the generated `dist/` folder.

On first install the extension fetches a curated set of Gen 5 Black/White animated sprites from [PokéAPI's public sprite CDN](https://github.com/PokeAPI/sprites). After that it runs entirely offline.

## Configure

Click the **ShardPet** toolbar icon to open the popup. Two sections:

**Pokémon controls**
- Enable wandering Pokémon
- Count (1–3), size (24–128 px), bottom offset
- Speed (slow / normal / fast), reduced motion (auto / off / on)
- Blacklist — Pokémon won't appear on these hostnames (one per line; subdomains match)

**Productivity nag**
- Enable / disable the "Get back to work!" overlay
- Trigger threshold (1–60 minutes of cumulative time on a non-allowlisted hostname)
- Allowlist — sites you're allowed to use without being nagged (one per line; subdomains match)
- Show live timer pill (top-right) — useful for verifying your allowlist
- **Reset timers** button — clears the per-hostname accumulator and any active cooldown
- **Resync sprites** button — re-fetches the sprite set from PokéAPI

The "Get back to work!" overlay shows the title in pixel-art font with all cached Pokémon scattered across the screen (grid-jitter placement so each Pokémon gets a distinct zone). Dismiss with the button, click outside the title card, or press **Esc** — that starts a 5-minute cooldown and resets the dismissed hostname's counter so you get a fresh window before the next nag.

## Develop

```bash
npm install         # install deps
npm run dev         # Vite dev (popup HMR)
npm run build       # production build → dist/
npm test            # unit tests (Vitest)
npm run typecheck   # strict TS check
```

The extension is loaded from `dist/` after `npm run build`. For HMR on popup styles you can run `npm run dev` and load the `dist/` folder; CRXJS handles the manifest.

### Code layout

```
src/
  background.ts       # MV3 service worker: fetch + cache sprites
  content.ts          # injected into every page; mounts lane, timer, overlay
  overlay.ts          # "Get back to work!" overlay (shadow-DOM)
  overlay.css
  popup/
    index.html
    popup.ts          # bound form for chrome.storage settings
  storage.ts          # typed chrome.storage.local accessors + defaults
  styles.css          # lane + sprite styles (loaded as ?raw into shadow)
  sprite-fetcher.ts   # PokéAPI fetch + base64 conversion (no FileReader, MV3-safe)
  pokemon-list.ts     # curated list of IDs + sprite URL helper
  wander.ts           # pure walk/idle/hop state machine (heavily unit-tested)
  work-timer.ts       # pure cumulative timer + cooldown state (heavily unit-tested)

tests/                # Vitest specs for the four pure modules
```

## FAQ

**Why does it ask permission for a `pokeapi/sprites` URL?**
That's the GitHub raw URL where the animated GIFs live. The extension only fetches once on install (and on the **Resync sprites** button); after that it works fully offline.

**Does it slow down web pages?**
On a typical laptop the wander loop costs well under 1% CPU; the work timer wakes once every 5 seconds while the tab is visible. Hidden tabs do zero work. Memory overhead per tab is a few hundred KB for the cached sprite data URLs plus three `<img>` elements at most.

**Will it leak its styles into pages?**
No — both the lane and the overlay live in `closed` shadow roots, and the host elements use `all: initial` to neutralise inherited styles.

**It triggered immediately after I dismissed it. Bug?**
Fixed in v1.0.0 — `applyDismiss` now resets the dismissed hostname's accumulator so the next nag also requires a fresh threshold's worth of time.

**Can I add my own Pokémon list?**
Yes — edit `src/pokemon-list.ts`, rebuild, and click **Resync sprites**.

## Licensing

The extension's source code is MIT-licensed — see [`LICENSE`](./LICENSE).

Pokémon names and sprite imagery are © Nintendo / Game Freak / Creatures Inc. Sprites are **not** redistributed in this repository; they are fetched at runtime from PokéAPI's public sprite CDN. This is an unofficial fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc., or The Pokémon Company.
