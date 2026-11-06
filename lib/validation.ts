import { z } from "zod";
import { defaultChart, isChartFor } from "./charts";

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

export const MAX_FOCUS_TOPICS = 10;
export const MAX_TOPICS_PER_FOCUS = 10;
export const MAX_CRITERIA = 10;

export const QUESTION_KINDS = ["rating", "poll", "words"] as const;

const focusTopicSchema = z
  .object({
    name: z.string().trim().min(1, "Every focus topic needs a name").max(120),
    kind: z.enum(QUESTION_KINDS).default("rating"),
    chart: z.string().max(20).optional(),
    topics: listOf(120)
      .pipe(z.array(z.string()).max(MAX_TOPICS_PER_FOCUS, `At most ${MAX_TOPICS_PER_FOCUS} topics or options per focus topic`))
      .default([]),
  })
  .transform((f) => ({ ...f, topics: f.kind === "words" ? [] : f.topics, chart: f.chart ?? defaultChart(f.kind) }))
  .superRefine((f, ctx) => {
    if (!isChartFor(f.kind, f.chart))
      ctx.addIssue({ code: "custom", message: `“${f.chart}” isn't a chart for ${f.kind} questions` });
    if (f.kind === "rating" && f.topics.length < 1)
      ctx.addIssue({ code: "custom", message: `Add at least 1 topic to “${f.name}”` });
    if (f.kind === "poll" && f.topics.length < 2)
      ctx.addIssue({ code: "custom", message: `Give the poll “${f.name}” at least 2 options` });
  });
export type FocusTopicInput = z.infer<typeof focusTopicSchema>;

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  scaleMax: z.number().int().min(3).max(10).default(5),
  lowLabel: z.string().trim().min(1).max(30).default("Low"),
  highLabel: z.string().trim().min(1).max(30).default("High"),
  focusTopics: z
    .array(focusTopicSchema)
    .min(1, "Add at least 1 focus topic")
    .max(MAX_FOCUS_TOPICS, `At most ${MAX_FOCUS_TOPICS} focus topics`)
    .refine((list) => new Set(list.map((f) => f.name.toLowerCase())).size === list.length, {
      message: "Focus topic names must be different",
    }),
  criteria: listOf(60).pipe(
    z.array(z.string()).max(MAX_CRITERIA, `At most ${MAX_CRITERIA} criteria`),
  ),
}).superRefine((s, ctx) => {
  if (s.focusTopics.some((f) => f.kind === "rating") && s.criteria.length < 1)
    ctx.addIssue({ code: "custom", message: "Add at least 1 criterion for rating questions", path: ["criteria"] });
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ---------------------------------------------------------------- editing

const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");
const itemSchema = (maxLen: number) =>
  z.object({
    id: z.uuid().optional(),
    name: z.string().max(maxLen * 4).transform(cleanName).pipe(z.string().min(1, "Empty name").max(maxLen)),
  });
export type EditItem = { id?: string; name: string };

const noRepeats = (list: EditItem[]) => new Set(list.map((i) => i.name.toLowerCase())).size === list.length;

const editFocusSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1, "Every question needs a name").max(120),
    kind: z.enum(QUESTION_KINDS),
    chart: z.string().max(20).optional(),
    topics: z.array(itemSchema(120)).max(MAX_TOPICS_PER_FOCUS, `At most ${MAX_TOPICS_PER_FOCUS} per question`).default([]),
  })
  .transform((f) => ({ ...f, topics: f.kind === "words" ? [] : f.topics, chart: f.chart ?? defaultChart(f.kind) }))
  .superRefine((f, ctx) => {
    if (!isChartFor(f.kind, f.chart)) ctx.addIssue({ code: "custom", message: `“${f.chart}” isn't a chart for ${f.kind} questions` });
    if (f.kind === "rating" && f.topics.length < 1) ctx.addIssue({ code: "custom", message: `Add at least 1 thing to rate to “${f.name}”` });
    if (f.kind === "poll" && f.topics.length < 2) ctx.addIssue({ code: "custom", message: `Give the poll “${f.name}” at least 2 options` });
    if (!noRepeats(f.topics)) ctx.addIssue({ code: "custom", message: `“${f.name}” lists the same thing twice` });
  });

/** Full new state of a presentation; items with an id are kept (their answers too), others are new. */
export const editSessionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    scaleMax: z.number().int().min(3).max(10),
    lowLabel: z.string().trim().min(1).max(30),
    highLabel: z.string().trim().min(1).max(30),
    focusTopics: z.array(editFocusSchema).min(1, "Add at least 1 question").max(MAX_FOCUS_TOPICS),
    criteria: z.array(itemSchema(60)).max(MAX_CRITERIA).default([]),
  })
  .superRefine((s, ctx) => {
    if (!noRepeats(s.focusTopics)) ctx.addIssue({ code: "custom", message: "Give each question a different name" });
    if (!noRepeats(s.criteria)) ctx.addIssue({ code: "custom", message: "The same rating scale is listed twice" });
    if (s.focusTopics.some((f) => f.kind === "rating") && s.criteria.length < 1)
      ctx.addIssue({ code: "custom", message: "Add at least 1 thing to rate on" });
    const ids = [...s.focusTopics.flatMap((f) => [f.id, ...f.topics.map((t) => t.id)]), ...s.criteria.map((c) => c.id)].filter(Boolean);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "The same item appears twice" });
  });
export type EditSessionInput = z.infer<typeof editSessionSchema>;

export const patchSessionSchema = z.object({ isOpen: z.boolean() });

export const exportTypeSchema = z.enum(["summary", "raw"]);

/** Same cleaning the server applies, for the admin form preview. */
export function splitLines(text: string): string[] {
  return cleanList(text.split(/\r?\n/));
}

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

// Upper bound stops very long inputs from making hashing expensive.
export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters");

export const credentialsSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .refine((v) => v.password.trim().toLowerCase() !== v.email, {
    message: "Password can't be the same as your email",
    path: ["password"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

const word = z
  .string()
  .transform((w) => w.trim().replace(/\s+/g, " ").toLowerCase())
  .pipe(z.string().min(1, "Empty answer").max(40, "Keep each answer under 40 characters"));

export const answerSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("poll"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    topicId: z.uuid(),
  }),
  z.object({
    kind: z.literal("words"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    words: z
      .array(word)
      .max(3, "Up to 3 answers")
      .transform((ws) => [...new Set(ws)]),
  }),
]);
export type AnswerInput = z.infer<typeof answerSchema>;
