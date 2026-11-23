import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const sheet = read("../components/distinta-sheet.tsx");
const entry = read("../components/commercial-ai-companion.tsx");

// DISTINTA-SMART1: approved rows are edited in place in the Distinta (no drawer,
// no mobile tabs: the screen is a single column).
test("COMM-RFQ-UX2.C / DISTINTA-SMART1 each approved line is edited in place", () => {
  assert.match(sheet, /aria-expanded=\{open\} aria-controls=\{detailsId\}/);
  assert.match(sheet, /const open = openRows\[line\.id\] \?\? !calc\.complete;/);
  assert.match(sheet, /id=\{"buyer-quantity-" \+ line\.id\}/);
  assert.match(sheet, /onChangeStandard\(line\.id, event\.target\.value\)/);
  assert.match(sheet, /aria-label=\{"Rimuovi riga " \+ \(index \+ 1\)\}/);
  assert.match(builder, /onChangeStandard=\{changeLineStandard\}/);
  assert.match(builder, /onRemove=\{removeLine\}/);
  // An incomplete row is reached by focus, not by opening a cart.
  assert.match(builder, /DISTINTA-SMART1: incomplete rows are already open in the Distinta; no drawer\./);
  assert.doesNotMatch(sheet, /setLines\(|saveBuyerDistinta\(|createBuyerRfqCampaign/);
});

test("COMM-RFQ-UX2.C saves ONLY verified rows and never dispatches suppliers", () => {
  assert.match(sheet, /const allComplete = calculated\.length > 0 && calculated\.every\(\(line\) => line\.complete\);/);
  assert.match(sheet, /disabled=\{busy \|\| !allComplete\}/);
  assert.match(builder, /if \(!authenticated \|\| !draftReady \|\| restoreCandidate \|\| !allComplete\) \{/);
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.match(sheet, /righe da completare/);
  assert.match(sheet, /l’invio parte solo dopo la tua conferma/);
  assert.doesNotMatch(sheet, /sendBuyerDistinta|sendDistinta|sendEmail\(/);
});

test("COMM-RFQ-UX2.C keeps home entry disabled until React hydration to avoid dropped mobile text", () => {
  assert.match(entry, /const \[ready, setReady\] = useState\(false\)/);
  assert.match(entry, /useEffect\(\(\) => setReady\(true\), \[\]\)/);
  assert.match(entry, /value=\{request\} disabled=\{!ready\}/);
  assert.match(entry, /disabled=\{!ready \|\| !request\.trim\(\)\}/);
  assert.match(entry, /if \(!canWrite \|\| !ready \|\| !value\) return/);
});

test("COMM-RFQ-UX2.C changed components parse as TSX", () => {
  for (const [name, source] of [
    ["distinta-sheet.tsx", sheet],
    ["buyer-distinta-builder.tsx", builder], ["commercial-ai-companion.tsx", entry]
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
