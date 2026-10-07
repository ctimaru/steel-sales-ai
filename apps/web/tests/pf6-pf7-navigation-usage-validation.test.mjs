import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const focusUi = read("../components/focus-ui.tsx");
const emptyState = read("../components/first-use-empty-state.tsx");
const shell = read("../components/app-shell.tsx");
const nav = read("../components/workspace-navigation.tsx");
const globals = read("../app/globals.css");
const home = read("../app/(workspace)/dashboard/page.tsx");
const commercial = read("../app/(workspace)/commercial/page.tsx");
const network = read("../app/(workspace)/network/page.tsx");
const marketplace = read("../app/(workspace)/marketplace/page.tsx");
const opportunity = read("../app/(workspace)/marketplace/opportunities/[id]/page.tsx");
const rfqHub = read("../app/(workspace)/marketplace/rfq-hub/page.tsx");
const school = read("../app/(workspace)/school/page.tsx");
const schoolTubes = read("../app/(workspace)/school/tubes/page.tsx");
const schoolStandards = read("../app/(workspace)/school/norme/page.tsx");
const schoolGrades = read("../app/(workspace)/school/gradi/page.tsx");
const telemetry = read("../app/(workspace)/telemetry/actions.ts");
const pilotAnalytics = read("../app/(workspace)/pilot-analytics/page.tsx");
const migration = read("../../../supabase/migrations/20261007111127_pf7_usage_validation_events.sql");

test("PF6 aligns focused page hierarchy across the five macro-spaces", () => {
  assert.match(focusUi, /export function FocusSectionHeader/);
  assert.match(focusUi, /space-y-7/);
  for (const source of [home, commercial, network, marketplace, school]) {
    assert.match(source, /FocusHeader/);
    assert.match(source, /FocusSectionHeader/);
  }
  assert.match(emptyState, /app-primary/);
  assert.match(emptyState, /app-secondary/);
});

test("PF6 aligns navigation language and interaction states", () => {
  assert.match(shell, /label: "Attività"/);
  assert.match(shell, /label: "Richieste"/);
  assert.match(shell, /return "Amministratore azienda"/);
  assert.match(shell, /return "Sola lettura"/);
  assert.match(nav, /workspace-context-scroll/);
  assert.match(nav, /bg-\[#f7faf8\]/);
  assert.match(nav, /min-h-11/);
  assert.match(globals, /workspace-context-scroll/);
  assert.match(globals, /app-section-header/);
});

test("PF7 defines privacy-safe authenticated usage events", () => {
  for (const eventName of [
    "workspace_home_viewed",
    "commercial_home_viewed",
    "network_search_completed",
    "marketplace_home_viewed",
    "marketplace_opportunity_viewed",
    "rfq_hub_viewed",
    "school_home_viewed",
    "school_calculator_viewed",
    "school_reference_search",
  ]) {
    assert.match(telemetry, new RegExp(eventName));
    assert.match(migration, new RegExp(eventName));
  }
  assert.match(migration, /source.*surface.*format/s);
  assert.doesNotMatch(migration, /query_text|customer_name|price_value|rfq_content/);
});

test("PF7 instruments macro-space usage without copying commercial content", () => {
  assert.match(home, /workspace_home_viewed/);
  assert.match(commercial, /commercial_home_viewed/);
  assert.match(network, /network_search_completed/);
  assert.match(marketplace, /marketplace_home_viewed/);
  assert.match(opportunity, /marketplace_opportunity_viewed/);
  assert.match(rfqHub, /rfq_hub_viewed/);
  assert.match(school, /school_home_viewed/);
  assert.match(schoolTubes, /school_calculator_viewed/);
  assert.match(schoolStandards, /school_reference_search/);
  assert.match(schoolGrades, /school_reference_search/);
});

test("PF7 exposes usage validation in Pilot Analytics", () => {
  assert.match(pilotAnalytics, /PF7 · Usage Validation/);
  assert.match(pilotAnalytics, /Le macrosezioni vengono davvero usate/);
  assert.match(pilotAnalytics, /workspace_home_views/);
  assert.match(pilotAnalytics, /network_searches/);
  assert.match(pilotAnalytics, /marketplace_opportunity_views/);
  assert.match(pilotAnalytics, /school_calculator_views/);
  assert.match(pilotAnalytics, /Ricerche norme\/gradi/);
});
