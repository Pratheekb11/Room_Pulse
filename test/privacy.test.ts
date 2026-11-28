// The privacy page (2026-11-23). The home page footer used to say "We don't store names or IP addresses", which
// stopped being true when names on answers (team activities, "Show who answered") and the abuse limits' hashed
// addresses shipped. The footer now says when answers are anonymous and links to /privacy, a plain-words page
// whose facts come from the code's own numbers where there is one (guest days), so they can't drift apart.
import { readFileSync, existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FOOTER_PRIVACY, PRIVACY_CONTACT, PRIVACY_SECTIONS, PRIVACY_UPDATED, SERVICES } from "@/lib/privacy";
import { GUEST_DAYS } from "@/lib/guest-rules";
import PrivacyPage, * as privacyRoute from "@/app/privacy/page";

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const page = read("app/privacy/page.tsx");
const text = PRIVACY_SECTIONS.map((s) => [s.heading, ...s.body].join("\n")).join("\n\n");

describe("home page footer", () => {
  const home = read("app/page.tsx");
  const footer = home.slice(home.indexOf("<footer"), home.indexOf("</footer>"));

  it("no longer promises what isn't true", () => {
    expect(home).not.toMatch(/don&rsquo;t store names/);
    expect(home).not.toMatch(/don't store names/);
    expect(home).not.toMatch(/store names or IP addresses/);
  });

  it("says answers are anonymous unless the presenter asks for names, and links to the privacy page", () => {
    expect(FOOTER_PRIVACY).toMatch(/anonymous unless the presenter asks for names/i);
    expect(footer).toContain("FOOTER_PRIVACY");
    expect(footer).toMatch(/href="\/privacy"/);
  });
});

describe("the privacy page", () => {
  it("is one of the site's Quiet pages, rendered per request for the CSP nonce", () => {
    expect(page).toMatch(/className="quiet contents"/);
    expect(page).toMatch(/themeColor: "#131314"/);
    expect(privacyRoute.dynamic).toBe("force-dynamic");
    expect(privacyRoute.metadata?.title).toMatch(/Privacy/);
  });

  it("is reached through the per-request proxy like every other page", () => {
    expect(existsSync(new URL("../app/privacy/page.tsx", import.meta.url))).toBe(true);
  });

  it("renders every section, the date and the contact link", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    for (const s of PRIVACY_SECTIONS) expect(html).toContain(s.heading);
    expect(html).toContain(PRIVACY_UPDATED);
    expect(html).toContain(`href="mailto:${PRIVACY_CONTACT}"`);
    expect(html).toMatch(/<h1/);
  });

  it("uses the project contact address, not the owner's personal one", () => {
    expect(PRIVACY_CONTACT).toBe("bpratheek122@gmail.com");
  });

  it("has a real contact address, not a placeholder", () => {
    expect(PRIVACY_CONTACT).toMatch(/^[^\s@[\]]+@[^\s@[\]]+\.[a-z]{2,}$/);
    expect(text).not.toMatch(/\[[^\]]+\]/);
  });

  it("says names are collected when the presenter asks, and on boards and quiz nicknames", () => {
    expect(text).toMatch(/anonymous unless the presenter asks for names/i);
    expect(text).toMatch(/tree/i);
    expect(text).toMatch(/nickname/i);
  });

  it("states the guest retention from the code's own number", () => {
    expect(text).toContain(`${GUEST_DAYS} days`);
  });

  it("says the scrambled IP counts last a day, matching the daily purge", () => {
    expect(read("lib/queries.ts")).toMatch(/delete from rate_hits where window_start < now\(\) - interval '1 day'/);
    expect(text).toMatch(/IP address/);
    expect(text).toMatch(/deleted after one day/);
  });

  it("says AI sends answers to Google only when turned on, never hidden ones, with the free-tier caveat", () => {
    expect(text).toMatch(/Gemini/);
    expect(text).toMatch(/Hidden answers are never sent/);
    expect(text).toMatch(/improve its products/);
  });

  it("lists the services in use, and not Resend until email is set up", () => {
    const names = SERVICES.map((s) => s.name);
    expect(names).toEqual(["Vercel", "Neon", "Google Gemini"]);
    // Vercel Analytics is mounted (test/analytics.test.ts), so the page has to say so
    expect(SERVICES[0].what).toMatch(/Analytics/);
    expect(text).not.toMatch(/Resend/);
  });

  it("promises no ads or selling, and says when we look at the data", () => {
    expect(text).toMatch(/don't sell/i);
    expect(text).toMatch(/only look at presentations or answers/i);
  });
});
