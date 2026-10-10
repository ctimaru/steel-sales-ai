import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);
const cookies = fs.readFileSync(
  new URL("../app/cookies/page.tsx", import.meta.url),
  "utf8",
);

test("UXF3 uses user-facing Cookie e privacy language instead of analytics jargon", () => {
  assert.match(consent, /Cookie e privacy/);
  assert.match(consent, /Accetta necessari/);
  assert.match(consent, /Accetta/);
  assert.doesNotMatch(consent, /Statistiche del sito/);
  assert.doesNotMatch(consent, /Preferenze statistiche/);
});

test("UXF3 keeps the first-layer consent panel compact and non-blocking", () => {
  assert.match(consent, /max-w-\[560px\]/);
  assert.match(consent, /aria-modal="false"/);
  assert.match(consent, /bottom-\[max\(0\.5rem,env\(safe-area-inset-bottom\)\)\] left-2 right-2/);
  assert.doesNotMatch(consent, /fixed inset-0/);
});

test("UXF3 makes closing the panel equivalent to necessary-only consent", () => {
  assert.match(consent, /aria-label="Continua solo con cookie necessari"/);
  assert.match(consent, /onClick=\{\(\) => choose\("denied"\)\}/);
});

test("UXF3 gives accept and necessary-only choices equivalent control weight", () => {
  const necessary = consent.indexOf(">\n              Accetta necessari\n");
  const accept = consent.indexOf(">\n              Accetta\n");
  assert.ok(necessary >= 0 && accept >= 0);
  assert.match(consent, /grid grid-cols-2 gap-2/);
  assert.ok((consent.match(/min-h-11 rounded-xl border/g) || []).length >= 2);
  assert.match(consent, /sm:hidden/);
  assert.match(consent, /sm:block/);
});

test("UXF3 retracts consent UI into a small corner privacy tab after choice", () => {
  assert.match(consent, /rounded-r-full/);
  assert.match(consent, /bottom-4 left-0/);
  assert.match(consent, /<PrivacyShield \/>/);
  assert.match(consent, /<span>Privacy<\/span>/);
  assert.match(consent, /setSettingsOpen\(true\)/);
  assert.match(cookies, /linguetta “Privacy”/);
});
