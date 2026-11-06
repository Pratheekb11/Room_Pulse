"use client";

export class UnauthorizedError extends Error {}

export const ADMIN_KEY_STORAGE = "liverate:admin";

export function readAdminKey(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function writeAdminKey(key: string | null): void {
  try {
    if (key) window.sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
    else window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

/** fetch with the admin header; throws UnauthorizedError on 401, Error on other failures. */
export async function adminFetch(key: string, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-admin-key", key);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  if (res.status === 401) throw new UnauthorizedError("Wrong password");
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; issues?: string[] };
      if (body.issues?.length) message = body.issues.join(" ");
      else if (body.error === "close_voting_first") message = "Close voting first.";
      else if (body.error === "unavailable") message = "The database is waking up. Try again in a moment.";
      else if (body.error) message = body.error;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return res;
}
