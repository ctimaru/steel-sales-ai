import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/search/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/search/page.tsx", import.meta.url),
  "utf8",
);
const dashboard = fs.readFileSync(
  new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url),
  "utf8",
);
const component = fs.readFileSync(new URL("../components/global-search.tsx", import.meta.url), "utf8");
const shell = fs.readFileSync(new URL("../components/app-shell.tsx", import.meta.url), "utf8");
const navigation = fs.readFileSync(new URL("../components/workspace-navigation.tsx", import.meta.url), "utf8");
const evidenceRoute = fs.readFileSync(
  new URL("../app/evidence/[observationId]/route.ts", import.meta.url),
  "utf8",
);

test("global search derives actor server-side and calls tenant-safe worker endpoint", () => {
  assert.match(actions, /supabase\.auth\.getClaims\(\)/);
  assert.match(actions, /actor_user_id: actorUserId/);
  assert.match(actions, /\/v1\/global-search/);
  assert.doesNotMatch(actions, /owner_id:/);
  assert.doesNotMatch(actions, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("global search exposes P1.4 result families and steel filters", () => {
  for (const label of ["Documenti", "Prodotti", "Aziende", "RFQ", "Offerte"]) {
    assert.match(component, new RegExp(label));
  }
  for (const field of [
    "company",
    "grade",
    "standard",
    "outer_diameter_mm",
    "thickness_mm",
    "price_min",
    "price_max",
    "source",
    "date_from",
    "date_to",
  ]) {
    assert.match(component, new RegExp(`name=\\"${field}\\"`));
  }
});

test("commercial search is first-class sales navigation", () => {
  assert.match(page, /Cerca nello storico commerciale/);
  assert.match(page, /Trova prodotti, clienti, richieste, offerte, ordini e documenti/);
  assert.match(navigation, /action=\{appRoutes\.commercial\.search\}/);
  assert.match(shell, /label: "Attività"/);
  assert.match(navigation, /action=\{appRoutes\.commercial\.search\}/);
});


test("structured global search opens verified original evidence in one click", () => {
  assert.match(component, /metadata\?\.observation_id/);
  assert.match(component, /\/evidence\/\$\{observationId\}/);
  assert.match(component, /Apri originale/);
  assert.match(evidenceRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(evidenceRoute, /\/v1\/evidence\//);
  assert.match(evidenceRoute, /WORKER_INTERNAL_TOKEN/);
  assert.doesNotMatch(evidenceRoute, /SUPABASE_SERVICE_ROLE_KEY/);
});


test("sales navigation uses stable macros with contextual tools and avatar drawer", () => {
  for (const label of ["Home", "Commerciale", "Network", "Marketplace", "Scuola"]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(shell, /WorkspaceContextNavigation/);
  assert.match(shell, /WorkspaceProfileMenu/);
  for (const label of ["Norme", "Gradi", "Calcolo pesi", "Dati e fonti"]) {
    assert.match(shell + navigation, new RegExp(label));
  }
  assert.match(shell, /label: "Analisi"/);
  assert.doesNotMatch(navigation, /label="Importa documenti"/);
  assert.doesNotMatch(navigation, /label="Revisioni dati"/);
});


test("Home is a daily operational cockpit while Search owns the dedicated search workspace", () => {
  assert.match(dashboard, /Oggi in/);
  assert.match(dashboard, /Cosa richiede attenzione/);
  assert.match(dashboard, /href=\{appRoutes\.commercial\.search\}/);
  assert.match(dashboard, /Cerca nello storico/);
  assert.match(dashboard, /Azioni rapide/);
  assert.doesNotMatch(dashboard, /action=\{appRoutes\.commercial\.search\}/);
  assert.doesNotMatch(dashboard, /name="q"/);
  assert.doesNotMatch(dashboard, /<GlobalSearch/);
  assert.match(page, /searchParams/);
  assert.match(page, /initialQuery/);
  assert.match(page, /initialQuery=\{initialQuery\} scope=\{scope\}/);
  assert.match(page, /commercialSearchScopes/);
  assert.match(page, /operationalSearchHref/);
  assert.match(component, /initialQuery = ""/);
  assert.match(component, /useState\(initialQuery\)/);
});


test("Home shows buyer RFQ actions, not technical extraction corrections", () => {
  const attention = dashboard.slice(
    dashboard.indexOf("const attentionItems = ["),
    dashboard.indexOf("const attentionCount =")
  );
  assert.match(attention, /procurementActions\.map/);
  assert.match(attention, /appRoutes\.commercial\.home \+ "\?view=sent&item=campaign:" \+ item\.rfq_id!/);
  assert.doesNotMatch(attention, /appRoutes\.rfqHub\.campaign/);
  assert.doesNotMatch(attention, /metrics\.reviewFlags|appRoutes\.operations\.review|Elementi da verificare/);
});


test("sales surfaces avoid infrastructure terminology", () => {
  for (const forbidden of [
    "Structured + semantic",
    "Semantic index:",
    "Reference match",
    "Evidence preservata",
    "provenance",
    "review queue",
    "prodotto canonico",
  ]) {
    assert.doesNotMatch(component + dashboard, new RegExp(forbidden));
  }
  assert.match(component, /Risultati disponibili nella tua memoria privata/);
  assert.match(component, /Riferimento alla fonte/);
  assert.match(component, /Riferimento verificato/);
  assert.match(component, /Anteprima dei risultati/);
  assert.doesNotMatch(component, /Rilevanza \\{Number/);
  assert.match(dashboard, /movimenti commerciali/i);
  assert.match(dashboard, /Cosa richiede attenzione/);
});


test("optional search geometry is formatted only when numeric", () => {
  assert.match(component, /typeof value !== "number" \|\| !Number\.isFinite\(value\)/);
  for (const field of ["outer_diameter_mm", "width_mm", "height_mm", "thickness_mm", "length_mm"]) {
    assert.match(component, new RegExp("formatNumber\\(result\\." + field + "\\)"));
  }
  for (const fact of ["diameter", "width", "height", "thickness", "length"]) {
    assert.match(component, new RegExp(fact + " !== null"));
  }
  assert.doesNotMatch(component, /outer_diameter_mm !== null \? /);
  assert.doesNotMatch(component, /thickness_mm !== null \? /);
  assert.doesNotMatch(component, /length_mm !== null \? /);
});
