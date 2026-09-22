import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const commercialData = fs.readFileSync(
  new URL("../lib/commercial-data.ts", import.meta.url),
  "utf8",
);
const conversation = fs.readFileSync(
  new URL("../app/(workspace)/conversations/[id]/page.tsx", import.meta.url),
  "utf8",
);
const company360 = fs.readFileSync(
  new URL("../app/(workspace)/customers/[companyId]/page.tsx", import.meta.url),
  "utf8",
);

test("conversation customer context is resolved only from normalized entities", () => {
  assert.match(commercialData, /source_conversation_id/);
  assert.match(commercialData, /normalizedRouteConversation/);
  assert.match(commercialData, /external_thread_id/);
  assert.match(commercialData, /from\("conversations"\)/);
  assert.match(commercialData, /from\("rfqs"\)/);
  assert.match(commercialData, /from\("offers"\)/);
  assert.match(commercialData, /from\("orders"\)/);
  assert.match(commercialData, /companyIds\.size === 1/);
  assert.doesNotMatch(commercialData, /sender_email.*companyId|domain.*companyId/i);
});

test("legacy observations remain evidence but no longer label a customer", () => {
  assert.match(commercialData, /company: normalizedCompany\?\.name \?\? "Cliente non attribuito"/);
  assert.match(conversation, /Le osservazioni legacy restano evidenza del thread/);
  assert.match(conversation, /Company 360 →/);
  assert.match(conversation, /Cliente non attribuito/);
});

test("Company 360 can navigate back to normalized commercial conversation context", () => {
  assert.match(company360, /event\.provenance\?\.conversation_id/);
  assert.match(company360, /\/conversations\/\$\{String\(event\.provenance\.conversation_id\)\}/);
  assert.match(company360, /Apri conversazione →/);
});
