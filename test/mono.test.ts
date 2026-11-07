import { describe, expect, it } from "vitest";
import { getTheme, themeStyle, THEME_IDS } from "@/lib/themes";
import { readableOn, scaleColor, TOPIC_COLORS, topicColor, topicInk } from "@/lib/colors";

const isGrey = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return Math.max(r, g, b) - Math.min(r, g, b) <= 2;
};

describe("Mono is plain: black, white and greys, nothing colourful", () => {
  it("every Mono colour is a grey, except red for errors", () => {
    const { error, ...rest } = getTheme("mono").colors;
    for (const [k, v] of Object.entries(rest)) expect(isGrey(v), `${k} ${v}`).toBe(true);
    expect(error).toMatch(/^#/);
  });

  it("Mono turns option colours, score colours and illustrations grey", () => {
    const s = themeStyle("mono");
    expect(s["--theme-chroma"]).toBe("0%");
    expect(s["--doodle-halo"]).toContain("grayscale(1)");
    for (const k of ["--color-peach", "--color-sky", "--color-gold", "--color-coral"]) expect(isGrey(s[k]), k).toBe(true);
  });

  it("every other design keeps full colour", () => {
    for (const id of THEME_IDS.filter((t) => t !== "mono")) {
      expect(themeStyle(id)["--theme-chroma"], id).toBe("100%");
      expect(themeStyle(id)["--doodle-halo"], id).not.toContain("grayscale");
    }
  });
});

describe("option and score colours follow the design's colour strength", () => {
  it("option colours carry --theme-chroma (full colour by default)", () => {
    for (let i = 0; i < 8; i++) {
      expect(topicColor(i)).toContain(TOPIC_COLORS[i]);
      expect(topicColor(i)).toContain("var(--theme-chroma, 100%)");
      expect(topicInk(i)).toContain("var(--theme-chroma, 100%)");
    }
  });

  it("text on an option colour still picks ink or white correctly", () => {
    for (let i = 0; i < 8; i++) expect(readableOn(topicColor(i))).toBe(readableOn(TOPIC_COLORS[i]));
  });

  it("score colours carry it too, and their text colour still reads", () => {
    const c = scaleColor(5, 5);
    expect(c.bg).toContain("var(--theme-chroma, 100%)");
    expect(c.fg).toMatch(/^#[0-9a-f]{6}$/);
  });
});
