// UX round (2026-11-21): a waiting room on the big screen until the first answer, a finish screen worth seeing,
// "Follow me" (phones follow the presenter's question), an easier guest start and moderation everywhere.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WaitingRoom } from "@/components/results/WaitingRoom";
import { ThankYou } from "@/components/vote/ThankYou";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const dash = read("components/DashboardApp.tsx");
const vote = read("components/VoteApp.tsx");

describe("5. the big screen waits for the room in style", () => {
  const room = html(createElement(WaitingRoom, { url: "https://liverate-beta.vercel.app/s/k7m2qp", code: "k7m2qp", questions: 4, onSkip: () => {} }));

  it("shows a big QR code on real white, the address and the code", () => {
    expect(room).toContain("<svg");
    expect(room).toMatch(/background-color:#ffffff/);
    expect(room).toContain("liverate-beta.vercel.app");
    expect(room).toContain("k7m2qp");
    expect(room).toMatch(/Scan to join/);
  });

  it("says it's waiting for the first answer, politely to screen readers", () => {
    expect(room).toMatch(/role="status"/);
    expect(room).toMatch(/Waiting for the first answer/);
  });

  it("lets the presenter look at the questions instead", () => {
    expect(room).toMatch(/<button[^>]*>Show the questions<\/button>/);
  });

  it("the presenter's screen shows it until the first answer, and hides the side QR meanwhile", () => {
    expect(dash).toMatch(/const waiting = !audience && voters === 0 && groups\.length > 0 && !skipWaiting/);
    expect(dash).toContain("<WaitingRoom");
    expect(dash).toMatch(/showQr && joinUrl && !waiting/);
    // the waiting room is the QR: no "Hide QR" toggle that does nothing while it's up (sweep 2026-11-21)
    expect(dash).toMatch(/\{audience \? \([\s\S]*?\) : waiting \? null : \(\s*<button[\s\S]*?aria-pressed=\{showQr\}/);
    expect(dash).not.toContain("No answers yet. Ask people to scan the QR code.");
  });

  it("its motion stops for people who ask for reduced motion", () => {
    const css = read("app/globals.css");
    const reduced = css.slice(css.indexOf(".waiting-qr {"));
    expect(reduced).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.waiting-dots > span, \.waiting-qr \{ animation: none; \}/);
  });
});

describe("3. a finish screen worth seeing", () => {
  const base = {
    title: "Sprint retro",
    statuses: {},
    celebrate: false,
    questions: ["How did this sprint feel?", "What went well?"],
  };

  it("lists the questions answered, each with a tick", () => {
    const out = html(createElement(ThankYou, base));
    expect(out).toContain("How did this sprint feel?");
    expect(out).toContain("What went well?");
    expect(out.match(/data-answered/g)?.length).toBe(2);
  });

  it("finishing is final: no way back to change answers (owner, 2026-11-21: keeps the big screen steady)", () => {
    const out = html(createElement(ThankYou, base));
    expect(out).not.toContain("Change my answers");
    expect(read("components/vote/ThankYou.tsx")).not.toContain("onChangeAnswers");
  });

  it("without shared results, points people at the big screen instead of telling them to close the page", () => {
    const out = html(createElement(ThankYou, base));
    expect(out).toMatch(/big screen/);
    expect(out).not.toMatch(/You can close this page/);
  });

  it("the results button pops in when the presenter shares results", () => {
    const out = html(createElement(ThankYou, { ...base, resultsHref: "/s/k7m2qp/results" }));
    expect(out).toMatch(/<a[^>]*animate-pop[^>]*>See live results<\/a>/);
  });

  it("from the questions, people can get back to the finish screen", () => {
    expect(vote).toMatch(/onClick=\{\(\) => setReviewing\(false\)\}[^>]*>\s*Back to the end/);
    expect(vote).not.toContain("onChangeAnswers");
  });
});

describe("3b. answers lock once people tap Finish", () => {
  it("a question locks once it's on the list Finish saved; Q&A and quiz never do", async () => {
    const { lockedStep, lockable } = await import("@/lib/finish-lock");
    const ids = ["poll-1", "item-1", "text-1", "qa-1", "quiz-1"];
    expect(lockedStep("poll", "poll-1", ids)).toBe(true);
    expect(lockedStep("rating", "item-1", ids)).toBe(true);
    expect(lockedStep("text", "text-1", ids)).toBe(true);
    // answered but Finish not tapped yet (or a question added after Finish): free to change
    expect(lockedStep("poll", "poll-2", ids)).toBe(false);
    // Q&A is a live list (ask, upvote new questions); a quiz answer is one-shot on the server already
    expect(lockedStep("qa", "qa-1", ids)).toBe(false);
    expect(lockedStep("quiz", "quiz-1", ids)).toBe(false);
    expect(lockable("words")).toBe(true);
  });

  it("the phone remembers what it locked, per presentation, and survives odd storage", async () => {
    const { endedKey, readLocked } = await import("@/lib/finish-lock");
    expect(endedKey("k7m2qp")).toBe("liverate:ended:k7m2qp");
    expect(readLocked(true)).toEqual([]);
    expect(readLocked(["a", 3, "b"])).toEqual(["a", "b"]);
    expect(vote).toMatch(/useState<string\[\]>\(\(\) => readLocked\(readJSON<unknown>\(endedKey\(code\), \[\]\)\)\)/);
  });

  it("every answer card except Q&A and quiz is read-only when locked", () => {
    expect(vote).toMatch(/const locked = here \? lockedStep\(here\.kind, stepId\(here\), lockedIds\) : false;/);
    for (const card of ["TopicCard", "PollCard", "MultiCard", "RankCard", "NumberCard", "BoardCard", "TextCard", "WordsCard"]) {
      const at = vote.indexOf(`<${card}`, vote.indexOf("{!here || !group ?"));
      const props = vote.slice(at, vote.indexOf("/>", at));
      expect(props, card).toContain("disabled={!isOpen || locked}");
    }
    for (const card of ["QaCard", "QuizCard"]) {
      const at = vote.indexOf(`<${card}`, vote.indexOf("{!here || !group ?"));
      expect(vote.slice(at, vote.indexOf("/>", at)), card).toContain("disabled={!isOpen}");
    }
  });

  it("says so, instead of promising changes", () => {
    expect(vote).toContain("Locked in: you’ve finished, so this answer stays as it is.");
    expect(vote).toContain("Your answers are locked in.");
    expect(vote).not.toContain("You can change any answer until voting closes.");
    for (const f of ["components/vote/TextCard.tsx", "components/vote/NumberCard.tsx"]) {
      expect(read(f), f).toMatch(/disabled \? "Sent\." : "Sent\. You can change it until voting closes\."/);
    }
  });
});

describe("6. guests build first, the code comes when it matters", () => {
  const options = read("components/admin/GuestOptions.tsx");
  const admin = read("components/admin/AdminApp.tsx");

  it("'Start now' goes straight to the builder, no code screen first", () => {
    const start = options.slice(options.indexOf("async function start()"), options.indexOf("async function comeBack"));
    expect(start).toMatch(/rememberGuestCode\(body\.guestCode\);\s*onSignedIn\(\);/);
    expect(options).not.toContain("I&rsquo;ve saved it");
  });

  it("the code card shows the code with a Copy button, as a dialog", async () => {
    const { GuestCodeCard } = await import("@/components/admin/GuestCodeCard");
    const out = html(
      createElement(GuestCodeCard, { code: "K7QM-3XPA", title: "Saved. Here's your guest code", primary: "I've saved it", onPrimary: () => {} }),
    );
    expect(out).toContain("K7QM-3XPA");
    expect(out).toMatch(/role="dialog"/);
    expect(out).toMatch(/aria-modal="true"/);
    expect(out).toMatch(/>Copy</);
  });

  it("shows the code after a guest's first presentation is saved, once per browser session", () => {
    expect(admin).toMatch(/guest && guestCode && !codeSeen\(\)/);
    expect(admin).toContain("Saved. Here&rsquo;s your guest code");
  });

  it("shows the code again before a guest logs out", () => {
    expect(admin).toContain("Before you go: your guest code");
    expect(admin).not.toContain("Log out anyway");
  });
});
