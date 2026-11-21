// Abuse limits (security sweep P1/P2): per-client request caps, voter caps per presentation,
// no CDN cache-busting, per-IP lockouts instead of site-wide ones, and owner controls to hide
// words and quiz players from the big screen.
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, GOOD_PASSWORD, signUp } from "./auth-helpers";
import * as loginRoute from "@/app/api/auth/login/route";
import * as signupRoute from "@/app/api/auth/signup/route";
import * as resetRoute from "@/app/api/auth/reset/route";
import * as guestRoute from "@/app/api/auth/guest/route";
import * as guestReturnRoute from "@/app/api/auth/guest-return/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminReset from "@/app/api/admin/sessions/[code]/reset/route";
import * as wordsRoute from "@/app/api/admin/sessions/[code]/words/route";
import * as quizControl from "@/app/api/admin/sessions/[code]/quiz/route";
import * as exportRoute from "@/app/api/admin/sessions/[code]/export/route";
import * as draftRoute from "@/app/api/admin/ai/questions/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as statusRoute from "@/app/api/session/[code]/status/route";
import * as answerRoute from "@/app/api/answer/route";
import * as voteRoute from "@/app/api/vote/route";
import * as qaRoute from "@/app/api/qa/[code]/route";
import * as quizRoute from "@/app/api/quiz/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as publicResults from "@/app/api/results/[code]/public/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as pointsRoute from "@/app/api/points/[code]/route";
import * as imagesRoute from "@/app/api/admin/images/route";
import { LIMITS, ACCOUNT_PRESENTATION_LIMIT, MAX_VOTERS_PER_PRESENTATION, take, type LimitName } from "@/lib/limits";
import { GUEST_ACCOUNTS_PER_HOUR, GUEST_CODE_FAILURES_PER_10_MIN, LOGIN_FAILURES_PER_EMAIL, LOGIN_FAILURES_PER_IP } from "@/lib/policy";
import { wordWeights } from "@/lib/answers";
import { toMarkdown } from "@/lib/markdown";
import { getChoiceSummaryRows, getSummaryRows, purgeExpiredGuestData } from "@/lib/queries";
import { aiReplies } from "@/lib/ai";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

// Count password hashes, to prove a bad reset link is refused before any hashing happens.
const hashes = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/password", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/password")>();
  return {
    ...real,
    hashPassword: async (p: string) => {
      hashes.n++;
      return real.hashPassword(p);
    },
  };
});

let db: PGlite;
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const ip = (addr: string) => ({ "x-real-ip": addr });
const json = (body: unknown, headers: Record<string, string> = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
  body: JSON.stringify(body),
});
const req = (path: string, init: RequestInit = {}) => new Request(`${ORIGIN}${path}`, init);

/** Uses up a limit for this address, as if it had made that many requests in the window. */
async function exhaust(name: LimitName, addr: string) {
  await take(req("/x", { headers: ip(addr) }), name);
  await db.exec(`update rate_hits set n = 1000000 where bucket like '${name}:%'`);
}

const login = (email: string, password: string, addr?: string) =>
  loginRoute.POST(req("/api/auth/login", json({ email, password }, addr ? ip(addr) : {})));
const signup = (email: string, addr?: string) =>
  signupRoute.POST(req("/api/auth/signup", json({ email, password: GOOD_PASSWORD }, addr ? ip(addr) : {})));
const newGuest = (addr?: string) => guestRoute.POST(req("/api/auth/guest", json({}, addr ? ip(addr) : {})));
const guestBack = (guestCode: string, addr?: string) =>
  guestReturnRoute.POST(req("/api/auth/guest-return", json({ guestCode }, addr ? ip(addr) : {})));

beforeAll(async () => {
  db = await startTestDb();
});

beforeEach(async () => {
  await db.exec("truncate users, sessions, auth_sessions, login_failures, email_tokens, rate_hits cascade");
  hashes.n = 0;
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.AI_TRANSPORT;
  delete process.env.AI_SITE_DAILY_LIMIT;
});

// ---------------------------------------------------------------- password checks (scrypt)

describe("password checks are capped per address", () => {
  it("refuses logins from an address over its limit, before checking the password; other addresses still get in", async () => {
    await signUp("ada@example.com");
    await exhaust("auth", "203.0.113.1");
    const before = hashes.n;
    expect((await login("ada@example.com", GOOD_PASSWORD, "203.0.113.1")).status).toBe(429);
    expect(hashes.n).toBe(before);
    expect((await login("ada@example.com", GOOD_PASSWORD, "203.0.113.2")).status).toBe(200);
  });

  it("refuses sign-ups from an address over its limit", async () => {
    await exhaust("auth", "203.0.113.3");
    expect((await signup("bob@example.com", "203.0.113.3")).status).toBe(429);
    expect(hashes.n).toBe(0);
    expect((await signup("bob@example.com", "203.0.113.4")).status).toBe(201);
  });

  it(`allows ${LIMITS.signup.max} new accounts per address per hour`, async () => {
    expect((await signup("first@example.com", "198.51.100.7")).status).toBe(201);
    await db.exec(`update rate_hits set n = ${LIMITS.signup.max} - 1 where bucket like 'signup:%'`);
    expect((await signup("last@example.com", "198.51.100.7")).status).toBe(201);
    expect((await signup("one-more@example.com", "198.51.100.7")).status).toBe(429);
    expect((await signup("one-more@example.com", "198.51.100.8")).status).toBe(201);
  });

  it("refuses a reset link that doesn't exist without hashing the new password", async () => {
    const res = await resetRoute.POST(req("/api/auth/reset", json({ token: "a".repeat(43), password: "a brand new password" })));
    expect(res.status).toBe(400);
    expect(hashes.n).toBe(0);
  });

  it("refuses resets from an address over its limit", async () => {
    await exhaust("auth", "203.0.113.5");
    const res = await resetRoute.POST(req("/api/auth/reset", json({ token: "a".repeat(43), password: "a brand new password" }, ip("203.0.113.5"))));
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------- lockouts

describe("wrong passwords lock out the address, not the account", () => {
  beforeEach(async () => {
    await signUp("ada@example.com");
  });

  it("an attacker's failures don't lock the real owner out", async () => {
    for (let i = 0; i < LOGIN_FAILURES_PER_IP; i++) await login("ada@example.com", "wrong password!!", "192.0.2.66");
    expect((await login("ada@example.com", GOOD_PASSWORD, "192.0.2.66")).status).toBe(429);
    expect((await login("ada@example.com", GOOD_PASSWORD, "192.0.2.10")).status).toBe(200);
  });

  it(`still locks the account after ${LOGIN_FAILURES_PER_EMAIL} failures from many addresses`, async () => {
    await db.exec(
      `insert into login_failures (email) select 'total:ada@example.com' from generate_series(1, ${LOGIN_FAILURES_PER_EMAIL})`,
    );
    expect((await login("ada@example.com", GOOD_PASSWORD, "192.0.2.10")).status).toBe(429);
  });
});

describe("guest codes", () => {
  it("wrong guesses from one address don't stop other guests getting back in", async () => {
    const g = await newGuest("192.0.2.1");
    const { guestCode } = (await g.json()) as { guestCode: string };
    for (let i = 0; i < LIMITS.guestCode.max; i++) await guestBack("ZZZZ-ZZZZ", "192.0.2.99");
    expect((await guestBack(guestCode, "192.0.2.99")).status).toBe(429);
    expect((await guestBack(guestCode, "192.0.2.1")).status).toBe(200);
  });

  it(`pauses for everyone only after ${GUEST_CODE_FAILURES_PER_10_MIN} wrong codes site-wide`, async () => {
    expect(GUEST_CODE_FAILURES_PER_10_MIN).toBeGreaterThanOrEqual(1000);
    const g = await newGuest("192.0.2.1");
    const { guestCode } = (await g.json()) as { guestCode: string };
    await db.exec(`insert into login_failures (email) select 'guest-code' from generate_series(1, ${GUEST_CODE_FAILURES_PER_10_MIN})`);
    expect((await guestBack(guestCode, "192.0.2.1")).status).toBe(429);
  });

  it(`one address can start ${LIMITS.guest.max} guest accounts an hour; others are unaffected`, async () => {
    expect((await newGuest("192.0.2.50")).status).toBe(201);
    await db.exec(`update rate_hits set n = ${LIMITS.guest.max} - 1 where bucket like 'guest:%'`);
    expect((await newGuest("192.0.2.50")).status).toBe(201);
    expect((await newGuest("192.0.2.50")).status).toBe(429);
    expect((await newGuest("192.0.2.51")).status).toBe(201);
  });

  it("the site-wide cap on new guests is high enough that one script can't block everyone", () => {
    expect(GUEST_ACCOUNTS_PER_HOUR).toBeGreaterThanOrEqual(1000);
  });
});

// ---------------------------------------------------------------- presenters

describe("presenter caps", () => {
  it(`a saved account can have up to ${ACCOUNT_PRESENTATION_LIMIT} presentations`, async () => {
    const { cookie } = await signUp("lots@example.com");
    const create = () =>
      adminSessions.POST(
        req("/api/admin/sessions", json({ title: "T", focusTopics: [{ name: "F", kind: "poll", topics: ["a", "b"] }], criteria: [] }, { cookie: cookie! })),
      );
    expect((await create()).status).toBe(201);
    await db.exec(
      `insert into sessions (code, title, owner_id)
       select 'zz' || g, 'x', (select owner_id from sessions limit 1) from generate_series(1, ${ACCOUNT_PRESENTATION_LIMIT - 1}) g`,
    );
    const res = await create();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "account_limit" });
  });

  it("AI has a site-wide daily cap on top of each account's", async () => {
    process.env.GEMINI_API_KEY = "test";
    process.env.AI_TRANSPORT = "memory";
    process.env.AI_SITE_DAILY_LIMIT = "2";
    const plan = { title: "Retro", questions: [{ kind: "text", name: "What went well?" }] };
    const draft = (cookie: string) => draftRoute.POST(req("/x", json({ prompt: "a sprint retro" }, { cookie })));
    for (let i = 0; i < 3; i++) aiReplies.push(plan);
    const a = (await signUp("ai-a@example.com")).cookie!;
    const b = (await signUp("ai-b@example.com")).cookie!;
    const c = (await signUp("ai-c@example.com")).cookie!;
    expect((await draft(a)).status).toBe(200);
    expect((await draft(b)).status).toBe(200);
    const third = await draft(c);
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({ error: "ai_limit" });
    aiReplies.length = 0;
  });
});

// ---------------------------------------------------------------- voters

async function presentation() {
  const { cookie } = await signUp(`owner-${crypto.randomUUID()}@example.com`);
  const res = await adminSessions.POST(
    req(
      "/api/admin/sessions",
      json(
        {
          title: "Meetup",
          focusTopics: [
            { name: "Lunch?", kind: "poll", topics: ["Pizza", "Sushi"] },
            { name: "One word", kind: "words" },
            { name: "Questions?", kind: "qa" },
            { name: "Rate", kind: "rating", topics: ["Talk"] },
            { name: "Capital of Japan?", kind: "quiz", topics: ["Osaka", "Tokyo"], correct: "Tokyo" },
          ],
          criteria: ["Overall"],
        },
        { cookie: cookie! },
      ),
    ),
  );
  expect(res.status).toBe(201);
  const { code } = (await res.json()) as { code: string };
  const s = (await (await sessionRoute.GET(req("/x"), ctx(code))).json()) as SessionPayload;
  const [poll, words, qa, rating, quiz] = s.focusTopics;
  const opts = (id: string) => s.topics.filter((t) => t.focusId === id);
  return { code, cookie: cookie!, poll, words, qa, rating, quiz, pollOpts: opts(poll.id), ratingTopic: opts(rating.id)[0], quizOpts: opts(quiz.id), criterion: s.criteria[0] };
}

const pick = (code: string, focusId: string, topicId: string, voterId: string, addr?: string) =>
  answerRoute.POST(req("/api/answer", json({ kind: "poll", code, focusId, voterId, topicId }, addr ? ip(addr) : {})));
const sayWords = (code: string, focusId: string, words: string[], voterId = crypto.randomUUID()) =>
  answerRoute.POST(req("/api/answer", json({ kind: "words", code, focusId, voterId, words })));

describe("voters", () => {
  it("every answer route refuses an address over its request limit", async () => {
    const p = await presentation();
    const v = crypto.randomUUID();
    const addr = "203.0.113.20";
    await exhaust("answer", addr);
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, v, addr)).status).toBe(429);
    expect(
      (await voteRoute.POST(req("/api/vote", json({ code: p.code, topicId: p.ratingTopic.id, criterionId: p.criterion.id, voterId: v, score: 3 }, ip(addr))))).status,
    ).toBe(429);
    expect((await qaRoute.POST(req("/x", json({ action: "ask", focusId: p.qa.id, voterId: v, text: "Why?" }, ip(addr))), ctx(p.code))).status).toBe(429);
    expect((await quizRoute.POST(req("/x", json({ action: "join", voterId: v, nickname: "Ann" }, ip(addr))), ctx(p.code))).status).toBe(429);
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, v, "203.0.113.21")).status).toBe(200);
  });

  it("caps how many new voters one address can bring, but people already in keep answering", async () => {
    const p = await presentation();
    const addr = "203.0.113.30";
    const known = crypto.randomUUID();
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, known, addr)).status).toBe(200);
    await exhaust("newVoter", addr);
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, crypto.randomUUID(), addr)).status).toBe(429);
    expect((await pick(p.code, p.poll.id, p.pollOpts[1].id, known, addr)).status).toBe(200);
  });

  it(`a presentation takes at most ${MAX_VOTERS_PER_PRESENTATION} voters`, async () => {
    const p = await presentation();
    const known = crypto.randomUUID();
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, known)).status).toBe(200);
    await db.exec(
      `insert into session_voters (session_id, voter_id)
       select (select id from sessions where code = '${p.code}'), gen_random_uuid() from generate_series(1, ${MAX_VOTERS_PER_PRESENTATION})`,
    );
    const res = await pick(p.code, p.poll.id, p.pollOpts[0].id, crypto.randomUUID());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "full" });
    expect((await pick(p.code, p.poll.id, p.pollOpts[1].id, known)).status).toBe(200);
    // Clearing all answers lets new people in again.
    expect((await adminReset.POST(req("/x", json({}, { cookie: p.cookie })), ctx(p.code))).status).toBe(200);
    expect((await pick(p.code, p.poll.id, p.pollOpts[0].id, crypto.randomUUID())).status).toBe(200);
  });

  it("a Q&A flood from new voter ids is stopped by the per-address cap", async () => {
    const p = await presentation();
    const addr = "203.0.113.40";
    await exhaust("newVoter", addr);
    const res = await qaRoute.POST(req("/x", json({ action: "ask", focusId: p.qa.id, voterId: crypto.randomUUID(), text: "spam" }, ip(addr))), ctx(p.code));
    expect(res.status).toBe(429);
  });
});

describe("a big room on one Wi-Fi address fits inside the limits", () => {
  it("100 people scoring 5 items on 3 measures in the same minute, with room to spare", () => {
    const busiestMinute = 100 * 5 * 3;
    expect(LIMITS.answer.max).toBeGreaterThanOrEqual(4 * busiestMinute); // about 6,000 a minute
  });

  it("a 100-person workshop on one address can each make an account or a guest presentation, and log in", () => {
    const people = 100;
    expect(LIMITS.signup.max).toBeGreaterThanOrEqual(people);
    expect(LIMITS.guest.max).toBeGreaterThanOrEqual(people);
    // sign up, then log in again later (and a few typos) inside 10 minutes
    expect(LIMITS.auth.max).toBeGreaterThanOrEqual(3 * people);
    expect(LIMITS.guestCode.max).toBeGreaterThanOrEqual(people);
    expect(LIMITS.signup.seconds).toBe(3600);
    expect(LIMITS.guest.seconds).toBe(3600);
  });

  it("a whole presentation's worth of voters can join from one address", () => {
    expect(LIMITS.newVoter.max).toBeGreaterThanOrEqual(MAX_VOTERS_PER_PRESENTATION);
  });
});

describe("cached public endpoints can't be cache-busted", () => {
  it("refuse any query string without touching the database", async () => {
    const p = await presentation();
    expect((await statusRoute.GET(req(`/api/session/${p.code}/status?x=1`), ctx(p.code))).status).toBe(400);
    expect((await qaRoute.GET(req(`/api/qa/${p.code}?x=1`), ctx(p.code))).status).toBe(400);
    expect((await publicResults.GET(req(`/api/results/${p.code}/public?x=1`), ctx(p.code))).status).toBe(400);
    expect((await statusRoute.GET(req(`/api/session/${p.code}/status`), ctx(p.code))).status).toBe(200);
  });
});

describe("old rate counters are cleaned up", () => {
  it("the daily purge deletes counters older than a day", async () => {
    await take(req("/x", { headers: ip("203.0.113.50") }), "auth");
    await db.exec("update rate_hits set window_start = now() - interval '2 days'");
    await take(req("/x", { headers: ip("203.0.113.51") }), "auth");
    await purgeExpiredGuestData(7);
    expect((await db.query("select 1 from rate_hits")).rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- moderation on the big screen

const ownerResults = async (code: string, cookie: string) =>
  (await (await resultsRoute.GET(req("/x", { headers: { cookie } }), ctx(code))).json()) as ResultsPayload & {
    hiddenPlayers: { id: string; nickname: string }[];
  };
const hideWord = (code: string, cookie: string, body: Record<string, unknown>) =>
  wordsRoute.PATCH(req("/x", { ...json(body, { cookie }), method: "PATCH" }), ctx(code));

describe("hiding a word from the word cloud", () => {
  it("the owner hides a word: it leaves the cloud, the audience never sees it, exports mark it", async () => {
    const p = await presentation();
    await sayWords(p.code, p.words.id, ["great", "rude"]);
    await sayWords(p.code, p.words.id, ["rude"]);
    expect((await hideWord(p.code, p.cookie, { focusId: p.words.id, word: "RUDE ", hidden: true })).status).toBe(200);

    const r = await ownerResults(p.code, p.cookie);
    expect(r.words.find((w) => w.word === "rude")).toMatchObject({ hidden: true, n: 2 });
    expect(wordWeights(r.words, p.words.id).map((w) => w.word)).toEqual(["great"]);

    await adminSession.PATCH(req("/x", { ...json({ showResults: true }, { cookie: p.cookie }), method: "PATCH" }), ctx(p.code));
    const pub = (await (await publicResults.GET(req("/x"), ctx(p.code))).json()) as ResultsPayload;
    expect(pub.words.map((w) => w.word)).toEqual(["great"]);

    const rows = await getChoiceSummaryRows(p.code);
    expect(rows.find((x) => x.label === "rude")?.kind).toBe("Hidden word");
    expect(toMarkdown("Meetup", await getSummaryRows(p.code), rows)).not.toMatch(/rude/);
    const csv = await (await exportRoute.GET(req("/x?type=summary", { headers: { cookie: p.cookie } }), ctx(p.code))).text();
    expect(csv).toMatch(/rude,Hidden word/);

    // ...and brings it back
    expect((await hideWord(p.code, p.cookie, { focusId: p.words.id, word: "rude", hidden: false })).status).toBe(200);
    expect(wordWeights((await ownerResults(p.code, p.cookie)).words, p.words.id).map((w) => w.word)).toEqual(["rude", "great"]);
  });

  it("a word hidden before anyone types it stays hidden", async () => {
    const p = await presentation();
    await hideWord(p.code, p.cookie, { focusId: p.words.id, word: "rude", hidden: true });
    await sayWords(p.code, p.words.id, ["rude"]);
    expect(wordWeights((await ownerResults(p.code, p.cookie)).words, p.words.id)).toEqual([]);
  });

  it("only the owner can hide words", async () => {
    const p = await presentation();
    const other = (await signUp("not-owner@example.com")).cookie!;
    expect((await hideWord(p.code, other, { focusId: p.words.id, word: "x", hidden: true })).status).toBe(404);
    expect((await hideWord(p.code, "", { focusId: p.words.id, word: "x", hidden: true })).status).toBe(401);
  });
});

describe("hiding a quiz player from the leaderboard", () => {
  it("the owner hides a player by the leaderboard row's id, and can bring them back", async () => {
    const p = await presentation();
    const control = (body: Record<string, unknown>, cookie = p.cookie) => quizControl.POST(req("/x", json(body, { cookie })), ctx(p.code));
    const [bad, good] = [crypto.randomUUID(), crypto.randomUUID()];
    const play = (body: Record<string, unknown>) => quizRoute.POST(req("/x", json(body)), ctx(p.code));
    await play({ action: "join", voterId: bad, nickname: "Rude name" });
    await play({ action: "join", voterId: good, nickname: "Ann" });
    expect((await control({ action: "start", focusId: p.quiz.id })).status).toBe(200);
    const tokyo = p.quizOpts.find((o) => o.name === "Tokyo")!;
    expect((await play({ action: "answer", voterId: bad, focusId: p.quiz.id, topicId: tokyo.id })).status).toBe(200);
    expect((await play({ action: "answer", voterId: good, focusId: p.quiz.id, topicId: tokyo.id })).status).toBe(200);

    const before = await ownerResults(p.code, p.cookie);
    const row = before.leaderboard.find((x) => x.nickname === "Rude name")!;
    expect(row.id).toMatch(/^[a-f0-9]{32}$/);
    expect(JSON.stringify(before)).not.toContain(bad); // the id never reveals the voter

    const other = (await signUp("not-owner2@example.com")).cookie!;
    expect((await control({ action: "hide_player", id: row.id }, other)).status).toBe(404);
    expect((await control({ action: "hide_player", id: row.id })).status).toBe(200);
    const after = await ownerResults(p.code, p.cookie);
    expect(after.leaderboard.map((x) => x.nickname)).toEqual(["Ann"]);
    expect(after.hiddenPlayers).toEqual([{ id: row.id, nickname: "Rude name" }]);

    expect((await control({ action: "show_player", id: row.id })).status).toBe(200);
    expect((await ownerResults(p.code, p.cookie)).leaderboard).toHaveLength(2);
  });

  it("an unknown player id is a 404", async () => {
    const p = await presentation();
    const res = await quizControl.POST(req("/x", json({ action: "hide_player", id: "0".repeat(32) }, { cookie: p.cookie })), ctx(p.code));
    expect(res.status).toBe(404);
  });
});


// ---------------------------------------------------------------- the newer public writes (2026-11-21)

/** The smallest JPEG the server accepts: start, a 10×10 frame header, end. */
const tinyJpeg = () =>
  Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0, 10, 0, 10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]).toString("base64");

describe("raising open points and uploading pictures have limits too", () => {
  it("raising an open point goes through the same voter checks as answers", async () => {
    const p = await presentation();
    expect((await adminSession.PATCH(req("/x", { method: "PATCH", headers: { cookie: p.cookie, origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ openPoints: true }) }), ctx(p.code))).status).toBe(200);
    const raise = (addr: string) => pointsRoute.POST(req("/x", json({ voterId: crypto.randomUUID(), text: "Slow build" }, ip(addr))), ctx(p.code));
    await exhaust("answer", "203.0.113.40");
    expect((await raise("203.0.113.40")).status).toBe(429);
    expect((await raise("203.0.113.41")).status).toBe(201);
  });

  it(`one address can upload ${LIMITS.upload.max} pictures an hour; others are unaffected`, async () => {
    const { cookie } = await signUp("pictures@example.com");
    const upload = (addr: string) => imagesRoute.POST(req("/api/admin/images", json({ data: tinyJpeg() }, { cookie: cookie!, ...ip(addr) })));
    expect((await upload("203.0.113.50")).status).toBe(201);
    await exhaust("upload", "203.0.113.50");
    expect((await upload("203.0.113.50")).status).toBe(429);
    expect((await upload("203.0.113.51")).status).toBe(201);
    expect(LIMITS.upload.seconds).toBe(3600);
  });
});
