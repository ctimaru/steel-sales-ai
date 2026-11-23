import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

// DISTINTA-DEFAULTS1 (founder decisions, 23 Nov 2026): «RDO <anno>/<nnnn>» name,
// deadline 3 working days at 12:00, pre-filled message to suppliers.

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const toJs = (source) => ts.transpileModule(
  source.replace(/^import[^;]+;\s*/gmu, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^export /gmu, "");
const formatDocs = new Function(toJs(read("../lib/buyer-distinta-documents.ts")) + "\nreturn formatBuyerDocumentRequirements;")();
const d = new Function("formatBuyerDocumentRequirements", toJs(read("../lib/distinta-defaults.ts")) +
  "\nreturn { nextRdoTitle, rdoTitle, isAutomaticDistintaTitle, defaultOfferDeadline, toDateTimeLocalValue, defaultSupplierMessage, romeYear };")(formatDocs);

test("the next RDO number is the highest of the year plus one", () => {
  assert.equal(d.nextRdoTitle([], 2026), "RDO 2026/0001");
  assert.equal(d.nextRdoTitle(["RDO 2026/0041", "RDO 2026/0007 quadri", "rdo 2026 / 12", null, "RDO 2025/0099", "Richiesta di offerta"], 2026), "RDO 2026/0042");
  assert.equal(d.rdoTitle(2027, 12345), "RDO 2027/12345");
  assert.equal(d.romeYear(new Date("2026-12-31T23:30:00Z")), 2027, "The year follows Italian time");
});

test("an untouched automatic name is not a chosen name", () => {
  assert.equal(d.isAutomaticDistintaTitle("Richiesta di offerta", null), true);
  assert.equal(d.isAutomaticDistintaTitle(" RDO 2026/0042 ", "RDO 2026/0042"), true);
  assert.equal(d.isAutomaticDistintaTitle("RDO 2026/0042 cantiere Bari", "RDO 2026/0042"), false);
});

test("deadline: 3 working days ahead at 12:00, weekends skipped", () => {
  const friday = new Date(2026, 10, 20, 17, 45); // Fri 20 Nov 2026
  const due = d.defaultOfferDeadline(friday);
  assert.equal(due.getDay(), 3, "Friday + 3 working days = Wednesday");
  assert.equal(d.toDateTimeLocalValue(due), "2026-11-25T12:00");
  assert.equal(d.toDateTimeLocalValue(d.defaultOfferDeadline(new Date(2026, 10, 23, 9, 0))), "2026-11-26T12:00");
  assert.equal(d.toDateTimeLocalValue(d.defaultOfferDeadline(new Date(2026, 10, 22, 9, 0))), "2026-11-25T12:00", "Sunday counts from Monday");
});

test("the message asks price, availability, delivery, validity, terms and the certificates", () => {
  const text = d.defaultSupplierMessage({ title: "RDO 2026/0042", lineCount: 2, totalTonnes: 11.01,
    documents: { inspectionDocument: "3.1", ceDop: true, iso9001: false } });
  for (const part of ["«RDO 2026/0042»", "2 articoli", "11,01 t", "prezzo e disponibilità", "tempi di consegna",
    "validità dell'offerta", "resa e condizioni di pagamento", "EN 10204 tipo 3.1", "Marcatura CE"]) {
    assert.ok(text.includes(part), part);
  }
  const plain = d.defaultSupplierMessage({ title: "X", lineCount: 1, totalTonnes: null, documents: null });
  assert.ok(plain.includes("(1 articolo)"));
  assert.doesNotMatch(plain, /Documentazione/);
  // No date in the text: the deadline field stays the single source.
  assert.doesNotMatch(text, /\d{1,2}\/\d{1,2}\/\d{4}/);
});

test("wiring: server name, draft handling, step 3 defaults, local-time deadline", () => {
  const page = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  const builder = read("../components/buyer-distinta-builder.tsx");
  const panel = read("../components/rfq-dispatch-panel.tsx");
  const campaign = read("../app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx");
  assert.match(page, /loadDefaultDistintaTitle\(context\.organizationId\)/);
  assert.match(page, /defaultTitle=\{defaultTitle\}/);
  assert.match(builder, /useState\(defaultTitle \?\? LEGACY_DEFAULT_TITLE\)/);
  assert.match(builder, /isAutomaticDistintaTitle\(title, defaultTitle\) \? LEGACY_DEFAULT_TITLE : title/);
  assert.match(panel, /toDateTimeLocalValue\(new Date\(dueAt\)\)/);
  assert.match(panel, /toDateTimeLocalValue\(defaultOfferDeadline\(\)\)/);
  assert.doesNotMatch(panel, /toISOString\(\)\.slice\(0, 16\)/, "A saved deadline must not be shown in UTC");
  assert.match(panel, /buyerMessage\?\.trim\(\) \? buyerMessage : \(defaultMessage \?\? ""\)/);
  assert.match(campaign, /defaultMessage=\{defaultSupplierMessage\(\{/);
  assert.match(campaign, /total_tonnes,target_total_eur,document_requirements/);
});
