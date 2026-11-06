// Client-side save queue for ratings: debounce per cell, latest value wins,
// retry with back-off on network errors / 5xx, never drops a rating silently.

export type SaveStatus = "saving" | "saved" | "retrying" | "error" | "closed";

type Timer = ReturnType<typeof setTimeout>;
type Outcome = "ok" | "closed" | "invalid" | "retry";

const DEBOUNCE_MS = 300;
const RETRY_BASE_MS = 3000;
const RETRY_MAX_MS = 15000;

export interface VoteQueueOptions {
  code: string;
  voterId: string;
  initialPending: Record<string, number>;
  onStatus: (key: string, status: SaveStatus) => void;
  onClosed: () => void;
  persistPending: (pending: Record<string, number>) => void;
}

export class VoteQueue {
  private pending: Map<string, number>;
  private inflight = new Set<string>();
  private debounces = new Map<string, Timer>();
  private retryTimer: Timer | null = null;
  private retryDelay = RETRY_BASE_MS;
  private running = false;
  private paused = false;

  constructor(private readonly o: VoteQueueOptions) {
    this.pending = new Map(Object.entries(o.initialPending));
  }

  private readonly onOnline = () => {
    this.clearRetry();
    this.retryDelay = RETRY_BASE_MS;
    this.flushAll();
  };

  start(): void {
    this.running = true;
    window.addEventListener("online", this.onOnline);
    for (const key of this.pending.keys()) this.o.onStatus(key, "saving");
    this.flushAll();
  }

  stop(): void {
    this.running = false;
    window.removeEventListener("online", this.onOnline);
    this.clearRetry();
    for (const t of this.debounces.values()) clearTimeout(t);
    this.debounces.clear();
  }

  /** Record a tap. Saves after a short debounce. */
  set(key: string, score: number): void {
    this.pending.set(key, score);
    this.persist();
    this.o.onStatus(key, this.paused ? "closed" : "saving");
    const existing = this.debounces.get(key);
    if (existing) clearTimeout(existing);
    this.debounces.set(
      key,
      setTimeout(() => {
        this.debounces.delete(key);
        void this.send(key);
      }, DEBOUNCE_MS),
    );
  }

  /** Called when the session's open/closed state is known to have changed. */
  setOpen(isOpen: boolean): void {
    const wasPaused = this.paused;
    this.paused = !isOpen;
    if (wasPaused && isOpen) {
      for (const key of this.pending.keys()) this.o.onStatus(key, "saving");
      this.flushAll();
    }
  }

  private persist(): void {
    this.o.persistPending(Object.fromEntries(this.pending));
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.running) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.flushAll();
    }, delay);
  }

  private flushAll(): void {
    for (const key of this.pending.keys()) {
      if (!this.debounces.has(key)) void this.send(key);
    }
  }

  private async post(key: string, score: number): Promise<Outcome> {
    const [topicId, criterionId] = key.split(":");
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: this.o.code, topicId, criterionId, voterId: this.o.voterId, score }),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) return "ok";
      if (res.status === 403) return "closed";
      if (res.status === 400 || res.status === 404) return "invalid";
      return "retry"; // 5xx, 429, anything unexpected
    } catch {
      return "retry"; // offline, timeout, DNS…
    }
  }

  private async send(key: string): Promise<void> {
    if (!this.running || this.paused || this.inflight.has(key)) return;
    const score = this.pending.get(key);
    if (score === undefined) return;

    this.inflight.add(key);
    const outcome = await this.post(key, score);
    this.inflight.delete(key);
    if (!this.running) return;

    const latest = this.pending.get(key);
    const superseded = latest !== undefined && latest !== score;

    switch (outcome) {
      case "ok":
        this.retryDelay = RETRY_BASE_MS;
        if (superseded) {
          if (!this.debounces.has(key)) void this.send(key);
        } else {
          this.pending.delete(key);
          this.persist();
          this.o.onStatus(key, "saved");
        }
        return;
      case "invalid":
        if (superseded) {
          if (!this.debounces.has(key)) void this.send(key);
        } else {
          this.pending.delete(key);
          this.persist();
          this.o.onStatus(key, "error");
        }
        return;
      case "closed":
        // Keep everything pending: if the presenter reopens voting it is sent then.
        this.paused = true;
        for (const k of this.pending.keys()) this.o.onStatus(k, "closed");
        this.o.onClosed();
        return;
      case "retry":
        this.o.onStatus(key, "retrying");
        this.scheduleRetry();
        return;
    }
  }
}
