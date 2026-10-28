import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/(italian)/(workspace)/commercial/page.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("../components/commercial-ai-companion.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/commercial-cinematic.module.css", import.meta.url), "utf8");
const chrome = readFileSync(new URL("./comm-ux1-chrome-auth.mjs", import.meta.url), "utf8");
const legacy = readFileSync(new URL("./demotest23-chrome-auth.mjs", import.meta.url), "utf8");

test("COMM-CINE17 keeps a photo-first hero but gives mobile users immediate AI access", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.heroTitle \{ font-size: clamp\(1\.75rem, 7\.2vw, 2\.05rem\)/);
  assert.match(page, /Richieste, offerte e ordini in un unico spazio\./);
  assert.match(page, /mt-5 hidden max-w-\[510px\] sm:block/);
  assert.match(page, /sm:min-h-\[290px\]/);
  assert.match(ai, /lg:items-start/);
  assert.ok(page.indexOf("comm-cine1-hero") < page.indexOf("comm-cine13-first-workspace"));
  assert.ok(page.indexOf("comm-cine13-first-workspace") < page.indexOf("commercial-worklist"));
});

test("COMM-CINE17 authenticated Chrome evidence covers the owner, viewer and a 320px layout", () => {
  assert.match(chrome, /verifyCinematic\(page, "Commerciale mobile 320px buyer"\)/);
  assert.match(chrome, /commercial-owner-mobile-320\.png/);
  assert.match(chrome, /commercial-owner-deals-desktop\.png/);
  assert.match(chrome, /getByTestId\("comm-cine11-prompt"\)/);
  assert.match(legacy, /name: "Le mie trattative", exact: true/);
  assert.doesNotMatch(legacy, /name: "Richieste, offerte e ordini"/);
});
