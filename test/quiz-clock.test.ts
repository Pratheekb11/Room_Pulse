import { describe, expect, it } from "vitest";
import { clockOffset, quizOwnerAction, quizStartConfirmed, quizTimeLeft } from "@/lib/quiz";

const live = {
  focusId: "f",
  startedAt: "2026-01-01T10:00:00.000Z",
  endsAt: "2026-01-01T10:00:20.000Z",
  seconds: 20,
  now: "2026-01-01T10:00:05.000Z",
  correctTopicId: null,
};

describe("quiz clock", () => {
  it("measures how far the phone's clock is from the server's", () => {
    // phone thinks it's 10:00:08 when the server said 10:00:05
    expect(clockOffset(live.now, Date.parse("2026-01-01T10:00:08Z"))).toBe(-3000);
  });

  it("counts down in server time, never below zero", () => {
    const phoneNow = Date.parse("2026-01-01T10:00:13Z"); // = 10:00:10 on the server
    expect(quizTimeLeft(live, phoneNow, -3000)).toBe(10_000);
    expect(quizTimeLeft(live, phoneNow + 60_000, -3000)).toBe(0);
  });
});

describe("presenter's quiz controls", () => {
  const tap = Date.parse("2026-01-01T10:00:00.500Z");

  it("treats a start as confirmed once the server's round began at or after the tap", () => {
    expect(quizStartConfirmed({ focusId: "f", at: tap }, live, 0)).toBe(true);
    // the round on the server is an older one: not confirmed yet
    expect(quizStartConfirmed({ focusId: "f", at: tap + 60_000 }, live, 0)).toBe(false);
    expect(quizStartConfirmed({ focusId: "f", at: tap }, null, 0)).toBe(false);
    expect(quizStartConfirmed({ focusId: "other", at: tap }, live, 0)).toBe(false);
  });

  it("offers End while running, Next after a round when there is one, otherwise a way to (re)start", () => {
    expect(quizOwnerAction({ running: true, ended: false, total: 0, hasNext: true })).toBe("end");
    expect(quizOwnerAction({ running: false, ended: true, total: 3, hasNext: true })).toBe("next");
    expect(quizOwnerAction({ running: false, ended: false, total: 0, hasNext: false })).toBe("start");
    expect(quizOwnerAction({ running: false, ended: false, total: 4, hasNext: true })).toBe("again");
    // the last question just ended: the presenter can still run it again (or start it, if nobody answered)
    expect(quizOwnerAction({ running: false, ended: true, total: 3, hasNext: false })).toBe("again");
    expect(quizOwnerAction({ running: false, ended: true, total: 0, hasNext: false })).toBe("start");
  });
});
