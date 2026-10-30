import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const decision = read("../lib/commercial-decision-readiness.ts");
const summary = read("../components/commercial-deal-intelligence.tsx");
const worklist = read("../components/commercial-unified-worklist.tsx");
const next = read("../lib/commercial-deal-next-step.ts");

test("COMM-UX6.D uses a compact, embedded checklist, not a second CRM or global score", () => {
  assert.match(summary, /data-testid="commercial-decision-readiness"/);
  assert.match(summary, /Prima di decidere/);
  assert.match(summary, /Non disponibile qui:/);
  assert.match(summary, /Da confermare:/);
  assert.match(summary, /commercialDecisionReadiness\(kind, facts, canWrite\)/);
  assert.match(worklist, /<CommercialDealIntelligence facts=\{facts\} kind=\{item\.kind\} canWrite=\{canWrite\} \/>/);
  assert.equal((worklist.match(/<CommercialDealIntelligence/g) ?? []).length, 1);
  assert.match(worklist, /data-testid="commercial-deal-next-step"/);
  assert.doesNotMatch(decision, /readinessScore|approvedForDispatch|isReadyToSend|autoSend/);
});

test("COMM-UX6.D missing information is not confused with status or business approval", () => {
  assert.match(decision, /if \(!facts\) return \{/);
  assert.match(decision, /available: false/);
  assert.match(decision, /checks: \[\]/);
  assert.match(decision, /non è disponibile/);
  assert.match(decision, /facts\.materials\.length === 0/);
  assert.match(decision, /facts\.materials\.some/);
  assert.match(decision, /kind === "campaign"/);
  assert.match(decision, /facts\.rawStatus === "draft"/);
  assert.match(decision, /kind === "quote"/);
  assert.match(decision, /kind === "purchase-order"/);
  assert.match(decision, /kind === "distinta"/);
  assert.match(decision, /kind === "inbound-rfq"/);
  assert.match(decision, /"missing"/);
  assert.match(decision, /"verify"/);
  assert.match(decision, /checks\.slice\(0, 4\)/);
});

test("COMM-UX6.D checks are advisory, do not mutate state, and respect readonly viewer", () => {
  assert.match(decision, /Consultazione in sola lettura/);
  assert.match(decision, /Conferma e invio restano nel flusso originale/);
  assert.match(decision, /non sono offerte né prezzi confermati/);
  assert.match(decision, /non sono attestati/);
  assert.match(decision, /Totale dell'ordine non disponibile in questa scheda/);
  assert.match(next, /if \(!canWrite\)/);
  assert.doesNotMatch(decision, /dispatchRFQ|issuePurchaseOrder|awardSupplier|createClient\(|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
