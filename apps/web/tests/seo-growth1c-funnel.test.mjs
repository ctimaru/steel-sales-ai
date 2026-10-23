import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("GA4 public funnel events require a current explicit consent", () => {
  const source = read("lib/seo-growth1c-ga4-funnel.client.ts");
  assert.match(source, /decision !== "granted"/);
  assert.match(source, /analyticsConsentRecordIsCurrent\(consent\)/);
  assert.match(source, /publicPath\(window\.location\.pathname\)/);
  assert.match(source, /gtag\("event", mappedName, \{ locale, family, standard \}\)/);
  assert.doesNotMatch(source, /gtag\("event", mappedName, properties\)/);
});

test("Existing product events are routed to the consented GA4 bridge", () => {
  const source = read("lib/product-analytics-events.client.ts");
  assert.match(source, /trackConsentedGa4FunnelEvent\(name, properties\)/);
  assert.match(source, /track\(name, properties\)/);
});
