// Profanity filter for team activities: a leaf (sticky note, star) or the name it's signed with
// that has a bad word, or a disguised one, is never put on the board.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as adminSessions from "@/app/api/admin/sessions/route";
import * as sessionRoute from "@/app/api/session/[code]/route";
import * as resultsRoute from "@/app/api/results/[code]/route";
import * as answerRoute from "@/app/api/answer/route";
import { BAD_WORDS, hasBadWords } from "@/lib/profanity";
import type { ResultsPayload, SessionPayload } from "@/lib/types";

describe("hasBadWords", () => {
  it("catches plain bad words, whatever the case", () => {
    for (const s of ["fuck", "This is SHIT", "you bitch", "what an asshole", "Bastard", "cunt", "dick", "piss off", "wanker"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches the usual endings and compounds", () => {
    for (const s of ["fucking", "fucked up", "motherfucker", "fuckers", "bullshit", "shitty", "dipshit", "bitches", "dickhead", "dumbass", "jackass", "asses", "pissed off", "bastards"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches letters swapped for numbers and symbols", () => {
    for (const s of ["sh1t", "fvck", "fuk", "a$$", "@ss", "b!tch", "5hit", "a55hole", "phuck", "fck this"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches stretched letters", () => {
    for (const s of ["fuuuuck", "shiiiit", "biiitch", "asssss", "fuckkkk"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches letters spaced out or dotted", () => {
    for (const s of ["f u c k", "s.h.i.t", "f-u-c-k you", "b i t c h"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches words starred out", () => {
    for (const s of ["f*ck", "f**k", "sh*t", "b*tch", "a**hole"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches accents and look-alike letters", () => {
    for (const s of ["fück", "shït", "bítch"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches common Hindi and Hinglish abuse", () => {
    for (const s of ["chutiya", "Bhenchod", "madarchod", "bsdk", "gandu", "bhosdike", "harami"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches fck and its forms", () => {
    for (const s of ["fck", "Fck", "f c k", "fcking", "fckin", "fcked", "fcker"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("catches insults aimed at people (it's a team board, not just swearing)", () => {
    for (const s of ["idiot", "Idiots", "idiotic", "idi0t", "you stupid", "STUPID", "stoopid", "stupidity", "moron", "morons", "imbecile", "dimwit", "nitwit", "halfwit", "bewakoof", "bevakoof"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("leaves words that only look like insults alone", () => {
    for (const s of ["Idiom of the day", "Studio session", "Stupa visit"]) {
      expect(hasBadWords(s), s).toBe(false);
    }
  });

  it("catches slurs", () => {
    for (const s of ["faggot", "retard", "retarded"]) {
      expect(hasBadWords(s), s).toBe(true);
    }
  });

  it("leaves ordinary words alone, even ones with a bad word inside", () => {
    for (const s of [
      "Our class did a great job",
      "Pass the assessment",
      "I assume the bass is fine",
      "Scunthorpe office",
      "cocktail party, peacock and Hancock",
      "Reading Dickens",
      "therapist and grape juice",
      "shiitake mushrooms",
      "cumulative score and cumin",
      "Glass half full",
      "button, title, analysis",
      "Snigger",
      "Sussex team",
      "Arsenal fan",
      "I'm cocky about our release",
      "Ship it in 2025",
      "Great demo! :)",
      "chutney and samosas",
      "Hello, Priya!",
      "documentation, assets, passion",
      "Team lead: A. S. Rao",
      "",
    ]) {
      expect(hasBadWords(s), s).toBe(false);
    }
  });

  it("doesn't count stars on their own", () => {
    expect(hasBadWords("***** five stars")).toBe(false);
  });

  it("keeps its list in one place, in lower case, so words are easy to add", () => {
    expect(BAD_WORDS.length).toBeGreaterThan(60);
    for (const w of BAD_WORDS) expect(w, w).toMatch(/^\*?[a-z]+\*?\+?$/);
  });
});

let db: PGlite;
let cookie = "";
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const info = async (code: string) => (await (await sessionRoute.GET(new Request(`${ORIGIN}/x`), ctx(code))).json()) as SessionPayload;
const results = async (code: string) =>
  (await (await resultsRoute.GET(new Request(`${ORIGIN}/x`, { headers: { cookie } }), ctx(code))).json()) as ResultsPayload;
const leaf = (code: string, focusId: string, slot: number, text: string, author?: string) =>
  answerRoute.POST(
    new Request(`${ORIGIN}/api/answer`, {
      method: "POST",
      body: JSON.stringify({ kind: "text", code, focusId, voterId: crypto.randomUUID(), slot, text, ...(author ? { author } : {}) }),
    }),
  );

async function tree() {
  const res = await adminSessions.POST(
    new Request(`${ORIGIN}/api/admin/sessions`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ title: "Motivation tree", criteria: [], focusTopics: [{ name: "What motivates you?", kind: "text", board: "tree" }] }),
    }),
  );
  const { code } = (await res.json()) as { code: string };
  return { code, focusId: (await info(code)).focusTopics[0].id };
}

beforeAll(async () => {
  db = await startTestDb();
  cookie = (await signUp("profanity@example.com")).cookie!;
});
beforeEach(async () => {
  await db.exec("truncate sessions cascade");
});

describe("a board refuses leaves with bad words", () => {
  it("doesn't put a leaf with a bad word on the board", async () => {
    const { code, focusId } = await tree();
    const res = await leaf(code, focusId, 0, "this sprint was sh1t");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("blocked_words");
    expect((await results(code)).texts).toEqual([]);
  });

  it("doesn't sign a leaf with a bad name", async () => {
    const { code, focusId } = await tree();
    const res = await leaf(code, focusId, 0, "Coffee", "Mr F*ck");
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("blocked_words");
    expect((await results(code)).texts).toEqual([]);
  });

  it("still takes clean leaves, including ones with a bad word hidden inside a good one", async () => {
    const { code, focusId } = await tree();
    expect((await leaf(code, focusId, 0, "Our class passed the assessment", "Priya")).status).toBe(200);
    expect((await results(code)).texts.map((t) => t.text)).toEqual(["Our class passed the assessment"]);
  });
});

describe("the phone's leaf card", () => {
  const src = readFileSync("components/vote/BoardCard.tsx", "utf8");

  it("checks the leaf and the name before sending, and says why it won't", () => {
    expect(src).toContain("hasBadWords");
    expect(src).toMatch(/role="alert"/);
    expect(src).toContain("BLOCKED_MESSAGE");
  });

  it("uses one friendly message", async () => {
    const { BLOCKED_MESSAGE } = await import("@/lib/profanity");
    expect(BLOCKED_MESSAGE).toMatch(/word/i);
    expect(BLOCKED_MESSAGE.length).toBeLessThan(120);
  });
});
