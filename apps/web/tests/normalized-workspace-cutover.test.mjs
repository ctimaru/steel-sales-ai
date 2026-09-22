import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const data = fs.readFileSync(new URL("../lib/commercial-data.ts", import.meta.url), "utf8");
const explorer = fs.readFileSync(new URL("../components/commercial-explorer.tsx", import.meta.url), "utf8");
const followup = fs.readFileSync(new URL("../app/(workspace)/unconverted-offers/page.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("dashboard and explorer use normalized business entities as operational read path", () => {
  const explorerBlock = data.slice(data.indexOf("export async function getExplorerData"), data.indexOf("export async function getConversationData"));
  assert.match(explorerBlock, /p1_normalized_commercial_explorer/);
  assert.doesNotMatch(explorerBlock, /from\("commercial_observations"\)/);
  assert.doesNotMatch(explorerBlock, /from\("rfq_lines"\)/);
  assert.match(data, /operational:/);
  assert.match(dashboard, /Workspace normalizzato/);
});

test("normalized workspace customer labels come only from explicit company links", () => {
  assert.match(data, /companies\(name\)/);
  assert.match(data, /Cliente non attribuito/);
  assert.match(explorer, /Company 360 →/);
  assert.doesNotMatch(data, /domain.*company|sender_email.*company/i);
});

test("unconverted offers prefers normalized Offer to Order relationship and preserves legacy fallback", () => {
  assert.match(followup, /from\("offers"\)/);
  assert.match(followup, /from\("orders"\)/);
  assert.match(followup, /normalized\.rows\.length > 0/);
  assert.match(followup, /loadOffersWithoutOrder/);
  assert.match(followup, /Nessuna inferenza da thread legacy/);
});
