import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/(workspace)/marketplace/page.tsx", import.meta.url), "utf8");
const createPage = fs.readFileSync(new URL("../app/(workspace)/marketplace/new/page.tsx", import.meta.url), "utf8");
const detailPage = fs.readFileSync(new URL("../app/(workspace)/marketplace/[id]/page.tsx", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../app/(workspace)/marketplace/actions.ts", import.meta.url), "utf8");
const data = fs.readFileSync(new URL("../lib/marketplace.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260929101500_p5_1_demand_listing_foundation.sql", import.meta.url),
  "utf8",
);

test("P5.1 exposes canonical Marketplace buyer routes and local navigation", () => {
  assert.match(routes, /newRequest: "\/marketplace\/new"/);
  assert.match(routes, /request: \(id: string\)/);
  assert.match(routes, /\/marketplace\/\$\{id\}/);
  assert.match(shell, /label: "Nuova ricerca"/);
  assert.match(shell, /writeRole: true/);
  assert.match(nav, /current === "marketplace"/);
  assert.match(shell, /marketplaceItems=\{marketplaceItems\}/);
});

test("P5.1 Marketplace home is a buyer demand workspace, not a fake supplier feed", () => {
  assert.match(home, /P5\.1 · Demand Listing/);
  assert.match(home, /\+ Nuova ricerca/);
  assert.match(home, /RFQ private della[\s\S]*?Commercial Memory/);
  assert.match(home, /feed supplier.*P5\.2/i);
  assert.match(home, /getMyMarketplaceRequests/);
  assert.match(home, /canWriteWorkspace/);
  assert.doesNotMatch(home, /paywall/i);
});

test("P5.1 creation is explicit and never imports Commercial Memory", () => {
  assert.match(createPage, /Crea una bozza Marketplace/);
  assert.match(createPage, /Non importa dati da RFQ, offerte, email o clienti/);
  assert.match(createPage, /Azienda visibile/);
  assert.match(createPage, /Anonima/);
  assert.match(actions, /p5_1_create_request/);
  assert.doesNotMatch(actions, /p5_1.*rfq|source_rfq|commercial_product/i);
});

test("P5.1 request builder supports structured steel-first demand", () => {
  for (const field of [
    "product_family_key", "standard_id", "material_grade_id", "manufacturing_process",
    "quantity", "quantity_unit", "certification", "delivery_country_code",
    "requested_delivery_date",
  ]) {
    assert.match(detailPage, new RegExp(`name="${field}"`));
  }
  for (const dimensionField of [
    "outer_diameter_mm", "width_mm", "height_mm", "thickness_mm", "length_mm",
  ]) {
    assert.ok(detailPage.includes(`["${dimensionField}",`), `missing dimension field ${dimensionField}`);
  }
  assert.match(detailPage, /<input name=\{name\} type="number"/);
  assert.match(detailPage, /tassonomie governate di Network e Scuola/);
  assert.match(actions, /p5_1_add_request_line/);
  assert.match(actions, /p5_1_remove_request_line/);
});

test("P5.1 publish and withdraw remain buyer-governed and server-side", () => {
  assert.match(detailPage, /Pubblica ricerca/);
  assert.match(detailPage, /Ritira/);
  assert.match(actions, /p5_1_publish_request/);
  assert.match(actions, /p5_1_withdraw_request/);
  assert.match(actions, /duration_days/);
  assert.match(actions, /Date\.now\(\) \+ durationDays/);
  assert.match(detailPage, /Feed supplier P5\.2/);
});

test("P5.1 data access uses RPC read models, not raw marketplace tables", () => {
  assert.match(data, /p5_1_my_requests/);
  assert.match(data, /p5_1_my_request/);
  assert.match(data, /p5_1_listing_taxonomy/);
  assert.doesNotMatch(data, /\.from\("marketplace_requests"\)/);
  assert.doesNotMatch(data, /\.from\("marketplace_request_lines"\)/);
});

test("P5.1 database contract separates Marketplace demand from Commercial Memory", () => {
  assert.match(migration, /create table public\.marketplace_requests/);
  assert.match(migration, /create table public\.marketplace_request_lines/);
  assert.match(migration, /create table public\.marketplace_request_events/);
  assert.match(migration, /source_kind text not null default 'manual'/);
  assert.match(migration, /visibility_mode in \('named','anonymous'\)/);
  assert.match(migration, /status in \('draft','published','withdrawn'\)/);
  assert.match(migration, /revoke all on table public\.marketplace_requests from public,anon,authenticated/);
  assert.doesNotMatch(migration, /references public\.rfqs|source_rfq_id|commercial_product_id/);
});
