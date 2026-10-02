export const BUSINESS_PLAN_VERSION = "Investor Draft 0.2";

export const businessPlanSnapshot = {
  stage: "Product-ready web SaaS",
  currentFocus: "ICP evidence & market segmentation",
  launchWindow: "2027 controlled launch",
  thesis:
    "Smart Steel Sales is the vertical commercial operating system for the steel and tube industry: private commercial memory, trusted industry network, demand marketplace and technical knowledge in one governed product.",
} as const;

export const productPillars = [
  {
    key: "commercial-memory",
    title: "Commercial Memory",
    label: "Private system of record",
    description:
      "Turns fragmented email, RFQs, offers, orders, contacts and price history into reusable company intelligence.",
    value:
      "Less time searching for old commercial information; faster quoting, follow-up and account reactivation.",
  },
  {
    key: "network",
    title: "Steel Industry Network",
    label: "Trusted discovery layer",
    description:
      "Claimable company profiles, industrial taxonomy, relationships, follows, trust and identity governance.",
    value:
      "A structured map of who produces, trades, processes and buys steel and tubes.",
  },
  {
    key: "marketplace",
    title: "Marketplace",
    label: "Demand activation layer",
    description:
      "Structured buyer demand matched to relevant suppliers with governed unlock and response flows.",
    value:
      "Transforms latent demand into measurable commercial opportunities without exposing private tenant data.",
  },
  {
    key: "school",
    title: "Scuola",
    label: "Public technical acquisition layer",
    description:
      "Open standards, grades, tube dimensions, calculators and technical content designed for search discovery.",
    value:
      "Builds authority and organic acquisition while keeping public knowledge separate from private commercial memory.",
  },
] as const;

export const marketEvidence = [
  {
    metric: "144",
    label: "ASSOFERMET Acciai member companies",
    detail:
      "ASSOFERMET states that its steel-distribution members represent about 80% of Italian steel distribution.",
    implication:
      "The Italian distribution beachhead is concentrated enough for account-based GTM and association-led discovery.",
    source: "ASSOFERMET Acciai",
    sourceUrl: "https://www.assofermet.it/settore-acciai",
  },
  {
    metric: ">160k",
    label: "downstream customer companies served",
    detail:
      "ASSOFERMET's industry brochure describes the distribution sector as serving more than 160,000 customer companies across Italian industry.",
    implication:
      "Distributors sit at a high-connectivity point in the value chain and can seed both buyer and supplier network effects.",
    source: "ASSOFERMET industry brochure",
    sourceUrl:
      "https://www.assofermet.it/source/Brochure/brochure_assofermet.pdf",
  },
  {
    metric: "~3,500",
    label: "European distribution/intermediation companies",
    detail:
      "EUROMETAL says its associated federations represent about 3,500 companies across stockholding, service centres, processors and traders.",
    implication:
      "A distributor-first wedge has a credible European expansion path after an Italy-first launch.",
    source: "EUROMETAL",
    sourceUrl: "https://eurometal.net/membership/",
  },
  {
    metric: "130",
    label: "Federacciai member companies",
    detail:
      "Federacciai reports 130 member companies representing more than 95% of Italian steel production and transformation, with 20.7 Mt produced in 2025.",
    implication:
      "Producers form a concentrated second ICP with strong strategic value, but a more enterprise-oriented buying motion.",
    source: "Federacciai",
    sourceUrl: "https://federacciai.it/profilo-e-storia/",
  },
  {
    metric: "75.6%",
    label: "Italian enterprises buying cloud services",
    detail:
      "Eurostat reports Italy among Europe's highest-cloud-adoption markets in 2025.",
    implication:
      "Cloud delivery is not the main adoption barrier for the target geography.",
    source: "Eurostat",
    sourceUrl:
      "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20260203-1",
  },
  {
    metric: "21.1%",
    label: "Italian SMEs using CRM",
    detail:
      "ISTAT reports CRM use at 21.1% among Italian SMEs in 2025, versus 48.8% for ERP.",
    implication:
      "Commercial digitisation materially lags core management-software adoption, leaving room for a focused commercial layer.",
    source: "ISTAT · Imprese e ICT 2025",
    sourceUrl:
      "https://www.istat.it/comunicato-stampa/imprese-e-ict-anno-2025/",
  },
  {
    metric: "+0.1%",
    label: "EU apparent steel consumption forecast for 2026",
    detail:
      "EUROFER's September 2026 outlook expects almost-flat EU steel demand in 2026, followed by +2.3% in 2027.",
    implication:
      "In a low-growth environment, better commercial execution, retention and account reactivation become economically relevant wedges.",
    source: "EUROFER · Q3 2026 outlook",
    sourceUrl:
      "https://ftp.eurofer.eu/publications/economic-market-outlook/economic-and-steel-market-outlook-2026-2027-third-quarter",
  },
] as const;

export const icpDecisionCriteria = [
  { key: "pain", label: "Pain intensity", weight: "25%" },
  { key: "frequency", label: "Workflow frequency", weight: "20%" },
  { key: "wedge", label: "Commercial Memory fit", weight: "20%" },
  { key: "access", label: "GTM accessibility", weight: "15%" },
  { key: "digital", label: "Digital readiness", weight: "10%" },
  { key: "network", label: "Network leverage", weight: "10%" },
] as const;

export const icpScorecard = [
  {
    rank: 1,
    segment: "Commercianti / stockholder",
    score: 4.9,
    confidence: "Medium-high",
    scores: {
      pain: 5,
      frequency: 5,
      wedge: 5,
      access: 5,
      digital: 4,
      network: 5,
    },
    decision:
      "Beachhead ICP. Start in Italy with steel/tube distributors and stockholders managing recurring B2B accounts, multi-supplier sourcing and quote-heavy workflows.",
  },
  {
    rank: 2,
    segment: "Produttori",
    score: 4.0,
    confidence: "Medium",
    scores: {
      pain: 4,
      frequency: 4,
      wedge: 4,
      access: 4,
      digital: 4,
      network: 4,
    },
    decision:
      "Second ICP. Strong strategic fit for Commercial Memory and demand visibility, but likely a more enterprise-led sales and integration motion.",
  },
  {
    rank: 3,
    segment: "Terzisti / processor",
    score: 3.8,
    confidence: "Medium-low",
    scores: {
      pain: 4,
      frequency: 4,
      wedge: 3.5,
      access: 3.5,
      digital: 3.5,
      network: 4,
    },
    decision:
      "Network/Marketplace expansion segment. Validate whether quote history and capability discovery are strong enough to justify a standalone paid seat.",
  },
  {
    rank: 4,
    segment: "Utilizzatori industriali",
    score: 2.9,
    confidence: "Low",
    scores: {
      pain: 3,
      frequency: 3,
      wedge: 2.5,
      access: 2,
      digital: 3,
      network: 4,
    },
    decision:
      "Demand-side segment, not first paid wedge. Prioritise Marketplace, supplier discovery and Scuola before the full Commercial Memory proposition.",
  },
] as const;

export const beachheadProfile = {
  name: "Italian steel/tube distributor or stockholder",
  status: "Evidence-supported hypothesis",
  mustHave: [
    "Recurring B2B RFQs and quotations rather than occasional transactional sales.",
    "Multiple commercial users sharing customer, supplier and product knowledge.",
    "Meaningful price-history and prior-quote reuse in daily selling.",
    "Commercial information fragmented across email, PDFs, spreadsheets and ERP screens.",
    "Frequent need to source products, compare suppliers or reactivate dormant accounts.",
  ],
  positiveSignals: [
    "Sales Director or owner asks for visibility across reps and account history.",
    "New salesperson onboarding requires reconstructing years of commercial context.",
    "Quote response speed and historical price retrieval are recurring pain points.",
    "Company already uses cloud/ERP but lacks a satisfying commercial intelligence layer.",
    "Company serves many industrial customers and can contribute to Network density.",
  ],
  deprioritise: [
    "Single-person brokers with little reusable company memory.",
    "Companies looking primarily for warehouse, accounting or production ERP replacement.",
    "End users with low RFQ frequency and no commercial sales-memory use case.",
    "Large enterprises requiring deep bespoke integration before any usable pilot.",
  ],
} as const;

export const icpSegments = [
  {
    rank: 1,
    fit: "Beachhead ICP",
    segment: "Commercianti / stockholder di tubi e acciaio",
    whyNow:
      "The segment combines high quotation frequency, repeat-customer history, supplier discovery and a concentrated Italian market structure. External market evidence now supports keeping this segment first.",
    coreJobs: [
      "Recuperare rapidamente prezzi, offerte e trattative precedenti.",
      "Trasformare RFQ e email in memoria commerciale interrogabile.",
      "Riattivare domanda dormiente e seguire opportunità.",
      "Trovare supplier e buyer pertinenti senza perdere contesto.",
    ],
    valueProposition:
      "Un workspace commerciale verticale che si affianca all'ERP e trasforma anni di email, offerte e relazioni in memoria operativa e nuove opportunità.",
    validationStatus: "Evidence-supported hypothesis",
  },
  {
    rank: 2,
    fit: "Second ICP",
    segment: "Produttori di tubi e prodotti steel",
    whyNow:
      "Italian steel production is concentrated and strategically important. Commercial Memory, account intelligence and demand visibility fit, but the buying motion is expected to be more enterprise-led.",
    coreJobs: [
      "Consolidare memoria di clienti, prodotti, RFQ e offerte.",
      "Aumentare visibilità su domanda e account dormienti.",
      "Rendere più veloce la ricerca commerciale interna.",
      "Ricevere opportunità compatibili con capability e gamma.",
    ],
    valueProposition:
      "Commercial intelligence verticale per sales team industriali, collegata a un network e a domanda qualificata.",
    validationStatus: "Supported hypothesis",
  },
  {
    rank: 3,
    fit: "Expansion ICP",
    segment: "Terzisti / processor / service provider",
    whyNow:
      "Processors are structurally part of the distribution ecosystem and benefit from capability discovery, recurring quotation history and buyer access, but paid-seat intensity still needs interviews.",
    coreJobs: [
      "Essere trovati per capability specifiche.",
      "Gestire richieste e storico quotazioni.",
      "Collegarsi a buyer e commercianti rilevanti.",
    ],
    valueProposition:
      "Più discovery qualificata e meno dispersione nella gestione commerciale delle lavorazioni.",
    validationStatus: "Needs interviews",
  },
  {
    rank: 4,
    fit: "Demand-side ICP",
    segment: "Utilizzatori industriali",
    whyNow:
      "The downstream base is very broad and valuable for Marketplace density, but the full Commercial Memory wedge is less universal than it is for distributors and producers.",
    coreJobs: [
      "Trovare supplier affidabili e compatibili.",
      "Pubblicare domanda strutturata.",
      "Confrontare risposta commerciale e capability.",
      "Accedere a riferimenti tecnici steel/tube.",
    ],
    valueProposition:
      "Un punto unico per discovery, domanda e conoscenza tecnica, con accesso graduale alle funzioni commerciali.",
    validationStatus: "Needs interviews",
  },
] as const;

export const competitiveAlternatives = [
  {
    category: "Status quo",
    examples: "Email + Excel + shared folders + existing ERP",
    strength:
      "Already paid for, familiar and deeply embedded in daily work.",
    gap:
      "Commercial context stays fragmented; retrieval, cross-rep visibility and dormant-account activation remain manual.",
    implication:
      "This is the primary competitor. Smart Steel Sales must create value before asking the customer to change core ERP processes.",
  },
  {
    category: "Generic CRM",
    examples: "Salesforce, Dynamics CRM, HubSpot and similar",
    strength:
      "Strong account, pipeline, workflow and ecosystem capabilities.",
    gap:
      "Not natively organised around steel grades, standards, dimensions, RFQ lines, quote history and supplier/buyer industry relationships.",
    implication:
      "Position against configuration burden and missing steel context, not against CRM as a category.",
  },
  {
    category: "Metals ERP",
    examples: "INVEX, unitop, Metols, MetalTrax",
    strength:
      "Deep inventory, order, pricing, processing, traceability and operational workflows built for metals.",
    gap:
      "Their centre of gravity is operational ERP. Several also offer CRM/AI, so Smart Steel Sales should not claim an empty market.",
    implication:
      "Integrate and coexist where possible. The wedge is commercial memory + industry graph + demand activation, not replacing warehouse/accounting systems.",
  },
  {
    category: "Digital commerce / revenue layer",
    examples: "Stella Source and adjacent quoting/customer-portal tools",
    strength:
      "Strong digital quoting, ordering, customer portals and revenue execution.",
    gap:
      "Does not by itself reproduce the combination of private historical memory, claimable network, technical discovery and governed marketplace.",
    implication:
      "Watch closely as an adjacent category and potential future integration/competition vector.",
  },
  {
    category: "Associations & market networks",
    examples: "ASSOFERMET, EUROMETAL",
    strength:
      "Trusted industry relationships, market intelligence, events and sector authority.",
    gap:
      "Not a tenant-level commercial operating system and not a private company memory layer.",
    implication:
      "Potential distribution and credibility partners rather than direct substitutes.",
  },
] as const;

export const buyerPersonas = [
  {
    persona: "Sales Director / Direttore Commerciale",
    pain:
      "Visibilità frammentata su trattative, attività dei commerciali, account dormienti e memoria prezzi.",
    outcome:
      "Controllo commerciale, riuso della conoscenza aziendale e migliore conversione senza introdurre un CRM generico pesante.",
  },
  {
    persona: "Commerciale / Area Manager",
    pain:
      "Tempo perso tra email, PDF, Excel e memoria personale per ricostruire clienti, prezzi, offerte e contesto.",
    outcome:
      "Risposte più rapide, follow-up più informato e ricerca immediata della storia commerciale.",
  },
  {
    persona: "Owner / Sales-led SME",
    pain:
      "Conoscenza commerciale concentrata in poche persone e processi poco trasferibili.",
    outcome:
      "Memoria aziendale strutturata, network più ampio e maggiore resilienza organizzativa.",
  },
] as const;

export const jobsToBeDone = [
  "Quando arriva una nuova RFQ, voglio sapere immediatamente cosa abbiamo già quotato, a chi, quando e a che prezzo.",
  "Quando un cliente torna dopo mesi, voglio ricostruire il contesto senza cercare manualmente in mailbox e cartelle.",
  "Quando il pipeline rallenta, voglio individuare domanda dormiente e account da riattivare.",
  "Quando cerco un nuovo supplier o buyer, voglio partire da aziende industrialmente pertinenti e identità affidabili.",
  "Quando emerge una domanda reale, voglio distribuirla a supplier compatibili senza perdere controllo su privacy e relazione commerciale.",
] as const;

export const differentiation = [
  {
    title: "Vertical data model",
    body:
      "RFQ, offer, order, product, grade, standard, dimension and company relationships are modeled for steel/tube workflows rather than adapted from a generic CRM.",
  },
  {
    title: "Two knowledge layers",
    body:
      "Private company memory stays tenant-isolated while public technical and company-network knowledge becomes a distribution asset.",
  },
  {
    title: "Network identity + trust",
    body:
      "Claim, verification, provenance and company taxonomy create a governed industry graph rather than a scraped directory.",
  },
  {
    title: "Demand-to-response loop",
    body:
      "Marketplace connects the network to structured demand, enabling a path from discovery to governed commercial response.",
  },
] as const;

export const evidenceLedger = [
  {
    label: "Product hardening",
    status: "Completed",
    detail: "HP1–HP18 + L27.1 complete; production journey and release gates are green.",
  },
  {
    label: "Market structure evidence",
    status: "Completed",
    detail:
      "L27.2A.1 now anchors the first ICP decision in ASSOFERMET, EUROMETAL, Federacciai, EUROFER, ISTAT and Eurostat evidence.",
  },
  {
    label: "ICP / value proposition",
    status: "In progress",
    detail:
      "Distributor-first is now an evidence-supported hypothesis; customer interviews and observed pilot behaviour are still required for validation.",
  },
  {
    label: "Pricing / packaging",
    status: "Next",
    detail: "L27.2B will define what is free, paid, seat-based or usage/credit-based.",
  },
  {
    label: "Unit economics",
    status: "Next",
    detail: "L27.2C will quantify infrastructure, AI, support, CAC and margin assumptions.",
  },
  {
    label: "Commercial evidence",
    status: "Pre-launch",
    detail: "L27.5 / P5.6C–E will validate usage, friction and willingness-to-pay with real companies.",
  },
] as const;

export const businessPlanRoadmap = [
  { code: "L27.2A.1", title: "ICP Evidence & Market Segmentation", status: "Active" },
  { code: "L27.2A.2", title: "ICP Interview & Validation Framework", status: "Next" },
  { code: "L27.2B", title: "Packaging & Pricing Architecture", status: "Next" },
  { code: "L27.2C", title: "Unit Economics & Financial Model", status: "Next" },
  { code: "L27.2D", title: "Business Plan v2 Consolidation", status: "Next" },
] as const;
