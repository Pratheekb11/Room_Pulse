import { describe, expect, it } from "vitest";
import { startTestDb } from "./neon-pglite";

describe("test harness", () => {
  it("runs neon() queries against PGlite with neon type parsing", async () => {
    await startTestDb();
    const { sql } = await import("@/lib/db");
    const rows = await sql`select 1::int as n, ${"x"}::text as t, true as b, '{"a":1}'::json as j`;
    expect(rows).toEqual([{ n: 1, t: "x", b: true, j: { a: 1 } }]);
  });
});
