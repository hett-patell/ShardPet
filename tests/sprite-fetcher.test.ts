// @vitest-environment node
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
