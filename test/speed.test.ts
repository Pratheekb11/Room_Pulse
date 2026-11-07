import { beforeAll, describe, expect, it } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { failNextFetches, startTestDb } from "./neon-pglite";
import { ORIGIN, signUp } from "./auth-helpers";
import * as warmRoute from "@/app/api/warm/route";
import * as adminSessions from "@/app/api/admin/sessions/route";
import VotePage from "@/app/s/[code]/page";
import { config as proxyConfig } from "@/proxy";
import nextConfig from "@/next.config";
import type { SessionPayload } from "@/lib/types";

let cookie = "";
beforeAll(async () => {
  await startTestDb();
  cookie = (await signUp("speed@example.com")).cookie!;
});

describe("GET /api/warm — wakes the server and database before a first-time visitor needs them", () => {
  it("touches the database and answers 204, never cached", async () => {
    const res = await warmRoute.GET();
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("says 503 (not a crash) if the database is still asleep", async () => {
    failNextFetches(1);
    const res = await warmRoute.GET();
    expect(res.status).toBe(503);
  });
});

describe("home page is static (served from the CDN)", () => {
  const source = proxyConfig.matcher[0].source;
  const runsProxy = (path: string) => new RegExp(`^${source}$`).test(path);

  it("the per-request nonce proxy skips the home page but still covers every other page", () => {
    expect(runsProxy("/")).toBe(false);
    for (const p of ["/admin", "/s/abc123", "/s/abc123/dashboard", "/forgot", "/admin/edit/abc123"]) expect(runsProxy(p), p).toBe(true);
    expect(runsProxy("/api/session/x")).toBe(false);
  });

  it("the home page still gets a strict Content-Security-Policy from the config", async () => {
    const rules = await nextConfig.headers!();
    const home = rules.find((r) => r.source === "/");
    const csp = home?.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("voter page arrives with its questions (no second round trip)", () => {
  const page = async (code: string) => (await VotePage({ params: Promise.resolve({ code }) } as never)) as ReactElement<{ code: string; initial: SessionPayload | null }>;

  it("passes the presentation to the client", async () => {
    const res = await adminSessions.POST(
      new Request(`${ORIGIN}/api/admin/sessions`, {
        method: "POST",
        headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ title: "Fast", focusTopics: [{ name: "Lunch?", kind: "poll", topics: ["A", "B"] }], criteria: [] }),
      }),
    );
    const { code } = (await res.json()) as { code: string };
    const el = await page(code.toUpperCase());
    expect(isValidElement(el)).toBe(true);
    expect(el.props.code).toBe(code);
    expect(el.props.initial?.session.title).toBe("Fast");
  });

  it("passes nothing for an unknown code or a sleeping database, so the client loads as before", async () => {
    expect((await page("zzzz99")).props.initial).toBeNull();
    failNextFetches(1);
    expect((await page("zzzz99")).props.initial).toBeNull();
  });
});

describe("every page except home renders per request (it needs this request's CSP nonce)", () => {
  it.each([
    "app/admin/page.tsx",
    "app/admin/edit/[code]/page.tsx",
    "app/s/[code]/page.tsx",
    "app/s/[code]/dashboard/page.tsx",
    "app/s/[code]/results/page.tsx",
    "app/forgot/page.tsx",
    "app/reset/page.tsx",
    "app/verify/page.tsx",
    "app/not-found.tsx",
  ])("%s", async (file) => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("the root layout no longer forces every page (home included) to render per request", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")).not.toMatch(/await connection\(\)/);
  });
});
