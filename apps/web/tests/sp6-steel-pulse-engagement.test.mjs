import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const lib = read("../lib/steel-pulse-engagement.ts");
const page = read("../app/(workspace)/pulse/page.tsx");
const action = read("../app/(workspace)/pulse/actions.ts");
const migration = read("../../../supabase/migrations/20261008200000_sp6_steel_pulse_engagement_retention.sql");
const hp13 = read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
const ci = read("../../../.github/workflows/p0-required-gate.yml");

function loadContract() {
  const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } };
  const publicExports = {};
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(read("../lib/steel-pulse-public.ts"), options).outputText,
    { exports: publicExports, require: () => ({ createClient: () => null }), Set, URL, Date },
  );
  vm.runInNewContext(
    ts.transpileModule(lib, options).outputText,
    { exports, Set, URL, Date,
      require: (name) => {
        if (name !== "@/lib/steel-pulse-public") throw new Error("unexpected dependency");
        return publicExports;
      } },
  );
  return exports;
}
const code = loadContract();

const story = {
  headline: "Aggiornamento documentato sulla filiera siderurgica italiana",
  summary: "Questa sintesi redazionale originale fornisce un contesto verificato sul settore siderurgico.",
  relevance: "Indicazioni utili per produttori, commercianti e utilizzatori che seguono il mercato.",
  topic: "market", language_code: "it", source_name: "Eurostat",
  source_url: "https://ec.europa.eu/eurostat/sample", source_published_at: null,
};

test("SP6 restricts stored engagement to four explicit actions", () => {
  for (const action of ["save", "unsave", "read", "unread"]) {
    assert.equal(code.validatePulseAction(action), true);
  }
  for (const action of ["track", "open", "impression", "notify", "", null, 42]) {
    assert.equal(code.validatePulseAction(action), false);
  }
});

test("SP6 validates canonical source URLs against unsafe links and query tracking", () => {
  assert.equal(code.validatePulseSourceUrl("https://news.example.org/steel-market"), true);
  for (const url of [
    "javascript:alert(1)", "http://example.com", "https://example.com/p?utm_medium=email",
    "https://example.com/p#fragment", "https://user:pass@example.com/a",
    "https://example.com:444/path", "https://example.com/new story", null,
  ]) {
    assert.equal(code.validatePulseSourceUrl(url), false);
  }
});

test("SP6 only displays validated currently eligible item fields", () => {
  assert.equal(code.parsePulseEngagement({
    saved_items: [story], saved_urls: [story.source_url], read_urls: [],
  })?.saved_items.length, 1);
  for (const bad of [
    { saved_items: [{ ...story, source_url: "javascript:bad" }], saved_urls: [], read_urls: [] },
    { saved_items: Array(13).fill(story), saved_urls: [], read_urls: [] },
    { saved_items: [story], saved_urls: ["http://evil.example"], read_urls: [] },
    { saved_items: [story], saved_urls: null, read_urls: [] },
    null,
  ]) {
    assert.equal(code.parsePulseEngagement(bad), null);
  }
});

test("SP6 user actions require account session and accept no identity argument", () => {
  assert.match(action, /supabase\.auth\.getUser\(\)/);
  assert.match(action, /setPulseArticleEngagement\(formData: FormData\)/);
  assert.match(action, /validatePulseSourceUrl\(sourceUrl\)/);
  assert.match(action, /validatePulseAction\(action\)/);
  assert.match(action, /sp6_set_article_engagement/);
  assert.match(action, /revalidatePath\("\/pulse"\)/);
  assert.doesNotMatch(action, /organization_id|p_user_id|service_role/i);
});

test("SP6 personal UX supports filtered saved and unread views without passive read tracking", () => {
  assert.match(page, /sp6_my_article_engagement/);
  assert.match(page, /view === "saved"/);
  assert.match(page, /view === "unread"/);
  assert.match(page, /savedUrls\.has\(card\.source_url\)/);
  assert.match(page, /readUrls\.has\(card\.source_url\)/);
  assert.match(page, /<form action=\{setPulseArticleEngagement\}>/);
  assert.match(page, /name="engagement_action"/);
  assert.match(page, /name="source_url"/);
  assert.match(page, /aria-current=\{view === key \? "page" : undefined\}/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(action, /useEffect|setInterval|navigator\.sendBeacon/);
});

test("SP6 DB is private, per-user, switch protected and rights-current on both write and read", () => {
  assert.match(migration, /create table steel_pulse_private\.user_article_engagement/);
  assert.match(migration, /primary key \(user_id, card_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on steel_pulse_private\.user_article_engagement/);
  assert.match(migration, /v_user uuid := \(select auth\.uid\(\)\)/);
  assert.match(migration, /sp3_currently_eligible_cards/);
  assert.match(migration, /publication_settings/);
  assert.match(migration, /v_users<5/);
  assert.match(migration, /private\.is_platform_superadmin\(\)/);
  assert.match(hp13, /'sp6_set_article_engagement'/);
  assert.match(hp13, /'sp6_my_article_engagement'/);
  assert.match(hp13, /'sp6_platform_retention_summary'/);
  assert.match(ci, /sp6_steel_pulse_engagement_retention\.sql/);
  assert.doesNotMatch(migration, /organization_memberships|commercial_|rfq_|cron\.schedule|create policy/i);
});
