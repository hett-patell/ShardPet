import { SPRITE_URL } from "./pokemon-list";

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
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
