import "server-only";

/**
 * AI insights through Google Gemini (GEMINI_API_KEY, model GEMINI_MODEL).
 * - AI_TRANSPORT=memory: replies come from `aiReplies` and calls are kept in `aiCalls` (tests)
 * - otherwise: Gemini's REST API, asking for JSON that matches the given schema
 * Callers validate the reply; nothing here trusts it.
 */

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/** Tests only: prompts "sent" with AI_TRANSPORT=memory, and the replies to give back (first in, first out). */
export const aiCalls: { system: string; prompt: string }[] = [];
export const aiReplies: unknown[] = [];

export class AiError extends Error {
  override name = "AiError";
}

export const aiAvailable = () => Boolean(process.env.GEMINI_API_KEY);

/** AI requests one account may make per day (AI_DAILY_LIMIT, default 20). */
export function aiDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 20;
}

/** Gemini's schema format (an OpenAPI subset). */
export type GeminiSchema =
  | { type: "STRING"; enum?: string[] }
  | { type: "INTEGER" | "NUMBER" }
  | { type: "ARRAY"; items: GeminiSchema; maxItems?: string }
  | { type: "OBJECT"; properties: Record<string, GeminiSchema>; required?: string[] };

/** Gemini is busy (503) or asks to slow down (429): worth one more try. */
const BUSY = new Set([429, 500, 503]);

export async function askJson(opts: {
  system: string;
  prompt: string;
  schema: GeminiSchema;
  temperature?: number;
  /** Room for the reply (default 2048). */
  maxOutputTokens?: number;
  /** Wait before the one retry when Gemini is busy (tests shorten it). */
  retryDelayMs?: number;
}): Promise<unknown> {
  if (process.env.AI_TRANSPORT === "memory") {
    aiCalls.push({ system: opts.system, prompt: opts.prompt });
    if (!aiReplies.length) throw new AiError("no fake reply queued");
    return aiReplies.shift();
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  const send = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.3,
          maxOutputTokens: opts.maxOutputTokens ?? 2048,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
  try {
    let res = await send();
    if (BUSY.has(res.status)) {
      await new Promise((done) => setTimeout(done, opts.retryDelayMs ?? 1500));
      res = await send();
    }
    if (!res.ok) throw new AiError(`Gemini answered ${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return JSON.parse(text);
  } catch (err) {
    throw err instanceof AiError ? err : new AiError((err as Error).name);
  } finally {
    clearTimeout(timer);
  }
}
