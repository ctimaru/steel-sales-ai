import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);
const distinta = fs.readFileSync(
  new URL("../components/price-list-distinta.tsx", import.meta.url),
  "utf8",
);
const versionPage = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/page.tsx", import.meta.url),
  "utf8",
);
const catalogPage = fs.readFileSync(
  new URL("../app/(public)/listini/page.tsx", import.meta.url),
  "utf8",
);
const historyPage = fs.readFileSync(
  new URL("../app/(public)/listini/storico/page.tsx", import.meta.url),
  "utf8",
);
const historyDetail = fs.readFileSync(
  new URL("../app/(public)/listini/storico/[sessionId]/page.tsx", import.meta.url),
  "utf8",
);
const savedActions = fs.readFileSync(
  new URL("../components/saved-pricing-session-actions.tsx", import.meta.url),
  "utf8",
);

test("PL1.12 collapses dense price-list controls on small screens without hiding desktop controls", () => {
  assert.match(explorer, /mobileControlsOpen/);
  assert.match(explorer, /aria-controls="mobile-listini-controls"/);
  assert.match(explorer, /Filtri e prezzo/);
  assert.match(explorer, /hidden lg:block/);
  assert.match(explorer, /lg:sticky lg:top-0/);
  assert.doesNotMatch(explorer, /className="sticky top-0 z-20/);
});

test("PL1.12 mobile Distinta is a modal drawer with scroll lock, Escape close and safe-area spacing", () => {
  assert.match(explorer, /role="dialog"/);
  assert.match(explorer, /aria-modal="true"/);
  assert.match(explorer, /document\.body\.style\.overflow = "hidden"/);
  assert.match(explorer, /event\.key === "Escape"/);
  assert.match(explorer, /env\(safe-area-inset-bottom\)/);
  assert.match(explorer, /distinta\.length > 0/);
});

test("PL1.12 Distinta keeps header/footer visible while line content scrolls", () => {
  assert.match(distinta, /max-h-\[88dvh\] flex-col/);
  assert.match(distinta, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.match(distinta, /shrink-0 border-t/);
  assert.match(distinta, /paddingBottom: "calc\(1rem \+ env\(safe-area-inset-bottom\)\)"/);
});

test("PL1.12 raises core mobile interaction targets to at least 44px", () => {
  assert.match(distinta, /h-11 w-full/);
  assert.match(distinta, /min-h-11 rounded-xl/);
  assert.match(savedActions, /min-h-11 w-full/);
});

test("PL1.12 renders saved Distinta as mobile cards instead of forcing a horizontal table", () => {
  assert.match(historyDetail, /grid gap-3 md:hidden/);
  assert.match(historyDetail, /hidden overflow-hidden[\s\S]*md:block/);
  assert.match(historyDetail, /Totale riga/);
  assert.match(historyPage, /sm:flex-row sm:items-center sm:justify-between/);
});

test("PL1.12 keeps governed internal-preview and indexing boundaries intact", () => {
  assert.match(versionPage, /version\.is_internal_preview/);
  assert.match(versionPage, /index: false, follow: false/);
  assert.match(catalogPage, /params\.preview === "1"/);
  assert.match(catalogPage, /Anteprima interna attiva/);
});
