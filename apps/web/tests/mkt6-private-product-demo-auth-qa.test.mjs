import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const routes = read("../lib/routes.ts");
const data = read("../lib/marketing-private-demo-data.ts");
const room = read("../components/private-product-demo-room.tsx");
const roomPage = read("../app/(platform)/platform/marketing/demo-room/[surface]/page.tsx");
const qa = read("../components/visual-evidence-qa.tsx");
const readiness = read("../lib/marketing-fundraising-readiness.ts");
const assets = read("../lib/marketing-investor-narrative.ts");
const library = read("../components/investor-narrative-library.tsx");

test("MKT6 demo dataset is explicitly synthetic and excluded from production evidence", () => {
  assert.match(data, /synthetic: true/);
  assert.match(data, /tenantScoped: false/);
  assert.match(data, /analyticsExcluded: true/);
  assert.match(data, /DEMO DATA — NOT CUSTOMER EVIDENCE/);
  assert.match(data, /MKT6 fixture/);
  assert.doesNotMatch(data, /supabase/i);
});

test("MKT6 fixtures use only non-sensitive demo identities", () => {
  const emails = [...data.matchAll(/["']([^"'\s]+@[^"'\s]+)["']/g)].map((match) => match[1]);
  assert.ok(emails.length >= 4);
  assert.ok(emails.every((email) => email.endsWith("@alpha.example.com") || email.endsWith("@beta.example.com") || email.endsWith("@delta.example.com") || email.endsWith("@epsilon.example.com")));
  assert.doesNotMatch(data, /Bronifer|Padana|Timaru/i);
  assert.match(data, /DemoSteel Alpha/);
  assert.match(data, /DemoPipe Beta/);
});

test("MKT6 covers all four private investor-demo surfaces", () => {
  for (const key of ["commercial-memory", "rfq-hub", "network", "procurement-intelligence"]) {
    assert.match(data, new RegExp(`key: "${key}"`));
  }
  assert.match(room, /CommercialMemoryDemo/);
  assert.match(room, /RfqHubDemo/);
  assert.match(room, /NetworkDemo/);
  assert.match(room, /ProcurementIntelligenceDemo/);
});

test("MKT6 demo room is owner-only and emits no pilot telemetry", () => {
  assert.match(roomPage, /requirePlatformSuperadmin\(\)/);
  assert.match(roomPage, /isInvestorDemoSurface/);
  assert.doesNotMatch(roomPage, /PilotEvent/);
  assert.doesNotMatch(room, /PilotEvent/);
  assert.match(routes, /marketingDemoRoom: \(surface: string\)/);
});

test("MKT6 keeps private screenshot candidates pending until live authenticated QA", () => {
  for (const key of ["commercial-memory", "rfq-hub", "network", "procurement-intelligence"]) {
    assert.match(readiness, new RegExp(`key: "${key}"[\\s\\S]*readiness: "candidate"`));
  }
  assert.match(readiness, /Demo Room MKT6 pronta/);
  assert.match(qa, /Apri demo autenticata/);
  assert.match(qa, /marketingDemoRoom\(item\.key\)/);
});

test("MKT6 registers the demo room as an internal Marketing asset only", () => {
  assert.match(assets, /key: "private-demo-room"[\s\S]*maturity: "approved"[\s\S]*visibility: "internal"/);
  assert.match(library, /asset\.key === "private-demo-room"/);
  assert.doesNotMatch(assets, /key: "private-demo-room"[\s\S]*visibility: "investor_visible"/);
});
