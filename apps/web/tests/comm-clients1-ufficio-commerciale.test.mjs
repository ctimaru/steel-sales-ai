// COMM-CLIENTS1 (founder decision, 19 Nov 2026): Ufficio commerciale mirrors
// Ufficio acquisti. «Richieste d'offerta» (sales deals only) + «Clienti»
// (clients with orders, prospects with requests/offers). No Scrivania,
// no Riattivazione clienti, no Relazioni collegate in the menu.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const nav = read("../lib/commercial-director-navigation.ts");
const shell = read("../components/workspace-commercial-director-shell.tsx");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const desk = read("../components/commercial-deals-desk.tsx");
const deals = read("../lib/commercial-deals.ts");
const attention = read("../app/(italian)/(workspace)/commercial/attention-actions.ts");
const customers = read("../app/(italian)/(workspace)/customers/page.tsx");
const actions = read("../app/(italian)/(workspace)/customers/actions.ts");
const migration = read("../../../supabase/migrations/20261119110000_comm_clients1_directory.sql");

test("menu: Ufficio commerciale = Richieste d'offerta + Clienti, senza Scrivania", () => {
  assert.match(nav, /label: "Richieste d'offerta", href: appRoutes\.commercial\.home, counter: "sales_attention"/);
  assert.match(nav, /label: "Clienti", href: appRoutes\.commercial\.companies/);
  for (const gone of ['label: "Scrivania"', 'label: "Trattative"', 'label: "Aziende"', 'label: "Riattivazione clienti"', 'label: "Relazioni collegate"']) {
    assert.equal(nav.includes(gone), false, gone);
  }
  assert.doesNotMatch(shell, /group\.key === "desk"/);
  assert.match(shell, /item\.counter === "sales_attention" \? <SalesAttentionCount \/>/);
  // Il contatore usa la stessa fonte del filtro «Da fare» della lista.
  assert.match(attention, /comm_deals2_index/);
  assert.match(attention, /p_segment: "sales", p_filter: "todo"/);
});

test("Richieste d'offerta: solo vendite, i link agli acquisti vanno al Centro RFQ", () => {
  assert.match(page, /segment: "sales" as const/);
  assert.match(page, /purchaseItemHref\(context\.organizationId/);
  assert.match(page, /params\.seg === "purchase" \|\| params\.view === "sent" \|\| params\.view === "drafts" \|\| params\.f === "drafts"/);
  assert.match(page, /redirect\(appRoutes\.rfqHub\.home\)/);
  assert.match(desk, /Richieste d&apos;offerta<\/h1>/);
  assert.doesNotMatch(desk, /commercial-deal-segments|CommercialCampaignOperations|key: "drafts", label: "Bozze"/);
  assert.match(deals, /export async function purchaseItemHref/);
  assert.match(deals, /state\.segment === "sales" \? skip : loadPurchaseWindow/);
});

test("Clienti: schede Clienti e Potenziali dalla funzione SQL dedicata", () => {
  assert.match(customers, />Clienti<\/h1>/);
  assert.match(customers, /label: "Clienti"/);
  assert.match(customers, /label: "Potenziali"/);
  assert.match(customers, /redirect\(appRoutes\.network\.saved\)/);
  assert.match(customers, /redirect\(appRoutes\.network\.connections\)/);
  assert.doesNotMatch(customers, /loadCompanyNetworkLists|Con storico/);
  assert.match(actions, /rpc\("comm_clients1_directory"/);
  assert.match(actions, /payload\.contract !== "comm-clients1-v1"/);
  assert.doesNotMatch(actions, /export const /, "a \"use server\" module exports only async functions");
});

test("migrazione: sola lettura, RLS del chiamante, nessun testo o prezzo", () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /public\.is_organization_member\(p_organization_id, false\)/);
  assert.match(migration, /coalesce\(x\.status, ''\) <> 'cancelled'/);
  assert.match(migration, /revoke all on function public\.comm_clients1_directory\(uuid, text, text, integer, integer\) from public, anon/);
  assert.match(migration, /grant execute on function public\.comm_clients1_directory\(uuid, text, text, integer, integer\) to authenticated, service_role/);
  assert.doesNotMatch(migration, /\b(insert|update|delete)\s+(into\s+)?public\./i);
  for (const forbidden of ["body", "snippet", "notes", "unit_price", "total_eur"]) {
    assert.equal(migration.includes(forbidden), false, forbidden);
  }
});
