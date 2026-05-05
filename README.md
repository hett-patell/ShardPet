# ShardPet

A tiny Chromium extension that puts pixel Pokémon walking along the bottom of every web page you visit — and gently shouts at you when you stay on time-wasters too long.

- 1–3 Pokémon (default 1)
- Configurable size, speed, vertical offset
- Per-site blacklist (no Pokémon)
- Per-site **allowlist** + **"Get back to work!"** overlay after N minutes on a non-allowlisted site (default 5)
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

The Options page has two sections:

- **Pokémon controls** — enable, count, size, speed, vertical offset, blacklist (don't show on these sites), reduced motion.
- **Productivity nag** — enable, trigger threshold in minutes, and an allowlist of sites you're allowed to use without nagging. After spending the threshold time on any non-allowlisted hostname (cumulative across that hostname's pages), a fullscreen "Get back to work!" overlay appears with a huge Pokémon. Click anywhere or press **Esc** to dismiss; there's a 5-minute cooldown after dismiss before it can re-trigger.

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
