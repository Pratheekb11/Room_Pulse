// Gemini sometimes answers "busy" (503) or "slow down" (429) for a moment: one more try, then give up.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, askJson } from "@/lib/ai";

const ok = (value: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
const ask = () => askJson({ system: "s", prompt: "p", schema: { type: "OBJECT", properties: { hi: { type: "STRING" } } }, retryDelayMs: 1 });

describe("asking Gemini", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    delete process.env.AI_TRANSPORT;
    process.env.GEMINI_API_KEY = "test-key";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.env.AI_TRANSPORT = "memory";
  });

  it("tries once more when Gemini is busy, and uses the second answer", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok({ hi: "there" }));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    expect(await ask()).toEqual({ hi: "there" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second busy answer", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("busy", { status: 429 }));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    await expect(ask()).rejects.toBeInstanceOf(AiError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry a refused request", async () => {
    const fetch = vi.fn().mockImplementation(async () => new Response("bad key", { status: 403 }));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    await expect(ask()).rejects.toThrow("Gemini answered 403");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sends the key in a header, never in the address, and lets a long summary finish", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok({ hi: "x" }));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
    await askJson({ system: "s", prompt: "p", schema: { type: "OBJECT", properties: {} }, maxOutputTokens: 4096 });
    const [url, init] = fetch.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body).generationConfig.maxOutputTokens).toBe(4096);
  });
});
