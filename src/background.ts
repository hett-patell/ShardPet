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
    console.warn("[ShardPet] initial sprite sync failed", e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const existing = await loadSpriteCache();
  if (existing && Object.keys(existing.byId).length > 0) return;
  try {
    await syncSprites();
  } catch (e) {
    console.warn("[ShardPet] startup sprite sync failed", e);
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
