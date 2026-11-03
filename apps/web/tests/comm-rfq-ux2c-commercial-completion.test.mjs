import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const preview = read("../components/commercial-rfq-live-preview.tsx");
const workspace = read("../components/commercial-rfq-workspace.tsx");

test("COMM-RFQ-UX2.C preview edits a particular approved line using the canonical cart", () => {
  assert.match(preview, /onEditLine: \(lineId: string\) => void/);
  assert.match(preview, /onClick=\{\(\) => onEditLine\(line\.id\)\}/);
  assert.match(preview, /aria-label=\{"Modifica articolo " \+ \(i \+ 1\)\}/);
  assert.match(builder, /onEditLine=\{editApprovedLine\}/);
  assert.match(builder, /function editApprovedLine\(lineId: string\)/);
  assert.match(builder, /setEditingRows\(\(previous\) => \(\{ \.\.\.previous, \[lineId\]: true \}\)\)/);
  assert.match(builder, /pendingCartRowRef\.current = lineId/);
  assert.match(builder, /document\.getElementById\("buyer-row-" \+ lineId\)/);
  assert.match(builder, /<TechnicalCartShell/);
  assert.doesNotMatch(preview, /setLines\(|saveBuyerDistinta\(/);
});

test("COMM-RFQ-UX2.C mobile tablist follows keyboard and roving focus semantics", () => {
  assert.match(workspace, /onMobileTabKeyDown\(event: KeyboardEvent<HTMLDivElement>\)/);
  assert.match(workspace, /"ArrowLeft", "ArrowRight", "Home", "End"/);
  assert.match(workspace, /onKeyDown=\{onMobileTabKeyDown\}/);
  assert.match(workspace, /chatTab\.current\?\.focus\(\)/);
  assert.match(workspace, /previewTab\.current\?\.focus\(\)/);
  assert.match(workspace, /tabIndex=\{mobileView === "chat" \? 0 : -1\}/);
  assert.match(workspace, /tabIndex=\{mobileView === "preview" \? 0 : -1\}/);
  assert.match(workspace, /aria-controls=\{chatId\}/);
  assert.match(workspace, /aria-controls=\{previewId\}/);
});

test("COMM-RFQ-UX2.C saves ONLY verified rows and never dispatches suppliers", () => {
  assert.match(preview, /const calculated = approvedLines\.map\(calculateBuyerDistintaLine\)/);
  assert.match(preview, /const candidates = proposals\?\.candidates \?\? \[\]/);
  assert.match(preview, /const canSave = ready && allComplete && !savePending && !rfqPending/);
  assert.match(preview, /disabled=\{!canSave \|\| Boolean\(savedId\)\}/);
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.match(preview, /I totali sono parziali/);
  assert.match(preview, /non invia messaggi ai fornitori/);
  assert.doesNotMatch(preview, /sendBuyerDistinta|sendDistinta|sendEmail\(/);
});

test("COMM-RFQ-UX2.C changed components parse as TSX", () => {
  for (const [name, source] of [
    ["commercial-rfq-workspace.tsx", workspace],
    ["commercial-rfq-live-preview.tsx", preview],
    ["buyer-distinta-builder.tsx", builder]
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
