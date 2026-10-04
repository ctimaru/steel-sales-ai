import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const inventory = fs.readFileSync(
  new URL("../lib/privacy-processing-inventory.ts", import.meta.url),
  "utf8",
);
const privacy = fs.readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");
const wc5 = fs.readFileSync(
  new URL("../../supabase/migrations/20261004113212_wc5_public_utility_discovery_telemetry.sql", import.meta.url),
  "utf8",
);
const pa15 = fs.readFileSync(
  new URL("../../supabase/migrations/20261004060000_pa1_5_public_company_data_governance.sql", import.meta.url),
  "utf8",
);

test("LR3.1 creates a canonical processing inventory with explicit uncertainty states", () => {
  assert.match(inventory, /PROCESSING_INVENTORY_VERSION = "2026-10-04-lr3\.1"/);
  assert.match(inventory, /candidate-review-required/);
  assert.match(inventory, /tenant-controlled/);
  assert.match(inventory, /retentionState: "open"/);
  assert.match(inventory, /legalBasisState: "open"/);
  assert.match(inventory, /This is an accountability map, not final legal sign-off/);
});

test("LR3.1 covers the current personal-data-bearing product domains", () => {
  for (const id of [
    "LR3-A01",
    "LR3-A02",
    "LR3-A03",
    "LR3-A04",
    "LR3-A05",
    "LR3-A06",
    "LR3-A07",
    "LR3-A08",
    "LR3-A09",
    "LR3-A10",
    "LR3-A11",
    "LR3-A12",
  ]) {
    assert.ok(inventory.includes(`id: "${id}"`), `missing processing activity: ${id}`);
  }

  for (const label of [
    "Company registration and application review",
    "Company claim and representative verification",
    "Team invitations, memberships and role onboarding",
    "Public-source company discovery, governance and correction intake",
    "Public website analytics",
    "Commercial Memory ingestion and commercial intelligence",
    "Transactional service email",
  ]) {
    assert.ok(inventory.includes(label), `missing domain: ${label}`);
  }
});

test("LR3.1 separates platform-controller and tenant-processor contexts", () => {
  assert.match(inventory, /role: "platform-controller"/);
  assert.match(inventory, /role: "tenant-controller-platform-processor"/);
  assert.match(inventory, /Determined by the tenant controller/);
  assert.match(inventory, /Art\. 28 terms\/DPA/);
});

test("LR3.1 preserves Art. 14 as an open gate for source-derived personal data", () => {
  assert.match(inventory, /notice: "art14"/);
  assert.match(inventory, /OPEN for personal data obtained indirectly/);
  assert.match(inventory, /nextGate: "LR4\/LR6"/);
  assert.match(privacy, /art\. 14/i);
  assert.match(pa15, /personal-data/i);
});

test("LR3.1 records analytics as consent-based without weakening LR2", () => {
  assert.match(inventory, /name: "Public website analytics"/);
  assert.match(inventory, /legalBasis: "Consent\."/);
  assert.match(inventory, /legalBasisState: "implemented-consent"/);
  assert.match(inventory, /zero GA4 before consent/);
  assert.match(inventory, /private routes excluded/);
});

test("LR3.1 reflects WC5 privacy-minimal telemetry and does not misclassify it as GA4 consent", () => {
  assert.match(inventory, /Privacy-minimal public utility discovery telemetry/);
  assert.match(inventory, /qualification as personal\/non-personal data/);
  assert.match(inventory, /legalBasisState: "candidate-review-required"/);
  assert.match(wc5, /No user id, organization id, calculator input, email or commercial payload is stored/);
});

test("LR3.1 exposes open legal-basis and retention work as machine-readable gates", () => {
  assert.match(inventory, /OPEN_LEGAL_BASIS_ACTIVITY_IDS/);
  assert.match(inventory, /OPEN_RETENTION_ACTIVITY_IDS/);
  assert.match(inventory, /activity\.legalBasisState === "open"/);
  assert.match(inventory, /activity\.retentionState === "open"/);
});
