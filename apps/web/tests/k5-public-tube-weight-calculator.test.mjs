import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(
  new URL("../lib/public-knowledge.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260928133000_k5_public_tube_weight_calculator.sql", import.meta.url),
  "utf8",
);

test("K5 turns the public tube page into an indexable calculator landing page", () => {
  assert.match(page, /Calcolo peso tubo acciaio/);
  assert.match(page, /PublicTubeWeightCalculator/);
  assert.match(page, /Come si calcola il peso di un tubo in acciaio/);
  assert.match(page, /WebApplication/);
  assert.match(page, /TechArticle/);
  assert.match(page, /FAQPage/);
  assert.match(page, /canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
});

test("K5 calculator supports round, square and rectangular geometry", () => {
  assert.match(calculator, /round_tube/);
  assert.match(calculator, /square_tube/);
  assert.match(calculator, /rectangular_tube/);
  assert.match(calculator, /Math\.PI \* t \* \(d - t\)/);
  assert.match(calculator, /b \* b - \(b - 2 \* t\) \* \(b - 2 \* t\)/);
  assert.match(calculator, /b \* h - \(b - 2 \* t\) \* \(h - 2 \* t\)/);
  assert.match(calculator, /areaMm2 \* rho/);
});

test("K5 calculator produces commercial-friendly mass outputs without turning estimates into references", () => {
  assert.match(calculator, /Peso al metro/);
  assert.match(calculator, /Peso per barra/);
  assert.match(calculator, /Peso totale/);
  assert.match(calculator, /totalKg \/ 1000/);
  assert.match(calculator, /Nessun peso pubblicato per questa geometria/);
  assert.match(calculator, /Non viene trasformato in un riferimento normativo\s+o in un peso verificato/);
  assert.match(calculator, /Riferimento tecnico trovato/);
});

test("K5 keeps canonical published weights distinct and exposes source links", () => {
  assert.match(calculator, /exactReference/);
  assert.match(calculator, /weight_method === "published"/);
  assert.match(calculator, /Scostamento rispetto al calcolo geometrico/);
  assert.match(calculator, /source_provider/);
  assert.match(calculator, /source_url/);
  assert.match(calculator, /Dimensioni di riferimento/);
});

test("K5 public data comes only through the anonymous-safe RPC", () => {
  assert.match(data, /PublicTubeWeightReference/);
  assert.match(data, /k5_public_tube_weight_references/);
  assert.match(migration, /security definer/);
  assert.match(migration, /grant execute.*anon/s);
  assert.doesNotMatch(page + calculator, /steel_geometries|steel_weight_references|knowledge_sources|service_role/);
});
