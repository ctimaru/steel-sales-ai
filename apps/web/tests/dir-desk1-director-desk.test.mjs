// DIR-DESK1 (founder decisions, 25 nov 2026): Scrivania della Direzione.
// Prima voce di «Direzione aziendale», solo amministratori; numeri del giorno,
// due uffici, persone, senza responsabile, approvazioni; valori in euro senza stime.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { purchaseDealsFromRows, salesDealsFromRows } from "../lib/commercial-deal-model.ts";
import {
  buildDirectorDesk, deskDueLabel, deskInitials, deskOfficeSegments, deskShare, deskToday, documentValue, formatEur, lineValueEur, normalizeUnit,
} from "../lib/director-desk-model.ts";

const routes = {
  rfq: (id) => "/commercial/rfqs/" + id, offer: (id) => "/commercial/offers/" + id,
  order: (id) => "/commercial/orders/" + id, campaign: (id) => "/rfq-hub/" + id,
  distinta: (id) => "/rfq-hub/distinte/" + id,
};
const id = (n) => "d1de5c00-2d34-4bba-bc2b-" + String(n).padStart(12, "0");
const user = (n) => "d1de5c00-aaaa-4bba-bc2b-" + String(n).padStart(12, "0");
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("unità: prezzi e quantità dei documenti reali", () => {
  assert.equal(normalizeUnit("T"), "t");
  assert.equal(normalizeUnit("EUR/t"), "t");
  assert.equal(normalizeUnit("€/m"), "m");
  assert.equal(normalizeUnit("MT"), "m");
  assert.equal(normalizeUnit("PZ"), "pz");
  assert.equal(normalizeUnit("barre"), null);
});

test("valore riga: unità coerenti o conversione con peso kg/m, mai stime", () => {
  assert.equal(lineValueEur({ quantity: 2, quantityUnit: "T", price: 900, priceUnit: "T" }), 1800);
  assert.equal(lineValueEur({ quantity: 500, quantityUnit: "KG", price: 1000, priceUnit: "EUR/t" }), 500);
  assert.equal(lineValueEur({ quantity: 100, quantityUnit: "M", price: 1000, priceUnit: "T", weightKgM: 10 }), 1000);
  assert.equal(lineValueEur({ quantity: 1, quantityUnit: "T", price: 5, priceUnit: "M", weightKgM: 10 }), 500);
  // Prezzo al metro, quantità in tonnellate, senza peso: non calcolabile.
  assert.equal(lineValueEur({ quantity: 4.32, quantityUnit: "T", price: 5, priceUnit: "M" }), null);
  // Prezzo a tonnellata, quantità in pezzi: non calcolabile.
  assert.equal(lineValueEur({ quantity: 9, quantityUnit: "PZ", price: 900, priceUnit: "T" }), null);
  assert.equal(lineValueEur({ quantity: 0, quantityUnit: "T", price: 900, priceUnit: "T" }), null);
});

test("valore documento: un totale parziale non viene mai mostrato come totale", () => {
  assert.deepEqual(documentValue([]), { eur: null, unknown: false });
  assert.deepEqual(documentValue([{ quantity: 2, quantityUnit: "T", price: null, priceUnit: null }]), { eur: null, unknown: false });
  assert.deepEqual(documentValue([
    { quantity: 2, quantityUnit: "T", price: 900, priceUnit: "T" },
    { quantity: 1, quantityUnit: "T", price: 1000, priceUnit: "T" },
  ]), { eur: 2800, unknown: false });
  assert.deepEqual(documentValue([
    { quantity: 2, quantityUnit: "T", price: 900, priceUnit: "T" },
    { quantity: 9, quantityUnit: "PZ", price: 900, priceUnit: "T" },
  ]), { eur: null, unknown: true });
  assert.match(formatEur(12400), /12\.400/);
});

test("scrivania: numeri, uffici, persone e senza responsabile", () => {
  const sales = salesDealsFromRows([
    { id: id(1), status: "new", created_at: daysAgo(1), due_at: daysAhead(2), company: { name: "Rossi" } },
    { id: id(2), status: "quoted", created_at: daysAgo(3), company: { name: "Bianchi" },
      offers: [{ id: id(21), status: "sent", created_at: daysAgo(2), valid_until: daysAhead(10).slice(0, 10) }] },
    { id: id(3), status: "new", created_at: daysAgo(5), company: { name: "Verdi" } },
  ], [], [
    { id: id(4), status: "received", created_at: daysAgo(45) },
  ], routes);
  const purchase = purchaseDealsFromRows([
    { id: id(5), title: "RFQ tubi", status: "collecting", created_at: daysAgo(2), due_at: daysAhead(3),
      suppliers: [{ status: "sent" }], quotes: [{ id: id(51), supplier_id: id(52), status: "submitted" }] },
  ], routes);
  const responsible = { ["inbound-rfq:" + id(1)]: user(1), ["inbound-rfq:" + id(2)]: user(1), ["inbound-rfq:" + id(3)]: null,
    ["inbound-order:" + id(4)]: user(9), ["campaign:" + id(5)]: user(2) };
  const values = { ["inbound-rfq:" + id(2)]: { eur: 1800, unknown: false }, ["campaign:" + id(5)]: { eur: null, unknown: true } };
  const deals = [...sales, ...purchase].map((deal) => ({
    deal, responsibleId: responsible[deal.key] ?? null, value: values[deal.key] ?? { eur: null, unknown: false },
  }));
  const members = [
    { userId: user(1), email: "vendite@azienda.it", office: "commercial", canWrite: true },
    { userId: user(2), email: "acquisti@azienda.it", office: "purchasing", canWrite: true },
    { userId: user(3), email: "titolare@azienda.it", office: "direction", canWrite: true },
    { userId: user(4), email: "nuovo@azienda.it", office: null, canWrite: true },
  ];
  const desk = buildDirectorDesk(deals, members);

  assert.deepEqual(desk.numbers, { salesTodo: 2, purchaseTodo: 1, dueSales: 1, duePurchase: 1, review: 1 });
  assert.equal(desk.offices.commercial.open, 4);
  assert.equal(desk.offices.commercial.waiting, 1);
  assert.equal(desk.offices.commercial.review, 1);
  assert.equal(desk.offices.commercial.valueEur, 1800);
  assert.equal(desk.offices.commercial.people, 1);
  assert.equal(desk.offices.purchasing.todo, 1);
  assert.equal(desk.offices.purchasing.valueUnknown, 1, "unknown values are counted, never estimated");
  assert.equal(desk.directors, 1);
  assert.equal(desk.withoutProfile, 1);

  const sellerRow = desk.people.find((p) => p.member.userId === user(1));
  assert.equal(sellerRow.open, 2);
  assert.equal(sellerRow.todo, 1);
  assert.equal(sellerRow.due, 1);
  assert.equal(sellerRow.valueEur, 1800);
  assert.deepEqual(desk.people.map((p) => p.member.office), ["direction", "commercial", "purchasing", null]);

  // Senza responsabile: nessun assegnatario, o assegnatario non più nel team. Solo vendite.
  assert.deepEqual(desk.unassigned.map((d) => d.deal.key).sort(), ["inbound-order:" + id(4), "inbound-rfq:" + id(3)].sort());
  assert.equal(desk.unassignedTotal, 2);
});

test("pagina: solo amministratori, prima voce di Direzione aziendale, azioni ricontrollate sul server", () => {
  const page = read("../app/(italian)/(workspace)/commercial/direzione/page.tsx");
  assert.match(page, /requireWorkspaceAdmin\(appRoutes\.commercial\.home\)/);
  assert.match(page, /Scrivania della Direzione/);
  // DIR-DESK2: i quattro riquadri numerici sono assorbiti dalle schede degli uffici (chip cliccabili).
  for (const testId of ["director-desk-chip", "director-desk-office-", "director-desk-people", "director-desk-unassigned", "director-desk-approvals", "director-desk-summary", "director-desk-due"]) {
    assert.ok(page.includes(testId), testId);
  }
  const nav = read("../lib/commercial-director-navigation.ts");
  assert.match(nav, /items: \[\n\s*\/\/ DIR-DESK1[^\n]*\n\s*\{ label: "Scrivania della Direzione", href: appRoutes\.commercial\.direction, adminOnly: true \}/);
  const actions = read("../app/(italian)/(workspace)/commercial/direzione/actions.ts");
  assert.match(actions, /^"use server";/);
  assert.equal((actions.match(/if \(!canAdministerCompany\(context\.role\)\)/g) ?? []).length, 2, "both actions check the Direzione");
  assert.match(actions, /update\(\{ assigned_to_user_id: input\.userId \}\)/);
  assert.match(actions, /\.eq\("organization_id", context\.organizationId\)\.eq\("id", input\.id\)/);
  assert.match(actions, /row\.role === "viewer"/);
  assert.match(actions, /decideRfqh13Approval\(input\)/);
  const loader = read("../lib/director-desk.ts");
  assert.match(loader, /^import "server-only";/);
  assert.match(loader, /rpc\("hp8_team_state"/);
  assert.doesNotMatch(loader, /notes|body|source_text|raw_spec_text/, "no free text from emails or notes");
});

// DIR-DESK2 (founder request, 26 nov 2026): aprendo Commerciale la Direzione arriva sulla Scrivania.
test("ingresso: Commerciale apre la Scrivania per la Direzione, Richieste d'offerta per gli altri", () => {
  const entry = read("../lib/commercial-director-navigation.ts");
  assert.match(entry, /return canAdmin \? appRoutes\.commercial\.direction : appRoutes\.commercial\.home;/);
  assert.match(read("../lib/routes.ts"), /direction: "\/commercial\/direzione"/);
  const shell = read("../components/app-shell.tsx");
  assert.match(shell, /const commercialHref = commercialEntryHref\(canAdmin && !demoMode\);/);
  assert.equal((shell.match(/commercialHref=\{commercialHref\}/g) ?? []).length, 2, "desktop and mobile navigation");
  const nav = read("../components/workspace-navigation.tsx");
  assert.match(nav, /key: "commercial" as const,\n\s*href: commercialHref,/);
  assert.equal((nav.match(/primaryItems\(networkEnabled, networkEntitled, commercialHref\)/g) ?? []).length, 2);
  // La pagina ricontrolla il ruolo e rimanda gli altri a Richieste d'offerta.
  assert.match(read("../app/(italian)/(workspace)/commercial/direzione/page.tsx"), /requireWorkspaceAdmin\(appRoutes\.commercial\.home\)/);
});

// DIR-DESK2 (26 nov 2026): nuova grafica approvata dal founder.
test("presentazione: iniziali, scadenze in giorni di calendario, barre degli uffici", () => {
  assert.equal(deskInitials("m.rossi@azienda.it"), "MR");
  assert.equal(deskInitials("anna@azienda.it"), "AN");
  assert.equal(deskInitials("@x"), "?");

  const now = Date.parse("2026-11-26T09:00:00+01:00");
  assert.deepEqual(deskDueLabel(null, now), { label: "Senza scadenza", tone: "none" });
  assert.deepEqual(deskDueLabel("2026-11-25T18:00:00+01:00", now), { label: "Scaduta", tone: "late" });
  assert.deepEqual(deskDueLabel("2026-11-26T23:30:00+01:00", now), { label: "Scade oggi", tone: "late" });
  assert.deepEqual(deskDueLabel("2026-11-27T00:30:00+01:00", now), { label: "Domani", tone: "soon" });
  assert.deepEqual(deskDueLabel("2026-12-01T10:00:00+01:00", now), { label: "Tra 5 giorni", tone: "soon" });
  assert.deepEqual(deskDueLabel("2026-12-20T10:00:00+01:00", now), { label: "Tra 24 giorni", tone: "later" });
  assert.equal(deskToday(now), "Giovedì 26 novembre");

  assert.deepEqual(deskOfficeSegments({ open: 22, todo: 6, waiting: 9, review: 3 }), { todo: 6, waiting: 9, review: 3, rest: 4 });
  assert.deepEqual(deskOfficeSegments({ open: 2, todo: 2, waiting: 1, review: 0 }), { todo: 2, waiting: 1, review: 0, rest: 0 });
  assert.equal(deskShare(6, 24), "25.0%");
  assert.equal(deskShare(0, 24), "0%");
  assert.equal(deskShare(5, 0), "0%");
  assert.equal(deskShare(30, 24), "100.0%");
});

test("pagina DIR-DESK2: prima le decisioni, poi uffici e carico del team", () => {
  const page = read("../app/(italian)/(workspace)/commercial/direzione/page.tsx");
  const at = (id) => page.indexOf(id);
  assert.ok(at('data-testid="director-desk-approvals"') < at('title="Ufficio commerciale"'), "approvals before offices");
  assert.ok(at('data-testid="director-desk-unassigned"') < at('title="Ufficio commerciale"'), "unassigned before offices");
  assert.ok(at('title="Ufficio acquisti"') < at('data-testid="director-desk-people"'), "team load last");
  assert.doesNotMatch(page, /director-desk-number/, "no duplicated KPI tiles");
  assert.match(page, /Carico del team/);
  assert.match(page, /todo: appRoutes\.rfqHub\.attention/);
  assert.match(page, /review: dealDeskHref\(\{ filter: "review" \}\)/);
});
