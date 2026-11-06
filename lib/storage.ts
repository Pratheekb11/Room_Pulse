// localStorage wrappers that never throw (private mode, quota, disabled storage).

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

const memoryIds = new Map<string, string>();

/** Per-session anonymous voter id. Falls back to an in-memory id without storage. */
export function getVoterId(code: string): string {
  const key = `liverate:voter:${code}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
    return id;
  } catch {
    let id = memoryIds.get(key);
    if (!id) {
      id = crypto.randomUUID();
      memoryIds.set(key, id);
    }
    return id;
  }
}
