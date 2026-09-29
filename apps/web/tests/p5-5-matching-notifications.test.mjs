import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260929161000_p5_5_matching_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);
const notificationsPage = fs.readFileSync(
  new URL(
    "../app/(workspace)/marketplace/notifications/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const requestPage = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/[id]/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/actions.ts", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(new URL("../lib/marketplace.ts", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("P5.5 adds materialized matches, in-app notifications and append-only lifecycle audit", () => {
  assert.match(migration, /create table public\.marketplace_matches/);
  assert.match(migration, /create table public\.marketplace_notifications/);
  assert.match(migration, /create table public\.marketplace_notification_events/);
  assert.match(migration, /event_sequence bigint generated always as identity/);
  assert.match(migration, /marketplace_notification_events is append-only/);
  assert.match(
    migration,
    /unique\(recipient_organization_id,request_id,notification_kind\)/,
  );
});

test("P5.5 matching is deterministic and grounded in governed P3.7E technical scope", () => {
  assert.match(migration, /P5\.5-v1/);
  assert.match(migration, /network_company_products/);
  assert.match(migration, /network_company_product_standard_scopes/);
  assert.match(migration, /network_company_product_grade_scopes/);
  assert.match(migration, /network_company_product_dimension_scopes/);
  assert.match(migration, /product_family_exact/);
  assert.match(migration, /standard_mismatch/);
  assert.match(migration, /grade_mismatch/);
  assert.match(migration, /dimension_mismatch/);
  assert.match(migration, /company_verified/);
});

test("P5.5 preserves unknown scope instead of inventing technical capability", () => {
  assert.match(migration, /standard_unknown/);
  assert.match(migration, /grade_unknown/);
  assert.match(migration, /dimension_[^']*'_unknown|dimension_.*_unknown/);
  assert.match(migration, /v_quality := v_quality\+0\.35/);
  assert.match(notificationsPage, /Dati non dichiarati restano “unknown”/);
});

test("P5.5 never grants entitlement, unlock or response authority", () => {
  assert.doesNotMatch(migration, /p5_3_grant_entitlement/);
  assert.doesNotMatch(migration, /insert into public\.marketplace_unlocks/i);
  assert.doesNotMatch(migration, /insert into public\.marketplace_responses/i);
  assert.match(
    notificationsPage,
    /non concede[\s\S]*entitlement, unlock o diritto di risposta/,
  );
});

test("P5.5 supplier inbox reuses the privacy-safe P5.2 teaser contract", () => {
  assert.match(migration, /private\.p5_2_teaser_item_impl\(p\.request_id\)/);
  assert.match(migration, /private\.p5_5_sanitized_line_matches/);
  assert.doesNotMatch(
    notificationsPage,
    /standard_code|grade_designation|outer_diameter_mm|thickness_mm/,
  );
  assert.match(notificationsPage, /Buyer anonimo/);
});

test("P5.5 supports late Company Profile claim handoff without recomputing buyer demand", () => {
  assert.match(migration, /private\.p5_5_sync_company_linkage/);
  assert.match(migration, /organization_network_company_links_p5_5_sync/);
  assert.match(migration, /company_link_activation/);
  assert.match(migration, /supplier_organization_id is not null/);
});

test("P5.5 frontend exposes Per te, explainable scoring and notification lifecycle", () => {
  assert.match(routes, /notifications: "\/marketplace\/notifications"/);
  assert.match(shell, /label: "Per te"/);
  assert.match(notificationsPage, /P5\.5 · Matching & Notifications/);
  assert.match(notificationsPage, /Match deterministici/);
  assert.match(notificationsPage, /MarketplaceCountdown/);
  assert.match(notificationsPage, /openMarketplaceNotification/);
  assert.match(notificationsPage, /dismissMarketplaceNotification/);
  assert.match(actions, /p5_5_notification_action/);
  assert.match(data, /p5_5_my_notifications/);
});

test("P5.5 buyer view is aggregate-only and does not list supplier identities", () => {
  assert.match(data, /p5_5_buyer_match_summary/);
  assert.match(requestPage, /Copertura supplier/);
  assert.match(requestPage, /metriche aggregate/);
  assert.match(requestPage, /Le identità dei supplier non/);
  assert.doesNotMatch(requestPage, /supplier_network_company_id/);
});

test("P5.5 tables stay RPC-only for authenticated clients", () => {
  for (const table of [
    "marketplace_matches",
    "marketplace_notifications",
    "marketplace_notification_events",
  ]) {
    assert.match(
      migration,
      new RegExp("alter table public\\." + table + " enable row level security"),
    );
    assert.match(
      migration,
      new RegExp(
        "revoke all on table public\\." +
          table +
          " from public,anon,authenticated",
      ),
    );
  }

  assert.match(migration, /public\.p5_5_my_notifications/);
  assert.match(migration, /public\.p5_5_notification_action/);
  assert.match(migration, /public\.p5_5_buyer_match_summary/);
});
