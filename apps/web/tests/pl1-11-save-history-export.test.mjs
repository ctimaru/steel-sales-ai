import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const distinta = fs.readFileSync(
  new URL("../components/price-list-distinta.tsx", import.meta.url),
  "utf8",
);
const exportHelper = fs.readFileSync(
  new URL("../lib/pricing-export.ts", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/actions.ts", import.meta.url),
  "utf8",
);
const history = fs.readFileSync(
  new URL("../app/(public)/listini/storico/page.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(public)/listini/storico/[sessionId]/page.tsx", import.meta.url),
  "utf8",
);
const layout = fs.readFileSync(
  new URL("../app/(public)/listini/layout.tsx", import.meta.url),
  "utf8",
);

test("PL1.11 makes the Distinta directly copyable into commercial email", () => {
  assert.match(distinta, /Copia per email/);
  assert.match(distinta, /ClipboardItem/);
  assert.match(distinta, /"text\/html"/);
  assert.match(distinta, /"text\/plain"/);
  assert.match(exportHelper, /<table/);
  assert.match(exportHelper, /Articolo/);
  assert.match(exportHelper, /Quantità/);
  assert.match(exportHelper, /Valore totale/);
});

test("PL1.11 email copy deliberately excludes private discount mechanics", () => {
  const htmlStart = exportHelper.indexOf("export function buildPricingEmailHtml");
  const csvStart = exportHelper.indexOf("export function buildPricingCsv");
  const emailHtmlSection = exportHelper.slice(htmlStart, csvStart);

  assert.doesNotMatch(emailHtmlSection, /Base €\/m/);
  assert.doesNotMatch(emailHtmlSection, /Extra €\/m/);
  assert.doesNotMatch(emailHtmlSection, /Sconto/);
  assert.match(distinta, /Base, Extra e sconto commerciale restano esclusi/);
});

test("PL1.11 server action recomputes snapshots from governed list data rather than browser prices", () => {
  assert.match(actions, /getPriceListExplorerVersion/);
  assert.match(actions, /getPriceListExplorerItems/);
  assert.match(actions, /calculateDistintaLine/);
  assert.match(actions, /calculateDistintaTotals/);
  assert.match(actions, /solveDiscountForTargetEurT/);
  assert.match(actions, /pl1_effective_discounts_for_version/);
  assert.match(actions, /pl1_create_pricing_session_snapshot/);
  assert.doesNotMatch(actions, /input\.lines\[[^\]]+\]\.netEurM/);
  assert.doesNotMatch(actions, /input\.lines\[[^\]]+\]\.lineTotal/);
});

test("PL1.11 exposes private history and immutable snapshot detail", () => {
  assert.match(history, /Distinte salvate/);
  assert.match(history, /getPricingSessionHistory/);
  assert.match(detail, /Snapshot immutabile/);
  assert.match(detail, /getPricingSessionSnapshot/);
  assert.match(detail, /SavedPricingSessionActions/);
  assert.match(layout, /href="\/listini\/storico"/);
  assert.match(layout, /I miei calcoli/);
});

test("PL1.11 supports CSV export alongside email copy", () => {
  assert.match(distinta, /Scarica CSV/);
  assert.match(distinta, /buildPricingCsv/);
  assert.match(exportHelper, /buildPricingCsv/);
  assert.match(exportHelper, /€\/t medio ponderato/);
});
