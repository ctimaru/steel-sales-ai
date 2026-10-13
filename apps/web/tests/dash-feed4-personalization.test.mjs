import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/steel-pulse-advanced.ts");
const reader = read("../lib/dashboard-pulse.ts");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const page = read("../app/(workspace)/pulse/page.tsx");
const actions = read("../app/(workspace)/pulse/actions.ts");
const panel = read("../components/dashboard-steel-pulse.tsx");
const sql = read("../../../supabase/migrations/20261013121000_dash_feed4_personal_interests.sql");

const exports = {};
vm.runInNewContext(ts.transpileModule(model, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Set, Array, Object });
const { parsePulseAdvancedInterests, rankPersonalizedPulseCards } = exports;

test("DASH-FEED4 validates a bounded allowlist and rejects duplicates or sensitive arbitrary strings", () => {
  assert.equal(parsePulseAdvancedInterests({
    product_interests: ["round_tubes", "hollow_sections"],
    territory_interests: ["italy", "europe"],
  })?.product_interests.length, 2);
  for (const bad of [
    { product_interests: ["round_tubes", "round_tubes"], territory_interests: [] },
    { product_interests: ["my_secret_client"], territory_interests: [] },
    { product_interests: [], territory_interests: ["Milan address 123"] },
    { product_interests: null, territory_interests: [] },
    { product_interests: ["round_tubes"], territory_interests: ["usa", "usa"] },
    null,
  ]) assert.equal(parsePulseAdvancedInterests(bad), null);
});

const stories = [
  { headline: "Dati sul mercato globale delle materie prime siderurgiche",
    summary: "Aggiornamento sulla produzione di acciaio in vari mercati mondiali.", relevance: "Contesto generale per i produttori di acciaio.",
    topic: "market" },
  { headline: "Tubi tondi in Lombardia: aggiornamenti verificati",
    summary: "Dati industriali e prospettive dei tubi tondi nel Nord Italia.", relevance: "Segnali utili per commercianti di tubi tondi e profili.",
    topic: "companies" },
  { headline: "Aggiornamenti sulle normative europee per la filiera",
    summary: "Le regole sui materiali e sui processi produttivi in Europa.", relevance: "Informazioni utili per chi opera nel settore.",
    topic: "regulation" },
];

test("DASH-FEED4 ranks explicit product/territory signals without hiding any news", () => {
  const sorted = rankPersonalizedPulseCards(stories,
    { product_interests: ["round_tubes"], territory_interests: ["north_west"] }, "trader");
  assert.equal(sorted[0].headline, stories[1].headline);
  assert.equal(sorted.length, 3);
  assert.equal(sorted[1], stories[0]);
  assert.deepEqual(Array.from(rankPersonalizedPulseCards(stories,
    { product_interests: [], territory_interests: [] }, "trader")), stories);
});

test("DASH-FEED4 uses approved SP5 cards and optional per-user SP8, never enterprise memory", () => {
  assert.match(reader, /sp5_my_steel_pulse_feed/);
  assert.match(reader, /sp8_my_feed_interests/);
  assert.match(reader, /rankPersonalizedPulseCards/);
  assert.match(reader, /EMPTY_PULSE_ADVANCED_INTERESTS/);
  assert.doesNotMatch(reader + model, /commercial_dashboard_metrics|service_role|organization_memberships|rfqh10_procurement_inbox/);
});

test("DASH-FEED4 offers a single accessible save form to free users", () => {
  assert.match(page, /<form action=\{savePulseInterests\}/);
  assert.match(page, /name="product_interests"/);
  assert.match(page, /name="territory_interests"/);
  assert.match(page, /prodotti e territori/i);
  assert.match(page, /account gratuito/);
  assert.match(actions, /sp8_save_feed_preferences/);
  assert.match(actions, /parsePulseAdvancedInterests/);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/);
  assert.match(actions, /advanced\.product_interests\.length === 0/);
  assert.match(panel, /Interessi personali/);
});

test("DASH-FEED4 provides free account sector preference ONLY as a display hint", () => {
  assert.match(dashboard, /networkEntitled \? getDashboardCompanySector/);
  assert.match(dashboard, /sector === "unknown" \? selfDeclaredSector : sector/);
  assert.match(dashboard, /dashboardPresentation/);
  assert.match(dashboard, /canWriteWorkspace\(context\.role\)/);
  assert.match(dashboard, /can_access_network/);
});

test("DASH-FEED4 SQL isolates auth.uid, enforces constrained values and denies anonymous use", () => {
  assert.match(sql, /alter table steel_pulse_private\.user_feed_preferences/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /where p\.user_id=v_user/);
  assert.match(sql, /on conflict \(user_id\) do update/);
  assert.match(sql, /revoke all on function public\.sp8_save_feed_preferences/);
  assert.match(sql, /revoke all on function public\.sp8_my_feed_interests/);
  assert.match(sql, /to authenticated/);
  assert.doesNotMatch(sql, /grant execute[^;]*to anon|organization_id|user_metadata|create policy|publication_settings\s+set enabled/i);
});
