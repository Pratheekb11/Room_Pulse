import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, generateCode, normalizeCode } from "@/lib/code";
import { toCsv } from "@/lib/csv";
import { readableOn, scaleColor, TOPIC_COLORS } from "@/lib/colors";
import { avg, indexCells, sumAggs, topicHistograms } from "@/lib/stats";
import { createSessionSchema, splitLines } from "@/lib/validation";

function contrast(a: string, b: string) {
  const lum = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const f = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("session codes", () => {
  it("are 6 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const c = generateCode();
      expect(c).toHaveLength(6);
      for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
    }
    expect(CODE_ALPHABET).not.toMatch(/[ilo01]/);
  });

  it("normalises typed codes", () => {
    expect(normalizeCode(" #AB3-K9Q ")).toBe("ab3k9q");
  });
});

describe("csv", () => {
  it("starts with a BOM, quotes special characters and uses CRLF", () => {
    expect(toCsv([["a", 1], ['say "hi", ok', 2]])).toBe('﻿a,1\r\n"say ""hi"", ok",2\r\n');
  });

  it("neutralises spreadsheet formulas in text cells", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "@x", "-y"]])).toBe("﻿'=HYPERLINK(1),'+1,'@x,'-y\r\n");
  });
});

describe("colours", () => {
  it("heatmap text keeps ≥ 4.5:1 contrast at every value on every scale", () => {
    for (let max = 3; max <= 10; max++) {
      for (let v = 1; v <= max; v += 0.1) {
        const { bg, fg } = scaleColor(v, max);
        // full colour, and the grey Mono shows instead
        const [full, grey] = bg.match(/#[0-9a-f]{6}/gi)!;
        expect(contrast(full, fg), `${v}/${max}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(grey, fg), `grey ${v}/${max}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("scale goes from light to dark", () => {
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    const full = (s: string) => s.match(/#[0-9a-f]{6}/i)![0];
    expect(lum(full(scaleColor(1, 5).bg))).toBeGreaterThan(lum(full(scaleColor(5, 5).bg)));
  });

  it("text on topic colours is readable", () => {
    for (const c of TOPIC_COLORS) expect(contrast(c, readableOn(c)), c).toBeGreaterThanOrEqual(3);
  });
});

describe("stats", () => {
  it("averages and sums aggregates, ignoring missing cells", () => {
    expect(avg(undefined)).toBeNull();
    expect(avg({ n: 0, sum: 0 })).toBeNull();
    expect(sumAggs([{ n: 2, sum: 7 }, undefined, { n: 1, sum: 2 }])).toEqual({ n: 3, sum: 9 });
    const m = indexCells([{ topicId: "t", criterionId: "c", n: 2, sum: 9 }]);
    expect(avg(m.get("t:c"))).toBe(4.5);
  });

  it("builds per-topic score histograms across criteria", () => {
    const h = topicHistograms(
      [
        { topicId: "t", criterionId: "a", score: 1, n: 2 },
        { topicId: "t", criterionId: "b", score: 1, n: 1 },
        { topicId: "t", criterionId: "b", score: 5, n: 4 },
      ],
      5,
    );
    expect(h.get("t")).toEqual([3, 0, 0, 0, 4]);
  });
});

describe("validation", () => {
  it("splitLines trims, drops blanks and case-insensitive duplicates", () => {
    expect(splitLines(" A \n\nb\r\na\n  B  \nc d   e")).toEqual(["A", "b", "c d e"]);
  });

  it("applies defaults", () => {
    const r = createSessionSchema.parse({ title: "t", focusTopics: [{ name: "f", topics: ["a"] }], criteria: ["b"] });
    expect(r).toMatchObject({ scaleMax: 5, lowLabel: "Low", highLabel: "High" });
  });
});

import { criterionHistograms } from "@/lib/stats";

describe("criterionHistograms", () => {
  it("counts each score per criterion for one topic, ignoring other topics and out-of-range scores", () => {
    const h = criterionHistograms(
      [
        { topicId: "t", criterionId: "x", score: 1, n: 2 },
        { topicId: "t", criterionId: "x", score: 3, n: 5 },
        { topicId: "t", criterionId: "y", score: 5, n: 1 },
        { topicId: "other", criterionId: "x", score: 2, n: 9 },
        { topicId: "t", criterionId: "x", score: 9, n: 9 },
      ],
      "t",
      ["x", "y", "z"],
      5,
    );
    expect(h).toEqual({ x: [2, 0, 5, 0, 0], y: [0, 0, 0, 0, 1], z: [0, 0, 0, 0, 0] });
  });
});

import { TOPIC_INKS } from "@/lib/colors";

describe("topic text colours", () => {
  it("are readable on white (≥ 4.5:1)", () => {
    for (const c of TOPIC_INKS) expect(contrast(c, "#ffffff"), c).toBeGreaterThanOrEqual(4.5);
  });
});
