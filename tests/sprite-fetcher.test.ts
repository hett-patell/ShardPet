// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { blobToDataUrl, fetchSprite, fetchAllSprites } from "../src/sprite-fetcher";

describe("blobToDataUrl", () => {
  test("converts a Blob to a data URL", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/gif" });
    const url = await blobToDataUrl(blob);
    expect(url.startsWith("data:image/gif;base64,")).toBe(true);
  });

  test("round-trips bytes that are unmapped in windows-1252", async () => {
    // Regression: TextDecoder("latin1") aliases to windows-1252 where these
    // bytes decode to U+FFFD, and btoa() then throws InvalidCharacterError.
    // GIF binary data hits these constantly, so the whole sprite cache
    // silently went to zero on first install. This test fails if we ever
    // reintroduce a TextDecoder-based byte→string conversion.
    const tricky = new Uint8Array([0x00, 0x81, 0x8d, 0x8f, 0x90, 0x9d, 0xff]);
    const blob = new Blob([tricky], { type: "image/gif" });
    const url = await blobToDataUrl(blob);
    expect(url.startsWith("data:image/gif;base64,")).toBe(true);

    const base64 = url.slice("data:image/gif;base64,".length);
    const decoded = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual(Array.from(tricky));
  });

  test("handles binary spanning the 32KB chunk boundary", async () => {
    // Make sure the chunked apply() loop doesn't drop or duplicate bytes.
    const big = new Uint8Array(0x8000 + 17);
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff;
    const blob = new Blob([big], { type: "image/gif" });
    const url = await blobToDataUrl(blob);
    const base64 = url.slice("data:image/gif;base64,".length);
    const decoded = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    expect(decoded.length).toBe(big.length);
    expect(decoded[0]).toBe(0x00);
    expect(decoded[0x8000]).toBe(0x00);
    expect(decoded[decoded.length - 1]).toBe(big[big.length - 1]);
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
