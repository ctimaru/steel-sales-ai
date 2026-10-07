import "server-only";

export const investorDemoMeta = {
  synthetic: true,
  tenantScoped: false,
  analyticsExcluded: true,
  source: "MKT6 fixture",
  label: "DEMO DATA — NOT CUSTOMER EVIDENCE",
  version: "mkt6-v1",
} as const;

export const investorDemoCommercialMemory = {
  metrics: { rfqs: 18, offers: 31, orders: 12, reviewFlags: 2 },
  rows: [
    { id: "cm-1", role: "offered", date: "07 ott 2026", company: "DemoSteel Alpha", product: "Tondo 88,9 x 5 x 6000 mm", grade: "S355J2H", standard: "EN 10219", price: "€ 845 / t", confidence: 0.98 },
    { id: "cm-2", role: "requested", date: "06 ott 2026", company: "DemoPipe Beta", product: "Quadro 120 x 120 x 6 x 12000 mm", grade: "S355J2H", standard: "EN 10219", price: "—", confidence: 0.97 },
    { id: "cm-3", role: "ordered", date: "03 ott 2026", company: "DemoFabrication Gamma", product: "Rettangolare 200 x 100 x 8 x 12000 mm", grade: "S355J2H", standard: "EN 10210", price: "€ 910 / t", confidence: 0.99 },
    { id: "cm-4", role: "offered", date: "29 set 2026", company: "DemoSteel Delta", product: "Tondo 168,3 x 6,3 x 12000 mm", grade: "S235JRH", standard: "EN 10219", price: "€ 875 / t", confidence: 0.96 },
  ],
} as const;

export const investorDemoRfqHub = {
  campaign: {
    title: "DEMO · Strutturali EN 10219 — ottobre",
    status: "comparison_ready",
    lines: 4,
    tonnes: 42.6,
    suppliers: 4,
    due: "10 ott 2026",
  },
  suppliers: [
    { name: "DemoSteel Alpha", email: "quotes@alpha.example.com", status: "submitted", channel: "Email + piattaforma" },
    { name: "DemoPipe Beta", email: "sales@beta.example.com", status: "submitted", channel: "Piattaforma" },
    { name: "DemoSteel Delta", email: "rfq@delta.example.com", status: "submitted", channel: "Email" },
    { name: "DemoMetals Epsilon", email: "offers@epsilon.example.com", status: "pending", channel: "Email + piattaforma" },
  ],
  comparison: [
    { supplier: "DemoSteel Alpha", coverage: "100%", eurT: 842, lead: "12 gg", total: "€ 35.869", delta: "-4,3%" },
    { supplier: "DemoPipe Beta", coverage: "100%", eurT: 858, lead: "9 gg", total: "€ 36.551", delta: "-2,5%" },
    { supplier: "DemoSteel Delta", coverage: "75%", eurT: 831, lead: "18 gg", total: "€ 34.214", delta: "-5,6%" },
  ],
} as const;

export const investorDemoNetwork = {
  total: 1284,
  filters: ["Italia", "Tubes & Pipes", "Produttori + Commercianti"],
  companies: [
    { name: "Demo Tubes Nord", country: "IT", role: "Produttore", products: ["Tubi saldati", "EN 10219"], capabilities: ["Taglio", "Zincatura"], verification: "Verified demo" },
    { name: "Demo Steel Trade", country: "IT", role: "Commerciante", products: ["Tubi strutturali", "Profili"], capabilities: ["Stock", "Logistica"], verification: "Claimable demo" },
    { name: "Demo Processing Hub", country: "IT", role: "Terzista", products: ["Tubi", "Lamiere"], capabilities: ["Laser", "Segatura"], verification: "Published demo" },
    { name: "Demo Industrial Systems", country: "DE", role: "Utilizzatore", products: ["Structural tubes"], capabilities: ["Fabrication"], verification: "Published demo" },
  ],
} as const;

export const investorDemoProcurementIntelligence = {
  summary: [
    ["Spesa aggiudicata", "€ 184.600"],
    ["Saving vs target", "€ 12.840"],
    ["Saving %", "6,5%"],
    ["Quote coverage", "91,7%"],
    ["Response rate", "78,6%"],
    ["Lead medio", "13,4 gg"],
  ],
  funnel: { rfqs: 14, invites: 42, responses: 33, comparable: 29, complete: 26 },
  suppliers: [
    { name: "DemoSteel Alpha", rfq: 9, response: "88,9%", coverage: "96,0%", responseTime: "7,8 h", lead: "12,1 gg", award: "44,4%", saving: "€ 5.920" },
    { name: "DemoPipe Beta", rfq: 8, response: "75,0%", coverage: "100%", responseTime: "11,3 h", lead: "9,6 gg", award: "37,5%", saving: "€ 4.110" },
    { name: "DemoSteel Delta", rfq: 7, response: "71,4%", coverage: "82,5%", responseTime: "18,6 h", lead: "17,8 gg", award: "28,6%", saving: "€ 2.810" },
  ],
  article: {
    description: "Tondo 88,9 x 5 · EN 10219 · S355J2H",
    latest: "€ 842/t",
    previous: "€ 865/t",
    change: "-2,7%",
    samples: 7,
  },
} as const;

export type InvestorDemoSurface =
  | "commercial-memory"
  | "rfq-hub"
  | "network"
  | "procurement-intelligence";

export const investorDemoSurfaces: readonly {
  key: InvestorDemoSurface;
  label: string;
  deckSlides: readonly number[];
}[] = [
  { key: "commercial-memory", label: "Commercial Memory", deckSlides: [2, 4, 8] },
  { key: "rfq-hub", label: "RFQ Hub", deckSlides: [4, 5, 11] },
  { key: "network", label: "Network", deckSlides: [4, 5, 8] },
  { key: "procurement-intelligence", label: "Procurement Intelligence", deckSlides: [4, 8, 10] },
] as const;

export function isInvestorDemoSurface(value: string | undefined): value is InvestorDemoSurface {
  return investorDemoSurfaces.some((surface) => surface.key === value);
}
