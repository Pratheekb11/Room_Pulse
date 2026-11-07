import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

describe("Vercel Analytics", () => {
  it("is mounted in the root layout", () => {
    const layout = readFileSync(join(__dirname, "../app/layout.tsx"), "utf8");
    expect(layout).toMatch(/import \{ Analytics \} from "@vercel\/analytics\/next"/);
    expect(layout).toMatch(/<Analytics\s*\/>/);
  });

  it("CSP lets the analytics script load and report to /_vercel/insights", () => {
    const csp = proxy(new NextRequest("https://liverate.test/")).headers.get("Content-Security-Policy")!;
    // The script is injected by a nonce'd Next.js script, so 'strict-dynamic' must allow it.
    expect(csp).toMatch(/script-src [^;]*'strict-dynamic'/);
    // It reports page views to the same origin.
    expect(csp).toMatch(/connect-src 'self'/);
  });
});
