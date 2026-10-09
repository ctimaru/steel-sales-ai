import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const data = read("../lib/demotest1-company-fixtures.ts");
const page = read("../app/(platform)/platform/marketing/demo-room/companies/page.tsx");
const oldRoom = read("../components/private-product-demo-room.tsx");
const browser = read("./demotest1-browser-smoke.mjs");

test("DEMOTEST1 defines exactly four Network company roles with distinct synthetic companies", () => {
  const keys = [...data.matchAll(/key: "(demo-(?:producer|trader|processor|end-user))"/g)].map((m) => m[1]);
  assert.deepEqual(keys, ["demo-producer", "demo-trader", "demo-processor", "demo-end-user"]);
  for (const role of ["producer", "trader_distributor", "processor_service_provider", "end_user"]) {
    assert.match(data, new RegExp('roleKey: "' + role + '"'));
  }
  for (const name of ["DEMO Steel Manufacturing", "DEMO Tubes Trading", "DEMO Steel Processing", "DEMO Industrial Engineering"]) {
    assert.ok(data.includes(name));
  }
});

test("DEMOTEST1 uses fake contact domains and separate director / staff personas", () => {
  const emails = [...data.matchAll(/["']([a-z0-9.-]+@[a-z0-9.-]+)["']/gi)].map((m) => m[1]);
  assert.equal(emails.length, 12);
  assert.ok(emails.every((email) => email.endsWith(".example.com")));
  assert.match(data, /Sales Director/);
  assert.match(data, /Procurement Director/);
  assert.match(data, /Commerciale/);
});

test("DEMOTEST1 mixed-standards RFQ retains quotation coverage and dispatch safety", () => {
  assert.match(data, /standard: "EN 10219"/);
  assert.match(data, /standard: "EN 10210"/);
  assert.match(data, /"EN 10204 3.1"/);
  assert.match(data, /"EN 10204 2.2"/);
  assert.match(data, /coverage: "3\/3"/);
  assert.match(data, /coverage: "2\/3"/);
  assert.match(data, /externalDispatch: false/);
  assert.match(data, /purchaseOrderSent: false/);
});

test("DEMOTEST1 is strictly owner-only fixture data with no production writes", () => {
  for (const gate of ["synthetic: true", "tenantScoped: false", "analyticsExcluded: true", "publicIndexingAllowed: false", "dispatchEnabled: false", "databaseWritesEnabled: false", "ownerOnly: true"]) {
    assert.ok(data.includes(gate), gate);
  }
  assert.doesNotMatch(data, /createClient\(|service_role|supabase\.from|fetch\(/);
  assert.match(page, /await requirePlatformSuperadmin\(\)/);
  assert.doesNotMatch(page, /use client|createClient\(|\.rpc\(/);
  assert.match(page, /data-testid="demotest1-owner-only"/);
  assert.match(oldRoom, /marketing\/demo-room\/companies/);
});

test("DEMOTEST1 covers key positive and negative workflows without claiming authenticated pass", () => {
  const cases = [...data.matchAll(/id: "DT1-\d\d"/g)];
  assert.equal(cases.length, 12);
  assert.match(data, /COMPETITOR_OFFER_DENIED/);
  assert.match(data, /NO_AUTOPUBLICATION/);
  assert.match(data, /ROLE_SCOPED_NOTIFICATIONS/);
  assert.match(data, /authenticated_pending/);
  assert.match(data, /browser_pending/);
  assert.match(browser, /chromium\.launch/);
  assert.match(browser, /NO_PRIVATE_LEAK/);
});
