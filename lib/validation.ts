import { z } from "zod";

export const codeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{4,12}$/, "Invalid session code");

export const voteSchema = z.object({
  code: codeSchema,
  topicId: z.uuid(),
  criterionId: z.uuid(),
  voterId: z.uuid(),
  score: z.number().int().min(1).max(10),
});
export type VoteInput = z.infer<typeof voteSchema>;

/** Trim, drop empty lines and duplicates (case-insensitive, first one wins). */
function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

const listOf = (maxLen: number) =>
  z.array(z.string().max(maxLen * 4)).transform(cleanList).pipe(z.array(z.string().max(maxLen)));

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  scaleMax: z.number().int().min(3).max(10).default(5),
  lowLabel: z.string().trim().min(1).max(30).default("Low"),
  highLabel: z.string().trim().min(1).max(30).default("High"),
  topics: listOf(120).pipe(z.array(z.string()).min(1, "Add at least 1 topic").max(50, "At most 50 topics")),
  criteria: listOf(60).pipe(
    z.array(z.string()).min(1, "Add at least 1 criterion").max(10, "At most 10 criteria"),
  ),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const patchSessionSchema = z.object({ isOpen: z.boolean() });

export const exportTypeSchema = z.enum(["summary", "raw"]);

/** Same cleaning the server applies, for the admin form preview. */
export function splitLines(text: string): string[] {
  return cleanList(text.split(/\r?\n/));
}
