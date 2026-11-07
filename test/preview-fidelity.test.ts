import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const uses = (code: string, names: string[]) => names.filter((n) => !new RegExp(`<${n}[\\s>]`).test(code));

describe("the builder preview is drawn with the same pieces as the real screens", () => {
  const preview = src("components/admin/PresentationPreview.tsx");

  it("phone: same header, progress bar with question chips, level line and Back / Next as the voter page", () => {
    const parts = ["VoterHeader", "VoterProgress", "StepIntro", "StepNav"];
    expect(uses(src("components/VoteApp.tsx"), parts)).toEqual([]);
    expect(uses(preview, parts)).toEqual([]);
  });

  it("big screen: same header, live pills, question tabs, card and QR panel as the results screen", () => {
    const parts = ["ScreenHeader", "VotingPills", "QuestionTabs", "QuestionDescription", "ResultCard"];
    expect(uses(src("components/DashboardApp.tsx"), parts)).toEqual([]);
    expect(uses(preview, [...parts, "QrPanel", "LiveBadge"])).toEqual([]);
  });
});
