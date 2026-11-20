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
  const c = { v: 1, np: 3, ni: 12, sp: "standards", so: 40, mo: 7, pc: "2026-11-04T14:05:42_23818+00:00~6f1d1f0e-0b7a-4d38-9d3e-3f2a0c1b2d4e", dm: 8 };
  assert.deepEqual({ ...m.decodeHomeFeedCursor(m.encodeHomeFeedCursor(c)) }, c);
  for (const bad of [null, 42, "", "2.1.0.articles.0.0", "x".repeat(201), "1.-5.0.articles.0.0", "1.1.999.nope.0.0", "1.1.0.articles.0.0.<script>"]) {
    const d = m.decodeHomeFeedCursor(bad);
    assert.ok(d.np >= 0 && d.ni >= 0 && d.ni <= 100 && d.so >= 0 && d.mo >= -1 && d.dm >= -1, String(bad));
    assert.ok(["articles", "standards", "grades", "done"].includes(d.sp));
    assert.ok(d.pc === "" || d.pc === "x" || /~/.test(d.pc), "tampered posts segment restarts the posts");
  }
  // CPOST1: cursors issued before company posts existed still decode (posts restart from the newest).
  assert.equal(m.decodeHomeFeedCursor("1.2.6.standards.4.3").pc, "");
  assert.equal(m.decodeHomeFeedCursor("1.-5.0.articles.0.0").np, 1, "negative page falls back to page 1");
  // HOME-FEED2: cursors issued before the bills source still decode (bills start from the top).
  assert.equal(m.decodeHomeFeedCursor("1.2.6.standards.4.3.x").dm, 0);
  assert.equal(m.decodeHomeFeedCursor("1.2.6.standards.4.3.x.-1").dm, -1);
  assert.equal(m.homeFeedExhausted({ v: 1, np: 0, ni: 0, sp: "done", so: 0, mo: -1, pc: "x", dm: -1 }), true);
  assert.equal(m.homeFeedExhausted({ v: 1, np: 0, ni: 0, sp: "done", so: 0, mo: -1, pc: "", dm: -1 }), false, "posts still to read");
  assert.equal(m.homeFeedExhausted({ v: 1, np: 0, ni: 0, sp: "done", so: 0, mo: -1, pc: "x", dm: 4 }), false, "bill matches still to read");
  assert.equal(m.homeFeedExhausted(m.initialHomeFeedCursor), false);
});

test("HOME-FEED2 one companies group per page, spaced between the other sources", () => {
  const out = m.interleaveHomeFeed(post("companies", 1), [post("article", 1), post("standard", 1)], [post("opportunity", 1)]);
  assert.deepEqual(Array.from(out, (x) => x.kind), ["article", "companies", "opportunity", "standard"]);
  // Without companies, the other sources still fill the page.
  assert.deepEqual(Array.from(m.interleaveHomeFeed(null, [post("article", 1)], [post("opportunity", 1)]), (x) => x.kind), ["article", "opportunity"]);
  assert.deepEqual(Array.from(m.interleaveHomeFeed(post("companies", 1), [], []), (x) => x.kind), ["companies"]);
});

test("HOME-FEED2 bill matches: strict contract, names only with Network access, readable reason", () => {
  const id = "6f1d1f0e-0b7a-4d38-9d3e-3f2a0c1b2d4e";
  const ok = {
    contract: "HOME-FEED2-distinta-companies-v1", network_enabled: true, families: ["tubes_pipes"], total: 5,
    items: [
      { id, company_name: "Tubi Rossi S.r.l.", country_code: "IT", verified: true, role_key: "producer", families: ["tubes_pipes"] },
      { id: "nope", company_name: "X" },
      { id: "6f1d1f0e-0b7a-4d38-9d3e-3f2a0c1b2d4f", company_name: "  " },
    ],
  };
  const page = m.parseDistintaCompanies(ok);
  assert.equal(page.total, 5);
  assert.equal(page.rows.length, 1, "malformed rows dropped");
  assert.equal(page.rows[0].reason, "Tubi · Produttore");
  assert.equal(page.rows[0].countryCode, "IT");
  assert.equal(m.parseDistintaCompanies({ ...ok, contract: "other" }), null);
  assert.equal(m.parseDistintaCompanies({ ...ok, total: -1 }), null);
  assert.equal(m.parseDistintaCompanies([]), null);
  const locked = m.parseDistintaCompanies({ ...ok, network_enabled: false });
  assert.equal(locked.rows.length, 0, "without Network access no name is ever shown");
  assert.equal(locked.total, 5);
  assert.equal(m.homeFeedFamilyText(["tubes_pipes", "flat_products"]), "Tubi e prodotti piani");
  assert.equal(m.homeFeedFamilyText(["tubes_pipes", "flat_products", "long_products"]), "Tubi, prodotti piani e prodotti lunghi");
  assert.equal(m.homeFeedFamilyText(["unknown"]), "");
  assert.equal(m.nextDistintaOffset(0, 4, 10), 4);
  assert.equal(m.nextDistintaOffset(8, 2, 10), -1);
  assert.equal(m.nextDistintaOffset(0, 0, 10), -1, "an empty page ends the source");
  const sorted = m.sortCompanyRows([{ id: "a", verified: false }, { id: "b", verified: true }, { id: "c", verified: false }]);
  assert.deepEqual(Array.from(sorted, (r) => r.id), ["b", "a", "c"]);
});

test("HOME-FEED2 loader: bills first, general Network after, teaser without PRO, failures fall back", () => {
  assert.match(loader, /db\.rpc\("homefeed2_distinta_companies", \{\s*p_organization_id: viewer\.organizationId,/);
  assert.match(loader, /const page = error \? null : parseDistintaCompanies\(data\);/);
  assert.match(loader, /if \(!page \|\| page\.total === 0 \|\| page\.families\.length === 0\) return \{ item: null, dm: -1 \};/);
  assert.match(loader, /if \(!page\.networkEnabled\) \{/);
  assert.match(loader, /lockedTotal: page\.total/);
  assert.match(loader, /const matched = await loadDistintaGroup\(viewer, cursor\);[\s\S]*?const network = await loadNetworkGroup\(viewer, cursor\);/);
  assert.match(feed, /shownCompanies\.current\.has\(row\.id\)/, "a company is not repeated in a later group");
  assert.match(feed, /Per le tue distinte/);
  assert.match(feed, /Scoprile con Network PRO/);
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
  // Saved state only for roles that can act on it.
  assert.match(loader, /if \(!viewer\.canInteract \|\| ids\.length === 0\) return/);
  assert.match(loader, /getNetworkRecipientReadiness\(viewer\.organizationId, ids\)/);
  assert.match(loader, /unavailable\.push\("network"\)/);
});

test("HOME-FEED1 Salva writes the same table as the Network action, scoped to the session", () => {
  // NET-SAVE-INLINE1: the Home delegates to the one Network writer (same checks, analytics, revalidation).
  assert.match(actions, /return \{ ok: result\.ok, saved: result\.saved \}/);
  assert.match(actions, /toggleNetworkSavedCompany\(companyId, save, "home_feed"\)/);
  assert.match(feed, /<NetworkSaveToggle companyId=\{row\.id\} name=\{row\.name\} saved=\{row\.saved\} surface="home_feed" appearance="ghost" \/>/);
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

test("HOME-FEED1 Home is three columns: company, composer + feed, Network PRO (HOME-NETPRO1)", () => {
  assert.match(home, /data-testid="home-left-rail"/);
  assert.match(home, /data-testid="home-center"/);
  assert.match(home, /data-testid="home-right-rail" className="hidden min-w-0 space-y-3 xl:sticky xl:top-20 xl:block"/);
  assert.match(home, /<HomeFeed\s+initialItems=\{feedItems\}\s+initialCursor=\{feedPage\.nextCursor\}\s+canInteract=\{feedViewer\.canInteract\}/);
  // HOME-NETPRO1 (founder request, 16 Nov 2026): "Aziende da conoscere" replaced by the Network PRO card.
  assert.match(home, /<HomeNetworkProCard entitled=\{networkEntitled\} stats=\{networkProStats\} \/>/);
  assert.doesNotMatch(home, /<HomeSuggestedCompanies/);
  assert.doesNotMatch(home, /<WorkspaceHomePanels|<DashboardPulsePreview|<DashboardDiscoveryFeed|orderedQuickActions/);
  assert.match(home, /mode === "live" && recent\.length > 0|recent\.length === 0/);
});

test("HOME-FOCUS1 the Home centre starts with company posts, not an RFQ box", () => {
  // Founder decision, 4 Nov 2026: the RFQ box and the attention strip were removed from the Home.
  assert.doesNotMatch(home, /HomeAiComposer|daily-priorities|attentionItems/);
  const center = home.slice(home.indexOf('data-testid="home-center"'));
  assert.match(center.slice(0, 400), /<HomeFeed /);
  assert.match(feed, /composer === "compose" \?/);
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

test("HOME-FEED2 company rows say why they are shown: products, else published capabilities", () => {
  assert.match(loader, /getPublishedCapabilityLabels\(ids\)\.catch\(\(\) => \(\{\} as Record<string, string\[\]>\)\)/);
  assert.match(loader, /const what = products\.length \? products : capabilities;/);
  assert.match(feed, /row\.reason \?/);
  // Rows are compact (name, role, place, reason, Salva); the website stays on the profile.
  assert.doesNotMatch(feed, /item\.website/);
  assert.doesNotMatch(feed, /function initials\(/);
});
