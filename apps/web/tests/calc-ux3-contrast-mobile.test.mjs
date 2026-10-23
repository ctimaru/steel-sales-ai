import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const denseStyles = read("../components/calculator-dense-cockpit.module.css");
const styles = read("../app/globals.css");
const install = read("../components/calculator-install-guide.tsx");
const italian = read("../app/(public)/knowledge/tubes/page.tsx");
const english = read("../app/en/knowledge/tubes/page.tsx");

function lum(hex) {
  return [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + [0.2126, 0.7152, 0.0722][i] * v, 0);
}
function ratio(a, b) {
  const [low, high] = [lum(a), lum(b)].sort((x, y) => x - y);
  return (high + 0.05) / (low + 0.05);
}
function tintWhite(alpha, hex) {
  return "#" + [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(255 * alpha + channel * (1 - alpha)).toString(16).padStart(2, "0");
  }).join("");
}

test("CALC-UX3 selected, muted and result text pass WCAG AA at 4.5:1", () => {
  assert.ok(ratio("#52615b", "#ffffff") >= 4.5, "Muted labels on white");
  assert.ok(ratio("#52615b", "#f6f8f7") >= 4.5, "Muted labels on subtle surface");
  assert.ok(ratio("#ffffff", "#173f35") >= 4.5, "Selected tabs");
  assert.ok(ratio("#123b34", "#e3f4eb") >= 4.5, "RFQ bridge button");
  const tile = tintWhite(0.08, "#123d34");
  const tileText = tintWhite(0.85, tile);
  assert.ok(ratio(tileText, tile) >= 4.5, "Small white text on result tile");
  assert.doesNotMatch(calculator, /text-\[#7b8782\]/, "Low contrast helper color must be absent");
  assert.doesNotMatch(install, /text-\[#7b8782\]/);
  assert.match(calculator, /text-white\/85/);
});

test("CALC-UX3 mobile targets, text and result grid are responsive", () => {
  assert.match(calculator, /grid-cols-\[36px_52px_36px\]/);
  assert.match(calculator, /<CalculatorDimensionDiscovery/);
  assert.doesNotMatch(calculator, /group\/assist/);
  assert.match(calculator, /data-cockpit-measurements/);
  assert.match(calculator, /styles\.measurementsRect : styles\.measurements/);
  assert.match(denseStyles, /\.measurements,.measurementsRect/);
  assert.match(calculator, /min-w-0 rounded-lg bg-white\/8 px-2 py-1\.5/);
  assert.match(calculator, /tube-calculator-favourite-selected col-span-2 min-h-11/);
  assert.match(calculator, /tube-calculator-rfq-link mt-1\.5 inline-flex min-h-11/);
  assert.match(calculator, /data-cockpit-header/);
  assert.doesNotMatch(calculator, /mt-1 truncate text-lg/);
  assert.match(calculator, /aria-label=\{t\("Lunghezza barra personalizzata"\)\}/);
  assert.match(calculator, /aria-label=\{t\("Numero barre"\)\}/);
  assert.match(styles, /#calcolatore-pesi :is\(button, a, summary, input\):focus-visible/);
  assert.match(styles, /#calcolatore-pesi \.tube-calculator-result :is\(button, a, summary\):focus-visible/);
});

test("CALC-UX3 shared bilingual calculator keeps RFQ transfer, references and SEO", () => {
  assert.match(italian, /CalculatorRegionSwitch/);
  assert.match(english, /CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.match(calculator, /calculatorRfqFromValues\(currentSnapshot,/);
  assert.match(calculator, /enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
  assert.match(calculator, /window\.location\.assign\(locale === "it" \? "\/distinta" : `\/\$\{locale\}\/distinta`\)/);
  assert.match(calculator, /relatedTubeReferences\(references,/);
  assert.match(calculator, /referenceEvidence\(values\.exactReference\)/);
});
