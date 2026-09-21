import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

const source = stripTypeScriptTypes(
  await readFile(new URL("../app/(workspace)/review/actions.ts", import.meta.url), "utf8"),
);

async function setup(options = {}) {
  const calls = { auth: 0, writes: 0, filters: [], revalidated: [] };
  const result = options.result ?? {
    data: {
      id: 7,
      status: "corrected",
      corrected_values: { grade: "P235GH", quantity: "12.5" },
    },
    error: null,
  };
  const query = {
    update(values) { calls.writes++; calls.values = values; return this; },
    eq(key, value) { calls.filters.push([key, value]); return this; },
    select(fields) { calls.fields = fields; return this; },
    async maybeSingle() { return result; },
  };
  const client = {
    auth: { async getUser() {
      calls.auth++;
      return { data: { user: { id: "teammate-b" } }, error: null };
    } },
    from(table) { assert.equal(table, "commercial_review_queue"); return query; },
  };
  const cache = new SyntheticModule(["revalidatePath"], function () {
    this.setExport("revalidatePath", (path) => calls.revalidated.push(path));
  });
  const db = new SyntheticModule(["createClient"], function () {
    this.setExport("createClient", async () => client);
  });
  const mod = new SourceTextModule(source);
  await mod.link((specifier) => {
    if (specifier === "next/cache") return cache;
    if (specifier === "@/lib/supabase/server") return db;
    throw new Error("Unexpected import: " + specifier);
  });
  await mod.evaluate();

  return {
    calls,
    async run(entries = {}) {
      const data = new FormData();
      data.set("id", "7");
      for (const [key, value] of Object.entries(entries)) data.set(key, value);
      return mod.namespace.correctReviewItem({ status: "idle", message: "" }, data);
    },
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";

test("correction writes only review resolution fields and relies on tenant RLS, not owner filter", async () => {
  const { calls, run } = await setup();
  const state = await run({
    grade: " P235GH ",
    outer_diameter_mm: "168.3",
    thickness_mm: "7.11",
    quantity: "12.5",
    price_value: "825",
    price_unit: "T",
    currency: " eur ",
    note: "Checked against source PDF",
  });

  assert.equal(state.status, "success");
  assert.match(state.message, /memoria commerciale/);
  assert.deepEqual(calls.filters, [["id", 7], ["status", "pending"]]);
  assert.equal(calls.values.status, "corrected");
  assert.deepEqual(calls.values.corrected_values, {
    grade: "P235GH",
    outer_diameter_mm: "168.3",
    thickness_mm: "7.11",
    quantity: "12.5",
    price_value: "825",
    price_unit: "T",
    currency: "eur",
    note: "Checked against source PDF",
  });
  assert.ok(Number.isFinite(Date.parse(calls.values.reviewed_at)));
  assert.deepEqual(calls.revalidated, ["/review", "/dashboard", "/products"]);
});

test("empty correction is rejected before authentication and write", async () => {
  const { calls, run } = await setup();
  const state = await run({});
  assert.equal(state.status, "error");
  assert.equal(calls.auth, 0);
  assert.equal(calls.writes, 0);
});

test("zero-row correction does not report success", async () => {
  const { calls, run } = await setup({ result: { data: null, error: null } });
  const state = await run({ grade: "P235GH" });
  assert.equal(state.status, "error");
  assert.deepEqual(calls.revalidated, []);
});
