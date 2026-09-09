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
  const result = options.result ?? { data: { id: 2, status: "confirmed" }, error: null };
  const query = {
    update(values) { calls.writes++; calls.values = values; return this; },
    eq(key, value) { calls.filters.push([key, value]); return this; },
    select(fields) { calls.fields = fields; return this; },
    async maybeSingle() {
      if (options.throwWrite) throw new Error("private transport error");
      return result;
    },
  };
  const client = {
    auth: { async getUser() {
      calls.auth++;
      return options.auth ?? { data: { user: { id: "owner-a" } }, error: null };
    } },
    from(table) { assert.equal(table, "commercial_review_queue"); return query; },
  };
  const cache = new SyntheticModule(["revalidatePath"], function () {
    this.setExport("revalidatePath", (path) => {
      if (options.throwCache) throw new Error("cache unavailable");
      calls.revalidated.push(path);
    });
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
    async run(id = "2") {
      const data = new FormData();
      if (id !== null) data.set("id", id);
      return mod.namespace.confirmReviewItem({ status: "idle", message: "" }, data);
    },
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";

test("rejects malformed IDs before auth or mutation", async () => {
  for (const id of [null, "", "0", "-1", "1.5", "2e0", " 2 ", "Infinity", "9007199254740992", new Blob(["2"])]) {
    const { calls, run } = await setup();
    assert.equal((await run(id)).status, "error");
    assert.equal(calls.auth, 0);
    assert.equal(calls.writes, 0);
  }
});

test("reports missing configuration", async () => {
  const old = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    const { calls, run } = await setup();
    assert.equal((await run()).status, "error");
    assert.equal(calls.auth, 0);
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = old;
  }
});

test("rejects missing users and auth errors without writes", async () => {
  for (const auth of [
    { data: { user: null }, error: null },
    { data: { user: { id: "owner-a" } }, error: { message: "expired" } },
  ]) {
    const { calls, run } = await setup({ auth });
    assert.equal((await run()).status, "error");
    assert.equal(calls.writes, 0);
  }
});

test("saves only the authenticated owner's pending record and refreshes both views", async () => {
  const { calls, run } = await setup();
  assert.equal((await run()).status, "success");
  assert.deepEqual(calls.filters, [["id", 2], ["owner_id", "owner-a"], ["status", "pending"]]);
  assert.equal(calls.fields, "id,status");
  assert.equal(calls.values.status, "confirmed");
  assert.ok(Number.isFinite(Date.parse(calls.values.reviewed_at)));
  assert.deepEqual(calls.revalidated, ["/review", "/dashboard"]);
});

test("database errors never produce success or expose backend error text", async () => {
  const { calls, run } = await setup({ result: { data: null, error: { message: "secret database detail" } } });
  const state = await run();
  assert.equal(state.status, "error");
  assert.ok(!state.message.includes("secret"));
  assert.deepEqual(calls.revalidated, []);
});

test("zero rows (RLS, missing or already reviewed) never report success", async () => {
  const { calls, run } = await setup({ result: { data: null, error: null } });
  assert.equal((await run()).status, "error");
  assert.deepEqual(calls.revalidated, []);
});

test("unexpected returned row or status never reports success", async () => {
  for (const data of [{ id: 3, status: "confirmed" }, { id: 2, status: "corrected" }]) {
    const { run } = await setup({ result: { data, error: null } });
    assert.equal((await run()).status, "error");
  }
});

test("transport exceptions produce an uncertain outcome and no refresh", async () => {
  const { calls, run } = await setup({ throwWrite: true });
  const state = await run();
  assert.equal(state.status, "error");
  assert.match(state.message, /verificare il salvataggio/);
  assert.deepEqual(calls.revalidated, []);
});

test("a repeat submission cannot overwrite a completed review", async () => {
  const result = { data: { id: 2, status: "confirmed" }, error: null };
  const { calls, run } = await setup({ result });
  assert.equal((await run()).status, "success");
  result.data = null;
  assert.equal((await run()).status, "error");
  assert.deepEqual(calls.revalidated, ["/review", "/dashboard"]);
});

test("cache failure does not misreport an acknowledged write as failed", async () => {
  const { run } = await setup({ throwCache: true });
  const state = await run();
  assert.equal(state.status, "success");
  assert.match(state.message, /Aggiorna la pagina/);
});
