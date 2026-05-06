import { POKEMON_LIST } from "./pokemon-list";
import { fetchAllSprites } from "./sprite-fetcher";
import { saveSpriteCache, CURRENT_CACHE_VERSION, loadSpriteCache } from "./storage";

const RESYNC_MESSAGE = "RESYNC_SPRITES";

const TOTAL_IDS = POKEMON_LIST.length;

// Below this fraction of expected sprites we consider the cache incomplete
// (e.g. the user's first install hit a flaky network) and re-attempt on next
// startup or install.
const CACHE_HEALTH_THRESHOLD = 0.9;

// Re-sync from PokeAPI if the cache is older than this. Sprites here are
// historical Gen 5 BW assets so they don't churn often, but a periodic
// refresh lets us pick up upstream fixes without forcing a manual resync.
const CACHE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function logProgress(done: number, total: number): void {
  if (done === total || done % 100 === 0) {
    console.info(`[ShardPet] sprites: ${done}/${total}`);
  }
}

async function syncSprites(): Promise<{ ok: boolean; count: number }> {
  const ids = POKEMON_LIST.map(p => p.id);
  console.info(`[ShardPet] syncing ${ids.length} sprites…`);
  const byId = await fetchAllSprites(ids, { onProgress: logProgress });
  const count = Object.keys(byId).length;
  if (count === 0) return { ok: false, count: 0 };
  await saveSpriteCache({
    version: CURRENT_CACHE_VERSION,
    fetchedAt: Date.now(),
    byId
  });
  console.info(`[ShardPet] sprite cache saved: ${count}/${ids.length}`);
  return { ok: true, count };
}

async function syncIfNeeded(reason: string): Promise<void> {
  const existing = await loadSpriteCache();
  const have = existing ? Object.keys(existing.byId).length : 0;
  const ageMs = existing ? Date.now() - existing.fetchedAt : Infinity;
  const isHealthy = have >= TOTAL_IDS * CACHE_HEALTH_THRESHOLD;
  const isFresh = ageMs < CACHE_MAX_AGE_MS;
  if (isHealthy && isFresh) return;
  try {
    const why = !isHealthy ? `${have}/${TOTAL_IDS}` : `${Math.floor(ageMs / 86_400_000)}d old`;
    console.info(`[ShardPet] resyncing sprites (${reason}, ${why})`);
    await syncSprites();
  } catch (e) {
    console.warn(`[ShardPet] ${reason} sprite sync failed`, e);
  }
}

chrome.runtime.onInstalled.addListener(() => void syncIfNeeded("install"));
chrome.runtime.onStartup.addListener(() => void syncIfNeeded("startup"));

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === RESYNC_MESSAGE) {
    syncSprites()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, count: 0, error: String(err) }));
    return true;
  }
  return false;
});
