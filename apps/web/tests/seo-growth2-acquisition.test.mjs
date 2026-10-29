import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const dimension = readFileSync(new URL("../app/(italian)/(public)/knowledge/tubes/[slug]/page.tsx", import.meta.url), "utf8");

test("SEO-GROWTH2.B: measured Italian size page joins existing title pilot only", () => {
  assert.match(dimension, /"quadro-120x120x5"/);
  assert.match(dimension, /ctrPilotSlugs\.has\(dimension\.dimension_slug\)/);
  assert.match(dimension, /formatNumber\(dimension\.weight_kg_m\) \+ " kg\/m e barre"/);
  assert.match(dimension, /canonical: absoluteUrl\("\/knowledge\/tubes\/" \+ dimension\.dimension_slug\)/);
  assert.match(dimension, /robots: \{ index: false, follow: false \}/);
});

test("SEO-GROWTH2: source page continues to hand off real dimensions to existing calculator", () => {
  assert.match(dimension, /href=\{calculatorHref\(dimension\)\}/);
  for (const token of ['family:', 'thickness:', 'query.set("od"', 'query.set("width"', 'query.set("height"']) {
    assert.ok(dimension.includes(token), token);
  }
});
