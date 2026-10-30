import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const source = read("../lib/commercial-director-priorities.ts");
const component = read("../components/commercial-director-priority-desk.tsx");
const home = read("../app/(italian)/(workspace)/commercial/page.tsx");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { commercialDirectorAttentionCount, selectCommercialDirectorResumeItem, commercialDirectorResumeLabel } =
  await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const item = (kind, at = "2026-10-29T12:00:00Z") => ({
  kind, key: kind + ":test", title: "Test azienda", subtitle: "", status: "Disponibile", at,
  origin: "acquisti privati", view: "sent", id: "a", href: "/rfq-hub", campaignId: null,
});
const full = items => ({
  items, partial: false, procurementUnavailable: false, inboundUnavailable: false,
  truncated: false,
});

test("COMM-NAV9 never turns unknown, negative or fractional attention totals into zero", () => {
  for (const bad of [null, undefined, "", "0", -1, 0.1, NaN, Infinity, {}, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(commercialDirectorAttentionCount(bad), null);
  }
  assert.equal(commercialDirectorAttentionCount(0), 0);
  assert.equal(commercialDirectorAttentionCount(3), 3);
});

test("COMM-NAV9 resume only from authorized, complete initial all-view procurement records", () => {
  const latest = item("quote");
  const older = item("distinta", "2026-10-28T12:00:00Z");
  assert.equal(selectCommercialDirectorResumeItem(full([latest, older]), "all"), latest);
  assert.equal(selectCommercialDirectorResumeItem(full([item("inbound-rfq"), older]), "all"), older);
  assert.equal(selectCommercialDirectorResumeItem(full([latest]), "sent"), null);
  assert.equal(selectCommercialDirectorResumeItem({ ...full([latest]), procurementUnavailable: true }, "all"), null);
  assert.equal(selectCommercialDirectorResumeItem({ ...full([latest]), truncated: true }, "all"), null);
  assert.equal(selectCommercialDirectorResumeItem(full([]), "all"), null);
  assert.equal(commercialDirectorResumeLabel(latest), "Offerta fornitore");
  assert.equal(commercialDirectorResumeLabel(item("campaign")), "RFQ ai fornitori");
  assert.equal(commercialDirectorResumeLabel(item("purchase-order")), "Ordine acquisti");
});

test("COMM-NAV9 is a small decision desk, not another menu or a fake AI priority score", () => {
  assert.match(home, /<CommercialDirectorPriorityDesk/);
  assert.match(home, /procurementAvailable=\{procurementPayload !== null\}/);
  assert.match(home, /data=\{displayedUnified\}/);
  assert.match(home, /const actionableRfqs =/);
  assert.match(component, /id="commercial-today"/);
  assert.match(component, /data-testid="commercial-compact-actions"/);
  assert.match(component, /data-testid="commercial-compact-attention"/);
  assert.match(component, /data-testid="commercial-director-rfq-priorities"/);
  assert.match(component, /data-testid="commercial-director-resume"/);
  assert.match(component, /Cosa richiede attenzione/);
  assert.match(component, /Ultima attività acquisti disponibile, non classificata urgente/);
  assert.match(component, /Consultazione in sola lettura/);
  assert.match(component, /confermedCount|confirmedCount/);
  assert.match(component, /href=\{appRoutes.rfqHub.campaign\(item.rfq_id\)\}/);
  assert.match(component, /commercialHref\("all", "", resume.key\)/);
  assert.doesNotMatch(component + source, /service_role|autoDispatch|sendEmail|issuePurchaseOrder|readinessScore|Urgente oggi/);
});
