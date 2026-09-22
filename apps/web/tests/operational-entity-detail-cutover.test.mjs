import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const data = fs.readFileSync(new URL("../lib/commercial-data.ts", import.meta.url), "utf8");
const explorer = fs.readFileSync(new URL("../components/commercial-explorer.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const detail = fs.readFileSync(new URL("../components/operational-entity-detail.tsx", import.meta.url), "utf8");
const rfqPage = fs.readFileSync(new URL("../app/(workspace)/rfqs/[id]/page.tsx", import.meta.url), "utf8");
const offerPage = fs.readFileSync(new URL("../app/(workspace)/offers/[id]/page.tsx", import.meta.url), "utf8");
const orderPage = fs.readFileSync(new URL("../app/(workspace)/orders/[id]/page.tsx", import.meta.url), "utf8");

test("PA2.20 exposes normalized RFQ Offer Order detail routes", () => {
  assert.match(rfqPage, /getOperationalEntityData\("rfq"/);
  assert.match(offerPage, /getOperationalEntityData\("offer"/);
  assert.match(orderPage, /getOperationalEntityData\("order"/);
  assert.match(detail, /Entità commerciale normalizzata/);
});

test("Explorer primary navigation targets normalized operational entities", () => {
  assert.match(data, /operationalHref:/);
  assert.match(data, /\/rfqs\//);
  assert.match(data, /\/offers\//);
  assert.match(data, /\/orders\//);
  assert.match(explorer, /row\.operationalHref/);
  assert.match(explorer, /Apri dettaglio/);
  assert.match(explorer, /Conversation \/ provenance/);
});

test("detail pages preserve conservative identity and provenance", () => {
  assert.match(data, /companyId: typeof parentRow\.company_id === "string"/);
  assert.doesNotMatch(data, /domain.*company|sender_email.*company/i);
  assert.match(data, /source_observation_id/);
  assert.match(detail, /Company 360/);
  assert.match(detail, /Provenance/);
});

test("dashboard recent activity prefers normalized detail route", () => {
  assert.match(data, /operationalHref:/);
  assert.match(dashboard, /row\.operationalHref \?\?/);
});