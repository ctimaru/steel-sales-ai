import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const source = read("../lib/rfq-ai-intake-contract.ts");
const adapterSource = read("../lib/rfq-ai-parser-v4-adapter.ts");
const buyerSource = read("../lib/buyer-distinta.ts");
const guidanceSource = read("../lib/buyer-tube-guidance.ts");
const audit = read("../../../docs/architecture/rfqai1-unified-intake-contract.md");

const transpile = (input) => ts.transpileModule(input, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*$/gm, "").replace(/^export /gm, "");
const buyer = new Function(transpile(buyerSource) +
  "\nreturn { calculateBuyerDistintaLine, calculateBuyerDistintaTotals };")();
const guided = new Function(transpile(guidanceSource) + "\nreturn { guidedTubeMassKgM };")();
const engine = new Function("calculateBuyerDistintaLine", "guidedTubeMassKgM",
  transpile(source) + "\nreturn {RFQAI_INTAKE_CONTRACT,normalizeRfqAiCandidate,makeRfqAiIntakeBatch};",
)(buyer.calculateBuyerDistintaLine, guided.guidedTubeMassKgM);
const adapter = new Function("makeRfqAiIntakeBatch", transpile(adapterSource) +
  "\nreturn {mapParserV4Observation,makeRfqAiBatchFromParserV4};")(engine.makeRfqAiIntakeBatch);

const sourceRef = { sourceId: "source.test.1", channel: "uploaded_file", sourceFilename: "rfq.xlsx" };
const locator = { kind: "spreadsheet_row", sheet: "RFQ", row: 12 };
const valid = (standard = "EN 10219") => ({
  sourceText: "30 pz tubo quadro 100x100x5 S355J2H 12m " + standard,
  widthMm: 100, heightMm: 100, thicknessMm: 5, standard,
  grade: "S355J2H", quantity: 30, quantityUnit: "PZ", lengthMm: 12000,
  parserConfidence: 0.98, parserValidationStatus: "valid", itemRole: "requested",
});
const normalize = (raw, options = {}) => engine.normalizeRfqAiCandidate(
  options.source ?? sourceRef,
  options.id ?? "v4-1",
  options.locator ?? locator,
  options.intent ?? "buyer_request",
  raw,
);

test("RFQAI1 complete and traceable cold-formed request is pending human review", () => {
  const c = normalize(valid());
  assert.equal(c.contractVersion, "rfqai-intake/v1");
  assert.equal(c.status, "ready_for_review");
  assert.equal(c.approvalState, "pending_human_review");
  assert.equal(c.proposedLine.standard, "EN 10219");
  assert.equal(c.proposedLine.quantityMode, "bars");
  assert.equal(c.proposedLine.barLengthM, "12");
  assert.equal(c.proposedLine.quantity, "30");
  assert.equal(c.evidence.quantity.rawValue, "30");
  assert.deepEqual(c.evidence.grade.locator, locator);
  assert.equal(c.evidence.weightKgM.origin, "derived");
  assert.equal(buyer.calculateBuyerDistintaLine(c.proposedLine).meters, 360);
  assert.equal(buyer.calculateBuyerDistintaLine(c.proposedLine).complete, true);
  assert.deepEqual(c.issues, []);
});

test("RFQAI1 independently calculates theoretical norm-specific kg/m for mixed request", () => {
  const cold = normalize(valid("EN 10219"), {id: "cold"});
  const hot = normalize(valid("EN 10210"), {id: "hot"});
  assert.equal(hot.proposedLine.standard, "EN 10210");
  assert.ok(Number(hot.proposedLine.weightKgM.replace(",", ".")) >
    Number(cold.proposedLine.weightKgM.replace(",", ".")));
  assert.equal(buyer.calculateBuyerDistintaTotals([
    buyer.calculateBuyerDistintaLine(cold.proposedLine),
    buyer.calculateBuyerDistintaLine(hot.proposedLine),
  ]).completeLines, 2);
});

test("RFQAI1 never invents missing norm, grade, 12m bar length or quantity", () => {
  const row = normalize({
    widthMm: 100, heightMm: 100, thicknessMm: 5,
    quantity: 20, quantityUnit: "PZ",
  });
  assert.equal(row.status, "needs_review");
  assert.equal(row.proposedLine.standard, "");
  assert.equal(row.proposedLine.grade, "");
  assert.equal(row.proposedLine.barLengthM, "");
  assert.equal(row.proposedLine.weightKgM, "");
  for (const code of ["missing_standard", "missing_grade", "missing_bar_length"])
    assert.ok(row.issues.some((issue) => issue.code === code), code);
});

test("RFQAI1 rejects invalid geometry, fractional bars and ambiguous decimal/thousands notation", () => {
  const geometry = normalize({ ...valid(), thicknessMm: 75 });
  assert.equal(geometry.status, "invalid");
  assert.equal(geometry.proposedLine.weightKgM, "");
  assert.ok(geometry.issues.some((i) => i.code === "invalid_geometry"));
  const bars = normalize({ ...valid(), quantity: "2.5" });
  assert.equal(bars.status, "invalid");
  assert.ok(bars.issues.some((i) => i.code === "invalid_quantity"));
  const ambiguous = normalize({ ...valid(), quantity: "1.000" });
  assert.equal(ambiguous.proposedLine.quantity, "");
  assert.ok(ambiguous.issues.some((i) => i.code === "invalid_quantity"));
});

test("RFQAI1 preserves meters and tonnes modes and refuses unsupported packs", () => {
  const meters = normalize({ ...valid(), quantity: 120, quantityUnit: "MT", lengthMm: null });
  const tonnes = normalize({ ...valid(), quantity: "0,5", quantityUnit: "TON", lengthMm: null });
  assert.equal(meters.proposedLine.quantityMode, "meters");
  assert.equal(meters.proposedLine.quantity, "120");
  assert.equal(buyer.calculateBuyerDistintaLine(meters.proposedLine).meters, 120);
  assert.equal(tonnes.proposedLine.quantityMode, "tonnes");
  assert.equal(buyer.calculateBuyerDistintaLine(tonnes.proposedLine).tonnes, 0.5);
  const packs = normalize({ ...valid(), quantity: 3, quantityUnit: "PACCHI" });
  assert.equal(packs.status, "needs_review");
  assert.equal(packs.proposedLine.quantity, "");
  assert.ok(packs.issues.some((issue) => issue.code === "unsupported_quantity_unit"));
});

test("RFQAI1 refuses clean supplier quotes / orders even with complete geometry", () => {
  const quote = normalize({ ...valid(), itemRole: "offered" }, {intent: "supplier_quote"});
  assert.equal(quote.status, "needs_review");
  assert.ok(quote.issues.some((x) => x.code === "untrusted_document_intent"));
  assert.ok(quote.issues.some((x) => x.code === "untrusted_item_role"));
  assert.equal(quote.approvalState, "pending_human_review");
});

test("RFQAI1 protects source pointers and limits size / duplicate IDs", () => {
  const unsupported = normalize(valid(), {source: {...sourceRef, sourceId: "../tenant-2"}});
  assert.equal(unsupported.status, "invalid");
  assert.ok(unsupported.issues.some((x) => x.code === "invalid_source"));
  const row = {candidateId:"v4-1",locator,raw:valid()};
  assert.throws(() => engine.makeRfqAiIntakeBatch(sourceRef,"buyer_request",[row,row]), /Duplicate/);
  assert.throws(() => engine.makeRfqAiIntakeBatch(sourceRef,"buyer_request",
    Array.from({length:501}, (_, index) => ({...row,candidateId:"v4-"+index}))), /500-line/);
});

test("RFQAI1 parser v4 adapter uses real observation fields, never infers buyer target from offers", () => {
  const observations = [{
    source_text:"Tubo quadro 100x100x5, 30 pezzi 12m",
    width_mm:100,height_mm:100,thickness_mm:5,
    standard:"EN 10219",grade:"S355J2H",quantity:30,quantity_unit:"PZ",
    length_mm:12000,item_role:"requested",confidence:0.98,
    price_value: 935,price_unit:"T",
    metadata:{parser_contract_version:"v4",validation:{status:"valid"}},
  }];
  const batch = adapter.makeRfqAiBatchFromParserV4(sourceRef,"buyer_request",observations);
  assert.equal(batch.candidates.length, 1);
  assert.equal(batch.candidates[0].status, "ready_for_review");
  assert.equal(batch.candidates[0].proposedLine.targetEurT, "");
  assert.equal(batch.candidates[0].locator.kind, "extracted_observation");
  assert.equal(batch.candidates[0].locator.observationIndex, 1);
  const withLocator = adapter.makeRfqAiBatchFromParserV4(
    sourceRef,"buyer_request",observations,[locator]);
  assert.deepEqual(withLocator.candidates[0].locator, locator);
  assert.equal(withLocator.candidates[0].evidence.grade.rawValue,"S355J2H");
  const old = adapter.makeRfqAiBatchFromParserV4(sourceRef,"buyer_request",[
    {...observations[0],metadata:{parser_contract_version:"v3.1"}}]);
  assert.equal(old.candidates[0].status,"needs_review");
  const invalid = adapter.makeRfqAiBatchFromParserV4(sourceRef,"buyer_request",[
    {...observations[0],metadata:{parser_contract_version:"v4",validation:{status:"invalid"}}}]);
  assert.equal(invalid.candidates[0].status,"invalid");
});

test("RFQAI1 is an inert domain contract: no writes, mailbox, permissions, or UI changes", () => {
  assert.match(audit, /ParserV31Adapter.*alias|alias.*ParserV4Adapter/);
  assert.match(audit, /No auth policy, server action, Supabase migration/);
  assert.doesNotMatch(source + adapterSource, /\b(createClient|service_role|fetch\(|sendBuyerDistinta|createBuyerRfqCampaign|saveBuyerDistinta\()/);
  assert.match(source, /approvalState: "pending_human_review"/);
  assert.match(adapterSource, /price_value \/ price_unit must never/);
  assert.match(audit, /RFQAI1\.4/);
});
