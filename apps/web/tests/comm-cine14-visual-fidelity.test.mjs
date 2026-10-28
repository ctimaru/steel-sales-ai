import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const worklist = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");

test("COMM-CINE14 uses existing local industrial posters for both desktop and mobile", () => {
  assert.ok(existsSync(new URL("../public/home-cine2a2b-factory-desktop.webp", import.meta.url)));
  assert.ok(existsSync(new URL("../public/home-cine2a2b-factory-mobile.webp", import.meta.url)));
  assert.match(styles, /url\("\/home-cine2a2b-factory-desktop\.webp"\)/);
  assert.match(styles, /url\("\/home-cine2a2b-factory-mobile\.webp"\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(styles, /https?:\/\//);
  assert.match(page, /cinematic\.hero/);
  assert.match(page, /cinematic\.heroGrid/);
  assert.match(page, /cinematic\.heroTitle/);
  assert.match(page, /cinematic\.heroMetrics/);
  assert.doesNotMatch(page, /cinematic\.heroPanel/);
  assert.match(page, /operational\.rfqs/);
  assert.match(page, /operational\.offers/);
  assert.match(page, /operational\.orders/);
});

test("COMM-CINE14 standardizes real workspace surfaces without adding sections or changing permissions", () => {
  assert.match(ai, /cinematic\.companion/);
  assert.match(ai, /cinematic\.companionForm/);
  assert.match(worklist, /cinematic\.worklist/);
  assert.match(styles, /background-image:/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(page, /canWriteWorkspace\(context\.role\)/);
  assert.match(page, /<CommercialAiCompanion canWrite=\{canWrite\}/);
  assert.equal((page.match(/<CommercialAiCompanion/g) ?? []).length, 1);
  assert.equal((page.match(/<CommercialUnifiedWorklist/g) ?? []).length, 1);
  assert.equal((page.match(/<CommercialCalculatorQuickAccess/g) ?? []).length, 1);
  assert.match(page, /non condividono automaticamente prezzi, contatti o documenti/);
});
