import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const dense = read("../components/dense-ui.tsx");
const globals = read("../app/globals.css");
const profile = read("../app/(workspace)/network/manage/page.tsx");
const registration = read("../app/(platform)/platform/registrations/[id]/page.tsx");
const people = read("../app/(platform)/platform/people/page.tsx");
const marketplace = read("../app/(workspace)/marketplace/[id]/page.tsx");
const sources = read("../app/(workspace)/data-sources/page.tsx");
const product = read("../app/(workspace)/products/[productId]/page.tsx");

test("UXF2 defines shared progressive disclosure, stat and table primitives", () => {
  assert.match(dense, /export function DenseDisclosure/);
  assert.match(dense, /export function DenseStatStrip/);
  assert.match(dense, /export function DenseTableFrame/);
  assert.match(dense, /export function DenseActionBar/);
  assert.match(globals, /UXF2 — dense pages & forms/);
  assert.match(globals, /uxf2-table-frame table th/);
});

test("UXF2 turns Network Profile Manager into a progressive editor without removing governed sections", () => {
  assert.match(profile, /uxf2-dense-page/);
  for (const label of [
    "Tipologia e posizionamento",
    "Prodotti e relazione commerciale",
    "Sedi, stabilimenti e capability",
    "Mercati e settori serviti",
    "Certificazioni",
    "Contatti pubblici",
    "Inquiry",
  ]) {
    assert.match(profile, new RegExp(label));
  }
  assert.ok((profile.match(/<DenseDisclosure/g) || []).length >= 7);
  assert.match(profile, /Company Profile Manager · P3\.7B/);
});

test("UXF2 keeps registration decision primary and makes audit/secondary correction progressive", () => {
  assert.match(registration, /title="Timeline audit"/);
  assert.match(registration, /title="Richiedi integrazione"/);
  assert.match(registration, /Approva e attiva/);
  assert.match(registration, /HP6 · Fast path/);
});

test("UXF2 compacts governance metrics while preserving staff workflows", () => {
  assert.match(people, /DenseStatStrip/);
  assert.match(people, /title="Role template disponibili"/);
  assert.match(people, /Invita Platform Staff/);
  assert.match(people, /Platform Staff/);
});

test("UXF2 progressively discloses Marketplace configuration and irreversible actions", () => {
  assert.match(marketplace, /title="Impostazioni e pubblicazione"/);
  assert.match(marketplace, /title="Aggiungi una linea prodotto"/);
  assert.match(marketplace, /title="Ritira ricerca"/);
  assert.match(marketplace, /Linee prodotto/);
  assert.match(marketplace, /DenseStatStrip/);
});

test("UXF2 keeps data-source history visible but moves optional controls behind disclosure", () => {
  assert.match(sources, /DenseStatStrip/);
  assert.match(sources, /title="Fonti collegate"/);
  assert.match(sources, /title="Filtri"/);
  assert.match(sources, /DenseTableFrame/);
  assert.match(sources, /Storico importazioni/);
});

test("UXF2 reduces Product 360 card density without hiding the killer use case", () => {
  assert.match(product, /DenseStatStrip/);
  assert.match(product, /DenseTableFrame/);
  assert.match(product, /title="Fonti e controparti"/);
  for (const label of ["Ultimo prezzo", "Storico prezzi", "Timeline commerciale", "Documenti sorgente", "Clienti / fornitori collegati"]) {
    assert.match(product, new RegExp(label));
  }
});
