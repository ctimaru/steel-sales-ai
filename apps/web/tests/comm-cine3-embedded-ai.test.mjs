import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const worklist = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../components/commercial-deal-fact-brief-copy.tsx", import.meta.url), "utf8");

test("COMM-CINE3 embeds AI in selected deal without duplicate navigation card", () => {
  assert.match(worklist, /data-testid="commercial-deal-memory-entry"/);
  assert.match(worklist, /Analizza questa trattativa/);
  assert.match(worklist, /Solo dati autorizzati/);
  assert.match(worklist, /<CommercialDealFactBriefCopy key=\{item\.key\}/);
  assert.match(worklist, /<details data-testid="commercial-deal-fact-brief"/);
  assert.doesNotMatch(worklist, /Apri assistente commerciale →/);
});
test("COMM-CINE3 retains explicit evidence retrieval and data review before assistant handoff", () => {
  assert.match(assistant, /loadAuthorizedDealEvidence\(kind, dealId\)/);
  assert.match(assistant, /sessionStorage\.setItem/);
  assert.match(assistant, /Controlla il contesto da condividere/);
  assert.match(assistant, /Prepara nell’assistente/);
  assert.match(assistant, /navigator\.clipboard\.writeText/);
});
