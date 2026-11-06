"use client";

export class UnauthorizedError extends Error {}

const MESSAGES: Record<string, string> = {
  close_voting_first: "Close voting first.",
  unavailable: "The database is waking up. Try again in a moment.",
  invalid_credentials: "That email and password don't match.",
  too_many_attempts: "Too many failed attempts. Wait 15 minutes, then try again.",
  email_taken: "An account with this email already exists. Log in instead.",
  bad_origin: "This request was blocked. Reload the page and try again.",
};

/** Same-origin fetch (sends the session cookie). Throws UnauthorizedError on 401, Error otherwise. */
export async function apiFetch(path: string, init: RequestInit = {}, { throwOn401 = true } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  if (res.ok) return res;
  let message = `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; issues?: string[] };
    code = body.error;
    if (body.issues?.length) message = body.issues.join(" ");
    else if (code && MESSAGES[code]) message = MESSAGES[code];
  } catch {
    /* not JSON */
  }
  if (res.status === 401 && throwOn401 && code !== "invalid_credentials") throw new UnauthorizedError(message);
  throw new Error(message);
}
