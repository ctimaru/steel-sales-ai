import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../lib/seo-growth1c2-funnel-model.ts", import.meta.url), "utf8");

test("funnel distinguishes GSC aggregate clicks from all-source GA4 sessions", () => {
  assert.match(source, /Google clicks/);
  assert.match(source, /All-source landing sessions/);
  assert.doesNotMatch(source, /ratio\(sessions, clicks\)/);
});

test("funnel avoids invented conversion rates and returns null on absent data", () => {
  assert.match(source, /denominator > 0/);
  assert.match(source, /rate: null, denominator: null/);
  assert.match(source, /dataset\.events\?\.signup_start/);
});

test("funnel does not claim starts are completed sales or account creation", () => {
  assert.match(source, /RFQ starts/);
  assert.match(source, /Signup starts/);
  assert.doesNotMatch(source, /RFQ completions|Signup completions/);
});
