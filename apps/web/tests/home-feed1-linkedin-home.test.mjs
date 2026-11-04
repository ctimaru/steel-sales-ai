import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/home-feed-model.ts");
const loader = read("../lib/home-feed.ts");
const viewer = read("../lib/home-feed-viewer.ts");
const actions = read("../app/(italian)/(workspace)/dashboard/feed-actions.ts");
const feed = read("../components/home-feed.tsx");
const composer = read("../components/home-ai-composer.tsx");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");

const compiled = ts.transpileModule(model, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} } };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(compiled, sandbox);
const m = sandbox.exports;

const post = (kind, n) => ({ kind, key: kind + ":" + n });

test("HOME-FEED1 cursor round-trips and tampered cursors restart safely", () => {
  const c = { v: 1, np: 3, ni: 12, sp: "standards", so: 40, mo: 7 };
  assert.deepEqual({ ...m.decodeHomeFeedCursor(m.encodeHomeFeedCursor(c)) }, c);
  for (const bad of [null, 42, "", "2.1.0.articles.0.0", "x".repeat(200), "1.-5.0.articles.0.0", "1.1.999.nope.0.0"]) {
    const d = m.decodeHomeFeedCursor(bad);
    assert.ok(d.np >= 0 && d.ni >= 0 && d.ni <= 100 && d.so >= 0 && d.mo >= -1, String(bad));
    assert.ok(["articles", "standards", "grades", "done"].includes(d.sp));
  }
  assert.equal(m.decodeHomeFeedCursor("1.-5.0.articles.0.0").np, 1, "negative page falls back to page 1");
  assert.equal(m.homeFeedExhausted({ v: 1, np: 0, ni: 0, sp: "done", so: 0, mo: -1 }), true);
  assert.equal(m.homeFeedExhausted(m.initialHomeFeedCursor), false);
});

test("HOME-FEED1 interleaves sources so no source dominates a screen", () => {
  const companies = [1, 2, 3, 4, 5, 6].map((n) => post("company", n));
  const out = m.interleaveHomeFeed(companies, [post("article", 1), post("standard", 1)], [post("opportunity", 1)]);
  assert.deepEqual(Array.from(out, (x) => x.kind), [
    "company", "company", "article", "company", "opportunity", "company", "standard", "company", "company",
  ]);
  // Without companies, the other sources still fill the page.
  assert.deepEqual(Array.from(m.interleaveHomeFeed([], [post("article", 1)], [post("opportunity", 1)]), (x) => x.kind), ["article", "opportunity"]);
});

test("HOME-FEED1 network cursor walks a page, then the next, then stops", () => {
  assert.deepEqual({ ...m.advanceNetworkCursor({ np: 1, ni: 0 }, 18, 6, true) }, { np: 1, ni: 6 });
  assert.deepEqual({ ...m.advanceNetworkCursor({ np: 1, ni: 12 }, 18, 6, true) }, { np: 2, ni: 0 });
  assert.deepEqual({ ...m.advanceNetworkCursor({ np: 4, ni: 12 }, 18, 6, false) }, { np: 0, ni: 0 });
  assert.deepEqual({ ...m.advanceNetworkCursor({ np: 0, ni: 0 }, 18, 6, true) }, { np: 0, ni: 0 });
});

test("HOME-FEED1 news keeps only http(s) sources and de-duplicates", () => {
  const news = m.pulseNewsItems([
    { headline: "A", source_url: "https://ec.europa.eu/a", source_name: "DG Trade" },
    { headline: "B", source_url: "javascript:alert(1)" },
    { headline: "", source_url: "https://x" },
    { headline: "C", source_url: "https://ec.europa.eu/c" },
    { headline: "D", source_url: "https://ec.europa.eu/d" },
  ]);
  assert.deepEqual(Array.from(news, (n) => n.headline), ["A", "C", "D"]);
  const first = m.withPulseNews([post("company", 1), post("company", 1)], news);
  assert.deepEqual(Array.from(first, (x) => x.key), ["news:https://ec.europa.eu/a", "news:https://ec.europa.eu/c", "company:1", "news:https://ec.europa.eu/d"]);
});

test("HOME-FEED1 every page re-derives permissions on the server; the browser cannot widen reads", () => {
  assert.match(actions, /^"use server";/);
  assert.match(actions, /const viewer = await resolveHomeFeedViewer\(\)/);
  assert.match(actions, /decodeHomeFeedCursor\(cursor\)/);
  assert.doesNotMatch(actions, /export async function resolveHomeFeedViewer/, "viewer resolution is not a callable action");
  assert.match(viewer, /^import "server-only";/);
  assert.match(viewer, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(viewer, /networkAccess === "pro" && canWriteWorkspace\(context\.role\) && canInteractWithNetwork\(context\.role\)/);
  assert.match(loader, /^import "server-only";/);
  assert.doesNotMatch(loader + actions + feed, /service_role|supabaseAdmin|buyer_rfq_suppliers|contact_email|unit_price/);
});

test("HOME-FEED1 sources are the existing permission-checked reads, failing independently", () => {
  assert.match(loader, /getNetworkBrowsePage\(viewer\.organizationId, viewer\.networkAccess, "published"/);
  assert.match(loader, /if \(!viewer\.networkAccess \|\| cursor\.np === 0\)/);
  assert.match(loader, /getMarketplaceFeed\(viewer\.organizationId, \{ limit: HOME_FEED_PAGE\.opportunities, offset: cursor\.mo \}\)/);
  assert.match(loader, /feed\.contract !== "P5\.2-feed-v1"/);
  assert.match(loader, /listPublicStandardsPage\(offset, need\)/);
  assert.match(loader, /listPublicGradesPage\(offset, need\)/);
  assert.match(loader, /schoolArticles\.slice\(offset, offset \+ need\)/);
  // Readiness / saved state only for roles that can act on them.
  assert.match(loader, /viewer\.canInteract\s*\? getNetworkRecipientReadiness/);
  assert.match(loader, /unavailable\.push\("network"\)/);
});

test("HOME-FEED1 Salva writes the same table as the Network action, scoped to the session", () => {
  assert.match(actions, /if \(!viewer\.canInteract\) return \{ ok: false, saved: !save \}/);
  assert.match(actions, /\.from\("network_saved_companies"\)\.upsert\(\s*\{ organization_id: viewer\.organizationId, user_id: userId, network_company_id: companyId \}/);
  assert.match(actions, /\.eq\("organization_id", viewer\.organizationId\)\s*\.eq\("user_id", userId\)/);
  assert.match(actions, /UUID\.test\(companyId\)/);
});

test("HOME-FEED1 infinite scroll loads on approach, never polls, and stays accessible", () => {
  assert.match(feed, /^"use client";/);
  assert.match(feed, /new IntersectionObserver\(/);
  assert.match(feed, /rootMargin: "800px 0px"/);
  assert.doesNotMatch(feed, /setInterval|setTimeout\(\s*loadMore/);
  assert.match(feed, /role="feed" aria-busy=\{loading\}/);
  assert.match(feed, /aria-posinset=\{index \+ 1\}/);
  assert.match(feed, /data-testid="home-feed-more"/, "a button fallback exists without IntersectionObserver");
  assert.match(feed, /MAX_EMPTY_PAGES = 3/);
  assert.match(feed, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(feed, /dangerouslySetInnerHTML|createClient|fetch\(/);
});

test("HOME-FEED1 Home is three columns: company, composer + feed, companies to meet", () => {
  assert.match(home, /data-testid="home-left-rail"/);
  assert.match(home, /data-testid="home-center"/);
  assert.match(home, /data-testid="home-right-rail" className="hidden min-w-0 space-y-3 xl:sticky xl:top-20 xl:block"/);
  assert.match(home, /<HomeFeed initialItems=\{feedItems\} initialCursor=\{feedPage\.nextCursor\} canInteract=\{feedViewer\.canInteract\} \/>/);
  assert.match(home, /<HomeSuggestedCompanies companies=\{suggestions\} canInteract=\{feedViewer\.canInteract\} \/>/);
  assert.doesNotMatch(home, /<WorkspaceHomePanels|<DashboardPulsePreview|<DashboardDiscoveryFeed|orderedQuickActions/);
  assert.match(home, /mode === "live" && recent\.length > 0|recent\.length === 0/);
});

test("HOME-FEED1 composer is the same one-shot Commerciale handoff, writers only", () => {
  assert.match(composer, /const HANDOFF_KEY = "sss:commercial-ai-intake-handoff"/);
  assert.match(composer, /if \(!canWrite \|\| !ready \|\| !value\) return;/);
  assert.match(composer, /nessuna richiesta parte senza la tua conferma/);
  assert.match(composer, /if \(!canWrite\) \{/);
  assert.doesNotMatch(composer, /fetch\(|supabase|sendEmail/);
});

test("HOME-FEED1B avatar initials ignore legal forms so companies stay distinct", () => {
  assert.equal(m.companyInitials("Tecnocurve S.r.l."), "TE");
  assert.equal(m.companyInitials("Tubauto S.r.l."), "TU");
  assert.equal(m.companyInitials("Tubi S.p.A."), "TU");
  assert.equal(m.companyInitials("996 MECART S.r.l."), "9M");
  assert.equal(m.companyInitials("Acciaierie Bertoli Safau"), "AB");
  assert.equal(m.companyInitials("Société Générale SAS"), "SG");
  assert.equal(m.companyInitials("S.r.l."), "•");
});

test("HOME-FEED1B company posts add published capabilities, sector and a safe website", () => {
  assert.match(loader, /getPublishedCapabilityLabels\(ids\)\.catch\(\(\) => \(\{\} as Record<string, string\[\]>\)\)/);
  assert.match(loader, /const href = safeNetworkWebsiteUrl\(value\);/);
  assert.match(loader, /locationIndicative: company\.geography_status === "sourced_unverified"/);
  assert.match(feed, /rel="noopener noreferrer nofollow"/);
  assert.match(feed, /Lavorazioni/);
  assert.match(feed, /località indicativa/);
  assert.doesNotMatch(feed, /function initials\(/);
});
