// LiveRate's own words and pictures (2026-11-22). Layout patterns every audience-response and slide tool shares
// (a question list beside an editor, a grid of question types, templates, a preview) are fine to use; other
// products' wording, names, icons and artwork are not. This keeps their phrases and names out of what we ship.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    return statSync(join(root, p)).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
  });
}
const shipped = ["app", "components", "lib"].flatMap(files);

/** Other products' names and their own button or heading wording. */
const NOT_OURS = [
  /mentimeter/i,
  /\bmenti\b/i,
  /slido/i,
  /ahaslides/i,
  /kahoot/i,
  /Start from scratch/i,
  /Use a template/i,
  /Import slides/i,
  /Add new interaction/i,
  /Interactive questions/i,
  /Quiz competitions/i,
  /Generate with \w+ AI/i,
];

describe("our own words", () => {
  it("nothing we ship names another product or uses its wording", () => {
    for (const f of shipped) {
      const src = readFileSync(join(root, f), "utf8");
      for (const re of NOT_OURS) expect(src, `${f} has ${re}`).not.toMatch(re);
    }
  });
});
