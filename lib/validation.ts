import { z } from "zod";
import { defaultChart, isChartFor } from "./charts";
import { DEFAULT_THEME, THEME_IDS } from "./themes";

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

export const QUESTION_KINDS = ["rating", "poll", "words", "multi", "text", "rank", "number", "qa", "quiz"] as const;
type Kind = (typeof QUESTION_KINDS)[number];

/** Question types whose answers are picked from a list of options (topics). */
export const KINDS_WITH_OPTIONS: readonly Kind[] = ["rating", "poll", "multi", "rank", "quiz"];
export const hasOptions = (kind: Kind) => KINDS_WITH_OPTIONS.includes(kind);

/** Largest number a number question may ask for (keeps answers exact in a double). */
export const MAX_ABS_NUMBER = 1e12;
export const MAX_TEXT_ANSWER = 280;
/** Longest optional description under a question. */
export const MAX_DESCRIPTION = 200;
/** Longest optional description under an item to score. */
export const MAX_ITEM_DESCRIPTION = 140;
const boundedNumber = z.number().finite().min(-MAX_ABS_NUMBER).max(MAX_ABS_NUMBER);

/** Settings some question types have; normalised to null for the others. */
const settingsShape = {
  maxPicks: z.number().int().min(1).max(MAX_TOPICS_PER_FOCUS).nullish(),
  min: boundedNumber.nullish(),
  max: boundedNumber.nullish(),
  unit: z.string().trim().max(20, "Keep the unit under 20 characters").nullish(),
  /** Quiz: the right option, by its text. */
  correct: z.string().max(480).nullish(),
  seconds: z.number().int().min(5, "Give at least 5 seconds").max(120, "Give at most 2 minutes").nullish(),
  /** Any type: extra words under the question. Blank = none. */
  description: z.string().trim().max(MAX_DESCRIPTION, `Keep the description under ${MAX_DESCRIPTION} characters`).nullish(),
  /** Items' descriptions, keyed by item name (matched ignoring case and spacing). Blank = none. */
  itemDescriptions: z
    .record(z.string().max(480), z.string().trim().max(MAX_ITEM_DESCRIPTION, `Keep item descriptions under ${MAX_ITEM_DESCRIPTION} characters`))
    .nullish(),
  /** Any type: a picture shown with the question (an id from POST /api/admin/images). */
  image: z.uuid().nullish(),
  /** Options' and items' pictures, keyed by name like `itemDescriptions`. */
  itemImages: z.record(z.string().max(480), z.uuid()).nullish(),
};

/** "  Offline  Mode " → "offline mode": how an item description finds its item. */
export const itemKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export const QUIZ_SECONDS_DEFAULT = 20;

type Settings = { maxPicks?: number | null; min?: number | null; max?: number | null; unit?: string | null; correct?: string | null; seconds?: number | null; description?: string | null; itemDescriptions?: Record<string, string> | null; image?: string | null; itemImages?: Record<string, string> | null };
const topicName = (t: unknown) => cleanName(typeof t === "string" ? t : (t as { name: string }).name);

function withSettings<T extends { kind: Kind; chart?: string; topics: unknown[] } & Settings>(f: T) {
  const isNumber = f.kind === "number";
  const isQuiz = f.kind === "quiz";
  const { correct, ...rest } = f;
  return {
    ...rest,
    topics: hasOptions(f.kind) ? f.topics : [],
    chart: f.chart ?? defaultChart(f.kind),
    maxPicks: f.kind === "multi" ? (f.maxPicks ?? null) : null,
    min: isNumber ? (f.min ?? 0) : null,
    max: isNumber ? (f.max ?? 100) : null,
    unit: isNumber && f.unit ? f.unit : null,
    seconds: isQuiz ? (f.seconds ?? QUIZ_SECONDS_DEFAULT) : null,
    description: f.description ? f.description : null,
    itemDescriptions: Object.fromEntries(
      Object.entries(f.itemDescriptions ?? {})
        .filter(([, d]) => d)
        .map(([name, d]) => [itemKey(name), d]),
    ),
    image: f.image ?? null,
    itemImages: hasOptions(f.kind) ? Object.fromEntries(Object.entries(f.itemImages ?? {}).map(([name, id]) => [itemKey(name), id])) : {},
    // the right option's index; -1 = missing or not one of the options
    correctIndex: isQuiz ? (correct ? f.topics.map(topicName).indexOf(cleanName(correct)) : -1) : null,
  };
}

/** Checks shared by creating and editing a question. */
function checkQuestion(
  f: { name: string; kind: Kind; chart: string; topics: unknown[]; min: number | null; max: number | null; correctIndex: number | null },
  ctx: z.RefinementCtx,
) {
  if (!isChartFor(f.kind, f.chart)) ctx.addIssue({ code: "custom", message: `“${f.chart}” isn't a chart for ${f.kind} questions` });
  if (f.kind === "rating" && f.topics.length < 1) ctx.addIssue({ code: "custom", message: `Add at least 1 thing to rate to “${f.name}”` });
  if (f.kind === "quiz" && f.correctIndex === -1) ctx.addIssue({ code: "custom", message: `Mark the right answer for “${f.name}”` });
  if ((f.kind === "poll" || f.kind === "multi" || f.kind === "rank" || f.kind === "quiz") && f.topics.length < 2)
    ctx.addIssue({ code: "custom", message: `Give “${f.name}” at least 2 options` });
  if (f.kind === "number" && !((f.min ?? 0) < (f.max ?? 0)))
    ctx.addIssue({ code: "custom", message: `In “${f.name}”, the lowest number must be below the highest` });
}

const focusTopicSchema = z
  .object({
    name: z.string().trim().min(1, "Every focus topic needs a name").max(120),
    kind: z.enum(QUESTION_KINDS).default("rating"),
    chart: z.string().max(20).optional(),
    topics: listOf(120)
      .pipe(z.array(z.string()).max(MAX_TOPICS_PER_FOCUS, `At most ${MAX_TOPICS_PER_FOCUS} topics or options per focus topic`))
      .default([]),
    ...settingsShape,
  })
  .transform(withSettings)
  .superRefine(checkQuestion);
export type FocusTopicInput = z.infer<typeof focusTopicSchema>;

export const createSessionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  scaleMax: z.number().int().min(3).max(10).default(5),
  lowLabel: z.string().trim().min(1).max(30).default("Low"),
  highLabel: z.string().trim().min(1).max(30).default("High"),
  /** Slide design (lib/themes.ts). */
  theme: z.enum(THEME_IDS).default(DEFAULT_THEME),
  /** Fun illustrations (lib/decor.ts) on the big screen and phones. */
  decor: z.boolean().default(true),
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
    ...settingsShape,
  })
  .transform(withSettings)
  .superRefine((f, ctx) => {
    checkQuestion(f, ctx);
    if (!noRepeats(f.topics)) ctx.addIssue({ code: "custom", message: `“${f.name}” lists the same thing twice` });
  });

/** Full new state of a presentation; items with an id are kept (their answers too), others are new. */
export const editSessionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    scaleMax: z.number().int().min(3).max(10),
    lowLabel: z.string().trim().min(1).max(30),
    highLabel: z.string().trim().min(1).max(30),
    /** Left out = keep the current design. */
    theme: z.enum(THEME_IDS).optional(),
    decor: z.boolean().optional(),
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

export const patchSessionSchema = z
  .object({ isOpen: z.boolean().optional(), showResults: z.boolean().optional(), aiEnabled: z.boolean().optional() })
  .refine((p) => p.isOpen !== undefined || p.showResults !== undefined || p.aiEnabled !== undefined, "Nothing to change");

export const exportTypeSchema = z.enum(["summary", "raw", "markdown"]);

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
  z.object({
    kind: z.literal("multi"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    // empty = clear the answer
    topicIds: z.array(z.uuid()).max(MAX_TOPICS_PER_FOCUS).refine((ids) => new Set(ids).size === ids.length, "Pick each option once"),
  }),
  z.object({
    kind: z.literal("rank"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    /** Every option, first place first. */
    topicIds: z
      .array(z.uuid())
      .min(2)
      .max(MAX_TOPICS_PER_FOCUS)
      .refine((ids) => new Set(ids).size === ids.length, "Place each option once"),
  }),
  z.object({
    kind: z.literal("number"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    value: boundedNumber,
  }),
  z.object({
    kind: z.literal("text"),
    code: codeSchema,
    focusId: z.uuid(),
    voterId: z.uuid(),
    text: z
      .string()
      .max(MAX_TEXT_ANSWER * 4)
      .transform((t) => t.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(1, "Empty answer").max(MAX_TEXT_ANSWER, `Keep it under ${MAX_TEXT_ANSWER} characters`)),
  }),
]);
export type AnswerInput = z.infer<typeof answerSchema>;

/** Audience Q&A: questions each voter may send per Q&A question. */
export const MAX_QA_PER_VOTER = 3;
const tidyText = z
  .string()
  .max(MAX_TEXT_ANSWER * 4)
  .transform((t) => t.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Empty question").max(MAX_TEXT_ANSWER, `Keep it under ${MAX_TEXT_ANSWER} characters`));

export const qaActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ask"), focusId: z.uuid(), voterId: z.uuid(), text: tidyText }),
  z.object({ action: z.literal("vote"), focusId: z.uuid(), voterId: z.uuid(), questionId: z.uuid(), up: z.boolean() }),
]);
export type QaAction = z.infer<typeof qaActionSchema>;

export const nicknameSchema = z
  .string()
  .max(80)
  .transform((t) => t.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Pick a nickname").max(20, "Keep it under 20 characters"));

export const quizActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("join"), voterId: z.uuid(), nickname: nicknameSchema }),
  z.object({ action: z.literal("answer"), voterId: z.uuid(), focusId: z.uuid(), topicId: z.uuid() }),
]);
export type QuizAction = z.infer<typeof quizActionSchema>;

/** Owner's quiz controls: start a question, end it now, or stop the quiz. */
export const quizControlSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), focusId: z.uuid() }),
  z.object({ action: z.literal("end") }),
  z.object({ action: z.literal("stop") }),
]);
export type QuizControl = z.infer<typeof quizControlSchema>;

/** Owner moderation: hide/unhide and mark answered/not answered (at least one). */
export const qaModerateSchema = z
  .object({ id: z.uuid(), hidden: z.boolean().optional(), answered: z.boolean().optional() })
  .refine((m) => m.hidden !== undefined || m.answered !== undefined, "Nothing to change");

/** Owner moderation of an open answer. */
export const textModerateSchema = z.object({ id: z.uuid(), hidden: z.boolean() });

/** AI insights on one question's answers. */
export const aiActionSchema = z.object({ action: z.enum(["summary", "duplicates"]), focusId: z.uuid() });

/** "Write questions for me": what the presentation is for. */
export const aiDraftSchema = z.object({ prompt: z.string().trim().min(3, "Say a little more").max(500, "Keep it under 500 characters") });
