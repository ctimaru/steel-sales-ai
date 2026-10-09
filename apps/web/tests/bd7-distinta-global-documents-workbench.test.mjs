import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const guidance = read("../lib/buyer-tube-guidance.ts");
const contract = read("../lib/buyer-distinta.ts");
const documentsSource = read("../lib/buyer-distinta-documents.ts");
const actions = read("../app/(public)/distinta/actions.ts");
const css = read("../app/globals.css");
const migration = read("../../../supabase/migrations/20261008214500_bd7_distinta_global_documents.sql");
const js = ts.transpileModule(documentsSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const docs = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

test("BD7 defaults to commercial 12m bars while leaving units and lengths editable", () => {
  assert.match(builder, /quantityMode: "bars"/);
  assert.match(builder, /barLengthM: "12"/);
  assert.match(builder, /value=\{line\.barLengthM\}/);
  assert.match(builder, /value=\{line\.quantityMode\}/);
  assert.match(builder, /id=\{"buyer-quantity-" \+ line\.id\}/);
});

test("BD7 docs are scoped to the entire request and not duplicated in tube notes", () => {
  assert.doesNotMatch(wizard, /Documentazione richiesta/);
  assert.doesNotMatch(guidance, /inspectionDocument|ceDop|iso9001/);
  assert.match(builder, /formatBuyerDocumentRequirements\(documents\)/);
  assert.match(builder, /Documentazione richiesta · intera distinta/);
  assert.match(builder, /note: ""/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
  assert.match(builder, /buildBuyerDistintaHtml\(title, valid, documents\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(actions, /document_requirements: normalizeBuyerDocumentRequirements\(input\.documents\)/);
  assert.match(actions, /p_buyer_message: formatBuyerDocumentRequirements\(documents\) \|\| null/);
  assert.match(actions, /buildBuyerDistintaPlainText\(title, exportLines, documents\)/);
  assert.match(actions, /buildBuyerDistintaHtml\(title, exportLines, documents\)/);
  assert.match(contract, /formatBuyerDocumentRequirements\(documents\)/);
  assert.match(migration, /document_requirements jsonb not null/);
  assert.match(migration, /insert into public\.buyer_distintas/);
  assert.match(migration, /document_requirements/);
  assert.match(migration, /if v_user_id is null/);
});

test("BD7 documentation formatter normalizes inputs and writes one request-level condition", () => {
  const empty = docs.normalizeBuyerDocumentRequirements(null);
  assert.deepEqual(empty, { inspectionDocument: "", ceDop: false, iso9001: false });
  assert.equal(docs.formatBuyerDocumentRequirements(empty), "");
  const input = docs.normalizeBuyerDocumentRequirements({
    inspectionDocument: "3.1", ceDop: true, iso9001: true, ignored: "unused",
  });
  assert.match(docs.formatBuyerDocumentRequirements(input), /l'intera distinta/);
  assert.match(docs.formatBuyerDocumentRequirements(input), /EN 10204 tipo 3\.1/);
  assert.match(docs.formatBuyerDocumentRequirements(input), /DoP/);
  assert.match(docs.formatBuyerDocumentRequirements(input), /ISO 9001/);
  assert.equal(docs.normalizeBuyerDocumentRequirements({inspectionDocument:"5", ceDop:"true"}).inspectionDocument, "");
  assert.equal(docs.normalizeBuyerDocumentRequirements({inspectionDocument:"5", ceDop:"true"}).ceDop, false);
});

test("BD7 previews the live draft and entered rows in a responsive side-by-side workbench", () => {
  assert.match(builder, /className="bd7-workbench"/);
  assert.match(builder, /className="bd7-workbench-editor"/);
  assert.match(builder, /className="bd7-preview"/);
  assert.match(builder, /aria-label="Distinta in composizione"/);
  assert.match(builder, /onDraftChange=\{setPreviewDraft\}/);
  assert.match(wizard, /onDraftChange\(draft\)/);
  assert.match(builder, /guidedTubeMeasurement\(previewDraft\)/);
  assert.match(builder, /lines\.map\(\(line, index\) => \{/);
  assert.match(builder, /formatNumber\(calc\.tonnes, 3\)/);
  assert.match(builder, /bd7-global-documents/);
  assert.match(css, /\.bd7-workbench \{/);
  assert.match(css, /position: sticky;/);
  assert.match(css, /@media \(max-width: 980px\)/);
  assert.match(css, /\.bd7-preview \{ position: static; \}/);
});
