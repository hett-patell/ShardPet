<div align="center">

<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/143.gif" width="96" alt="Snorlax sleeping" /><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif" width="96" alt="Pikachu" /><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/54.gif" width="96" alt="Psyduck" /><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/94.gif" width="96" alt="Gengar" /><img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/150.gif" width="96" alt="Mewtwo" />

# ShardPet

<p align="center">
    <picture>
        <img src="https://github.com/user-attachments/assets/c63b75ab-a529-4bd8-855d-ef15ae4a65a9" alt="ShardPass" width="500">
    </picture>
</p>

**A team of tiny, judgy Pokémon who live in your browser, watch you scroll, and stage a fullscreen intervention when you've been on Reddit for forty-five minutes.**

</div>

---

You ever wish your browser had a small friend? You ever wish that small friend had Strong Opinions about your YouTube rabbit holes? Congratulations — you wished a thing into existence and now it's a Chromium extension.

**ShardPet** drops 1–3 animated Gen 5 Pokémon onto every web page you visit. They wander. They hop. They occasionally stop to think about their life. You can click one to swap it for another. They are pixelated, they are emotionally unavailable, and they will not stop you from opening Twitter.

But the **other** thing they do — that's where it gets unhinged. Add a productivity threshold. Add an allowlist of sites that "count as work" (a generous fiction we are all in on). The moment you spend too long anywhere else, **every single Pokémon you've ever cached** materialises across your screen at once, in a glorious pixel-art fullscreen "**GET BACK TO WORK!**" overlay. They are everywhere. They are watching. They will not leave until you click "Dismiss" and admit you have a problem.

It is also, somehow, designed to use less CPU than your desktop wallpaper.

---

## Screenshots

**Pets, vibing, doing their little walk:**

<img width="1919" alt="ShardPet wandering Pokémon along the bottom of a webpage" src="https://github.com/user-attachments/assets/81325f72-c46e-4816-880d-0308c3b0eeea" />

**Pets, no longer vibing, staging an intervention:**

<img width="1920" alt="Get back to work overlay with all cached Pokémon scattered across the screen" src="https://github.com/user-attachments/assets/cbf08e89-bd9d-4176-8c17-6cc8d377ff6b" />

---

## What this thing actually does

<img align="right" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/79.gif" width="80" alt="Slowpoke" />

- **1–3 wandering Pokémon** that walk, idle, and occasionally hop. Click one to reroll it. They have free will. Mostly.
- **Highly customisable**: count, size (24–128 px — yes you can make them huge), bottom offset, speed (slow / normal / fast / "Slowpoke is sprinting"), per-host blacklist for sites where you'd rather not be perceived.
- **The Productivity Nag™**: per-hostname cumulative timer (1–60 min), allowlist for sites that don't count, and a 5-minute cooldown after each dismiss because we're not monsters.
- **Live timer pill** (optional) — a tiny top-right HUD that judges you in real time. `reddit.com • 4m37s / 5m00s` is a deeply uncomfortable string.
- **Toolbar popup** for all settings. No cursed options page. Click the icon, fiddle, leave.
- **Reduced-motion aware** — auto-detects `prefers-reduced-motion` so it doesn't enrage your vestibular system.
- **Shadow-DOM isolated** — page CSS can't touch our Pokémon, our Pokémon can't touch page CSS. Diplomatic immunity.
- **Offline after first install** — sprites are fetched once from PokéAPI's CDN, then cached locally forever (or until you click *Resync*).

## Why your laptop won't catch fire

ShardPet is engineered to be invisible on a CPU profile. Genuinely.

- One `requestAnimationFrame` loop, frame-skipped to ~30 FPS. That's it. There is no other loop.
- Movement is `transform: translate3d` only — pure GPU compositor, zero layout, zero paint. Your browser doesn't even notice.
- Animation **fully suspends** when the tab is hidden. Background tabs cost zero. Less than zero, even, in spirit.
- The work timer also pauses on hidden tabs. We are not psychopaths.
- `chrome.storage.local` writes are throttled to once every ~30 seconds (with forced flushes when something actually matters), so 17 open tabs don't all fight to write the same number.
- The work-timer interval doesn't even *start* if you've turned the nag off. We respect your toggles.
- ~24 animated sprites, total < 1 MB, stored as data URLs after the one-time fetch. Hand-on-heart, the extension is smaller than the GIF you sent in chat earlier.
- DOM only re-spawns when *visual* settings actually change. Nudging the offset slider patches CSS variables in place, like a civilised codebase.

<img align="right" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/132.gif" width="80" alt="Ditto" />

## Install (developer mode)

> Mozilla Add-ons / Chrome Web Store listing TBD. For now it's BYO-build.

**Option A — download the release:**
1. Grab `shardpet-v1.0.0.zip` from [Releases](https://github.com/hett-patell/ShardPet/releases) and unzip it.
2. Open `chrome://extensions` (or whatever your Chromium flavour calls it — Helium, Brave, Edge, Arc, the new one your friend told you about last week).
3. Flip on **Developer mode** (top right corner, you've got this).
4. Click **Load unpacked** → pick the unzipped folder.
5. Pin the extension. Watch a Pikachu appear. Cry a little.

**Option B — build from source like a normal person:**

```bash
git clone https://github.com/hett-patell/ShardPet.git
cd ShardPet
npm install
npm run build
# now load `dist/` via "Load unpacked" as above
```

On first install the extension fetches a curated set of Gen 5 Black/White animated sprites from [PokéAPI's public sprite CDN](https://github.com/PokeAPI/sprites). After that, it could survive on a desert island (with internet for, uh, browsing).

## Configure

Click the **ShardPet** toolbar icon. A 340px popup falls out. Two sections.

### Pokémon controls

- Enable / disable the whole show
- Count (1–3), size (24–128 px), bottom offset
- Speed: `slow` / `normal` / `fast`
- Reduced motion: `auto` (follow OS) / `off` / `on`
- **Blacklist** — hostnames where Pokémon won't appear (one per line; subdomains match). Useful for `mail.example.com`, banking sites, your therapist's intake form.

### Productivity nag

- Enable / disable the "Get back to work!" overlay
- Trigger threshold: 1–60 minutes of cumulative time on a non-allowlisted hostname
- **Allowlist** — sites you're allowed to use without being yelled at (one per line; subdomains match). Standard inclusions: `github.com`, `linear.app`, `notion.so`, your company's Jira, the docs page you're definitely going to read this time.
- **Show live timer pill** — top-right HUD. Recommended for the first day so you can debug your own brain.
- **Reset timers** — nukes per-hostname accumulators and any active cooldown. For when you've earned a clean slate or want to test the overlay without sitting through five minutes of suspense.
- **Resync sprites** — re-fetches the cache from PokéAPI. Run this if you ever feel your pets are getting stale.

When the overlay fires: title in pixel-art font, every cached Pokémon scattered across the screen via grid-jitter placement (each gets its own distinct zone — no clumping, no overlap, no Pokémon left behind). Dismiss with the button, click outside the title card, or hit **Esc**. That starts a 5-minute cooldown and zeroes the dismissed hostname's counter, so the next nag is also a full threshold away. Mercy.

<img align="right" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/65.gif" width="80" alt="Alakazam" />

## Develop

```bash
npm install         # install deps
npm run dev         # Vite dev (popup HMR)
npm run build       # production build → dist/
npm test            # unit tests (Vitest, 42 of them, all green)
npm run typecheck   # strict TS, no `any`s, no excuses
```

### Code layout

```
src/
  background.ts       # MV3 service worker: fetch + cache sprites once
  content.ts          # injected into every page; mounts lane, timer, overlay
  overlay.ts          # "Get back to work!" overlay (shadow-DOM, scattered)
  overlay.css         # pixel-art title font, scatter animations
  popup/
    index.html        # the 340px happy place
    popup.ts          # bound form ↔ chrome.storage settings
  storage.ts          # typed chrome.storage.local accessors + defaults
  styles.css          # lane + sprite styles (loaded as ?raw into shadow)
  sprite-fetcher.ts   # PokéAPI fetch + base64 (no FileReader; MV3-safe)
  pokemon-list.ts     # curated list of IDs + sprite URL helper
  wander.ts           # pure walk/idle/hop state machine (unit-tested)
  work-timer.ts       # pure cumulative timer + cooldown state (unit-tested)

tests/                # Vitest specs for the four pure modules
```

The pure modules (`wander.ts`, `work-timer.ts`, `storage.ts`, `sprite-fetcher.ts`) have zero DOM dependencies and are tested independently. Everything stateful and DOM-y in `content.ts` is a thin shell over them. Refactor with confidence.

## FAQ

**Q: Why does it ask permission for a `pokeapi/sprites` URL?**
A: That's the GitHub raw URL where the animated GIFs live. The extension hits it exactly once on install — and again only if you click **Resync sprites**. After that it's offline forever.

**Q: Does it slow down web pages?**
A: On a typical laptop the wander loop costs well under 1% CPU. The work timer wakes once every 5 seconds while the tab is visible. Hidden tabs do exactly zero work. Memory: a few hundred KB for the cached sprite data URLs plus three `<img>` elements at most. Your browser eats more for breakfast.

**Q: Will it leak its styles into the pages I visit?**
A: No. Both the lane and the overlay live in `closed` shadow roots, and the host elements use `all: initial`. Your CSS-in-JS library can rest easy.

**Q: My Pokémon is stuck.**
A: Click them. They reroll. If they're *all* stuck (i.e. the loop is dead), open a new tab — content scripts are per-page.

**Q: It triggered immediately after I dismissed it. Bug?**
A: Fixed in v1.0.0. `applyDismiss` now resets the dismissed hostname's accumulator so the next nag also requires a fresh threshold's worth of time. You can resume your descent into Twitter responsibly.

**Q: Can I add my own Pokémon list?**
A: Yes — edit `src/pokemon-list.ts`, rebuild, and click **Resync sprites**. Mythical / legendary Pokémon are excellent candidates for "shame me extra hard."

**Q: Does this work in Firefox?**
A: Not currently — it's a Manifest V3 Chromium extension. Firefox MV3 support is *technically* there but the manifest fields differ slightly. PRs welcome from someone braver than me.

**Q: Will Nintendo sue me?**
A: They're going to sue *me*, not you. You're fine.

## Contributing

PRs welcome. Issues welcomer. Bugs are inevitable; the absence of tests is unforgivable. If you add a feature, add a test for the pure logic. If you change UI, please rebuild and confirm nothing flies into low-earth orbit.

## Licensing

Source code: **MIT** — see [`LICENSE`](./LICENSE). Do whatever you want, just don't blame me when your Snorlax gets sentient.

Pokémon names and sprite imagery are © Nintendo / Game Freak / Creatures Inc. Sprites are **not** redistributed in this repository — they are fetched at runtime from PokéAPI's public sprite CDN. This is an unofficial, non-commercial fan project, not affiliated with or endorsed by Nintendo, Game Freak, Creatures Inc., or The Pokémon Company. Please don't sue us, we just wanted a small friend in our browser.

---

<div align="center">

<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/151.gif" width="64" alt="Mew" />

*Built with one `requestAnimationFrame`, three regrets, and twenty-four Pokémon.*

</div>
