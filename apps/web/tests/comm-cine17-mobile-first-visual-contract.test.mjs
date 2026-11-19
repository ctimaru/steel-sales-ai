import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");
// COMM-DEALS1: the retired COMM-UX1 Chrome suite is replaced by COMM-UX6.B on the deal list.
const chrome = readFileSync(new URL("./comm-ux6b-chrome-acceptance.mjs", import.meta.url), "utf8");
const legacy = readFileSync(new URL("./demotest23-chrome-auth.mjs", import.meta.url), "utf8");

test("COMM-UX6.A reduces the industrial hero and keeps AI accessible on small screens", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.heroTitle \{ font-size: clamp\(1\.25rem, 5vw, 1\.5rem\)/);
  assert.doesNotMatch(page, /lg:min-h-\[328px\]/);
  assert.match(ai, /rows=\{3\}/);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
  assert.ok(page.indexOf("comm-cine1-hero") < page.indexOf("comm-cine13-first-workspace"));
  assert.ok(page.indexOf("comm-cine13-first-workspace") < page.indexOf("commercial-primary-quick-actions"));
  assert.ok(page.indexOf("commercial-primary-quick-actions") < page.indexOf("<CommercialUnifiedWorklist"));
});

test("COMM-CINE17 authenticated Chrome evidence covers the owner, viewer and mobile widths", () => {
  assert.match(chrome, /async function inspectViewer\(page, width\)/);
  assert.match(chrome, /"worklist-" \+ persona\.id \+ "-" \+ width \+ "px\.png"/);
  // COMM-CLIENTS1: purchase deal details moved to Centro RFQ; no deal-detail capture on /commercial.
  assert.match(chrome, /getByTestId\("comm-cine11-prompt"\)/);
  assert.match(legacy, /name: "Richieste d'offerta", exact: true, level: 1/);
  assert.doesNotMatch(legacy, /name: "Le mie trattative"/);
});
