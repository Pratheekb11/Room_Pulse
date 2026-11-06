import "server-only";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(body: unknown, status = 200, headers: HeadersInit = NO_STORE): Response {
  return Response.json(body, { status, headers });
}

export function badRequest(error = "bad_request"): Response {
  return json({ error }, 400);
}

export function notFound(): Response {
  return json({ error: "not_found" }, 404);
}

/** Database unreachable or still waking up: tell the client to retry. */
export function unavailable(): Response {
  return json({ error: "unavailable" }, 503, { ...NO_STORE, "Retry-After": "2" });
}

/** Log only the error class/code — never request bodies, IPs or connection strings. */
export function logDbError(where: string, err: unknown): void {
  const e = err as { name?: string; code?: string };
  console.error(`[${where}] database error`, e?.name ?? "Error", e?.code ?? "");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
