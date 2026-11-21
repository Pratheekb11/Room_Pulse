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
    expect(dash).not.toContain("No answers yet. Ask people to scan the QR code.");
  });
});

describe("3. a finish screen worth seeing", () => {
  const base = {
    title: "Sprint retro",
    statuses: {},
    celebrate: false,
    questions: ["How did this sprint feel?", "What went well?"],
    onChangeAnswers: () => {},
  };

  it("lists the questions answered, each with a tick", () => {
    const out = html(createElement(ThankYou, base));
    expect(out).toContain("How did this sprint feel?");
    expect(out).toContain("What went well?");
    expect(out.match(/data-answered/g)?.length).toBe(2);
  });

  it("lets people change their answers", () => {
    expect(html(createElement(ThankYou, base))).toMatch(/<button[^>]*>Change my answers<\/button>/);
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
    expect(vote).toMatch(/onChangeAnswers=\{\(\) => \{\s*setReviewing\(true\);\s*goTo\(0\);/);
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
