import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/commercial-deal-next-step.ts");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { commercialDealNextStep, commercialDealOperationTab } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const worklist = read("../components/commercial-unified-worklist.tsx");
const operations = read("../components/commercial-campaign-operations.tsx");
const intelligence = read("../components/commercial-deal-intelligence.tsx");

test("COMM-UX7.C only offers an in-place operation when a record and a writer are available", () => {
  for (const [kind, status, tab] of [
    ["campaign", "draft", null],
    ["campaign", "ready", null],
    ["campaign", "launched", "compare"],
    ["campaign", "collecting", "compare"],
    ["campaign", "awarded", "po"],
    ["campaign", "cancelled", null],
    ["quote", "submitted", "compare"],
    ["purchase-order", "draft", "po"],
    ["distinta", "Salvata", null],
    ["inbound-rfq", "requested", null],
    ["inbound-offer", "sent", null],
    ["inbound-order", "accepted", null],
  ]) {
    assert.equal(commercialDealOperationTab(kind, status, true, true), tab, kind + ":" + status);
    assert.equal(commercialDealOperationTab(kind, status, false, true), null, "viewer stays on source");
    assert.equal(commercialDealOperationTab(kind, status, true, false), null, "unavailable source stays on source");
  }
});

test("COMM-UX7.C never suggests action execution from an unavailable record", () => {
  const unavailable = commercialDealNextStep("campaign", "launched", true, false);
  assert.match(unavailable.title, /Verifica i dati/);
  assert.match(unavailable.actionLabel, /originale/);
  const viewer = commercialDealNextStep("campaign", "awarded", false, true);
  assert.match(viewer.description, /sola lettura/);
  assert.equal(commercialDealNextStep("campaign", "launched", true).actionLabel, "Vedi risposte →");
});

test("COMM-UX7.C single decision dock keeps missing-information checklist and governed action adjacent", () => {
  assert.match(worklist, /data-testid="commercial-decision-dock"/);
  assert.match(worklist, /<CommercialDealDecisionReadiness facts=\{facts\} kind=\{item.kind\} canWrite=\{canWrite\} \/>/);
  assert.match(worklist, /data-testid="commercial-deal-next-step"/);
  assert.match(worklist, /data-testid="commercial-deal-primary-action"/);
  assert.match(worklist, /href=\{actionHref\}/);
  assert.ok(worklist.indexOf("commercial-decision-dock") < worklist.indexOf("commercial-deal-next-step"));
  assert.match(intelligence, /commercialDecisionReadiness\(kind, facts, canWrite\)/);
  assert.equal((worklist.match(/<CommercialDealIntelligence/g) ?? []).length, 1);
});

test("COMM-UX7.C preserves worklist filter, selection and cursor, using existing RFQH owner checks", () => {
  assert.match(operations, /export function operationsHref/);
  assert.match(operations, /mergedCommercialHref\(view, query, cursor, selected\)/);
  assert.match(operations, /commercialPageHref\(view, query, page, selected\)/);
  assert.match(operations, /\+ "tab=" \+ tab \+ "#commercial-operations"/);
  assert.match(worklist, /operationTab && item.campaignId/);
  assert.match(worklist, /operationsHref\(view, query, item.key, operationTab, page, cursor\)/);
  assert.match(operations, /canExecuteCritical = canWrite && !governanceError/);
  assert.match(operations, /\.eq\("organization_id", context.organizationId\)/);
  assert.doesNotMatch(source + worklist, /autoDispatch|service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
