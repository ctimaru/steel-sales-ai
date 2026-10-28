import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx", import.meta.url), "utf8");

test("Deal intelligence prepares a private assistant handoff only after user action", () => {
  assert.match(src, /data-testid="commercial-deal-memory-entry"/);
  assert.match(src, /<CommercialDealFactBriefCopy/);
  assert.match(assistant, /router\.push\(appRoutes\.commercial\.assistant\)/);
  assert.match(assistant, /sessionStorage\.setItem/);
  assert.match(assistant, /Prepara nell’assistente/);
  assert.match(src, /data-testid="commercial-deal-next-step"/);
});
