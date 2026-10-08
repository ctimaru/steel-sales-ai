import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const feedPage = fs.readFileSync(new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url), "utf8");
const buyerPage = fs.readFileSync(new URL("../app/(workspace)/marketplace/requests/page.tsx", import.meta.url), "utf8");
const teaserPage = fs.readFileSync(new URL("../app/(workspace)/marketplace/opportunities/[id]/page.tsx", import.meta.url), "utf8");
const countdown = fs.readFileSync(new URL("../components/marketplace-countdown.tsx", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../lib/marketplace.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260929123500_p5_2_marketplace_feed_countdown.sql", import.meta.url),
  "utf8",
);

test("P5.2 promotes Marketplace home to supplier opportunities and preserves buyer workspace", () => {
  assert.match(routes, /myRequests: "\/marketplace\/requests"/);
  assert.match(routes, /opportunity: \(id: string\)/);
  assert.match(shell, /label: "Opportunità"/);
  assert.match(shell, /label: "Le mie pubblicazioni"/);
  assert.match(shell, /label: "Risposte Marketplace"/);
  assert.match(shell, /label: "Le mie RFQ"/);
  assert.match(feedPage, /Compra o vendi, in un unico spazio/);
  assert.match(feedPage, /getMarketplaceFeed/);
  assert.match(buyerPage, /getMyMarketplaceRequests/);
});

test("P5.2 feed exposes only privacy-safe teaser concepts", () => {
  assert.match(feedPage, /Informazioni protette/);
  assert.match(feedPage, /Quantità/);
  assert.match(feedPage, /Tempo residuo/);
  assert.match(feedPage, /Commercial Memory/);
  assert.doesNotMatch(feedPage, /standard_code|grade_designation|outer_diameter_mm|thickness_mm|certification/);
});

test("P5.2 countdown is initialized from server-derived remaining seconds", () => {
  assert.match(countdown, /initialSeconds/);
  assert.match(countdown, /setSeconds\(Math\.max\(0, Math\.floor\(initialSeconds\)\)\)/);
  assert.match(countdown, /current - 1/);
  assert.doesNotMatch(countdown, /Date\.now\(\)/);
});

test("P5.2 teaser remains the free baseline while P5.3 gates exact detail", () => {
  assert.match(teaserPage, /Informazioni essenziali/);
  assert.match(teaserPage, /teaser\.teaser_lines\.map/);
  assert.match(teaserPage, /line\.quantity_band/);
  assert.match(teaserPage, /Buyer anonimo/);
  assert.match(teaserPage, /Apri Company Profile/);
  assert.match(teaserPage, /getMarketplaceEntitlementState/);
  assert.match(teaserPage, /entitlement\.state === "entitled"/);
  assert.match(teaserPage, /diritto di risposta viene verificato separatamente/);
  assert.doesNotMatch(teaserPage, /Invia offerta|Submit quote/i);
});

test("P5.2 frontend reads governed feed and teaser RPCs only", () => {
  assert.match(data, /p5_2_marketplace_feed/);
  assert.match(data, /p5_2_marketplace_teaser/);
  assert.match(data, /p_viewer_organization_id/);
  assert.doesNotMatch(data, /\.from\("marketplace_requests"\)/);
  assert.doesNotMatch(data, /\.from\("marketplace_request_lines"\)/);
});

test("P5.2 database read model excludes exact detail and anonymous buyer identity", () => {
  assert.match(migration, /P5\.2-feed-v1/);
  assert.match(migration, /private\.p5_2_quantity_band/);
  assert.match(migration, /r\.organization_id<>p_viewer_organization_id/);
  assert.match(migration, /when r\.visibility_mode='anonymous' then/);
  assert.match(migration, /case when r\.visibility_mode='named' then l\.delivery_region else null end/);
  assert.match(migration, /seconds_remaining/);
  assert.match(migration, /r\.closes_at>now\(\)/);
  assert.doesNotMatch(migration, /'title',r\.title|'standard_code'|'grade_designation'|'outer_diameter_mm',l\./);
});

test("P5.2 hardens named publication to a published Network identity", () => {
  assert.match(migration, /named Marketplace publication requires an active published Network Company profile/);
  assert.match(migration, /organization_network_company_links/);
  assert.match(migration, /c\.publication_status='published'/);
});
