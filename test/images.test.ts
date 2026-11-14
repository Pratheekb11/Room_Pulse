// Pictures: a presenter can put a picture on a question and on each option or item to score.
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as adminSession from "@/app/api/admin/sessions/[code]/route";
import * as imagesRoute from "@/app/api/admin/images/route";
import * as imgRoute from "@/app/api/img/[id]/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as purgeRoute from "@/app/api/cron/purge/route";
import { fitWithin, imageUrl, jpegSize, MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, MAX_IMAGES_PER_ACCOUNT } from "@/lib/images";
import { imagesOf, rowsFrom } from "@/lib/list-edit";
import { previewQuestions } from "@/lib/preview";
import { groupByFocus } from "@/lib/focus";
import type { SessionPayload } from "@/lib/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The smallest thing a JPEG reader accepts: start marker, a size header, filler, end marker. */
function fakeJpeg(width: number, height: number, filler = 0): Buffer {
  const soi = [0xff, 0xd8];
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof = [0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x01, 0x01, 0x11, 0x00];
  const parts = [Buffer.from(soi), Buffer.from(app0)];
  // comment segments (each up to 65,533 bytes) pad the file to a size
  for (let left = filler; left > 0; ) {
    const n = Math.min(left, 65_533);
    parts.push(Buffer.from([0xff, 0xfe, (n + 2) >> 8, (n + 2) & 255]), Buffer.alloc(n, 0x20));
    left -= n;
  }
  parts.push(Buffer.from(sof), Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);

let db: PGlite;
let cookie = "";
let otherCookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const authed = (init: RequestInit = {}, as = cookie) => ({
  ...init,
  headers: { cookie: as, origin: ORIGIN, "content-type": "application/json", ...(init.headers ?? {}) },
});
const upload = (bytes: Buffer, as = cookie) =>
  imagesRoute.POST(new Request(`${ORIGIN}/api/admin/images`, authed({ method: "POST", body: JSON.stringify({ data: bytes.toString("base64") }) }, as)));
async function uploaded(bytes = fakeJpeg(640, 480), as = cookie): Promise<string> {
  const res = await upload(bytes, as);
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}
const fetchImage = (id: string) => imgRoute.GET(new Request(`${ORIGIN}/api/img/${id}`), { params: Promise.resolve({ id }) });
const create = (body: Record<string, unknown>, as = cookie) =>
  adminSessions.POST(new Request(`${ORIGIN}/api/admin/sessions`, authed({ method: "POST", body: JSON.stringify(body) }, as)));
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const put = (code: string, body: Record<string, unknown>) =>
  adminSession.PUT(new Request(`${ORIGIN}/x`, authed({ method: "PUT", body: JSON.stringify(body) })), ctx(code));
async function newCode(body: Record<string, unknown>, as = cookie): Promise<string> {
  const res = await create(body, as);
  expect(res.status).toBe(201);
  return ((await res.json()) as { code: string }).code;
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("pics@example.com")).cookie!;
  otherCookie = (await signUp("pics-other@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade; truncate images cascade");
});

describe("reading a JPEG", () => {
  it("finds the width and height", () => {
    expect(jpegSize(fakeJpeg(640, 480))).toEqual({ width: 640, height: 480 });
    expect(jpegSize(fakeJpeg(1, 1, 5000))).toEqual({ width: 1, height: 1 });
  });

  it("refuses anything that isn't a JPEG", () => {
    expect(jpegSize(PNG)).toBeNull();
    expect(jpegSize(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(jpegSize(Buffer.alloc(0))).toBeNull();
    // a start marker, then a segment that claims to be longer than the file
    expect(jpegSize(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xff, 0x00]))).toBeNull();
  });

  it("works out the size a picture is shrunk to before upload", () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(600, 1200, 1280)).toEqual({ width: 600, height: 1200 });
    expect(fitWithin(1000, 5000, 1000)).toEqual({ width: 200, height: 1000 });
    expect(MAX_IMAGE_SIDE).toBeLessThanOrEqual(1600);
  });
});

describe("uploading a picture", () => {
  it("stores a JPEG and serves it back to anyone, cacheable, as an image only", async () => {
    const bytes = fakeJpeg(800, 600, 3000);
    const id = await uploaded(bytes);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const res = await fetchImage(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toMatch(/public/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it("needs a signed-in presenter (a guest will do)", async () => {
    const res = await imagesRoute.POST(
      new Request(`${ORIGIN}/api/admin/images`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ data: fakeJpeg(10, 10).toString("base64") }) }),
    );
    expect(res.status).toBe(401);
  });

  it("refuses files that aren't JPEGs, are too big or too large on a side", async () => {
    const notImage = await upload(PNG);
    expect(notImage.status).toBe(400);
    expect(((await notImage.json()) as { error: string }).error).toBe("not_an_image");

    const big = await upload(fakeJpeg(800, 600, MAX_IMAGE_BYTES));
    expect(big.status).toBe(413);
    expect(((await big.json()) as { error: string }).error).toBe("image_too_big");

    const wide = await upload(fakeJpeg(MAX_IMAGE_SIDE + 1, 100));
    expect(wide.status).toBe(400);

    const junk = await imagesRoute.POST(new Request(`${ORIGIN}/api/admin/images`, authed({ method: "POST", body: JSON.stringify({ data: "%%%not base64%%%" }) })));
    expect(junk.status).toBe(400);
    expect((await db.query("select count(*)::int as n from images")).rows[0]).toEqual({ n: 0 });
  });

  it("answers 404 for a picture that doesn't exist or a made-up id", async () => {
    expect((await fetchImage(crypto.randomUUID())).status).toBe(404);
    expect((await fetchImage("../../etc/passwd")).status).toBe(404);
  });

  it("stops at the most pictures one account may keep", async () => {
    const first = await uploaded();
    await db.query(
      `insert into images (owner_id, bytes, width, height)
       select owner_id, bytes, width, height from images, generate_series(1, $1) where id = $2`,
      [MAX_IMAGES_PER_ACCOUNT - 1, first],
    );
    const res = await upload(fakeJpeg(20, 20));
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe("image_limit");
    // another account is not affected
    expect((await upload(fakeJpeg(20, 20), otherCookie)).status).toBe(201);
  });
});

describe("pictures on questions and options", () => {
  it("saves a question's picture and each option's picture, and gives them to voters", async () => {
    const [q, cat, dog] = [await uploaded(), await uploaded(), await uploaded()];
    const code = await newCode({
      title: "Pets",
      focusTopics: [
        { name: "Which one?", kind: "poll", topics: ["Cat", "Dog", "Fish"], image: q, itemImages: { Cat: cat, "  dog ": dog } },
        { name: "Say why", kind: "text" },
      ],
      criteria: [],
    });
    const s = await info(code);
    expect(s.focusTopics[0].imageId).toBe(q);
    expect(s.focusTopics[1].imageId ?? null).toBeNull();
    const byName = Object.fromEntries(s.topics.map((t) => [t.name, t.imageId ?? null]));
    expect(byName).toEqual({ Cat: cat, Dog: dog, Fish: null });
  });

  it("works for every type with options, and for items to score", async () => {
    const pic = await uploaded();
    const code = await newCode({
      title: "All types",
      focusTopics: [
        { name: "Score", kind: "rating", topics: ["Logo A"], itemImages: { "Logo A": pic } },
        { name: "Several", kind: "multi", topics: ["A", "B"], itemImages: { A: pic } },
        { name: "Order", kind: "rank", topics: ["A", "B"], itemImages: { B: pic } },
        { name: "Quiz", kind: "quiz", topics: ["A", "B"], correct: "A", itemImages: { A: pic }, image: pic },
        { name: "Words", kind: "words", image: pic },
      ],
      criteria: ["Looks"],
    });
    const s = await info(code);
    const withPics = s.topics.filter((t) => t.imageId).map((t) => `${s.focusTopics.find((f) => f.id === t.focusId)!.kind}:${t.name}`);
    expect(withPics).toEqual(["rating:Logo A", "multi:A", "rank:B", "quiz:A"]);
    expect(s.focusTopics.filter((f) => f.imageId).map((f) => f.kind)).toEqual(["quiz", "words"]);
  });

  it("ignores a picture that belongs to another account, or doesn't exist", async () => {
    const theirs = await uploaded(fakeJpeg(30, 30), otherCookie);
    const code = await newCode({
      title: "Borrowed",
      focusTopics: [{ name: "Q", kind: "poll", topics: ["A", "B"], image: theirs, itemImages: { A: theirs, B: crypto.randomUUID() } }],
      criteria: [],
    });
    const s = await info(code);
    expect(s.focusTopics[0].imageId ?? null).toBeNull();
    expect(s.topics.map((t) => t.imageId ?? null)).toEqual([null, null]);
  });

  it("refuses a picture id that isn't an id", async () => {
    const res = await create({ title: "Bad", focusTopics: [{ name: "Q", kind: "poll", topics: ["A", "B"], image: "javascript:alert(1)" }], criteria: [] });
    expect(res.status).toBe(400);
  });

  it("keeps, swaps and removes pictures when the presentation is edited", async () => {
    const [q, a, b, fresh] = [await uploaded(), await uploaded(), await uploaded(), await uploaded()];
    const code = await newCode({
      title: "Edit me",
      focusTopics: [{ name: "Q", kind: "poll", topics: ["A", "B", "C"], image: q, itemImages: { A: a, B: b } }],
      criteria: [],
    });
    const before = await info(code);
    const focus = before.focusTopics[0];
    const [ta, tb, tc] = before.topics;
    const res = await put(code, {
      title: "Edit me",
      scaleMax: 5,
      lowLabel: "Low",
      highLabel: "High",
      criteria: [],
      focusTopics: [
        {
          id: focus.id,
          name: "Q",
          kind: "poll",
          // A keeps its picture, B loses it, C gets one; the question's picture is taken off
          topics: [{ id: ta.id, name: "A" }, { id: tb.id, name: "B" }, { id: tc.id, name: "C" }, { name: "D" }],
          image: null,
          itemImages: { A: a, C: fresh, D: fresh },
        },
        { name: "New one", kind: "text", image: q },
      ],
    });
    expect(res.status).toBe(200);
    const after = await info(code);
    expect(after.focusTopics.map((f) => f.imageId ?? null)).toEqual([null, q]);
    expect(Object.fromEntries(after.topics.map((t) => [t.name, t.imageId ?? null]))).toEqual({ A: a, B: null, C: fresh, D: fresh });
  });

  it("gives the owner's edit form the pictures back", async () => {
    const pic = await uploaded();
    const code = await newCode({ title: "Round trip", focusTopics: [{ name: "Q", kind: "poll", topics: ["A", "B"], image: pic, itemImages: { B: pic } }], criteria: [] });
    const res = await adminSession.GET(new Request(`${ORIGIN}/x`, authed()), ctx(code));
    const body = (await res.json()) as { session: SessionPayload };
    expect(body.session.focusTopics[0].imageId).toBe(pic);
    expect(body.session.topics.map((t) => t.imageId ?? null)).toEqual([null, pic]);
  });
});

describe("cleaning up pictures nobody uses", () => {
  const purge = () => {
    process.env.CRON_SECRET = "a-long-enough-cron-secret";
    return purgeRoute.GET(new Request(`${ORIGIN}/api/cron/purge`, { headers: { authorization: "Bearer a-long-enough-cron-secret" } }));
  };
  const ids = async () => ((await db.query("select id from images order by created_at, id")).rows as { id: string }[]).map((r) => r.id);

  it("deletes pictures that are on no question or option after a day, and keeps the rest", async () => {
    const [used, onOption, unused, justUploaded] = [await uploaded(), await uploaded(), await uploaded(), await uploaded()];
    await newCode({ title: "Keeps", focusTopics: [{ name: "Q", kind: "poll", topics: ["A", "B"], image: used, itemImages: { A: onOption } }], criteria: [] });
    await db.query("update images set created_at = now() - interval '2 days' where id <> $1", [justUploaded]);
    expect((await purge()).status).toBe(200);
    expect((await ids()).sort()).toEqual([used, onOption, justUploaded].sort());
    expect((await fetchImage(unused)).status).toBe(404);
  });

  it("deletes a presentation's pictures once the presentation is gone", async () => {
    const pic = await uploaded();
    const code = await newCode({ title: "Going", focusTopics: [{ name: "Q", kind: "text", image: pic }], criteria: [] });
    await db.query("update images set created_at = now() - interval '2 days'");
    await purge();
    expect(await ids()).toEqual([pic]);
    await adminSession.DELETE(new Request(`${ORIGIN}/x`, authed({ method: "DELETE" })), ctx(code));
    await purge();
    expect(await ids()).toEqual([]);
  });
});

describe("pictures in the builder and on screen", () => {
  it("keeps each row's picture through editing, and sends them by item name", () => {
    const rows = rowsFrom([{ id: "1", name: "Cat", imageId: "pic-1" }, { name: "Dog" }, { name: " Fish ", imageId: "pic-2" }]);
    expect(rows.map((r) => r.image)).toEqual(["pic-1", undefined, "pic-2"]);
    expect(imagesOf(rows)).toEqual({ Cat: "pic-1", Fish: "pic-2" });
    expect(imagesOf([{ name: "", image: "pic-3" }])).toEqual({});
  });

  it("shows pictures in the preview", () => {
    const [q] = previewQuestions([{ kind: "poll", name: "Pick", options: ["Cat", "Dog"], image: "pic-q", itemImages: { Cat: "pic-1" } }]);
    expect(q.image).toBe("pic-q");
    expect(q.options.map((o) => o.imageId ?? null)).toEqual(["pic-1", null]);
  });

  it("carries a question's picture to the results screen", () => {
    const [g] = groupByFocus([{ id: "f", name: "Q", kind: "poll", imageId: "pic-q" }], [{ id: "t", name: "A", focusId: "f", imageId: "pic-1" }]);
    expect(g.focus.imageId).toBe("pic-q");
    expect(g.topics[0].item.imageId).toBe("pic-1");
  });

  it("draws pictures with one component, lazily, from this site only", () => {
    const pic = read("components/Picture.tsx");
    expect(pic).toContain("imageUrl(id)");
    expect(imageUrl("abc")).toBe("/api/img/abc");
    expect(pic).toContain('loading="lazy"');
    expect(pic).toMatch(/alt=/);
  });

  it("lets the presenter add pictures to a question and to each option in the builder", () => {
    const form = read("components/admin/PresentationForm.tsx");
    expect(form).toMatch(/<PicturePicker\b/);
    expect(form).toContain("itemImages");
    expect(read("components/admin/ListEditor.tsx")).toMatch(/<PicturePicker\b/);
    const picker = read("components/admin/PicturePicker.tsx");
    expect(picker).toContain("Add a picture");
    expect(picker).toContain("shrinkToJpeg");
    expect(picker).toContain('accept="image/*"');
  });

  it("shows option pictures on every answer card and the question's picture above it", () => {
    for (const card of ["components/PollCard.tsx", "components/vote/MultiCard.tsx", "components/vote/QuizCard.tsx", "components/vote/RankCard.tsx", "components/TopicCard.tsx"])
      expect(read(card), card).toMatch(/<(OptionPicture|Picture)\b/);
    expect(read("components/VoterChrome.tsx")).toMatch(/<QuestionPicture\b/);
  });

  it("shows pictures on the big screen: the question's, and beside each option's result", () => {
    expect(read("components/ScreenChrome.tsx")).toMatch(/<QuestionPicture\b/);
    expect(read("components/DashboardApp.tsx")).toMatch(/imageId/);
    for (const view of ["components/PollResults.tsx", "components/results/RankResults.tsx", "components/results/QuizResults.tsx", "components/OverallBars.tsx"])
      expect(read(view), view).toMatch(/<(OptionPicture|Picture)\b/);
  });
});
