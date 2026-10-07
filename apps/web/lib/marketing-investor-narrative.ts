import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import type { InvestorScope } from "@/lib/investor-business-plan";

export type MarketingAssetMaturity = "approved" | "draft" | "planned";
export type MarketingAssetVisibility =
  | "internal"
  | "investor_visible"
  | "scope_business_plan"
  | "scope_kpi";

export type MarketingAsset = {
  key: string;
  category: "Narrative" | "Brand" | "Evidence" | "Demo" | "Fundraising";
  maturity: MarketingAssetMaturity;
  visibility: MarketingAssetVisibility;
  requiredScope?: InvestorScope;
  titleIt: string;
  titleEn: string;
  detailIt: string;
  detailEn: string;
  sourceIt: string;
  sourceEn: string;
};

export const marketingAssets: readonly MarketingAsset[] = [
  {
    key: "brand-system",
    category: "Brand",
    maturity: "approved",
    visibility: "investor_visible",
    requiredScope: "marketing",
    titleIt: "Brand System",
    titleEn: "Brand System",
    detailIt: "Identità, palette, accessibilità, tono e regole di comunicazione.",
    detailEn: "Identity, palette, accessibility, tone and communication rules.",
    sourceIt: "MKT1 · UXC1",
    sourceEn: "MKT1 · UXC1",
  },
  {
    key: "investor-narrative",
    category: "Narrative",
    maturity: "approved",
    visibility: "investor_visible",
    requiredScope: "marketing",
    titleIt: "Investor Narrative",
    titleEn: "Investor Narrative",
    detailIt: "Tesi investitori: problema, wedge, espansione, moat, business model ed evidence gap.",
    detailEn: "Investor thesis covering problem, wedge, expansion, moat, business model and evidence gaps.",
    sourceIt: "MKT2",
    sourceEn: "MKT2",
  },
  {
    key: "business-plan",
    category: "Evidence",
    maturity: "approved",
    visibility: "scope_business_plan",
    requiredScope: "business_plan",
    titleIt: "Business Plan",
    titleEn: "Business Plan",
    detailIt: "Business model, mercato, ICP, pricing hypothesis, execution snapshot e roadmap.",
    detailEn: "Business model, market, ICP, pricing hypotheses, execution snapshot and roadmap.",
    sourceIt: "Business Plan · source of truth",
    sourceEn: "Business Plan · source of truth",
  },
  {
    key: "kpi-dashboard",
    category: "Evidence",
    maturity: "approved",
    visibility: "scope_kpi",
    requiredScope: "kpi",
    titleIt: "KPI Dashboard",
    titleEn: "KPI Dashboard",
    detailIt: "Baseline misurate, target e ipotesi mantenuti separati.",
    detailEn: "Measured baselines, targets and hypotheses kept explicitly separate.",
    sourceIt: "Investor KPI · governed snapshot",
    sourceEn: "Investor KPI · governed snapshot",
  },
  {
    key: "public-demo",
    category: "Demo",
    maturity: "approved",
    visibility: "investor_visible",
    requiredScope: "marketing",
    titleIt: "Product entry point",
    titleEn: "Product entry point",
    detailIt: "Ingresso pubblico a Smart Steel Sales per vedere positioning, Scuola e utility.",
    detailEn: "Public Smart Steel Sales entry point for positioning, School and utilities.",
    sourceIt: "smartsteelsales.com",
    sourceEn: "smartsteelsales.com",
  },
  {
    key: "one-pager",
    category: "Fundraising",
    maturity: "approved",
    visibility: "investor_visible",
    requiredScope: "marketing",
    titleIt: "Investor One-pager",
    titleEn: "Investor One-pager",
    detailIt: "Sintesi investor-facing con claim status, evidence note e validation gap espliciti.",
    detailEn: "Investor-facing summary with claim status, evidence notes and explicit validation gaps.",
    sourceIt: "MKT3 · approved",
    sourceEn: "MKT3 · approved",
  },
  {
    key: "pitch-deck-foundation",
    category: "Fundraising",
    maturity: "approved",
    visibility: "internal",
    titleIt: "Pitch Deck Foundation",
    titleEn: "Pitch Deck Foundation",
    detailIt: "Contratto slide-by-slide del deck finale con status ed evidence per ogni tesi.",
    detailEn: "Slide-by-slide contract for the final deck with status and evidence for every thesis.",
    sourceIt: "MKT3 · internal",
    sourceEn: "MKT3 · internal",
  },
  {
    key: "fundraising-readiness",
    category: "Evidence",
    maturity: "approved",
    visibility: "internal",
    titleIt: "Deck Evidence Pack & Fundraising Readiness",
    titleEn: "Deck Evidence Pack & Fundraising Readiness",
    detailIt: "Evidence slide-by-slide, screenshot gate, use of funds, milestone contract e working ask Seed.",
    detailEn: "Slide-by-slide evidence, screenshot gate, use of funds, milestone contract and working Seed ask.",
    sourceIt: "MKT4 · internal",
    sourceEn: "MKT4 · internal",
  },
  {
    key: "investor-deck",
    category: "Fundraising",
    maturity: "draft",
    visibility: "internal",
    titleIt: "Investor Deck",
    titleEn: "Investor Deck",
    detailIt: "Deck fundraising costruito sulla narrativa approvata e sulle metriche realmente validate.",
    detailEn: "Fundraising deck built from the approved narrative and genuinely validated metrics.",
    sourceIt: "MKT4 · evidence-linked draft",
    sourceEn: "MKT4 · evidence-linked draft",
  },
  {
    key: "approved-screenshots",
    category: "Demo",
    maturity: "planned",
    visibility: "internal",
    titleIt: "Approved Product Screenshots",
    titleEn: "Approved Product Screenshots",
    detailIt: "Set visuale controllato da produrre dopo il visual QA delle superfici chiave.",
    detailEn: "Controlled visual set to produce after visual QA of the key product surfaces.",
    sourceIt: "Visual QA backlog",
    sourceEn: "Visual QA backlog",
  },
] as const;

const narrative = {
  it: {
    stage: "Pre-launch · pilot readiness",
    title: "La tesi investitori in una pagina",
    lead:
      "Smart Steel Sales sta costruendo il Commercial OS verticale per la filiera steel & tube: prima risolve lavoro quotidiano ad alto attrito, poi trasforma quei workflow in dati strutturati e infine li collega a un network industriale transazionale.",
    cards: [
      {
        label: "01 · Why now",
        title: "Il lavoro commerciale è ancora frammentato",
        body:
          "Email, Excel, PDF ed ERP custodiscono pezzi diversi della relazione commerciale. Il problema non è la mancanza di software, ma la mancanza di una memoria e di un workflow verticale condiviso tra vendita, procurement e network.",
      },
      {
        label: "02 · Wedge",
        title: "Utility prima del network effect",
        body:
          "Scuola e calcolatori generano utilità pubblica; Commercial Memory e RFQ Hub risolvono problemi privati ad alta frequenza. Il Network entra dopo come asset di discovery, qualificazione e interazione.",
      },
      {
        label: "03 · Product",
        title: "Un sistema operativo commerciale, non una feature AI",
        body:
          "Memoria privata, procurement, RFQ multi-fornitore, pricing, company graph, marketplace e intelligence convivono sullo stesso dominio steel. L’AI accelera ricerca, normalizzazione e decision support ma non è il prodotto da sola.",
      },
      {
        label: "04 · Moat",
        title: "Il vantaggio cresce con l’uso",
        body:
          "Domain model steel, dati commerciali strutturati, industry graph e interaction data si rafforzano insieme. Il software è replicabile; la combinazione di dati, workflow e network diventa progressivamente più difficile da copiare.",
      },
      {
        label: "05 · Business model",
        title: "SaaS B2B prima, network monetization dopo",
        body:
          "La tesi economica parte da ricavi per azienda/seat e moduli premium. Network, verification, data services e marketplace possono ampliare ARPA e monetizzazione solo quando utilità e liquidità saranno dimostrate.",
      },
      {
        label: "06 · Vision",
        title: "Infrastruttura commerciale europea per steel & tube",
        body:
          "L’ambizione è diventare il livello operativo dove aziende steel cercano, ricordano, quotano, acquistano, vendono e scoprono controparti con contesto e governance verticali.",
      },
    ],
    evidenceTitle: "Cosa possiamo già dimostrare",
    evidence: [
      "Prodotto multi-modulo già implementato su stack production-oriented con CI/CD, Supabase, Vercel e Railway.",
      "Commercial Memory, Network, Scuola pubblica, onboarding/RBAC, Marketplace foundation, pricing utility e RFQ Hub sono già presenti nel perimetro prodotto.",
      "La velocità di execution è documentata internamente; il Business Plan separa ore AI-assisted, engineering-equivalent e replacement cost.",
      "Investor Room già governata con password dedicata, scadenza, revoca, sessione e scope indipendenti.",
    ],
    gapsTitle: "Cosa non chiamiamo ancora traction",
    gaps: [
      "Conversione free → paid e willingness-to-pay reale.",
      "Retention 30/90 giorni su clienti esterni.",
      "CAC, sales cycle e costo di onboarding.",
      "Liquidità del Network e volume di interazioni originate dalla piattaforma.",
      "Pricing definitivo, ARPA per segmento e gross margin dopo supporto e usage AI.",
    ],
    principle:
      "Regola: feature costruite ≠ traction; seed database ≠ network liquidity; replacement cost ≠ valuation. Ogni numero esterno deve avere una fonte, ogni simulazione deve essere etichettata.",
  },
  en: {
    stage: "Pre-launch · pilot readiness",
    title: "The investor thesis on one page",
    lead:
      "Smart Steel Sales is building the vertical Commercial OS for the steel & tube value chain: first it removes high-friction daily work, then turns those workflows into structured data, and finally connects them to an industrial transaction network.",
    cards: [
      {
        label: "01 · Why now",
        title: "Commercial work is still fragmented",
        body:
          "Email, Excel, PDFs and ERPs hold different fragments of the commercial relationship. The core problem is not a lack of software; it is the absence of a shared vertical memory and workflow across sales, procurement and network activity.",
      },
      {
        label: "02 · Wedge",
        title: "Utility before network effects",
        body:
          "School and calculators create public utility; Commercial Memory and the RFQ Hub solve high-frequency private problems. The Network follows as a discovery, qualification and interaction asset.",
      },
      {
        label: "03 · Product",
        title: "A commercial operating system, not an AI feature",
        body:
          "Private memory, procurement, multi-supplier RFQs, pricing, company graph, marketplace and intelligence share the same steel domain. AI accelerates retrieval, normalization and decision support, but it is not the product by itself.",
      },
      {
        label: "04 · Moat",
        title: "The advantage compounds with usage",
        body:
          "Steel domain model, structured commercial data, industry graph and interaction data reinforce one another. Software can be replicated; the combined data, workflow and network layer becomes progressively harder to reproduce.",
      },
      {
        label: "05 · Business model",
        title: "B2B SaaS first, network monetization later",
        body:
          "The economic thesis starts with company/seat revenue and premium modules. Network, verification, data services and marketplace monetization expand only after utility and liquidity are demonstrated.",
      },
      {
        label: "06 · Vision",
        title: "European commercial infrastructure for steel & tube",
        body:
          "The ambition is to become the operating layer where steel companies search, remember, quote, buy, sell and discover counterparties with vertical context and governance.",
      },
    ],
    evidenceTitle: "What we can already evidence",
    evidence: [
      "A multi-module product is already implemented on a production-oriented stack with CI/CD, Supabase, Vercel and Railway.",
      "Commercial Memory, Network, public School, onboarding/RBAC, Marketplace foundation, pricing utility and the RFQ Hub already exist in the product perimeter.",
      "Execution velocity is documented internally; the Business Plan separates AI-assisted hours, engineering-equivalent hours and replacement cost.",
      "The Investor Room is already governed with dedicated passwords, expiry, revocation, sessions and independent scopes.",
    ],
    gapsTitle: "What we do not call traction yet",
    gaps: [
      "Free-to-paid conversion and real willingness to pay.",
      "30/90-day retention across external customers.",
      "CAC, sales cycle and onboarding cost.",
      "Network liquidity and platform-originated interaction volume.",
      "Final pricing, segment ARPA and gross margin after support and AI usage.",
    ],
    principle:
      "Rule: shipped features ≠ traction; seeded database ≠ network liquidity; replacement cost ≠ valuation. Every external number needs a source and every simulation must be labeled.",
  },
} as const;

export function getInvestorNarrative(locale: BusinessPlanLocale) {
  return narrative[locale];
}

export function assetLabel(asset: MarketingAsset, locale: BusinessPlanLocale) {
  return {
    title: locale === "it" ? asset.titleIt : asset.titleEn,
    detail: locale === "it" ? asset.detailIt : asset.detailEn,
    source: locale === "it" ? asset.sourceIt : asset.sourceEn,
  };
}
