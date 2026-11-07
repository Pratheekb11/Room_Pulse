import { describe, expect, it } from "vitest";
import { clockOffset, quizTimeLeft } from "@/lib/quiz";

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
