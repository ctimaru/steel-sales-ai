import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const emptyState = read("../components/first-use-empty-state.tsx");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const products = read("../app/(workspace)/products/page.tsx");
const customers = read("../app/(workspace)/customers/page.tsx");
const explorerPage = read("../app/(workspace)/explorer/page.tsx");
const explorer = read("../components/commercial-explorer.tsx");
const globalSearch = read("../components/global-search.tsx");
const review = read("../app/(workspace)/review/page.tsx");
const alerts = read("../app/(workspace)/alerts/page.tsx");
const dataSources = read("../app/(workspace)/data-sources/page.tsx");
const network = read("../app/(workspace)/network/page.tsx");
const networkActivity = read("../app/(workspace)/network/activity/page.tsx");
const networkInquiries = read("../app/(workspace)/network/inquiries/page.tsx");
const networkFollowing = read("../app/(workspace)/network/following/page.tsx");
const networkSaved = read("../app/(workspace)/network/saved/page.tsx");
const marketplace = read("../app/(workspace)/marketplace/page.tsx");
const marketplaceRequests = read("../app/(workspace)/marketplace/requests/page.tsx");
const marketplaceResponses = read("../app/(workspace)/marketplace/responses/page.tsx");
const marketplaceNotifications = read("../app/(workspace)/marketplace/notifications/page.tsx");
const platformHome = read("../app/(platform)/platform/page.tsx");
const platformRegistrations = read("../app/(platform)/platform/registrations/page.tsx");
const platformClaims = read("../app/(platform)/platform/company-claims/page.tsx");
const platformDiscovery = read("../app/(platform)/platform/company-discovery/page.tsx");
const platformKnowledge = read("../app/(platform)/platform/knowledge/page.tsx");

test("HP9 defines one reusable empty-state contract with mandatory next action", () => {
  assert.match(emptyState, /export function FirstUseEmptyState/);
  assert.match(emptyState, /primaryAction: EmptyStateAction/);
  assert.match(emptyState, /secondaryAction\?: EmptyStateAction \| null/);
  assert.match(emptyState, /href=\{primaryAction\.href\}/);
  assert.match(emptyState, /\{primaryAction\.label\}/);
  assert.match(emptyState, /Primo utilizzo/);
});

test("HP9 separates first-use zero data from filtered zero results in Commercial Memory", () => {
  assert.match(products, /query \? \(/);
  assert.match(products, /Azzera ricerca/);
  assert.match(products, /Importa i primi documenti/);
  assert.match(customers, /query \? \(/);
  assert.match(customers, /Risolvi identità aziendali/);
  assert.match(customers, /Importa i primi documenti/);
  assert.match(explorer, /const hasFilters = Boolean/);
  assert.match(explorer, /Azzera filtri/);
  assert.match(explorer, /Importa i primi documenti/);
  assert.match(explorerPage, /canWrite=\{canWrite\}/);
});

test("HP9 removes first-use dead ends from workspace home and search", () => {
  assert.match(dashboard, /recent\.length === 0/);
  assert.match(dashboard, /FirstUseEmptyState/);
  assert.match(dashboard, /Importa i primi documenti/);
  assert.match(globalSearch, /Ricerca senza risultati/);
  assert.match(globalSearch, /Nuova ricerca/);
  assert.match(globalSearch, /Apri Product 360/);
});

test("HP9 makes operational empty states actionable", () => {
  assert.match(review, /items\.length === 0/);
  assert.match(review, /Importa documenti/);
  assert.match(review, /Torna al workspace/);
  assert.match(alerts, /alerts\.length === 0/);
  assert.match(alerts, /Apri Correzioni/);
  assert.match(dataSources, /Nessuna fonte ha ancora prodotto dati/);
  assert.match(dataSources, /const hasFilters = Boolean/);
  assert.match(dataSources, /Azzera filtri/);
  assert.match(dataSources, /Importa i primi documenti/);
});

test("HP9 gives every main Network zero state a concrete continuation", () => {
  assert.match(network, /Ricerca senza risultati/);
  assert.match(network, /Azzera ricerca e filtri/);
  assert.match(network, /Completa Company Profile/);
  assert.match(networkActivity, /Mostra tutte le activity/);
  assert.match(networkActivity, /Gestisci aziende seguite/);
  assert.match(networkInquiries, /Trova aziende nel Network/);
  assert.match(networkInquiries, /Controlla Company Profile/);
  assert.match(networkFollowing, /FirstUseEmptyState/);
  assert.match(networkFollowing, /Esplora il Network/);
  assert.match(networkSaved, /FirstUseEmptyState/);
  assert.match(networkSaved, /Esplora il Network/);
});

test("HP9 makes Marketplace first use role-aware and filter-aware", () => {
  assert.match(marketplace, /const hasFilters = Boolean/);
  assert.match(marketplace, /Azzera filtri/);
  assert.match(marketplace, /Crea una ricerca/);
  assert.match(marketplace, /Completa Company Profile/);
  assert.match(marketplaceRequests, /Crea la prima ricerca/);
  assert.match(marketplaceRequests, /Apri il Demand Board/);
  assert.match(marketplaceResponses, /Controlla le mie ricerche/);
  assert.match(marketplaceResponses, /Crea una nuova ricerca/);
  assert.match(marketplaceNotifications, /Completa Company Profile/);
  assert.match(marketplaceNotifications, /Apri tutto il Demand Board/);
});

test("HP9 covers core Platform control-plane queues", () => {
  assert.match(platformHome, /Controlla il mio accesso/);
  assert.match(platformRegistrations, /Mostra tutte le pratiche/);
  assert.match(platformClaims, /Mostra tutti i claim/);
  assert.match(platformClaims, /Apri Network Trust/);
  assert.match(platformDiscovery, /Apri da revisionare/);
  assert.match(platformKnowledge, /Mostra tutti i contenuti/);
});

test("HP9 keeps first-use actions role-aware where write access matters", () => {
  assert.match(products, /canWriteWorkspace/);
  assert.match(customers, /canWriteWorkspace/);
  assert.match(explorerPage, /canWriteWorkspace/);
  assert.match(marketplace, /canWriteWorkspace/);
  assert.match(marketplaceRequests, /canWriteWorkspace/);
  assert.match(marketplaceResponses, /canWriteWorkspace/);
});
