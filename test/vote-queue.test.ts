import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoteQueue, type SaveStatus } from "@/lib/vote-queue";

type Reply = number | "network";

/** Fake /api/vote: replies come from a script (default 200). Records every request. */
function fakeFetch(script: Reply[] = []) {
  const calls: { key: string; score: number }[] = [];
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    const b = JSON.parse(init.body) as { topicId: string; criterionId: string; score: number };
    calls.push({ key: `${b.topicId}:${b.criterionId}`, score: b.score });
    const reply = script.length ? script.shift()! : 200;
    if (reply === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(reply === 403 ? { error: "closed" } : { ok: reply === 200 }), { status: reply });
  });
  return { fn, calls };
}

function setup(script: Reply[] = [], initialPending: Record<string, number> = {}) {
  const f = fakeFetch(script);
  vi.stubGlobal("fetch", f.fn);
  const statuses: Record<string, SaveStatus> = {};
  let persisted: Record<string, number> = { ...initialPending };
  const onClosed = vi.fn();
  const q = new VoteQueue({
    code: "abc234",
    voterId: "00000000-0000-4000-8000-000000000000",
    initialPending,
    onStatus: (k, s) => (statuses[k] = s),
    onClosed,
    persistPending: (p) => (persisted = p),
  });
  q.start();
  return { q, calls: f.calls, statuses, onClosed, persisted: () => persisted };
}

const K = "t1:c1";
const K2 = "t1:c2";

beforeEach(() => {
  vi.useFakeTimers();
  // VoteQueue listens for the browser "online" event.
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("VoteQueue", () => {
  it("debounces rapid taps on one cell and sends only the latest value", async () => {
    const { q, calls, statuses, persisted } = setup();
    q.set(K, 2);
    q.set(K, 4);
    q.set(K, 5);
    expect(statuses[K]).toBe("saving");
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toEqual([{ key: K, score: 5 }]);
    expect(statuses[K]).toBe("saved");
    expect(persisted()).toEqual({});
  });

  it("debounces per cell, not globally", async () => {
    const { q, calls } = setup();
    q.set(K, 1);
    q.set(K2, 2);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(2);
  });

  it("persists pending ratings until the server confirms them", async () => {
    const { q, persisted } = setup(["network"]);
    q.set(K, 3);
    expect(persisted()).toEqual({ [K]: 3 });
    await vi.advanceTimersByTimeAsync(300);
    expect(persisted()).toEqual({ [K]: 3 });
  });

  it("retries on network errors and 5xx with back-off 3s → 6s → 12s → 15s", async () => {
    const { q, calls, statuses } = setup(["network", 503, 500, 502, 503]);
    q.set(K, 3);
    await vi.advanceTimersByTimeAsync(300);
    expect(statuses[K]).toBe("retrying");
    const at: number[] = [];
    for (const wait of [3000, 6000, 12000, 15000]) {
      await vi.advanceTimersByTimeAsync(wait - 1);
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(1);
      at.push(calls.length - before);
    }
    expect(at).toEqual([1, 1, 1, 1]);
    // Still failing (5th reply 503): next retry is capped at 15s, then succeeds.
    await vi.advanceTimersByTimeAsync(15000);
    expect(statuses[K]).toBe("saved");
  });

  it("latest value wins when a tap happens while an older save is in flight", async () => {
    let release!: () => void;
    const calls: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: { body: string }) => {
        const { score } = JSON.parse(init.body) as { score: number };
        calls.push(score);
        if (calls.length === 1) await new Promise<void>((r) => (release = r));
        return new Response("{}", { status: 200 });
      }),
    );
    const statuses: Record<string, SaveStatus> = {};
    let persisted: Record<string, number> = {};
    const q = new VoteQueue({
      code: "abc234",
      voterId: "00000000-0000-4000-8000-000000000000",
      initialPending: {},
      onStatus: (k, s) => (statuses[k] = s),
      onClosed: () => {},
      persistPending: (p) => (persisted = p),
    });
    q.start();
    q.set(K, 2);
    await vi.advanceTimersByTimeAsync(300); // first save in flight
    q.set(K, 5);
    await vi.advanceTimersByTimeAsync(300); // debounce fires while first still in flight
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([2, 5]);
    expect(statuses[K]).toBe("saved");
    expect(persisted).toEqual({});
  });

  it("flushes immediately when the browser comes back online", async () => {
    const { q, calls, statuses } = setup(["network"]);
    q.set(K, 3);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls).toHaveLength(1);
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(statuses[K]).toBe("saved");
  });

  it("on 403 closed: reports closed, keeps the rating, and sends it when reopened", async () => {
    const { q, calls, statuses, onClosed, persisted } = setup([403]);
    q.set(K, 4);
    await vi.advanceTimersByTimeAsync(300);
    expect(onClosed).toHaveBeenCalledOnce();
    expect(statuses[K]).toBe("closed");
    expect(persisted()).toEqual({ [K]: 4 });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1); // no hammering while closed

    q.setOpen(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(2);
    expect(statuses[K]).toBe("saved");
  });

  it("on 400 shows an error and drops the rejected value (retrying cannot help)", async () => {
    const { q, calls, statuses, persisted } = setup([400]);
    q.set(K, 9);
    await vi.advanceTimersByTimeAsync(300);
    expect(statuses[K]).toBe("error");
    expect(persisted()).toEqual({});
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
  });

  it("sends ratings left pending from a previous page load on start", async () => {
    const { calls, statuses } = setup([], { [K]: 2, [K2]: 5 });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(expect.arrayContaining([{ key: K, score: 2 }, { key: K2, score: 5 }]));
    expect(statuses).toEqual({ [K]: "saved", [K2]: "saved" });
  });

  it("stop() cancels timers so nothing is sent afterwards", async () => {
    const { q, calls } = setup();
    q.set(K, 1);
    q.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(0);
  });
});

describe("VoteQueue with a custom endpoint (polls and word clouds)", () => {
  it("posts the body built for each value to the given endpoint, latest value wins", async () => {
    const seen: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: string }) => {
        seen.push({ url, body: JSON.parse(init.body) });
        return new Response("{}", { status: 200 });
      }),
    );
    const statuses: Record<string, SaveStatus> = {};
    const q = new VoteQueue<string[]>({
      code: "abc234",
      voterId: "00000000-0000-4000-8000-000000000000",
      initialPending: {},
      endpoint: "/api/answer",
      toBody: (key, words) => ({ kind: "words", focusId: key, words }),
      onStatus: (k, s) => (statuses[k] = s),
      onClosed: () => {},
      persistPending: () => {},
    });
    q.start();
    q.set("f1", ["a"]);
    q.set("f1", ["a", "b"]);
    await vi.advanceTimersByTimeAsync(300);
    expect(seen).toEqual([
      {
        url: "/api/answer",
        body: { code: "abc234", voterId: "00000000-0000-4000-8000-000000000000", kind: "words", focusId: "f1", words: ["a", "b"] },
      },
    ]);
    expect(statuses.f1).toBe("saved");
  });
});
