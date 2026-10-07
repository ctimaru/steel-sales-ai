import type { BusinessPlanLocale } from "@/lib/business-plan-locale";

export type ClaimStatus = "fact" | "estimate" | "hypothesis" | "target";

export type OnePagerBlock = {
  key: string;
  labelIt: string;
  labelEn: string;
  titleIt: string;
  titleEn: string;
  bodyIt: string;
  bodyEn: string;
  status: ClaimStatus;
  evidenceIt: string;
  evidenceEn: string;
};

export type PitchDeckSlide = {
  number: number;
  key: string;
  titleIt: string;
  titleEn: string;
  thesisIt: string;
  thesisEn: string;
  status: ClaimStatus;
  evidenceIt: string;
  evidenceEn: string;
  contentIt: readonly string[];
  contentEn: readonly string[];
};

export const onePagerBlocks: readonly OnePagerBlock[] = [
  {
    key: "problem",
    labelIt: "Problema",
    labelEn: "Problem",
    titleIt: "La conoscenza commerciale steel è ancora dispersa",
    titleEn: "Steel commercial knowledge is still fragmented",
    bodyIt:
      "Email, Excel, PDF ed ERP custodiscono parti diverse di clienti, fornitori, prezzi, RFQ e trattative. Il risultato è recupero lento delle informazioni, dipendenza dalla memoria personale e poca continuità tra vendita e procurement.",
    bodyEn:
      "Email, Excel, PDFs and ERPs hold different fragments of customers, suppliers, pricing, RFQs and negotiations. The result is slow retrieval, dependence on individual memory and weak continuity between sales and procurement.",
    status: "fact",
    evidenceIt: "Tesi problema derivata dall'ICP e dai workflow target documentati nel Business Plan.",
    evidenceEn: "Problem thesis derived from the ICP and target workflows documented in the Business Plan.",
  },
  {
    key: "why-now",
    labelIt: "Perché ora",
    labelEn: "Why now",
    titleIt: "L'AI rende economicamente praticabile strutturare workflow prima troppo costosi",
    titleEn: "AI makes previously expensive workflow structuring economically practical",
    bodyIt:
      "Document understanding, retrieval, normalizzazione e decision support riducono il costo operativo necessario per trasformare email, PDF e dati destrutturati in memoria commerciale utilizzabile.",
    bodyEn:
      "Document understanding, retrieval, normalization and decision support reduce the operating cost required to turn email, PDFs and unstructured data into usable commercial memory.",
    status: "hypothesis",
    evidenceIt: "Tesi tecnologica coerente con il prodotto; gli economics reali devono essere validati sui pilot.",
    evidenceEn: "Technology thesis consistent with the product; real economics must be validated through pilots.",
  },
  {
    key: "product",
    labelIt: "Prodotto",
    labelEn: "Product",
    titleIt: "Un Commercial OS verticale per steel & tube",
    titleEn: "A vertical Commercial OS for steel & tube",
    bodyIt:
      "Commercial Memory, RFQ Hub, procurement intelligence, pricing, company graph, Network, Marketplace e Scuola condividono lo stesso dominio industriale e trasformano dati destrutturati in workflow operativi.",
    bodyEn:
      "Commercial Memory, the RFQ Hub, procurement intelligence, pricing, company graph, Network, Marketplace and School share the same industrial domain and turn unstructured data into operational workflows.",
    status: "fact",
    evidenceIt: "Moduli già presenti nel perimetro prodotto e tracciati nella roadmap di progetto.",
    evidenceEn: "Modules already present in the product perimeter and tracked in the project roadmap.",
  },
  {
    key: "wedge",
    labelIt: "Wedge",
    labelEn: "Wedge",
    titleIt: "Utility individuale prima del network effect",
    titleEn: "Individual utility before network effects",
    bodyIt:
      "La strategia parte da valore immediato per singolo utente e azienda: ricerca, memoria, distinta/RFQ e procurement. Il Network viene attivato come layer successivo di discovery, qualificazione e interazione.",
    bodyEn:
      "The strategy starts with immediate value for individual users and companies: search, memory, RFQ preparation and procurement. The Network is activated later as a discovery, qualification and interaction layer.",
    status: "fact",
    evidenceIt: "Principio di prodotto e GTM già approvato nel Business Plan.",
    evidenceEn: "Product and GTM principle already approved in the Business Plan.",
  },
  {
    key: "business-model",
    labelIt: "Business model",
    labelEn: "Business model",
    titleIt: "SaaS B2B prima, monetizzazione network dopo",
    titleEn: "B2B SaaS first, network monetization later",
    bodyIt:
      "Ricavi per azienda/seat e moduli premium costituiscono la base. Verification, data services e marketplace possono espandere ARPA soltanto dopo aver dimostrato utilità e liquidità.",
    bodyEn:
      "Company/seat revenue and premium modules form the base. Verification, data services and marketplace monetization can expand ARPA only after utility and liquidity are demonstrated.",
    status: "hypothesis",
    evidenceIt: "Packaging e pricing sono ancora ipotesi da validare con pilot e clienti paganti.",
    evidenceEn: "Packaging and pricing remain hypotheses to validate through pilots and paying customers.",
  },
  {
    key: "moat",
    labelIt: "Moat",
    labelEn: "Moat",
    titleIt: "Dati + workflow + graph industriale",
    titleEn: "Data + workflows + industrial graph",
    bodyIt:
      "Il vantaggio potenziale nasce dall'unione di domain model steel, dati commerciali strutturati, industry graph e interaction data. Ogni layer aumenta il valore degli altri.",
    bodyEn:
      "The potential moat comes from combining the steel domain model, structured commercial data, an industry graph and interaction data. Each layer increases the value of the others.",
    status: "hypothesis",
    evidenceIt: "Moat thesis definita; difendibilità e network effects devono ancora essere provati sul mercato.",
    evidenceEn: "The moat thesis is defined; defensibility and network effects still need market validation.",
  },
  {
    key: "market",
    labelIt: "Mercato",
    labelEn: "Market",
    titleIt: "Italia come beachhead, Europa come spazio di espansione",
    titleEn: "Italy as the beachhead, Europe as the expansion space",
    bodyIt:
      "Il Business Plan mantiene separati core market, serviceable industrial network e broad industrial universe. La strategia è validare ICP e GTM in Italia prima di estendere il modello europeo.",
    bodyEn:
      "The Business Plan keeps core market, serviceable industrial network and broad industrial universe separate. The strategy is to validate ICP and GTM in Italy before extending the model across Europe.",
    status: "estimate",
    evidenceIt: "Market sizing e fonti restano nella sezione Business Plan dedicata; il one-pager non somma universi non deduplicati.",
    evidenceEn: "Market sizing and sources remain in the dedicated Business Plan section; the one-pager does not add non-deduplicated universes.",
  },
  {
    key: "execution",
    labelIt: "Execution",
    labelEn: "Execution",
    titleIt: "La piattaforma è già molto oltre il concept",
    titleEn: "The platform is already well beyond concept stage",
    bodyIt:
      "La base comprende infrastruttura production-oriented, Commercial Memory, Network, Scuola, onboarding/RBAC, pricing utility, Marketplace foundation e RFQ Hub multi-fornitore.",
    bodyEn:
      "The current base includes production-oriented infrastructure, Commercial Memory, Network, School, onboarding/RBAC, pricing utility, Marketplace foundation and a multi-supplier RFQ Hub.",
    status: "fact",
    evidenceIt: "Stato prodotto documentato da codice, CI/CD, roadmap e release già mergiate.",
    evidenceEn: "Product state documented by code, CI/CD, roadmap and merged releases.",
  },
  {
    key: "vision",
    labelIt: "Vision",
    labelEn: "Vision",
    titleIt: "Infrastruttura commerciale europea per steel & tube",
    titleEn: "European commercial infrastructure for steel & tube",
    bodyIt:
      "L'obiettivo è diventare il livello operativo dove aziende steel cercano, ricordano, quotano, acquistano, vendono e scoprono controparti con contesto e governance verticali.",
    bodyEn:
      "The goal is to become the operating layer where steel companies search, remember, quote, buy, sell and discover counterparties with vertical context and governance.",
    status: "target",
    evidenceIt: "Visione di lungo periodo; non è una posizione di mercato già raggiunta.",
    evidenceEn: "Long-term vision; not a market position already achieved.",
  },
] as const;

export const validationGaps = {
  it: [
    "Pricing e willingness-to-pay reali.",
    "Conversione free → paid.",
    "Retention 30/90 giorni su clienti esterni.",
    "CAC, sales cycle e costo onboarding.",
    "Liquidità del Network e volume di interazioni originate dalla piattaforma.",
  ],
  en: [
    "Real pricing and willingness to pay.",
    "Free-to-paid conversion.",
    "30/90-day retention across external customers.",
    "CAC, sales cycle and onboarding cost.",
    "Network liquidity and platform-originated interaction volume.",
  ],
} as const;

export const pitchDeckSlides: readonly PitchDeckSlide[] = [
  {
    number: 1,
    key: "cover",
    titleIt: "Smart Steel Sales",
    titleEn: "Smart Steel Sales",
    thesisIt: "The Commercial OS for steel & tube.",
    thesisEn: "The Commercial OS for steel & tube.",
    status: "target",
    evidenceIt: "Posizionamento strategico.",
    evidenceEn: "Strategic positioning.",
    contentIt: ["Brand", "Tagline", "Pre-launch · pilot readiness"],
    contentEn: ["Brand", "Tagline", "Pre-launch · pilot readiness"],
  },
  {
    number: 2,
    key: "problem",
    titleIt: "Il problema",
    titleEn: "The problem",
    thesisIt: "La conoscenza commerciale resta intrappolata in strumenti e persone diverse.",
    thesisEn: "Commercial knowledge remains trapped across different tools and people.",
    status: "fact",
    evidenceIt: "ICP, workflow e jobs-to-be-done documentati.",
    evidenceEn: "Documented ICP, workflows and jobs-to-be-done.",
    contentIt: ["Email + Excel + PDF + ERP", "Recupero lento", "Memoria personale", "Vendita e procurement disconnessi"],
    contentEn: ["Email + Excel + PDF + ERP", "Slow retrieval", "Individual memory", "Disconnected sales and procurement"],
  },
  {
    number: 3,
    key: "why-now",
    titleIt: "Perché ora",
    titleEn: "Why now",
    thesisIt: "AI e workflow automation abbassano il costo di strutturare dati commerciali destrutturati.",
    thesisEn: "AI and workflow automation lower the cost of structuring unstructured commercial data.",
    status: "hypothesis",
    evidenceIt: "Tesi tecnologica da validare con economics reali di uso.",
    evidenceEn: "Technology thesis to validate with real usage economics.",
    contentIt: ["Document understanding", "Search & retrieval", "Normalization", "Decision support"],
    contentEn: ["Document understanding", "Search & retrieval", "Normalization", "Decision support"],
  },
  {
    number: 4,
    key: "product",
    titleIt: "Il prodotto",
    titleEn: "The product",
    thesisIt: "Un unico dominio steel collega memoria privata, procurement e network.",
    thesisEn: "One steel domain connects private memory, procurement and network activity.",
    status: "fact",
    evidenceIt: "Perimetro prodotto già implementato.",
    evidenceEn: "Implemented product perimeter.",
    contentIt: ["Commercial Memory", "RFQ Hub", "Procurement Intelligence", "Network", "Marketplace", "Scuola"],
    contentEn: ["Commercial Memory", "RFQ Hub", "Procurement Intelligence", "Network", "Marketplace", "School"],
  },
  {
    number: 5,
    key: "flywheel",
    titleIt: "Wedge & flywheel",
    titleEn: "Wedge & flywheel",
    thesisIt: "Utility individuale → dati strutturati → adozione team → graph → interazioni → intelligence.",
    thesisEn: "Individual utility → structured data → team adoption → graph → interactions → intelligence.",
    status: "hypothesis",
    evidenceIt: "Sequenza GTM approvata; flywheel ancora da dimostrare.",
    evidenceEn: "Approved GTM sequence; flywheel still to be demonstrated.",
    contentIt: ["Utility", "Private workflow", "Team", "Company graph", "Network interaction", "Compounding intelligence"],
    contentEn: ["Utility", "Private workflow", "Team", "Company graph", "Network interaction", "Compounding intelligence"],
  },
  {
    number: 6,
    key: "market",
    titleIt: "Mercato",
    titleEn: "Market",
    thesisIt: "Italia come beachhead, Europa come espansione naturale dopo la validazione.",
    thesisEn: "Italy as the beachhead, Europe as the natural expansion after validation.",
    status: "estimate",
    evidenceIt: "Market sizing e fonti sono mantenuti nel Business Plan; core, serviceable e broad universe restano distinti.",
    evidenceEn: "Market sizing and sources live in the Business Plan; core, serviceable and broad universe remain separated.",
    contentIt: ["Italy core", "Serviceable industrial network", "European distribution ecosystem", "Broad industrial adjacency"],
    contentEn: ["Italy core", "Serviceable industrial network", "European distribution ecosystem", "Broad industrial adjacency"],
  },
  {
    number: 7,
    key: "business-model",
    titleIt: "Business model",
    titleEn: "Business model",
    thesisIt: "SaaS B2B come motore economico primario.",
    thesisEn: "B2B SaaS as the primary economic engine.",
    status: "hypothesis",
    evidenceIt: "Packaging e pricing sono ancora da validare con utenti e aziende paganti.",
    evidenceEn: "Packaging and pricing still need validation with users and paying companies.",
    contentIt: ["Company / seat", "Premium modules", "Network premium", "Data services", "Marketplace later"],
    contentEn: ["Company / seat", "Premium modules", "Network premium", "Data services", "Marketplace later"],
  },
  {
    number: 8,
    key: "moat",
    titleIt: "Moat",
    titleEn: "Moat",
    thesisIt: "Il software è replicabile; la combinazione di dati, workflow e graph lo è meno.",
    thesisEn: "Software can be replicated; the combination of data, workflows and graph is harder to reproduce.",
    status: "hypothesis",
    evidenceIt: "Domain model e graph esistono; network effects e data advantage devono ancora maturare.",
    evidenceEn: "The domain model and graph exist; network effects and data advantage still need to mature.",
    contentIt: ["Steel ontology", "Commercial workflow data", "Industry graph", "Interaction data"],
    contentEn: ["Steel ontology", "Commercial workflow data", "Industry graph", "Interaction data"],
  },
  {
    number: 9,
    key: "execution",
    titleIt: "Execution",
    titleEn: "Execution",
    thesisIt: "Molto prodotto costruito con elevata capital efficiency.",
    thesisEn: "Substantial product built with high capital efficiency.",
    status: "fact",
    evidenceIt: "Execution snapshot documentato; replacement cost resta una stima e non una valuation.",
    evidenceEn: "Documented execution snapshot; replacement cost remains an estimate, not a valuation.",
    contentIt: ["Production-oriented stack", "Multi-module product", "CI/CD", "Governance", "AI-assisted execution"],
    contentEn: ["Production-oriented stack", "Multi-module product", "CI/CD", "Governance", "AI-assisted execution"],
  },
  {
    number: 10,
    key: "traction",
    titleIt: "Evidence & traction",
    titleEn: "Evidence & traction",
    thesisIt: "Measured, target e hypothesis devono restare separati.",
    thesisEn: "Measured, target and hypothesis must remain separate.",
    status: "fact",
    evidenceIt: "Investor KPI governance già implementata.",
    evidenceEn: "Investor KPI governance already implemented.",
    contentIt: ["Measured baseline", "Targets", "Hypotheses", "Pilot evidence"],
    contentEn: ["Measured baseline", "Targets", "Hypotheses", "Pilot evidence"],
  },
  {
    number: 11,
    key: "gtm",
    titleIt: "Go-to-market",
    titleEn: "Go-to-market",
    thesisIt: "Pilot → claim company → team adoption → RFQ/network activation → expansion.",
    thesisEn: "Pilot → company claim → team adoption → RFQ/network activation → expansion.",
    status: "hypothesis",
    evidenceIt: "Sequenza GTM definita ma non ancora validata su scala.",
    evidenceEn: "GTM sequence defined but not yet validated at scale.",
    contentIt: ["Pilot", "Claim", "Team", "RFQ", "Network", "Expansion"],
    contentEn: ["Pilot", "Claim", "Team", "RFQ", "Network", "Expansion"],
  },
  {
    number: 12,
    key: "roadmap",
    titleIt: "Roadmap",
    titleEn: "Roadmap",
    thesisIt: "Dal pilot a clienti paganti, poi espansione europea.",
    thesisEn: "From pilot to paying customers, then European expansion.",
    status: "target",
    evidenceIt: "Roadmap operativa, non forecast garantito.",
    evidenceEn: "Operating roadmap, not a guaranteed forecast.",
    contentIt: ["Pilot acceptance", "Launch readiness", "First paying companies", "Repeatable GTM", "European expansion"],
    contentEn: ["Pilot acceptance", "Launch readiness", "First paying companies", "Repeatable GTM", "European expansion"],
  },
  {
    number: 13,
    key: "founder",
    titleIt: "Founder-market fit",
    titleEn: "Founder-market fit",
    thesisIt: "Il prodotto nasce da esperienza commerciale diretta nel settore tubi/acciaio.",
    thesisEn: "The product originates from direct commercial experience in the steel/tube industry.",
    status: "fact",
    evidenceIt: "Founder background documentato nel Business Plan.",
    evidenceEn: "Founder background documented in the Business Plan.",
    contentIt: ["Direct steel/tube sales experience", "Workflow familiarity", "Industry network understanding"],
    contentEn: ["Direct steel/tube sales experience", "Workflow familiarity", "Industry network understanding"],
  },
  {
    number: 14,
    key: "ask",
    titleIt: "Fundraising ask",
    titleEn: "Fundraising ask",
    thesisIt: "Round size, use of funds e milestone restano placeholder finché non vengono approvati.",
    thesisEn: "Round size, use of funds and milestones remain placeholders until approved.",
    status: "target",
    evidenceIt: "Nessun ask definitivo è stato approvato.",
    evidenceEn: "No final fundraising ask has been approved.",
    contentIt: ["Round size · TBD", "Use of funds · TBD", "Milestones · TBD"],
    contentEn: ["Round size · TBD", "Use of funds · TBD", "Milestones · TBD"],
  },
] as const;

export function getOnePagerCopy(locale: BusinessPlanLocale) {
  return {
    eyebrow: "MKT3 · Investor One-pager",
    title:
      locale === "it"
        ? "Il Commercial OS per chi compra e vende acciaio"
        : "The Commercial OS for companies buying and selling steel",
    subtitle:
      locale === "it"
        ? "Smart Steel Sales trasforma memoria commerciale, procurement e network industriale in un unico sistema verticale per steel & tube."
        : "Smart Steel Sales turns commercial memory, procurement and industrial network activity into one vertical system for steel & tube.",
    blocks: onePagerBlocks.map((block) => ({
      ...block,
      label: locale === "it" ? block.labelIt : block.labelEn,
      title: locale === "it" ? block.titleIt : block.titleEn,
      body: locale === "it" ? block.bodyIt : block.bodyEn,
      evidence: locale === "it" ? block.evidenceIt : block.evidenceEn,
    })),
    gaps: validationGaps[locale],
  };
}

export function getPitchDeckSlides(locale: BusinessPlanLocale) {
  return pitchDeckSlides.map((slide) => ({
    ...slide,
    title: locale === "it" ? slide.titleIt : slide.titleEn,
    thesis: locale === "it" ? slide.thesisIt : slide.thesisEn,
    evidence: locale === "it" ? slide.evidenceIt : slide.evidenceEn,
    content: locale === "it" ? slide.contentIt : slide.contentEn,
  }));
}
