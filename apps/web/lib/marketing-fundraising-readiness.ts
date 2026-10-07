import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import type { ClaimStatus } from "@/lib/marketing-fundraising-assets";

export type EvidenceReadiness = "ready" | "partial" | "blocked";
export type ScreenshotReadiness = "candidate" | "approved_for_deck" | "blocked";

export type EvidencePackItem = {
  slide: number;
  key: string;
  titleIt: string;
  titleEn: string;
  readiness: EvidenceReadiness;
  claimStatus: ClaimStatus;
  evidenceIt: readonly string[];
  evidenceEn: readonly string[];
  gapIt: string;
  gapEn: string;
  screenshotKey?: string;
  nextActionIt: string;
  nextActionEn: string;
};

export type UseOfFundsItem = {
  key: string;
  labelIt: string;
  labelEn: string;
  amount: number;
  percent: number;
  purposeIt: string;
  purposeEn: string;
};

export type MilestonePhase = {
  key: string;
  windowIt: string;
  windowEn: string;
  titleIt: string;
  titleEn: string;
  targetsIt: readonly string[];
  targetsEn: readonly string[];
};

export type ScreenshotCandidate = {
  key: string;
  titleIt: string;
  titleEn: string;
  surface: string;
  readiness: ScreenshotReadiness;
  slideTargets: readonly number[];
  gateIt: string;
  gateEn: string;
};

export const fundraisingAsk = {
  targetAmount: 1_000_000,
  corridorMin: 800_000,
  corridorMax: 1_200_000,
  leadMin: 400_000,
  leadMax: 700_000,
  runwayMonths: 24,
  teamSize: 5,
  coreBurnMonthly: 36_300,
  reserve: 130_000,
  status: "working_recommendation" as const,
  rationaleIt: [
    "Il modello interno da €1M copre già circa 24 mesi con un team core di 5 persone.",
    "Il prodotto è molto oltre il concept, ma la traction esterna deve ancora essere dimostrata.",
    "Un round più grande oggi aumenterebbe dilution prima della validazione di pricing, retention e GTM.",
    "Il capitale deve comprare evidence commerciale e network liquidity, non headcount vanity.",
  ],
  rationaleEn: [
    "The internal €1M model already covers roughly 24 months with a five-person core team.",
    "The product is well beyond concept stage, but external traction still needs to be demonstrated.",
    "A larger round today would increase dilution before pricing, retention and GTM are validated.",
    "Capital should buy commercial evidence and network liquidity, not vanity headcount.",
  ],
  benchmarkNotesIt: [
    "Dealroom classifica il Seed europeo nella fascia standardizzata $1M–$4M.",
    "Dealroom indica ~24 mesi come percorso mediano Seed → Series A in Europa.",
    "Dealroom indica ~$2.5–3M di capitale pre-A complessivo per chi arriva alla Series A.",
  ],
  benchmarkNotesEn: [
    "Dealroom classifies European Seed in the standardized $1M–$4M range.",
    "Dealroom reports ~24 months as the median Seed → Series A journey in Europe.",
    "Dealroom reports ~$2.5–3M of total pre-A capital for companies that reach Series A.",
  ],
  sources: [
    "https://dealroom.co/startup-journey-europe/",
    "https://dealroom.co/regions/europe/",
    "https://dealroom.co/reports/the-state-of-vc-in-italy-2025",
  ],
} as const;

export const useOfFunds: readonly UseOfFundsItem[] = [
  {
    key: "people",
    labelIt: "People",
    labelEn: "People",
    amount: 585_000,
    percent: 58.5,
    purposeIt: "Team core di 5 persone: founder/GTM, CTO, full-stack/AI, network/customer success, growth/content.",
    purposeEn: "Five-person core team: founder/GTM, CTO, full-stack/AI, network/customer success, growth/content.",
  },
  {
    key: "infra",
    labelIt: "Infrastructure / AI / data",
    labelEn: "Infrastructure / AI / data",
    amount: 100_000,
    percent: 10,
    purposeIt: "Inference, storage, observability, enrichment, data pipeline e scaling.",
    purposeEn: "Inference, storage, observability, enrichment, data pipeline and scaling.",
  },
  {
    key: "growth",
    labelIt: "Growth / content / marketing",
    labelEn: "Growth / content / marketing",
    amount: 95_000,
    percent: 9.5,
    purposeIt: "Scuola, SEO, launch, brand, content, eventi ed esperimenti di acquisizione.",
    purposeEn: "School, SEO, launch, brand, content, events and acquisition experiments.",
  },
  {
    key: "legal",
    labelIt: "Legal / compliance / security",
    labelEn: "Legal / compliance / security",
    amount: 45_000,
    percent: 4.5,
    purposeIt: "Corporate, accounting, privacy, contratti, security review e insurance.",
    purposeEn: "Corporate, accounting, privacy, contracts, security reviews and insurance.",
  },
  {
    key: "equipment",
    labelIt: "Equipment & SaaS",
    labelEn: "Equipment & SaaS",
    amount: 20_000,
    percent: 2,
    purposeIt: "Laptops, software seats e strumenti operativi.",
    purposeEn: "Laptops, software seats and operating tools.",
  },
  {
    key: "travel",
    labelIt: "Travel / discovery / partnerships",
    labelEn: "Travel / discovery / partnerships",
    amount: 25_000,
    percent: 2.5,
    purposeIt: "Visite aziende steel, partnership, eventi e discovery europea.",
    purposeEn: "Steel-company visits, partnerships, events and European discovery.",
  },
  {
    key: "reserve",
    labelIt: "Contingency / runway reserve",
    labelEn: "Contingency / runway reserve",
    amount: 130_000,
    percent: 13,
    purposeIt: "Protezione runway, hiring delay, picchi infra, legal/fundraising.",
    purposeEn: "Runway protection, hiring delays, infrastructure spikes and legal/fundraising.",
  },
] as const;

export const milestonePhases: readonly MilestonePhase[] = [
  {
    key: "foundation",
    windowIt: "0–3 mesi",
    windowEn: "Months 0–3",
    titleIt: "Foundation & pilot readiness",
    titleEn: "Foundation & pilot readiness",
    targetsIt: [
      "Costituzione, IP, privacy, security e launch readiness chiusi.",
      "Nucleo tecnico/operativo prioritario inserito.",
      "Pilot esterni controllati avviati.",
      "Pricing e usage instrumentation attivi.",
    ],
    targetsEn: [
      "Company setup, IP, privacy, security and launch readiness completed.",
      "Priority technical/operational core in place.",
      "Controlled external pilots started.",
      "Pricing and usage instrumentation live.",
    ],
  },
  {
    key: "monetization",
    windowIt: "4–9 mesi",
    windowEn: "Months 4–9",
    titleIt: "First monetization evidence",
    titleEn: "First monetization evidence",
    targetsIt: [
      "50 activated organizations.",
      "5 distinct self-service paying organizations.",
      "Almeno 4 dei primi 5 acquistano senza sales call obbligatoria o proposta custom.",
      "Almeno 3 paid organizations restano paid dopo 60 giorni.",
      "Almeno due moduli o il bundle ricevono acquisti organici.",
    ],
    targetsEn: [
      "50 activated organizations.",
      "5 distinct self-service paying organizations.",
      "At least 4 of the first 5 buy without a mandatory sales call or custom proposal.",
      "At least 3 paid organizations remain paid after 60 days.",
      "At least two modules or the bundle receive organic purchases.",
    ],
  },
  {
    key: "repeatability",
    windowIt: "10–18 mesi",
    windowEn: "Months 10–18",
    titleIt: "Repeatability",
    titleEn: "Repeatability",
    targetsIt: [
      "Activation e retention ripetibili.",
      "Scuola/company pages producono acquisizione organica misurabile.",
      "Supplier response ricorrente nel Marketplace/RFQ Hub.",
      "Costi AI/infra/support misurati dentro guardrail sostenibili.",
      "Company graph italiano sufficientemente denso e trusted.",
    ],
    targetsEn: [
      "Repeatable activation and retention.",
      "School/company pages produce measurable organic acquisition.",
      "Recurring supplier response inside Marketplace/RFQ Hub.",
      "Measured AI/infra/support costs remain within sustainable guardrails.",
      "Italian company graph is sufficiently dense and trusted.",
    ],
  },
  {
    key: "next-round",
    windowIt: "19–24 mesi",
    windowEn: "Months 19–24",
    titleIt: "Next-round evidence",
    titleEn: "Next-round evidence",
    targetsIt: [
      "Monetizzazione self-service non episodica.",
      "Retention 60/90 giorni misurata.",
      "Almeno un corridoio cross-border di attivazione validato.",
      "GTM italiano ripetibile.",
      "Evidence sufficiente per decidere espansione europea / Series A path.",
    ],
    targetsEn: [
      "Non-episodic self-service monetization.",
      "Measured 60/90-day retention.",
      "At least one validated cross-border activation corridor.",
      "Repeatable Italian GTM.",
      "Enough evidence to decide on European expansion / Series A path.",
    ],
  },
] as const;

export const screenshotCandidates: readonly ScreenshotCandidate[] = [
  {
    key: "public-home",
    titleIt: "Public Home / positioning",
    titleEn: "Public Home / positioning",
    surface: "/",
    readiness: "candidate",
    slideTargets: [1, 3],
    gateIt: "Visual QA desktop/mobile, copy finale, nessun banner/elemento temporaneo.",
    gateEn: "Desktop/mobile visual QA, final copy, no temporary banner or element.",
  },
  {
    key: "school",
    titleIt: "Scuola / public utility",
    titleEn: "School / public utility",
    surface: "/school",
    readiness: "candidate",
    slideTargets: [4, 5, 11],
    gateIt: "Mostrare utility reale senza sovraccarico informativo.",
    gateEn: "Show real utility without information overload.",
  },
  {
    key: "commercial-memory",
    titleIt: "Commercial Memory / search",
    titleEn: "Commercial Memory / search",
    surface: "/commercial",
    readiness: "candidate",
    slideTargets: [2, 4, 8],
    gateIt: "Usare solo dataset demo non sensibile e risultati leggibili.",
    gateEn: "Use only non-sensitive demo data and readable results.",
  },
  {
    key: "rfq-hub",
    titleIt: "RFQ Hub / quote comparison",
    titleEn: "RFQ Hub / quote comparison",
    surface: "/marketplace/rfq-hub",
    readiness: "candidate",
    slideTargets: [4, 5, 11],
    gateIt: "Campagna demo completa, confronto offerte leggibile, nessun dato reale di tenant.",
    gateEn: "Complete demo campaign, readable quote comparison, no real tenant data.",
  },
  {
    key: "network",
    titleIt: "Network / company discovery",
    titleEn: "Network / company discovery",
    surface: "/network",
    readiness: "candidate",
    slideTargets: [4, 5, 8],
    gateIt: "Densità sufficiente, filtri chiari, profili non fuorvianti.",
    gateEn: "Sufficient density, clear filters and non-misleading profiles.",
  },
  {
    key: "procurement-intelligence",
    titleIt: "Procurement Intelligence",
    titleEn: "Procurement Intelligence",
    surface: "/marketplace/intelligence",
    readiness: "candidate",
    slideTargets: [4, 8, 10],
    gateIt: "Insight basati su dati demo/evidence esplicita, niente claim predittivi non validati.",
    gateEn: "Insights based on demo data/explicit evidence, no unvalidated predictive claims.",
  },
  {
    key: "investor-kpi",
    titleIt: "Investor KPI governance",
    titleEn: "Investor KPI governance",
    surface: "/platform/investor-kpis",
    readiness: "candidate",
    slideTargets: [9, 10],
    gateIt: "Solo vista interna; usare nel deck finale solo metriche realmente investor-safe.",
    gateEn: "Internal view only; use in the final deck only genuinely investor-safe metrics.",
  },
] as const;

export const evidencePack: readonly EvidencePackItem[] = [
  {
    slide: 1,
    key: "cover",
    titleIt: "Cover",
    titleEn: "Cover",
    readiness: "ready",
    claimStatus: "target",
    evidenceIt: ["Brand system UXC1/MKT1", "Positioning MKT2/MKT3"],
    evidenceEn: ["UXC1/MKT1 brand system", "MKT2/MKT3 positioning"],
    gapIt: "Nessuno strutturale.",
    gapEn: "No structural gap.",
    screenshotKey: "public-home",
    nextActionIt: "Selezionare visual finale.",
    nextActionEn: "Select final visual.",
  },
  {
    slide: 2,
    key: "problem",
    titleIt: "Problem",
    titleEn: "Problem",
    readiness: "partial",
    claimStatus: "fact",
    evidenceIt: ["ICP framework", "Jobs-to-be-done", "Founder workflow evidence"],
    evidenceEn: ["ICP framework", "Jobs-to-be-done", "Founder workflow evidence"],
    gapIt: "Mancano interviste/pilot esterni sufficienti a triangolare il problema.",
    gapEn: "External interviews/pilots are still needed to triangulate the problem.",
    screenshotKey: "commercial-memory",
    nextActionIt: "Collegare evidenze qualitative dai primi pilot.",
    nextActionEn: "Attach qualitative evidence from the first pilots.",
  },
  {
    slide: 3,
    key: "why-now",
    titleIt: "Why now",
    titleEn: "Why now",
    readiness: "partial",
    claimStatus: "hypothesis",
    evidenceIt: ["AI-assisted execution", "Current workflow automation capabilities"],
    evidenceEn: ["AI-assisted execution", "Current workflow automation capabilities"],
    gapIt: "Economics reali per azienda attiva ancora da misurare.",
    gapEn: "Real economics per active company still need measurement.",
    screenshotKey: "public-home",
    nextActionIt: "Misurare cost-to-serve e AI cost per active company.",
    nextActionEn: "Measure cost-to-serve and AI cost per active company.",
  },
  {
    slide: 4,
    key: "product",
    titleIt: "Product",
    titleEn: "Product",
    readiness: "ready",
    claimStatus: "fact",
    evidenceIt: ["Merged product releases", "CI/CD", "Commercial Memory", "RFQ Hub", "Network", "Scuola"],
    evidenceEn: ["Merged product releases", "CI/CD", "Commercial Memory", "RFQ Hub", "Network", "School"],
    gapIt: "Serve solo visual QA dei visual selezionati.",
    gapEn: "Only visual QA of selected product visuals is missing.",
    screenshotKey: "rfq-hub",
    nextActionIt: "Approvare 1–2 screenshot prodotto.",
    nextActionEn: "Approve 1–2 product screenshots.",
  },
  {
    slide: 5,
    key: "flywheel",
    titleIt: "Wedge & flywheel",
    titleEn: "Wedge & flywheel",
    readiness: "partial",
    claimStatus: "hypothesis",
    evidenceIt: ["PLG pricing reset", "Claim/company discovery flow", "Network/RFQ architecture"],
    evidenceEn: ["PLG pricing reset", "Claim/company discovery flow", "Network/RFQ architecture"],
    gapIt: "Conversione tra gli step non ancora misurata.",
    gapEn: "Conversion between steps is not yet measured.",
    screenshotKey: "network",
    nextActionIt: "Strumentare funnel activation → paid → network interaction.",
    nextActionEn: "Instrument activation → paid → network interaction funnel.",
  },
  {
    slide: 6,
    key: "market",
    titleIt: "Market",
    titleEn: "Market",
    readiness: "partial",
    claimStatus: "estimate",
    evidenceIt: ["Business Plan market segmentation", "Italy-first ICP"],
    evidenceEn: ["Business Plan market segmentation", "Italy-first ICP"],
    gapIt: "Market sizing deve essere consolidato con fonti investor-grade e deduplicazione.",
    gapEn: "Market sizing needs investor-grade sources and deduplication.",
    nextActionIt: "Refresh TAM/SAM/SOM prima del deck finale.",
    nextActionEn: "Refresh TAM/SAM/SOM before the final deck.",
  },
  {
    slide: 7,
    key: "business-model",
    titleIt: "Business model",
    titleEn: "Business model",
    readiness: "partial",
    claimStatus: "hypothesis",
    evidenceIt: ["Freemium/Product-led pricing reset", "€15 module / €39 Plus working anchors"],
    evidenceEn: ["Freemium/Product-led pricing reset", "€15 module / €39 Plus working anchors"],
    gapIt: "Willingness-to-pay, conversion e retention paid non ancora validate.",
    gapEn: "Willingness-to-pay, conversion and paid retention remain unvalidated.",
    nextActionIt: "Raggiungere first paid cohort gate.",
    nextActionEn: "Reach the first paid cohort gate.",
  },
  {
    slide: 8,
    key: "moat",
    titleIt: "Moat",
    titleEn: "Moat",
    readiness: "partial",
    claimStatus: "hypothesis",
    evidenceIt: ["Steel domain model", "Industry graph", "Commercial workflow data"],
    evidenceEn: ["Steel domain model", "Industry graph", "Commercial workflow data"],
    gapIt: "Data advantage e network effects non sono ancora dimostrati.",
    gapEn: "Data advantage and network effects are not yet demonstrated.",
    screenshotKey: "network",
    nextActionIt: "Misurare density, claims, interaction e supplier response.",
    nextActionEn: "Measure density, claims, interaction and supplier response.",
  },
  {
    slide: 9,
    key: "execution",
    titleIt: "Execution",
    titleEn: "Execution",
    readiness: "ready",
    claimStatus: "fact",
    evidenceIt: ["~280–400 AI-assisted operating hours", "~2,460–3,200 engineering-equivalent hours", "~€250k–€300k replacement development cost", "Production-oriented stack"],
    evidenceEn: ["~280–400 AI-assisted operating hours", "~2,460–3,200 engineering-equivalent hours", "~€250k–€300k replacement development cost", "Production-oriented stack"],
    gapIt: "Replacement cost resta una stima, non valuation.",
    gapEn: "Replacement cost remains an estimate, not valuation.",
    nextActionIt: "Mantenere label estimate su ore/costi equivalenti.",
    nextActionEn: "Keep estimate labels on equivalent hours/costs.",
  },
  {
    slide: 10,
    key: "traction",
    titleIt: "Evidence & traction",
    titleEn: "Evidence & traction",
    readiness: "blocked",
    claimStatus: "fact",
    evidenceIt: ["Investor KPI governance", "Pre-launch measured baseline"],
    evidenceEn: ["Investor KPI governance", "Pre-launch measured baseline"],
    gapIt: "Mancano pilot esterni, paying organizations e retention reale.",
    gapEn: "External pilots, paying organizations and real retention are missing.",
    screenshotKey: "investor-kpi",
    nextActionIt: "Non pubblicare traction slide numerica finché il pilot non produce dati.",
    nextActionEn: "Do not publish a numerical traction slide until pilots produce data.",
  },
  {
    slide: 11,
    key: "gtm",
    titleIt: "Go-to-market",
    titleEn: "Go-to-market",
    readiness: "partial",
    claimStatus: "hypothesis",
    evidenceIt: ["Scuola/SEO → claim → Free Base → self-service paid modules", "Pilot/claim/RFQ sequence"],
    evidenceEn: ["School/SEO → claim → Free Base → self-service paid modules", "Pilot/claim/RFQ sequence"],
    gapIt: "Canale e funnel non ancora ripetibili.",
    gapEn: "Channel and funnel are not repeatable yet.",
    screenshotKey: "school",
    nextActionIt: "Misurare acquisition source e conversione.",
    nextActionEn: "Measure acquisition source and conversion.",
  },
  {
    slide: 12,
    key: "roadmap",
    titleIt: "Roadmap",
    titleEn: "Roadmap",
    readiness: "ready",
    claimStatus: "target",
    evidenceIt: ["Launch 2027 roadmap", "MKT4 milestone contract"],
    evidenceEn: ["Launch 2027 roadmap", "MKT4 milestone contract"],
    gapIt: "Le date restano target operativi, non forecast garantiti.",
    gapEn: "Dates remain operating targets, not guaranteed forecasts.",
    nextActionIt: "Aggiornare con milestone reali durante il pilot.",
    nextActionEn: "Update with actual milestones during pilots.",
  },
  {
    slide: 13,
    key: "founder",
    titleIt: "Founder-market fit",
    titleEn: "Founder-market fit",
    readiness: "ready",
    claimStatus: "fact",
    evidenceIt: ["Esperienza diretta nel workflow commerciale steel/tube", "Ownership product/GTM"],
    evidenceEn: ["Direct steel/tube commercial workflow experience", "Product/GTM ownership"],
    gapIt: "Team slide da espandere solo dopo hiring effettivo.",
    gapEn: "Expand the team slide only after actual hiring.",
    nextActionIt: "Preparare bio founder investor-grade.",
    nextActionEn: "Prepare investor-grade founder bio.",
  },
  {
    slide: 14,
    key: "ask",
    titleIt: "Fundraising ask",
    titleEn: "Fundraising ask",
    readiness: "partial",
    claimStatus: "target",
    evidenceIt: ["€1M / 24-month internal cost model", "5-person core team", "€130k reserve", "European seed benchmark"],
    evidenceEn: ["€1M / 24-month internal cost model", "Five-person core team", "€130k reserve", "European seed benchmark"],
    gapIt: "Valuation, dilution, legal terms e final approval restano aperti.",
    gapEn: "Valuation, dilution, legal terms and final approval remain open.",
    nextActionIt: "Usare €1M come working recommendation; non pubblicare valuation finché non approvata.",
    nextActionEn: "Use €1M as the working recommendation; do not publish valuation until approved.",
  },
] as const;

export function getFundraisingReadiness(locale: BusinessPlanLocale) {
  return {
    ask: {
      ...fundraisingAsk,
      rationale: locale === "it" ? fundraisingAsk.rationaleIt : fundraisingAsk.rationaleEn,
      benchmarkNotes: locale === "it" ? fundraisingAsk.benchmarkNotesIt : fundraisingAsk.benchmarkNotesEn,
    },
    useOfFunds: useOfFunds.map((item) => ({
      ...item,
      label: locale === "it" ? item.labelIt : item.labelEn,
      purpose: locale === "it" ? item.purposeIt : item.purposeEn,
    })),
    milestonePhases: milestonePhases.map((phase) => ({
      ...phase,
      window: locale === "it" ? phase.windowIt : phase.windowEn,
      title: locale === "it" ? phase.titleIt : phase.titleEn,
      targets: locale === "it" ? phase.targetsIt : phase.targetsEn,
    })),
    screenshots: screenshotCandidates.map((item) => ({
      ...item,
      title: locale === "it" ? item.titleIt : item.titleEn,
      gate: locale === "it" ? item.gateIt : item.gateEn,
    })),
    evidencePack: evidencePack.map((item) => ({
      ...item,
      title: locale === "it" ? item.titleIt : item.titleEn,
      evidence: locale === "it" ? item.evidenceIt : item.evidenceEn,
      gap: locale === "it" ? item.gapIt : item.gapEn,
      nextAction: locale === "it" ? item.nextActionIt : item.nextActionEn,
    })),
  };
}
