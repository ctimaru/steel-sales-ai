import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const globals = read("../app/globals.css");
const appShell = read("../components/app-shell.tsx");
const platformShell = read("../components/platform-shell.tsx");
const publicKnowledgeLayout = read("../app/(public)/knowledge/layout.tsx");
const workspaceNavigation = read("../components/workspace-navigation.tsx");
const confirmSubmit = read("../components/confirm-submit-button.tsx");
const registration = read("../app/register/registration-form.tsx");
const login = read("../app/login/page.tsx");
const globalSearch = read("../components/global-search.tsx");
const marketplace = read("../app/(workspace)/marketplace/page.tsx");
const network = read("../app/(workspace)/network/page.tsx");

const forestNeutralFiles = [
  "../app/(public)/knowledge/page.tsx",
  "../app/(public)/knowledge/norme/page.tsx",
  "../app/(public)/knowledge/norme/[slug]/page.tsx",
  "../app/(public)/knowledge/gradi/page.tsx",
  "../app/(public)/knowledge/gradi/[slug]/page.tsx",
  "../app/(public)/knowledge/tubes/page.tsx",
  "../app/(public)/knowledge/tubes/[slug]/page.tsx",
  "../components/public-tube-family-hub.tsx",
  "../components/public-tube-size-hub.tsx",
  "../components/public-tube-weight-calculator.tsx",
  "../components/global-search.tsx",
  "../app/(workspace)/network/page.tsx",
  "../app/(workspace)/dashboard/page.tsx",
].map(read);

const legacyBlueTokens = [
  "#2f6fed",
  "#245ed1",
  "#1e2b45",
  "#273750",
  "#34445c",
  "#4a5b72",
  "#5f7088",
  "#68788e",
  "#7f8da3",
  "#91a0b2",
  "#e1e8f2",
  "#dbe7f7",
  "#dce7f7",
  "#bdd1f4",
  "#f8fbff",
  "#f7faff",
  "#f8fafd",
  "#eef5ff",
  "#eaf2ff",
  "#d7e5ff",
];

test("HP17 exposes keyboard skip navigation across the three core shells", () => {
  assert.match(globals, /\.skip-link/);
  assert.match(appShell, /href="#main-content"[\s\S]*className="skip-link"/);
  assert.match(appShell, /<main id="main-content" tabIndex=\{-1\}/);
  assert.match(platformShell, /href="#main-content"[\s\S]*className="skip-link"/);
  assert.match(platformShell, /<main id="main-content" tabIndex=\{-1\}/);
  assert.match(publicKnowledgeLayout, /href="#main-content"[\s\S]*className="skip-link"/);
  assert.match(publicKnowledgeLayout, /<main id="main-content" tabIndex=\{-1\}/);
});

test("HP17 honors reduced motion and lifts known low-contrast legacy text tokens", () => {
  assert.match(globals, /prefers-reduced-motion: reduce/);
  assert.match(globals, /transition-duration: 0\.01ms/);
  for (const token of [
    "text-[#7b8782]",
    "text-[#87938e]",
    "text-[#8b9792]",
    "text-[#91a0b2]",
    "text-[#9aa49f]",
    "text-[#7f8da3]",
    "text-[#7f8b86]",
    "text-[#74817c]",
  ]) {
    assert.ok(globals.includes(`[class~="${token}"]`), `missing contrast compatibility for ${token}`);
  }
});

test("HP17 profile drawer behaves as a keyboard modal and restores trigger focus", () => {
  assert.match(workspaceNavigation, /role="dialog"/);
  assert.match(workspaceNavigation, /aria-modal="true"/);
  assert.match(workspaceNavigation, /aria-label="Menu profilo"/);
  assert.match(workspaceNavigation, /event\.key === "Escape"/);
  assert.match(workspaceNavigation, /event\.key !== "Tab"/);
  assert.match(workspaceNavigation, /triggerRef\.current\?\.focus\(\)/);
  assert.match(workspaceNavigation, /autoFocus/);
});

test("HP17 destructive confirmation traps focus and restores the triggering control", () => {
  assert.match(confirmSubmit, /aria-controls=\{open \? dialogId : undefined\}/);
  assert.match(confirmSubmit, /ref=\{dialogRef\}/);
  assert.match(confirmSubmit, /role="alertdialog"/);
  assert.match(confirmSubmit, /event\.key === "Escape"/);
  assert.match(confirmSubmit, /event\.key !== "Tab"/);
  assert.match(confirmSubmit, /triggerRef\.current\?\.focus\(\)/);
});

test("HP17 registration announces step changes through deterministic focus", () => {
  assert.match(registration, /useEffect\(\(\) =>/);
  assert.match(registration, /data-registration-step="\$\{step\}"\] h2/);
  assert.match(registration, /heading\?\.focus\(\)/);
  assert.match(registration, /role="list" aria-label="Avanzamento registrazione"/);
  assert.match(registration, /role="listitem"/);
  assert.match(registration, /<h2 tabIndex=\{-1\}/);
});

test("HP17 login has one semantic page heading and announced success feedback", () => {
  assert.match(login, /<h1[^>]*>[\s\S]*Accedi al tuo workspace[\s\S]*<\/h1>/);
  assert.match(login, /role="status" aria-live="polite"/);
});

test("HP17 associates Marketplace filters and labels Network/Global Search controls", () => {
  assert.match(marketplace, /htmlFor="marketplace-product-filter"/);
  assert.match(marketplace, /id="marketplace-product-filter"/);
  assert.match(marketplace, /htmlFor="marketplace-country-filter"/);
  assert.match(marketplace, /id="marketplace-country-filter"/);
  assert.match(marketplace, /htmlFor="marketplace-closing-filter"/);
  assert.match(marketplace, /id="marketplace-closing-filter"/);

  assert.match(network, /aria-label="Nome azienda o dominio"/);
  assert.match(network, /aria-label="Ruolo azienda"/);
  assert.match(network, /aria-label="Famiglia prodotto"/);
  assert.match(network, /aria-label="Capability"/);
  assert.match(network, /aria-label="Mercato"/);

  for (const label of [
    "Cliente o azienda",
    "Qualità acciaio",
    "Norma tecnica",
    "Famiglia prodotto",
    "Diametro esterno in millimetri",
    "Spessore in millimetri",
    "Prezzo minimo",
    "Prezzo massimo",
    "Ruolo commerciale",
  ]) {
    assert.ok(globalSearch.includes(`aria-label="${label}"`), `missing Global Search label: ${label}`);
  }
});

test("HP17 keeps audited public/core surfaces on the forest-neutral system", () => {
  for (const source of forestNeutralFiles) {
    for (const token of legacyBlueTokens) {
      assert.equal(source.includes(token), false, `legacy token ${token} remains in audited core surface`);
    }
    assert.equal(source.includes("Steel Sales AI"), false, "old product name remains in audited core surface");
  }
});
