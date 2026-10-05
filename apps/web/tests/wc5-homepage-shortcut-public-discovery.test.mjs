import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const network = fs.readFileSync(
  new URL("../components/public-network-role-explorer.tsx", import.meta.url),
  "utf8",
);
const schoolLayout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const schoolHome = fs.readFileSync(
  new URL("../app/(public)/knowledge/page.tsx", import.meta.url),
  "utf8",
);
const calculatorPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const telemetry = fs.readFileSync(
  new URL("../components/public-utility-telemetry.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20261004113212_wc5_public_utility_discovery_telemetry.sql", import.meta.url),
  "utf8",
);

test("WC5 makes the calculator a primary public-home action", () => {
  assert.match(home, /Calcolo pesi/);
  assert.match(home, /source=home&surface=hero#calcolatore-pesi/);
  assert.match(home, /source=home&surface=header#calcolatore-pesi/);
  assert.match(home, /source=home&surface=quick_actions#calcolatore-pesi/);
  assert.match(home, /source=home&surface=school_section#calcolatore-pesi/);
  assert.doesNotMatch(home, />Calcolatore</);
  assert.match(home, />\s*Calcolo pesi\s*</);
  assert.match(home, /surface=quick_actions#calcolatore-pesi/);
});

test("WC5 keeps Scuola discovery visible on desktop, mobile and Scuola home", () => {
  assert.match(schoolLayout, /source=school&surface=nav#calcolatore-pesi/);
  assert.match(schoolLayout, />\s*Calcolatore\s*</);
  assert.match(schoolHome, /eyebrow: "Calcolatore"/);
  assert.match(schoolHome, /status: "Utility"/);
  assert.match(schoolHome, /source=school&surface=home_card#calcolatore-pesi/);
  assert.match(schoolHome, /Calcola ora/);
});

test("WC5 calculator page validates discovery attribution and records the open", () => {
  assert.match(calculatorPage, /source\?: string/);
  assert.match(calculatorPage, /surface\?: string/);
  assert.match(calculatorPage, /supportedDiscoverySources/);
  assert.match(calculatorPage, /supportedDiscoverySurfaces/);
  assert.match(calculatorPage, /<PublicUtilityTelemetry source=\{discoverySource\} surface=\{discoverySurface\} \/>/);
  assert.match(calculatorPage, /: "direct"/);
});

test("WC5 telemetry stores only allowlisted discovery metadata", () => {
  assert.match(telemetry, /event_name: "calculator_opened"/);
  assert.match(telemetry, /source,/);
  assert.match(telemetry, /surface,/);
  assert.doesNotMatch(telemetry, /user_id|organization_id|email|quantity|thickness|weight_kg/i);
  assert.match(telemetry, /public_utility_events/);
});

test("WC5 public telemetry table is insert-only for public roles", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant insert \(event_name, source, surface\).*to anon, authenticated/s);
  assert.doesNotMatch(migration, /grant select.*anon/i);
  assert.match(migration, /for insert\s+to anon, authenticated/s);
  assert.match(migration, /event_name = 'calculator_opened'/);
  assert.match(migration, /Stores no user, organization, calculator input, IP, email, or commercial payload/);
});

test("WC5 leaves the Network positioning private", () => {
  assert.match(network, /Privato · Premium/);
  assert.match(network, /directory completa/);
  assert.doesNotMatch(home, /href="\/network"/);
  assert.doesNotMatch(network, /href="\/network"/);
});
