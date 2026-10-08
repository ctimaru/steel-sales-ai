import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const contract = read("../lib/steel-pulse-personalized.ts");
const page = read("../app/(workspace)/pulse/page.tsx");
const action = read("../app/(workspace)/pulse/actions.ts");
const dash = read("../app/(workspace)/dashboard/page.tsx");
const route = read("../lib/routes.ts");
const migration = read("../../../supabase/migrations/20261008195000_sp5_steel_pulse_personalized_feed.sql");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

function loadContract() {
  const exports = {};
  const publicExports = {};
  const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } };
  vm.runInNewContext(
    ts.transpileModule(read("../lib/steel-pulse-public.ts"), options).outputText,
    { exports: publicExports, require: () => ({ createClient: () => null }), Set, URL, Date },
  );
  const compiled = ts.transpileModule(contract, options).outputText;
  vm.runInNewContext(compiled, {
    exports, Set,
    require: (id) => {
      if (id !== "@/lib/steel-pulse-public") throw new Error("Unexpected module: " + id);
      return publicExports;
    },
  });
  return exports;
}
const model = loadContract();

test("SP5 exposes exactly the allowed steel topics and professional interests", () => {
  assert.deepEqual(Array.from(model.pulseTopics, (x) => x.key), [
    "market", "trade", "regulation", "raw_materials", "technology", "companies",
  ]);
  assert.deepEqual(Array.from(model.pulseProfessionalInterests, (x) => x.key), [
    "all", "producer", "trader", "processor", "end_user",
  ]);
});

test("SP5 preferences reject tenant-inferred values, duplicates and unsupported language", () => {
  const good = { topics: ["market", "trade"], role_interest: "trader", language_code: "it" };
  assert.equal(model.validatePulsePreferences(good)?.role_interest, "trader");
  for (const bad of [
    { ...good, topics: ["market", "market"] },
    { ...good, topics: ["private_rfq"] },
    { ...good, topics: [42] },
    { ...good, topics: ["market", "trade", "regulation", "raw_materials", "technology", "companies", "secret"] },
    { ...good, language_code: "de" },
    { ...good, role_interest: "tenant_admin" },
    { ...good, user_id: "other", topics: null },
    null,
  ]) {
    assert.equal(model.validatePulsePreferences(bad), null);
  }
  assert.equal(model.validatePulsePreferences({ topics: [], role_interest: "all", language_code: "en" })?.topics.length, 0);
});

test("SP5 personalized payload includes only validated approved display fields", () => {
  const pref = { topics: ["market"], role_interest: "producer", language_code: "it" };
  const item = {
    headline: "Riepilogo verificato del settore siderurgico europeo",
    summary: "Questo testo originale descrive un aggiornamento verificato con un contesto professionale.",
    relevance: "Un elemento utile per chi segue quotidianamente gli andamenti del settore.",
    topic: "market", language_code: "it", source_name: "Eurostat",
    source_url: "https://ec.europa.eu/eurostat/sample", source_published_at: null,
  };
  const parsed = model.parsePulsePersonalizedFeed({ preferences: pref, items: [item] });
  assert.equal(parsed?.items.length, 1);
  assert.equal(model.parsePulsePersonalizedFeed({ preferences: pref, items: [{ ...item, source_url: "javascript:alert(1)" }] }), null);
  assert.equal(model.parsePulsePersonalizedFeed({ preferences: pref, items: Array(13).fill(item) }), null);
});

test("SP5 is authenticated and does not accept a user ID from input", () => {
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(action, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /sp5_my_steel_pulse_feed/);
  assert.match(action, /sp5_save_feed_preferences/);
  assert.match(action, /formData\.getAll\("topics"\)/);
  assert.match(action, /revalidatePath\("\/pulse"\)/);
  assert.doesNotMatch(action, /organization_id|user_id|service_role/i);
  assert.match(migration, /where p\.user_id=v_user/);
  assert.match(migration, /on conflict\(user_id\) do update/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("SP5 page is mobile-first, editable and reachable without bloating main navigation", () => {
  assert.match(route, /steelPulse: "\/pulse"/);
  assert.match(dash, /href=\{appRoutes\.steelPulse\}/);
  assert.match(dash, /Personalizza il feed/);
  assert.match(page, /<form action=\{savePulseInterests\}/);
  assert.match(page, /defaultChecked=\{preferences\.topics\.includes\(key\)\}/);
  assert.match(page, /name="role_interest"/);
  assert.match(page, /name="language_code"/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(page, /Nessuna notizia verificata per ora/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
});

test("SP5 SQL is private, rights-current and subject to the SP4 publication switch", () => {
  assert.match(migration, /steel_pulse_private\.user_feed_preferences/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on steel_pulse_private\.user_feed_preferences from public, anon, authenticated/);
  assert.match(migration, /steel_pulse_private\.sp3_currently_eligible_cards/);
  assert.match(migration, /steel_pulse_private\.publication_settings/);
  assert.match(migration, /'items',v_items/);
  assert.match(migration, /f\.language_code=v_lang/);
  assert.match(migration, /cardinality\(v_topics\)=0 or f\.topic=any\(v_topics\)/);
  assert.match(hp13, /'sp5_save_feed_preferences'/);
  assert.match(hp13, /'sp5_my_steel_pulse_feed'/);
  assert.doesNotMatch(migration, /create policy|organization_memberships|commercial_|rfq_|cron\.schedule/i);
});
