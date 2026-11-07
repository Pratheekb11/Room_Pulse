import { describe, expect, it } from "vitest";
import { CHARACTERS, charactersFor } from "@/lib/decor";
import { THEMES } from "@/lib/themes";
import { createSessionSchema, editSessionSchema } from "@/lib/validation";

describe("fun illustrations", () => {
  it("has a cast of original doodle characters", () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CHARACTERS).size).toBe(CHARACTERS.length);
  });

  it("gives every design a big-screen character and a different phone character", () => {
    for (const t of THEMES) {
      const c = charactersFor(t.id);
      expect(CHARACTERS).toContain(c.screen);
      expect(CHARACTERS).toContain(c.phone);
      expect(c.screen).not.toBe(c.phone);
    }
  });

  it("the anime design gets the chibi cat", () => {
    expect(Object.values(charactersFor("anime"))).toContain("cat");
  });

  it("unknown designs still get characters", () => {
    expect(CHARACTERS).toContain(charactersFor("nope").screen);
  });

  it("is on unless the presenter turns it off; editing without it keeps it", () => {
    const base = { title: "x", focusTopics: [{ name: "Q", kind: "poll", topics: ["a", "b"] }], criteria: [] };
    expect(createSessionSchema.parse(base).decor).toBe(true);
    expect(createSessionSchema.parse({ ...base, decor: false }).decor).toBe(false);
    const edit = { ...base, scaleMax: 5, lowLabel: "Low", highLabel: "High", focusTopics: [{ name: "Q", kind: "poll", topics: [{ name: "a" }, { name: "b" }] }] };
    expect(editSessionSchema.parse(edit).decor).toBeUndefined();
    expect(editSessionSchema.parse({ ...edit, decor: false }).decor).toBe(false);
  });
});
