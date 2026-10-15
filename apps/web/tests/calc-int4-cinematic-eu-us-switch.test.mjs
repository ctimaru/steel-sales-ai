import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const switcher=read("../components/calculator-region-switch.tsx");
const styles=read("../components/calculator-region-switch.module.css");
const it=read("../app/(public)/knowledge/tubes/page.tsx");
const en=read("../app/en/knowledge/tubes/page.tsx");
const itUs=read("../app/(public)/knowledge/tubes/tubi-americani/page.tsx");
const enUs=read("../app/en/knowledge/tubes/american-pipe/page.tsx");
const sitemap=read("../app/sitemap.ts");
const usBridge=read("../lib/us-pipe-rfq-handoff.ts");
const enBridge=read("../lib/calculator-rfq-handoff.ts");

test("CALC-INT4 integrates a single in-page switch in four existing localized pages",()=>{
  for(const p of [it,en]){
    assert.match(p,/CalculatorRegionSwitch locale="(?:it|en)" initialRegion="eu"/);
    assert.match(p,/references=\{references\} initialValues=\{initialValues\}/);
  }
  for(const p of [itUs,enUs]){
    assert.match(p,/CalculatorRegionSwitch locale="(?:it|en)" initialRegion="us" references=\{\[\]\}/);
  }
  assert.match(switcher,/PublicTubeWeightCalculator references=\{references\?\?\[\]\}/);
  assert.match(switcher,/UsPipeSampleCalculator locale=\{locale\} initialValues=\{usInitialValues\}/);
  assert.match(switcher,/euAfter\?: ReactNode/);
});

test("CALC-INT4 retains state after switching, supports both languages and keyboard accessibility",()=>{
  assert.match(switcher,/useState\(\{/);
  assert.match(switcher,/eu: entryRegion === "eu"/);
  assert.match(switcher,/us: entryRegion === "us"/);
  assert.match(switcher,/setVisited\(\(current\) => \(\{ \.\.\.current, \[next\]: true \}\)\)/);
  assert.match(switcher,/role="group"/);
  assert.match(switcher,/aria-pressed=\{region === "eu"\}/);
  assert.match(switcher,/aria-pressed=\{region === "us"\}/);
  assert.match(switcher,/aria-hidden=\{region !== "eu"\} inert=\{region !== "eu"\}/);
  assert.match(switcher,/aria-hidden=\{region !== "us"\} inert=\{region !== "us"\}/);
  assert.match(switcher,/aria-live="polite"/);
  assert.match(switcher,/🇪🇺/);
  assert.match(switcher,/🇺🇸/);
  assert.match(switcher,/EN 10219 \/ 10210/);
  assert.match(switcher,/NPS \/ SCHEDULE/);
  assert.doesNotMatch(switcher,/window\.location\.assign|router\.push|router\.replace|history\.pushState/);
});

test("CALC-INT4 cinematic transition and reduced-motion accessibility remain functional",()=>{
  assert.match(styles,/grid-template-rows: 0fr/);
  assert.match(styles,/grid-template-rows: 1fr/);
  assert.match(styles,/cubic-bezier\(\.22, 1, \.36, 1\)/);
  assert.match(styles,/filter: blur\(5px\)/);
  assert.match(styles,/\.track\[data-region="us"\]::before/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles,/transition: none !important/);
  assert.match(styles,/overflow: hidden/);
});

test("CALC-INT4 preserves independent public canonical URLs and both RFQ handoffs",()=>{
  assert.match(it,/canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(en,/canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(itUs,/canonical: absoluteUrl\(path\)/);
  assert.match(enUs,/canonical: absoluteUrl\(path\)/);
  assert.match(itUs,/languages: \{ it: absoluteUrl\(path\), en: absoluteUrl\(other\) \}/);
  assert.match(enUs,/languages: \{ it: absoluteUrl\(other\), en: absoluteUrl\(path\) \}/);
  for(const path of ["/knowledge/tubes","/en/knowledge/tubes",
    "/knowledge/tubes/tubi-americani","/en/knowledge/tubes/american-pipe"]){
    assert.ok(sitemap.includes(`url: absoluteUrl("${path}")`), `Missing sitemap entry: ${path}`);
  }
  assert.match(it,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(en,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(enBridge,/CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.match(usBridge,/US_PIPE_RFQ_KEY = "sss:us-pipe-rfq-handoff:v2"/);
});
