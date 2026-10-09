import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const chooser = read("../components/rfq-ai-intake-ux.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const publicPage = read("../app/(public)/distinta/page.tsx");
const privatePage = read("../app/(workspace)/rfq-hub/distinta/page.tsx");
const css = read("../app/globals.css");
const documentation = read("../../../docs/architecture/rfqai2-unified-intake-ux.md");
const save = read("../app/(public)/distinta/actions.ts");

test("RFQAI2 offers four distinct selectable creation modes around one editor", () => {
  assert.match(chooser, /export type RfqAiIntakeMode = "manual" \| "text" \| "file" \| "email"/);
  for (const mode of ['"manual"', '"text"', '"file"', '"email"']) {
    assert.ok(chooser.includes("mode: " + mode), "Missing mode " + mode);
  }
  for (const label of ["Configura", "Scrivi o incolla", "Carica file", "Email"])
    assert.ok(chooser.includes(label), "Missing mode " + label);
  assert.match(chooser, /onClick=\{\(\) => onModeChange\(option.mode\)\}/);
  assert.match(chooser, /aria-pressed=\{mode === option.mode\}/);
  assert.match(chooser, /role="group" aria-label="Scegli la modalità di inserimento"/);
  assert.match(chooser, /aria-controls=\{panelId\}/);
  assert.match(chooser, /<div id=\{panelId\} className="rfqai2-mode-panel">/);
});

test("RFQAI2 reuses BD10 wizard and keeps preview in exactly one place", () => {
  assert.match(builder, /const \[intakeMode, setIntakeMode\] = useState<RfqAiIntakeMode>\("manual"\)/);
  assert.match(builder, /<RfqAiIntakeUx[\s\S]*?mode=\{intakeMode\}[\s\S]*?onModeChange=\{setIntakeMode\}/);
  assert.match(builder, /workspace=\{workspace\}/);
  assert.match(builder, /authenticated=\{authenticated\}/);
  const workbench = builder.indexOf('className="bd7-workbench-editor"');
  const chooserStart = builder.indexOf("<RfqAiIntakeUx", workbench);
  const wizardStart = builder.indexOf("<BuyerTubeGuidedCreator", workbench);
  const chooserEnd = builder.indexOf("</RfqAiIntakeUx>", chooserStart);
  const previewStart = builder.indexOf('className="bd7-preview"', chooserEnd);
  assert.ok(workbench < chooserStart && chooserStart < wizardStart && wizardStart < chooserEnd && chooserEnd < previewStart);
  assert.match(chooser, /<div className="rfqai2-manual" hidden=\{mode !== "manual"\}>/);
  assert.match(builder, /className="bd10-preview-lines"/);
  assert.equal((builder.match(/className="bd5-row-card bd10-preview-row"/g) ?? []).length, 1);
  assert.match(builder, /setIntakeMode\\("manual"\\)/);
  assert.match(chooser, /id="rfqai2-intake-modes"/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
});

test("RFQAI2 private inputs are never reachable by public or unapproved workspaces", () => {
  assert.match(publicPage, /<BuyerDistintaBuilder/);
  assert.doesNotMatch(publicPage, /\bworkspace\s*(?:\/>|\n)/);
  assert.match(privatePage, /requireWorkspaceWriteRole\(appRoutes\.rfqHub\.home\)/);
  assert.match(privatePage, /<BuyerDistintaBuilder[\s\S]*?workspace\s/);
  assert.match(chooser, /mode !== "manual" && !workspace/);
  assert.match(chooser, /mode === "text" && workspace/);
  assert.match(chooser, /mode === "file" && workspace/);
  assert.match(chooser, /mode === "email" && workspace/);
  assert.match(chooser, /authenticated \? \(/);
  assert.match(chooser, /href="\/register"/);
  assert.match(chooser, /href="\/login\?next=%2Frfq-hub%2Fdistinta"/);
  assert.match(chooser, /href=\{appRoutes\.rfqHub\.createDistinta\}/);
  assert.match(chooser, /L’accesso all’AI richiederà un’azienda attiva/);
});

test("RFQAI2 text staging is bounded and cannot claim conversion, persistence or upload", () => {
  assert.match(chooser, /const MAX_TEXT_CHARS = 12_000/);
  assert.match(chooser, /const \[textDraft, setTextDraft\] = useState\(""/);
  assert.match(chooser, /maxLength=\{MAX_TEXT_CHARS\}/);
  assert.match(chooser, /value=\{textDraft\}/);
  assert.match(chooser, /onChange=\{\(event\) => setTextDraft\(event.target.value\)\}/);
  assert.ok(chooser.includes('setTextDraft("")'));
  assert.match(chooser, /Trasforma in distinta con AI · RFQAI3/);
  assert.match(chooser, /disabled className="rfqai2-disabled-action"/);
  assert.match(chooser, /Il testo rimane solo in memoria/);
  assert.doesNotMatch(chooser, /sessionStorage|localStorage|navigator\.clipboard|FileReader|FormData|fetch\(|\.upload\(|\.rpc\(|\.from\(/);
});

test("RFQAI2 file staging checks extension and size but never reads or transmits content", () => {
  assert.match(chooser, /const MAX_FILE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(chooser, /const ALLOWED_EXTENSIONS = \["\.xlsx", "\.xls", "\.pdf", "\.eml"\]/);
  assert.match(chooser, /type="file"/);
  assert.match(chooser, /accept="\.xlsx,\.xls,\.pdf,\.eml"/);
  assert.match(chooser, /onChange=\{chooseFile\}/);
  assert.match(chooser, /file\.size === 0 \|\| file\.size > MAX_FILE_BYTES/);
  assert.match(chooser, /setSelectedFile\(\{ name: file\.name, bytes: file\.size \}\)/);
  assert.match(chooser, /setFileInputKey\(\(key\) => key \+ 1\)/);
  assert.match(chooser, /Estrai articoli dal file · RFQAI4–5/);
  assert.match(chooser, /Il file non viene caricato sul server/);
  assert.doesNotMatch(chooser, /\.arrayBuffer\(|\.text\(|\.stream\(|FileReader|FormData|fetch\(/);
});

test("RFQAI2 preserves export/authorization contracts, mobile usability and no false AI status", () => {
  assert.match(save, /export async function saveBuyerDistinta/);
  assert.match(save, /await supabase\.auth\.getUser\(\)/);
  assert.match(save, /export async function createBuyerRfqCampaign/);
  assert.match(css, /\/\* RFQAI2/);
  assert.match(css, /\.rfqai2-mode-grid \{/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /font-size: 16px/);
  assert.match(css, /\.rfqai2-manual\[hidden\]/);
  assert.match(documentation, /No AI, upload, webhook or parser execution/);
  assert.match(chooser, /Nessuna casella è collegata/);
});
