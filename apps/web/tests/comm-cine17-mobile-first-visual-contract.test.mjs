import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("./comm-ux1-chrome-auth.mjs", import.meta.url), "utf8");
const legacy = readFileSync(new URL("./demotest23-chrome-auth.mjs", import.meta.url), "utf8");

test("COMM-UX6.A reduces the industrial hero and keeps AI accessible on small screens", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.heroTitle \{ font-size: clamp\(1\.625rem, 7vw, 1\.95rem\)/);
  assert.match(page, /Richieste, offerte e ordini in un unico spazio\./);
  assert.match(page, /lg:min-h-\[172px\]/);
  assert.doesNotMatch(page, /lg:min-h-\[328px\]/);
  assert.match(page, /lg:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.match(ai, /lg:grid-cols-\[minmax\(0,0\.9fr\)_minmax\(0,1\.1fr\)\]/);
  assert.match(ai, /rows=\{2\}/);
  assert.match(ai, /nessuna richiesta viene inviata automaticamente/);
  assert.ok(page.indexOf("comm-cine1-hero") < page.indexOf("comm-cine13-first-workspace"));
  assert.ok(page.indexOf("comm-cine13-first-workspace") < page.indexOf("commercial-primary-quick-actions"));
  assert.ok(page.indexOf("commercial-primary-quick-actions") < page.indexOf("commercial-worklist"));
});

test("COMM-CINE17 authenticated Chrome evidence covers the owner, viewer and a 320px layout", () => {
  assert.match(chrome, /verifyCinematic\(page, "Commerciale mobile 320px buyer"\)/);
  assert.match(chrome, /commercial-owner-mobile-320\.png/);
  assert.match(chrome, /commercial-owner-deals-desktop\.png/);
  assert.match(chrome, /getByTestId\("comm-cine11-prompt"\)/);
  assert.match(legacy, /name: "Le mie trattative", exact: true/);
  assert.doesNotMatch(legacy, /name: "Richieste, offerte e ordini"/);
});
