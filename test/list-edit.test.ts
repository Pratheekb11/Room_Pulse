import { describe, expect, it } from "vitest";
import { duplicateIndexes, filledItems, insertAfter, moveItem, pasteInto, removeAt, setAt, toItems } from "@/lib/list-edit";

describe("list editor helpers", () => {
  it("setAt replaces one item without touching the others", () => {
    const list = ["a", "b", "c"];
    expect(setAt(list, 1, "B")).toEqual(["a", "B", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("insertAfter adds an empty row after the given one, up to the limit", () => {
    expect(insertAfter(["a", "b"], 0, 10)).toEqual(["a", "", "b"]);
    expect(insertAfter(["a", "b"], 1, 10)).toEqual(["a", "b", ""]);
    expect(insertAfter(["a", "b"], 1, 2)).toEqual(["a", "b"]);
  });

  it("removeAt removes a row but never leaves the list empty", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeAt(["a"], 0)).toEqual([""]);
  });

  it("moveItem moves a row up or down and ignores moves past either end", () => {
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("pasteInto spreads a multi-line paste across rows from the cursor row", () => {
    // pasting into an empty first row of a fresh list
    expect(pasteInto([""], 0, "Lisbon\nKyoto\r\n\n  Cape Town  ", 10)).toEqual({
      items: ["Lisbon", "Kyoto", "Cape Town"],
      focus: 2,
      dropped: 0,
    });
    // pasting into a filled row replaces it, keeps the rows after it
    expect(pasteInto(["a", "b", "z"], 1, "x\ny", 10)).toEqual({ items: ["a", "x", "y", "z"], focus: 2, dropped: 0 });
  });

  it("pasteInto keeps to the limit and reports how many lines didn't fit", () => {
    expect(pasteInto(["a", ""], 1, "1\n2\n3\n4", 3)).toEqual({ items: ["a", "1", "2"], focus: 2, dropped: 2 });
  });

  it("pasteInto returns null for a single-line paste so the input handles it normally", () => {
    expect(pasteInto(["a"], 0, "just one", 10)).toBeNull();
    expect(pasteInto(["a"], 0, "one\n", 10)).toBeNull();
  });

  it("filledItems trims, collapses spaces and drops empty rows", () => {
    expect(filledItems(["  Lisbon ", "", "   ", "Cape   Town"])).toEqual(["Lisbon", "Cape Town"]);
  });

  it("duplicateIndexes marks every repeat after the first, ignoring case and spacing", () => {
    expect([...duplicateIndexes(["Lisbon", "kyoto", " lisbon ", "", "", "KYOTO"])]).toEqual([2, 5]);
  });

  it("toItems turns old one-per-line drafts into rows and always gives at least one row", () => {
    expect(toItems("a\n\nb")).toEqual(["a", "b"]);
    expect(toItems("")).toEqual([""]);
    expect(toItems(undefined)).toEqual([""]);
    expect(toItems(["x", "y"])).toEqual(["x", "y"]);
    expect(toItems([])).toEqual([""]);
  });
});
