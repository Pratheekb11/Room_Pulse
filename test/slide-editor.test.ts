// The slide editor (2026-11-22). A director had to phone the owner to ask how to build a presentation: the
// builder showed ~25 controls for one Score items question (9 type chips, a shortcut, description and picture
// links, per-row buttons, the scoring box with two measures, chart chips) in one narrow column, and "+ Add item"
// was small grey text like "+ description". Now it works like Mentimeter or Slido: a list of questions on the
// left, one question at a time in the middle, and the phone it will appear on, live, on the right. You pick the
// kind of question first from big tiles; extras wait under "More options". On a phone the list folds: the
// question being edited opens in place.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blank,
  DEFAULT_CRITERIA,
  duplicateQuestion,
  fromPreset,
  moveQuestion,
  presentationProblems,
  railLabel,
  removeQuestion,
  type QuestionDraft,
} from "@/lib/builder";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const dir = "components/admin/builder";
const has = (f: string) => readdirSync(new URL(`../${dir}`, import.meta.url)).includes(f);

const q = (key: number, patch: Partial<QuestionDraft> = {}): QuestionDraft => ({ ...blank(key, "poll"), ...patch });

describe("questions: add, move, duplicate, remove", () => {
  const list = [q(1, { name: "A" }), q(2, { name: "B" }), q(3, { name: "C" })];

  it("removing a question selects the next one, or the one before when it was last", () => {
    expect(removeQuestion(list, 2)).toEqual({ list: [list[0], list[2]], selected: 3 });
    expect(removeQuestion(list, 3)).toEqual({ list: [list[0], list[1]], selected: 2 });
  });

  it("never removes the only question", () => {
    expect(removeQuestion([list[0]], 1)).toEqual({ list: [list[0]], selected: 1 });
  });

  it("moves a question up or down, and stays put at the ends", () => {
    expect(moveQuestion(list, 2, -1).map((x) => x.key)).toEqual([2, 1, 3]);
    expect(moveQuestion(list, 2, 1).map((x) => x.key)).toEqual([1, 3, 2]);
    expect(moveQuestion(list, 1, -1)).toBe(list);
    expect(moveQuestion(list, 3, 1)).toBe(list);
  });

  it("duplicates a question right after it, as a new unsaved question with a different name", () => {
    const saved = q(2, { id: "saved-q", name: "B", items: [{ id: "saved-opt", name: "Yes" }, { name: "No", key: "k1" }] });
    const out = duplicateQuestion([list[0], saved, list[2]], 2, 9);
    expect(out.map((x) => x.key)).toEqual([1, 2, 9, 3]);
    const copy = out[2];
    expect(copy.id).toBeUndefined();
    expect(copy.name).toBe("B (copy)");
    // saved option ids must not be shared: the copy's answers are its own
    expect(copy.items.map((r) => r.id)).toEqual([undefined, undefined]);
    expect(copy.items.map((r) => r.name)).toEqual(["Yes", "No"]);
  });

  it("the Yes / No / Not sure shortcut is a Pick one question with those options", () => {
    const yn = fromPreset("yes-no", 5);
    expect(yn.kind).toBe("poll");
    expect(yn.items.map((r) => r.name)).toEqual(["Yes", "No", "Not sure"]);
  });

  it("the list shows each question's words, or says it has none yet", () => {
    expect(railLabel(q(1, { name: "  Where next?  " }))).toBe("Where next?");
    expect(railLabel(q(1))).toBe("Untitled question");
  });
});

describe("problems belong to their question", () => {
  const base = { title: "Retro", criteria: DEFAULT_CRITERIA, lowLabel: "Low", highLabel: "High" };

  it("lists each question's own problems, so its row in the list can show a mark", () => {
    const list = [q(1, { name: "Fine", items: [{ name: "a" }, { name: "b" }] }), q(2, { name: "", items: [{ name: "a" }] })];
    const { all, byKey } = presentationProblems({ ...base, questions: list });
    expect(byKey.get(1) ?? []).toEqual([]);
    expect(byKey.get(2)).toEqual(["Write question 2.", "Add at least 2 options to question 2."]);
    expect(all).toEqual(byKey.get(2));
  });

  it("presentation-wide problems aren't tied to a question", () => {
    const { all, byKey } = presentationProblems({ ...base, title: " ", questions: [q(1, { name: "x", items: [{ name: "a" }, { name: "b" }] })] });
    expect(all).toEqual(["Give your presentation a name."]);
    expect(byKey.get(1) ?? []).toEqual([]);
  });
});

describe("Score items starts simple", () => {
  it("is scored on one thing by default (Impact and Effort made every new question a two-measure grid)", () => {
    expect(DEFAULT_CRITERIA).toHaveLength(1);
  });
});

describe("the layout", () => {
  const form = read("components/admin/PresentationForm.tsx");

  it("is built from a question list, one question's editor and a live preview", () => {
    for (const f of ["QuestionRail.tsx", "QuestionEditor.tsx", "LivePreview.tsx", "TypePicker.tsx", "DesignSettings.tsx", "KindIcon.tsx"]) expect(has(f), f).toBe(true);
    expect(form).toContain("<QuestionRail");
    expect(form).toContain("<LivePreview");
    // one question at a time: the editor gets the selected question, not every question
    expect(form).toMatch(/<QuestionEditor[\s\S]{0,200}question=\{selectedQuestion\}/);
    expect(form).not.toMatch(/parsed\.map\(\(f, i\) =>[\s\S]{0,300}What do you want to ask/);
  });

  it("uses the whole width on a laptop: three columns from 1024px", () => {
    expect(form).toContain("(min-width: 1024px)");
    expect(form).toMatch(/grid-cols-\[[^\]]*rem_minmax\(0,1fr\)_[^\]]*rem\]/);
    // the builder isn't squeezed into the narrow column anymore
    const admin = read("components/admin/AdminApp.tsx");
    expect(admin.slice(admin.indexOf("<PresentationForm") - 300, admin.indexOf("<PresentationForm"))).not.toContain("max-w-2xl");
    expect(read("components/admin/EditApp.tsx")).not.toContain("max-w-3xl");
  });

  it("on a phone the list folds: the question being edited opens in place", () => {
    const rail = read(`${dir}/QuestionRail.tsx`);
    expect(rail).toMatch(/renderSelected/);
    expect(form).toMatch(/renderSelected=\{wide \? undefined/);
  });

  it("while choosing how to start, only the choices show (no empty form underneath)", () => {
    expect(form).toMatch(/choosing \?/);
  });
});

describe("pick the kind of question first, from big tiles", () => {
  const picker = read(`${dir}/TypePicker.tsx`);

  it("shows every kind and the Yes / No shortcut as a tile with an icon, a name and a line about it", () => {
    expect(picker).toContain("KIND_INFO.map");
    expect(picker).toContain("PRESETS.map");
    expect(picker).toContain("<KindIcon");
    expect(picker).toContain("hint");
  });

  it("opens for a new question and from the question's own type button", () => {
    const editor = read(`${dir}/QuestionEditor.tsx`);
    expect(editor).toContain("<TypePicker");
    expect(editor).toMatch(/Change type|aria-label=\{`Change the type/);
    expect(read(`${dir}/QuestionRail.tsx`)).toContain("Add question");
  });
});

describe("one question's editor: the essentials first, the rest under More options", () => {
  const editor = read(`${dir}/QuestionEditor.tsx`);
  // the "More options" button (the file's opening comment mentions it too)
  const more = editor.indexOf("aria-expanded={moreOpen}");

  it("puts the question in a big box at the top", () => {
    expect(editor).toContain("What do you want to ask?");
    expect(editor.indexOf("What do you want to ask?")).toBeLessThan(editor.indexOf("<ListEditor"));
    expect(editor).toMatch(/text-xl|text-2xl/);
  });

  it("keeps description, picture, chart and scoring details under More options", () => {
    expect(more).toBeGreaterThan(-1);
    expect(editor).toMatch(/aria-expanded=\{moreOpen\}/);
    for (const later of ["<PicturePicker", "chartsFor(", "Add a description", "<ScoringSettings"]) {
      expect(editor.indexOf(later), later).toBeGreaterThan(more);
    }
  });

  it("keeps the settings a question can't work without in view: the quiz's right answer, a number's range, the board", () => {
    for (const need of ["Right answer", "Lowest answer", "Show answers as"]) {
      expect(editor.indexOf(need), need).toBeGreaterThan(-1);
      expect(editor.indexOf(need), need).toBeLessThan(more);
    }
  });

  it("says how Score items are scored in one line, with a way to change it", () => {
    expect(editor).toMatch(/Scored 1 to \{scaleMax\}/);
  });

  it("asks about more than one measure only when the presenter wants it", () => {
    const scoring = read(`${dir}/ScoringSettings.tsx`);
    expect(scoring).toContain("How people score");
    expect(scoring).toMatch(/many \?[\s\S]{0,80}<ListEditor/);
    expect(scoring).toContain("Score on more than one thing");
  });

  it("shows the question's own problems right where it's edited", () => {
    expect(editor).toMatch(/problems\.map/);
  });
});

describe("adding an option is a real button, not grey small print", () => {
  const list = read("components/admin/ListEditor.tsx");
  const button = list.slice(list.lastIndexOf("<button", list.indexOf("+ Add {noun}")), list.indexOf("+ Add {noun}"));

  it("is full width with a border, in the ink colour, at the size of the inputs", () => {
    expect(button).toMatch(/w-full/);
    expect(button).toMatch(/border/);
    expect(button).not.toMatch(/text-ink-soft/);
    expect(button).not.toMatch(/text-sm/);
  });

  it("an item's description link stays small, so the two no longer look alike", () => {
    expect(list).toMatch(/text-xs[^"]*"[\s\S]{0,200}\+ description/);
  });
});

describe("the live preview is the real phone and the real big screen", () => {
  const live = read(`${dir}/LivePreview.tsx`);

  it("reuses the full preview's phone and screen", () => {
    expect(live).toMatch(/import \{[^}]*PhoneSlide[^}]*\} from "\.\.\/PresentationPreview"/);
    expect(live).toContain("ScreenSlide");
    expect(read("components/admin/PresentationPreview.tsx")).toMatch(/export function PhoneSlide/);
    expect(read("components/admin/PresentationPreview.tsx")).toMatch(/export function ScreenSlide/);
  });

  it("follows the question being edited", () => {
    expect(live).toMatch(/index=\{index\}/);
  });
});

describe("design and settings are one tidy panel", () => {
  const design = read(`${dir}/DesignSettings.tsx`);
  it("holds the design, illustrations, results on phones and names", () => {
    for (const s of ["<ThemePicker", "Fun illustrations", "Show results on phones", "Show who answered"]) expect(design, s).toContain(s);
  });
});

// After looking at Mentimeter's and Slido's phone builders together (2026-11-22): three big ways to start, the
// kinds of question as a two-column grid of square tiles (icon and name, nothing else), the type as "Pick one ▾" at
// the top of the question, and on a phone a bottom bar with preview, the main button and "+".
describe("like Mentimeter and Slido", () => {
  const form = read("components/admin/PresentationForm.tsx");
  const picker = read(`${dir}/TypePicker.tsx`);
  const editor = read(`${dir}/QuestionEditor.tsx`);

  it("starts with three big choices; templates and activities open as their own list with a way back", () => {
    for (const s of ["Start from scratch", "Use a template", "Team activity"]) expect(form, s).toContain(s);
    expect(form).toMatch(/startView === "templates"/);
    expect(form).toMatch(/startView === "activities"/);
    expect(form).toContain("← Back");
    // the long lists aren't on the first screen
    expect(form.indexOf("TEMPLATES.map")).toBeGreaterThan(form.indexOf('startView === "templates"'));
  });

  it("puts writing with AI first, above the three choices", () => {
    expect(form.indexOf("Write questions with AI")).toBeGreaterThan(-1);
    expect(form.indexOf("Write questions with AI")).toBeLessThan(form.indexOf("Start from scratch"));
  });

  it("shows the kinds as a two-column grid of square tiles: a coloured icon and a name", () => {
    expect(picker).toMatch(/grid-cols-2/);
    expect(picker).toMatch(/aspect-\[|min-h-\[/);
    expect(picker).toContain("topicColor");
    // the longer line is there for those who want it, not printed on every tile
    expect(picker).toMatch(/title=\{k\.hint\}/);
    expect(picker).not.toMatch(/<span className="block text-sm leading-snug text-ink-soft">\{k\.hint\}/);
    expect(picker).toContain("← Back");
  });

  it("on a phone, adding a question takes the screen (the list steps aside)", () => {
    expect(form).toMatch(/!wide && adding \? \(?\s*typePicker/);
  });

  it("the type sits at the top of the question as a drop-down (Pick one ▾), with a bin to remove", () => {
    expect(editor).toMatch(/\{kind\.label\}[\s\S]{0,120}▾/);
    expect(editor).toMatch(/aria-label=\{`Remove question/);
    expect(editor).toMatch(/<BinIcon|<svg[^>]*aria-hidden[\s\S]{0,300}M5 7h14/);
  });

  it("on a phone the bottom bar has preview, the main button and +", () => {
    expect(form).toMatch(/aria-label="Add question"/);
    expect(form).toMatch(/aria-label="Preview"/);
  });

  it("the editor and the start choices rise in", () => {
    expect(form).toMatch(/\benter\b/);
  });
});
