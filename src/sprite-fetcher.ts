import { SPRITE_URL } from "./pokemon-list";

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // latin1 maps each byte 0..255 to the same Unicode code point, which is
  // exactly the byte-string format btoa() expects. Avoids the per-chunk
  // Array.from + String.fromCharCode.apply dance the previous impl used.
  const binary = new TextDecoder("latin1").decode(new Uint8Array(buf));
  const base64 = btoa(binary);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${base64}`;
}

export async function fetchSprite(id: number): Promise<string> {
  const res = await fetch(SPRITE_URL(id));
  if (!res.ok) throw new Error(`sprite ${id} failed: ${res.status}`);
  const blob = await res.blob();
  return await blobToDataUrl(blob);
}

const DEFAULT_CONCURRENCY = 16;

export async function fetchAllSprites(
  ids: ReadonlyArray<number>,
  options?: { concurrency?: number; onProgress?: (done: number, total: number) => void }
): Promise<Record<number, string>> {
  const total = ids.length;
  const limit = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
  const byId: Record<number, string> = {};
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= total) return;
      const id = ids[i] as number;
      try {
        byId[id] = await fetchSprite(id);
      } catch {
        /* swallowed: missing sprites are simply absent from the cache */
      }
      done++;
      options?.onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, total) }, worker));
  return byId;
}
