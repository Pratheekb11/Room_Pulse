import { describe, expect, it } from "vitest";
import { duplicateIndexes, filledItems, filledRows, insertAfter, moveItem, pasteInto, removeAt, rowsFrom, setAt, toItems, type Row } from "@/lib/list-edit";

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

  describe("rows that remember which saved item they are (editing keeps answers)", () => {
    const rows: Row[] = [
      { id: "a", name: "Lisbon" },
      { id: "b", name: "Kyoto" },
    ];

    it("renaming or moving a row keeps its id", () => {
      expect(setAt(rows, 0, "Porto")).toEqual([{ id: "a", name: "Porto" }, { id: "b", name: "Kyoto" }]);
      expect(moveItem(rows, 0, 1).map((r) => r.id)).toEqual(["b", "a"]);
    });

    it("new rows have no id", () => {
      expect(insertAfter(rows, 0, 10)[1]).toEqual({ name: "" });
      expect(removeAt([rows[0]], 0)).toEqual([{ name: "" }]);
    });

    it("pasting over a saved row keeps its id on the first line; the other lines are new", () => {
      expect(pasteInto(rows, 1, "Osaka\nNara", 10)?.items).toEqual([
        { id: "a", name: "Lisbon" },
        { id: "b", name: "Osaka" },
        { name: "Nara" },
      ]);
    });

    it("filledRows keeps ids, cleans names and drops empty rows", () => {
      expect(filledRows([{ id: "a", name: "  Lis   bon " }, { name: " " }, { name: "New" }])).toEqual([
        { id: "a", name: "Lis bon" },
        { name: "New" },
      ]);
    });

    it("rowsFrom builds rows from saved items and always gives at least one row", () => {
      expect(rowsFrom([{ id: "x", name: "X" }])).toEqual([{ id: "x", name: "X" }]);
      expect(rowsFrom([])).toEqual([{ name: "" }]);
    });

    it("duplicateIndexes works on rows too", () => {
      expect([...duplicateIndexes([{ name: "a" }, { id: "z", name: " A " }])]).toEqual([1]);
    });
  });
});

describe("item descriptions in the list editor", () => {
  it("rows from saved items keep their description", async () => {
    const { rowsFrom } = await import("@/lib/list-edit");
    expect(rowsFrom([{ id: "a", name: "A", description: "First" }, { id: "b", name: "B", description: null }])).toEqual([
      { id: "a", name: "A", description: "First" },
      { id: "b", name: "B" },
    ]);
  });

  it("collects filled descriptions by item name, skipping blank items and blank descriptions", async () => {
    const { descriptionsOf } = await import("@/lib/list-edit");
    expect(descriptionsOf([{ name: " Dark  mode ", description: " Night theme " }, { name: "B", description: "  " }, { name: "", description: "lost" }, { name: "C" }])).toEqual({
      "Dark mode": "Night theme",
    });
  });

  it("typing a new name keeps the row's description", async () => {
    const { setAt } = await import("@/lib/list-edit");
    expect(setAt([{ name: "A", description: "d" }], 0, "AB")).toEqual([{ name: "AB", description: "d" }]);
  });
});

describe("switching a question's type", () => {
  it("drops a shortcut's ready-made options (Yes / No / Not sure) when switching to Score items: back to empty Item 1, Item 2", async () => {
    const { rowsForKind } = await import("@/lib/list-edit");
    expect(rowsForKind([{ name: "Yes" }, { name: "No" }, { name: "Not sure" }], "rating", 2)).toEqual([{ name: "" }, { name: "" }]);
  });
  it("keeps options the presenter typed", async () => {
    const { rowsForKind } = await import("@/lib/list-edit");
    expect(rowsForKind([{ name: "Pizza" }, { name: "Sushi" }], "rating", 2)).toEqual([{ name: "Pizza" }, { name: "Sushi" }]);
  });
  it("tops up to the rows a type needs", async () => {
    const { rowsForKind } = await import("@/lib/list-edit");
    expect(rowsForKind([{ name: "" }], "poll", 2)).toEqual([{ name: "" }, { name: "" }]);
  });
});
