"use client";

export class UnauthorizedError extends Error {}

/** Error from an API call; `code` is the server's error code (e.g. "invalid_link"). */
export class ApiError extends Error {
  constructor(message: string, readonly code: string | undefined, readonly status: number) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  close_voting_first: "Close voting first.",
  unavailable: "The database is waking up. Try again in a moment.",
  invalid_credentials: "That email and password don't match.",
  too_many_attempts: "Too many failed attempts. Wait 15 minutes, then try again.",
  email_taken: "An account with this email already exists. Log in instead.",
  invalid_link: "This link has expired or was already used.",
  invalid_guest_pin: "That code and PIN don't match a guest account.",
  guest_limit: "Guest accounts can run 3 presentations. Save your account to create more.",
  guest_busy: "Guest mode is busy right now. Try again in a few minutes, or sign up.",
  verify_email: "Verify your email to create presentations.",
  too_many_emails: "We've sent several emails in the last hour. Check your inbox (and spam), or try again later.",
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
  throw new ApiError(message, code, res.status);
}
