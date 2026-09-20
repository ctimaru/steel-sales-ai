import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";

const source = stripTypeScriptTypes(
  await readFile(new URL("../app/(workspace)/review/actions.ts", import.meta.url), "utf8"),
);

async function setup(options = {}) {
  const calls = { auth: 0, rpc: 0, args: null, revalidated: [] };
  const client = {
    auth: {
      async getUser() {
        calls.auth++;
        return options.auth ?? { data: { user: { id: "owner-a" } }, error: null };
      },
    },
    async rpc(name, args) {
      calls.rpc++;
      calls.name = name;
      calls.args = args;
      if (options.throwRpc) throw new Error("transport");
      return options.rpcResult ?? {
        data: {
          status: "corrected",
          review_id: 2,
          observation_id: 5,
          canonical_product_id: "product-id",
        },
        error: null,
      };
    },
    from() {
      throw new Error("correctReviewItem must use the controlled RPC, not direct table updates");
    },
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
    async run(overrides = {}) {
      const data = new FormData();
      data.set("id", overrides.id ?? "2");
      data.set(
        "original_values",
        overrides.original_values ??
          JSON.stringify({
            grade: "P265GH",
            standard: "EN 10216-2",
            length_mm: 12000,
            price_value: 999,
            currency: "EUR",
          }),
      );
      data.set("grade", overrides.grade ?? "P355NH");
      data.set("standard", overrides.standard ?? "EN 10216-2");
      data.set("length_mm", overrides.length_mm ?? "6000");
      data.set("price_value", overrides.price_value ?? "1050");
      data.set("currency", overrides.currency ?? "EUR");
      data.set("note", overrides.note ?? "checked");
      return mod.namespace.correctReviewItem({ status: "idle", message: "" }, data);
    },
  };
}

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable";

test("correction action sends only changed fields to the controlled RPC", async () => {
  const { calls, run } = await setup();
  const state = await run();

  assert.equal(state.status, "success");
  assert.equal(calls.rpc, 1);
  assert.equal(calls.name, "p1_apply_commercial_review_correction");
  assert.deepEqual(calls.args, {
    p_review_id: 2,
    p_corrected_values: {
      grade: "P355NH",
      length_mm: 6000,
      price_value: 1050,
    },
    p_note: "checked",
  });
  assert.deepEqual(calls.revalidated, [
    "/review",
    "/dashboard",
    "/explorer",
    "/search",
    "/products",
  ]);
});

test("unchanged form does not call correction RPC", async () => {
  const { calls, run } = await setup();
  const state = await run({
    grade: "P265GH",
    length_mm: "12000",
    price_value: "999",
  });
  assert.equal(state.status, "error");
  assert.match(state.message, /almeno un valore corretto/i);
  assert.equal(calls.rpc, 0);
});

test("invalid numeric corrections are rejected before RPC", async () => {
  const { calls, run } = await setup();
  const state = await run({ price_value: "not-a-number" });
  assert.equal(state.status, "error");
  assert.match(state.message, /numerico non valido/i);
  assert.equal(calls.rpc, 0);
});

test("invalid initial snapshot is rejected before auth", async () => {
  const { calls, run } = await setup();
  const state = await run({ original_values: "{bad" });
  assert.equal(state.status, "error");
  assert.match(state.message, /Snapshot iniziale non valido/i);
  assert.equal(calls.auth, 0);
  assert.equal(calls.rpc, 0);
});

test("RPC errors are generic and never expose backend details", async () => {
  const { calls, run } = await setup({
    rpcResult: { data: null, error: { message: "secret postgres detail" } },
  });
  const state = await run();
  assert.equal(state.status, "error");
  assert.ok(!state.message.includes("secret"));
  assert.equal(calls.rpc, 1);
  assert.deepEqual(calls.revalidated, []);
});

test("idempotent database acknowledgement is a success", async () => {
  const { run } = await setup({
    rpcResult: {
      data: { status: "already_corrected", review_id: 2, observation_id: 5 },
      error: null,
    },
  });
  const state = await run();
  assert.equal(state.status, "success");
  assert.match(state.message, /già applicata/i);
});
