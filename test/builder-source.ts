// The builder is split into components (components/admin/builder/), so tests that check what the builder offers
// read all of it: the form and its pieces.
import { readFileSync, readdirSync } from "node:fs";

export function builderSource(): string {
  const root = new URL("../components/admin/", import.meta.url);
  const parts = ["PresentationForm.tsx", ...readdirSync(new URL("builder/", root)).map((f) => `builder/${f}`)];
  return parts.map((f) => readFileSync(new URL(f, root), "utf8")).join("\n");
}
