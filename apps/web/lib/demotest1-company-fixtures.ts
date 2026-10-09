import "server-only";

/**
 * DEMOTEST1: deterministic, read-only, fictional multi-company acceptance fixtures.
 * This module MUST NOT access Auth, Supabase, email, analytics or external services.
 */
export const demoTestMeta = {
  synthetic: true,
  tenantScoped: false,
  analyticsExcluded: true,
  publicIndexingAllowed: false,
  dispatchEnabled: false,
  databaseWritesEnabled: false,
  ownerOnly: true,
  label: "DEMO DATA — NOT CUSTOMER EVIDENCE",
  version: "demotest1-v1",
} as const;

export type DemoCompanyRole = "producer" | "trader_distributor" | "processor_service_provider" | "end_user";

export type DemoCompany = {
  key: string;
  legalName: string;
  roleKey: DemoCompanyRole;
  roleLabel: string;
  country: "IT";
  business: string;
  capabilities: readonly string[];
  email: string;
  members: readonly { role: string; email: string }[];
  workflow: string;
  expectedAccess: string;
};

export const demoTestCompanies: readonly DemoCompany[] = [
  {
    key: "demo-producer",
    legalName: "DEMO Steel Manufacturing",
    roleKey: "producer",
    roleLabel: "Produttore",
    country: "IT",
    business: "Tubi strutturali saldati e finiti a caldo",
    capabilities: ["EN 10219", "EN 10210", "S355J2H", "CHS", "SHS", "RHS"],
    email: "sales@producer.example.com",
    members: [
      { role: "Sales Director", email: "director@producer.example.com" },
      { role: "Commerciale", email: "rep@producer.example.com" },
    ],
    workflow: "Riceve RFQ, conferma capacità produttiva e presenta offerta",
    expectedAccess: "Solo RFQ indirizzate al produttore e dati della sua organizzazione",
  },
  {
    key: "demo-trader",
    legalName: "DEMO Tubes Trading",
    roleKey: "trader_distributor",
    roleLabel: "Commerciante",
    country: "IT",
    business: "Distribuzione e stock di tubi strutturali",
    capabilities: ["EN 10219", "EN 10210", "Stock", "Logistica"],
    email: "offers@trader.example.com",
    members: [
      { role: "Sales Director", email: "director@trader.example.com" },
      { role: "Commerciale", email: "rep@trader.example.com" },
    ],
    workflow: "Riceve RFQ, quota articoli disponibili a magazzino e confronta offerte",
    expectedAccess: "Dati propri; nessuna visibilità sulle offerte concorrenti",
  },
  {
    key: "demo-processor",
    legalName: "DEMO Steel Processing",
    roleKey: "processor_service_provider",
    roleLabel: "Terzista",
    country: "IT",
    business: "Taglio laser tubo, foratura e lavorazioni conto terzi",
    capabilities: ["Taglio laser", "Segatura", "Foratura", "Lavorazioni conto terzi"],
    email: "jobs@processor.example.com",
    members: [
      { role: "Operations Manager", email: "director@processor.example.com" },
      { role: "Commerciale", email: "rep@processor.example.com" },
    ],
    workflow: "Riceve richiesta di lavorazione e quota servizio senza prezzo del tubo",
    expectedAccess: "Solo specifiche della lavorazione e allegati autorizzati",
  },
  {
    key: "demo-end-user",
    legalName: "DEMO Industrial Engineering",
    roleKey: "end_user",
    roleLabel: "Utilizzatore",
    country: "IT",
    business: "Costruzione di impianti e carpenterie industriali",
    capabilities: ["Acquisti", "Distinte miste", "Carpenteria", "Project procurement"],
    email: "buying@buyer.example.com",
    members: [
      { role: "Procurement Director", email: "director@buyer.example.com" },
      { role: "Buyer", email: "rep@buyer.example.com" },
    ],
    workflow: "Crea distinta mista, invita fornitori, confronta offerte e aggiudica",
    expectedAccess: "Tutte le offerte della propria RFQ ma nessun dato privato dei fornitori",
  },
] as const;

export const demoTestRfq = {
  key: "demo-rfq-mixed-001",
  buyerKey: "demo-end-user",
  title: "DEMO — Carpenteria tubolare, EN 10210 + EN 10219",
  state: "comparison_ready_simulated",
  externalDispatch: false,
  currency: "EUR",
  lines: [
    { key: "line-01", standard: "EN 10219", grade: "S355J2H", geometry: "RHS 200 × 100 × 6 mm", lengthM: 12, quantity: 40, documentation: "EN 10204 3.1" },
    { key: "line-02", standard: "EN 10210", grade: "S355J2H", geometry: "CHS 168,3 × 6,3 mm", lengthM: 6, quantity: 80, documentation: "EN 10204 3.1" },
    { key: "line-03", standard: "EN 10219", grade: "S235JRH", geometry: "SHS 100 × 100 × 5 mm", lengthM: 6, quantity: 100, documentation: "EN 10204 2.2" },
  ],
  supplierKeys: ["demo-producer", "demo-trader"],
  processingCompanyKey: "demo-processor",
  quotations: [
    { supplierKey: "demo-producer", coverage: "3/3", eurPerT: 845, leadDays: 18, status: "received_simulated" },
    { supplierKey: "demo-trader", coverage: "2/3", eurPerT: 870, leadDays: 8, status: "received_simulated" },
  ],
  award: { supplierKey: "demo-producer", status: "draft_simulated", purchaseOrderSent: false },
} as const;

export const demoTestCases = [
  { id: "DT1-01", area: "Registrazione", scenario: "Azienda nuova; stato pending; nessuna auto-attivazione", expected: "APPROVAL_REQUIRED", mode: "authenticated_pending" },
  { id: "DT1-02", area: "Claim Network", scenario: "Ricerca e verifica profilo già censito", expected: "HUMAN_REVIEW_REQUIRED", mode: "authenticated_pending" },
  { id: "DT1-03", area: "Ruoli", scenario: "Director, commerciale e buyer vedono soltanto il proprio workspace", expected: "TENANT_ISOLATED", mode: "authenticated_pending" },
  { id: "DT1-04", area: "Distinta", scenario: "Tre righe con EN 10219 e EN 10210 nella medesima richiesta", expected: "MIXED_STANDARDS_PRESERVED", mode: "fixture_assertion" },
  { id: "DT1-05", area: "RFQ Hub", scenario: "Invito a produttore e commerciante, senza dispatch reale", expected: "NO_EXTERNAL_DISPATCH", mode: "fixture_assertion" },
  { id: "DT1-06", area: "Fornitori", scenario: "Produttore non legge offerta del commerciante", expected: "COMPETITOR_OFFER_DENIED", mode: "authenticated_pending" },
  { id: "DT1-07", area: "Lavorazioni", scenario: "Terzista riceve solo righe e allegati autorizzati", expected: "MINIMUM_DISCLOSURE", mode: "authenticated_pending" },
  { id: "DT1-08", area: "Confronto", scenario: "Copertura parziale 2/3 differenziata da 3/3", expected: "COVERAGE_EXPLICIT", mode: "fixture_assertion" },
  { id: "DT1-09", area: "Ordine", scenario: "Aggiudicazione in bozza, invio ordine disabilitato", expected: "NO_PURCHASE_ORDER_SENT", mode: "fixture_assertion" },
  { id: "DT1-10", area: "Marketplace", scenario: "Pubblicazione soltanto con scelta e consenso esplicito", expected: "NO_AUTOPUBLICATION", mode: "authenticated_pending" },
  { id: "DT1-11", area: "Notifiche", scenario: "Separazione notifiche aziendali e console Platform", expected: "ROLE_SCOPED_NOTIFICATIONS", mode: "authenticated_pending" },
  { id: "DT1-12", area: "Chrome", scenario: "Percorsi pubblici e route owner-only in Chromium senza credenziali", expected: "NO_PRIVATE_LEAK", mode: "browser_pending" },
] as const;
